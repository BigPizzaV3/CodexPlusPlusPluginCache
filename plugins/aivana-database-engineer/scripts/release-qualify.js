const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const crypto = require("node:crypto");
const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const root = path.resolve(__dirname, "..");
const flags = new Set(process.argv.slice(2));
const report = { createdAt: new Date().toISOString(), platform: process.platform, node: process.version,
  status: "running", checks: [], externalTenantQualification: "not_run", secondMachineQualification: "not_run",
  writeRehearsalQualification: { sqlserver: "not_run", postgres: "not_run" }, productionMigrationQualification: "not_run",
  isolatedMigrationWorkflow: { sqlserver: "not_run", postgres: "not_run" }, productionQualified: false };

function run(exe, args, options = {}) {
  return execFileSync(exe, args, { encoding: "utf8", windowsHide: true, timeout: 120000,
    maxBuffer: 4 * 1024 * 1024, ...options });
}

async function exerciseRollbackSession(engine, query) {
  const table = "codexdb_rehearsal_" + crypto.randomBytes(8).toString("hex");
  if (engine === "sqlserver") {
    // One fixed batch keeps the temporary table and all assertions on one session.
    const result = await query(`
      DECLARE @original_xact_abort bit = CASE WHEN (16384 & @@OPTIONS) = 16384 THEN 1 ELSE 0 END;
      IF @@TRANCOUNT <> 0 THROW 51000, 'Rehearsal requires an idle session', 1;
      SET XACT_ABORT OFF;
      BEGIN TRY
        BEGIN TRANSACTION;
        CREATE TABLE #${table} (id int PRIMARY KEY, amount int NOT NULL CHECK(amount >= 0));
        INSERT INTO #${table} VALUES (1, 10), (2, 20);
        UPDATE #${table} SET amount = 11 WHERE id = 1;
        SAVE TRANSACTION before_expected_error;
        DECLARE @expected_error bit = 0;
        BEGIN TRY
          INSERT INTO #${table} VALUES (1, 99);
        END TRY
        BEGIN CATCH
          IF ERROR_NUMBER() <> 2627 THROW;
          SET @expected_error = 1;
        END CATCH;
        IF @expected_error = 0 THROW 51001, 'Expected key conflict missing', 1;
        ROLLBACK TRANSACTION before_expected_error;
        DELETE FROM #${table} WHERE id = 2;
        IF (SELECT COUNT(*) FROM #${table}) <> 1 OR (SELECT amount FROM #${table} WHERE id = 1) <> 11
          THROW 51002, 'Rehearsal data mismatch', 1;
        ROLLBACK TRANSACTION;
        IF OBJECT_ID('tempdb..#${table}') IS NOT NULL THROW 51003, 'Temporary table survived rollback', 1;
        IF @original_xact_abort = 1 SET XACT_ABORT ON;
        SELECT 1 AS rollback_verified, @@TRANCOUNT AS remaining_transactions;
      END TRY
      BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        IF @original_xact_abort = 1 SET XACT_ABORT ON;
        THROW;
      END CATCH;`);
    assert.equal(result.recordset?.[0]?.rollback_verified, 1);
    assert.equal(result.recordset?.[0]?.remaining_transactions, 0);
  } else if (engine === "postgres") {
    let open = false;
    try {
      await query("BEGIN");
      open = true;
      await query("SET LOCAL statement_timeout = '5s'");
      await query(`CREATE TEMP TABLE ${table} (id integer PRIMARY KEY, amount integer NOT NULL CHECK(amount >= 0)) ON COMMIT DROP`);
      await query(`INSERT INTO ${table} VALUES (1, 10), (2, 20)`);
      await query(`UPDATE ${table} SET amount = 11 WHERE id = 1`);
      await query("SAVEPOINT before_expected_error");
      await assert.rejects(query(`INSERT INTO ${table} VALUES (1, 99)`), (error) => error.code === "23505");
      await query("ROLLBACK TO SAVEPOINT before_expected_error");
      await query(`DELETE FROM ${table} WHERE id = 2`);
      const result = await query(`SELECT id, amount FROM ${table} ORDER BY id`);
      assert.deepEqual(result.rows, [{ id: 1, amount: 11 }]);
      await query("ROLLBACK");
      open = false;
      const cleanup = await query(`SELECT to_regclass('pg_temp.${table}')::text AS remaining_table`);
      assert.equal(cleanup.rows?.[0]?.remaining_table, null);
    } finally {
      if (open) await query("ROLLBACK");
    }
  } else throw new Error("Unsupported rehearsal engine");
  return { status: "passed", operations: ["insert", "update", "delete", "constraint_error", "savepoint_recovery", "rollback", "cleanup"],
    scope: "synthetic_temporary_tables_only", productionMigrationQualified: false, businessDataTouched: false };
}

async function qualifyWriteRehearsal(installed, engine) {
  if (!["sqlserver", "postgres"].includes(engine)) throw new Error("Explicit rehearsal engine required");
  const { createAdapter } = require(path.join(installed, "runtime/db/connector"));
  const { adapter, status } = await createAdapter({ policy: { auth: { requireLiveConnection: true } } }, { engine });
  try {
    assert.ok(!status.blocked && !String(status.adapter).includes("mock"));
    const denied = await adapter.executeSql("INSERT INTO codexdb_unauthorized_fixture VALUES (1)");
    assert.equal(denied.executed, false);
    assert.equal(denied.error, "unsafe_sql");
    if (engine === "sqlserver") return await exerciseRollbackSession(engine, (sql) => adapter.connection.request().batch(sql));
    const client = await adapter.pool.connect();
    try { return await exerciseRollbackSession(engine, (sql) => client.query(sql)); }
    finally { client.release(true); }
  } finally { await adapter.close(); }
}

async function qualifySqlServer(installed) {
  const assert = require("node:assert/strict");
  const path = require("node:path");
  const { SqlServerAdapter } = require(path.join(installed, "runtime/db/sqlServerAdapter"));
  const { initializeScoped } = require(path.join(installed, "runtime/db/connector"));
  if (!process.env.CODEXDB_SQLSERVER_SERVER) throw new Error("SQL Server qualification requires configured server");
  const adapter = new SqlServerAdapter({ policy: { auth: { liveConnectionTimeoutMs: 5000 } } }, {
    server: process.env.CODEXDB_SQLSERVER_SERVER, database: process.env.CODEXDB_SQLSERVER_DATABASE || "master",
    authentication: process.env.CODEXDB_SQLSERVER_AUTHENTICATION,
    user: process.env.CODEXDB_SQLSERVER_USER, password: process.env.CODEXDB_SQLSERVER_PASSWORD,
    port: process.env.CODEXDB_SQLSERVER_PORT, odbcDriver: process.env.CODEXDB_SQLSERVER_ODBC_DRIVER,
    trustServerCertificate: process.env.CODEXDB_SQLSERVER_TRUST_SERVER_CERTIFICATE,
  });
  try {
    await initializeScoped(adapter, "sqlserver", process.env.CODEXDB_SQLSERVER_DATABASE || "master");
    const plan = await adapter.explainQuery({ sql: "SELECT 1 AS qualification" });
    assert.equal(plan.source, "live");
    assert.match(plan.plan, /ShowPlanXML/);
    const metadata = await adapter.describeTable({ database: process.env.CODEXDB_SQLSERVER_DATABASE || "master", schema: "dbo", table: "__qualification_missing_table__" });
    assert.ok(Array.isArray(metadata.sampleColumns));
    const statistics = await adapter.queryStats();
    for (const row of statistics) {
      assert.equal(row.source, "live");
      assert.equal(row.p95Ms, null);
      assert.equal(row.regressionScore, null);
      assert.ok(row.cpuMs === null || Number.isFinite(row.cpuMs));
    }
    const result = await adapter.connection.request().query("SELECT 2 AS session_clean");
    assert.equal(result.recordset[0].session_clean, 2);
    await assert.rejects(adapter.explainQuery({ sql: "SELECT nonexistent_column_for_qualification" }));
    const afterError = await adapter.connection.request().query("SELECT 3 AS session_clean");
    assert.equal(afterError.recordset[0].session_clean, 3);

  } finally { await adapter.close(); }

}

async function qualifyMigrationWorkflow(installed, engine) {
  assert.ok(["postgres", "sqlserver"].includes(engine), "Explicit migration engine required");
  const database = "codexdb_qualification_" + crypto.randomBytes(16).toString("hex");
  const schema = engine === "postgres" ? "public" : "dbo";
  const env = { ...process.env, CODEXDB_REQUIRE_LIVE_CONNECTION: "true",
    CODEXDB_MIGRATION_SIGNING_KEY: crypto.randomBytes(32).toString("hex"), CODERUN_ACTOR: "dba" };
  // Secret-store profiles take precedence over environment database overrides.
  for (const key of ["CODEXDB_SECRET_FILE", "CODEXDB_SECRETS_FILE", "CODEXDB_SECRET_JSON", "CODEXDB_SECRETS_JSON"]) delete env[key];
  env[`CODEXDB_${engine.toUpperCase()}_ENGINE`] = engine;
  env[`CODEXDB_${engine.toUpperCase()}_DB`] = database;
  env[`CODEXDB_${engine.toUpperCase()}_DATABASE`] = database;
  if (engine === "sqlserver") {
    delete env.CODEXDB_SQLSERVER_CONNECTION_STRING;
    delete env.CODEXDB_CONNECTION_STRING;
  }
  const scope = { engine, database, schema, table: "orders", actor: "dba", environment: "lab", connectionProfile: engine };
  const authority = crypto.generateKeyPairSync("ed25519");
  env.CODEXDB_REQUIRE_AUTHENTICATED_APPROVAL = "true";
  env.CODEXDB_APPROVAL_TRUST_JSON = JSON.stringify({ qualification: {
    publicKey: authority.publicKey.export({ type: "spki", format: "pem" }), issuer: "qualification-only",
    subjects: ["dba"], approvers: ["independent-fixture-reviewer"],
  } });
  function approval(tool, draft) {
    const payload = { issuer: "qualification-only", subject: "dba", approver: "independent-fixture-reviewer", role: "dba_approver",
      tool, engine, environment: "lab", connectionProfile: engine, database, schema, statementHash: draft.actionFingerprint,
      issuedAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 60000).toISOString(), nonce: crypto.randomUUID() };
    const { serializeAdminApprovalPayload } = require(path.join(installed, "runtime/policyEngine"));
    return { keyId: "qualification", payload, signature: crypto.sign(null, Buffer.from(serializeAdminApprovalPayload(payload)), authority.privateKey).toString("base64url") };
  }
  const checks = [];
  let admin, fixture, created = false;
  const quotedDatabase = engine === "postgres" ? `"${database}"` : `[${database}]`;
  const table = engine === "postgres" ? '"public"."orders"' : '[dbo].[orders]';
  const indexSql = engine === "postgres"
    ? "SELECT indexname AS name FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'idx_orders_created_at'"
    : "SELECT name FROM sys.indexes WHERE object_id = OBJECT_ID(N'dbo.orders') AND name = N'idx_orders_created_at'";
  const rowsSql = `SELECT id, created_at FROM ${table} ORDER BY id`;
  async function connect(target) {
    if (engine === "postgres") {
      const { Client } = require(path.join(installed, "node_modules/pg"));
      const url = new URL(process.env.CODEXDB_POSTGRES_CONNECTION_STRING);
      if (target) url.pathname = "/" + target;
      const client = new Client({ connectionString: url.toString(), connectionTimeoutMillis: 5000, query_timeout: 15000 });
      try { await client.connect(); } catch (error) { await client.end(); throw error; }
      return { query: async (sql) => (await client.query(sql)).rows, close: () => client.end() };
    }
    const { SqlServerAdapter } = require(path.join(installed, "runtime/db/sqlServerAdapter"));
    const { initializeScoped } = require(path.join(installed, "runtime/db/connector"));
    const adapter = new SqlServerAdapter({ policy: { auth: { liveConnectionTimeoutMs: 5000 } } }, {
      server: process.env.CODEXDB_SQLSERVER_SERVER, database: target || "master",
      authentication: process.env.CODEXDB_SQLSERVER_AUTHENTICATION,
      user: process.env.CODEXDB_SQLSERVER_USER, password: process.env.CODEXDB_SQLSERVER_PASSWORD,
      port: process.env.CODEXDB_SQLSERVER_PORT, odbcDriver: process.env.CODEXDB_SQLSERVER_ODBC_DRIVER,
      encrypt: process.env.CODEXDB_SQLSERVER_ENCRYPT,
      trustServerCertificate: process.env.CODEXDB_SQLSERVER_TRUST_SERVER_CERTIFICATE,
    });
    try {
      const status = await initializeScoped(adapter, engine, target || "master");
      assert.ok(!status.blocked && !String(status.adapter).includes("mock"));
    } catch (error) { await adapter.close(); throw error; }
    return { query: async (sql) => (await adapter.connection.request().batch(sql)).recordset || [], close: () => adapter.close() };
  }
  function dispatch(tool, args, forbidExecuteSql = false) {
    // Instrument only the isolated CLI process; even a swallowed call fails qualification.
    const launcher = `const path = require('node:path');
      const installed = process.argv[1], tool = process.argv[2], forbid = process.argv[3] === 'true';
      let calls = 0;
      const connector = require(path.join(installed, 'runtime/db/connector'));
      const originalReplay = connector.replayWorkload;
      connector.replayWorkload = async (...args) => {
        try { return await originalReplay(...args); }
        catch (error) {
          const clean = require(path.join(installed, 'runtime/auditLogger')).sanitizeObject;
          console.error(clean(String(error.cause?.message || error.message)));
          throw error;
        }
      };
      for (const [file, name] of [['postgresAdapter', 'PostgresAdapter'], ['sqlServerAdapter', 'SqlServerAdapter']]) {
        const proto = require(path.join(installed, 'runtime/db', file))[name].prototype;
        const execute = proto.executeSql;
        proto.executeSql = function (...args) {
          calls++;
          if (forbid) throw new Error('Qualification forbids executeSql');
          return execute.apply(this, args);
        };
      }
      process.on('beforeExit', () => { if (forbid && calls) process.exitCode = 1; });
      process.argv = [process.execPath, path.join(installed, 'runtime/runTool.js'), tool, '-'];
      require(process.argv[1]);`;
    return JSON.parse(run(process.execPath, ["-e", launcher, installed, tool, String(forbidExecuteSql)],
      { cwd: path.dirname(env.CODEXDB_STATE_DIR || installed), env, input: JSON.stringify(args), stdio: ["pipe", "pipe", "pipe"] }));
  }
  function signed(draft) {
    const fields = {};
    for (const field of ["migrationSignature", "migrationSignedAt", "migrationSigningExpiresAt"]) {
      assert.ok(typeof draft[field] === "string" && draft[field], `Missing ${field}`);
      fields[field] = draft[field];
    }
    return fields;
  }
  try {
    if (engine === "postgres") {
      assert.ok(process.env.CODEXDB_POSTGRES_CONNECTION_STRING, "Configured PostgreSQL connection required");
      const url = new URL(process.env.CODEXDB_POSTGRES_CONNECTION_STRING);
      url.pathname = "/" + database;
      env.CODEXDB_POSTGRES_CONNECTION_STRING = url.toString();
    } else assert.ok(process.env.CODEXDB_SQLSERVER_SERVER, "Configured SQL Server required");
    admin = await connect();
    const existing = await admin.query(engine === "postgres"
      ? `SELECT datname FROM pg_database WHERE datname = '${database}'`
      : `SELECT name FROM sys.databases WHERE name = N'${database}'`);
    assert.equal(existing.length, 0, "Qualification database already exists");
    await admin.query(`CREATE DATABASE ${quotedDatabase}`);
    created = true;
    fixture = await connect(database);
    await fixture.query(`CREATE TABLE ${table} (id int PRIMARY KEY, created_at ${engine === "postgres" ? "timestamp" : "datetime2"});
      INSERT INTO ${table} (id, created_at) VALUES (1, '2026-01-01T10:00:00'), (2, '2026-01-02T11:00:00');`);
    const before = await fixture.query(rowsSql);
    const evidenceScope = { ...scope, systemId: "qualification-only", product: engine, productVersion: "qualification", deployment: "isolated-fixture" };
    const contextBefore = dispatch("live_context_fingerprint", evidenceScope, true);
    assert.equal(contextBefore.source, "live");
    assert.match(contextBefore.validityContext.schemaHash, /^[a-f0-9]{64}$/);
    const parameter = engine === "postgres" ? "$1" : "@codex_arg_1";
    const baselineSql = `SELECT id, created_at FROM ${table} WHERE id >= ${parameter}`;
    const candidateSql = `SELECT id, created_at FROM ${table} WHERE id >= ${parameter} ORDER BY id`;
    const wrongSql = `SELECT id + 1 AS id, created_at FROM ${table} WHERE id >= ${parameter}`;
    const templates = Object.fromEntries(Object.entries({ baseline: baselineSql, candidate: candidateSql, wrong: wrongSql }).map(([id, sql]) => [id,
      { sql, sha256: crypto.createHash("sha256").update(sql).digest("hex"), parameterCount: 1, maxRows: 10, reviewedReadOnly: true }]));
    // Synthetic fixture uses local test credentials, not a qualified customer role.
    env.CODEXDB_REPLAY_REGISTRY_JSON = JSON.stringify({ [engine]: { ...evidenceScope, isolated: true, readOnlyPrincipalReviewed: true, templates } });
    const replayArgs = { ...evidenceScope, concurrency: 2, repetitions: 3, cases: [
      { id: "all", baselineTemplate: "baseline", candidateTemplate: "candidate", parameters: [1], offsetMs: 0 },
      { id: "null", baselineTemplate: "baseline", candidateTemplate: "candidate", parameters: [null], offsetMs: 5 },
    ] };
    const replay = dispatch("live_workload_replay", replayArgs, true);
    assert.equal(replay.source, "live");
    assert.equal(replay.resultsMatch, true);
    assert.equal(replay.records.length, 6);
    assert.equal(replay.parameterValuesExported, false);
    const mismatch = dispatch("live_workload_replay", { ...replayArgs, cases: [{ ...replayArgs.cases[0], candidateTemplate: "wrong" }] }, true);
    assert.equal(mismatch.resultsMatch, false);
    checks.push({ id: "live_parameterized_replay_and_semantic_mismatch", status: "passed", scope: "synthetic_cases_not_full_edge_case_or_role_coverage" });
    async function verify(id, expectedIndexes) {
      assert.equal((await fixture.query(indexSql)).length, expectedIndexes, id);
      assert.deepEqual(await fixture.query(rowsSql), before, `${id}: fixture rows changed`);
      checks.push({ id, status: "passed", indexCount: expectedIndexes, rowsUnchanged: true });
    }
    const draft = dispatch("create_index", { ...scope, executionMode: "dry_run" }, true);
    assert.equal(draft.applied, false);
    assert.equal(draft.indexStatement, engine === "postgres"
      ? 'CREATE INDEX "idx_orders_created_at" ON "public"."orders"("created_at");'
      : 'CREATE INDEX [idx_orders_created_at] ON [dbo].[orders]([created_at]);');
    const signature = signed(draft);
    await verify("dry_run_no_index", 0);
    for (const [id, changes] of [
      ["absent_signature", {}],
      ["invalid_signature", { ...signature, migrationSignature: "0".repeat(64) }],
      ["tampered_signature", { ...signature, indexName: "idx_orders_tampered" }],
    ]) {
      const denied = dispatch("create_index", { ...scope, executionMode: "apply", ...changes }, true);
      assert.equal(denied.applied, false);
      assert.equal(denied.blocked, true);
      await verify(`${id}_no_index`, 0);
      assert.equal((await fixture.query(engine === "postgres"
        ? "SELECT indexname FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'idx_orders_tampered'"
        : "SELECT name FROM sys.indexes WHERE object_id = OBJECT_ID(N'dbo.orders') AND name = N'idx_orders_tampered'")).length, 0);
    }
    const noApproval = dispatch("create_index", { ...scope, executionMode: "apply", ...signature }, true);
    assert.equal(noApproval.blocked, true);
    await verify("missing_trusted_approval_no_index", 0);
    const adminApprovalReceipt = approval("create_index", draft);
    const applyArgs = { ...scope, executionMode: "apply", ...signature, adminApprovalReceipt };
    const applied = dispatch("create_index", applyArgs);
    assert.equal(applied.applied, true);
    assert.equal(applied.execution?.executed, true);
    await verify("valid_create_index", 1);
    const contextAfter = dispatch("live_context_fingerprint", evidenceScope, true);
    assert.notEqual(contextAfter.validityContext.schemaHash, contextBefore.validityContext.schemaHash);
    checks.push({ id: "live_schema_drift_detected", status: "passed", scope: "index_metadata_change" });
    const replayed = dispatch("create_index", applyArgs, true);
    assert.equal(replayed.status, "approval_already_consumed");
    await verify("approval_replay_blocked", 1);
    const rollback = { ...scope, rollbackSql: engine === "postgres"
      ? 'DROP INDEX "public"."idx_orders_created_at";' : 'DROP INDEX [idx_orders_created_at] ON [dbo].[orders];' };
    const rollbackDraft = dispatch("rollback_migration", { ...rollback, executionMode: "dry_run" }, true);
    assert.equal(rollbackDraft.applied, false);
    await verify("rollback_dry_run", 1);
    const rolledBack = dispatch("rollback_migration", { ...rollback, executionMode: "apply", ...signed(rollbackDraft), adminApprovalReceipt: approval("rollback_migration", rollbackDraft) });
    assert.equal(rolledBack.applied, true);
    assert.equal(rolledBack.execution?.executed, true);
    await verify("rollback_index", 0);
    const missing = { ...scope, table: "missing_orders" };
    const errorDraft = dispatch("create_index", { ...missing, executionMode: "dry_run" }, true);
    const failed = dispatch("create_index", { ...missing, executionMode: "apply", ...signed(errorDraft), adminApprovalReceipt: approval("create_index", errorDraft) });
    assert.equal(failed.applied, false);
    assert.equal(failed.execution?.executed, false);
    assert.ok(failed.execution?.error, "Expected actual migration SQL error");
    await verify("migration_error_not_applied", 0);
  } finally {
    delete env.CODEXDB_MIGRATION_SIGNING_KEY;
    try {
      if (fixture) {
        // Native ODBC pooling can retain the database context after logical close.
        if (engine === "sqlserver") await fixture.query("USE [master]");
        await fixture.close();
      }
      if (created) {
        assert.match(database, /^codexdb_qualification_[a-f0-9]{32}$/);
        // Never force disconnect other sessions or drop a database we did not create.
        await admin.query(`DROP DATABASE ${quotedDatabase}`);
        checks.push({ id: "isolated_database_cleanup", status: "passed" });
      }
    } finally { if (admin) await admin.close(); }
  }
  return { status: "passed", database, checks, productionQualified: false,
    authorization: "verified_ephemeral_test_issuer_not_live_IdP", scope: "isolated_synthetic_database_only" };
}

async function qualify() {
  for (const flag of flags) if (!["--live-postgres", "--live-sqlserver", "--require-codex", "--live-dataverse", "--live-salesforce", "--live-write-rehearsal", "--live-migration-workflow"].includes(flag)) throw new Error(`Unknown qualification flag: ${flag}`);
  if (flags.has("--live-migration-workflow") && !flags.has("--live-postgres") && !flags.has("--live-sqlserver")) {
    throw new Error("Migration workflow requires an explicitly selected live database engine");
  }
  if (flags.has("--live-write-rehearsal") && !flags.has("--live-postgres") && !flags.has("--live-sqlserver")) {
    throw new Error("Write rehearsal requires an explicitly selected live database engine");
  }
  const build = JSON.parse(run(process.execPath, [path.join(__dirname, "package-release.js")], { cwd: root }));
  report.archiveSha256 = build.sha256;
  report.fileCount = build.files;
  const stage = fs.mkdtempSync(path.join(os.tmpdir(), "codexdb-qualified-"));
  try {
    const manifest = JSON.parse(fs.readFileSync(path.join(root, ".codex-plugin/plugin.json"), "utf8"));
    const marketplaceRoot = path.join(stage, "marketplace");
    const pluginsRoot = path.join(marketplaceRoot, "plugins");
    fs.mkdirSync(pluginsRoot, { recursive: true });
    run("tar", ["-xzf", build.archive, "-C", pluginsRoot]);
    let installed = path.join(pluginsRoot, manifest.name);
    assert.equal(JSON.parse(fs.readFileSync(path.join(installed, ".codex-plugin/plugin.json"))).name, manifest.name);
    assert.ok(fs.existsSync(path.join(installed, "package-lock.json")));
    report.checks.push({ id: "archive_extract", status: "passed" });
    const cli = process.env.CODEXDB_CODEX_CLI;
    if (flags.has("--require-codex") && !cli) throw new Error("CODEXDB_CODEX_CLI must point to a Codex executable");
    if (cli) {
      const sourceMarket = path.resolve(root, "..", "..", ".agents/plugins/marketplace.json");
      const market = JSON.parse(fs.readFileSync(sourceMarket, "utf8"));
      const marketDir = path.join(marketplaceRoot, ".agents/plugins");
      fs.mkdirSync(marketDir, { recursive: true });
      fs.copyFileSync(sourceMarket, path.join(marketDir, "marketplace.json"));
      const isolatedHome = path.join(stage, "codex-profile");
      fs.mkdirSync(isolatedHome);
      const env = { ...process.env, CODEX_HOME: isolatedHome };
      run(cli, ["plugin", "marketplace", "add", marketplaceRoot, "--json"], { env, cwd: stage });
      run(cli, ["plugin", "add", `${manifest.name}@${market.name}`, "--json"], { env, cwd: stage });
      const cache = path.join(isolatedHome, "plugins/cache", market.name, manifest.name);
      assert.ok(fs.existsSync(path.join(cache, manifest.version, ".codex-plugin/plugin.json")));
      report.checks.push({ id: "isolated_codex_install", status: "passed" });
      // This version belongs only to a disposable update-test fixture.
      const updated = { ...manifest, version: manifest.version.split("+")[0] + "+qualification.2" };
      fs.writeFileSync(path.join(installed, ".codex-plugin/plugin.json"), JSON.stringify(updated, null, 2));
      run(cli, ["plugin", "add", `${manifest.name}@${market.name}`, "--json"], { env, cwd: stage });
      installed = path.join(cache, updated.version);
      assert.equal(JSON.parse(fs.readFileSync(path.join(installed, ".codex-plugin/plugin.json"))).version, updated.version);
      report.checks.push({ id: "isolated_codex_update", status: "passed" });
    } else report.checks.push({ id: "isolated_codex_install_update", status: "not_run" });
    const ciArgs = flags.has("--live-sqlserver") ? ["ci"] : ["ci", "--omit=optional", "--ignore-scripts"];
    if (process.env.npm_execpath) run(process.execPath, [process.env.npm_execpath, ...ciArgs], { cwd: installed });
    else if (process.platform === "win32") run("cmd.exe", ["/d", "/s", "/c", `npm ${ciArgs.join(" ")}`], { cwd: installed });
    else run("npm", ciArgs, { cwd: installed });
    report.checks.push({ id: "clean_dependency_install", status: "passed" });
    const env = { ...process.env, CODEXDB_STATE_DIR: path.join(stage, "state") };
    const smoke = JSON.parse(run(process.execPath, [path.join(installed, "runtime/runTool.js"), "erp_crm_vendor_catalog", "{}"], { cwd: stage, env }));
    assert.equal(smoke.profiles.length, 13);
    const integrity = JSON.parse(run(process.execPath, [path.join(installed, "runtime/runTool.js"), "audit_integrity_check", "{}"], { cwd: stage, env }));
    assert.equal(integrity.status, "verified");
    report.checks.push({ id: "installed_runtime_smoke", status: "passed" });
    const caseScope = { systemId: "qualification-fixture", environment: "lab", product: "postgres", productVersion: "18" };
    const created = JSON.parse(run(process.execPath, [path.join(installed, "runtime/runTool.js"), "advisor_workflow",
      JSON.stringify({ ...caseScope, action: "start", objective: "Installation qualification only" })], { cwd: stage, env }));
    assert.equal(created.nextStep.action, "diagnose");
    const resumed = JSON.parse(run(process.execPath, [path.join(installed, "runtime/runTool.js"), "advisor_workflow",
      JSON.stringify({ ...caseScope, action: "resume", caseId: created.case.id })], { cwd: stage, env }));
    assert.equal(resumed.case.revision, 1);
    assert.equal(resumed.executionAuthorized, false);
    report.checks.push({ id: "installed_workflow_persistence", status: "passed" });

    if (flags.has("--live-sqlserver")) {
      // Native ODBC binaries must be unloaded before deleting the test installation.
      run(process.execPath, ["-e", "(" + qualifySqlServer.toString() + ")(process.argv[1]).catch(e=>{console.error(e.message);process.exitCode=1;});", installed]);
      report.checks.push({ id: "sqlserver_live_plan_and_error_cleanup", status: "passed" });
    }

    if (flags.has("--live-postgres")) {
      if (!process.env.CODEXDB_POSTGRES_CONNECTION_STRING) throw new Error("PostgreSQL qualification requires a configured connection string");
      const { Client } = require(path.join(installed, "node_modules/pg"));
      const client = new Client({ connectionString: process.env.CODEXDB_POSTGRES_CONNECTION_STRING, connectionTimeoutMillis: 5000 });
      const { repeatedBenchmarkReview } = require(path.join(installed, "runtime/diagnosticEvidence"));
      const hash = (x) => crypto.createHash("sha256").update(JSON.stringify(x)).digest("hex");
      const common = { systemId: "qualification-postgres", workloadId: "generated-fixture-lookup", engine: "postgres",
        datasetHash: hash("generate_series_1_5000"), parameterSetHash: hash(Array.from({ length: 10 }, (_, i) => i + 1)), concurrency: 1 };
      const repetitions = [];
      try {
        await client.connect();
        await client.query("BEGIN READ ONLY");
        await client.query("SET LOCAL statement_timeout = '5s'");
        const baselineSql = "SELECT n FROM generate_series(1,5000) AS n WHERE n=$1";
        const candidateSql = "SELECT $1::integer AS n";
        for (let warmup = 0; warmup < 3; warmup++) {
          await client.query(baselineSql, [1]);
          await client.query(candidateSql, [1]);
        }
        for (let repetition = 0; repetition < 3; repetition++) {
          await new Promise((resolve) => setTimeout(resolve, 2));
          const before = { ...common, runId: `baseline-${repetition}`, capturedAt: new Date().toISOString(), samples: [] };
          const after = { ...common, runId: `candidate-${repetition}`, samples: [] };
          for (let i = 1; i <= 10; i++) {
            const ordered = [[before, baselineSql], [after, candidateSql]];
            if ((i + repetition) % 2) ordered.reverse();
            for (const [run, sql] of ordered) {
              const started = process.hrtime.bigint();
              const result = await client.query(sql, [i]);
              run.samples.push({ caseId: `case-${i}`, durationMs: Number(process.hrtime.bigint() - started) / 1e6,
                rowCount: result.rowCount, resultHash: hash(result.rows), error: false });
            }
          }
          after.capturedAt = new Date().toISOString();
          repetitions.push({ before, after });
        }
        const result = repeatedBenchmarkReview({ repetitions,
          sampling: { warmupIterations: 3, executionOrder: "alternating", collectionRef: "release-qualify-postgres-fixture" } });
        for (const review of result.reviews) {
          assert.equal(review.comparison.errors, 0);
          assert.deepEqual(review.comparison.semanticMismatches, []);
        }
        report.benchmark = { ...result, scenario: "synthetic_read_only_fixture_not_customer_workload" };
        report.checks.push({ id: "postgres_live_measured_benchmark", status: "passed" });
      } finally {
        try { await client.query("ROLLBACK"); } finally { await client.end(); }
      }
    }
    for (const engine of ["sqlserver", "postgres"]) {
      if (!flags.has(`--live-${engine}`)) continue;
      const database = process.env[`CODEXDB_${engine.toUpperCase()}_DATABASE`] || (engine === "postgres"
        ? decodeURIComponent(new URL(process.env.CODEXDB_POSTGRES_CONNECTION_STRING).pathname.slice(1)) : "master");
      const preflight = JSON.parse(run(process.execPath, [path.join(installed, "runtime/runTool.js"), "admin_preflight",
        JSON.stringify({ engine, database, environment: "lab" })], { cwd: stage, env }));
      assert.equal(preflight.source, "live");
      assert.equal(preflight.executionAuthorized, false);
      assert.equal(preflight.checks.length, 3);
      report.checks.push({ id: `${engine}_live_admin_preflight`, status: "passed",
        capabilityStatus: preflight.status, capabilities: preflight.checks,
        scope: "collector_availability_only_not_production_qualification" });
      if (flags.has("--live-write-rehearsal")) {
        const rehearsal = JSON.parse(run(process.execPath, [path.join(installed, "scripts/release-qualify.js"),
          "--internal-write-rehearsal", engine], { cwd: stage, env }));
        report.checks.push({ id: `${engine}_temporary_write_rollback_rehearsal`, ...rehearsal });
        report.writeRehearsalQualification[engine] = rehearsal.status;
      }
      if (flags.has("--live-migration-workflow")) {
        report.isolatedMigrationWorkflow[engine] = "failed";
        const workflow = JSON.parse(run(process.execPath, [path.join(installed, "scripts/release-qualify.js"),
          "--internal-migration-workflow", engine], { cwd: stage, env, timeout: 600000 }));
        report.checks.push({ id: `${engine}_isolated_migration_workflow`, ...workflow });
        report.isolatedMigrationWorkflow[engine] = workflow.status;
      }
    }
    for (const [provider, product] of [["dataverse", "dynamics-dataverse"], ["salesforce", "salesforce"]]) {
      if (!flags.has(`--live-${provider}`)) continue;
      const prefix = `CODEXDB_${provider.toUpperCase()}_`;
      const required = ["SYSTEM_ID", "PRODUCT_VERSION", "ENVIRONMENT", "API_VERSION"];
      if (required.some((key) => !process.env[prefix + key])) throw new Error(`Explicit ${provider} qualification context required`);
      const args = { product, systemId: process.env[prefix + "SYSTEM_ID"], productVersion: process.env[prefix + "PRODUCT_VERSION"],
        environment: process.env[prefix + "ENVIRONMENT"], deployment: "saas", apiVersion: process.env[prefix + "API_VERSION"], maxPages: 1 };
      if (provider === "dataverse") args.sloMs = Number(process.env[prefix + "SLO_MS"]);
      else args.soql = process.env[prefix + "QUALIFICATION_SOQL"];
      const { collectApi } = require(path.join(installed, "runtime/diagnosticEvidence"));
      const result = await collectApi(args);
      assert.equal(result.source, "live_api_diagnostics");
      report.checks.push({ id: `${provider}_live_tenant_collection`, status: "passed", recordsProcessed: result.recordsProcessed,
        scope: "single_scoped_read_only_collection_not_full_tenant_certification" });
      report.externalTenantQualification = "limited_collection_only";
    }
    report.status = "passed";
  } finally {
    assert.ok(fs.realpathSync(stage).startsWith(path.join(fs.realpathSync(os.tmpdir()), "codexdb-qualified-")));
    fs.rmSync(stage, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
}

if (require.main === module && process.argv[2] === "--internal-migration-workflow") {
  qualifyMigrationWorkflow(root, process.argv[3]).then((result) => console.log(JSON.stringify(result))).catch(() => {
    console.error("Isolated migration workflow failed; inspect qualification databases for incomplete cleanup; no production qualification granted");
    process.exitCode = 1;
  });
} else if (require.main === module && process.argv[2] === "--internal-write-rehearsal") {
  qualifyWriteRehearsal(root, process.argv[3]).then((result) => console.log(JSON.stringify(result))).catch(() => {
    console.error("Temporary write rehearsal failed; no production qualification granted");
    process.exitCode = 1;
  });
} else if (require.main === module) qualify().catch((error) => {
  report.status = "failed";
  report.failure = { message: "Qualification failed; the last completed check identifies the boundary", code: error.code || error.name };
  process.exitCode = 1;
  console.error(error.message);
}).finally(() => {
  fs.mkdirSync(path.join(root, "dist"), { recursive: true });
  fs.writeFileSync(path.join(root, "dist/qualification.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
});

module.exports = { exerciseRollbackSession, qualifyMigrationWorkflow };
