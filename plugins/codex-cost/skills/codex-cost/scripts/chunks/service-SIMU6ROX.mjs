import {
  getHistoricalComparison
} from "./chunk-VNKX2X2V.mjs";

// src/db/cache.ts
import { createHash } from "node:crypto";
import { chmodSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
var CACHE_VERSION = 3;
var UsageCache = class {
  db;
  constructor(directory = process.env.CODEX_COST_CACHE_DIR || join(homedir(), ".cache", "codex-cost")) {
    mkdirSync(directory, { recursive: true, mode: 448 });
    const path = join(directory, "usage.sqlite");
    this.db = new DatabaseSync(path);
    chmodSync(path, 384);
    this.db.exec("PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000; CREATE TABLE IF NOT EXISTS files (key TEXT PRIMARY KEY, size INTEGER NOT NULL, mtime REAL NOT NULL, version INTEGER NOT NULL, aggregate TEXT NOT NULL)");
  }
  key(path) {
    return createHash("sha256").update(path).digest("hex");
  }
  get(file) {
    const row = this.db.prepare("SELECT aggregate FROM files WHERE key = ? AND size = ? AND mtime = ? AND version = ?").get(this.key(file.path), file.size, file.mtimeMs, CACHE_VERSION);
    if (!row) return null;
    try {
      const data = JSON.parse(row.aggregate);
      return data?.session && Array.isArray(data.entries) && Array.isArray(data.fingerprints) ? data : null;
    } catch {
      return null;
    }
  }
  put(file, aggregate) {
    this.db.prepare("INSERT OR REPLACE INTO files (key,size,mtime,version,aggregate) VALUES (?,?,?,?,?)").run(this.key(file.path), file.size, file.mtimeMs, CACHE_VERSION, JSON.stringify(aggregate));
  }
  close() {
    this.db.close();
  }
};

// src/codex/discovery.ts
import { readdir, stat } from "node:fs/promises";
import { homedir as homedir2 } from "node:os";
import { basename, dirname, join as join2, resolve } from "node:path";
var defaultDataDirectory = () => process.env.CODEX_HOME || join2(homedir2(), ".codex");
function resolveDataDirectory(value) {
  const directory = value || defaultDataDirectory();
  return resolve(directory === "~" ? homedir2() : directory.startsWith("~/") ? join2(homedir2(), directory.slice(2)) : directory);
}
async function discoverSessionFiles(dataDir) {
  const root = resolveDataDirectory(dataDir);
  const files = [];
  let missing = false;
  async function walk(directory) {
    let entries;
    try {
      entries = await readdir(directory, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const path = join2(directory, entry.name);
      if (entry.isDirectory()) await walk(path);
      else if (entry.isFile() && entry.name.endsWith(".jsonl")) {
        try {
          const info = await stat(path);
          files.push({ path, size: info.size, mtimeMs: info.mtimeMs });
        } catch {
        }
      }
    }
  }
  try {
    missing = !(await stat(root)).isDirectory();
  } catch {
    missing = true;
  }
  if (!missing) {
    const entries = await readdir(root, { withFileTypes: true });
    const normalRoots = entries.filter((entry) => entry.isDirectory() && ["sessions", "archived_sessions"].includes(entry.name));
    if (normalRoots.length) for (const entry of normalRoots) await walk(join2(root, entry.name));
    else await walk(root);
  }
  return { files: files.sort((a, b) => a.path.localeCompare(b.path)), missing };
}
var projectNames = /* @__PURE__ */ new Map();
async function projectName(cwd) {
  if (typeof cwd !== "string" || !cwd.trim()) return "Unknown project";
  const directory = resolve(cwd);
  let cached = projectNames.get(directory);
  if (!cached) {
    cached = (async () => {
      let current = directory;
      while (true) {
        try {
          await stat(join2(current, ".git"));
          return basename(current) || "Unknown project";
        } catch {
        }
        const parent = dirname(current);
        if (parent === current) break;
        current = parent;
      }
      return basename(directory) || "Unknown project";
    })();
    projectNames.set(directory, cached);
  }
  return cached;
}

// src/codex/parser.ts
import { createHash as createHash2 } from "node:crypto";
import { createReadStream } from "node:fs";
import { stat as stat2 } from "node:fs/promises";
import { basename as basename2 } from "node:path";

// src/codex/schema.ts
var emptyTokens = () => ({ inputTokens: 0, cachedInputTokens: 0, cacheWriteInputTokens: 0, outputTokens: 0, totalTokens: 0 });
var emptyWarnings = () => ({ malformedLines: 0, oversizedLines: 0, invalidTokenRecords: 0, counterResets: 0, unknownModelEvents: 0, inheritedEventsSkipped: 0, duplicateEventsSkipped: 0, unknownContextEvents: 0, unresolvedForkHistory: 0 });

// src/codex/parser.ts
var MAX_LINE_BYTES = 2 * 1024 * 1024;
var KEYS = ["inputTokens", "cachedInputTokens", "cacheWriteInputTokens", "outputTokens", "totalTokens"];
var zeroRaw = () => ({ input: 0, cached: 0, writes: 0, output: 0 });
var sumRaw = (a, b) => ({ input: a.input + b.input, cached: a.cached + b.cached, writes: a.writes + b.writes, output: a.output + b.output });
var subtract = (a, b) => ({ input: Math.max(0, a.input - b.input), cached: Math.max(0, a.cached - b.cached), writes: Math.max(0, a.writes - b.writes), output: Math.max(0, a.output - b.output) });
var equal = (a, b) => a.input === b.input && a.cached === b.cached && a.writes === b.writes && a.output === b.output;
var hasReset = (a, b) => a.input < b.input || a.output < b.output;
var hash = (value) => createHash2("sha256").update(value).digest("hex").slice(0, 32);
var fingerprint = (usage) => hash(`${usage.input}:${usage.cached}:${usage.writes}:${usage.output}`);
var object = (value) => value !== null && typeof value === "object" && !Array.isArray(value) ? value : null;
var text = (value) => typeof value === "string" && value.length <= 512 ? value : null;
function timestamp(value) {
  if (typeof value !== "string" || value.length > 64) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}
function rawTokens(value) {
  const v = object(value);
  if (!v) return null;
  const valid = (n) => typeof n === "number" && Number.isSafeInteger(n) && n >= 0;
  if (!valid(v.input_tokens) || !valid(v.output_tokens)) return null;
  if (v.cached_input_tokens !== void 0 && !valid(v.cached_input_tokens)) return null;
  if (v.cache_write_input_tokens !== void 0 && !valid(v.cache_write_input_tokens)) return null;
  return { input: v.input_tokens, cached: v.cached_input_tokens ?? 0, writes: v.cache_write_input_tokens ?? 0, output: v.output_tokens };
}
var UnsupportedSessionError = class extends Error {
  constructor() {
    super("No supported Codex session metadata or usage records found.");
    this.name = "UnsupportedSessionError";
  }
};
async function* metadataLines(path, size, maxLineBytes) {
  if (size <= 0) return;
  const stream = createReadStream(path, { highWaterMark: 64 * 1024, end: size - 1 });
  let pieces = [];
  let length = 0;
  let discard = false;
  let oversized = false;
  const reset = () => {
    pieces = [];
    length = 0;
    discard = false;
    oversized = false;
  };
  for await (const chunk of stream) {
    const buffer = chunk;
    let offset = 0;
    while (offset < buffer.length) {
      const newline = buffer.indexOf(10, offset);
      const end = newline < 0 ? buffer.length : newline;
      if (!discard) {
        const part = buffer.subarray(offset, end);
        const prefixPieces = [...pieces, part.subarray(0, 512)];
        const quickPrefix = Buffer.concat(prefixPieces, Math.min(length + Math.min(part.length, 512), 512)).toString("utf8");
        const quickType = quickPrefix.match(/^\s*\{\s*(?:"timestamp"\s*:\s*"[^"\n]*"\s*,\s*)?"type"\s*:\s*"([^"\n]+)"/)?.[1];
        const quickSubtype = quickType === "event_msg" ? quickPrefix.match(/"payload"\s*:\s*\{\s*"type"\s*:\s*"([^"\n]+)"/)?.[1] : null;
        if (quickType && !["session_meta", "turn_context", "event_msg", "token_usage_record"].includes(quickType) || quickSubtype && quickSubtype !== "token_count") {
          discard = true;
          pieces = [];
        } else if (length + part.length > maxLineBytes) {
          oversized = true;
          discard = true;
          pieces = [];
        } else {
          pieces.push(part);
          length += part.length;
          if (length >= 200 || newline >= 0) {
            const prefix = pieces.length === 1 ? pieces[0].subarray(0, 512).toString("utf8") : Buffer.concat(pieces, Math.min(length, 512)).toString("utf8");
            const type = prefix.match(/^\s*\{\s*(?:"timestamp"\s*:\s*"[^"\n]*"\s*,\s*)?"type"\s*:\s*"([^"\n]+)"/)?.[1];
            if (type && !["session_meta", "turn_context", "event_msg", "token_usage_record"].includes(type)) {
              discard = true;
              pieces = [];
            } else if (type === "event_msg") {
              const subtype = prefix.match(/"payload"\s*:\s*\{\s*"type"\s*:\s*"([^"\n]+)"/)?.[1];
              if (subtype && subtype !== "token_count") {
                discard = true;
                pieces = [];
              }
            }
          }
        }
      }
      if (newline >= 0) {
        yield discard ? { oversized } : { line: Buffer.concat(pieces, length).toString("utf8") };
        reset();
        offset = newline + 1;
      } else offset = buffer.length;
    }
  }
  if (length || discard) yield discard ? { oversized } : { line: Buffer.concat(pieces, length).toString("utf8"), partial: true };
}
function sessionFromEntries(base, entries) {
  const buckets = /* @__PURE__ */ new Map();
  const totals = emptyTokens();
  let endedAt = null;
  for (const entry of entries) {
    const value = entry.bucket;
    const key = `${value.date}\0${value.model}\0${value.longContext}`;
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = { date: value.date, model: value.model, longContext: value.longContext, ...emptyTokens() };
      buckets.set(key, bucket);
    }
    for (const field of KEYS) {
      bucket[field] += value[field];
      totals[field] += value[field];
    }
    if (entry.timestamp && (!endedAt || entry.timestamp > endedAt)) endedAt = entry.timestamp;
  }
  return { ...base, ...totals, buckets: [...buckets.values()].sort((a, b) => a.date.localeCompare(b.date) || a.model.localeCompare(b.model)), endedAt: endedAt || base.startedAt };
}
async function parseSessionFile(path, options = {}) {
  const size = options.size ?? (await stat2(path)).size;
  const warnings = emptyWarnings();
  let id = basename2(path).match(/([0-9a-f]{8}-[0-9a-f-]{27,})\.jsonl$/i)?.[1] || `local-${hash(path)}`;
  let startedAt = null;
  let forkedFromId = null;
  let cwd;
  let metadataSeen = false;
  let recognized = false;
  let modernSeen = false;
  let model = "unknown";
  let previous = zeroRaw();
  const turnModels = /* @__PURE__ */ new Map();
  const responseIds = /* @__PURE__ */ new Set();
  const seen = /* @__PURE__ */ new Set();
  const entries = [];
  const fingerprints = [];
  const allFingerprints = /* @__PURE__ */ new Set();
  const counters = { lines: 0, tokenEvents: 0, requestEvents: 0 };
  function remember(usage, at = null) {
    const key = fingerprint(usage);
    seen.add(key);
    if (!allFingerprints.has(key)) {
      allFingerprints.add(key);
      fingerprints.push({ signature: key, timestamp: at });
    }
    return key;
  }
  function record(usage, at, selectedModel, longContext2, signature, request) {
    if (!usage.input && !usage.output) return;
    const cached = Math.min(usage.cached, usage.input);
    const writes = Math.min(usage.writes, usage.input - cached);
    if (cached !== usage.cached || writes !== usage.writes) warnings.invalidTokenRecords++;
    if (selectedModel === "unknown") warnings.unknownModelEvents++;
    if (longContext2 === null) warnings.unknownContextEvents++;
    const date = (at || startedAt)?.slice(0, 10) || "1970-01-01";
    entries.push({ signature, timestamp: at, request, bucket: { date, model: selectedModel, longContext: longContext2, inputTokens: usage.input - cached, cachedInputTokens: cached, cacheWriteInputTokens: writes, outputTokens: usage.output, totalTokens: usage.input + usage.output } });
  }
  for await (const result of metadataLines(path, size, options.maxLineBytes ?? MAX_LINE_BYTES)) {
    counters.lines++;
    if (result.oversized) warnings.oversizedLines++;
    if (!result.line?.trim()) continue;
    let recordObject;
    try {
      recordObject = object(JSON.parse(result.line));
    } catch {
      if (!result.partial) warnings.malformedLines++;
      continue;
    }
    if (!recordObject) {
      warnings.malformedLines++;
      continue;
    }
    const payload = object(recordObject.payload);
    if (!payload) continue;
    const at = timestamp(recordObject.timestamp);
    if (recordObject.type === "session_meta") {
      recognized = true;
      if (!metadataSeen) {
        id = text(payload.id) || text(payload.session_id) || id;
        startedAt = timestamp(payload.timestamp) || at;
        forkedFromId = text(payload.forked_from_id);
        cwd = payload.cwd;
        metadataSeen = true;
      }
      continue;
    }
    if (recordObject.type === "turn_context") {
      recognized = true;
      model = text(payload.model) || "unknown";
      const turn = text(payload.turn_id);
      if (turn) turnModels.set(turn, model);
      if (!cwd && typeof payload.cwd === "string") cwd = payload.cwd;
      continue;
    }
    if (recordObject.type === "token_usage_record") {
      const owner = text(payload.thread_id);
      if (owner && owner !== id) {
        warnings.inheritedEventsSkipped++;
        continue;
      }
      const usage = rawTokens(payload.usage);
      if (!usage) {
        warnings.invalidTokenRecords++;
        continue;
      }
      recognized = true;
      const response = text(payload.response_id);
      if (response && responseIds.has(response)) {
        warnings.duplicateEventsSkipped++;
        continue;
      }
      if (response) responseIds.add(response);
      counters.requestEvents++;
      counters.tokenEvents++;
      const selectedModel = turnModels.get(text(payload.turn_id) || "") || model;
      const cumulative2 = rawTokens(payload.thread_token_usage);
      if (modernSeen) {
        if (cumulative2 && hasReset(cumulative2, previous)) warnings.counterResets++;
        previous = cumulative2 || sumRaw(previous, usage);
        record(usage, at, selectedModel, usage.input > 272e3, remember(previous, at), true);
        continue;
      }
      modernSeen = true;
      if (cumulative2) {
        if (cumulative2.input === previous.input && cumulative2.output === previous.output) {
          const previousSignature = fingerprint(previous);
          const index = entries.findLastIndex((entry) => !entry.request && entry.signature === previousSignature);
          const covered = index >= 0 ? entries[index] : null;
          if (covered && usage.input <= covered.bucket.inputTokens + covered.bucket.cachedInputTokens && usage.output <= covered.bucket.outputTokens) {
            entries.splice(index, 1);
            const rawCovered = { input: covered.bucket.inputTokens + covered.bucket.cachedInputTokens, cached: covered.bucket.cachedInputTokens, writes: covered.bucket.cacheWriteInputTokens, output: covered.bucket.outputTokens };
            const remainder = subtract(rawCovered, usage);
            record(remainder, covered.timestamp, covered.bucket.model, null, fingerprint(subtract(cumulative2, usage)), false);
            record(usage, at, selectedModel, usage.input > 272e3, remember(cumulative2, at), true);
          } else if (response) {
            warnings.counterResets++;
            record(usage, at, selectedModel, usage.input > 272e3, remember(cumulative2, at), true);
          } else warnings.duplicateEventsSkipped++;
          previous = cumulative2;
          continue;
        }
        const before = subtract(cumulative2, usage);
        if (hasReset(cumulative2, previous)) {
          warnings.counterResets++;
          previous = zeroRaw();
        }
        const gap = subtract(before, previous);
        record(gap, at, selectedModel, null, fingerprint(before), false);
        const signature2 = remember(cumulative2, at);
        if (equal(cumulative2, previous)) warnings.duplicateEventsSkipped++;
        else record(usage, at, selectedModel, usage.input > 272e3, signature2, true);
        previous = cumulative2;
      } else {
        previous = sumRaw(previous, usage);
        record(usage, at, selectedModel, usage.input > 272e3, remember(previous, at), true);
      }
      continue;
    }
    if (recordObject.type !== "event_msg" || payload.type !== "token_count") continue;
    const info = object(payload.info);
    if (!info) continue;
    const cumulative = rawTokens(info.total_token_usage);
    if (!cumulative) {
      warnings.invalidTokenRecords++;
      continue;
    }
    recognized = true;
    counters.tokenEvents++;
    const signature = fingerprint(cumulative);
    if (modernSeen) {
      remember(cumulative, at);
      warnings.duplicateEventsSkipped++;
      continue;
    }
    if (cumulative.input === 0 && cumulative.output === 0 && (previous.input > 0 || previous.output > 0)) {
      warnings.counterResets++;
      seen.clear();
      previous = zeroRaw();
      remember(cumulative, at);
      continue;
    }
    if (seen.has(signature)) {
      warnings.duplicateEventsSkipped++;
      continue;
    }
    remember(cumulative, at);
    if (hasReset(cumulative, previous)) {
      warnings.counterResets++;
      previous = zeroRaw();
    }
    const delta = subtract(cumulative, previous);
    const last = rawTokens(info.last_token_usage);
    const longContext2 = last && equal(last, delta) ? last.input > 272e3 : null;
    record(delta, at, model, longContext2, signature, false);
    previous = cumulative;
  }
  if (!recognized) throw new UnsupportedSessionError();
  const base = { id, startedAt, endedAt: startedAt, project: await projectName(cwd), forkedFromId, buckets: [], warnings, counters, ...emptyTokens() };
  return { session: sessionFromEntries(base, entries), entries, fingerprints };
}

// src/codex/indexer.ts
function deduplicateSessions(files) {
  const byId = /* @__PURE__ */ new Map();
  let duplicateFiles = 0;
  for (const parsed of files) {
    const previous = byId.get(parsed.session.id);
    if (previous) {
      duplicateFiles++;
      if (previous.session.totalTokens > parsed.session.totalTokens || previous.session.totalTokens === parsed.session.totalTokens && previous.entries.length >= parsed.entries.length) continue;
    }
    byId.set(parsed.session.id, parsed);
  }
  const sessions = [];
  for (const parsed of byId.values()) {
    const ancestors = /* @__PURE__ */ new Set();
    const visited = /* @__PURE__ */ new Set([parsed.session.id]);
    let parentId = parsed.session.forkedFromId;
    while (parentId && !visited.has(parentId)) {
      visited.add(parentId);
      const parent = byId.get(parentId);
      if (!parent) break;
      for (const entry of parent.fingerprints) {
        if (parsed.session.startedAt && entry.timestamp && entry.timestamp <= parsed.session.startedAt) ancestors.add(entry.signature);
      }
      parentId = parent.session.forkedFromId;
    }
    let cutoff = -1;
    for (let i = 0; i < parsed.entries.length; i++) {
      const entry = parsed.entries[i];
      if (entry.request) break;
      if (ancestors.has(entry.signature)) cutoff = i;
      else if (cutoff >= 0) break;
    }
    const entries = cutoff < 0 ? parsed.entries : parsed.entries.filter((entry, index) => entry.request || index > cutoff);
    const session = sessionFromEntries(parsed.session, entries);
    session.warnings = { ...session.warnings, inheritedEventsSkipped: session.warnings.inheritedEventsSkipped + parsed.entries.length - entries.length };
    if (parsed.session.forkedFromId && ancestors.size === 0 && parsed.entries.some((entry) => !entry.request)) session.warnings.unresolvedForkHistory++;
    sessions.push(session);
  }
  return { sessions: sessions.sort((a, b) => (a.startedAt || "").localeCompare(b.startedAt || "") || a.id.localeCompare(b.id)), duplicateFiles };
}
async function indexCodex(options = {}) {
  const started = performance.now();
  const discovered = await discoverSessionFiles(options.dataDir);
  const diagnostics = { discoveredFiles: discovered.files.length, parsedFiles: 0, cachedFiles: 0, failedFiles: 0, duplicateFiles: 0, totalBytes: discovered.files.reduce((sum, file) => sum + file.size, 0), elapsedMs: 0, missingDataDirectory: discovered.missing, warnings: emptyWarnings() };
  if (!discovered.files.length) return { sessions: [], diagnostics: { ...diagnostics, elapsedMs: Math.round(performance.now() - started) } };
  let cache = null;
  const cacheError = () => {
    diagnostics.cacheErrors = (diagnostics.cacheErrors || 0) + 1;
  };
  try {
    cache = new UsageCache(options.cacheDir);
  } catch {
    cacheError();
  }
  const parsed = [];
  try {
    for (const file of discovered.files) {
      try {
        let result2 = null;
        if (!options.rescan && cache) {
          try {
            result2 = cache.get(file);
          } catch {
            cacheError();
          }
        }
        if (result2) diagnostics.cachedFiles++;
        else {
          result2 = await parseSessionFile(file.path, { size: file.size });
          diagnostics.parsedFiles++;
          if (cache) {
            try {
              cache.put(file, result2);
            } catch {
              cacheError();
            }
          }
        }
        parsed.push(result2);
      } catch {
        diagnostics.failedFiles++;
      }
    }
  } finally {
    try {
      cache?.close();
    } catch {
      cacheError();
    }
  }
  const result = deduplicateSessions(parsed);
  diagnostics.duplicateFiles = result.duplicateFiles;
  for (const session of result.sessions) for (const key of Object.keys(diagnostics.warnings)) diagnostics.warnings[key] += session.warnings[key];
  diagnostics.elapsedMs = Math.round(performance.now() - started);
  return { sessions: result.sessions, diagnostics };
}

// src/codex/aggregate.ts
import { createHash as createHash3 } from "node:crypto";

// src/pricing/models.ts
var PRICING_CHECKED_AT = "2026-09-08";
var PRICING_SOURCE_URL = "https://developers.openai.com/api/docs/pricing";
var LONG_CONTEXT_THRESHOLD = 272e3;
function pricing(model, inputPerMillion, cachedInputPerMillion, outputPerMillion, extras = {}) {
  return Object.freeze({
    model,
    inputPerMillion,
    cachedInputPerMillion,
    outputPerMillion,
    source: PRICING_SOURCE_URL,
    checkedAt: PRICING_CHECKED_AT,
    ...extras
  });
}
var longContext = (inputPerMillion, cachedInputPerMillion, outputPerMillion, cacheWritePerMillion) => Object.freeze({
  thresholdInputTokens: LONG_CONTEXT_THRESHOLD,
  inputPerMillion,
  cachedInputPerMillion,
  outputPerMillion,
  ...cacheWritePerMillion === void 0 ? {} : { cacheWritePerMillion }
});
var MODEL_PRICING = Object.freeze([
  pricing("gpt-6-astra", 10, 1, 50, {
    cacheWritePerMillion: 12.5,
    longContext: longContext(20, 2, 75, 25)
  }),
  pricing("gpt-5.6-sol", 4, 0.4, 20, {
    cacheWritePerMillion: 5,
    longContext: longContext(8, 0.8, 30, 10),
    note: "Promotional API pricing is available at least through November 21, 2026. Recheck before relying on later estimates."
  }),
  pricing("gpt-5.6-terra", 2, 0.2, 12, {
    cacheWritePerMillion: 2.5,
    longContext: longContext(4, 0.4, 18, 5)
  }),
  pricing("gpt-5.6-luna", 0.2, 0.02, 1.2, {
    cacheWritePerMillion: 0.25,
    longContext: longContext(0.4, 0.04, 1.8, 0.5)
  }),
  pricing("gpt-5.5", 5, 0.5, 30, {
    longContext: longContext(10, 1, 45)
  }),
  pricing("gpt-5.4", 2.5, 0.25, 15, {
    longContext: longContext(5, 0.5, 22.5)
  }),
  pricing("gpt-5.4-mini", 0.75, 0.075, 4.5),
  pricing("gpt-5.4-nano", 0.2, 0.02, 1.25),
  pricing("gpt-5.3-codex", 1.75, 0.175, 14),
  pricing("gpt-5.2-codex", 1.75, 0.175, 14, {
    source: "https://developers.openai.com/api/docs/models/gpt-5.2-codex"
  }),
  pricing("gpt-5.1-codex", 1.25, 0.125, 10, {
    source: "https://developers.openai.com/api/docs/models/gpt-5.1-codex"
  }),
  pricing("gpt-5.2", 1.75, 0.175, 14),
  pricing("gpt-5.1", 1.25, 0.125, 10),
  pricing("gpt-5", 1.25, 0.125, 10),
  pricing("gpt-5-mini", 0.25, 0.025, 2),
  pricing("gpt-5-nano", 0.05, 5e-3, 0.4)
]);
var pricingByModel = new Map(MODEL_PRICING.map((entry) => [entry.model, entry]));
function getModelPricing(model) {
  return pricingByModel.get(model);
}
var PRICING_ASSUMPTIONS = Object.freeze([
  "This is an API-equivalent token estimate in USD, not your Codex subscription charge or an API invoice.",
  `Published OpenAI Standard API rates checked on ${PRICING_CHECKED_AT} are applied to the whole history; historical prices are not reconstructed.`,
  "Input means uncached input. Cached input is counted once at its separate rate. Reasoning tokens are included in output and are not added again.",
  "When per-request metadata is available, prompts above 272,000 input tokens use the model's published long-context rates and recorded cache writes use the cache-write rate.",
  "Cumulative-only records without request context use short-context rates. Missing cache-write counts cannot be reconstructed; these estimates can understate API cost.",
  "Standard API rates are used regardless of Codex speed settings. Fast mode, Batch/Flex, regional processing, tool fees, media charges, taxes, and negotiated discounts are not estimated.",
  "Unknown model IDs are kept in token totals but excluded from the dollar estimate. No automatic aliases or substitute model prices are used.",
  "GPT-5.6 Sol uses promotional pricing announced to last at least through November 21, 2026."
]);

// src/pricing/calculate.ts
function isTokenCount(value) {
  return Number.isSafeInteger(value) && value >= 0;
}
function atRates(usage, rates, cacheWriteTokens = 0) {
  if (!isTokenCount(usage.inputTokens) || !isTokenCount(usage.cachedInputTokens) || !isTokenCount(usage.outputTokens) || !isTokenCount(cacheWriteTokens) || cacheWriteTokens > usage.inputTokens || cacheWriteTokens > 0 && rates.cacheWritePerMillion === void 0) return null;
  const cost = ((usage.inputTokens - cacheWriteTokens) * rates.inputPerMillion + usage.cachedInputTokens * rates.cachedInputPerMillion + cacheWriteTokens * (rates.cacheWritePerMillion ?? 0) + usage.outputTokens * rates.outputPerMillion) / 1e6;
  return Number.isFinite(cost) ? cost : null;
}
function calculateBucketCost(usage, model, details = {}) {
  const modelPricing = getModelPricing(model);
  if (!modelPricing) return null;
  const hasLongContext = details.longContext === void 0 ? usage.longContext : details.longContext;
  const rates = hasLongContext && modelPricing.longContext ? modelPricing.longContext : modelPricing;
  return atRates(usage, rates, details.cacheWriteTokens ?? usage.cacheWriteInputTokens);
}

// src/codex/aggregate.ts
var emptyTotals = () => ({ inputTokens: 0, cachedInputTokens: 0, outputTokens: 0, totalTokens: 0, estimatedApiCost: 0, unpricedTokens: 0, pricedTokens: 0 });
function priced(bucket) {
  const cost = calculateBucketCost(bucket, bucket.model);
  return { inputTokens: bucket.inputTokens, cachedInputTokens: bucket.cachedInputTokens, outputTokens: bucket.outputTokens, totalTokens: bucket.totalTokens, estimatedApiCost: cost ?? 0, unpricedTokens: cost === null ? bucket.totalTokens : 0, pricedTokens: cost === null ? 0 : bucket.totalTokens };
}
function add(target, value) {
  for (const key of Object.keys(emptyTotals())) target[key] += value[key];
}
function validDate(value, fallback) {
  return value && Number.isFinite(Date.parse(value)) ? value : fallback;
}
function aggregateUsage(index, options = {}) {
  const now = options.now ?? /* @__PURE__ */ new Date();
  const today = now.toISOString().slice(0, 10);
  const cutoff = options.days ? new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - options.days + 1)).toISOString().slice(0, 10) : "";
  const daily = /* @__PURE__ */ new Map();
  const dailyModels = /* @__PURE__ */ new Map();
  const models = /* @__PURE__ */ new Map();
  const projects = /* @__PURE__ */ new Map();
  const totals = emptyTotals();
  const details = [];
  for (const session of index.sessions) {
    const buckets = session.buckets.filter((b) => b.date >= cutoff && b.date <= today);
    if (cutoff && !buckets.length && (!session.startedAt || session.startedAt.slice(0, 10) < cutoff || session.startedAt.slice(0, 10) > today)) continue;
    const start = validDate(session.startedAt, `${buckets[0]?.date ?? today}T00:00:00.000Z`);
    const end = validDate(session.endedAt, start);
    const detail = { ...emptyTotals(), id: createHash3("sha256").update(session.id).digest("hex").slice(0, 12), project: session.project || "Unknown project", startedAt: start, endedAt: end, durationMinutes: Math.max(0, (Date.parse(end) - Date.parse(start)) / 6e4), models: [] };
    const sessionDays = /* @__PURE__ */ new Map(), sessionModels = /* @__PURE__ */ new Set();
    for (const bucket of buckets) {
      const value = priced(bucket);
      add(totals, value);
      add(detail, value);
      const day = daily.get(bucket.date) ?? { ...emptyTotals(), date: bucket.date, sessions: 0, models: [] };
      add(day, value);
      daily.set(bucket.date, day);
      const dayModels = dailyModels.get(bucket.date) ?? /* @__PURE__ */ new Map();
      const dayModel = dayModels.get(bucket.model) ?? { ...emptyTotals(), model: bucket.model, sessions: 0, pricingKnown: !!getModelPricing(bucket.model) };
      if (!dayModels.has(bucket.model)) day.models.push(dayModel);
      add(dayModel, value);
      dayModels.set(bucket.model, dayModel);
      dailyModels.set(bucket.date, dayModels);
      const seenDayModels = sessionDays.get(bucket.date) ?? /* @__PURE__ */ new Set();
      seenDayModels.add(bucket.model);
      sessionDays.set(bucket.date, seenDayModels);
      const model = models.get(bucket.model) ?? { ...emptyTotals(), model: bucket.model, sessions: 0, pricingKnown: !!getModelPricing(bucket.model) };
      add(model, value);
      models.set(bucket.model, model);
      sessionModels.add(bucket.model);
    }
    for (const [date, dayModels] of sessionDays) {
      daily.get(date).sessions++;
      for (const model of dayModels) dailyModels.get(date).get(model).sessions++;
    }
    for (const model of sessionModels) models.get(model).sessions++;
    detail.models = [...sessionModels];
    details.push(detail);
    const project = projects.get(detail.project) ?? { ...emptyTotals(), project: detail.project, sessions: 0 };
    add(project, detail);
    project.sessions++;
    projects.set(project.project, project);
  }
  const earliest = cutoff || [...daily.keys()].sort()[0];
  if (earliest) {
    const cursor = /* @__PURE__ */ new Date(`${earliest}T00:00:00.000Z`);
    let count = 0;
    while (cursor.toISOString().slice(0, 10) <= today && count++ < 36600) {
      const date = cursor.toISOString().slice(0, 10);
      if (!daily.has(date)) daily.set(date, { ...emptyTotals(), date, sessions: 0, models: [] });
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
  }
  const d = index.diagnostics, w = d.warnings;
  const warnings = [];
  if (d.cacheErrors) warnings.push("The local cache could not be fully read or written. Readable usage is shown, but the next scan may take longer. Check available disk space and cache-directory permissions.");
  if (d.failedFiles) warnings.push(`${d.failedFiles} files could not be read or contained unsupported session data.`);
  if (w.malformedLines) warnings.push(`${w.malformedLines} malformed or partially written lines were skipped.`);
  if (w.invalidTokenRecords) warnings.push(`${w.invalidTokenRecords} incomplete or inconsistent usage records were handled defensively.`);
  if (w.counterResets) warnings.push(`${w.counterResets} cumulative counter decreases were handled conservatively; see accounting notes.`);
  if (w.unresolvedForkHistory) warnings.push(`${w.unresolvedForkHistory} forked sessions have incomplete ancestry evidence. Copied history could not be fully reconciled, so token and cost totals may be overstated.`);
  if (w.unknownContextEvents) warnings.push("Some historical records lack request context length; standard context rates were used for those records.");
  if (w.oversizedLines) warnings.push(`${w.oversizedLines} oversized metadata lines were skipped to keep memory bounded.`);
  return {
    historicalComparison: getHistoricalComparison(totals.totalTokens),
    generatedAt: now.toISOString(),
    timezone: "UTC",
    totals,
    sessions: details.length,
    cacheHitRate: totals.inputTokens + totals.cachedInputTokens ? totals.cachedInputTokens / (totals.inputTokens + totals.cachedInputTokens) : 0,
    daily: [...daily.values()].sort((a, b) => a.date.localeCompare(b.date)).map((day) => ({ ...day, models: day.models.sort((a, b) => b.totalTokens - a.totalTokens) })),
    models: [...models.values()].sort((a, b) => b.totalTokens - a.totalTokens),
    projects: [...projects.values()].sort((a, b) => b.totalTokens - a.totalTokens),
    sessionDetails: details.sort((a, b) => b.estimatedApiCost - a.estimatedApiCost),
    pricing: MODEL_PRICING.map((p) => ({ ...p, notes: p.note })),
    pricingCheckedAt: PRICING_CHECKED_AT,
    assumptions: [
      ...PRICING_ASSUMPTIONS,
      "Repeated snapshots and overlapping request records are counted once. Explicit cumulative counter resets start a new accounting segment; unusual undocumented resets can still limit exact reconciliation.",
      "Fork history is excluded using request ownership and matching numerical history along declared ancestry. Missing or ambiguous ancestry is reported in import notes. Usage absent from local logs cannot be reconstructed.",
      "Dates and chart periods use UTC. Session span includes idle time. Projects use available repository or directory names; same-name roots may be grouped together."
    ],
    source: { directory: options.directory ?? "~/.codex", found: !d.missingDataDirectory, files: d.discoveredFiles, parsedFiles: d.discoveredFiles - d.failedFiles, cachedFiles: d.cachedFiles, failedFiles: d.failedFiles, malformedLines: w.malformedLines, warnings, scanDurationMs: d.elapsedMs, indexedAt: options.indexedAt ?? now.toISOString() }
  };
}

// src/lib/settings.ts
import { homedir as homedir3 } from "node:os";
import { join as join3, resolve as resolve2 } from "node:path";
import { mkdir, readFile, rename, stat as stat3, writeFile } from "node:fs/promises";
var cacheDirectory = () => process.env.CODEX_COST_CACHE_DIR || join3(homedir3(), ".cache", "codex-cost");
var defaultDataDirectory2 = () => process.env.CODEX_COST_DATA_DIR || process.env.CODEX_HOME || join3(homedir3(), ".codex");
var runtimeSettings = globalThis;
async function getDataDirectory() {
  if (runtimeSettings.__codexCostDirectory) return runtimeSettings.__codexCostDirectory;
  if (process.env.CODEX_COST_DATA_DIR) return resolve2(process.env.CODEX_COST_DATA_DIR);
  try {
    const config = JSON.parse(await readFile(join3(cacheDirectory(), "settings.json"), "utf8"));
    if (typeof config.dataDir === "string") return config.dataDir;
  } catch {
  }
  return defaultDataDirectory2();
}
function displayDirectory(path) {
  const home = homedir3();
  return path === home ? "~" : path.startsWith(home + "/") ? "~" + path.slice(home.length) : path;
}

// src/lib/service.ts
var state = globalThis;
async function getAnalytics(options = {}) {
  const directory = await getDataDirectory();
  let scan = state.__codexCostScan;
  if (!scan || scan.directory !== directory || scan.completedAt && (options.rescan || Date.now() - scan.completedAt > 6e4)) {
    const nextScan = { directory, completedAt: 0, indexedAt: (/* @__PURE__ */ new Date()).toISOString(), promise: Promise.resolve(null) };
    nextScan.promise = indexCodex({ dataDir: directory, cacheDir: cacheDirectory(), rescan: options.rescan }).then((result) => {
      nextScan.completedAt = Date.now();
      nextScan.indexedAt = (/* @__PURE__ */ new Date()).toISOString();
      return result;
    }).catch((error) => {
      if (state.__codexCostScan === nextScan) state.__codexCostScan = void 0;
      throw error;
    });
    state.__codexCostScan = nextScan;
    scan = nextScan;
  }
  const index = await scan.promise;
  return aggregateUsage(index, { days: options.days, directory: displayDirectory(directory), indexedAt: scan.indexedAt });
}
export {
  getAnalytics
};
