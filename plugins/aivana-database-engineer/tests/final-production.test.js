const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { dispatch } = require("../runtime/orchestrator");
const crypto = require("node:crypto");
const { verifyAdminApproval, serializeAdminApprovalPayload, verifyEnterpriseApproval, verifyEnterpriseAuditWitness } = require("../runtime/policyEngine");
const { SqliteAdapter, MySqlAdapter } = require("../runtime/db/baseAdapter");
const { operationalWindowCompare } = require("../runtime/memoryLayer");

function operationalFixture(engine = "postgres") {
  const scope = { engine, systemId: "db-system-1", database: "erp" };
  const counter = (metric, unit, start, end) => ({ metric, unit,
    start: { value: start, counterEpoch: "boot-1" }, end: { value: end, counterEpoch: "boot-1" } });
  return { ...scope,
    before: { ...scope, start: "2026-01-01T00:00:00.000Z", end: "2026-01-01T00:01:00.000Z",
      metrics: [counter("execution_count", "count", 100, 220), counter("elapsed_time", "ms", 1000, 1600), counter("cpu_time", "ms", 100, 220)],
      queries: [{ queryId: "query-1", metrics: [counter("execution_count", "count", 10, 70)] }] },
    after: { ...scope, start: "2026-01-01T00:02:00.000Z", end: "2026-01-01T00:03:00.000Z",
      metrics: [counter("execution_count", "count", 250, 430), counter("elapsed_time", "ms", 1700, 2000), counter("cpu_time", "ms", 240, 480)],
      queries: [{ queryId: "query-1", metrics: [counter("execution_count", "count", 80, 200)] }] },
    slo: [{ metric: "execution_count", unit: "count/s", aggregation: "rate", operator: "gte", threshold: 2.5 }],
  };
}

test("operational windows compare real counter differences without causal or percentile claims", () => {
  for (const engine of ["sqlserver", "postgres", "mysql", "mariadb"]) {
    const input = operationalFixture(engine);
    const snapshot = JSON.stringify(input);
    const result = operationalWindowCompare(input);
    assert.equal(result.status, "comparable_observations");
    assert.equal(result.source, "supplied_evidence");
    assert.equal(result.durationSeconds, 60);
    assert.equal(result.metrics[0].beforeDelta, 120);
    assert.equal(result.metrics[0].afterDelta, 180);
    assert.equal(result.metrics[0].beforeRate, 2);
    assert.equal(result.metrics[0].afterRate, 3);
    assert.equal(result.metrics[1].afterDelta, 300);
    assert.equal(result.metrics[2].afterDelta, 240);
    assert.equal(result.queries[0].metrics[0].afterRate, 2);
    assert.equal(result.slo[0].beforeMeets, false);
    assert.equal(result.slo[0].afterMeets, true);
    assert.equal(result.causalityEstablished, false);
    assert.equal(result.improvementEstablished, false);
    assert.equal(result.backgroundMonitoring, false);
    assert.equal(result.executionAuthorized, false);
    assert.equal(JSON.stringify(input), snapshot);
    assert.ok(!JSON.stringify(result).includes("p95"));
  }
});

test("operational windows reject mismatched scopes, times, units, unsafe counters and limits", () => {
  const mutations = [
    ...["engine", "systemId", "database"].map((key) => (a) => { a.after[key] = "different"; }),
    (a) => { a.engine = a.before.engine = a.after.engine = "sqlite"; },
    (a) => { delete a.before.systemId; },
    (a) => { a.after.end = "2026-01-01T00:04:00.000Z"; },
    (a) => { a.before.end = a.before.start; },
    (a) => { a.after.start = a.before.start; a.after.end = a.before.end; },
    (a) => { a.after.start = "invalid"; },
    (a) => { a.after.start = "2026-01-01T00:02:00Z"; },
    (a) => { a.after.start = "2099-01-01T00:00:00.000Z"; a.after.end = "2099-01-01T00:01:00.000Z"; },
    (a) => { a.after.metrics[0].unit = "ms"; },
    (a) => { a.after.metrics[0].metric = "p95"; },
    (a) => { a.after.metrics[0].end.value = -1; },
    (a) => { a.after.metrics[0].end.value = 1.5; },
    (a) => { a.after.metrics[0].end.value = Number.MAX_SAFE_INTEGER + 1; },
    (a) => { a.after.metrics[0].end.value = Infinity; },
    (a) => { a.after.metrics[0].end.value = "430"; },
    (a) => { a.after.metrics[0].end.counterEpoch = ""; },
    (a) => { a.after.metrics.push(a.after.metrics[0]); },
    (a) => { a.after.queries.push(a.after.queries[0]); },
    (a) => { a.before.metrics = Array(1001).fill(a.before.metrics[0]); },
    (a) => { a.padding = "x".repeat(2 * 1024 * 1024); },
    (a) => { a.slo[0].threshold = NaN; },
    (a) => { a.slo[0].threshold = -1; },
    (a) => { a.slo[0].unit = "count"; },
    (a) => { a.slo[0].operator = "approximately"; },
    (a) => { a.slo.push(a.slo[0]); },
    (a) => { a.slo[0].queryId = ""; },
  ];
  for (const mutate of mutations) {
    const args = operationalFixture(); mutate(args);
    const result = operationalWindowCompare(args);
    assert.equal(result.status, "insufficient_evidence", mutate.toString());
    assert.equal(result.comparable, false);
    assert.ok(result.reasonCodes.length > 0);
  }
  for (const args of [null, undefined, {}, { self: null }]) assert.equal(operationalWindowCompare(args).comparable, false);
  const circular = operationalFixture(); circular.self = circular;
  assert.equal(operationalWindowCompare(circular).comparable, false);
});

test("operational resets and missing query IDs remain explicit insufficient evidence", () => {
  for (const mutate of [
    (a) => { a.after.metrics[0].end.value = 10; },
    (a) => { a.after.metrics[0].start.value = 1; },
    (a) => { a.before.metrics[0].end.counterEpoch = "boot-2"; },
    (a) => { a.after.metrics[0].start.counterEpoch = a.after.metrics[0].end.counterEpoch = "boot-2"; },
    (a) => { a.after.start = a.before.end; a.after.end = "2026-01-01T00:02:00.000Z"; },
  ]) {
    const input = operationalFixture(); mutate(input);
    const result = operationalWindowCompare(input);
    assert.equal(result.status, "insufficient_evidence");
    assert.equal(result.metrics[0].status, "insufficient_evidence");
    assert.equal(result.metrics[0].afterRate, undefined);
    assert.equal(result.slo[0].status, "not_evaluated");
  }
  const missing = operationalFixture();
  missing.after.queries[0].queryId = "query-2";
  missing.after.metrics.pop();
  const result = operationalWindowCompare(missing);
  assert.deepEqual(result.missingQueries, { before: ["query-2"], after: ["query-1"] });
  assert.equal(result.metrics.find((row) => row.metric === "cpu_time").reason, "metric_missing");
  assert.ok(result.queries.every((row) => row.reason === "query_missing" && !row.metrics.length));
  const empty = operationalFixture();
  empty.before.metrics = empty.after.metrics = []; empty.before.queries = empty.after.queries = [];
  assert.equal(operationalWindowCompare(empty).status, "insufficient_evidence");
  const querySlo = operationalFixture();
  querySlo.slo = [{ queryId: "query-1", metric: "execution_count", unit: "count", aggregation: "delta", operator: "lte", threshold: 100 },
    { queryId: "missing", metric: "execution_count", unit: "count", aggregation: "delta", operator: "lte", threshold: 100 }];
  const assessed = operationalWindowCompare(querySlo);
  assert.equal(assessed.slo[0].beforeMeets, true);
  assert.equal(assessed.slo[0].afterMeets, false);
  assert.equal(assessed.slo[1].status, "not_evaluated");
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

test("production advisor blocks when live evidence is required but unavailable", async () => {
  await withEnv({
    CODEXDB_REQUIRE_LIVE_CONNECTION: "true",
    CODEXDB_POSTGRES_CONNECTION_STRING: undefined,
    CODEXDB_CONNECTION_STRING: undefined,
  }, async () => {
    const result = await dispatch("sql_performance_advisor", {
      environment: "production",
      engine: "postgres",
      database: "analytics",
      sql: "SELECT * FROM events",
    });

    assert.equal(result.blocked, true);
    assert.equal(result.status, "live_evidence_required");
    assert.ok(result.blockedReason.includes("mock_evidence_not_allowed"));
  });
});

test("plan_deep_diagnostics detects cardinality, scan, stale stats, and spill risks", async () => {
  const result = await dispatch("plan_deep_diagnostics", {
    engine: "postgres",
    plan: {
      "Node Type": "Seq Scan",
      "Plan Rows": 100,
      "Actual Rows": 50000,
      "Temp Read Blocks": 20,
      "Relation Name": "events",
    },
  });

  assert.equal(result.usp, "plan_deep_diagnostics");
  assert.ok(result.findings.some((finding) => finding.id === "cardinality_misestimation"));
  assert.ok(result.findings.some((finding) => finding.id === "sequential_scan"));
  assert.ok(result.findings.some((finding) => finding.id === "temp_spill_risk"));
});

test("connector action tools prepare real outbound requests without secrets in output", async () => {
  await withEnv({
    CODEXDB_GRAFANA_URL: "https://grafana.example.test",
    CODEXDB_GRAFANA_TOKEN: "secret-token",
    CODEXDB_PROMETHEUS_URL: "https://prom.example.test",
    CODEXDB_NEO4J_URI: "bolt://neo4j.example.test:7687",
    CODEXDB_NEO4J_USER: "neo4j",
    CODEXDB_NEO4J_PASSWORD: "secret-password",
  }, async () => {
    const grafana = await dispatch("grafana_annotation_export", { incidentId: "inc-1", text: "slow query" });
    const prometheus = await dispatch("prometheus_connector_ingest", { query: "rate(db_qps[5m])" });
    const neo4j = await dispatch("neo4j_graph_export", { graphName: "schema" });

    assert.equal(grafana.status, "ready_to_send");
    assert.equal(grafana.request.headers.Authorization, "***redacted***");
    assert.equal(prometheus.status, "configured");
    assert.ok(prometheus.request.url.includes("query="));
    assert.equal(neo4j.status, "configured");
    assert.equal(neo4j.connection.password, "***redacted***");
  });
});

test("packaging and first-run artifacts exist", () => {
  const root = path.resolve(__dirname, "..");
  const required = [
    ".env.example",
    "CHANGELOG.md",
    "FIRST_RUN.md",
    "RELEASE_CHECKLIST.md",
    "scripts/plugin-readiness-report.js",
  ];

  for (const file of required) {
    assert.equal(fs.existsSync(path.join(root, file)), true, `${file} should exist`);
  }
  assert.equal(fs.existsSync(path.resolve(root, "..", "..", ".github/workflows/ci.yml")), true);
});

test("all skill docs use the exact SKILL.md installer filename", () => {
  const skillsRoot = path.resolve(__dirname, "..", "skills");
  const offenders = [];

  for (const entry of fs.readdirSync(skillsRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const files = fs.readdirSync(path.join(skillsRoot, entry.name), { withFileTypes: true });
    const hasExactSkillDoc = files.some((file) => file.isFile() && file.name === "SKILL.md");
    if (!hasExactSkillDoc) {
      offenders.push(entry.name);
    }
  }

  assert.deepEqual(offenders, []);
});

test("admin approval verifies only scoped Ed25519 issuer attestations", async () => {
  const { publicKey, privateKey } = crypto.generateKeyPairSync("ed25519");
  const other = crypto.generateKeyPairSync("ed25519");
  const now = Date.now();
  const payload = {
    issuer: "test-issuer", subject: "initiator", approver: "reviewer", role: "dba_approver",
    tool: "create_index", engine: "postgres", environment: "production", connectionProfile: "postgres-primary", database: "analytics", schema: "public",
    statementHash: crypto.createHash("sha256").update("CREATE INDEX test ON events(id)").digest("hex"),
    issuedAt: new Date(now - 1000).toISOString(), expiresAt: new Date(now + 60000).toISOString(), nonce: "test-nonce",
  };
  const signed = (value = payload, key = privateKey) => ({
    keyId: "ephemeral", payload: value,
    signature: crypto.sign(null, Buffer.from(serializeAdminApprovalPayload(value)), key).toString("base64url"),
  });
  const args = {
    receipt: signed(), actor: { subject: "initiator" }, tool: payload.tool,
    environment: payload.environment, connectionProfile: payload.connectionProfile,
    engine: payload.engine, database: payload.database, schema: payload.schema, statementHash: payload.statementHash,
  };
  const entry = { publicKey: publicKey.export({ type: "spki", format: "pem" }), issuer: payload.issuer, subjects: [payload.subject], approvers: [payload.approver] };
  const check = (input, reason) => {
    const result = verifyAdminApproval(input);
    assert.equal(result.authorized, false);
    if (reason) assert.equal(result.reason, reason);
    else assert.equal(typeof result.reason, "string");
  };
  await withEnv({ CODEXDB_APPROVAL_TRUST_JSON: JSON.stringify({ ephemeral: entry }) }, async () => {
    const result = verifyAdminApproval(args);
    assert.equal(result.authorized, true);
    assert.match(result.receiptHash, /^[a-f0-9]{64}$/);
    assert.equal(result.nonce, payload.nonce);
    assert.equal(result.expiresAt, payload.expiresAt);
    assert.equal(result.subject, payload.subject);
    assert.equal(result.approver, payload.approver);
    assert.equal(result.issuer, payload.issuer);
    assert.equal(result.productionAuthorization, false);
    assert.equal(result.provenance, "cryptographic_trusted_issuer_attestation_not_independent_IdP_login");
    assert.deepEqual(verifyAdminApproval({ ...args, actor: payload.subject }), result);
    const reordered = Object.fromEntries(Object.entries(payload).reverse());
    assert.equal(serializeAdminApprovalPayload(reordered), JSON.stringify(payload));
    assert.deepEqual(verifyAdminApproval({ ...args, receipt: signed(reordered) }), result);
    check({ ...args, receipt: signed(payload, other.privateKey), publicKey: other.publicKey.export({ type: "spki", format: "pem" }) }, "approval_invalid_signature");
    for (const field of ["tool", "engine", "environment", "connectionProfile", "database", "schema", "statementHash"]) {
      check({ ...args, [field]: "different" }, "approval_scope_mismatch");
      check({ ...args, [field]: undefined }, "approval_scope_mismatch");
    }
    for (const field of ["environment", "connectionProfile"]) {
      const missing = { ...payload };
      delete missing[field];
      assert.throws(() => serializeAdminApprovalPayload(missing), /malformed_approval_payload/);
      check({ ...args, receipt: { ...args.receipt, payload: missing } }, "malformed_approval_input");
      for (const invalid of ["", " padded ", null]) {
        check({ ...args, [field]: invalid }, "approval_scope_mismatch");
        check({ ...args, receipt: { ...args.receipt, payload: { ...payload, [field]: invalid } } }, "malformed_approval_input");
      }
      const changed = { ...payload, [field]: "another-scope" };
      check({ ...args, receipt: signed(changed) }, "approval_scope_mismatch");
      check({ ...args, [field]: changed[field], receipt: { ...args.receipt, payload: changed } }, "approval_invalid_signature");
      assert.equal(verifyAdminApproval({ ...args, [field]: changed[field], receipt: signed(changed) }).authorized, true);
    }
    check({ ...args, actor: "someone-else" }, "approval_identity_mismatch");
    check({ ...args, actor: { role: "dba_approver" } }, "approval_identity_mismatch");
    check({ ...args, receipt: signed({ ...payload, approver: payload.subject }) }, "approval_identity_mismatch");
    check({ ...args, receipt: signed({ ...payload, approver: "outsider" }) }, "approval_identity_not_allowlisted");
    check({ ...args, actor: "outsider", receipt: signed({ ...payload, subject: "outsider" }) }, "approval_identity_not_allowlisted");
    check({ ...args, receipt: signed({ ...payload, issuer: "other" }) }, "approval_untrusted_issuer");
    check({ ...args, receipt: signed({ ...payload, role: "admin" }) }, "approval_role_not_allowed");
    check({ ...args, receipt: signed({ ...payload, expiresAt: new Date(now - 500).toISOString() }) }, "approval_expired");
    check({ ...args, receipt: signed({ ...payload, issuedAt: new Date(now + 30000).toISOString() }) }, "approval_issued_in_future");
    check({ ...args, receipt: signed({ ...payload, expiresAt: new Date(now + 16 * 60000).toISOString() }) }, "approval_invalid_validity");
    check({ ...args, receipt: signed({ ...payload, expiresAt: payload.issuedAt }) }, "approval_invalid_validity");
    check({ ...args, receipt: signed({ ...payload, issuedAt: "2026-01-01" }) }, "approval_invalid_validity");
    check({ ...args, receipt: { ...args.receipt, payload: { ...payload, nonce: "altered" } } }, "approval_invalid_signature");
    check({ ...args, receipt: { ...args.receipt, keyId: "unknown" } }, "approval_untrusted_issuer");
    check({ ...args, receipt: { ...args.receipt, alg: "none" } }, "malformed_approval_receipt");
    check({ ...args, receipt: { ...args.receipt, signature: args.receipt.signature + "=" } }, "malformed_approval_receipt");
    check({ ...args, receipt: { ...args.receipt, payload: { ...payload, extra: "field" } } });
    check({ ...args, receipt: { ...args.receipt, payload: { ...payload, statementHash: "A".repeat(64) } } });
    check({ ...args, receipt: { ...args.receipt, payload: { ...payload, nonce: " padded " } } });
    check({ ...args, padding: "x".repeat(32 * 1024) }, "malformed_approval_input");
    for (const input of [undefined, null, {}, { ...args, receipt: null }]) check(input);
    const circular = { ...args }; circular.self = circular;
    check(circular, "malformed_approval_input");
  });
  for (const rawTrust of [undefined, "{", "[]", JSON.stringify({}), "x".repeat(32769),
    JSON.stringify({ ephemeral: { ...entry, subjects: [] } }),
    JSON.stringify({ ephemeral: { ...entry, approvers: undefined } }),
    JSON.stringify({ ephemeral: { ...entry, alg: "EdDSA" } }),
    JSON.stringify({ ephemeral: { ...entry, publicKey: "invalid" } }),
    JSON.stringify({ ephemeral: { ...entry, publicKey: crypto.generateKeyPairSync("ec", { namedCurve: "prime256v1" }).publicKey.export({ type: "spki", format: "pem" }) } }),
  ]) {
    await withEnv({ CODEXDB_APPROVAL_TRUST_JSON: rawTrust }, () => check(args));
  }
});

// All authority responses below are injected unit fixtures, never live provider evidence.
function authorityFixture(request, extra = {}) {
  const now = Date.now();
  return { ...request, status: "active", checkedAt: new Date(now).toISOString(),
    expiresAt: new Date(now + 20000).toISOString(), ...extra };
}
function authorityJson(value) {
  return new Response(JSON.stringify(value), { status: 200, headers: { "Content-Type": "application/json" } });
}

test("SQLite actual temporary database discovery is readonly and reports unsupported coverage", async () => {
  const { DatabaseSync } = require("node:sqlite");
  const directory = fs.mkdtempSync(path.join(require("node:os").tmpdir(), "codex-sqlite-adapter-"));
  const filename = path.join(directory, "fixture.sqlite");
  const writer = new DatabaseSync(filename);
  try {
    writer.exec(`CREATE TABLE parent (id INTEGER PRIMARY KEY, label TEXT UNIQUE);
      CREATE TABLE child (id INTEGER PRIMARY KEY, parent_id INTEGER REFERENCES parent(id),
        code TEXT UNIQUE, quantity INTEGER DEFAULT 1 CHECK(quantity > 0));
      CREATE INDEX child_parent ON child(parent_id);
      CREATE VIEW child_view AS SELECT id, code FROM child;
      CREATE TRIGGER child_trigger AFTER INSERT ON child BEGIN UPDATE child SET quantity=2 WHERE id=NEW.id; END;`);
  } finally { writer.close(); }
  const adapter = new SqliteAdapter({ engine: "sqlite" }, { database: filename });
  try {
    assert.equal((await adapter.initialize()).initialized, true);
    const result = await adapter.discoverDatabase();
    assert.equal(result.source, "live");
    assert.equal(result.engine, "sqlite");
    assert.equal(result.database, filename);
    assert.equal(result.complete, false);
    for (const kind of ["table", "view", "column", "index", "primary_key", "foreign_key", "unique", "default", "trigger"]) {
      assert.equal(result.coverage[kind], "collected", JSON.stringify(result.limitations));
      assert.ok(result.objects.some((object) => object.kind === kind), kind);
    }
    assert.equal(result.coverage.check, "unsupported");
    assert.match(result.objects.find((object) => object.kind === "table" && object.name === "child").definition, /CHECK/);
    assert.equal(new Set(result.objects.map((object) => `${object.kind}:${object.schema}:${object.name}`)).size, result.objects.length);
    assert.ok(result.objects.some((object) => object.name === "child.quantity" && object.kind === "default"));
    assert.equal(adapter.getCapabilities().executeSql, false);
    assert.equal(adapter.getSecurityFindings().status, "unsupported");
    assert.equal(adapter.getSecurityFindings().complete, false);
    assert.equal((await adapter.explainQuery({ sql: "SELECT id FROM child" })).source, "live");
    for (const sql of ["INSERT INTO child(id) VALUES (1)", "ATTACH DATABASE 'other.sqlite' AS other", "PRAGMA writable_schema=ON", "SELECT * FROM child"]) {
      assert.equal((await adapter.executeSql(sql, { allowWrite: true })).executed, false);
    }
    assert.equal((await adapter.explainQuery({ sql: "SELECT * FROM child", analyze: true })).executed, false);
    assert.equal((await adapter.explainQuery({ sql: "SELECT * FROM child; DROP TABLE child" })).executed, false);
    assert.throws(() => adapter.db.exec("CREATE TABLE should_fail(id INTEGER)"));
    assert.throws(() => adapter.db.exec("INSERT INTO child(id) VALUES(1)"));
    if (adapter.authorizer) assert.throws(() => adapter.db.exec("ATTACH DATABASE ':memory:' AS extra"));
  } finally { await adapter.close(); }
  const reader = new DatabaseSync(filename, { readOnly: true });
  try { assert.equal(reader.prepare("SELECT COUNT(*) AS n FROM child").get().n, 0); }
  finally { reader.close(); }
  for (const database of [":memory:", "relative.sqlite", path.join(directory, "missing.sqlite"), directory]) {
    const invalid = new SqliteAdapter({}, { database });
    assert.equal((await invalid.initialize()).initialized, false);
    assert.equal((await invalid.discoverDatabase()).coverage.table, "unavailable");
  }
  assert.equal(fs.existsSync(path.join(directory, "missing.sqlite")), false);
  // This directory was created by this test and contains only its own fixtures.
  fs.rmSync(directory, { recursive: true, force: true });
});

test("MySQL and MariaDB mocked driver discovery is live-only, scoped and read-only", async () => {
  for (const engine of ["mysql", "mariadb"]) {
    const queries = [];
    let config;
    let ended = false;
    const connection = {
      async query(options, values) {
        queries.push({ sql: options.sql, values });
        assert.equal(options.timeout, 5000);
        const sql = options.sql;
        if (sql.startsWith("SELECT VERSION()")) return [[{ version: engine === "mysql" ? "8.4.0" : "11.4.0-MariaDB", versionComment: engine === "mysql" ? "MySQL Community Server" : "MariaDB Server", database: "fixture" }]];
        if (sql.includes("TABLE_NAME = ? LIMIT 1")) return [[{ TABLE_TYPE: "BASE TABLE" }]];
        if (sql.includes("information_schema.TABLES")) return [[{ TABLE_NAME: "items", TABLE_TYPE: "BASE TABLE" }, { TABLE_NAME: "items_view", TABLE_TYPE: "VIEW" }]];
        if (sql.includes("information_schema.COLUMNS")) return [[{ TABLE_NAME: "items", COLUMN_NAME: "id", COLUMN_TYPE: "int", COLUMN_DEFAULT: 1 }]];
        if (sql.includes("information_schema.STATISTICS")) return [[{ TABLE_NAME: "items", INDEX_NAME: "PRIMARY", COLUMN_NAME: "id", SEQ_IN_INDEX: 1 }, { TABLE_NAME: "items", INDEX_NAME: "PRIMARY", COLUMN_NAME: "tenant", SEQ_IN_INDEX: 2 }]];
        if (sql.includes("information_schema.TABLE_CONSTRAINTS")) return [[...[["PRIMARY KEY", "PRIMARY"], ["FOREIGN KEY", "parent_fk"], ["UNIQUE", "id_unique"]].map(([CONSTRAINT_TYPE, CONSTRAINT_NAME]) => ({ TABLE_NAME: "items", CONSTRAINT_TYPE, CONSTRAINT_NAME, COLUMN_NAME: "id" }))]];
        if (sql.includes("information_schema.TRIGGERS")) throw new Error("unit-denied-secret-password");
        if (sql.includes("information_schema.ROUTINES")) return [[{ ROUTINE_NAME: "unit_proc", ROUTINE_TYPE: "PROCEDURE", ROUTINE_DEFINITION: null }, { ROUTINE_NAME: "unit_func", ROUTINE_TYPE: "FUNCTION", ROUTINE_DEFINITION: "RETURN 1" }]];
        if (sql.includes("information_schema.PARTITIONS")) return [[{ TABLE_NAME: "items", PARTITION_NAME: "p0" }]];
        if (sql.startsWith("EXPLAIN")) return [[{ table: "items", type: "ALL" }]];
        return [[{ id: 1 }]];
      },
      async end() { ended = true; }, destroy() { ended = true; },
    };
    const adapter = new MySqlAdapter({ engine }, { server: "unit.invalid", port: 3307, user: "unit", password: "unit-secret", database: "fixture", multipleStatements: true },
      { driver: { async createConnection(options) { config = options; return connection; } } });
    try {
      assert.equal((await adapter.initialize()).initialized, true);
      assert.equal(config.multipleStatements, false);
      assert.equal(config.port, 3307);
      assert.equal(config.ssl.rejectUnauthorized, true);
      const result = await adapter.discoverDatabase();
      assert.equal(result.engine, engine);
      assert.equal(result.source, "live");
      assert.equal(result.complete, false);
      assert.equal(result.coverage.trigger, "unavailable");
      assert.equal(result.coverage.check, "unsupported");
      assert.equal(result.objects.find((o) => o.kind === "index").attributes.rows.length, 2);
      assert.equal(new Set(result.objects.map((o) => `${o.kind}:${o.name}`)).size, result.objects.length);
      assert.ok(!JSON.stringify(result).includes("secret-password"));
      assert.equal(adapter.getSecurityFindings().status, "unsupported");
      for (const query of queries.filter((q) => q.sql.includes("information_schema"))) assert.deepEqual(query.values, ["fixture"]);
      const read = await adapter.executeSql("SELECT id FROM items LIMIT 9999");
      assert.equal(read.executed, true);
      assert.deepEqual(queries.slice(-3).map((q) => q.sql), ["START TRANSACTION READ ONLY", "SELECT id FROM items LIMIT 1000", "ROLLBACK"]);
      assert.equal((await adapter.explainQuery({ sql: "SELECT * FROM items" })).analyzed, false);
      const count = queries.length;
      for (const sql of ["DELETE FROM items", "SELECT SLEEP(9) FROM items", "SELECT * FROM items INTO OUTFILE 'x'", "SELECT * FROM items; SELECT 1", "SELECT * FROM other.items", "SELECT * FROM items FOR UPDATE", "SELECT /* x */ * FROM items"]) {
        assert.equal((await adapter.executeSql(sql)).executed, false);
      }
      assert.equal((await adapter.explainQuery({ sql: "SELECT * FROM items", analyze: true })).executed, false);
      assert.equal(queries.length, count);
    } finally { await adapter.close(); }
    assert.equal(ended, true);
  }
});

test("MySQL mock rejects wrong variant, absent profile, view execution and poisoned transaction", async () => {
  let created = 0;
  let destroyed = false;
  const driver = { async createConnection() {
    created++;
    return { async query({ sql }) {
      if (sql.startsWith("SELECT VERSION")) return [[{ version: "11.4-MariaDB", versionComment: "MariaDB", database: "fixture" }]];
      return [[{ TABLE_TYPE: "VIEW" }]];
    }, async end() { destroyed = true; }, destroy() { destroyed = true; } };
  } };
  const profile = { server: "unit.invalid", user: "unit", database: "fixture" };
  assert.equal((await new MySqlAdapter({ engine: "mysql" }, profile, { driver }).initialize()).initialized, false);
  assert.equal(destroyed, true);
  const before = created;
  assert.equal((await new MySqlAdapter({}, {}, { driver }).initialize()).initialized, false);
  assert.equal(created, before);
  const adapter = new MySqlAdapter({ engine: "mariadb" }, profile, { driver });
  assert.equal((await adapter.initialize()).initialized, true);
  assert.equal((await adapter.executeSql("SELECT * FROM items")).executed, false);
  assert.equal(adapter.connection, null);
  let calls = [];
  const timed = new MySqlAdapter({ engine: "mysql" }, profile);
  timed.database = "fixture";
  timed.connection = { async query({ sql }) {
    calls.push(sql);
    if (sql.includes("information_schema")) return [[{ TABLE_TYPE: "BASE TABLE" }]];
    if (sql.startsWith("START")) return [[]];
    throw new Error("query_timeout_with_secret");
  }, destroy() { calls.push("destroy"); } };
  const result = await timed.executeSql("SELECT * FROM items");
  assert.equal(result.error, "mysql_readonly_query_failed");
  assert.equal(calls.at(-1), "destroy");
  assert.equal(timed.connection, null);
});

test("enterprise approval unit boundary binds online status to verified receipt and operation", async () => {
  const pair = crypto.generateKeyPairSync("ed25519");
  const now = Date.now();
  const payload = {
    issuer: "unit-issuer", subject: "initiator", approver: "reviewer", role: "dba_approver",
    tool: "create_index", engine: "postgres", environment: "lab", connectionProfile: "postgres",
    database: "analytics", schema: "public", statementHash: "a".repeat(64),
    issuedAt: new Date(now - 1000).toISOString(), expiresAt: new Date(now + 60000).toISOString(), nonce: "online-unit-nonce",
  };
  const args = { ...payload, actor: payload.subject, receipt: { keyId: "unit", payload,
    signature: crypto.sign(null, Buffer.from(serializeAdminApprovalPayload(payload)), pair.privateKey).toString("base64url") } };
  const trust = { unit: { issuer: payload.issuer, subjects: [payload.subject], approvers: [payload.approver],
    publicKey: pair.publicKey.export({ type: "spki", format: "pem" }) } };
  await withEnv({ CODEXDB_APPROVAL_TRUST_JSON: JSON.stringify(trust),
    CODEXDB_ENTERPRISE_APPROVAL_URL: "https://approval.example.test/status",
    CODEXDB_ENTERPRISE_APPROVAL_TOKEN: "unit-only-token", CODEXDB_ENTERPRISE_TIMEOUT_MS: undefined,
  }, async () => {
    let sent;
    const fetchImpl = async (url, options) => {
      assert.equal(url, "https://approval.example.test/status");
      assert.equal(options.redirect, "error");
      assert.equal(options.method, "POST");
      assert.equal(options.headers.Authorization, "Bearer unit-only-token");
      sent = JSON.parse(options.body);
      assert.equal(sent.receiptHash, verifyAdminApproval(args).receiptHash);
      assert.deepEqual(sent.operation, { tool: payload.tool, engine: payload.engine, environment: payload.environment,
        connectionProfile: payload.connectionProfile, database: payload.database, schema: payload.schema, statementHash: payload.statementHash });
      return authorityJson(authorityFixture(sent));
    };
    const good = await verifyEnterpriseApproval({ ...args, authorityUrl: "https://caller.invalid", token: "caller-token" }, { fetchImpl });
    assert.equal(good.authorized, true);
    assert.equal(good.productionAuthorization, false);
    assert.match(good.provenance, /not_independent_IdP_login/);
    const firstRequestId = sent.requestId;
    await verifyEnterpriseApproval(args, { fetchImpl });
    assert.notEqual(sent.requestId, firstRequestId);
    const noLocal = await verifyEnterpriseApproval({ ...args, actor: "other" }, { fetchImpl: () => assert.fail("invalid local receipt must not contact authority") });
    assert.equal(noLocal.authorized, false);
    const mutations = [
      (r) => ({ ...r, status: "revoked" }), (r) => ({ ...r, status: "pending" }),
      ...["receiptHash", "issuer", "nonce", "subject", "approver", "requestId"].map((field) => (r) => ({ ...r, [field]: "wrong" })),
      ...["tool", "engine", "environment", "connectionProfile", "database", "schema", "statementHash"].map((field) => (r) => ({ ...r, operation: { ...r.operation, [field]: "wrong" } })),
      (r) => ({ ...r, extra: true }), (r) => ({ ...r, operation: { ...r.operation, extra: true } }),
      (r) => ({ ...r, subject: undefined }), (r) => ({ ...r, version: "1" }),
      (r) => ({ ...r, checkedAt: new Date(Date.now() + 10000).toISOString() }),
      (r) => ({ ...r, checkedAt: new Date(Date.now() - 40000).toISOString() }),
      (r) => ({ ...r, expiresAt: new Date(Date.now() - 1).toISOString() }),
      (r) => ({ ...r, expiresAt: new Date(Date.now() + 120000).toISOString() }),
      (r) => ({ ...r, checkedAt: "invalid" }), (r) => ({ ...r, expiresAt: null }),
    ];
    for (const mutate of mutations) {
      const result = await verifyEnterpriseApproval(args, { fetchImpl: async (_, options) => authorityJson(mutate(authorityFixture(JSON.parse(options.body)))) });
      assert.equal(result.authorized, false);
      assert.equal(typeof result.reason, "string");
    }
    const unavailable = await verifyEnterpriseApproval(args, { fetchImpl: async () => { throw new Error("unit-only-token"); } });
    assert.deepEqual(unavailable, { authorized: false, reason: "enterprise_approval_unavailable" });
  });
});

test("external audit witness unit boundary requires exact fresh hash acknowledgement and bounded HTTPS", async () => {
  const args = { action: "append", eventHash: "b".repeat(64) };
  const prefix = "CODEXDB_AUDIT_WITNESS";
  await withEnv({ [`${prefix}_URL`]: "https://witness.example.test/events", [`${prefix}_TOKEN`]: "unit-only-token",
    CODEXDB_ENTERPRISE_TIMEOUT_MS: undefined,
  }, async () => {
    const reply = (options) => authorityFixture(JSON.parse(options.body), { status: "recorded", witnessId: "unit-witness" });
    for (const action of ["append", "check"]) {
      const result = await verifyEnterpriseAuditWitness({ ...args, action }, { fetchImpl: async (url, options) => {
        assert.equal(url, "https://witness.example.test/events");
        assert.equal(options.redirect, "error");
        assert.equal(options.cache, "no-store");
        return authorityJson(reply(options));
      } });
      assert.equal(result.acknowledged, true);
      assert.equal(result.action, action);
      assert.equal(result.eventHash, args.eventHash);
      assert.equal(result.productionAuthorization, false);
      assert.match(result.provenance, /not_tamperproof_storage/);
    }
    for (const change of [{ eventHash: "c".repeat(64) }, { action: "check" }, { requestId: "old" },
      { status: "missing" }, { witnessId: "" }, { extra: true }, { version: 2 },
      { checkedAt: new Date(Date.now() - 60000).toISOString() }, { expiresAt: "invalid" }]) {
      const result = await verifyEnterpriseAuditWitness(args, { fetchImpl: async (_, options) => authorityJson({ ...reply(options), ...change }) });
      assert.equal(result.acknowledged, false);
    }
    const transportFailures = [
      async () => new Response("", { status: 503 }),
      async () => new Response("", { status: 302, headers: { Location: "https://other.invalid" } }),
      async () => new Response("{}", { headers: { "Content-Type": "text/html" } }),
      async () => new Response("{", { headers: { "Content-Type": "application/json" } }),
      async () => new Response("{}", { headers: { "Content-Type": "application/json", "Content-Length": "32769" } }),
      async () => new Response("x".repeat(32769), { headers: { "Content-Type": "application/json" } }),
      async () => { throw new Error("unit-only-token"); },
    ];
    for (const fetchImpl of transportFailures) {
      assert.deepEqual(await verifyEnterpriseAuditWitness(args, { fetchImpl }), { acknowledged: false, reason: "audit_witness_unavailable" });
    }
    for (const config of [{ [`${prefix}_URL`]: undefined }, { [`${prefix}_URL`]: "http://insecure.test" },
      { [`${prefix}_URL`]: "https://user:password@witness.test" }, { [`${prefix}_URL`]: "https://witness.test/#fragment" },
      { [`${prefix}_TOKEN`]: undefined }, { CODEXDB_ENTERPRISE_TIMEOUT_MS: "5001" }]) {
      await withEnv(config, async () => {
        assert.equal((await verifyEnterpriseAuditWitness(args, { fetchImpl: () => assert.fail("invalid admin configuration must not fetch") })).acknowledged, false);
      });
    }
    await withEnv({ CODEXDB_ENTERPRISE_TIMEOUT_MS: "10" }, async () => {
      let signal;
      const result = await verifyEnterpriseAuditWitness(args, { fetchImpl: async (_, options) => {
        signal = options.signal;
        return new Promise(() => {});
      } });
      assert.equal(result.acknowledged, false);
      assert.equal(signal.aborted, true);
      const stalled = await verifyEnterpriseAuditWitness(args, { fetchImpl: async (_, options) => new Response(new ReadableStream({
        start(controller) { options.signal.addEventListener("abort", () => controller.error(new Error("aborted")), { once: true }); },
      }), { headers: { "Content-Type": "application/json" } }) });
      assert.equal(stalled.acknowledged, false);
    });
    for (const input of [{ ...args, url: "https://caller.test" }, { ...args, eventHash: "wrong" }, { ...args, action: "delete" }]) {
      assert.equal((await verifyEnterpriseAuditWitness(input, { fetchImpl: () => assert.fail("invalid witness input must not fetch") })).acknowledged, false);
    }
  });
});
