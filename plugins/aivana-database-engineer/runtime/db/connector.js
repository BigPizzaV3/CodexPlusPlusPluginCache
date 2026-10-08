const { SqlServerAdapter } = require("./sqlServerAdapter");
const { PostgresAdapter } = require("./postgresAdapter");
const { SqliteAdapter, MySqlAdapter } = require("./baseAdapter");
const fs = require("node:fs");
const { getPolicy } = require("../config");

function safeParseJson(value) {
  if (!value) {
    return null;
  }
  try {
    return JSON.parse(String(value));
  } catch {
    return null;
  }
}

function mergeSecretProfile(profileName, policy) {
  const storeCandidates = [];
  if (policy?.auth?.secretStoreEnv) {
    for (const envName of policy.auth.secretStoreEnv) {
      if (process.env[envName]) {
        storeCandidates.push(process.env[envName]);
      }
    }
  }
  if (policy?.auth?.secretStorePaths) {
    for (const envName of policy.auth.secretStorePaths) {
      const p = process.env[envName];
      if (p && fs.existsSync(p)) {
        try {
          const fileValue = fs.readFileSync(p, "utf8");
          storeCandidates.push(fileValue);
        } catch {}
      }
    }
  }
  const merged = {};
  for (const raw of storeCandidates) {
    const parsed = safeParseJson(raw);
    if (!parsed || typeof parsed !== "object") {
      continue;
    }
    Object.assign(merged, parsed);
  }
  const profile = safeParseJson(merged[profileName]) || safeParseJson(merged.default) || merged[profileName] || merged.default;
  if (!profile || typeof profile !== "object") {
    return null;
  }
  return {
    server: profile.server || profile.host || profile.hostname,
    user: profile.user || profile.username,
    password: profile.password || profile.pass,
    database: profile.database || profile.db || profile.name,
    engine: profile.engine || profile.type || "sqlserver",
    connectionString: profile.connectionString || profile.url,
    type: "configured",
  };
}

function redactProfile(profile = {}) {
  const safe = {};
  for (const [key, value] of Object.entries(profile || {})) {
    if (/password|secret|token|credential|key|connectionstring/i.test(key)) {
      safe[key] = value ? "***redacted***" : value;
    } else {
      safe[key] = value;
    }
  }
  return safe;
}

function readProfile(name) {
  const safeName = String(name || "default");
  const policy = getPolicy();
  const prefix = `CODEXDB_${safeName.toUpperCase()}_`;
  const profileEngine = normalizeEngine(process.env[`${prefix}ENGINE`] || (["postgres", "sqlserver", "sqlite", "mysql", "mariadb"].includes(safeName) ? safeName : process.env.CODEXDB_ENGINE || "sqlserver"));
  const db = process.env[`${prefix}DB`] || process.env[`${prefix}DATABASE`] || process.env["CODEXDB_DATABASE"] || process.env["CODEXDB_DB"] || undefined;
  const secretProfile = mergeSecretProfile(safeName, policy);
  const connectionString = process.env[`${prefix}CONNECTION_STRING`] || process.env["CODEXDB_CONNECTION_STRING"];
  if (safeName === "default" && !db) {
    if (secretProfile) {
      return secretProfile;
    }
    if (connectionString) {
      return {
        type: "configured",
        engine: profileEngine,
        connectionString,
      };
    }
    return {
      type: "mock",
      engine: profileEngine,
    };
  }
  const fallback = {
    type: "configured",
    engine: profileEngine,
    server: process.env[`${prefix}SERVER`],
    user: process.env[`${prefix}USER`],
    password: process.env[`${prefix}PASSWORD`],
    database: db,
    connectionString,
    port: process.env[`${prefix}PORT`],
    ssl: process.env[`${prefix}SSL`],
    encrypt: process.env[`${prefix}ENCRYPT`],
    trustServerCertificate: process.env[`${prefix}TRUST_SERVER_CERTIFICATE`],
    authentication: process.env[`${prefix}AUTHENTICATION`],
    odbcDriver: process.env[`${prefix}ODBC_DRIVER`],
  };
  if (secretProfile && secretProfile.database) {
    return { ...fallback, ...secretProfile };
  }
  if (secretProfile && !fallback.server && !fallback.user && !fallback.password) {
    return secretProfile;
  }
  return fallback;
}

function normalizeEngine(name = "sqlserver") {
  const v = String(name || "").trim().toLowerCase();
  if (["postgres", "postgresql", "pg"].includes(v)) return "postgres";
  if (["sqlserver", "mssql", "sql-server", "sql_server"].includes(v)) return "sqlserver";
  return v || "sqlserver";
}

async function createAdapter(context, args = {}) {
  const engine = normalizeEngine(args.engine || context.policy?.defaultEngine || "sqlserver");
  if (!["postgres", "sqlserver"].includes(engine)) throw new Error("Unsupported database engine");
  const profile = readProfile(args.connectionProfile || context.policy?.connectionProfile || engine);

  if (engine === "postgres") {
    const adapter = new PostgresAdapter(context, profile);
    const status = await initializeScoped(adapter, engine, args.database);
    if (hasMockAdapter(status) && context.policy?.auth?.requireLiveConnection) {
      return {
        adapter,
        status: {
          initialized: false,
          adapter: status.adapter,
          blocked: true,
          status: "live_connection_required",
          source: "connection",
          blockedReason: ["live_connection_required"],
          profile: redactProfile(profile),
        },
        engine,
      };
    }
    return { adapter, status, engine };
  }
  const adapter = new SqlServerAdapter(context, profile);
  const status = await initializeScoped(adapter, engine, args.database);
  if (hasMockAdapter(status) && context.policy?.auth?.requireLiveConnection) {
    return {
      adapter,
      status: {
        initialized: false,
        adapter: status.adapter,
        blocked: true,
        status: "live_connection_required",
        source: "connection",
        blockedReason: ["live_connection_required"],
        profile: redactProfile(profile),
      },
      engine,
    };
  }
  return { adapter, status, engine };
}

function hasMockAdapter(status = {}) {
  return String(status.adapter || "").includes("mock");
}

// Keep additional engines out of legacy SQL Server/PostgreSQL execution paths.
async function inspectDatabase(context, args, operation) {
  const methods = { discover_database: "discoverDatabase", database_capabilities: "getCapabilities", database_security_findings: "getSecurityFindings", native_query_plan: "explainQuery" };
  if (!Object.hasOwn(methods, operation)) throw new Error("Unsupported inspection operation");
  const engine = normalizeEngine(args.engine);
  if (operation === "native_query_plan" && (!["sqlite", "mysql", "mariadb"].includes(engine) || args.analyze || args.allowWrite ||
      typeof args.sql !== "string" || !args.sql.trim())) throw new Error("Native plan requires SQLite/MySQL/MariaDB SELECT SQL without execution options");
  if (!args.engine || !["sqlserver", "postgres", "sqlite", "mysql", "mariadb"].includes(engine) ||
      typeof args.database !== "string" || !args.database.trim()) throw new Error("Explicit supported engine and database required");
  const profile = readProfile(args.connectionProfile || engine);
  if (normalizeEngine(profile.engine) !== engine) throw new Error("Connection profile engine mismatch");
  let adapter;
  try {
    if (["sqlserver", "postgres"].includes(engine)) {
      const connected = await createAdapter(context, { ...args, engine });
      adapter = connected.adapter;
      if (!connected.status?.initialized || connected.status.blocked || hasMockAdapter(connected.status)) throw new Error("Live connection required for inspection");
    } else {
      adapter = engine === "sqlite" ? new SqliteAdapter(context, profile) : new MySqlAdapter({ ...context, engine }, profile);
      const status = await adapter.initialize();
      if (!status.initialized) throw new Error("Live inspection connection failed; verify profile, engine, and TLS configuration");
      if (engine === "sqlite") {
        const path = require("node:path");
        if (!path.isAbsolute(args.database) || fs.realpathSync(args.database) !== fs.realpathSync(profile.database)) throw new Error("Requested database does not match selected profile");
      } else if (adapter.database !== args.database) throw new Error("Requested database does not match selected profile");
    }
    const result = await adapter[methods[operation]](args);
    if (!result || result.error || result.source === "mock" || result.source === "unavailable") throw new Error("Live inspection unavailable or query outside supported read-only grammar");
    return { usp: operation, source: "live", scope: { engine, database: args.database },
      ...(operation === "native_query_plan" ? { queryHash: require("node:crypto").createHash("sha256").update(args.sql).digest("hex"),
        connectionProfile: args.connectionProfile || engine } : {}),
      capturedAt: new Date().toISOString(), result, executionAuthorized: false,
      limitations: ["Visible metadata only; absence of findings does not establish health", "Capabilities do not grant permissions or authorize SQL execution"] };
  } finally { if (adapter) await adapter.close(); }
}

async function initializeScoped(adapter, engine, requestedDatabase) {
  try {
    const status = await adapter.initialize();
    if (!hasMockAdapter(status) && requestedDatabase) {
      const result = engine === "postgres"
        ? await adapter.pool.query("SELECT current_database() AS database_name")
        : await adapter.connection.request().query("SELECT DB_NAME() AS database_name");
      const actual = engine === "postgres" ? result.rows?.[0]?.database_name : result.recordset?.[0]?.database_name;
      if (actual !== requestedDatabase) throw new Error("Requested database does not match the selected connection profile");
    }
    return status;
  } catch (error) {
    try { await adapter.close(); } catch {}
    throw error;
  }
}

async function probeAdminCapabilities(adapter, args = {}) {
  const checks = [];
  for (const [capability, method, rowsKey] of [
    ["query_statistics", "queryStats", null],
    ["lock_diagnostics", "lockAnalysis", "topWaiters"],
    ["index_usage", "indexUsage", "indexes"],
  ]) {
    try {
      const result = await adapter[method](args);
      if (result?.error || result?.source === "mock" || result?.source === "live_error") {
        checks.push({ capability, status: "unavailable", reason: result.error === "pg_stat_statements_unavailable"
          ? "pg_stat_statements_unavailable" : "collector_unavailable",
          nextAction: result.error === "pg_stat_statements_unavailable"
            ? "review_extension_and_shared_preload_libraries_with_admin_no_automatic_restart"
            : "check_collector_configuration_and_least_privilege_permissions" });
        continue;
      }
      const rows = rowsKey ? result?.[rowsKey] : result;
      if (!Array.isArray(rows)) throw new Error("Unexpected collector output");
      checks.push({ capability, status: rows.length ? "available" : "available_no_rows",
        observedRows: rows.length, scope: capability === "lock_diagnostics" ? "may_include_instance_sessions" : "selected_database",
        ...(capability === "query_statistics" ? { p95Available: rows.some((row) => Number.isFinite(row.p95Ms)) } : {}) });
    } catch (error) {
      const code = String(error?.code || error?.number || "");
      checks.push({ capability, status: "unavailable",
        reason: ["42501", "229", "297", "300"].includes(code) ? "insufficient_permissions" : "collector_failed",
        nextAction: "check_engine_version_and_least_privilege_permissions" });
    }
  }
  return checks;
}

async function adminPreflight(context, args = {}) {
  if (typeof args.engine !== "string" || typeof args.database !== "string" || !args.database.trim()) {
    throw new Error("admin_preflight requires explicit engine and database");
  }
  const scope = { engine: normalizeEngine(args.engine), database: args.database };
  const base = { usp: "admin_preflight", scope, checkedAt: new Date().toISOString(),
    executionAuthorized: false, productionReady: false,
    limitations: ["Read-only collector access check, not a database health certificate",
      "Empty results do not prove absence of problems or full metadata visibility",
      "Backup, restore, failover and productive writes are not qualified by this check"] };
  let adapter;
  try {
    const connection = await createAdapter({ ...context, policy: { ...context.policy,
      auth: { ...context.policy?.auth, requireLiveConnection: true } } }, args);
    adapter = connection.adapter;
    if (connection.status?.blocked || hasMockAdapter(connection.status)) {
      return { ...base, status: "blocked", checks: [], source: "connection", reason: "live_connection_required" };
    }
    const checks = await probeAdminCapabilities(adapter, args);
    return { ...base, status: checks.some((check) => check.status === "unavailable") ? "limited" : "collectors_available",
      checks, source: "live" };
  } catch {
    return { ...base, status: "blocked", checks: [], source: "connection",
      reason: "connection_or_database_scope_failed",
      nextAction: "check_selected_profile_database_and_credentials_without_sharing_secrets" };
  } finally {
    if (adapter) await adapter.close();
  }
}

function fullScope(args) {
  const keys = ["systemId", "environment", "product", "productVersion", "deployment", "database", "engine"];
  if (keys.some((key) => typeof args[key] !== "string" || !args[key].trim() || args[key].length > 160)) throw new Error("Explicit full database and product scope required");
  if (!["postgres", "sqlserver"].includes(args.engine)) throw new Error("Unsupported engine");
  return Object.fromEntries(keys.map((key) => [key, args[key]]));
}

async function liveRows(adapter, engine, sql, values = []) {
  if (engine === "postgres") {
    const client = await adapter.pool.connect();
    try {
      await client.query("BEGIN READ ONLY");
      await client.query("SET LOCAL statement_timeout = '5s'");
      const result = await client.query({ text: sql, values, query_timeout: 6000 });
      return result.rows;
    } finally {
      let broken = false;
      try { await client.query("ROLLBACK"); } catch { broken = true; }
      client.release(broken);
    }
  }
  const request = adapter.connection.request();
  request.timeout = 5000;
  values.forEach((value, i) => request.input(`codex_arg_${i + 1}`, value));
  return (await request.query(sql)).recordset || [];
}

async function collectContextFingerprint(context, args) {
  const scope = fullScope(args);
  const crypto = require("node:crypto");
  const hash = (value) => crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");
  let adapter;
  try {
    const connected = await createAdapter(context, args);
    adapter = connected.adapter;
    if (connected.status?.blocked || hasMockAdapter(connected.status)) throw new Error("Live collector required");
    const sql = scope.engine === "postgres" ? {
      schema: "SELECT table_schema,table_name,column_name,data_type,is_nullable,column_default FROM information_schema.columns WHERE table_schema NOT IN ('pg_catalog','information_schema') ORDER BY table_schema,table_name,ordinal_position LIMIT 10001",
      indexes: "SELECT schemaname,tablename,indexname,indexdef FROM pg_indexes WHERE schemaname NOT IN ('pg_catalog','information_schema') ORDER BY schemaname,tablename,indexname LIMIT 10001",
      data: "SELECT schemaname,relname,n_live_tup,n_dead_tup,last_analyze,last_autoanalyze FROM pg_stat_user_tables ORDER BY schemaname,relname LIMIT 10001",
      config: "SELECT name,setting,unit FROM pg_settings WHERE name IN ('work_mem','shared_buffers','effective_cache_size','max_parallel_workers_per_gather','random_page_cost','jit','default_statistics_target') ORDER BY name",
      load: "SELECT count(*) AS active_sessions FROM pg_stat_activity WHERE datname=current_database() AND state='active' AND pid<>pg_backend_pid()",
    } : {
      schema: "SELECT TOP (10001) s.name AS schema_name,t.name AS table_name,c.name AS column_name,ty.name AS data_type,c.max_length,c.precision,c.scale,c.is_nullable,dc.definition AS column_default FROM sys.tables t JOIN sys.schemas s ON s.schema_id=t.schema_id JOIN sys.columns c ON c.object_id=t.object_id JOIN sys.types ty ON ty.user_type_id=c.user_type_id LEFT JOIN sys.default_constraints dc ON dc.object_id=c.default_object_id ORDER BY s.name,t.name,c.column_id",
      indexes: "SELECT TOP (10001) s.name AS schema_name,t.name AS table_name,i.name,i.type,i.is_unique,i.is_disabled,i.filter_definition,ic.key_ordinal,ic.is_included_column,c.name AS column_name FROM sys.tables t JOIN sys.schemas s ON s.schema_id=t.schema_id JOIN sys.indexes i ON i.object_id=t.object_id JOIN sys.index_columns ic ON ic.object_id=i.object_id AND ic.index_id=i.index_id JOIN sys.columns c ON c.object_id=ic.object_id AND c.column_id=ic.column_id ORDER BY s.name,t.name,i.index_id,ic.index_column_id",
      data: "SELECT TOP (10001) s.name AS schema_name,t.name AS table_name,p.index_id,p.partition_number,p.rows FROM sys.tables t JOIN sys.schemas s ON s.schema_id=t.schema_id JOIN sys.partitions p ON p.object_id=t.object_id WHERE p.index_id IN (0,1) ORDER BY s.name,t.name,p.index_id,p.partition_number",
      config: "SELECT name,CAST(value_in_use AS nvarchar(128)) AS value FROM sys.configurations WHERE name IN ('max degree of parallelism','cost threshold for parallelism','max server memory (MB)','min server memory (MB)') ORDER BY name",
      load: "SELECT COUNT(*) AS active_sessions FROM sys.dm_exec_requests WHERE database_id=DB_ID() AND session_id<>@@SPID",
    };
    const rows = {};
    for (const [key, statement] of Object.entries(sql)) {
      rows[key] = await liveRows(adapter, scope.engine, statement);
      if (rows[key].length > 10000) throw new Error("Metadata exceeds bounded collection; no partial fingerprint accepted");
    }
    return { usp: "live_context_fingerprint", source: "live", scope, capturedAt: new Date().toISOString(),
      validityContext: { deployment: args.deployment, schemaHash: hash({ scope, columns: rows.schema, indexes: rows.indexes }),
        dataProfileHash: hash({ scope, data: rows.data }), configurationHash: hash({ scope, config: rows.config }),
        loadProfileHash: hash({ scope, load: rows.load }) },
      observedCounts: Object.fromEntries(Object.entries(rows).map(([key, value]) => [key, value.length])),
      coverage: "visible_metadata_estimates_and_instantaneous_load_not_full_data_or_workload",
      executionAuthorized: false, limitations: ["Metadata visibility depends on database permissions", "Row estimates are not content checksums", "Collection is not an atomic snapshot or continuous drift monitor"] };
  } finally { if (adapter) await adapter.close(); }
}

async function collectProcessEvidence(context, args) {
  const scope = fullScope(args);
  const url = new URL(process.env.CODEXDB_PROCESS_TRACE_URL);
  const token = process.env.CODEXDB_PROCESS_TRACE_TOKEN;
  if (url.protocol !== "https:" || url.username || url.password || url.hash || !token || /[\r\n]/.test(token)) throw new Error("Administratively configured HTTPS trace collector required");
  const response = await fetch(url, { method: "GET", redirect: "error", signal: AbortSignal.timeout(5000),
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" } });
  if (response.status !== 200 || !/^application\/json\b/i.test(response.headers.get("content-type") || "")) throw new Error("Trace collector unavailable");
  const reader = response.body.getReader();
  const chunks = [];
  let size = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 1024 * 1024) throw new Error("Trace collector response exceeds 1 MiB");
      chunks.push(Buffer.from(value));
    }
  } finally { await reader.cancel(); }
  const payload = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(chunks)));
  if (Object.keys(scope).some((key) => payload.scope?.[key] !== scope[key])) throw new Error("Trace collector scope mismatch");
  const traceReview = require("../diagnosticEvidence").correlateProcessTraces({ ...scope, spans: payload.spans });
  let adapter;
  try {
    const connection = await createAdapter(context, args);
    adapter = connection.adapter;
    if (connection.status?.blocked || hasMockAdapter(connection.status)) throw new Error("Live database context required");
    const statistics = await adapter.queryStats();
    const locks = await adapter.lockAnalysis();
    return { usp: "collect_process_evidence", source: "live_collectors", scope, capturedAt: new Date().toISOString(), traceReview,
      databaseContext: { joinedToTrace: false,
        queryStatistics: Array.isArray(statistics) ? statistics.map((row) => ({ queryId: row.queryId, avgMs: row.avgMs, executionCount: row.executionCount })) : [],
        statisticsStatus: Array.isArray(statistics) ? "available" : "unavailable",
        lockCollectorStatus: Array.isArray(locks?.topWaiters) ? "available" : "unavailable",
        observedWaiters: Array.isArray(locks?.topWaiters) ? locks.topWaiters.length : null },
      executionAuthorized: false, rootCauseProven: false,
      limitations: ["Trace identities are asserted by the configured exporter, not independently attested", "Database snapshots are context, not a proven join to trace IDs", "No automatic instrumentation installation or customer connector qualification"] };
  } finally { if (adapter) await adapter.close(); }
}

function replayRegistry(args) {
  fullScope(args);
  if (args.environment !== "lab") throw new Error("Replay is restricted to lab environments");
  const raw = process.env.CODEXDB_REPLAY_REGISTRY_JSON;
  if (!raw || Buffer.byteLength(raw) > 262144) throw new Error("Administrative replay registry required");
  const registry = JSON.parse(raw);
  const entry = registry[args.connectionProfile || args.engine];
  if (!entry || entry.database !== args.database || entry.engine !== args.engine || entry.systemId !== args.systemId ||
      entry.deployment !== args.deployment || entry.isolated !== true || entry.readOnlyPrincipalReviewed !== true) throw new Error("Replay target is not administratively qualified as isolated with reviewed read-only principal");
  return entry;
}

function resultDigest(rows, key, ordered = false) {
  const crypto = require("node:crypto");
  const typed = (value) => {
    if (value === null) return ["null"];
    if (value instanceof Date) return ["date", value.toISOString()];
    if (Buffer.isBuffer(value)) return ["binary", value.toString("base64")];
    if (typeof value === "number" && !Number.isFinite(value)) throw new Error("Non-finite result cannot be verified");
    if (["string", "number", "boolean", "bigint"].includes(typeof value)) return [typeof value, String(value)];
    if (Array.isArray(value)) return ["array", value.map(typed)];
    if (value && typeof value === "object") return ["object", Object.keys(value).sort().map((name) => [name, typed(value[name])])];
    throw new Error("Unsupported result type");
  };
  if (!Array.isArray(rows) || rows.length > 10000) throw new Error("Result row bound exceeded");
  const encoded = rows.map((row) => JSON.stringify(typed(row)));
  if (encoded.reduce((size, row) => size + Buffer.byteLength(row), 0) > 2 * 1024 * 1024) throw new Error("Result byte bound exceeded");
  if (!ordered) encoded.sort();
  return crypto.createHmac("sha256", key).update(JSON.stringify(encoded)).digest("hex");
}

async function replayWorkload(context, args) {
  const registry = replayRegistry(args);
  const crypto = require("node:crypto");
  if (Buffer.byteLength(JSON.stringify(args)) > 262144) throw new Error("Replay input too large");
  if (!Array.isArray(args.cases) || args.cases.length < 1 || args.cases.length > 100) throw new Error("One to 100 recorded cases required");
  const concurrency = args.concurrency ?? 1;
  const repetitions = args.repetitions ?? 3;
  if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 5 || !Number.isInteger(repetitions) || repetitions < 3 || repetitions > 10) throw new Error("Concurrency 1..5 and repetitions 3..10 required");
  if (new Set(args.cases.map((c) => c.id)).size !== args.cases.length) throw new Error("Duplicate replay case ID");
  const cases = args.cases.map((item) => {
    if (typeof item.id !== "string" || !/^[A-Za-z0-9_-]{1,80}$/.test(item.id) || !Number.isInteger(item.offsetMs ?? 0) || (item.offsetMs ?? 0) < 0 || (item.offsetMs ?? 0) > 10000) throw new Error("Invalid case or arrival offset");
    if (!Array.isArray(item.parameters) || item.parameters.length > 32 || item.parameters.some((p) => p !== null && !["string", "number", "boolean"].includes(typeof p) || typeof p === "number" && !Number.isFinite(p))) throw new Error("Only bounded scalar parameters supported");
    const templates = [item.baselineTemplate, item.candidateTemplate].map((id) => {
      if (!Object.hasOwn(registry.templates || {}, id)) throw new Error("Template not administratively allowlisted");
      const template = registry.templates[id];
      if (typeof template.sql !== "string" || template.sql.length > 32000 || template.parameterCount !== item.parameters.length ||
          !Number.isInteger(template.maxRows) || template.maxRows < 1 || template.maxRows > 10000 ||
          template.sha256 !== crypto.createHash("sha256").update(template.sql).digest("hex") || template.reviewedReadOnly !== true) throw new Error("Invalid reviewed template contract");
      const safe = require("../sqlSafety").validateSqlSafety(template.sql);
      if (!safe.safe) throw new Error("Template rejected by SQL safety checks");
      return template;
    });
    if (item.assertion !== undefined && item.assertion !== "zero_violations") throw new Error("Unsupported replay assertion");
    return { ...item, templates };
  });
  const runId = crypto.randomUUID();
  const hashKey = crypto.randomBytes(32);
  const records = [];
  let adapter;
  try {
    const connected = await createAdapter(context, args);
    adapter = connected.adapter;
    if (connected.status?.blocked || hasMockAdapter(connected.status)) throw new Error("Replay requires a live database");
    const started = Date.now();
    let next = 0, roundStarted = started, jobs = [];
    async function worker() {
      for (;;) {
        const job = jobs[next++];
        if (!job) break;
        if (Date.now() - started > 90000) throw new Error("Replay time budget exceeded");
        const { item, repetition } = job;
        const wait = (item.offsetMs || 0) - (Date.now() - roundStarted);
        if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
        const pair = { caseId: item.id, repetition, observations: {}, scheduledOffsetMs: item.offsetMs || 0, startedOffsetMs: Date.now() - roundStarted };
        for (const index of repetition % 2 ? [1, 0] : [0, 1]) {
          const begin = performance.now();
          const rows = await liveRows(adapter, args.engine, item.templates[index].sql, item.parameters);
          if (rows.length > item.templates[index].maxRows) throw new Error("Result exceeds reviewed template bound");
          pair.observations[index === 0 ? "baseline" : "candidate"] = { durationMs: performance.now() - begin,
            rowCount: rows.length, resultHash: resultDigest(rows, hashKey, args.ordered === true),
            invariant: item.assertion === "zero_violations" ? evaluateZeroViolations(rows) : null };
        }
        pair.resultsMatch = pair.observations.baseline.resultHash === pair.observations.candidate.resultHash;
        records.push(pair);
      }
    }
    // Wait for every worker before closing the shared pool, including on failure.
    for (let repetition = 0; repetition < repetitions; repetition++) {
      jobs = cases.map((item) => ({ item, repetition })).sort((a, b) => (a.item.offsetMs || 0) - (b.item.offsetMs || 0));
      next = 0; roundStarted = Date.now();
      const outcomes = await Promise.allSettled(Array.from({ length: concurrency }, worker));
      const failed = outcomes.find((result) => result.status === "rejected");
      if (failed) throw new Error("Replay failed or exceeded bounds; no equivalence claim produced", { cause: failed.reason });
    }
    records.sort((a, b) => a.repetition - b.repetition || a.caseId.localeCompare(b.caseId));
    return { usp: "live_workload_replay", source: "live", scope: fullScope(args), runId, capturedAt: new Date().toISOString(),
      concurrency, repetitions, records, resultsMatch: records.every((pair) => pair.resultsMatch),
      parameterValuesExported: false, rawRowsExported: false, executionAuthorized: false,
      limitations: ["Only administratively reviewed lab templates are executed", "SQL checks are defense in depth, not a substitute for read-only DB privileges",
        "Hash comparison preserves duplicates and driver types but is not a formal SQL equivalence proof", "Comparisons can observe concurrent data changes; freeze test data", "Parameters must be anonymized before submission; no automatic anonymization claim", "Arrival offsets repeat per round; bounded workers may queue bursts, reported actual offsets are authoritative", "No production workload representativeness claim"] };
  } finally { hashKey.fill(0); if (adapter) await adapter.close(); }
}

async function verifyRewrite(context, args) {
  const required = ["nulls", "duplicates", "rounding", "timezone", "permissions"];
  if (!args.coverage || required.some((name) => !Array.isArray(args.coverage[name]) || !args.coverage[name].length || args.coverage[name].some((id) => !args.cases?.some((item) => item.id === id)))) throw new Error("Explicit edge-case coverage references required");
  const replay = await replayWorkload(context, args);
  return { ...replay, usp: "live_rewrite_verification", decision: replay.resultsMatch ? "matched_recorded_cases" : "rejected_semantic_difference",
    coverage: Object.fromEntries(required.map((name) => [name, { caseIds: args.coverage[name], provenance: "caller_declared_not_independently_proven" }])),
    permissionScope: "current_database_principal_only_not_all_user_roles", universalEquivalenceProven: false };
}

function evaluateZeroViolations(rows) {
  if (!Array.isArray(rows) || rows.length !== 1 || !rows[0] || !Object.hasOwn(rows[0], "violations")) return { status: "invalid_evidence" };
  const value = rows[0].violations;
  const count = typeof value === "bigint" ? value.toString() : typeof value === "number" && Number.isSafeInteger(value) ? String(value) : value;
  if (typeof count !== "string" || !/^(0|[1-9][0-9]{0,38})$/.test(count)) return { status: "invalid_evidence" };
  return { status: count === "0" ? "passed" : "failed", violations: count };
}

function validateTuningBudgets(budgets, caseIds) {
  if (budgets === undefined) return [];
  if (!Array.isArray(budgets) || !budgets.length || budgets.length > 100) throw new Error("One to 100 tuning budgets required");
  const seen = new Set();
  return budgets.map((budget) => {
    if (!budget || !caseIds.includes(budget.caseId) || seen.has(budget.caseId)) throw new Error("Unknown or duplicate budget case");
    seen.add(budget.caseId);
    const fields = ["maxCandidateMedianMs", "maxRegressionMs"];
    if (Object.keys(budget).some((key) => !["caseId", ...fields].includes(key)) ||
        !fields.some((key) => budget[key] !== undefined) || fields.some((key) => budget[key] !== undefined &&
          (typeof budget[key] !== "number" || !Number.isFinite(budget[key]) || budget[key] < 0))) throw new Error("Finite nonnegative tuning budget required");
    return { ...budget };
  });
}

function reviewTuningRun(before, replay, after, budgets) {
  const keys = ["schemaHash", "dataProfileHash", "configurationHash", "loadProfileHash"];
  const contextChanges = keys.filter((key) => !before.validityContext?.[key] || before.validityContext[key] !== after.validityContext?.[key]);
  const median = (values) => {
    const sorted = [...values].sort((a, b) => a - b), n = sorted.length;
    return n % 2 ? sorted[(n - 1) / 2] : (sorted[n / 2 - 1] + sorted[n / 2]) / 2;
  };
  if (!Array.isArray(replay.records) || !replay.records.length) throw new Error("Measured replay records required");
  const groups = new Map();
  for (const pair of replay.records) {
    if (![pair.observations?.baseline?.durationMs, pair.observations?.candidate?.durationMs].every((n) => Number.isFinite(n) && n >= 0)) throw new Error("Invalid measured duration");
    if (!groups.has(pair.caseId)) groups.set(pair.caseId, []);
    groups.get(pair.caseId).push(pair);
  }
  const cases = [...groups].map(([caseId, pairs]) => {
    const baselineMedianMs = median(pairs.map((p) => p.observations.baseline.durationMs));
    const candidateMedianMs = median(pairs.map((p) => p.observations.candidate.durationMs));
    return { caseId, samples: pairs.length, baselineMedianMs, candidateMedianMs,
      deltaMs: candidateMedianMs - baselineMedianMs,
      resultsMatch: pairs.every((p) => p.resultsMatch === true),
      invariantStatus: pairs.some((p) => p.observations.baseline.invariant || p.observations.candidate.invariant)
        ? pairs.every((p) => p.observations.baseline.invariant?.status === "passed" && p.observations.candidate.invariant?.status === "passed") ? "passed" : "rejected"
        : "not_checked",
      interpretation: candidateMedianMs > baselineMedianMs ? "observed_slower" : candidateMedianMs < baselineMedianMs ? "observed_faster" : "observed_equal" };
  });
  const mismatch = cases.some((c) => !c.resultsMatch);
  const budgetResults = validateTuningBudgets(budgets, cases.map((c) => c.caseId)).map((budget) => {
    const measured = cases.find((c) => c.caseId === budget.caseId);
    const violations = [];
    if (budget.maxCandidateMedianMs !== undefined && measured.candidateMedianMs > budget.maxCandidateMedianMs) violations.push("candidate_median_exceeds_limit");
    if (budget.maxRegressionMs !== undefined && measured.deltaMs > budget.maxRegressionMs) violations.push("regression_exceeds_limit");
    return { ...budget, status: violations.length ? "exceeded" : "within_observed_budget", violations };
  });
  return { cases, contextChanges, budgetResults,
    unbudgetedCases: cases.filter((c) => !budgetResults.some((b) => b.caseId === c.caseId)).map((c) => c.caseId),
    decision: cases.some((c) => c.invariantStatus === "rejected") ? "reject_business_invariant" : mismatch ? "reject_result_difference" : contextChanges.length ? "inconclusive_context_changed" : budgetResults.some((b) => b.status === "exceeded") ? "reject_performance_budget" : "review_recorded_measurements",
    productionChangeAuthorized: false, statisticalSignificanceEstablished: false,
    missingEvidence: ["server_CPU_and_IO", "representative_production_workload", "write_overhead", "all_ERP_roles_and_business_invariants", "immutable_test_data_proof"] };
}

async function runTuningLab(context, args = {}) {
  // Validate administrative isolation before any connection or metadata collection.
  replayRegistry(args);
  validateTuningBudgets(args.budgets, (args.cases || []).map((c) => c.id));
  const before = await collectContextFingerprint(context, args);
  const replay = await verifyRewrite(context, args);
  const after = await collectContextFingerprint(context, args);
  return { usp: "run_tuning_lab", source: "live", scope: replay.scope, runId: replay.runId,
    before, replay, after, review: reviewTuningRun(before, replay, after, args.budgets), executionAuthorized: false,
    limitations: ["Wall-clock durations include client and network overhead, not server CPU time",
      "Metadata fingerprints do not prove frozen data or equal cache conditions",
      "No index creation, production deployment, or universal equivalence certification"] };
}

function compareDatabaseSnapshots(args = {}) {
  const normalize = (value, depth = 0) => {
    if (depth > 30) throw new Error("Snapshot nesting limit exceeded");
    if (value === null || typeof value === "string" || typeof value === "boolean") return value;
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (Array.isArray(value)) return value.map((item) => normalize(item, depth + 1));
    if (value && typeof value === "object") return Object.fromEntries(Object.keys(value).sort().map((key) => [key, normalize(value[key], depth + 1)]));
    throw new Error("Snapshot must contain JSON values");
  };
  const index = (snapshot) => {
    if (!snapshot || !["sqlserver", "postgres", "sqlite", "mysql", "mariadb"].includes(snapshot.engine) ||
        typeof snapshot.database !== "string" || !snapshot.database || !Array.isArray(snapshot.objects) || snapshot.objects.length > 50000 ||
        !snapshot.coverage || typeof snapshot.coverage !== "object" || Array.isArray(snapshot.coverage) || typeof snapshot.complete !== "boolean") throw new Error("Invalid discovery snapshot");
    if (Buffer.byteLength(JSON.stringify(snapshot)) > 16 * 1024 * 1024) throw new Error("Snapshot byte limit exceeded");
    const entries = new Map();
    for (const object of snapshot.objects) {
      if (!object || ["kind", "schema", "name"].some((key) => typeof object[key] !== "string" || !object[key] || object[key].length > 1024)) throw new Error("Invalid object identity");
      const identity = JSON.stringify([object.kind, object.schema, object.name]);
      if (entries.has(identity)) throw new Error("Duplicate object identity");
      entries.set(identity, { object, canonical: JSON.stringify(normalize(object)) });
    }
    return entries;
  };
  const before = args.before, after = args.after;
  const left = index(before), right = index(after);
  if (before.engine !== after.engine) throw new Error("Cross-engine comparison requires an explicit migration mapping");
  const changes = [], unchanged = [];
  for (const identity of [...new Set([...left.keys(), ...right.keys()])].sort()) {
    const previous = left.get(identity), current = right.get(identity);
    const object = (current || previous).object;
    const covered = before.coverage[object.kind] === "collected" && after.coverage[object.kind] === "collected";
    const base = { identity: { kind: object.kind, schema: object.schema, name: object.name } };
    if (previous && current) {
      if (previous.canonical === current.canonical) { unchanged.push(base.identity); continue; }
      changes.push({ ...base, type: "changed_observation", coverageVerified: covered,
        changedFields: [...new Set([...Object.keys(previous.object), ...Object.keys(current.object)])].sort().filter((key) =>
          Object.hasOwn(previous.object, key) !== Object.hasOwn(current.object, key) ||
          JSON.stringify(normalize(previous.object[key] ?? null)) !== JSON.stringify(normalize(current.object[key] ?? null))) });
    } else {
      changes.push({ ...base, type: current ? "only_in_after" : "only_in_before",
        absenceConfirmed: covered && before.complete === true && after.complete === true });
    }
  }
  return { usp: "compare_database_snapshots", source: "supplied_snapshots", engine: before.engine,
    databases: { before: before.database, after: after.database }, changes, unchangedCount: unchanged.length,
    executionAuthorized: false, migrationSql: null,
    limitations: ["Input provenance and completeness are caller assertions, not independently verified",
      "One-sided objects do not prove creation or deletion when discovery is incomplete",
      "Attribute changes may reflect statistics or catalog representation, not DDL",
      "Names are case-sensitive; no rename inference or cross-engine conversion", "No SQL is generated or executed"] };
}

async function compareLiveSchemas(context, args = {}) {
  if (!args.before || !args.after) throw new Error("Two explicit connection scopes required");
  if (normalizeEngine(args.before.engine) !== normalizeEngine(args.after.engine)) throw new Error("Cross-engine comparison requires an explicit migration mapping");
  const before = await inspectDatabase(context, args.before, "discover_database");
  const after = await inspectDatabase(context, args.after, "discover_database");
  const comparison = compareDatabaseSnapshots({ before: before.result, after: after.result });
  return { ...comparison, usp: "compare_live_schemas", source: "live",
    observations: { before: { scope: before.scope, capturedAt: before.capturedAt, coverage: before.result.coverage },
      after: { scope: after.scope, capturedAt: after.capturedAt, coverage: after.result.coverage } },
    limitations: [...comparison.limitations.filter((item) => !item.startsWith("Input provenance")),
      "Sequential live observations are not an atomic cross-database snapshot; permissions may differ"] };
}

function schemaContractCheck(args = {}) {
  const { before, after, contract } = args;
  if (!contract || !Array.isArray(contract.requiredObjects) || !Array.isArray(contract.protectedObjects) ||
      !Array.isArray(contract.expectedChanges) || [contract.requiredObjects, contract.protectedObjects, contract.expectedChanges].some((list) => list.length > 1000) ||
      contract.requiredObjects.length + contract.protectedObjects.length + contract.expectedChanges.length === 0 ||
      !Number.isInteger(contract.maxAgeMinutes) || contract.maxAgeMinutes < 1 || contract.maxAgeMinutes > 1440) throw new Error("Explicit bounded schema contract required");
  for (const observation of [before, after]) {
    if (!observation?.result || observation.scope?.engine !== observation.result.engine || observation.scope?.database !== observation.result.database) throw new Error("Observation scope mismatch");
  }
  const comparison = compareDatabaseSnapshots({ before: before.result, after: after.result });
  const identity = (item) => {
    if (!item || ["kind", "schema", "name"].some((key) => typeof item[key] !== "string" || !item[key] || item[key].length > 1024)) throw new Error("Invalid contract object identity");
    return JSON.stringify([item.kind, item.schema, item.name]);
  };
  const unique = (items, key) => {
    const keys = items.map(key);
    if (new Set(keys).size !== keys.length) throw new Error("Duplicate schema contract entry");
    return new Set(keys);
  };
  const required = unique(contract.requiredObjects, identity);
  const protectedObjects = unique(contract.protectedObjects, identity);
  const changeKey = (change) => {
    if (!["changed_observation", "only_in_before", "only_in_after"].includes(change?.type)) throw new Error("Invalid expected change type");
    return JSON.stringify([identity(change.identity), change.type]);
  };
  const expected = unique(contract.expectedChanges, changeKey);
  const candidates = new Set(after.result.objects.map(identity));
  const baseline = new Set(before.result.objects.map(identity));
  const findings = [];
  for (const key of required) if (!candidates.has(key)) findings.push({ code: "required_object_not_observed", identity: JSON.parse(key) });
  for (const key of protectedObjects) if (!baseline.has(key) || !candidates.has(key)) findings.push({ code: "protected_object_not_observed", identity: JSON.parse(key) });
  const seen = new Set();
  for (const change of comparison.changes) {
    const key = changeKey(change);
    seen.add(key);
    if (protectedObjects.has(identity(change.identity))) findings.push({ code: "protected_object_changed", change });
    if (!expected.has(key)) findings.push({ code: "unexpected_change", change });
  }
  for (const change of contract.expectedChanges) if (!seen.has(changeKey(change))) findings.push({ code: "expected_change_not_observed", change });
  const gaps = [];
  if (Date.parse(before.capturedAt) > Date.parse(after.capturedAt)) gaps.push("capture_order_reversed");
  for (const [label, observation] of [["before", before], ["after", after]]) {
    const captured = typeof observation.capturedAt === "string" ? Date.parse(observation.capturedAt) : NaN;
    const age = Date.now() - captured;
    if (!Number.isFinite(age) || age < 0 || age > contract.maxAgeMinutes * 60000) gaps.push(`${label}: stale_or_invalid_capture_time`);
    if (observation.result.complete !== true) gaps.push(`${label}: incomplete_catalog`);
    const kinds = new Set([...observation.result.objects, ...contract.requiredObjects, ...contract.protectedObjects,
      ...contract.expectedChanges.map((change) => change.identity)].map((object) => object.kind));
    for (const kind of kinds) if (observation.result.coverage[kind] !== "collected") gaps.push(`${label}: ${kind}_not_collected`);
  }
  const canonical = (value, depth = 0) => {
    if (depth > 30) throw new Error("Contract nesting limit exceeded");
    if (Array.isArray(value)) return value.map((item) => canonical(item, depth + 1));
    if (value && typeof value === "object") return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key], depth + 1)]));
    return value;
  };
  const payload = JSON.stringify(canonical({ before, after, contract }));
  if (Buffer.byteLength(payload) > 34 * 1024 * 1024) throw new Error("Contract review size limit exceeded");
  const reviewFingerprint = require("node:crypto").createHash("sha256").update(payload).digest("hex");
  const fingerprintMatches = typeof args.reviewedFingerprint === "string" && args.reviewedFingerprint === reviewFingerprint;
  if (args.reviewedFingerprint !== undefined && !fingerprintMatches) findings.push({ code: "review_fingerprint_mismatch" });
  return { usp: "schema_contract_check", source: "supplied_observations", reviewFingerprint, fingerprintMatches,
    status: findings.length ? "contract_mismatch" : gaps.length ? "insufficient_evidence" : "observed_contract_matches",
    findings, evidenceGaps: gaps, comparison, executionAuthorized: false, deploymentApproved: false,
    limitations: ["Caller-supplied timestamps, scope and completeness are not independently attested",
      "Fingerprint binds exact observations and contract; it is not a signature or human approval",
      "Expected changes cannot override protected-object rules", "Metadata checks do not prove application or business compatibility"] };
}

function foreignKeyIndexReview(args = {}) {
  const snapshot = args.snapshot;
  compareDatabaseSnapshots({ before: snapshot, after: snapshot });
  if (!["sqlite", "mysql", "mariadb"].includes(snapshot.engine)) throw new Error("Foreign-key index review supports SQLite/MySQL/MariaDB catalogs only");
  const sqlite = snapshot.engine === "sqlite";
  const indexes = [], skippedIndexes = [];
  for (const item of snapshot.objects.filter((object) => object.kind === "index")) {
    const attributes = item.attributes || {};
    const raw = sqlite ? attributes.columns : attributes.rows;
    const rows = Array.isArray(raw) ? [...raw].filter((row) => !sqlite || row.key === 1) : [];
    const position = (row) => sqlite ? row.seqno : row.SEQ_IN_INDEX;
    rows.sort((a, b) => position(a) - position(b));
    const table = sqlite ? attributes.table : rows[0]?.TABLE_NAME;
    const columns = rows.map((row) => sqlite ? row.name : row.COLUMN_NAME);
    const valid = rows.length > 0 && typeof table === "string" && table && columns.every((column) => typeof column === "string" && column) &&
      rows.every((row, i) => Number.isInteger(position(row)) && position(row) === i + (sqlite ? 0 : 1)) &&
      (sqlite ? attributes.partial === 0 && rows.every((row) => Number.isInteger(row.cid) && row.cid >= 0) :
        rows.every((row) => row.TABLE_NAME === table && row.SUB_PART === null && row.INDEX_TYPE === "BTREE"));
    if (valid) indexes.push({ schema: item.schema, name: item.name, table, columns });
    else skippedIndexes.push({ schema: item.schema, name: item.name, reason: "partial_expression_prefix_or_incomplete_metadata" });
  }
  const findings = [];
  for (const item of snapshot.objects.filter((object) => object.kind === "foreign_key")) {
    const raw = sqlite ? item.attributes?.columns : item.attributes?.rows;
    const rows = Array.isArray(raw) ? [...raw] : [];
    const position = (row) => sqlite ? row.seq : row.ORDINAL_POSITION;
    rows.sort((a, b) => position(a) - position(b));
    const table = sqlite ? item.attributes?.table : rows[0]?.TABLE_NAME;
    const columns = rows.map((row) => sqlite ? row.from : row.COLUMN_NAME);
    const valid = rows.length > 0 && typeof table === "string" && table && columns.every((column) => typeof column === "string" && column) &&
      rows.every((row, i) => Number.isInteger(position(row)) && position(row) === i + (sqlite ? 0 : 1) && (sqlite || row.TABLE_NAME === table));
    const matches = valid ? indexes.filter((index) => index.schema === item.schema && index.table === table && columns.every((column, i) => index.columns[i] === column)) : [];
    findings.push({ schema: item.schema, foreignKey: item.name, table: table || null, columns,
      status: !valid ? "insufficient_metadata" : matches.length ? "leading_columns_observed" : "no_matching_index_observed",
      matchingIndexes: matches.map((index) => index.name) });
  }
  return { usp: "foreign_key_index_review", source: "supplied_snapshot", engine: snapshot.engine, database: snapshot.database,
    findings, skippedIndexes, coverage: { foreignKeys: snapshot.coverage.foreign_key || "unavailable", indexes: snapshot.coverage.index || "unavailable" },
    complete: false, executionAuthorized: false, indexSql: null,
    limitations: ["Column-prefix evidence only, not proof of optimizer use or performance gain",
      "Missing observed indexes do not prove absence with restricted visibility",
      "Collation, predicates, workload selectivity, implicit rowid indexes and foreign-key enforcement are not verified",
      "No CREATE INDEX or DROP INDEX is generated; benchmark before changes"] };
}

function compareNativePlans(args = {}) {
  const { before, after } = args;
  const maxAgeMinutes = args.maxAgeMinutes ?? 60;
  if (!Number.isInteger(maxAgeMinutes) || maxAgeMinutes < 1 || maxAgeMinutes > 10080) throw new Error("Plan age bound must be 1..10080 minutes");
  const normalize = (value, depth = 0) => {
    if (depth > 15) throw new Error("Plan nesting limit exceeded");
    if (value === null || typeof value === "string" || typeof value === "boolean") return value;
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (Array.isArray(value)) return value.map((item) => normalize(item, depth + 1));
    if (value && typeof value === "object") return Object.fromEntries(Object.keys(value).sort().map((key) => [key, normalize(value[key], depth + 1)]));
    throw new Error("Plan must contain JSON values");
  };
  const read = (observation) => {
    if (!observation || observation.usp !== "native_query_plan" || !["sqlite", "mysql", "mariadb"].includes(observation.scope?.engine) ||
        typeof observation.scope.database !== "string" || !observation.scope.database ||
        typeof observation.connectionProfile !== "string" || !observation.connectionProfile ||
        !/^[a-f0-9]{64}$/.test(observation.queryHash || "") || observation.result?.analyzed !== false ||
        !Array.isArray(observation.result.plan) || !observation.result.plan.length || observation.result.plan.length > 10000 ||
        observation.result.error) throw new Error("Bounded native plan observation required");
    const encoded = JSON.stringify(normalize(observation.result.plan));
    if (Buffer.byteLength(encoded) > 2 * 1024 * 1024) throw new Error("Plan byte limit exceeded");
    return { plan: JSON.parse(encoded), hash: require("node:crypto").createHash("sha256").update(encoded).digest("hex") };
  };
  const previous = read(before), current = read(after);
  if (before.scope.engine !== after.scope.engine || before.scope.database !== after.scope.database ||
      before.connectionProfile !== after.connectionProfile || before.queryHash !== after.queryHash) throw new Error("Plan comparison requires identical engine, database, profile, and exact SQL hash");
  const evidenceGaps = [];
  for (const [label, observation] of [["before", before], ["after", after]]) {
    const captured = typeof observation.capturedAt === "string" ? Date.parse(observation.capturedAt) : NaN;
    const age = Date.now() - captured;
    if (!Number.isFinite(age) || age < 0 || age > maxAgeMinutes * 60000) evidenceGaps.push(`${label}: stale_or_invalid_capture_time`);
    if (observation.source !== "live" || observation.result.source !== "live") evidenceGaps.push(`${label}: not_marked_live`);
  }
  if (Date.parse(before.capturedAt) > Date.parse(after.capturedAt)) evidenceGaps.push("capture_order_reversed");
  const steps = [];
  for (let i = 0; i < Math.max(previous.plan.length, current.plan.length); i++) {
    const left = previous.plan[i], right = current.plan[i];
    if (JSON.stringify(left) !== JSON.stringify(right)) steps.push({ position: i,
      status: left === undefined ? "added_position" : right === undefined ? "removed_position" : "changed_position",
      before: left ?? null, after: right ?? null });
  }
  return { usp: "compare_native_plans", source: "supplied_plan_observations", scope: before.scope, queryHash: before.queryHash,
    status: evidenceGaps.length ? "insufficient_evidence" : steps.length ? "plan_changed" : "same_observed_plan",
    beforePlanHash: previous.hash, afterPlanHash: current.hash, steps, evidenceGaps,
    performanceImprovementProven: false, executionAuthorized: false,
    limitations: ["Plan changes and estimates do not prove runtime regression or improvement",
      "Comparison preserves native row order; position changes are not semantic operator matching",
      "Exact SQL hash intentionally distinguishes whitespace and literal changes",
      "Supplied provenance and timestamps are not attested; profile labels do not prove server identity",
      "No workload, data distribution, permissions, or server-configuration equivalence is asserted"] };
}

function duplicateIndexReview(args = {}) {
  const snapshot = args.snapshot;
  compareDatabaseSnapshots({ before: snapshot, after: snapshot });
  if (!["sqlite", "mysql", "mariadb"].includes(snapshot.engine)) throw new Error("Native SQLite/MySQL/MariaDB index snapshot required");
  const sqlite = snapshot.engine === "sqlite";
  const groups = new Map(), excluded = [];
  for (const item of snapshot.objects.filter((object) => object.kind === "index")) {
    const attributes = item.attributes || {};
    const raw = sqlite ? attributes.columns : attributes.rows;
    const rows = Array.isArray(raw) ? [...raw].filter((row) => !sqlite || row.key === 1) : [];
    const position = (row) => sqlite ? row.seqno : row.SEQ_IN_INDEX;
    rows.sort((a, b) => position(a) - position(b));
    const table = sqlite ? attributes.table : rows[0]?.TABLE_NAME;
    const valid = rows.length > 0 && typeof table === "string" && table && rows.every((row, i) =>
      Number.isInteger(position(row)) && position(row) === i + (sqlite ? 0 : 1)) && (sqlite
      ? attributes.origin === "c" && attributes.unique === 0 && attributes.partial === 0 && rows.every((row) =>
        typeof row.name === "string" && row.name && Number.isInteger(row.cid) && row.cid >= 0 &&
        typeof row.coll === "string" && row.coll && [0, 1].includes(row.desc))
      : rows.every((row) => row.TABLE_NAME === table && row.NON_UNIQUE === 1 && row.INDEX_NAME !== "PRIMARY" &&
        row.INDEX_TYPE === "BTREE" && row.SUB_PART === null && ["A", "D"].includes(row.COLLATION) && typeof row.COLUMN_NAME === "string" && row.COLUMN_NAME));
    if (!valid) { excluded.push({ schema: item.schema, name: item.name, reason: "constraint_unique_partial_expression_prefix_or_incomplete_metadata" }); continue; }
    const keys = rows.map((row) => sqlite ? { column: row.name, descending: row.desc === 1, collation: row.coll } :
      { column: row.COLUMN_NAME, descending: row.COLLATION === "D" });
    const signature = JSON.stringify([item.schema, table, keys]);
    if (!groups.has(signature)) groups.set(signature, { schema: item.schema, table, keys, indexes: [] });
    groups.get(signature).indexes.push(item.name);
  }
  const candidates = [...groups.values()].filter((group) => group.indexes.length > 1)
    .map((group) => ({ ...group, indexes: group.indexes.sort(), status: "same_observed_key_structure",
      nextChecks: ["verify_constraint_and_foreign_key_dependencies", "check_query_hints_and_application_references",
        "measure_usage_and_write_cost_over_representative_workload", "review_visibility_and_engine_options", "test_in_isolated_lab"] }));
  candidates.sort((a, b) => JSON.stringify([a.schema, a.table, a.indexes]).localeCompare(JSON.stringify([b.schema, b.table, b.indexes])));
  return { usp: "duplicate_index_review", source: "supplied_snapshot", engine: snapshot.engine, database: snapshot.database,
    candidates, excluded, coverage: snapshot.coverage.index || "unavailable", complete: false,
    executionAuthorized: false, dropSql: null, estimatedSavings: null,
    limitations: ["Identical observed key structure is a review candidate, not proof an index is redundant",
      "Unique and constraint-created SQLite indexes are excluded; MySQL foreign-key dependencies require separate review",
      "Index visibility, storage options, hints, usage, and write costs are not established",
      "Restricted catalog visibility can hide other indexes; empty results do not prove absence",
      "No automatic retirement, DROP SQL, or savings estimate"] };
}

async function databaseEngineerBrief(context, args = {}) {
  if (args.sql !== undefined && (typeof args.sql !== "string" || !args.sql.trim())) throw new Error("Optional SQL must be a nonempty string");
  if (args.analyze || args.allowWrite) throw new Error("Briefing cannot authorize execution");
  const discovery = await inspectDatabase(context, args, "discover_database");
  const snapshot = discovery.result;
  const native = ["sqlite", "mysql", "mariadb"].includes(snapshot.engine);
  const bounded = (rows) => ({ items: rows.slice(0, 20), total: rows.length, truncated: rows.length > 20 });
  const counts = {};
  for (const object of snapshot.objects) counts[object.kind] = (counts[object.kind] || 0) + 1;
  const sections = { catalog: { source: "live", capturedAt: discovery.capturedAt, counts, coverage: snapshot.coverage,
    complete: snapshot.complete, limitations: snapshot.limitations, detailTool: "discover_database" } };
  const nextSteps = [], evidenceGaps = [];
  if (!snapshot.complete) evidenceGaps.push({ section: "catalog", reason: "visible_catalog_is_not_a_complete_database_audit" });
  for (const [kind, state] of Object.entries(snapshot.coverage)) {
    if (state !== "collected") evidenceGaps.push({ section: "catalog", kind, reason: state });
  }
  try {
    const security = await inspectDatabase(context, args, "database_security_findings");
    const findings = security.result.findings;
    const supported = security.result.status !== "unsupported" && Array.isArray(findings);
    sections.security = { source: "live", capturedAt: security.capturedAt, status: supported ? "collected" : "unsupported",
      findings: bounded(Array.isArray(findings) ? findings : []), coverage: security.result.coverage || {},
      limitations: security.result.limitations || [], detailTool: "database_security_findings" };
    if (!supported) evidenceGaps.push({ section: "security", reason: "security_audit_unsupported" });
    for (const [kind, state] of Object.entries(sections.security.coverage)) {
      if (state !== "collected") evidenceGaps.push({ section: "security", kind, reason: state });
    }
    if (supported && findings.length) nextSteps.push({ id: "review_security_evidence", section: "security", evidenceCount: findings.length,
      action: "Review observed grants and execution contexts with the database owner; do not revoke automatically.",
      prerequisite: "Confirm service-account, application, and ownership dependencies." });
  } catch {
    sections.security = { status: "unavailable", source: "collection_failure", detailTool: "database_security_findings" };
    evidenceGaps.push({ section: "security", reason: "collector_failed_check_profile_and_permissions" });
  }
  if (native) {
    const duplicates = duplicateIndexReview({ snapshot });
    const foreignKeys = foreignKeyIndexReview({ snapshot });
    sections.indexes = { source: "derived_from_live_catalog", capturedAt: discovery.capturedAt,
      duplicateCandidates: bounded(duplicates.candidates), foreignKeys: bounded(foreignKeys.findings),
      excludedIndexes: bounded(duplicates.excluded), coverage: foreignKeys.coverage,
      limitations: [...duplicates.limitations, ...foreignKeys.limitations], detailTools: ["duplicate_index_review", "foreign_key_index_review"] };
    if (duplicates.candidates.length) nextSteps.push({ id: "verify_duplicate_index_usage", section: "indexes", evidenceCount: duplicates.candidates.length,
      action: "Measure candidate usage and write cost over a representative workload before proposing retirement.",
      prerequisite: "Resolve constraints, foreign keys, hints, visibility, and storage options; no DROP authorization." });
    const missing = foreignKeys.findings.filter((finding) => finding.status !== "leading_columns_observed");
    if (missing.length) nextSteps.push({ id: "investigate_foreign_key_access", section: "indexes", evidenceCount: missing.length,
      action: "Inspect native plans for affected child-table lookups, then benchmark in an isolated lab.",
      prerequisite: "Confirm catalog visibility and actual workload; missing observation is not proven absence." });
  } else {
    sections.indexes = { status: "unsupported_in_this_brief", source: "capability_boundary" };
    evidenceGaps.push({ section: "indexes", reason: "native_index_review_currently_sqlite_mysql_mariadb_only" });
  }
  if (args.sql !== undefined) {
    if (!native) {
      sections.plan = { status: "unsupported_in_this_brief", source: "capability_boundary" };
      evidenceGaps.push({ section: "plan", reason: "use_existing_sqlserver_postgres_explain_workflow" });
    } else {
      try {
        const plan = await inspectDatabase(context, args, "native_query_plan");
        sections.plan = { status: "collected", source: "live", capturedAt: plan.capturedAt, queryHash: plan.queryHash,
          analyzed: false, rows: bounded(plan.result.plan), detailTool: "native_query_plan" };
        nextSteps.push({ id: "verify_plan_with_measurements", section: "plan", action: "Compare a matching baseline plan and obtain separate runtime and business-result evidence.",
          prerequisite: "Exact query, representative parameters, equivalent data, and isolated test environment." });
      } catch {
        sections.plan = { status: "unavailable", source: "collection_failure" };
        evidenceGaps.push({ section: "plan", reason: "query_unsupported_or_live_collection_failed_no_fallback_execution" });
      }
    }
  } else sections.plan = { status: "not_requested" };
  return { usp: "database_engineer_brief", source: "live_catalog_and_rule_review", scope: discovery.scope,
    capturedAt: discovery.capturedAt, sections, nextSteps, evidenceGaps,
    status: evidenceGaps.length ? "limited_evidence" : "review_available", executionAuthorized: false,
    healthScore: null, performanceImprovementProven: false,
    limitations: ["A prioritized human review checklist, not autonomous remediation or a health certification",
      "Section collection is sequential; concurrent database changes may affect observations",
      "At most 20 items per section are included; total and truncation are explicit",
      "No LLM call or external telemetry export; interpretation is performed by the hosting Codex session"] };
}

async function collectDbaMaintenance(context, args = {}) {
  const engine = normalizeEngine(args.engine);
  if (!args.engine || !["sqlserver", "postgres"].includes(engine) || typeof args.database !== "string" || !args.database) throw new Error("Explicit SQL Server/PostgreSQL database required");
  let adapter;
  try {
    const connected = await createAdapter(context, { ...args, engine });
    adapter = connected.adapter;
    if (!connected.status?.initialized || connected.status.blocked || hasMockAdapter(connected.status)) throw new Error("Live DBA evidence required");
    const queries = engine === "postgres" ? {
      maintenance: "SELECT schemaname,relname,n_live_tup,n_dead_tup,last_vacuum,last_autovacuum,last_analyze,last_autoanalyze,vacuum_count,autovacuum_count,analyze_count,autoanalyze_count FROM pg_catalog.pg_stat_user_tables ORDER BY schemaname,relname LIMIT 1001",
      configuration: "SELECT name,setting,unit,source FROM pg_catalog.pg_settings WHERE name IN ('autovacuum','autovacuum_vacuum_threshold','autovacuum_vacuum_scale_factor','autovacuum_analyze_threshold','autovacuum_analyze_scale_factor','max_connections','shared_buffers') ORDER BY name",
      counter_epoch: "SELECT datname,stats_reset FROM pg_catalog.pg_stat_database WHERE datname=current_database()",
    } : {
      maintenance: "SELECT TOP (1001) OBJECT_SCHEMA_NAME(s.object_id) AS schema_name,OBJECT_NAME(s.object_id) AS table_name,s.name AS statistic_name,p.last_updated,p.rows,p.rows_sampled,p.modification_counter FROM sys.stats s JOIN sys.tables t ON t.object_id=s.object_id OUTER APPLY sys.dm_db_stats_properties(s.object_id,s.stats_id) p ORDER BY s.object_id,s.stats_id",
      configuration: "SELECT name,recovery_model_desc,is_auto_create_stats_on,is_auto_update_stats_on,is_auto_update_stats_async_on FROM sys.databases WHERE database_id=DB_ID()",
      backup_history: "SELECT TOP (1001) backup_set_id,type,backup_start_date,backup_finish_date,is_copy_only,has_backup_checksums,is_damaged,CONVERT(varchar(40),first_lsn) AS first_lsn,CONVERT(varchar(40),last_lsn) AS last_lsn,CONVERT(varchar(40),database_backup_lsn) AS database_backup_lsn FROM msdb.dbo.backupset WHERE database_name=DB_NAME() ORDER BY backup_finish_date DESC,backup_set_id DESC",
    };
    const sections = {}, gaps = [];
    for (const [name, sql] of Object.entries(queries)) {
      try {
        const rows = await adapter._readCatalog(sql);
        const truncated = rows.length > 1000;
        sections[name] = { status: truncated ? "truncated" : rows.length ? "collected" : "collected_no_rows",
          rows: rows.slice(0, 1000), truncated, capturedAt: new Date().toISOString(),
          scope: engine === "postgres" && name === "configuration" ? "server_settings_for_current_session" : "selected_database" };
        if (truncated || !rows.length) gaps.push(`${name}: ${truncated ? "row_limit" : "no_visible_records"}`);
      } catch {
        sections[name] = { status: "unavailable", rows: [], reason: "permissions_version_or_collection_failure" };
        gaps.push(`${name}: unavailable`);
      }
    }
    if (engine === "postgres") {
      sections.backup_history = { status: "external_evidence_required", rows: [], reason: "Provide backup-tool catalog and restore-run evidence; database statistics do not attest backups" };
      gaps.push("backup_history: external_evidence_required");
    }
    return { usp: "collect_dba_maintenance", source: "live_catalog", scope: { engine, database: args.database }, sections, evidenceGaps: gaps,
      executionAuthorized: false, restoreVerified: false, backupChainVerified: false, rpoMet: null, rtoMet: null,
      limitations: ["PostgreSQL live/dead tuple counts are estimates, not a measured bloat percentage",
        "SQL Server modification counters describe the leading statistics column, not a universal stale-statistics threshold",
        "Backup history is not proof backup media exists, is restorable, or forms a valid complete recovery chain",
        "Backup timestamps follow server semantics; no timezone conversion or RPO inference",
        "Separate read-only queries are not one atomic snapshot; table overrides and all maintenance settings are not collected",
        "No VACUUM, UPDATE STATISTICS, DBCC, BACKUP, RESTORE, or configuration change executed"] };
  } finally { if (adapter) await adapter.close(); }
}

async function collectBlockingFrame(context, args = {}) {
  if (normalizeEngine(args.engine) !== "postgres" || !args.engine || typeof args.systemId !== "string" ||
      !args.systemId.trim() || args.systemId.length > 200 || typeof args.database !== "string" || !args.database.trim()) throw new Error("Explicit PostgreSQL system and database required");
  let adapter;
  try {
    const connected = await createAdapter(context, { ...args, engine: "postgres" });
    adapter = connected.adapter;
    if (!connected.status?.initialized || connected.status.blocked || hasMockAdapter(connected.status)) throw new Error("Live blocking evidence required");
    const [captured] = await adapter._readCatalog(`SELECT statement_timestamp() AS captured_at,
      COALESCE(json_agg(s ORDER BY s.pid),'[]'::json) AS sessions FROM
      (SELECT pid,backend_start,pg_blocking_pids(pid) AS blockers FROM pg_catalog.pg_stat_activity
       WHERE datname=current_database() AND pid<>pg_backend_pid() ORDER BY pid LIMIT 501) s`);
    if (!captured || !Array.isArray(captured.sessions)) throw new Error("Invalid live blocking result");
    if (captured.sessions.length > 500) throw new Error("Session limit exceeded; no complete frame produced");
    const iso = (value) => {
      if (value === null || value === undefined) throw new Error("Session identity is hidden or unavailable; check monitoring permissions");
      const date = new Date(value);
      if (!Number.isFinite(date.getTime())) throw new Error("Invalid live timestamp");
      return date.toISOString();
    };
    const capturedAt = iso(captured.captured_at);
    const sessions = captured.sessions.map((row) => {
      if (!Number.isInteger(row.pid) || row.pid <= 0 || !Array.isArray(row.blockers) ||
          row.blockers.some((pid) => !Number.isInteger(pid) || pid < 0)) throw new Error("Invalid live blocking identity");
      return { sessionId: String(row.pid), startedAt: iso(row.backend_start), blockedBy: [...new Set(row.blockers.map(String))] };
    });
    const frame = { engine: "postgres", systemId: args.systemId, database: args.database, capturedAt,
      evidenceRef: "blocking-" + require("node:crypto").randomUUID(), sessions };
    // Reuse timeline validation to reject clock skew, duplicate sessions and invalid start times.
    const preview = require("../memoryLayer").blockingTimeline({ engine: "postgres", systemId: args.systemId, database: args.database, frames: [frame] });
    return { usp: "collect_blocking_frame", source: "live", frame, preview, executionAuthorized: false,
      queryTextExported: false, backgroundMonitoring: false,
      limitations: ["One on-demand observation, not continuous monitoring; avoid high-frequency lock-manager polling",
        "Only sessions in the selected database are collected; external blockers stay unresolved",
        "PID zero represents a prepared-transaction blocker, not an ordinary session",
        "Client-visible duplicate blocker PIDs are deduplicated; start times are normalized to milliseconds",
        "Database activity and lock-manager state can change during collection",
        "No query text, usernames, cancellation, session termination, or workload SQL is collected or executed"] };
  } finally { if (adapter) await adapter.close(); }
}

async function collectReplicationHealth(context, args = {}) {
  if (!args.engine || normalizeEngine(args.engine) !== "postgres" || typeof args.database !== "string" || !args.database.trim()) throw new Error("Explicit PostgreSQL database required");
  let adapter;
  try {
    const connected = await createAdapter(context, { ...args, engine: "postgres" });
    adapter = connected.adapter;
    if (!connected.status?.initialized || connected.status.blocked || hasMockAdapter(connected.status)) throw new Error("Live replication evidence required");
    const queries = {
      configuration: "SELECT name,setting,unit FROM pg_catalog.pg_settings WHERE name IN ('wal_level','archive_mode','max_replication_slots','max_wal_senders','max_slot_wal_keep_size','wal_keep_size') ORDER BY name",
      role: "SELECT pg_is_in_recovery() AS in_recovery, CASE WHEN pg_is_in_recovery() THEN pg_last_wal_receive_lsn() ELSE pg_current_wal_lsn() END::text AS reference_lsn",
      slots: `WITH reference AS (SELECT CASE WHEN pg_is_in_recovery() THEN pg_last_wal_receive_lsn() ELSE pg_current_wal_lsn() END AS lsn)
        SELECT slot_name,slot_type,active,restart_lsn::text,confirmed_flush_lsn::text,
          CASE WHEN database IS NULL THEN 'cluster_physical' ELSE 'selected_database_logical' END AS scope,
          pg_wal_lsn_diff(reference.lsn,restart_lsn)::text AS retained_lsn_distance_bytes
        FROM pg_catalog.pg_replication_slots CROSS JOIN reference
        WHERE database=current_database() OR database IS NULL ORDER BY slot_name LIMIT 1001`,
      slot_limits: "SELECT slot_name,wal_status,safe_wal_size::text FROM pg_catalog.pg_replication_slots WHERE database=current_database() OR database IS NULL ORDER BY slot_name LIMIT 1001",
      archiver: "SELECT archived_count::text,last_archived_time,failed_count::text,last_failed_time,stats_reset FROM pg_catalog.pg_stat_archiver",
    };
    const sections = {}, evidenceGaps = [], findings = [];
    for (const [name, sql] of Object.entries(queries)) {
      try {
        const rows = await adapter._readCatalog(sql);
        const truncated = rows.length > 1000;
        sections[name] = { status: truncated ? "truncated" : "collected", rows: rows.slice(0, 1000), truncated,
          scope: name.startsWith("slot") ? "selected_database_logical_and_cluster_physical" : "cluster",
          capturedAt: new Date().toISOString() };
        if (truncated) evidenceGaps.push(`${name}: row_limit`);
      } catch {
        sections[name] = { status: "unavailable", rows: [], reason: "permissions_version_or_collection_failure" };
        evidenceGaps.push(`${name}: unavailable`);
      }
    }
    for (const row of sections.slot_limits.rows) {
      if (["lost", "unreserved"].includes(row.wal_status)) findings.push({ code: "slot_wal_at_risk", slot: row.slot_name, observedStatus: row.wal_status,
        nextStep: "Verify consumer recovery requirements and current slot state; do not delete the slot automatically" });
    }
    for (const row of sections.slots.rows) {
      if (row.active === false && row.restart_lsn !== null) findings.push({ code: "inactive_slot_retains_wal_reference", slot: row.slot_name,
        nextStep: "Check whether the consumer is intentionally offline and measure WAL storage and growth" });
    }
    if (sections.configuration.rows.some((r) => r.name === "max_slot_wal_keep_size" && r.setting === "-1")) findings.push({ code: "slot_wal_limit_unbounded", nextStep: "Review disk headroom and consumer recovery requirements before proposing a limit" });
    return { usp: "collect_replication_health", source: "live_catalog", scope: { engine: "postgres", database: args.database }, sections,
      evidenceGaps, findings, status: evidenceGaps.length ? "limited_evidence" : "observations_available", executionAuthorized: false,
      replicationHealthy: null, limitations: ["Other databases' logical slots are excluded; physical slots and archiver statistics are cluster-wide",
        "LSN distance is not measured retained disk usage, replica delay in seconds, or a disk exhaustion forecast",
        "Archive counters are cumulative since stats_reset, not proof of an ongoing failure or a restorable backup",
        "Separate bounded read-only observations are not atomic; no subscriber connectivity or end-to-end replication verification",
        "No slot deletion, WAL removal, replication configuration changes, or background monitoring"] };
  } finally { if (adapter) await adapter.close(); }
}

async function collectTempdbHealth(context, args = {}) {
  if (!args.engine || normalizeEngine(args.engine) !== "sqlserver" || args.database !== "tempdb") throw new Error("Explicit SQL Server database tempdb required");
  let adapter;
  try {
    const connected = await createAdapter(context, { ...args, engine: "sqlserver" });
    adapter = connected.adapter;
    if (!connected.status?.initialized || connected.status.blocked || hasMockAdapter(connected.status)) throw new Error("Live TempDB evidence required");
    const queries = {
      files: "SELECT TOP (1001) file_id,type_desc,name,CONVERT(varchar(30),size) AS size_pages,CONVERT(varchar(30),max_size) AS max_size_pages,growth,is_percent_growth,state_desc FROM sys.database_files ORDER BY file_id",
      space: "SELECT TOP (1001) file_id,CONVERT(varchar(30),total_page_count) AS total_pages,CONVERT(varchar(30),unallocated_extent_page_count) AS unallocated_extent_pages,CONVERT(varchar(30),user_object_reserved_page_count) AS user_object_pages,CONVERT(varchar(30),internal_object_reserved_page_count) AS internal_object_pages,CONVERT(varchar(30),version_store_reserved_page_count) AS version_store_pages FROM sys.dm_db_file_space_usage ORDER BY file_id",
      log: "SELECT CONVERT(varchar(30),total_log_size_in_bytes) AS total_log_bytes,CONVERT(varchar(30),used_log_space_in_bytes) AS used_log_bytes,used_log_space_in_percent FROM sys.dm_db_log_space_usage",
      page_waits: "SELECT TOP (1001) session_id,request_id,wait_type,wait_time AS wait_time_ms,wait_resource FROM sys.dm_exec_requests WHERE session_id<>@@SPID AND wait_type IN ('PAGELATCH_UP','PAGELATCH_EX','PAGELATCH_SH','PAGEIOLATCH_UP','PAGEIOLATCH_EX','PAGEIOLATCH_SH') AND wait_resource LIKE '2:%' ORDER BY session_id,request_id",
    };
    const sections = {}, evidenceGaps = [], findings = [];
    for (const [name, sql] of Object.entries(queries)) {
      try {
        const rows = await adapter._readCatalog(sql);
        const truncated = rows.length > 1000;
        sections[name] = { status: truncated ? "truncated" : "collected", rows: rows.slice(0, 1000), truncated,
          scope: "instance_shared_tempdb", capturedAt: new Date().toISOString() };
        if (truncated) evidenceGaps.push(`${name}: row_limit`);
      } catch {
        sections[name] = { status: "unavailable", rows: [], reason: "permissions_version_or_collection_failure" };
        evidenceGaps.push(`${name}: unavailable`);
      }
    }
    const dataFiles = sections.files.rows.filter((r) => r.type_desc === "ROWS");
    if (new Set(dataFiles.map((r) => r.size_pages)).size > 1) findings.push({ code: "unequal_data_file_sizes", nextStep: "Review proportional-fill behavior and workload before changing file sizes" });
    for (const file of dataFiles) {
      if (file.is_percent_growth === true || file.is_percent_growth === 1) findings.push({ code: "percentage_file_growth", fileId: file.file_id, nextStep: "Review consistent fixed growth increments against available storage" });
      if (file.growth === 0) findings.push({ code: "file_autogrowth_disabled", fileId: file.file_id, nextStep: "Verify intentional preallocation and measured capacity headroom" });
    }
    if (sections.page_waits.rows.length) findings.push({ code: "tempdb_page_waits_observed", nextStep: "Capture repeated observations and classify page resources; a page wait alone does not prove allocation contention" });
    return { usp: "collect_tempdb_health", source: "live_catalog", scope: { engine: "sqlserver", database: "tempdb", sharedAcrossDatabases: true },
      sections, findings, evidenceGaps, status: evidenceGaps.length ? "limited_evidence" : "observations_available", executionAuthorized: false,
      bottleneckProven: false, limitations: ["TempDB is instance-shared; observations cannot be attributed to one application database",
        "Page counters use 8 KiB pages and remain decimal strings; unallocated extents are not free disk capacity",
        "Only currently visible request-level page waits are sampled, not every parallel task or historical waits",
        "No allocation-page classification, version-store owner attribution, storage latency measurement, or capacity forecast",
        "Independent bounded read-only sections are not atomic; visibility depends on monitoring permissions",
        "No file resize, shrink, session termination, restart, or configuration change"] };
  } finally { if (adapter) await adapter.close(); }
}

module.exports = {
  evaluateZeroViolations,
  runTuningLab,
  reviewTuningRun,
  collectTempdbHealth,
  collectReplicationHealth,
  collectBlockingFrame,
  collectDbaMaintenance,
  databaseEngineerBrief,
  duplicateIndexReview,
  compareNativePlans,
  foreignKeyIndexReview,
  schemaContractCheck,
  compareDatabaseSnapshots,
  compareLiveSchemas,
  inspectDatabase,
  collectProcessEvidence,
  collectContextFingerprint,
  replayWorkload,
  verifyRewrite,
  replayRegistry,
  resultDigest,
  adminPreflight,
  probeAdminCapabilities,
  initializeScoped,
  readProfile,
  createAdapter,
  hasMockAdapter,
  redactProfile,
};
