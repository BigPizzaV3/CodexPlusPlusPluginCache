class BaseDbAdapter {
  constructor(context) {
    this.context = context;
    this.sampleCatalog = context.sampleCatalog || {};
  }

  async initialize() {
    return { initialized: true, adapter: this.constructor.name };
  }

  async close() {
    return { closed: true };
  }

  async listDatabases(_args = {}) {
    return [];
  }

  async listTables(_args = {}) {
    return { error: "not_implemented", tables: [] };
  }

  async describeTable(_args = {}) {
    return { error: "not_implemented", table: null };
  }

  async describeRelationships(_args = {}) {
    return { error: "not_implemented", edges: [] };
  }

  async queryStats(_args = {}) {
    return [];
  }

  async lockAnalysis(_args = {}) {
    return { error: "not_implemented", topWaiters: [], blockingChains: [] };
  }

  async indexUsage(_args = {}) {
    return { error: "not_implemented", indexes: [] };
  }

  async detectPii(_args = {}) {
    return { piiColumns: [], sensitivityLevel: "unknown", policyViolations: [], remediation: "adapter_not_implemented" };
  }

  async replicationStatus(_args = {}) {
    return { error: "not_implemented" };
  }

  async queryStatsTimeline(_args = {}) {
    return [];
  }

  async executeSql(_sql, _options = {}) {
    return {
      error: "not_implemented",
      executed: false,
      affectedRows: 0,
      durationMs: 0,
    };
  }

  async explainQuery(_args = {}) {
    return {
      plan: "Adapter-noch nicht implementiert",
      bottlenecks: [],
      rewriteHints: [],
      estimatedCost: null,
      confidence: "low",
      source: _args.query,
    };
  }
}

const discoveryKinds = ["table", "view", "materialized_view", "column", "index", "primary_key", "foreign_key", "unique", "check", "default", "trigger", "procedure", "function", "sequence", "partition"];
function discoveryResult(engine, database, version) {
  return { engine, database, version, objects: [], coverage: Object.fromEntries(discoveryKinds.map((kind) => [kind, "unsupported"])),
    limitations: [], source: "live", complete: false };
}
function metadataObject(kind, schema, name, attributes, definition) {
  return { kind, schema, name, attributes, ...(definition == null ? {} : { definition }) };
}

class SqliteAdapter extends BaseDbAdapter {
  constructor(context = {}, connectionConfig = {}) {
    super(context);
    this.connectionConfig = connectionConfig;
    this.db = null;
    this.authorizer = false;
  }
  async initialize() {
    if (this.db) return { initialized: true, adapter: "sqlite_adapter", source: "live" };
    try {
      const fs = require("node:fs");
      const path = require("node:path");
      const file = this.connectionConfig.database;
      if (typeof file !== "string" || !path.isAbsolute(file) || !fs.statSync(file).isFile()) throw new Error("invalid_path");
      const { DatabaseSync, constants: c } = require("node:sqlite");
      this.db = new DatabaseSync(file, { readOnly: true, allowExtension: false, timeout: 1000 });
      this.db.exec("PRAGMA query_only = ON; PRAGMA trusted_schema = OFF");
      if (typeof this.db.setAuthorizer === "function") {
        const metadataPragmas = new Set(["table_xinfo", "index_list", "index_xinfo", "foreign_key_list"]);
        this.db.setAuthorizer((code, arg1, arg2) => {
          if (code === c.SQLITE_SELECT || code === c.SQLITE_READ) return c.SQLITE_OK;
          if (code === c.SQLITE_FUNCTION && arg2 === "sqlite_version") return c.SQLITE_OK;
          if (code === c.SQLITE_PRAGMA && metadataPragmas.has(arg1)) return c.SQLITE_OK;
          return c.SQLITE_DENY;
        });
        this.authorizer = true;
      }
      this.version = this.db.prepare("SELECT sqlite_version() AS version").get().version;
      return { initialized: true, adapter: "sqlite_adapter", source: "live" };
    } catch {
      await this.close();
      return { initialized: false, error: "sqlite_readonly_initialization_failed" };
    }
  }
  async close() {
    if (this.db) this.db.close();
    this.db = null;
    return { closed: true };
  }
  getCapabilities() {
    return { engine: "sqlite", source: this.db ? "live" : "unavailable", discovery: Boolean(this.db),
      explain: Boolean(this.db), executeSql: false, writes: false, readOnly: true, authorizer: this.authorizer,
      limitations: ["metadata_and_explain_only", "check_constraints_only_in_table_definition", "no_execution_deadline_for_synchronous_sqlite"] };
  }
  getSecurityFindings() {
    return { engine: "sqlite", source: this.db ? "live" : "unavailable", status: "unsupported", complete: false,
      findings: [], limitations: ["filesystem_permissions_and_database_security_not_audited", "empty_findings_do_not_mean_healthy"] };
  }
  async discoverDatabase() {
    const result = discoveryResult("sqlite", this.connectionConfig.database, this.version || null);
    result.limitations.push("check_constraints_retained_in_table_definitions_not_parsed", "main_schema_only", "unsupported_kinds_not_assessed");
    const supported = ["table", "view", "column", "index", "primary_key", "foreign_key", "unique", "default", "trigger"];
    for (const kind of supported) result.coverage[kind] = "unavailable";
    if (!this.db) { result.source = "unavailable"; return result; }
    const read = (sql) => {
      const rows = [];
      for (const row of this.db.prepare(sql).iterate()) {
        if (rows.length >= 10000) throw new Error("metadata_limit");
        rows.push({ ...row });
      }
      return rows;
    };
    const literal = (value) => "'" + value.replace(/'/g, "''") + "'";
    try {
      const schema = read("SELECT type, name, tbl_name, sql FROM main.sqlite_schema ORDER BY name").filter((row) => !row.name.startsWith("sqlite_"));
      for (const item of schema) {
        if (["table", "view", "trigger"].includes(item.type)) {
          result.objects.push(metadataObject(item.type, "main", item.type === "trigger" ? `${item.tbl_name}.${item.name}` : item.name, { table: item.tbl_name }, item.sql));
        }
        if (!["table", "view"].includes(item.type)) continue;
        const columns = read(`PRAGMA main.table_xinfo(${literal(item.name)})`);
        for (const column of columns) {
          result.objects.push(metadataObject("column", "main", `${item.name}.${column.name}`, column));
          if (column.dflt_value !== null) result.objects.push(metadataObject("default", "main", `${item.name}.${column.name}`, { column: column.name }, column.dflt_value));
        }
        const pk = columns.filter((column) => column.pk).sort((a, b) => a.pk - b.pk);
        if (pk.length) result.objects.push(metadataObject("primary_key", "main", `${item.name}.primary_key`, { columns: pk.map((column) => column.name) }));
        for (const index of read(`PRAGMA main.index_list(${literal(item.name)})`)) {
          const attributes = { ...index, table: item.name, columns: read(`PRAGMA main.index_xinfo(${literal(index.name)})`) };
          result.objects.push(metadataObject("index", "main", `${item.name}.${index.name}`, attributes, schema.find((row) => row.type === "index" && row.name === index.name)?.sql));
          if (index.unique && index.origin !== "pk") result.objects.push(metadataObject("unique", "main", `${item.name}.${index.name}`, attributes));
        }
        const foreignKeys = new Map();
        for (const fk of read(`PRAGMA main.foreign_key_list(${literal(item.name)})`)) {
          if (!foreignKeys.has(fk.id)) foreignKeys.set(fk.id, []);
          foreignKeys.get(fk.id).push(fk);
        }
        for (const [id, columns] of foreignKeys) result.objects.push(metadataObject("foreign_key", "main", `${item.name}.foreign_key_${id}`, { table: item.name, columns }));
      }
      for (const kind of supported) result.coverage[kind] = "collected";
    } catch { result.limitations.push("metadata_collection_failed_or_limit_exceeded_partial_results"); }
    return result;
  }
  async executeSql() {
    return { executed: false, error: "sqlite_execution_unsupported_metadata_and_explain_only", affectedRows: 0 };
  }
  async explainQuery({ sql, query, analyze } = {}) {
    const statement = sql || query;
    const { validateSqlSafety } = require("../sqlSafety");
    if (!this.db || analyze || typeof statement !== "string" || statement.length > 32768
      || !/^\s*select\b/i.test(statement) || !validateSqlSafety(statement).safe || /[;]|--|\/\*|\bpragma\b/i.test(statement)) {
      return { error: "sqlite_explain_unsupported_or_unsafe", source: this.db ? "live" : "unavailable", executed: false };
    }
    try { return { plan: this.db.prepare(`EXPLAIN QUERY PLAN ${statement}`).all().map((row) => ({ ...row })), source: "live", analyzed: false }; }
    catch { return { error: "sqlite_explain_failed", source: "live", executed: false }; }
  }
}

class MySqlAdapter extends BaseDbAdapter {
  constructor(context = {}, connectionConfig = {}, { driver } = {}) {
    super(context);
    this.connectionConfig = connectionConfig;
    this.engine = context.engine || connectionConfig.engine || "mysql";
    this.driver = driver;
    this.connection = null;
    this.busy = false;
  }
  async initialize() {
    if (this.connection) return { initialized: true, adapter: `${this.engine}_adapter`, source: "live" };
    try {
      if (!["mysql", "mariadb"].includes(this.engine)) throw new Error("unsupported_engine");
      const profile = this.connectionConfig;
      let config = { host: profile.server, port: Number(profile.port || 3306), user: profile.user, password: profile.password, database: profile.database };
      if (profile.connectionString) {
        const url = new URL(profile.connectionString);
        if (!["mysql:", "mariadb:"].includes(url.protocol) || url.search || url.hash) throw new Error("unsupported_connection_url");
        config = { host: url.hostname, port: Number(url.port || 3306), user: decodeURIComponent(url.username), password: decodeURIComponent(url.password), database: decodeURIComponent(url.pathname.slice(1)) };
      }
      if (!config.host || !config.user || !config.database || !Number.isInteger(config.port) || config.port < 1 || config.port > 65535) throw new Error("missing_profile");
      const driver = this.driver || require("mysql2/promise");
      this.connection = await driver.createConnection({ ...config, multipleStatements: false, connectTimeout: 5000,
        supportBigNumbers: true, bigNumberStrings: true, ssl: { rejectUnauthorized: true } });
      const rows = await this.read("SELECT VERSION() AS version, @@version_comment AS versionComment, DATABASE() AS database");
      const server = rows[0];
      const identity = `${server?.version || ""} ${server?.versionComment || ""}`;
      const actual = /mariadb/i.test(identity) ? "mariadb" : /mysql/i.test(identity) ? "mysql" : "unknown";
      if (actual !== this.engine || server.database !== config.database) throw new Error("engine_or_database_mismatch");
      this.version = server.version;
      this.database = config.database;
      return { initialized: true, adapter: `${this.engine}_adapter`, source: "live", engine: actual, version: this.version };
    } catch {
      await this.close();
      return { initialized: false, error: "mysql_live_initialization_failed_or_identity_mismatch" };
    }
  }
  async close() {
    const connection = this.connection;
    this.connection = null;
    if (connection) { try { await connection.end(); } catch { connection.destroy(); } }
    return { closed: true };
  }
  async read(sql, values = []) {
    if (!this.connection) throw new Error("not_connected");
    const [rows] = await this.connection.query({ sql, timeout: 5000 }, values);
    return rows;
  }
  getCapabilities() {
    return { engine: this.engine, source: this.connection ? "live" : "unavailable", discovery: Boolean(this.connection),
      explain: Boolean(this.connection), executeSql: Boolean(this.connection), writes: false, readOnly: true,
      limitations: ["simple_select_on_current_database_base_tables_only", "max_1000_rows", "no_explain_analyze", "unsupported_kinds_not_assessed"] };
  }
  getSecurityFindings() {
    return { engine: this.engine, source: this.connection ? "live" : "unavailable", status: "unsupported", complete: false,
      findings: [], limitations: ["server_grants_and_security_configuration_not_audited", "empty_findings_do_not_mean_healthy"] };
  }
  async discoverDatabase() {
    const result = discoveryResult(this.engine, this.database || this.connectionConfig.database, this.version || null);
    result.limitations.push("metadata_visibility_limited_to_current_account", "max_1000_rows_per_metadata_query", "unsupported_kinds_not_assessed");
    const groups = [
      { kinds: ["table", "view"], sql: "SELECT TABLE_NAME, TABLE_TYPE FROM information_schema.TABLES WHERE TABLE_SCHEMA = ?", map: (r) => [r.TABLE_TYPE === "VIEW" ? "view" : "table", r.TABLE_NAME] },
      { kinds: ["column", "default"], sql: "SELECT TABLE_NAME, COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT, EXTRA FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ?", map: (r) => ["column", `${r.TABLE_NAME}.${r.COLUMN_NAME}`] },
      { kinds: ["index"], sql: "SELECT TABLE_NAME, INDEX_NAME, COLUMN_NAME, SEQ_IN_INDEX, NON_UNIQUE, INDEX_TYPE, SUB_PART, COLLATION FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = ?", map: (r) => ["index", `${r.TABLE_NAME}.${r.INDEX_NAME}`] },
      { kinds: ["primary_key", "foreign_key", "unique"], sql: "SELECT c.TABLE_NAME, c.CONSTRAINT_NAME, c.CONSTRAINT_TYPE, k.COLUMN_NAME, k.ORDINAL_POSITION, k.REFERENCED_TABLE_SCHEMA, k.REFERENCED_TABLE_NAME, k.REFERENCED_COLUMN_NAME FROM information_schema.TABLE_CONSTRAINTS c LEFT JOIN information_schema.KEY_COLUMN_USAGE k ON k.CONSTRAINT_SCHEMA=c.CONSTRAINT_SCHEMA AND k.TABLE_NAME=c.TABLE_NAME AND k.CONSTRAINT_NAME=c.CONSTRAINT_NAME WHERE c.CONSTRAINT_SCHEMA = ?", map: (r) => [{ "PRIMARY KEY": "primary_key", "FOREIGN KEY": "foreign_key", UNIQUE: "unique" }[r.CONSTRAINT_TYPE], `${r.TABLE_NAME}.${r.CONSTRAINT_NAME}`] },
      { kinds: ["trigger"], sql: "SELECT EVENT_OBJECT_TABLE, TRIGGER_NAME, EVENT_MANIPULATION, ACTION_TIMING, ACTION_STATEMENT FROM information_schema.TRIGGERS WHERE TRIGGER_SCHEMA = ?", map: (r) => ["trigger", `${r.EVENT_OBJECT_TABLE}.${r.TRIGGER_NAME}`] },
      { kinds: ["procedure", "function"], sql: "SELECT ROUTINE_NAME, ROUTINE_TYPE, ROUTINE_DEFINITION FROM information_schema.ROUTINES WHERE ROUTINE_SCHEMA = ?", map: (r) => [r.ROUTINE_TYPE.toLowerCase(), r.ROUTINE_NAME] },
      { kinds: ["partition"], sql: "SELECT TABLE_NAME, PARTITION_NAME, SUBPARTITION_NAME, PARTITION_METHOD, PARTITION_EXPRESSION FROM information_schema.PARTITIONS WHERE TABLE_SCHEMA = ? AND PARTITION_NAME IS NOT NULL", map: (r) => ["partition", `${r.TABLE_NAME}.${r.PARTITION_NAME}${r.SUBPARTITION_NAME ? '.' + r.SUBPARTITION_NAME : ''}`] },
    ];
    for (const group of groups) for (const kind of group.kinds) result.coverage[kind] = "unavailable";
    if (!this.connection || this.busy) { result.source = "unavailable"; return result; }
    this.busy = true;
    try {
      for (const group of groups) {
        try {
          const rows = await this.read(`${group.sql} LIMIT 1001`, [this.database]);
          if (rows.length > 1000) throw new Error("metadata_limit");
          const objects = new Map();
          for (const row of rows) {
            if (row.TABLE_TYPE && !["VIEW", "BASE TABLE"].includes(row.TABLE_TYPE)) continue;
            const [kind, name] = group.map(row);
            if (!kind || !group.kinds.includes(kind)) continue;
            const key = `${kind}:${name}`;
            if (!objects.has(key)) objects.set(key, metadataObject(kind, this.database, name, { rows: [] }, row.ROUTINE_DEFINITION || row.ACTION_STATEMENT));
            objects.get(key).attributes.rows.push(row);
            if (kind === "column" && row.COLUMN_DEFAULT != null) objects.set(`default:${name}`, metadataObject("default", this.database, name, { value: row.COLUMN_DEFAULT }));
          }
          result.objects.push(...objects.values());
          for (const kind of group.kinds) result.coverage[kind] = "collected";
        } catch { result.limitations.push(`metadata_unavailable:${group.kinds.join(",")}`); }
      }
    } finally { this.busy = false; }
    return result;
  }
  async executeSql(sql, options = {}) { return this.selectOnly(sql, options, false); }
  async explainQuery({ sql, query, analyze } = {}) { return this.selectOnly(sql || query, { analyze }, true); }
  async selectOnly(sql, options, explain) {
    // Deliberately narrow grammar: no expressions, functions, joins, views, comments or caller SQL options.
    const ident = "(?:[A-Za-z_][A-Za-z0-9_]*|`[A-Za-z_][A-Za-z0-9_]*`)";
    const match = typeof sql === "string" && sql.length <= 32768 && sql.match(new RegExp(`^\\s*SELECT\\s+(?:\\*|${ident}(?:\\s*,\\s*${ident})*)\\s+FROM\\s+(${ident})(?:\\s+LIMIT\\s+([0-9]{1,4}))?\\s*$`, "i"));
    if (!match || options.analyze || options.allowWrite || options.isMigration || !this.connection || this.busy) return { executed: false, error: "mysql_select_unsupported_or_unsafe", affectedRows: 0 };
    this.busy = true;
    let transaction = false;
    try {
      const table = match[1].replace(/`/g, "");
      const types = await this.read("SELECT TABLE_TYPE FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? LIMIT 1", [this.database, table]);
      if (types[0]?.TABLE_TYPE !== "BASE TABLE") throw new Error("base_table_required");
      await this.read("START TRANSACTION READ ONLY");
      transaction = true;
      const bounded = match[2] ? sql.replace(/LIMIT\s+[0-9]+\s*$/i, `LIMIT ${Math.min(Number(match[2]), 1000)}`) : `${sql.trim()} LIMIT 1000`;
      const rows = await this.read(explain ? `EXPLAIN ${bounded}` : bounded);
      await this.read("ROLLBACK");
      transaction = false;
      return explain ? { plan: rows, source: "live", analyzed: false } : { executed: true, rows, affectedRows: 0, source: "live", readOnly: true };
    } catch {
      // A timeout/rollback failure poisons the connection; never return it for later operations.
      if (this.connection) { this.connection.destroy(); this.connection = null; }
      return { executed: false, error: transaction ? "mysql_readonly_query_failed" : "mysql_readonly_setup_failed", affectedRows: 0 };
    } finally { this.busy = false; }
  }
}

module.exports = { BaseDbAdapter, SqliteAdapter, MySqlAdapter };
