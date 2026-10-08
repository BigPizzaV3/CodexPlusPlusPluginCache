const test = require("node:test");
const assert = require("node:assert/strict");
const { dispatch } = require("../runtime/orchestrator");
const { PostgresAdapter } = require("../runtime/db/postgresAdapter");
const { SqlServerAdapter } = require("../runtime/db/sqlServerAdapter");
const { getPolicy } = require("../runtime/config");

test("tuning budgets expose regressions, uncovered cases and invalid limits", () => {
  const { reviewTuningRun } = require("../runtime/db/connector");
  const context = { validityContext: { schemaHash: "s", dataProfileHash: "d", configurationHash: "c", loadProfileHash: "l" } };
  const replay = { records: ["fast", "slow"].flatMap((caseId) => [0, 1, 2].map(() => ({ caseId, resultsMatch: true,
    observations: { baseline: { durationMs: 10 }, candidate: { durationMs: caseId === "slow" ? 20 : 5 } } }))) };
  const budgets = [{ caseId: "slow", maxCandidateMedianMs: 20, maxRegressionMs: 9 }];
  const result = reviewTuningRun(context, replay, context, budgets);
  assert.equal(result.decision, "reject_performance_budget");
  assert.deepEqual(result.unbudgetedCases, ["fast"]);
  assert.deepEqual(result.budgetResults[0].violations, ["regression_exceeds_limit"]);
  assert.equal(reviewTuningRun(context, replay, context, [{ caseId: "slow", maxRegressionMs: 10 }]).budgetResults[0].status, "within_observed_budget");
  assert.equal(reviewTuningRun(context, replay, {}, budgets).decision, "inconclusive_context_changed");
  for (const invalid of [[], [{ caseId: "missing", maxRegressionMs: 1 }], [...budgets, ...budgets],
    [{ caseId: "slow", maxRegressionMs: -1 }], [{ caseId: "slow", maxRegressionMs: Infinity }],
    [{ caseId: "slow", maxRegressionMs: "1" }], [{ caseId: "slow", typo: 1 }]]) {
    assert.throws(() => reviewTuningRun(context, replay, context, invalid));
  }
});

test("business invariant counters reject malformed evidence and preserve large counts", () => {
  const { evaluateZeroViolations, reviewTuningRun } = require("../runtime/db/connector");
  for (const value of [0, "0", 0n]) assert.equal(evaluateZeroViolations([{ violations: value }]).status, "passed");
  for (const value of [null, -1, 0.5, "00", "-1", "0.0", Number.MAX_SAFE_INTEGER + 1]) assert.equal(evaluateZeroViolations([{ violations: value }]).status, "invalid_evidence");
  assert.equal(evaluateZeroViolations([]).status, "invalid_evidence");
  assert.equal(evaluateZeroViolations([{ violations: "9007199254740993" }]).violations, "9007199254740993");
  const observation = { durationMs: 1, invariant: { status: "failed", violations: "1" } };
  const result = reviewTuningRun({}, { records: [{ caseId: "tenant", resultsMatch: true, observations: { baseline: observation, candidate: observation } }] }, {});
  assert.equal(result.decision, "reject_business_invariant");
  assert.equal(result.productionChangeAuthorized, false);
});

test("tuning lab review reports per-case medians without authorizing deployment", () => {
  const { reviewTuningRun } = require("../runtime/db/connector");
  const context = { validityContext: { schemaHash: "s", dataProfileHash: "d", configurationHash: "c", loadProfileHash: "l" } };
  const replay = { records: [1, 2, 3].map((n) => ({ caseId: "a", resultsMatch: true,
    observations: { baseline: { durationMs: n * 10 }, candidate: { durationMs: n * 5 } } })) };
  const result = reviewTuningRun(context, replay, context);
  assert.equal(result.cases[0].baselineMedianMs, 20);
  assert.equal(result.cases[0].candidateMedianMs, 10);
  assert.equal(result.productionChangeAuthorized, false);
  assert.equal(result.statisticalSignificanceEstablished, false);
  assert.equal(result.decision, "review_recorded_measurements");
  assert.equal(reviewTuningRun(context, replay, {}).decision, "inconclusive_context_changed");
  replay.records[0].resultsMatch = false;
  assert.equal(reviewTuningRun(context, replay, context).decision, "reject_result_difference");
  replay.records[0].observations.baseline.durationMs = NaN;
  assert.throws(() => reviewTuningRun(context, replay, context), /Invalid measured/);
});

test("integrated tuning lab refuses unqualified production targets before connection", async () => {
  const { runTuningLab } = require("../runtime/db/connector");
  await assert.rejects(runTuningLab({}, { engine: "postgres", database: "production", systemId: "host", environment: "production",
    product: "erp", productVersion: "1", deployment: "d" }), /lab environments/);
});

for (const engine of ["postgres", "sqlserver"]) {
  test(`integrated tuning lab ${engine} collects both contexts and closes on failure`, async (t) => {
    const { runTuningLab } = require("../runtime/db/connector");
    const prototype = engine === "postgres" ? PostgresAdapter.prototype : SqlServerAdapter.prototype;
    const saved = { initialize: prototype.initialize, close: prototype.close, registry: process.env.CODEXDB_REPLAY_REGISTRY_JSON };
    t.after(() => {
      prototype.initialize = saved.initialize; prototype.close = saved.close;
      if (saved.registry === undefined) delete process.env.CODEXDB_REPLAY_REGISTRY_JSON;
      else process.env.CODEXDB_REPLAY_REGISTRY_JSON = saved.registry;
    });
    const scope = { engine, database: "isolated", environment: "lab", systemId: "fixture", product: "erp", productVersion: "1", deployment: "fixture" };
    const sql = engine === "postgres" ? "SELECT $1 AS value" : "SELECT @codex_arg_1 AS value";
    const template = { sql, sha256: require("node:crypto").createHash("sha256").update(sql).digest("hex"), parameterCount: 1, maxRows: 10, reviewedReadOnly: true };
    process.env.CODEXDB_REPLAY_REGISTRY_JSON = JSON.stringify({ [engine]: { ...scope, isolated: true, readOnlyPrincipalReviewed: true, templates: { reviewed: template } } });
    let opened = 0, closed = 0, releases = 0, failAfter = false, mismatch = false, queryCount = 0, invariantCount = null;
    prototype.initialize = async function () {
      const connectionIndex = ++opened;
      const query = async (text) => {
        if (text.includes("database_name")) return [{ database_name: "isolated" }];
        if (failAfter && connectionIndex % 3 === 0) throw new Error("after capture failed");
        if (text === sql) return invariantCount === null ? [{ value: mismatch ? ++queryCount : 42 }] : [{ violations: invariantCount }];
        return [];
      };
      if (engine === "postgres") {
        this.pool = { query: async (text) => ({ rows: await query(text) }), connect: async () => ({
          query: async (input) => ({ rows: await query(typeof input === "string" ? input : input.text) }),
          release: () => { releases++; },
        }) };
      } else {
        this.connection = { request: () => ({ input() { return this; }, query: async (text) => ({ recordset: await query(text) }) }) };
      }
      return { initialized: true, adapter: `${engine}_adapter` };
    };
    prototype.close = async () => { closed++; };
    const args = { ...scope, cases: [{ id: "case", baselineTemplate: "reviewed", candidateTemplate: "reviewed", parameters: [42] }],
      coverage: Object.fromEntries(["nulls", "duplicates", "rounding", "timezone", "permissions"].map((key) => [key, ["case"]])) };
    const result = await runTuningLab({}, args);
    assert.equal(result.replay.records.length, 3);
    assert.equal(result.review.decision, "review_recorded_measurements");
    assert.equal(result.review.productionChangeAuthorized, false);
    assert.equal(opened, 3); assert.equal(closed, 3);
    if (engine === "postgres") assert.equal(releases, 16);
    mismatch = true;
    assert.equal((await runTuningLab({}, args)).review.decision, "reject_result_difference");
    invariantCount = "1";
    const invariantRun = await runTuningLab({}, { ...args, cases: args.cases.map((c) => ({ ...c, assertion: "zero_violations" })) });
    assert.equal(invariantRun.replay.resultsMatch, true);
    assert.equal(invariantRun.review.decision, "reject_business_invariant");
    failAfter = true;
    await assert.rejects(runTuningLab({}, args), /after capture failed/);
    assert.equal(opened, 12); assert.equal(closed, 12);
  });
}

test("TempDB collector requires exact scope, preserves counters and exposes partial evidence", async () => {
  const { collectTempdbHealth } = require("../runtime/db/connector");
  const originals = Object.fromEntries(["initialize", "close", "_readCatalog"].map((key) => [key, SqlServerAdapter.prototype[key]]));
  let closed = 0, fail = false;
  SqlServerAdapter.prototype.initialize = async function () {
    this.connection = { request: () => ({ query: async () => ({ recordset: [{ database_name: "tempdb" }] }) }) };
    return { initialized: true, adapter: "sqlserver_adapter" };
  };
  SqlServerAdapter.prototype.close = async function () { closed++; };
  SqlServerAdapter.prototype._readCatalog = async function (sql) {
    assert.match(sql, /^SELECT /);
    assert.doesNotMatch(sql, /physical_name|sql_text|\bALTER\b|\bDBCC\b/);
    if (sql.includes("sys.database_files")) return [
      { file_id: 1, type_desc: "ROWS", size_pages: "9007199254740993", growth: 10, is_percent_growth: true },
      { file_id: 3, type_desc: "ROWS", size_pages: "9007199254740994", growth: 0, is_percent_growth: false },
    ];
    if (sql.includes("dm_db_log_space_usage") && fail) throw new Error("secret detail");
    if (sql.includes("dm_exec_requests")) {
      assert.match(sql, /wait_resource LIKE '2:%'/);
      return fail ? Array(1001).fill({ session_id: 52 }) : [{ session_id: 52 }];
    }
    return [];
  };
  try {
    const args = { engine: "sqlserver", database: "tempdb" };
    const result = await collectTempdbHealth({ policy: {} }, args);
    assert.equal(result.findings.length, 4);
    assert.equal(result.sections.files.rows[0].size_pages, "9007199254740993");
    assert.equal(result.bottleneckProven, false);
    assert.equal(result.executionAuthorized, false);
    fail = true;
    const partial = await collectTempdbHealth({ policy: {} }, args);
    assert.equal(partial.sections.log.status, "unavailable");
    assert.equal(partial.sections.page_waits.rows.length, 1000);
    assert.equal(partial.status, "limited_evidence");
    assert.doesNotMatch(JSON.stringify(partial), /secret detail/);
    assert.equal(closed, 2);
    await assert.rejects(collectTempdbHealth({}, { ...args, database: "master" }), /tempdb required/);
    await assert.rejects(collectTempdbHealth({}, { ...args, engine: "postgres" }), /SQL Server/);
  } finally { Object.assign(SqlServerAdapter.prototype, originals); }
});

test("replication collector preserves large counters, scopes slots and exposes unavailable sections", async () => {
  const { collectReplicationHealth } = require("../runtime/db/connector");
  const originals = Object.fromEntries(["initialize", "close", "_readCatalog"].map((key) => [key, PostgresAdapter.prototype[key]]));
  let closed = 0, unavailable = false, oversized = false;
  PostgresAdapter.prototype.initialize = async function () {
    this.pool = { query: async () => ({ rows: [{ database_name: "fixture" }] }) };
    return { initialized: true, adapter: "postgres_adapter" };
  };
  PostgresAdapter.prototype.close = async function () { closed++; };
  PostgresAdapter.prototype._readCatalog = async function (sql) {
    assert.doesNotMatch(sql, /pg_drop_replication_slot|pg_switch_wal|archive_command/);
    if (sql.includes("pg_replication_slots")) assert.match(sql, /database=current_database\(\) OR database IS NULL/);
    if (sql.includes("safe_wal_size")) {
      if (unavailable) throw new Error("secret server error");
      return [{ slot_name: "consumer", wal_status: "lost", safe_wal_size: null }];
    }
    if (sql.includes("WITH reference")) {
      assert.match(sql, /CASE WHEN pg_is_in_recovery\(\) THEN pg_last_wal_receive_lsn\(\)/);
      const row = { slot_name: "consumer", active: false, restart_lsn: "0/1", retained_lsn_distance_bytes: "9007199254740993" };
      return oversized ? Array(1001).fill(row) : [row];
    }
    if (sql.includes("pg_settings")) return [{ name: "max_slot_wal_keep_size", setting: "-1" }];
    return [];
  };
  try {
    const args = { engine: "postgres", database: "fixture" };
    const result = await collectReplicationHealth({ policy: {} }, args);
    assert.equal(result.sections.slots.rows[0].retained_lsn_distance_bytes, "9007199254740993");
    assert.equal(result.findings.length, 3);
    assert.equal(result.replicationHealthy, null);
    assert.equal(result.executionAuthorized, false);
    unavailable = true; oversized = true;
    const limited = await collectReplicationHealth({ policy: {} }, args);
    assert.equal(limited.status, "limited_evidence");
    assert.equal(limited.sections.slots.rows.length, 1000);
    assert.equal(limited.sections.slot_limits.status, "unavailable");
    assert.doesNotMatch(JSON.stringify(limited), /secret server error/);
    assert.equal(closed, 2);
    await assert.rejects(collectReplicationHealth({}, { ...args, engine: "mysql" }), /PostgreSQL/);
  } finally { Object.assign(PostgresAdapter.prototype, originals); }
});

test("live blocking frames deduplicate blockers and fail closed on hidden identities", async () => {
  const { collectBlockingFrame } = require("../runtime/db/connector");
  const originals = Object.fromEntries(["initialize", "close", "_readCatalog"].map((key) => [key, PostgresAdapter.prototype[key]]));
  let closed = 0;
  let row = { pid: 123, backend_start: "2026-01-01T00:00:00.000Z", blockers: [0, 456, 456] };
  PostgresAdapter.prototype.initialize = async function () {
    this.pool = { query: async () => ({ rows: [{ database_name: "fixture" }] }) };
    return { initialized: true, adapter: "postgres_adapter" };
  };
  PostgresAdapter.prototype.close = async function () { closed++; };
  PostgresAdapter.prototype._readCatalog = async function (sql) {
    assert.match(sql, /pg_blocking_pids/);
    assert.match(sql, /datname=current_database\(\)/);
    assert.doesNotMatch(sql, /\bquery\b/);
    return [{ captured_at: new Date("2026-01-01T01:00:00.000Z"), sessions: [row] }];
  };
  try {
    const args = { engine: "postgres", systemId: "fixture-host", database: "fixture" };
    const result = await collectBlockingFrame({ policy: {} }, args);
    assert.deepEqual(result.frame.sessions[0].blockedBy, ["0", "456"]);
    assert.equal(result.preview.timeline[0].gaps.length, 2);
    assert.equal(result.queryTextExported, false);
    assert.equal(closed, 1);
    row = { ...row, backend_start: null };
    await assert.rejects(collectBlockingFrame({ policy: {} }, args), /hidden/);
    assert.equal(closed, 2);
    await assert.rejects(collectBlockingFrame({ policy: {} }, { ...args, engine: "mysql" }), /PostgreSQL/);
  } finally { Object.assign(PostgresAdapter.prototype, originals); }
});

function blockingFixture() {
  const scope = { engine: "postgres", systemId: "lab-1", database: "lab" };
  const startedAt = "2026-01-01T09:00:00.000Z";
  return { ...scope, frames: [{ ...scope, capturedAt: "2026-01-01T10:00:00.000Z", evidenceRef: "snapshot-1",
    sessions: [{ sessionId: "1", startedAt, blockedBy: [] }, { sessionId: "2", startedAt, blockedBy: ["1"] }] }] };
}

test("blocking timeline preserves session identity and observed root relationships", async () => {
  const args = blockingFixture();
  const next = structuredClone(args.frames[0]);
  next.capturedAt = "2026-01-01T10:01:00.000Z";
  next.evidenceRef = "snapshot-2";
  next.sessions[0].startedAt = "2026-01-01T10:00:30.000Z";
  args.frames.push(next);
  const result = await dispatch("blocking_timeline", args);
  assert.equal(result.timeline.length, 2);
  assert.equal(result.timeline[0].observedRootBlockers.length, 1);
  assert.equal(result.sessions.filter((session) => session.sessionId === "1").length, 2);
  assert.equal(result.continuousBlockingDurationMs, null);
  assert.equal(result.executionAuthorized, false);
});

test("blocking timeline exposes missing blockers and cycles without declaring deadlock", async () => {
  const args = blockingFixture();
  args.frames[0].sessions[0].blockedBy = ["2", "missing"];
  const result = await dispatch("blocking_timeline", args);
  assert.equal(result.status, "requires_investigation");
  assert.equal(result.timeline[0].gaps.length, 1);
  assert.ok(result.timeline[0].cycles.length > 0);
  assert.equal(result.deadlockProven, false);
  assert.deepEqual(result.timeline[0].observedRootBlockers, []);
});

test("blocking timeline rejects mixed scopes and unordered capture times", async () => {
  const args = blockingFixture();
  args.frames.push(structuredClone(args.frames[0]));
  await assert.rejects(dispatch("blocking_timeline", args), /ascending/);
  args.frames.pop();
  args.frames[0].database = "other";
  await assert.rejects(dispatch("blocking_timeline", args), /scope/);
});

test("consulting project is reachable through governed dispatch and exports a report", async () => {
  const fs = require("node:fs"), path = require("node:path"), os = require("node:os");
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "aivana-project-"));
  try {
    await withEnv({ CODEXDB_STATE_DIR: directory }, async () => {
      const scope = { tenantId: "tenant-test", projectId: "assessment" };
      const created = await dispatch("consulting_project", { ...scope, action: "create", data: {
        goals: [{ id: "g1", text: "Reduce invoice latency without changing totals" }],
        systems: [{ id: "s1", text: "Isolated PostgreSQL lab" }],
        evidence: [{ id: "e1", text: "mysql://user:unit-secret@host/db" }],
        findings: [{ id: "f1", text: "Baseline evidence requires review", evidenceRefs: ["e1"] }],
      } });
      assert.equal(created.project.revision, 1);
      assert.equal(created.approvalGranted, false);
      assert.equal(JSON.stringify(created).includes("unit-secret"), false);
      const exported = await dispatch("consulting_project", { ...scope, action: "export", format: "markdown" });
      assert.match(exported.report, /# Consulting Project/);
      assert.match(exported.reportHash, /^[a-f0-9]{64}$/);
      await assert.rejects(dispatch("consulting_project", { ...scope, tenantId: "other", action: "get" }), /unavailable/);
    });
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});

test("DBA maintenance collector exposes partial evidence and closes the connection", async () => {
  const { collectDbaMaintenance } = require("../runtime/db/connector");
  const original = Object.fromEntries(["initialize", "close", "_readCatalog"].map((key) => [key, PostgresAdapter.prototype[key]]));
  let closed = false;
  PostgresAdapter.prototype.initialize = async function () {
    this.pool = { query: async () => ({ rows: [{ database_name: "fixture" }] }) };
    return { initialized: true, adapter: "postgres_adapter" };
  };
  PostgresAdapter.prototype.close = async function () { closed = true; };
  PostgresAdapter.prototype._readCatalog = async function (sql) {
    assert.match(sql, /^SELECT /);
    if (sql.includes("pg_settings")) throw new Error("private connection detail");
    return sql.includes("pg_stat_user_tables") ? Array.from({ length: 1001 }, () => ({ n_dead_tup: 1 })) : [];
  };
  try {
    const result = await collectDbaMaintenance({ policy: {} }, { engine: "postgres", database: "fixture" });
    assert.equal(result.sections.maintenance.rows.length, 1000);
    assert.equal(result.sections.maintenance.truncated, true);
    assert.equal(result.sections.configuration.status, "unavailable");
    assert.equal(result.sections.backup_history.status, "external_evidence_required");
    assert.equal(result.restoreVerified, false);
    assert.equal(result.rpoMet, null);
    assert.equal(JSON.stringify(result).includes("private connection"), false);
    assert.equal(closed, true);
  } finally { Object.assign(PostgresAdapter.prototype, original); }
});

test("audit recovery preserves legacy bytes and never certifies a broken old chain", () => {
  const fs = require("node:fs"), path = require("node:path"), os = require("node:os");
  const { auditStateRecovery, appendAuditEvent, buildEvent, verifyAudit } = require("../runtime/auditLogger");
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "aivana-recovery-"));
  const log = path.join(directory, "runtime-state.json"), replay = path.join(directory, "replay.jsonl");
  const bytes = '{"id":"old-a","tool":"old"}\n{"id":"old-b"}\n';
  fs.writeFileSync(log, bytes);
  fs.writeFileSync(replay, '{"id":"old-a","replayId":"r1","previousReplayId":"broken"}\n');
  try {
    const inspected = auditStateRecovery(log, { action: "inspect" });
    assert.equal(inspected.unmatchedAuditRecords, 1);
    assert.equal(inspected.chainBreaks, 1);
    assert.equal(fs.existsSync(log + ".sqlite"), false);
    assert.throws(() => auditStateRecovery(log, { action: "start_new_epoch", expectedFingerprint: "wrong" }), /fingerprint/);
    const recovered = auditStateRecovery(log, { action: "start_new_epoch", expectedFingerprint: inspected.fingerprint,
      acknowledgeHistoricalGaps: true, reason: "Preserve broken historical audit and start a new epoch" });
    assert.equal(recovered.originalFilesModified, false);
    assert.equal(fs.readFileSync(log, "utf8"), bytes);
    appendAuditEvent(log, buildEvent({ tool: "test" }));
    const verification = verifyAudit(log);
    assert.equal(verification.status, "current_epoch_verified_legacy_unverified");
    assert.equal(verification.records, 2);
    const { DatabaseSync } = require("node:sqlite");
    const db = new DatabaseSync(log + ".sqlite", { readOnly: true });
    try { assert.equal(Buffer.from(db.prepare("SELECT content FROM legacy_recovery_sources WHERE path=?").get(log).content).toString(), bytes); }
    finally { db.close(); }
    assert.throws(() => auditStateRecovery(log, { action: "start_new_epoch", expectedFingerprint: inspected.fingerprint,
      acknowledgeHistoricalGaps: true, reason: "retry" }), /cannot be replaced/);
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});

test("duplicate index review excludes uniqueness, prefix keys and descending differences", async () => {
  for (const engine of ["mysql", "mariadb"]) {
    const makeIndex = (name, overrides = {}) => ({ kind: "index", schema: "lab", name: `orders.${name}`, attributes: { rows: [
      { TABLE_NAME: "orders", INDEX_NAME: name, COLUMN_NAME: "customer", SEQ_IN_INDEX: 1, NON_UNIQUE: 1,
        INDEX_TYPE: "BTREE", SUB_PART: null, COLLATION: "A", ...overrides }] } });
    const snapshot = { engine, database: "lab", complete: false, coverage: { index: "collected" }, objects: [
      makeIndex("a"), makeIndex("b"), makeIndex("unique", { NON_UNIQUE: 0 }), makeIndex("prefix", { SUB_PART: 5 }),
      makeIndex("descending", { COLLATION: "D" }), makeIndex("unknown", { COLLATION: null })] };
    const result = await dispatch("duplicate_index_review", { snapshot });
    assert.equal(result.candidates.length, 1);
    assert.deepEqual(result.candidates[0].indexes, ["orders.a", "orders.b"]);
    assert.equal(result.excluded.length, 3);
    assert.equal(result.dropSql, null);
    assert.equal(result.estimatedSavings, null);
    assert.equal(result.executionAuthorized, false);
  }
});

test("native plan comparison rejects mismatched SQL and reports stale evidence", async () => {
  const before = { usp: "native_query_plan", source: "live", scope: { engine: "mysql", database: "lab" },
    connectionProfile: "mysql", queryHash: "a".repeat(64), capturedAt: new Date(Date.now() - 1000).toISOString(),
    result: { source: "live", analyzed: false, plan: [{ table: "orders", type: "ALL", key: null }] } };
  const after = structuredClone(before);
  after.result.plan = [{ key: null, type: "ALL", table: "orders" }];
  assert.equal((await dispatch("compare_native_plans", { before, after })).status, "same_observed_plan");
  after.result.plan[0].type = "ref";
  const changed = await dispatch("compare_native_plans", { before, after });
  assert.equal(changed.status, "plan_changed");
  assert.equal(changed.performanceImprovementProven, false);
  assert.equal(changed.steps.length, 1);
  after.capturedAt = "2020-01-01T00:00:00Z";
  assert.equal((await dispatch("compare_native_plans", { before, after })).status, "insufficient_evidence");
  after.queryHash = "b".repeat(64);
  await assert.rejects(dispatch("compare_native_plans", { before, after }), /identical/);
  after.queryHash = before.queryHash;
  after.result.analyzed = true;
  await assert.rejects(dispatch("compare_native_plans", { before, after }), /native plan/);
});

test("MySQL/MariaDB FK review preserves leading order and skips prefix indexes", async () => {
  for (const engine of ["mysql", "mariadb"]) {
    const snapshot = { engine, database: "fixture", complete: false, coverage: { index: "collected", foreign_key: "collected" }, objects: [
      { kind: "foreign_key", schema: "fixture", name: "orders.fk", attributes: { rows: [
        { TABLE_NAME: "orders", COLUMN_NAME: "company", ORDINAL_POSITION: 1 }, { TABLE_NAME: "orders", COLUMN_NAME: "customer", ORDINAL_POSITION: 2 }] } },
      { kind: "index", schema: "fixture", name: "orders.ix", attributes: { rows: [
        { TABLE_NAME: "orders", COLUMN_NAME: "customer", SEQ_IN_INDEX: 2, SUB_PART: null, INDEX_TYPE: "BTREE" },
        { TABLE_NAME: "orders", COLUMN_NAME: "company", SEQ_IN_INDEX: 1, SUB_PART: null, INDEX_TYPE: "BTREE" }] } },
    ] };
    const matched = await dispatch("foreign_key_index_review", { snapshot });
    assert.equal(matched.findings[0].status, "leading_columns_observed");
    assert.deepEqual(matched.findings[0].matchingIndexes, ["orders.ix"]);
    assert.equal(matched.executionAuthorized, false);
    snapshot.objects[1].attributes.rows[0].SUB_PART = 10;
    const prefix = await dispatch("foreign_key_index_review", { snapshot });
    assert.equal(prefix.findings[0].status, "no_matching_index_observed");
    assert.equal(prefix.skippedIndexes.length, 1);
    snapshot.objects[1].attributes.rows[0].SUB_PART = null;
    snapshot.objects[1].attributes.rows.reverse();
    snapshot.objects[1].attributes.rows.forEach((row, i) => { row.SEQ_IN_INDEX = 2 - i; });
    assert.equal((await dispatch("foreign_key_index_review", { snapshot })).findings[0].status, "no_matching_index_observed");
  }
});

function schemaContractFixture() {
  const object = { kind: "column", schema: "sales", name: "invoice.amount", attributes: { type: "decimal(18,2)" } };
  const before = { scope: { engine: "postgres", database: "lab" }, capturedAt: new Date(Date.now() - 1000).toISOString(),
    result: { engine: "postgres", database: "lab", objects: [object], coverage: { column: "collected" }, complete: true } };
  return { before, after: structuredClone(before), contract: { requiredObjects: [{ kind: object.kind, schema: object.schema, name: object.name }],
    protectedObjects: [], expectedChanges: [], maxAgeMinutes: 30 } };
}

test("schema contracts bind exact review evidence without authorizing deployments", async () => {
  const args = schemaContractFixture();
  const initial = await dispatch("schema_contract_check", args);
  assert.equal(initial.status, "observed_contract_matches");
  assert.equal(initial.deploymentApproved, false);
  assert.equal(initial.executionAuthorized, false);
  const reviewed = await dispatch("schema_contract_check", { ...args, reviewedFingerprint: initial.reviewFingerprint });
  assert.equal(reviewed.fingerprintMatches, true);
  args.after.result.objects[0].attributes.type = "decimal(8,2)";
  const changed = await dispatch("schema_contract_check", { ...args, reviewedFingerprint: initial.reviewFingerprint });
  assert.equal(changed.status, "contract_mismatch");
  assert.ok(changed.findings.some((item) => item.code === "unexpected_change"));
  assert.ok(changed.findings.some((item) => item.code === "review_fingerprint_mismatch"));
});

test("protected schema objects cannot be overridden by expected changes", async () => {
  const args = schemaContractFixture();
  const identity = args.contract.requiredObjects[0];
  args.contract.protectedObjects = [identity];
  args.contract.expectedChanges = [{ identity, type: "changed_observation" }];
  args.after.result.objects[0].attributes.type = "text";
  const result = await dispatch("schema_contract_check", args);
  assert.ok(result.findings.some((item) => item.code === "protected_object_changed"));
  assert.ok(!result.findings.some((item) => item.code === "unexpected_change"));
  args.after.result.objects = [];
  const missing = await dispatch("schema_contract_check", args);
  assert.ok(missing.findings.some((item) => item.code === "required_object_not_observed"));
  assert.ok(missing.findings.some((item) => item.code === "protected_object_not_observed"));
});

test("schema contracts expose stale, incomplete and missing-coverage evidence", async () => {
  const args = schemaContractFixture();
  args.before.capturedAt = "2020-01-01T00:00:00Z";
  args.after.result.complete = false;
  args.after.result.coverage.column = "unavailable";
  const result = await dispatch("schema_contract_check", args);
  assert.equal(result.status, "insufficient_evidence");
  assert.ok(result.evidenceGaps.includes("before: stale_or_invalid_capture_time"));
  assert.ok(result.evidenceGaps.includes("after: incomplete_catalog"));
  assert.ok(result.evidenceGaps.includes("after: column_not_collected"));
  args.after.scope.database = "other";
  await assert.rejects(dispatch("schema_contract_check", args), /scope mismatch/);
});

test("schema contracts reject empty, duplicate and invalid requirements", async () => {
  const args = schemaContractFixture();
  args.contract.requiredObjects.push(args.contract.requiredObjects[0]);
  await assert.rejects(dispatch("schema_contract_check", args), /Duplicate/);
  args.contract.requiredObjects = [];
  await assert.rejects(dispatch("schema_contract_check", args), /contract required/);
});

test("snapshot comparison ignores key order but preserves incomplete absence and array order", async () => {
  const { compareDatabaseSnapshots } = require("../runtime/db/connector");
  const object = { kind: "index", schema: "public", name: "orders.idx", attributes: { columns: ["a", "b"], unique: false } };
  const before = { engine: "postgres", database: "dev", objects: [object], coverage: { index: "collected" }, complete: false };
  const after = { ...before, database: "stage", objects: [{ attributes: { unique: false, columns: ["a", "b"] }, name: object.name, schema: object.schema, kind: object.kind }] };
  assert.equal(compareDatabaseSnapshots({ before, after }).unchangedCount, 1);
  const changed = compareDatabaseSnapshots({ before, after: { ...after, objects: [{ ...object, attributes: { columns: ["b", "a"], unique: false } }] } });
  assert.deepEqual(changed.changes[0].changedFields, ["attributes"]);
  const missing = compareDatabaseSnapshots({ before, after: { ...after, objects: [] } });
  assert.equal(missing.changes[0].type, "only_in_before");
  assert.equal(missing.changes[0].absenceConfirmed, false);
  assert.equal(missing.migrationSql, null);
  assert.equal(missing.executionAuthorized, false);
  assert.throws(() => compareDatabaseSnapshots({ before, after: { ...after, engine: "mysql" } }), /Cross-engine/);
  assert.throws(() => compareDatabaseSnapshots({ before, after: { ...after, objects: [object, object] } }), /Duplicate/);
});

test("live inspection dispatch discovers SQLite without authorizing writes", async () => {
  const fs = require("node:fs");
  const os = require("node:os");
  const path = require("node:path");
  const { DatabaseSync } = require("node:sqlite");
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "aivana-discovery-"));
  const database = path.join(directory, "catalog.sqlite");
  const fixture = new DatabaseSync(database);
  fixture.exec("CREATE TABLE customer (id INTEGER PRIMARY KEY, email TEXT UNIQUE); CREATE TABLE invoice (id INTEGER PRIMARY KEY, customer_id INTEGER REFERENCES customer(id), amount NUMERIC DEFAULT 0)");
  fixture.close();
  try {
    await withEnv({ CODEXDB_SQLITE_DATABASE: database, CODEXDB_SQLITE_ENGINE: "sqlite" }, async () => {
      const args = { engine: "sqlite", database };
      const discovered = await dispatch("discover_database", args);
      assert.equal(discovered.source, "live");
      assert.equal(discovered.executionAuthorized, false);
      assert.ok(discovered.result.objects.some((item) => item.kind === "foreign_key"));
      assert.ok(discovered.result.objects.some((item) => item.kind === "table" && item.name === "customer"));
      assert.equal(discovered.result.coverage.table, "collected");
      assert.equal(discovered.result.complete, false);
      const fkReview = await dispatch("foreign_key_index_review", { snapshot: discovered.result });
      assert.equal(fkReview.findings[0].table, "invoice");
      assert.equal(fkReview.findings[0].status, "no_matching_index_observed");
      assert.equal(fkReview.indexSql, null);
      const capabilities = await dispatch("database_capabilities", args);
      assert.equal(capabilities.result.writes, false);
      const plan = await dispatch("native_query_plan", { ...args, sql: "SELECT id FROM customer WHERE id = 1" });
      assert.equal(plan.result.source, "live");
      assert.equal(plan.result.analyzed, false);
      assert.ok(plan.result.plan.length > 0);
      assert.equal(plan.executionAuthorized, false);
      const planArgs = { ...args, sql: "SELECT id FROM invoice WHERE customer_id = 1" };
      const beforePlan = await dispatch("native_query_plan", planArgs);
      const labWriter = new DatabaseSync(database);
      try { labWriter.exec("CREATE INDEX invoice_customer_idx ON invoice(customer_id); CREATE INDEX invoice_customer_copy ON invoice(customer_id)"); } finally { labWriter.close(); }
      const afterPlan = await dispatch("native_query_plan", planArgs);
      const planDiff = await dispatch("compare_native_plans", { before: beforePlan, after: afterPlan });
      assert.equal(planDiff.status, "plan_changed");
      assert.equal(planDiff.performanceImprovementProven, false);
      const indexedCatalog = await dispatch("discover_database", args);
      const duplicateReview = await dispatch("duplicate_index_review", { snapshot: indexedCatalog.result });
      assert.equal(duplicateReview.candidates.length, 1);
      assert.deepEqual(duplicateReview.candidates[0].indexes, ["invoice.invoice_customer_copy", "invoice.invoice_customer_idx"]);
      assert.ok(duplicateReview.excluded.some((item) => item.name.includes("sqlite_autoindex_customer")));
      const brief = await dispatch("database_engineer_brief", { ...args, sql: planArgs.sql });
      assert.equal(brief.status, "limited_evidence");
      assert.equal(brief.sections.catalog.source, "live");
      assert.equal(brief.sections.indexes.source, "derived_from_live_catalog");
      assert.equal(brief.sections.indexes.duplicateCandidates.total, 1);
      assert.equal(brief.sections.indexes.duplicateCandidates.truncated, false);
      assert.equal(brief.sections.security.status, "unsupported");
      assert.equal(brief.sections.plan.status, "collected");
      assert.ok(brief.nextSteps.some((step) => step.id === "verify_duplicate_index_usage"));
      assert.ok(brief.evidenceGaps.some((gap) => gap.section === "security"));
      assert.equal(brief.executionAuthorized, false);
      assert.equal(brief.healthScore, null);
      const partial = await dispatch("database_engineer_brief", { ...args, sql: "SELECT * FROM missing_table" });
      assert.equal(partial.sections.plan.status, "unavailable");
      assert.equal(partial.sections.catalog.source, "live");
      assert.ok(partial.evidenceGaps.some((gap) => gap.section === "plan"));
      await assert.rejects(dispatch("database_engineer_brief", { ...args, analyze: true }), /cannot authorize/);
      const denied = await dispatch("native_query_plan", { ...args, sql: "DROP TABLE customer" });
      assert.equal(denied.blocked, true);
      await assert.rejects(dispatch("native_query_plan", { ...args, sql: "SELECT * FROM customer", analyze: true }));
      const chained = await dispatch("native_query_plan", { ...args, sql: "SELECT * FROM customer; DELETE FROM customer" });
      assert.equal(chained.blocked, true);
      const security = await dispatch("database_security_findings", args);
      assert.equal(security.result.status, "unsupported");
      const diff = await dispatch("compare_live_schemas", { before: args, after: args });
      assert.equal(diff.source, "live");
      assert.deepEqual(diff.changes, []);
      assert.ok(diff.unchangedCount > 0);
      assert.equal(diff.executionAuthorized, false);
      await assert.rejects(dispatch("discover_database", { ...args, database: path.join(directory, "other.sqlite") }));
      assert.equal(fs.existsSync(path.join(directory, "other.sqlite")), false);
    });
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});

test("inspection rejects unsupported engines, absent scopes, and profile mismatches", async () => {
  await assert.rejects(dispatch("discover_database", { engine: "oracle", database: "prod" }), /supported engine/);
  await assert.rejects(dispatch("database_capabilities", { engine: "postgres" }), /database required/);
  await withEnv({ CODEXDB_SQLITE_ENGINE: "postgres" }, async () => {
    await assert.rejects(dispatch("discover_database", { engine: "sqlite", database: "missing" }), /engine mismatch/);
  });
});

test("live PostgreSQL explain does not fabricate index findings or costs", async () => {
  const adapter = new PostgresAdapter({});
  adapter.driver = {};
  adapter.pool = { connect: async () => ({
    query: async () => ({ rows: [{ "QUERY PLAN": [{ Plan: {
      "Node Type": "Result", "Total Cost": 0.01,
    } }] }] }),
    release() {},
  }) };
  const result = await adapter.explainQuery({ sql: "SELECT 1" });
  assert.equal(result.source, "live");
  assert.equal(result.estimatedCost, 0.01);
  assert.deepEqual(result.bottlenecks, []);
  assert.deepEqual(result.rewriteHints, []);
});

test("secret provider preserves live-connection enforcement and timeout", async () => {
  await withEnv({
    CODEXDB_AUTH_SECRET_PROVIDER: "env_json",
    CODEXDB_REQUIRE_LIVE_CONNECTION: "true",
    CODEXDB_LIVE_CONNECTION_TIMEOUT_MS: "1234",
  }, () => {
    const policy = getPolicy();
    assert.equal(policy.auth.requireLiveConnection, true);
    assert.equal(policy.auth.liveConnectionTimeoutMs, 1234);
    assert.equal(policy.auth.provider, "env_json");
  });
});

function withEnv(overrides, fn) {
  const previous = {};
  for (const key of Object.keys(overrides)) {
    previous[key] = process.env[key];
    if (overrides[key] === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = overrides[key];
    }
  }
  return Promise.resolve()
    .then(fn)
    .finally(() => {
      for (const [key, value] of Object.entries(previous)) {
        if (value === undefined) {
          delete process.env[key];
        } else {
          process.env[key] = value;
        }
      }
    });
}

test("production_readiness_check reports blocking production gaps", async () => {
  await withEnv({
    CODEXDB_REQUIRE_LIVE_CONNECTION: undefined,
    CODEXDB_MIGRATION_SIGNING_KEY: undefined,
  }, async () => {
    const result = await dispatch("production_readiness_check", {
      environment: "production",
      engine: "postgres",
    });

    assert.equal(result.ready, false);
    assert.ok(result.blockingIssues.includes("live_connection_not_enforced"));
    assert.ok(result.blockingIssues.includes("migration_signing_secret_missing"));
    assert.ok(result.checks.some((check) => check.id === "manifest_tools"));
  });
});

test("live-required mode blocks silent mock fallback", async () => {
  await withEnv({
    CODEXDB_REQUIRE_LIVE_CONNECTION: "true",
    CODEXDB_POSTGRES_CONNECTION_STRING: undefined,
    CODEXDB_CONNECTION_STRING: undefined,
  }, async () => {
    const result = await dispatch("list_databases", {
      engine: "postgres",
    });

    assert.equal(result.blocked, true);
    assert.equal(result.status, "live_connection_required");
    assert.equal(result.source, "connection");
    assert.equal(result.profile.engine, "postgres");
    assert.ok(result.blockedReason.includes("live_connection_required"));
  });
});

test("production readiness fails when live connection is required but unavailable", async () => {
  await withEnv({
    CODEXDB_REQUIRE_LIVE_CONNECTION: "true",
    CODEXDB_MIGRATION_SIGNING_KEY: "test-secret",
    CODEXDB_POSTGRES_CONNECTION_STRING: undefined,
    CODEXDB_CONNECTION_STRING: undefined,
  }, async () => {
    const result = await dispatch("production_readiness_check", {
      environment: "production",
      engine: "postgres",
    });

    assert.equal(result.ready, false);
    assert.ok(result.blockingIssues.includes("live_connection_unavailable"));
    assert.ok(result.checks.some((check) => check.id === "live_connection_probe" && check.status === "fail"));
  });
});

test("postgres adapter blocks unsafe multi-statement sql before execution", async () => {
  const adapter = new PostgresAdapter({ sampleCatalog: {} }, { type: "mock", engine: "postgres" });
  const result = await adapter.executeSql("SELECT 1; DROP TABLE users", {
    tool: "simulate_query",
  });

  assert.equal(result.executed, false);
  assert.equal(result.error, "unsafe_sql");
  assert.ok(result.violations.includes("multiple_statements"));
  assert.ok(result.violations.includes("dangerous_keyword"));
});

test("sql server adapter blocks unsafe sql before execution", async () => {
  const adapter = new SqlServerAdapter({ sampleCatalog: {} }, { type: "mock", engine: "sqlserver" });
  const result = await adapter.executeSql("EXEC xp_cmdshell 'whoami'", {
    tool: "simulate_query",
  });

  assert.equal(result.executed, false);
  assert.equal(result.error, "unsafe_sql");
  assert.ok(result.violations.includes("dangerous_keyword"));
});

test("sql safety blocks write-like read statements", async () => {
  const sqlServer = new SqlServerAdapter({ sampleCatalog: {} }, { type: "mock", engine: "sqlserver" });
  const postgres = new PostgresAdapter({ sampleCatalog: {} }, { type: "mock", engine: "postgres" });

  const selectInto = await sqlServer.executeSql("SELECT * INTO backup_users FROM users", {
    tool: "simulate_query",
  });
  const volatileFunction = await postgres.executeSql("SELECT nextval('order_seq')", {
    tool: "simulate_query",
  });

  assert.equal(selectInto.executed, false);
  assert.equal(selectInto.error, "unsafe_sql");
  assert.ok(selectInto.violations.includes("write_like_read"));
  assert.equal(volatileFunction.executed, false);
  assert.equal(volatileFunction.error, "unsafe_sql");
  assert.ok(volatileFunction.violations.includes("dangerous_function"));
});

test("sql server sample catalog uses dbo schema by default", async () => {
  const result = await dispatch("describe_table", {
    engine: "sqlserver",
    database: "app_prod",
    table: "users",
  });

  assert.equal(result.schema, "dbo");
  assert.equal(result.table, "users");
  assert.ok(Array.isArray(result.columns));
  assert.ok(result.riskNotes.includes("Contains PII-like columns"));
});

test("postgres query stats reads pg_stat_statements when live", async () => {
  const queries = [];
  const adapter = new PostgresAdapter({ sampleCatalog: {} }, { type: "configured", engine: "postgres" });
  adapter.driver = {};
  adapter.pool = {
    async connect() {
      return {
        async query(sql) {
          queries.push(sql);
          return {
            rows: [
              {
                queryid: "42",
                mean_exec_time: 12.8,
                calls: 4,
                total_exec_time: 80,
                rows: 20,
                shared_blks_read: 3,
              },
            ],
          };
        },
        release() {},
      };
    },
  };

  const result = await adapter.queryStats();

  assert.match(queries[0], /pg_stat_statements/);
  assert.equal(result[0].queryId, "42");
  assert.equal(result[0].avgMs, 12.8);
  assert.equal(result[0].executionCount, 4);
  assert.equal(result[0].ioWait, "unknown");
  assert.equal(result[0].p95Ms, null);
  assert.equal(result[0].cpuMs, null);
  assert.equal(result[0].sharedBlocksRead, 3);
});

test("postgres query stats reports unavailable extension explicitly", async () => {
  const adapter = new PostgresAdapter({ sampleCatalog: {} }, { type: "configured", engine: "postgres" });
  adapter.driver = {};
  adapter.pool = {
    async connect() {
      return {
        async query() {
          throw new Error("relation pg_stat_statements does not exist");
        },
        release() {},
      };
    },
  };

  const result = await adapter.queryStats();

  assert.equal(result.error, "pg_stat_statements_unavailable");
  assert.equal(result.source, "live_error");
  assert.equal(result.queryStats.length, 0);
});

test("query stats does not replace live empty stats with sample data", async () => {
  const adapter = new PostgresAdapter({ sampleCatalog: {} }, { type: "configured", engine: "postgres" });
  adapter.driver = {};
  adapter.pool = {
    async connect() {
      return {
        async query() {
          return { rows: [] };
        },
        release() {},
      };
    },
  };

  const result = await adapter.queryStats();

  assert.deepEqual(result, []);
});

test("production live-required mode blocks mock-only runtime tools", async () => {
  await withEnv({
    CODEXDB_REQUIRE_LIVE_CONNECTION: "true",
    CODEXDB_MIGRATION_SIGNING_KEY: "test-secret",
  }, async () => {
    const result = await dispatch("query_time_machine", {
      environment: "production",
      engine: "postgres",
      database: "analytics",
      schema: "public",
      queryId: "q-1122",
    });

    assert.equal(result.blocked, true);
    assert.equal(result.status, "mock_runtime_blocked");
    assert.ok(result.blockedReason.includes("mock_runtime_not_allowed_in_production"));
  });
});

test("production live-required workload analysis requires live database connection", async () => {
  await withEnv({
    CODEXDB_REQUIRE_LIVE_CONNECTION: "true",
    CODEXDB_MIGRATION_SIGNING_KEY: "test-secret",
    CODEXDB_POSTGRES_CONNECTION_STRING: undefined,
    CODEXDB_CONNECTION_STRING: undefined,
  }, async () => {
    const result = await dispatch("analyze_workload", {
      environment: "production",
      engine: "postgres",
      database: "analytics",
      schema: "public",
    });

    assert.equal(result.blocked, true);
    assert.equal(result.status, "live_connection_required");
    assert.ok(result.blockedReason.includes("live_connection_required"));
  });
});

test("postgres explain defaults to non-executing explain", async () => {
  const queries = [];
  const adapter = new PostgresAdapter({ sampleCatalog: {} }, { type: "configured", engine: "postgres" });
  adapter.driver = {};
  adapter.pool = {
    async connect() {
      return {
        async query(sql) {
          queries.push(sql);
          return { rows: [{ "QUERY PLAN": [{ Plan: { "Node Type": "Seq Scan" } }] }] };
        },
        release() {},
      };
    },
  };

  const result = await adapter.explainQuery({ sql: "SELECT * FROM users" });

  assert.match(queries[0], /^EXPLAIN \(BUFFERS, FORMAT JSON\)/);
  assert.doesNotMatch(queries[0], /ANALYZE/);
  assert.equal(result.source, "live");
});

test("sql server explain requests showplan xml instead of returning placeholder", async () => {
  const queries = [];
  const adapter = new SqlServerAdapter({ sampleCatalog: {} }, { type: "configured", engine: "sqlserver" });
  let transaction;
  adapter.driver = {
    Transaction: class { constructor() { transaction = this; } async begin() {} async rollback() {} },
    Request: class {
        constructor(parent) { assert.equal(parent, transaction); }
        async batch(sql) {
          queries.push(sql);
          return sql.includes("SELECT")
            ? { recordset: [{ "Microsoft SQL Server 2005 XML Showplan": "<ShowPlanXML />" }] }
            : { recordset: [] };
        }
    },
  };
  adapter.connection = { request() { throw new Error("Must not acquire an unrelated session"); } };

  const result = await adapter.explainQuery({ sql: "SELECT * FROM dbo.users" });

  assert.deepEqual(queries, ["SET SHOWPLAN_XML ON", "SELECT * FROM dbo.users", "SET SHOWPLAN_XML OFF"]);
  assert.equal(result.plan, "<ShowPlanXML />");
  assert.equal(result.source, "live");
});

test("postgres adapter reads live lock analysis and index usage", async () => {
  const queries = [];
  const adapter = new PostgresAdapter({ sampleCatalog: {} }, { type: "configured", engine: "postgres" });
  adapter.driver = {};
  adapter.pool = {
    async connect() {
      return {
        async query(sql) {
          queries.push(sql);
          if (sql.includes("pg_locks")) {
            return {
              rows: [
                { pid: 11, wait_event_type: "Lock", wait_event: "transactionid", state: "active", duration_ms: 2500, relation_name: "orders" },
              ],
            };
          }
          return {
            rows: [
              { indexrelname: "orders_user_idx", idx_scan: 42, idx_tup_read: 1000, idx_tup_fetch: 900, relname: "orders", index_size_bytes: 8192 },
            ],
          };
        },
        release() {},
      };
    },
  };

  const locks = await adapter.lockAnalysis();
  const indexes = await adapter.indexUsage({ table: "orders" });

  assert.match(queries[0], /pg_locks/);
  assert.equal(locks.source, "live");
  assert.equal(locks.deadlockRisk, "medium");
  assert.equal(locks.topWaiters[0].session, "11");
  assert.match(queries[1], /pg_stat_user_indexes/);
  assert.equal(indexes.source, "live");
  assert.equal(indexes.indexes[0].index, "orders_user_idx");
  assert.equal(indexes.indexes[0].usageScore, 42);
});

test("sql server adapter reads live lock analysis and index usage", async () => {
  const queries = [];
  const adapter = new SqlServerAdapter({ sampleCatalog: {} }, { type: "configured", engine: "sqlserver" });
  adapter.driver = { VarChar: "VarChar" };
  adapter.connection = {
    request() {
      const inputs = {};
      return {
        input(name, _type, value) {
          inputs[name] = value;
          return this;
        },
        async query(sql) {
          queries.push({ sql, inputs });
          if (sql.includes("dm_os_waiting_tasks")) {
            return {
              recordset: [
                { session_id: 55, wait_type: "LCK_M_X", wait_duration_ms: 1200, blocking_session_id: 77, resource_description: "OBJECT: 5" },
              ],
            };
          }
          return {
            recordset: [
              { table_name: "orders", index_name: "ix_orders_user", user_seeks: 7, user_scans: 1, user_lookups: 0, user_updates: 3 },
            ],
          };
        },
      };
    },
  };

  const locks = await adapter.lockAnalysis();
  const indexes = await adapter.indexUsage({ table: "orders" });

  assert.match(queries[0].sql, /dm_os_waiting_tasks/);
  assert.equal(locks.source, "live");
  assert.equal(locks.topWaiters[0].session, "55");
  assert.match(queries[1].sql, /dm_db_index_usage_stats/);
  assert.equal(indexes.source, "live");
  assert.equal(indexes.indexes[0].index, "ix_orders_user");
  assert.equal(indexes.indexes[0].usageScore, 8);
});
