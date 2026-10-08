const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { spawn, execFile } = require("node:child_process");
const { promisify } = require("node:util");
const { appendAuditEvent, buildEvent, readReplayLog, verifyAudit } = require("../runtime/auditLogger");
const { remember, recall } = require("../runtime/memoryLayer");
const { SqlServerAdapter } = require("../runtime/db/sqlServerAdapter");
const { PostgresAdapter } = require("../runtime/db/postgresAdapter");
const { consultingProject } = require("../runtime/diagnosticEvidence");

test("consulting projects persist tenant-scoped revisions, evidence and supplied acceptance", (t) => {
  const context = { stateFile: fixture(t) };
  const scope = { tenantId: "tenant-a", projectId: "project-1" };
  const data = { goals: [{ id: "g", text: "Improve posting" }], systems: [{ id: "s", text: "ERP lab" }],
    evidence: [{ id: "e", text: "Supplied test report" }], findings: [{ id: "f", text: "Blocking observed", evidenceRefs: ["e"] }] };
  const call = (action, extra = {}) => consultingProject(context, { ...scope, action, ...extra });
  assert.equal(call("create", { data }).project.revision, 1);
  assert.throws(() => call("get", { tenantId: "tenant-b" }), /unavailable/);
  assert.throws(() => call("create", { data }), /exists/);
  const accepted = call("update", { expectedRevision: 1, data: { acceptance: { status: "accepted", reviewer: "owner",
    recordedAt: new Date().toISOString(), note: "Reviewed supplied evidence", evidenceRefs: ["e"] } } });
  assert.equal(accepted.project.acceptance.status, "accepted");
  assert.equal(accepted.approvalGranted, false);
  assert.throws(() => call("update", { expectedRevision: 1, data: { decisions: [] } }), /revision/);
  assert.equal(call("get").project.revision, 2);
  assert.equal(call("update", { expectedRevision: 2, data: { decisions: [{ id: "d", text: "Repeat measurement" }] } }).project.acceptance.status, "pending");
  const report = call("export", { format: "json" });
  assert.deepEqual(JSON.parse(report.report).project, call("get").project);
  assert.equal(report.executionAuthorized, false);
  assert.equal(report.project.revision, 3);
  consultingProject(context, { ...scope, tenantId: "tenant-b", action: "create", data });
  assert.equal(call("get").project.revision, 3);
});

test("consulting exports redact credential patterns and neutralize Markdown and HTML", (t) => {
  const context = { stateFile: fixture(t) }, scope = { tenantId: "tenant", projectId: "report" };
  consultingProject(context, { ...scope, action: "create", data: {
    goals: [{ id: "g", text: '<script>alert(1)</script> [evil](javascript:alert(1)) ``` password=private-value secret=private-secret' }],
    systems: [{ id: "s", text: "https://user:private-password@example.org" }] } });
  for (const format of ["json", "markdown"]) {
    const result = consultingProject(context, { ...scope, action: "export", format });
    assert.doesNotMatch(JSON.stringify(result), /private-value|private-secret|private-password/);
    assert.match(result.reportHash, /^[a-f0-9]{64}$/);
    if (format === "markdown") assert.doesNotMatch(result.report, /<script|\]\(|```|https:\/\//);
  }
});

test("consulting projects reject malformed revisions, dangling references and incomplete acceptance atomically", (t) => {
  const context = { stateFile: fixture(t) }, scope = { tenantId: "tenant", projectId: "validation" };
  const call = (action, extra = {}) => consultingProject(context, { ...scope, action, ...extra });
  call("create", { data: { goals: [{ id: "g", text: "Goal" }], systems: [{ id: "s", text: "System" }] } });
  for (const data of [ { goals: [] }, { decisions: [{ id: "d", text: "Unknown proof", evidenceRefs: ["missing"] }] },
    { systems: [{ id: "s", text: "x" }, { id: "s", text: "y" }] }, { acceptance: { status: "accepted" } },
    { authorization: true }, { goals: [{ id: "g", text: "x".repeat(4001) }] } ]) {
    assert.throws(() => call("update", { expectedRevision: 1, data }));
    assert.equal(call("get").project.revision, 1);
  }
  assert.throws(() => call("update", { expectedRevision: "1", data: { decisions: [] } }), /revision/);
  assert.throws(() => call("get", { tenantId: "../tenant" }));
  assert.throws(() => call("export", { format: "html" }), /format/);
});
const { initializeScoped, createAdapter, adminPreflight, probeAdminCapabilities } = require("../runtime/db/connector");
const { exerciseRollbackSession } = require("../scripts/release-qualify");
const { dispatch } = require("../runtime/orchestrator");
const { diagnosticSession, recommendationValidity, advisoryCase, consumeAdminApproval } = require("../runtime/memoryLayer");
const { withState } = require("../runtime/stateStore");
const { resultDigest, replayRegistry, replayWorkload, verifyRewrite, collectProcessEvidence } = require("../runtime/db/connector");

function catalogAdapter(engine, respond) {
  const adapter = engine === "postgres" ? new PostgresAdapter({}, {}) : new SqlServerAdapter({}, {});
  const calls = [], releases = [];
  adapter.driver = {};
  const query = async (input) => {
    const sql = typeof input === "string" ? input : input.text;
    calls.push(sql);
    if (engine === "postgres") assert.equal(input.query_timeout, 5000);
    if (!sql.startsWith("SELECT")) {
      assert.ok(["BEGIN READ ONLY", "SET LOCAL statement_timeout = '5s'", "SET LOCAL search_path = pg_catalog", "ROLLBACK"].includes(sql));
      return { rows: [] };
    }
    const tag = /\/\* (discovery|security):([a-z_]+) \*\//.exec(sql);
    if (!tag) return engine === "postgres" ? { rows: [{ database: "fixture-db", version: "18" }] } : { recordset: [{ database: "fixture-db", version: "16.0", view_definition: 1 }] };
    assert.match(sql, engine === "postgres" ? /LIMIT 10001/ : /TOP \(10001\)/);
    const rows = await respond(tag[1], tag[2], sql);
    return engine === "postgres" ? { rows } : { recordset: rows };
  };
  if (engine === "postgres") adapter.pool = { connect: async () => ({ query, release: (error) => releases.push(error) }) };
  else adapter.connection = { request: () => ({ query, cancel() {} }) };
  return { adapter, calls, releases };
}

for (const engine of ["postgres", "sqlserver"]) {
  test(`${engine} discovery and security refuse offline sample fallback and report capability limits`, async () => {
    const adapter = engine === "postgres" ? new PostgresAdapter({ sampleCatalog: { postgres: { databases: ["sample"] } } }, {}) : new SqlServerAdapter({}, {});
    assert.equal(adapter.getCapabilities().discover, false);
    assert.equal(adapter.getCapabilities().security, false);
    await assert.rejects(adapter.discoverDatabase(), /Live/);
    await assert.rejects(adapter.getSecurityFindings(), /Live/);
  });

  test(`${engine} discovery returns normalized bounded live catalogs without completeness claims`, async () => {
    const { adapter, calls, releases } = catalogAdapter(engine, (_group, kind) => [{ schema: "app", name: ["column", "index", "primary_key", "foreign_key", "unique", "check", "default", "trigger"].includes(kind) ? `orders.${kind}` : kind,
      ...(kind === "view" ? { definition: "SELECT 1" } : {}), ...(kind === "column" ? { table_name: "orders", column_name: "id", data_type: "integer" } : {}),
      ...(engine === "sqlserver" && kind === "index" ? { columns_json: '[{"name":"id","key_ordinal":1}]' } : {}) }]);
    const result = await adapter.discoverDatabase();
    assert.equal(result.source, "live");
    assert.equal(result.engine, engine);
    assert.equal(result.database, "fixture-db");
    assert.equal(result.complete, false);
    assert.equal(Object.keys(result.coverage).length, 15);
    assert.equal(result.objects.length, engine === "postgres" ? 15 : 14);
    assert.equal(new Set(result.objects.map((o) => JSON.stringify([o.kind, o.schema, o.name]))).size, result.objects.length);
    assert.equal(result.objects.find((o) => o.kind === "column").attributes.table_name, "orders");
    assert.equal(result.objects.find((o) => o.kind === "view").definition, "SELECT 1");
    assert.equal(adapter.getCapabilities().discover, true);
    assert.equal(adapter.getCapabilities().capabilitiesAreNotPermissionChecks, true);
    if (engine === "postgres") {
      assert.equal(releases.length, 16);
      assert.ok(releases.every((error) => error === undefined));
      assert.equal(calls.filter((sql) => sql === "BEGIN READ ONLY").length, 16);
      assert.equal(calls.filter((sql) => sql === "SET LOCAL search_path = pg_catalog").length, 16);
      assert.ok(calls.some((sql) => sql.includes("pg_get_function_identity_arguments")));
    } else {
      assert.equal(result.coverage.materialized_view, "unsupported");
      assert.deepEqual(result.objects.find((o) => o.kind === "index").attributes.columns, [{ name: "id", key_ordinal: 1 }]);
      assert.ok(calls.every((sql) => sql.startsWith("SELECT")));
    }
  });

  test(`${engine} discovery distinguishes unavailable catalogs from collected empty catalogs`, async () => {
    const denied = engine === "postgres" ? { code: "42501" } : { number: 229 };
    const { adapter } = catalogAdapter(engine, (_group, kind) => {
      if (kind === "procedure") throw Object.assign(new Error("private permission payload"), denied);
      return [];
    });
    const result = await adapter.discoverDatabase();
    assert.equal(result.coverage.procedure, "unavailable");
    assert.equal(result.coverage.table, "collected");
    assert.equal(result.complete, false);
    assert.doesNotMatch(JSON.stringify(result), /private permission payload/);
  });

  test(`${engine} discovery rejects overflow and duplicate identities, including exact 10001 marker`, async () => {
    const row = { schema: "app", name: "orders" };
    for (const rows of [Array(10001).fill(row), [row, row], [{ schema: null, name: "broken" }]]) {
      const { adapter } = catalogAdapter(engine, () => rows);
      await assert.rejects(adapter.discoverDatabase(), /limit|duplicate|Invalid/);
    }
    const { adapter } = catalogAdapter(engine, (_group, kind) => kind === "table" ? Array.from({ length: 10000 }, (_, i) => ({ schema: "app", name: `t${i}` })) : []);
    assert.equal((await adapter.discoverDatabase()).objects.length, 10000);
  });

  test(`${engine} security reports catalog evidence and redacts credentials without fabricated checks`, async () => {
    const { adapter } = catalogAdapter(engine, () => [{ principal: "operator", role: "admin", detail: "password=private-value" }]);
    const result = await adapter.getSecurityFindings();
    assert.equal(result.source, "live");
    assert.ok(result.findings.length >= 4);
    assert.ok(result.findings.every((finding) => finding.id && finding.reason && finding.evidence && ["high", "medium"].includes(finding.severity)));
    assert.doesNotMatch(JSON.stringify(result.findings), /private-value|MFA|unused/);
    assert.equal(new Set(result.findings.map((finding) => finding.id)).size, result.findings.length);
    assert.ok(Object.values(result.coverage).every((state) => state === "collected"));
  });

  test(`${engine} security preserves partial coverage and fails on overflow or transport failure`, async () => {
    const denied = engine === "postgres" ? { code: "42501" } : { number: 229 };
    const { adapter } = catalogAdapter(engine, () => { throw Object.assign(new Error("hidden"), denied); });
    const unavailable = await adapter.getSecurityFindings();
    assert.deepEqual(unavailable.findings, []);
    assert.ok(Object.values(unavailable.coverage).every((state) => state === "unavailable"));
    const overflow = catalogAdapter(engine, () => Array(10001).fill({ principal: "admin" }));
    await assert.rejects(overflow.adapter.getSecurityFindings(), /limit/);
    const broken = catalogAdapter(engine, () => { throw new Error("transport failure"); });
    await assert.rejects(broken.adapter.discoverDatabase(), /transport failure/);
    await assert.rejects(broken.adapter.getSecurityFindings(), /transport failure/);
  });
}

test("Postgres discovery quarantines sessions when transaction cleanup fails", async () => {
  const adapter = new PostgresAdapter({}, {});
  adapter.driver = {};
  let released;
  adapter.pool = { connect: async () => ({ query: async ({ text }) => {
    if (text === "ROLLBACK") throw new Error("rollback failed");
    return { rows: [{ database: "db", version: "18" }] };
  }, release: (error) => { released = error; } }) };
  await assert.rejects(adapter.discoverDatabase(), /cleanup failed/);
  assert.match(released.message, /rollback failed/);
});

test("SQL Server discovery cancels timed-out catalog requests", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const adapter = new SqlServerAdapter({}, {});
  adapter.driver = {};
  let rejectQuery, cancelled = false;
  adapter.connection = { request: () => ({ query: () => new Promise((_resolve, reject) => { rejectQuery = reject; }),
    cancel: () => { cancelled = true; rejectQuery(new Error("catalog cancelled")); } }) };
  const pending = assert.rejects(adapter.discoverDatabase(), /cancelled/);
  t.mock.timers.tick(5000);
  await pending;
  assert.equal(cancelled, true);
});

test("result comparison preserves types, nulls, multiplicity and optional ordering", () => {
  const key = Buffer.alloc(32, 7);
  const hash = (rows, ordered) => resultDigest(rows, key, ordered);
  assert.equal(hash([{ n: null }, { n: "1.00" }]), hash([{ n: "1.00" }, { n: null }]));
  assert.notEqual(hash([{ n: null }]), hash([{ n: "null" }]));
  assert.notEqual(hash([{ n: 1 }]), hash([{ n: "1" }]));
  assert.notEqual(hash([{ n: 1 }, { n: 1 }]), hash([{ n: 1 }]));
  assert.notEqual(hash([{ n: "1.00" }]), hash([{ n: "1.01" }]));
  assert.notEqual(hash([{ n: 1 }, { n: 2 }], true), hash([{ n: 2 }, { n: 1 }], true));
  assert.equal(hash([{ n: new Date("2026-01-01T01:00:00+01:00") }]), hash([{ n: new Date("2026-01-01T00:00:00Z") }]));
  assert.throws(() => hash([{ n: Infinity }]), /Non-finite/);
  assert.throws(() => hash(Array(10001).fill({})), /bound/);
});

test("live replay rejects unqualified scopes, bad contracts and missing semantic coverage before connecting", async (t) => {
  const saved = process.env.CODEXDB_REPLAY_REGISTRY_JSON;
  t.after(() => { if (saved === undefined) delete process.env.CODEXDB_REPLAY_REGISTRY_JSON; else process.env.CODEXDB_REPLAY_REGISTRY_JSON = saved; });
  const args = { systemId: "fixture", environment: "lab", product: "postgres", productVersion: "18", deployment: "local", engine: "postgres", database: "isolated" };
  delete process.env.CODEXDB_REPLAY_REGISTRY_JSON;
  assert.throws(() => replayRegistry(args), /registry/);
  process.env.CODEXDB_REPLAY_REGISTRY_JSON = JSON.stringify({ postgres: { ...args, isolated: true, readOnlyPrincipalReviewed: true, templates: {} } });
  assert.throws(() => replayRegistry({ ...args, environment: "production" }), /lab/);
  assert.throws(() => replayRegistry({ ...args, database: "other" }), /target/);
  await assert.rejects(replayWorkload({}, { ...args, cases: [{ id: "sample", parameters: [], baselineTemplate: "missing", candidateTemplate: "missing" }] }), /allowlisted/);
  await assert.rejects(verifyRewrite({}, args), /coverage/);
});

test("replay executes paired parameters, records mismatches and closes after worker failure", async (t) => {
  const prototype = PostgresAdapter.prototype;
  const saved = { initialize: prototype.initialize, close: prototype.close, registry: process.env.CODEXDB_REPLAY_REGISTRY_JSON };
  let closed = 0;
  t.after(() => {
    prototype.initialize = saved.initialize; prototype.close = saved.close;
    if (saved.registry === undefined) delete process.env.CODEXDB_REPLAY_REGISTRY_JSON;
    else process.env.CODEXDB_REPLAY_REGISTRY_JSON = saved.registry;
  });
  const args = { systemId: "fixture", environment: "lab", product: "postgres", productVersion: "18", deployment: "local", engine: "postgres", database: "isolated" };
  const crypto = require("node:crypto");
  const templates = Object.fromEntries(["SELECT $1 AS value", "SELECT $1 + 1 AS value", "SELECT missing_column"].map((sql, index) => [String(index), { sql,
    sha256: crypto.createHash("sha256").update(sql).digest("hex"), parameterCount: 1, maxRows: 10, reviewedReadOnly: true }]));
  process.env.CODEXDB_REPLAY_REGISTRY_JSON = JSON.stringify({ postgres: { ...args, isolated: true, readOnlyPrincipalReviewed: true, templates } });
  prototype.initialize = async function () {
    this.pool = { query: async () => ({ rows: [{ database_name: "isolated" }] }), connect: async () => ({
      query: async (input) => {
        if (typeof input === "string") return { rows: [] };
        if (input.text.includes("missing_column")) throw new Error("fixture error");
        return { rows: [{ value: input.values[0] + (input.text.includes("+ 1") ? 1 : 0) }] };
      }, release() {},
    }) };
    return { adapter: "postgres_adapter" };
  };
  prototype.close = async () => { closed++; };
  const input = { ...args, concurrency: 2, cases: [{ id: "case", baselineTemplate: "0", candidateTemplate: "0", parameters: [42] }] };
  const matched = await replayWorkload({}, input);
  assert.equal(matched.records.length, 3);
  assert.equal(matched.resultsMatch, true);
  assert.doesNotMatch(JSON.stringify(matched), /"parameters"|"value":42/);
  assert.equal((await replayWorkload({}, { ...input, cases: [{ ...input.cases[0], candidateTemplate: "1" }] })).resultsMatch, false);
  await assert.rejects(replayWorkload({}, { ...input, cases: [{ ...input.cases[0], candidateTemplate: "2" }] }), /Replay failed/);
  assert.equal(closed, 3);
});

test("configured trace collector rejects cross-system evidence before opening database", async (t) => {
  const saved = { fetch: global.fetch, url: process.env.CODEXDB_PROCESS_TRACE_URL, token: process.env.CODEXDB_PROCESS_TRACE_TOKEN };
  t.after(() => {
    global.fetch = saved.fetch;
    for (const [name, value] of [["CODEXDB_PROCESS_TRACE_URL", saved.url], ["CODEXDB_PROCESS_TRACE_TOKEN", saved.token]]) {
      if (value === undefined) delete process.env[name]; else process.env[name] = value;
    }
  });
  process.env.CODEXDB_PROCESS_TRACE_URL = "https://fixture.invalid/traces";
  process.env.CODEXDB_PROCESS_TRACE_TOKEN = "unit-test-only";
  global.fetch = async (_url, options) => {
    assert.equal(options.redirect, "error");
    assert.equal(options.method, "GET");
    return new Response(JSON.stringify({ scope: { systemId: "other" }, spans: [] }), { headers: { "content-type": "application/json" } });
  };
  await assert.rejects(collectProcessEvidence({}, { ...diagnosticScope, engine: "postgres", database: "isolated" }), /scope mismatch/);
});

test("required enterprise approval or witness cannot be bypassed with only a lab HMAC", async (t) => {
  const names = ["CODEXDB_REQUIRE_ENTERPRISE_APPROVAL", "CODEXDB_REQUIRE_AUDIT_WITNESS"];
  const saved = names.map((name) => process.env[name]);
  t.after(() => names.forEach((name, i) => { if (saved[i] === undefined) delete process.env[name]; else process.env[name] = saved[i]; }));
  for (const name of names) {
    for (const key of names) delete process.env[key];
    process.env[name] = "true";
    await migrationFixture(async (calls) => {
      const draft = await dispatch("create_index", { ...migrationScope, executionMode: "dry_run" });
      calls.length = 0;
      const denied = await dispatch("create_index", signedApply(draft));
      assert.equal(denied.applied, false);
      assert.equal(denied.blocked, true);
      assert.equal(calls.length, 0);
    });
  }
});

const diagnosticScope = { systemId: "fixture-system", product: "postgres", productVersion: "18", environment: "lab", deployment: "local" };
function diagnosticPlan(scope = diagnosticScope) {
  return [{ ...scope, id: "compare-traces", readOnly: true, estimatedMinutes: 1, requiresEvidence: [],
    outcomes: [{ id: "database", compatibleHypotheses: ["sql"] }, { id: "application", compatibleHypotheses: ["app"] }] }];
}

test("diagnostic sessions persist results, bind scope and reject replay or stale revisions", (t) => {
  const context = { stateFile: fixture(t) };
  let session = diagnosticSession(context, { ...diagnosticScope, action: "start", objective: "Find fixture latency", hypotheses: ["sql", "app"] }).session;
  session = diagnosticSession(context, { ...diagnosticScope, sessionId: session.id, expectedRevision: session.revision,
    action: "plan_test", tests: diagnosticPlan(), availableEvidence: [] }).session;
  const result = { ...diagnosticScope, sessionId: session.id, expectedRevision: session.revision, action: "record_result",
    planHash: session.plan.inputHash, testId: "compare-traces", observedOutcomeId: "database", observedAt: new Date().toISOString(),
    evidenceRefs: ["actual-trace-fixture-1"], resultScope: diagnosticScope };
  assert.throws(() => diagnosticSession(context, { ...result, resultScope: { ...diagnosticScope, systemId: "wrong" } }), /scope/);
  assert.throws(() => diagnosticSession(context, { ...result, planHash: "wrong" }), /plan/);
  session = diagnosticSession(context, result).session;
  assert.deepEqual(session.hypotheses, ["sql"]);
  assert.equal(session.status, "ready_for_verification");
  assert.throws(() => diagnosticSession(context, result), /revision/);
  assert.equal(diagnosticSession(context, { ...diagnosticScope, sessionId: session.id, action: "read" }).session.revision, 3);
});

test("unexpected diagnostic outcomes retain hypotheses and require model revision", (t) => {
  const context = { stateFile: fixture(t) };
  let session = diagnosticSession(context, { ...diagnosticScope, action: "start", objective: "Unexpected result", hypotheses: ["sql", "app"] }).session;
  session = diagnosticSession(context, { ...diagnosticScope, sessionId: session.id, expectedRevision: session.revision,
    action: "plan_test", tests: diagnosticPlan(), availableEvidence: [] }).session;
  session = diagnosticSession(context, { ...diagnosticScope, sessionId: session.id, expectedRevision: session.revision,
    action: "record_result", planHash: session.plan.inputHash, testId: "compare-traces", observedOutcomeId: "network",
    observedAt: new Date().toISOString(), evidenceRefs: ["actual-trace-fixture-2"], resultScope: diagnosticScope }).session;
  assert.equal(session.status, "model_revision_required");
  assert.deepEqual(session.hypotheses, ["sql", "app"]);
  assert.throws(() => diagnosticSession(context, { ...diagnosticScope, sessionId: session.id,
    expectedRevision: session.revision, action: "plan_test", tests: diagnosticPlan(), availableEvidence: [] }), /model/);
});

test("recommendation validity checks drift, age and explicit invalidation", (t) => {
  const context = { stateFile: fixture(t) };
  const c = advisoryCase(context, { ...diagnosticScope, action: "create", objective: "Validity fixture" }).case;
  const fingerprint = { schemaHash: "a".repeat(64), dataProfileHash: "b".repeat(64), loadProfileHash: "c".repeat(64),
    configurationHash: "d".repeat(64), deployment: "local" };
  // Synthetic reviewed record isolates validity logic from benchmark generation.
  withState(context.stateFile, (db) => {
    const review = { decision: "repeatable_observed_improvement", businessIntegrity: { decision: "matched_supplied_controls" }, lastCapturedAt: new Date().toISOString() };
    c.status = "closed"; c.review = { outcome: "confirmed" }; c.proposal = { validityContext: fingerprint, validityHours: 24 };
    c.verification = review; c.followUp = review;
    db.prepare("UPDATE advisory_cases SET value=? WHERE id=?").run(JSON.stringify(c), c.id);
  });
  const args = { ...diagnosticScope, caseId: c.id, action: "check", validityContext: fingerprint };
  assert.equal(recommendationValidity(context, args).status, "within_recorded_validity");
  assert.ok(recommendationValidity(context, { ...args, validityContext: { ...fingerprint, loadProfileHash: "e".repeat(64) } }).reasons.includes("loadProfileHash_changed"));
  assert.ok(recommendationValidity(context, { ...args, action: "invalidate", expectedRevision: 1, reason: "Operator reported changed workload" }).reasons.includes("recommendation_invalidated"));
  assert.throws(() => recommendationValidity(context, { ...args, action: "invalidate", expectedRevision: 1, reason: "stale" }), /revision/);
});

test("verified approval nonce is consumed once even if another receipt reuses it", (t) => {
  const context = { stateFile: fixture(t) };
  const receipt = { authorized: true, receiptHash: "a".repeat(64), issuer: "fixture", nonce: "once", expiresAt: new Date(Date.now() + 60000).toISOString() };
  assert.equal(consumeAdminApproval(context, receipt).consumed, true);
  assert.equal(consumeAdminApproval(context, { ...receipt, receiptHash: "b".repeat(64) }).consumed, false);
});

async function migrationFixture(fn) {
  const prototype = PostgresAdapter.prototype;
  const saved = { initialize: prototype.initialize, executeSql: prototype.executeSql, close: prototype.close,
    key: process.env.CODEXDB_MIGRATION_SIGNING_KEY };
  const calls = [];
  process.env.CODEXDB_MIGRATION_SIGNING_KEY = "local-unit-test-only-not-a-production-key";
  prototype.initialize = async function () {
    calls.push("connect"); this.driver = {}; this.pool = { query: async () => ({ rows: [{ database_name: "testdb" }] }) };
    return { adapter: "postgres_adapter" };
  };
  prototype.executeSql = async (sql, options) => { calls.push({ sql, options }); return { executed: true, source: "live", affectedRows: 0 }; };
  prototype.close = async () => {};
  try { await fn(calls, prototype); }
  finally {
    Object.assign(prototype, { initialize: saved.initialize, executeSql: saved.executeSql, close: saved.close });
    if (saved.key === undefined) delete process.env.CODEXDB_MIGRATION_SIGNING_KEY;
    else process.env.CODEXDB_MIGRATION_SIGNING_KEY = saved.key;
  }
}

const migrationScope = { engine: "postgres", database: "testdb", schema: "public", table: "orders", environment: "lab", actor: "dba" };
function signedApply(draft, scope = migrationScope) {
  return { ...scope, executionMode: "apply", migrationSignature: draft.migrationSignature,
    migrationSignedAt: draft.migrationSignedAt, migrationSigningExpiresAt: draft.migrationSigningExpiresAt };
}

test("migration signature, scope and timestamp tampering are blocked before opening a database", async () => {
  await migrationFixture(async (calls) => {
    const draft = await dispatch("create_index", { ...migrationScope, executionMode: "dry_run" });
    assert.equal(draft.applied, false);
    for (const change of [
      { migrationSignature: "f".repeat(64) }, { migrationSignature: undefined }, { database: "different" },
      { connectionProfile: "different" }, { table: "other" }, { actor: "developer" },
      { migrationSignedAt: undefined }, { migrationSigningExpiresAt: "invalid" },
      { migrationSigningExpiresAt: new Date(Date.now() + 60000).toISOString() },
      { migrationSigningExpiresAt: new Date(Date.now() - 10000).toISOString() },
    ]) {
      const result = await dispatch("create_index", { ...signedApply(draft), ...change });
      assert.equal(result.blocked, true, JSON.stringify(change));
      assert.notEqual(result.applied, true);
    }
    assert.deepEqual(calls, []);
  });
});

test("signed lab index executes only after signature validation and validation is read-only", async () => {
  await migrationFixture(async (calls) => {
    const draft = await dispatch("create_index", { ...migrationScope, executionMode: "dry_run" });
    const result = await dispatch("create_index", signedApply(draft));
    assert.equal(result.applied, true);
    assert.equal(result.validation.allPassed, true);
    const statements = calls.filter((call) => typeof call === "object");
    assert.equal(statements[0].sql, 'CREATE INDEX "idx_orders_created_at" ON "public"."orders"("created_at");');
    assert.equal(statements[1].options.isMigration, false);
  });
});

test("configured trusted admin approval blocks absent receipts and prevents execution replay", async () => {
  const crypto = require("node:crypto");
  const { serializeAdminApprovalPayload } = require("../runtime/policyEngine");
  const previous = process.env.CODEXDB_APPROVAL_TRUST_JSON;
  const keys = crypto.generateKeyPairSync("ed25519");
  process.env.CODEXDB_APPROVAL_TRUST_JSON = JSON.stringify({ fixture: { publicKey: keys.publicKey.export({ type: "spki", format: "pem" }),
    issuer: "fixture", subjects: ["dba"], approvers: ["reviewer"] } });
  try {
    await migrationFixture(async (calls) => {
      const draft = await dispatch("create_index", { ...migrationScope, executionMode: "dry_run" });
      const denied = await dispatch("create_index", signedApply(draft));
      assert.equal(denied.blocked, true);
      assert.deepEqual(calls, []);
      const payload = { issuer: "fixture", subject: "dba", approver: "reviewer", role: "dba_approver", tool: "create_index",
        engine: "postgres", environment: "lab", connectionProfile: "postgres", database: "testdb", schema: "public",
        statementHash: draft.actionFingerprint, issuedAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 60000).toISOString(), nonce: crypto.randomUUID() };
      const receipt = { keyId: "fixture", payload, signature: crypto.sign(null, Buffer.from(serializeAdminApprovalPayload(payload)), keys.privateKey).toString("base64url") };
      const args = { ...signedApply(draft), adminApprovalReceipt: receipt };
      assert.equal((await dispatch("create_index", args)).applied, true);
      const count = calls.length;
      assert.equal((await dispatch("create_index", args)).status, "approval_already_consumed");
      assert.equal(calls.length, count);
    });
  } finally {
    if (previous === undefined) delete process.env.CODEXDB_APPROVAL_TRUST_JSON;
    else process.env.CODEXDB_APPROVAL_TRUST_JSON = previous;
  }
});

test("mock and failed migration results cannot claim applied or run validation", async () => {
  await migrationFixture(async (calls, prototype) => {
    const draft = await dispatch("create_index", { ...migrationScope, executionMode: "dry_run" });
    for (const response of [{ executed: false, source: "mock" }, { executed: false, source: "live_error", error: "execution_failed" }]) {
      prototype.executeSql = async () => response;
      const result = await dispatch("create_index", signedApply(draft));
      assert.equal(result.applied, false);
      assert.equal(result.validation.allPassed, false);
      assert.deepEqual(result.validation.validations, []);
    }
    assert.equal(calls.length, 2);
  });
});

test("migration applies require supported modes, live scope, a signing key and lab boundary", async () => {
  await migrationFixture(async (calls) => {
    const draft = await dispatch("create_index", { ...migrationScope, executionMode: "dry_run" });
    for (const change of [{ executionMode: "execute" }, { environment: "production" }, { schema: undefined }]) {
      const result = await dispatch("create_index", { ...signedApply(draft), ...change });
      assert.equal(result.blocked, true);
      assert.equal(result.applied, false);
    }
    delete process.env.CODEXDB_MIGRATION_SIGNING_KEY;
    const unsigned = await dispatch("create_index", signedApply(draft));
    assert.equal(unsigned.status, "migration_signing_key_missing");
    assert.deepEqual(calls, []);
  });
});

test("index drafts use SQL Server syntax and reject unsafe identifiers or arbitrary rollback SQL", async () => {
  const draft = await dispatch("create_index", { ...migrationScope, engine: "sqlserver", schema: "dbo", executionMode: "dry_run" });
  assert.equal(draft.indexStatement, "CREATE INDEX [idx_orders_created_at] ON [dbo].[orders]([created_at]);");
  await assert.rejects(dispatch("create_index", { ...migrationScope, table: "orders;DROP" }), /identifiers/);
  await assert.rejects(dispatch("rollback_migration", { ...migrationScope, rollbackSql: "DROP TABLE orders;" }), /scoped index/);
  const rollback = await dispatch("rollback_migration", { ...migrationScope, executionMode: "dry_run" });
  assert.equal(rollback.rollbackExecuted, false);
  assert.equal(rollback.verificationResult, "not_verified");
});

test("temporary PostgreSQL rehearsal verifies writes, expected failure, savepoint and cleanup", async () => {
  const calls = [];
  const result = await exerciseRollbackSession("postgres", async (sql) => {
    calls.push(sql);
    if (/VALUES \(1, 99\)/.test(sql)) throw Object.assign(new Error("fixture duplicate"), { code: "23505" });
    if (/SELECT id, amount/.test(sql)) return { rows: [{ id: 1, amount: 11 }] };
    if (/to_regclass/.test(sql)) return { rows: [{ remaining_table: null }] };
    return { rows: [] };
  });
  assert.equal(result.productionMigrationQualified, false);
  assert.equal(result.businessDataTouched, false);
  assert.ok(calls.includes("ROLLBACK TO SAVEPOINT before_expected_error"));
  assert.equal(calls.filter((sql) => sql === "ROLLBACK").length, 1);
  assert.match(calls[2], /^CREATE TEMP TABLE codexdb_rehearsal_[a-f0-9]+ /);
});

test("temporary PostgreSQL rehearsal rolls back on failed assertions or unexpected SQL errors", async () => {
  const calls = [];
  await assert.rejects(exerciseRollbackSession("postgres", async (sql) => {
    calls.push(sql);
    if (sql.startsWith("UPDATE")) throw new Error("unexpected fixture error");
    return { rows: [] };
  }), /unexpected fixture error/);
  assert.equal(calls.at(-1), "ROLLBACK");
});

test("temporary SQL Server rehearsal requires the batch's explicit rollback confirmation", async () => {
  let batch;
  const result = await exerciseRollbackSession("sqlserver", async (sql) => {
    batch = sql;
    return { recordset: [{ rollback_verified: 1, remaining_transactions: 0 }] };
  });
  assert.equal(result.status, "passed");
  assert.match(batch, /CREATE TABLE #codexdb_rehearsal_[a-f0-9]+/);
  assert.match(batch, /IF ERROR_NUMBER\(\) <> 2627 THROW/);
  assert.match(batch, /IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION/);
  await assert.rejects(exerciseRollbackSession("sqlserver", async () => ({ recordset: [] })));
  await assert.rejects(exerciseRollbackSession("mysql", async () => ({})), /Unsupported/);
});

test("admin preflight refuses missing scope and mock-only profiles", async () => {
  await assert.rejects(adminPreflight({}, { engine: "postgres" }), /explicit engine and database/);
  const result = await adminPreflight({}, { engine: "postgres", database: "postgres", connectionProfile: "unconfigured_preflight_fixture" });
  assert.equal(result.status, "blocked");
  assert.equal(result.executionAuthorized, false);
  assert.equal(result.productionReady, false);
  assert.deepEqual(result.checks, []);
});

test("admin probes isolate failures and distinguish empty observations from healthy state", async () => {
  const checks = await probeAdminCapabilities({
    queryStats: async () => ({ source: "live_error", error: "pg_stat_statements_unavailable" }),
    lockAnalysis: async () => { throw Object.assign(new Error("secret connection payload"), { code: "42501" }); },
    indexUsage: async () => ({ source: "live", indexes: [] }),
  });
  assert.equal(checks[0].reason, "pg_stat_statements_unavailable");
  assert.equal(checks[1].reason, "insufficient_permissions");
  assert.equal(checks[2].status, "available_no_rows");
  assert.doesNotMatch(JSON.stringify(checks), /secret connection payload/);
});

test("admin probes report supported collectors without promising percentile coverage", async () => {
  const checks = await probeAdminCapabilities({
    queryStats: async () => [{ p95Ms: null, source: "live" }],
    lockAnalysis: async () => ({ topWaiters: [], source: "live" }),
    indexUsage: async () => ({ indexes: [{ name: "pk" }], source: "live" }),
  });
  assert.equal(checks[0].status, "available");
  assert.equal(checks[0].p95Available, false);
  assert.equal(checks[2].observedRows, 1);
});

test("Postgres statistics preserve measured precision and never invent percentile or CPU evidence", async () => {
  const adapter = new PostgresAdapter({}, {});
  let released = false;
  adapter.driver = {};
  adapter.pool = { connect: async () => ({ query: async (sql) => {
    assert.match(sql, /WHERE dbid = .*current_database/);
    return { rows: [{ queryid: "123", mean_exec_time: 0.125, total_exec_time: 0.25,
      calls: "2", rows: "0", shared_blks_read: "1", shared_blks_hit: "20" }] };
  }, release: () => { released = true; } }) };
  const [row] = await adapter.queryStats();
  assert.equal(row.avgMs, 0.125);
  assert.equal(row.totalElapsedMs, 0.25);
  assert.equal(row.p95Ms, null);
  assert.equal(row.cpuMs, null);
  assert.equal(row.regressionScore, null);
  assert.equal(row.ioWait, "unknown");
  assert.equal(row.sharedBlocksRead, 1);
  assert.equal(row.source, "live");
  assert.equal(row.metricEvidence.unavailable.p95Ms, "requires_execution_samples");
  assert.equal(released, true);
});

test("SQL Server statistics use elapsed and worker units without inventing p95 or regression", async () => {
  const adapter = new SqlServerAdapter({}, {});
  adapter.driver = {};
  adapter.connection = { request: () => ({ query: async (sql) => {
    assert.match(sql, /pa.attribute = 'dbid'.*DB_ID\(\)/);
    return { recordset: [0, 20].map((offset) => ({ plan_handle: Buffer.from("abcd", "hex"),
      statement_start_offset: offset, statement_end_offset: offset + 10,
      execution_count: 2, total_elapsed_time: 250, total_worker_time: 100 })) };
  } }) };
  const rows = await adapter.queryStats();
  assert.equal(rows[0].avgMs, 0.125);
  assert.equal(rows[0].cpuMs, 0.05);
  assert.equal(rows[0].totalElapsedMs, 0.25);
  assert.equal(rows[0].executionCount, 2);
  assert.equal(rows[0].p95Ms, null);
  assert.equal(rows[0].regressionScore, null);
  assert.notEqual(rows[0].queryId, rows[1].queryId);
});

test("Postgres unavailable statistics release the session and do not return sample results", async () => {
  const adapter = new PostgresAdapter({}, {});
  let released = false;
  adapter.driver = {};
  adapter.pool = { connect: async () => ({ query: async () => {
    throw new Error("pg_stat_statements does not exist");
  }, release: () => { released = true; } }) };
  const result = await adapter.queryStats();
  assert.equal(result.error, "pg_stat_statements_unavailable");
  assert.deepEqual(result.queryStats, []);
  assert.equal(result.source, "live_error");
  assert.equal(released, true);
});

test("SQL Server column metadata qualifies the joined name column", async () => {
  const adapter = new SqlServerAdapter({}, {});
  const queries = [];
  const request = { input() { return this; }, async query(sql) {
    queries.push(sql);
    return { recordset: sql.includes("sys.columns") ? [{ name: "order_id" }] : [] };
  } };
  adapter.driver = { VarChar: "varchar" };
  adapter.connection = { request: () => request };
  const result = await adapter.describeTable({ database: "test", schema: "dbo", table: "orders" });
  assert.match(queries[0], /^SELECT c\.name FROM sys\.columns/);
  assert.deepEqual(result.sampleColumns, [{ name: "order_id" }]);
});

test("unsupported SQL engines never fall through to SQL Server", async () => {
  await assert.rejects(createAdapter({}, { engine: "mysql" }), /Unsupported database engine/);
  await assert.rejects(createAdapter({}, { engine: "hana" }), /Unsupported database engine/);
});

test("database scope mismatch closes the connection before any workload runs", async () => {
  let closed = false;
  const adapter = { initialize: async () => ({ adapter: "postgres_adapter" }),
    pool: { query: async () => ({ rows: [{ database_name: "other_database" }] }) },
    close: async () => { closed = true; } };
  await assert.rejects(initializeScoped(adapter, "postgres", "requested_database"), /does not match/);
  assert.equal(closed, true);
});

function fixture(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "codexdb-resilience-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return path.join(dir, "runtime-state.json");
}

test("parallel audit writers create one ordered chain with no lost rows", async (t) => {
  const file = fixture(t);
  const code = `const {appendAuditEvent,buildEvent}=require(process.argv[1]);
    for(let i=0;i<20;i++)appendAuditEvent(process.argv[2],buildEvent({tool:'parallel-test'}));`;
  const writers = await Promise.allSettled(Array.from({ length: 6 }, () =>
    promisify(execFile)(process.execPath, ["-e", code, require.resolve("../runtime/auditLogger"), file])));
  for (const writer of writers) if (writer.status === "rejected") throw writer.reason;
  const result = verifyAudit(file);
  assert.equal(result.status, "verified");
  assert.equal(result.records, 120);
  assert.equal(new Set(readReplayLog(file).map((row) => row.replayId)).size, 120);
});

test("killed writer rolls back and leaves state writable", async (t) => {
  const file = fixture(t);
  appendAuditEvent(file, buildEvent({ tool: "committed" }));
  const code = `const {DatabaseSync}=require('node:sqlite'); const d=new DatabaseSync(process.argv[1]);
    d.exec('BEGIN IMMEDIATE');d.prepare('INSERT INTO memory(category,value) VALUES(?,?)').run('crash','{}');
    process.stdout.write('ready');setInterval(()=>{},1000);`;
  const child = spawn(process.execPath, ["-e", code, `${file}.sqlite`], { windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
  const exited = new Promise((resolve) => child.once("exit", resolve));
  try {
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("Crash test startup timed out")), 10000);
      child.once("error", (e) => { clearTimeout(timeout); reject(e); });
      child.once("exit", () => { clearTimeout(timeout); reject(new Error("Writer exited before ready")); });
      child.stdout.once("data", () => { clearTimeout(timeout); resolve(); });
    });
  } finally {
    child.kill("SIGKILL");
    await exited;
  }
  assert.deepEqual(recall({ stateFile: file }, "crash"), []);
  remember({ stateFile: file }, "after", { recovered: true });
  appendAuditEvent(file, buildEvent({ tool: "recovered" }));
  assert.equal(verifyAudit(file).status, "verified");
  assert.equal(verifyAudit(file).records, 2);
});

test("legacy state migrates once without modifying original files", (t) => {
  const file = fixture(t);
  const legacyMemory = JSON.stringify({ advisorFeedback: [{ id: "old", improved: true }] });
  fs.writeFileSync(path.join(path.dirname(file), "memory.json"), legacyMemory);
  const event = { id: "audit-old", tool: "legacy" };
  fs.writeFileSync(file, JSON.stringify(event) + "\n");
  fs.writeFileSync(path.join(path.dirname(file), "replay.jsonl"), JSON.stringify({ ...event, replayId: "replay-old", previousReplayId: null }) + "\n");
  assert.equal(recall({ stateFile: file }, "advisorFeedback").length, 1);
  assert.equal(recall({ stateFile: file }, "advisorFeedback").length, 1);
  appendAuditEvent(file, buildEvent({ tool: "new" }));
  assert.equal(verifyAudit(file).records, 2);
  assert.equal(verifyAudit(file).status, "verified");
  assert.equal(fs.readFileSync(path.join(path.dirname(file), "memory.json"), "utf8"), legacyMemory);
});

test("damaged legacy audit fails explicitly rather than losing history", (t) => {
  const file = fixture(t);
  fs.writeFileSync(file, '{"id":"incomplete');
  assert.throws(() => appendAuditEvent(file, buildEvent({ tool: "test" })), /invalid/);
  assert.equal(fs.readFileSync(file, "utf8"), '{"id":"incomplete');
});

test("audit redacts credentials in keys and diagnostic strings", (t) => {
  const file = fixture(t);
  const result = appendAuditEvent(file, buildEvent({ tool: "test", payload: {
    authorization: "private-value", connectionString: "private-connection",
    message: "Bearer private-bearer password=private-password postgres://user:private-pwd@host/db",
    parameters: ["private-customer-parameter"],
  } }));
  assert.doesNotMatch(JSON.stringify(result), /private-/);
  assert.equal(verifyAudit(file).status, "verified");
});

for (const failureAt of ["SELECT", "OFF"]) {
  test(`SQL Server releases or quarantines its session after ${failureAt} failure`, async () => {
    const calls = [];
    const adapter = new SqlServerAdapter({}, {});
    adapter.connection = { async close() { calls.push("CLOSE"); } };
    adapter.driver = {
      Transaction: class { async begin() { calls.push("BEGIN"); } async rollback() { calls.push("ROLLBACK"); } },
      Request: class { async batch(sql) {
        calls.push(sql);
        if (sql.includes(failureAt)) throw new Error("intentional failure");
        return { recordset: [{ ShowPlanXML: "<ShowPlanXML />" }] };
      } },
    };
    await assert.rejects(adapter.explainQuery({ sql: "SELECT 1" }), /intentional/);
    assert.ok(calls.includes("SET SHOWPLAN_XML OFF"));
    assert.ok(calls.includes("ROLLBACK"));
    assert.equal(calls.includes("CLOSE"), failureAt === "OFF");
  });
}
