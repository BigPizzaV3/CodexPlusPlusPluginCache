const path = require("node:path");
const crypto = require("node:crypto");
const fs = require("node:fs");
const { getPolicy } = require("./config");
const { withState, importOnce, readLegacyLines } = require("./stateStore");

function sanitizeObject(value) {
  if (Array.isArray(value)) return value.map(sanitizeObject);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, child]) => [key,
      /^(data|raw|rawPayload|body|soql|parameters)$/i.test(key) ? "[raw_input_omitted]" :
      /password|secret|token|key|credential|dsn|authorization|connectionstring/i.test(key)
        ? "***redacted***" : sanitizeObject(child)]));
  }
  if (typeof value === "string") {
    return value.replace(/(Bearer\s+)[^\s",]+/gi, "$1***redacted***")
      .replace(/(https?:\/\/|postgres(?:ql)?:\/\/|mysql:\/\/|mariadb:\/\/)[^\s/@]+:[^\s/@]+@/gi, "$1***redacted***@")
      .replace(/((?:password|pwd|access_token)\s*[=:]\s*)[^;\s&]+/gi, "$1***redacted***");
  }
  return value;
}

function importAudit(db, file) {
  importOnce(db, "legacy_audit", () => {
    const records = readLegacyLines(file);
    const replay = readLegacyLines(path.join(path.dirname(file), "replay.jsonl"));
    if (!records.length && !replay.length) return;
    const replayById = new Map(replay.map((row) => [row.id, row]));
    if (records.length !== replay.length || replayById.size !== replay.length ||
        records.some((row) => !replayById.has(row.id))) {
      throw new Error("Legacy audit/replay mismatch; preserve files and reconcile before migration");
    }
    const insert = db.prepare("INSERT INTO audit(record,replay) VALUES(?,?)");
    for (const record of records) insert.run(JSON.stringify(sanitizeObject(record)), JSON.stringify(sanitizeObject(replayById.get(record.id))));
  });
}

function appendAuditEvent(logFile, event) {
  return withState(logFile, (db) => {
    importAudit(db, logFile);
    const previous = db.prepare("SELECT replay FROM audit ORDER BY sequence DESC LIMIT 1").get();
    const previousReplayId = previous ? JSON.parse(previous.replay).replayId : null;
    const record = sanitizeObject({ ...event, ts: new Date().toISOString() });
    const replay = {
      ...record,
      payload: getPolicy().replay?.includePayload ? record.payload : "[redacted]",
      replayId: "replay-" + crypto.randomUUID(),
      previousReplayId,
    };
    db.prepare("INSERT INTO audit(record,replay) VALUES(?,?)").run(JSON.stringify(record), JSON.stringify(replay));
    return { record, replay };
  });
}

function buildEvent({ tool, actor = "codex-agent", environment = "lab", riskLevel = "LOW",
  decision = "ALLOW", payload = {}, requiresApproval = false, status, blockedReason }) {
  return { actor, environment, tool, riskLevel, decision, status, requiresApproval,
    blockedReason, payload, id: "audit-" + crypto.randomUUID() };
}

function readReplayLog(logFile, replayId) {
  return withState(logFile, (db) => {
    importAudit(db, logFile);
    return db.prepare("SELECT replay FROM audit ORDER BY sequence").all()
      .map((row) => JSON.parse(row.replay)).filter((row) => !replayId || row.replayId === replayId);
  });
}

function verifyAudit(logFile) {
  return withState(logFile, (db) => {
    importAudit(db, logFile);
    const rows = db.prepare("SELECT record,replay FROM audit ORDER BY sequence").all();
    let previous = null;
    const seen = new Set();
    const issues = [];
    for (const [index, row] of rows.entries()) {
      const record = JSON.parse(row.record);
      const replay = JSON.parse(row.replay);
      if (replay.previousReplayId !== previous || seen.has(replay.replayId) || record.id !== replay.id) issues.push(index);
      seen.add(replay.replayId);
      previous = replay.replayId;
    }
    const integrity = db.prepare("PRAGMA integrity_check").get().integrity_check;
    const recovery = db.prepare("SELECT value FROM metadata WHERE key='legacy_recovery_epoch'").get();
    return { status: issues.length || integrity !== "ok" ? "failed" : recovery ? "current_epoch_verified_legacy_unverified" : "verified",
      records: rows.length, issues, storageIntegrity: integrity, source: "local_audit",
      historicalIntegrity: recovery ? "unverified_preserved_separately" : "not_separately_recovered",
      recovery: recovery ? JSON.parse(recovery.value) : null,
      tamperProof: false, storage: "sqlite_transactional" };
  });
}

function auditStateRecovery(logFile, args = {}) {
  if (!["inspect", "start_new_epoch"].includes(args.action)) throw new Error("Recovery action must be inspect or start_new_epoch");
  const files = [logFile, path.join(path.dirname(logFile), "replay.jsonl")];
  const capture = () => files.map((file) => {
    if (fs.existsSync(file) && fs.statSync(file).size > 64 * 1024 * 1024) throw new Error("Legacy file exceeds recovery size bound");
    const raw = fs.existsSync(file) ? fs.readFileSync(file) : Buffer.alloc(0);
    return { file, raw, hash: crypto.createHash("sha256").update(raw).digest("hex") };
  });
  const captured = capture();
  const parsed = captured.map(({ raw }) => raw.toString("utf8").split(/\r?\n/).filter((line) => line.trim()).map((line) => {
    try { const value = JSON.parse(line); return value && typeof value === "object" && !Array.isArray(value) ? value : null; } catch { return null; }
  }));
  const [audit, replay] = parsed;
  const replayIds = new Set(replay.filter(Boolean).map((row) => row.id));
  let previous = null, chainBreaks = 0;
  const seen = new Set();
  for (const row of replay) {
    if (!row || !row.replayId || row.previousReplayId !== previous || seen.has(row.replayId)) chainBreaks++;
    if (row) { previous = row.replayId; seen.add(row.replayId); }
  }
  const fingerprint = crypto.createHash("sha256").update(JSON.stringify(captured.map(({ file, hash }) => ({ file, hash })))).digest("hex");
  const report = { fingerprint, auditRecords: audit.length, replayRecords: replay.length,
    malformedRecords: parsed.flat().filter((row) => !row).length,
    unmatchedAuditRecords: audit.filter((row) => row && !replayIds.has(row.id)).length,
    chainBreaks, files: captured.map(({ file, hash }) => ({ file, sha256: hash })),
    historicalIntegrity: "not_verified", executionAuthorized: false };
  if (args.action === "inspect") return { ...report, action: "inspect", changed: false };
  if (args.expectedFingerprint !== fingerprint || args.acknowledgeHistoricalGaps !== true || typeof args.reason !== "string" || !args.reason.trim() || args.reason.length > 1000) {
    throw new Error("Exact fingerprint, explicit historical-gap acknowledgment and bounded reason required");
  }
  return withState(logFile, (db) => {
    if (db.prepare("SELECT COUNT(*) AS count FROM audit").get().count || db.prepare("SELECT value FROM metadata WHERE key='legacy_audit'").get()) throw new Error("Existing audit epoch cannot be replaced");
    if (capture().some((item, index) => item.hash !== captured[index].hash)) throw new Error("Legacy evidence changed during recovery");
    const epoch = { ...report, epochId: crypto.randomUUID(), startedAt: new Date().toISOString(), reason: sanitizeObject(args.reason) };
    // Preserve exact original bytes separately; they are never rewritten into a fabricated replay chain.
    db.exec("CREATE TABLE IF NOT EXISTS legacy_recovery_sources (path TEXT PRIMARY KEY, sha256 TEXT NOT NULL, content BLOB NOT NULL)");
    const insert = db.prepare("INSERT INTO legacy_recovery_sources(path,sha256,content) VALUES(?,?,?)");
    for (const item of captured) insert.run(item.file, item.hash, item.raw);
    db.prepare("INSERT INTO metadata(key,value) VALUES('legacy_recovery_epoch',?)").run(JSON.stringify(epoch));
    db.prepare("INSERT INTO metadata(key,value) VALUES('legacy_audit',?)").run(epoch.startedAt);
    const record = { ...buildEvent({ tool: "audit_state_recovery", actor: "local-operator", payload: epoch }), ts: epoch.startedAt };
    const replayRecord = { ...record, replayId: "replay-" + crypto.randomUUID(), previousReplayId: null };
    db.prepare("INSERT INTO audit(record,replay) VALUES(?,?)").run(JSON.stringify(record), JSON.stringify(replayRecord));
    return { ...epoch, action: "start_new_epoch", changed: true, originalFilesModified: false, historicalIntegrity: "unverified_preserved_separately" };
  });
}

module.exports = { appendAuditEvent, buildEvent, readReplayLog, verifyAudit, sanitizeObject, auditStateRecovery };
