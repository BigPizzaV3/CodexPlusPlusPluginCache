const { BaseDbAdapter } = require("./baseAdapter");
const { validateSqlSafety } = require("../sqlSafety");

function mapRowRows(rows = []) {
  return rows.map((row) => row.value || row);
}

const discoveryKinds = ["table", "view", "materialized_view", "column", "index", "primary_key", "foreign_key", "unique", "check", "default", "trigger", "procedure", "function", "sequence", "partition"];
const userNamespace = "n.nspname NOT IN ('pg_catalog','information_schema') AND n.nspname !~ '^pg_toast' AND n.nspname !~ '^pg_temp_'";
const pgDiscoveryQueries = {
  table: `SELECT n.nspname AS schema, c.relname AS name, c.relkind AS relation_kind, c.relpersistence AS persistence,
    c.relrowsecurity AS row_security FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
    WHERE ${userNamespace} AND c.relkind IN ('r','p','f')`,
  column: `SELECT n.nspname AS schema, format('%I.%I',c.relname,a.attname) AS name, c.relname AS table_name,
    a.attname AS column_name, a.attnum AS ordinal, pg_catalog.format_type(a.atttypid,a.atttypmod) AS data_type,
    NOT a.attnotnull AS nullable, a.attidentity AS identity_kind
    FROM pg_catalog.pg_attribute a JOIN pg_catalog.pg_class c ON c.oid=a.attrelid JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
    WHERE ${userNamespace} AND c.relkind IN ('r','p','f','v','m') AND a.attnum>0 AND NOT a.attisdropped`,
  index: `SELECT n.nspname AS schema, format('%I.%I',t.relname,c.relname) AS name, t.relname AS table_name,
    c.relname AS index_name, pg_catalog.pg_get_indexdef(c.oid) AS definition, i.indisunique AS is_unique, i.indisvalid AS is_valid
    FROM pg_catalog.pg_index i JOIN pg_catalog.pg_class c ON c.oid=i.indexrelid JOIN pg_catalog.pg_class t ON t.oid=i.indrelid
    JOIN pg_catalog.pg_namespace n ON n.oid=t.relnamespace WHERE ${userNamespace}`,
  default: `SELECT n.nspname AS schema, format('%I.%I',c.relname,a.attname) AS name, c.relname AS table_name,
    a.attname AS column_name, pg_catalog.pg_get_expr(d.adbin,d.adrelid) AS definition
    FROM pg_catalog.pg_attrdef d JOIN pg_catalog.pg_attribute a ON a.attrelid=d.adrelid AND a.attnum=d.adnum
    JOIN pg_catalog.pg_class c ON c.oid=d.adrelid JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace WHERE ${userNamespace}`,
  trigger: `SELECT n.nspname AS schema, format('%I.%I',c.relname,t.tgname) AS name, c.relname AS table_name,
    t.tgname AS trigger_name, t.tgenabled AS enabled_mode, pg_catalog.pg_get_triggerdef(t.oid) AS definition
    FROM pg_catalog.pg_trigger t JOIN pg_catalog.pg_class c ON c.oid=t.tgrelid JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
    WHERE ${userNamespace} AND NOT t.tgisinternal`,
  sequence: `SELECT n.nspname AS schema, c.relname AS name, s.seqstart::text AS start_value, s.seqincrement::text AS increment,
    s.seqmin::text AS minimum, s.seqmax::text AS maximum, s.seqcycle AS cycle
    FROM pg_catalog.pg_sequence s JOIN pg_catalog.pg_class c ON c.oid=s.seqrelid JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace WHERE ${userNamespace}`,
  partition: `SELECT n.nspname AS schema, c.relname AS name, pn.nspname AS parent_schema, p.relname AS table_name,
    pg_catalog.pg_get_expr(c.relpartbound,c.oid) AS definition
    FROM pg_catalog.pg_inherits i JOIN pg_catalog.pg_class c ON c.oid=i.inhrelid JOIN pg_catalog.pg_class p ON p.oid=i.inhparent
    JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace JOIN pg_catalog.pg_namespace pn ON pn.oid=p.relnamespace
    WHERE ${userNamespace} AND c.relispartition`,
};
for (const [kind, relkind] of [["view", "v"], ["materialized_view", "m"]]) {
  pgDiscoveryQueries[kind] = `SELECT n.nspname AS schema, c.relname AS name, pg_catalog.pg_get_viewdef(c.oid,true) AS definition,
    c.relispopulated AS populated FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
    WHERE ${userNamespace} AND c.relkind='${relkind}'`;
}
for (const [kind, type] of [["primary_key", "p"], ["foreign_key", "f"], ["unique", "u"], ["check", "c"]]) {
  pgDiscoveryQueries[kind] = `SELECT n.nspname AS schema, format('%I.%I',c.relname,k.conname) AS name, c.relname AS table_name,
    k.conname AS constraint_name, pg_catalog.pg_get_constraintdef(k.oid,true) AS definition, k.convalidated AS validated,
    k.conkey AS column_numbers, rn.nspname AS referenced_schema, r.relname AS referenced_table, k.confkey AS referenced_column_numbers
    FROM pg_catalog.pg_constraint k JOIN pg_catalog.pg_class c ON c.oid=k.conrelid JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
    LEFT JOIN pg_catalog.pg_class r ON r.oid=k.confrelid LEFT JOIN pg_catalog.pg_namespace rn ON rn.oid=r.relnamespace
    WHERE ${userNamespace} AND k.contype='${type}'`;
}
for (const [kind, type] of [["procedure", "p"], ["function", "f"]]) {
  pgDiscoveryQueries[kind] = `SELECT n.nspname AS schema, format('%I(%s)',p.proname,pg_catalog.pg_get_function_identity_arguments(p.oid)) AS name,
    p.proname AS routine_name, pg_catalog.pg_get_functiondef(p.oid) AS definition, p.prosecdef AS security_definer,
    pg_catalog.pg_get_userbyid(p.proowner) AS owner FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
    WHERE ${userNamespace} AND p.prokind='${type}'`;
}

class PostgresAdapter extends BaseDbAdapter {
  constructor(context, connectionConfig) {
    super(context);
    this.connectionConfig = connectionConfig;
    this.pool = null;
    this.driver = null;
  }

  async initialize() {
    try {
      this.driver = require("pg");
    } catch (_error) {
      this.driver = null;
      return { initialized: true, adapter: "mock_postgres" };
    }
    if (!this.connectionConfig || (!this.connectionConfig.connectionString && !this.connectionConfig.server)) {
      return { initialized: true, adapter: "mock_postgres" };
    }
    const poolConfig = this.connectionConfig.connectionString
      ? { connectionString: this.connectionConfig.connectionString }
      : {
          host: this.connectionConfig.server,
          user: this.connectionConfig.user,
          password: this.connectionConfig.password,
          database: this.connectionConfig.database,
          port: this.connectionConfig.port ? Number(this.connectionConfig.port) : undefined,
        };
    this.pool = new this.driver.Pool({
      ...poolConfig,
      connectionTimeoutMillis: Number(this.context.policy?.auth?.liveConnectionTimeoutMs || 5000),
      max: Number(this.connectionConfig.poolMax || 5),
    });
    await this.pool.query("SELECT 1");
    return { initialized: true, adapter: "postgres_adapter" };
  }

  async close() {
    if (this.pool && this.pool.end) {
      await this.pool.end();
    }
    return { closed: true };
  }

  getCapabilities() {
    const live = Boolean(this.driver && this.pool);
    return { engine: "postgres", live, discover: live, readOnly: live, explain: live, performance: live, security: live,
      capabilitiesAreNotPermissionChecks: true, limitations: ["Performance requires pg_stat_statements and privileges; explain is not execution approval", "Discovery and security have no offline fallback"] };
  }

  async _readCatalog(sql) {
    if (!this.driver || !this.pool) throw new Error("Live PostgreSQL connection required");
    const client = await this.pool.connect();
    let cleanupError;
    try {
      await client.query({ text: "BEGIN READ ONLY", query_timeout: 5000 });
      await client.query({ text: "SET LOCAL statement_timeout = '5s'", query_timeout: 5000 });
      await client.query({ text: "SET LOCAL search_path = pg_catalog", query_timeout: 5000 });
      const result = await client.query({ text: sql, query_timeout: 5000 });
      if (!Array.isArray(result.rows)) throw new Error("Invalid catalog response");
      if (result.rows.length > 10000 || Buffer.byteLength(JSON.stringify(result.rows)) > 8 * 1024 * 1024) {
        throw Object.assign(new Error("Catalog limit exceeded; discovery is incomplete"), { code: "CATALOG_LIMIT" });
      }
      return result.rows;
    } finally {
      try { await client.query({ text: "ROLLBACK", query_timeout: 5000 }); } catch (error) { cleanupError = error; }
      client.release(cleanupError);
      if (cleanupError) throw new Error("Catalog session cleanup failed");
    }
  }

  async discoverDatabase() {
    const [identity] = await this._readCatalog("SELECT current_database() AS database, version() AS version, current_user AS principal");
    if (!identity?.database || !identity?.version) throw new Error("Missing live database identity");
    const objects = [], coverage = {}, limitations = ["Visible user catalogs only; permission completeness is not independently established",
      "PostgreSQL 11+ catalogs; aggregates, window routines, domain constraints and event triggers are outside V1", "Catalog queries are separate read-only transactions, not one atomic snapshot"];
    const identities = new Set();
    for (const kind of discoveryKinds) {
      let rows;
      try { rows = await this._readCatalog(`${pgDiscoveryQueries[kind]} ORDER BY 1,2 LIMIT 10001 /* discovery:${kind} */`); }
      catch (error) {
        if (!["42501", "42703", "42P01", "42883"].includes(error.code)) throw error;
        coverage[kind] = "unavailable"; limitations.push(`${kind}: catalog permission or version unavailable`); continue;
      }
      coverage[kind] = "collected";
      for (const row of rows) {
        const { schema, name, definition, ...attributes } = row;
        const id = JSON.stringify([kind, schema, name]);
        if (typeof schema !== "string" || !schema || typeof name !== "string" || !name || identities.has(id)) throw new Error("Invalid or duplicate catalog identity");
        identities.add(id);
        objects.push({ kind, schema, name, ...(typeof definition === "string" ? { definition } : {}), attributes });
      }
    }
    return { engine: "postgres", database: identity.database, version: identity.version, objects, coverage, limitations, source: "live", complete: false };
  }

  async getSecurityFindings() {
    if (!this.driver || !this.pool) throw new Error("Live PostgreSQL connection required");
    const queries = {
      admin_roles: "SELECT rolname AS principal, rolsuper AS superuser, rolcreaterole AS create_role, rolcreatedb AS create_database, rolbypassrls AS bypass_rls FROM pg_catalog.pg_roles WHERE rolsuper OR rolcreaterole OR rolbypassrls",
      admin_memberships: `SELECT m.rolname AS principal, r.rolname AS role, a.admin_option FROM pg_catalog.pg_auth_members a
        JOIN pg_catalog.pg_roles r ON r.oid=a.roleid JOIN pg_catalog.pg_roles m ON m.oid=a.member
        WHERE r.rolsuper OR r.rolcreaterole OR r.rolbypassrls OR a.admin_option OR r.rolname IN ('pg_read_all_data','pg_write_all_data','pg_execute_server_program','pg_read_server_files','pg_write_server_files')`,
      security_definer: `SELECT n.nspname AS schema, p.proname || '(' || pg_catalog.pg_get_function_identity_arguments(p.oid) || ')' AS routine,
        pg_catalog.pg_get_userbyid(p.proowner) AS owner, p.proconfig AS settings FROM pg_catalog.pg_proc p
        JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace WHERE ${userNamespace} AND p.prosecdef`,
      public_grants: `SELECT n.nspname AS schema, c.relname AS object, a.privilege_type AS privilege FROM pg_catalog.pg_class c
        JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace CROSS JOIN LATERAL pg_catalog.aclexplode(c.relacl) a
        WHERE ${userNamespace} AND a.grantee=0 AND a.privilege_type IN ('INSERT','UPDATE','DELETE','TRUNCATE','TRIGGER')
        UNION ALL SELECT n.nspname, n.nspname, a.privilege_type FROM pg_catalog.pg_namespace n
        CROSS JOIN LATERAL pg_catalog.aclexplode(n.nspacl) a WHERE ${userNamespace} AND a.grantee=0 AND a.privilege_type='CREATE'`,
    };
    const findings = [], coverage = {}, limitations = ["Visible direct catalog grants and memberships only; not an effective-permission or exploitability proof",
      "No MFA, unused-account, nested membership, external identity or complete privilege assessment"];
    for (const [category, sql] of Object.entries(queries)) {
      let rows;
      try { rows = await this._readCatalog(`${sql} ORDER BY 1 LIMIT 10001 /* security:${category} */`); }
      catch (error) {
        if (!["42501", "42703", "42P01", "42883"].includes(error.code)) throw error;
        coverage[category] = "unavailable"; limitations.push(`${category}: catalog unavailable`); continue;
      }
      coverage[category] = "collected";
      for (const row of rows) findings.push({ id: `${category}:${require("node:crypto").createHash("sha256").update(JSON.stringify(row)).digest("hex")}`,
        severity: category === "security_definer" ? "medium" : "high", evidence: row,
        reason: category === "security_definer" ? "Routine executes with owner privileges; review owner, search_path and execute grants" : "Elevated catalog privilege or broad grant requires least-privilege review" });
    }
    return require("../auditLogger").sanitizeObject({ source: "live", findings, coverage, limitations });
  }

  async listDatabases() {
    if (!this.driver || !this.pool) {
      return (this.sampleCatalog.postgres?.databases || []).map((item) => item);
    }
    const client = await this.pool.connect();
    try {
      const result = await client.query("SELECT datname FROM pg_database WHERE datistemplate = false ORDER BY datname;");
      return result.rows.map((r) => ({ database: r.datname, engine: "postgres", state: "online", owner: "postgres" }));
    } finally {
      client.release();
    }
  }

  async listTables({ database, schema = "public" }) {
    const dbData = this.sampleCatalog.postgres?.schemas?.[database]?.[schema]?.tables || {};
    if (!this.driver || !this.pool) {
      return Object.entries(dbData).map(([table, meta]) => ({
        database,
        schema,
        table,
        type: "table",
        rowCountHint: meta.rowCountHint,
        indexCount: meta.indexes.length,
        containsPIIFlag: Boolean(meta.containsPII),
      }));
    }
    const client = await this.pool.connect();
    try {
      const result = await client.query(
        "SELECT t.table_name, COALESCE(c.reltuples::bigint, 0) AS row_count_hint, " +
          "COALESCE(i.index_count, 0) AS index_count " +
          "FROM information_schema.tables t " +
          "LEFT JOIN pg_class c ON c.relname = t.table_name " +
          "LEFT JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = t.table_schema " +
          "LEFT JOIN (SELECT schemaname, tablename, COUNT(*)::int AS index_count FROM pg_indexes GROUP BY schemaname, tablename) i " +
          "ON i.schemaname = t.table_schema AND i.tablename = t.table_name " +
          "WHERE t.table_schema=$1 AND t.table_type='BASE TABLE' ORDER BY t.table_name",
        [schema]
      );
      return mapRowRows(result.rows).map((row) => ({
        database,
        schema,
        table: row.table_name || row,
        type: "table",
        rowCountHint: Number(row.row_count_hint || 0),
        indexCount: Number(row.index_count || 0),
        containsPIIFlag: /email|ssn|phone|iban/i.test(String(row.table_name || "")),
      }));
    } finally {
      client.release();
    }
  }

  async describeTable({ database, schema = "public", table }) {
    const catalog = this.sampleCatalog.postgres?.schemas?.[database]?.[schema]?.tables?.[table];
    if (!this.driver || !this.pool) {
      if (!catalog) {
        return { error: "table_not_found", table, schema, database };
      }
      return {
        database,
        schema,
        table,
        columns: catalog.columns,
        constraints: catalog.columns.filter((c) => c.isPrimaryKey || c.isForeignKey),
        indexes: catalog.indexes,
        relationships: catalog.relationships,
        riskNotes: catalog.containsPII ? ["Contains PII-like columns"] : [],
      };
    }
    const client = await this.pool.connect();
    try {
      const result = await client.query(
        "SELECT column_name, is_nullable, data_type FROM information_schema.columns WHERE table_schema=$1 AND table_name=$2 ORDER BY ordinal_position",
        [schema, table]
      );
      return {
        database,
        schema,
        table,
        columns: mapRowRows(result.rows).map((r) => ({ name: r.column_name, type: r.data_type, nullable: r.is_nullable === "YES" })),
      };
    } finally {
      client.release();
    }
  }

  async describeRelationships({ database, schema = "public" }) {
    const schemaCatalog = this.sampleCatalog.postgres?.schemas?.[database]?.[schema]?.tables || {};
    if (!this.driver || !this.pool) {
      return {
        edges: Object.entries(schemaCatalog).flatMap(([source, meta]) =>
          (meta.relationships || []).map((rel) => ({
            source,
            target: rel.target,
            cardinality: rel.cardinality,
            joinHint: rel.via,
            criticality: meta.containsPII ? "high" : "medium",
          }))
        ),
      };
    }
    const client = await this.pool.connect();
    try {
      const rows = await client.query(
        "SELECT tc.table_name AS source_table, ccu.table_name AS target_table " +
          "FROM information_schema.table_constraints tc " +
          "JOIN information_schema.referential_constraints rc ON tc.constraint_name = rc.constraint_name " +
          "JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = rc.unique_constraint_name " +
          "WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema=$1",
        [schema]
      );
      return {
        edges: mapRowRows(rows.rows).map((row) => ({
          source: row.source_table,
          target: row.target_table,
          cardinality: "many-to-one",
          joinHint: "foreign key",
          criticality: "medium",
        })),
      };
    } finally {
      client.release();
    }
  }

  async replicationStatus() {
    if (!this.driver || !this.pool) {
      return {
        topology: "primary-replica-2",
        lagSeconds: 1.2,
        trend: "stable",
        consistencyRisk: "low",
        actions: ["ensure_replication_slots", "monitor_lag"],
      };
    }
    const client = await this.pool.connect();
    try {
      const rows = await client.query(
        "SELECT CASE WHEN pg_is_in_recovery() THEN 'replica' ELSE 'primary' END AS mode, pg_is_in_recovery() AS is_replica"
      );
      const row = mapRowRows(rows.rows)[0] || { mode: "primary", is_replica: false };
      return {
        topology: `${row.mode}`,
        lagSeconds: 0,
        trend: "stable",
        consistencyRisk: row.is_replica ? "low" : "info",
        actions: ["monitor_lag"],
      };
    } finally {
      client.release();
    }
  }

  async queryStats() {
    if (!this.driver || !this.pool) {
      return [
        { queryId: "pg-001", avgMs: 120, p95Ms: 540, ioWait: "medium", cpuMs: 50, regressionScore: 0.14 },
        { queryId: "pg-002", avgMs: 15, p95Ms: 22, ioWait: "low", cpuMs: 4, regressionScore: 0.04 },
      ];
    }
    const client = await this.pool.connect();
    try {
      const rows = await client.query(
        "SELECT queryid, calls, total_exec_time, mean_exec_time, rows, shared_blks_read, shared_blks_hit " +
          "FROM pg_stat_statements WHERE dbid = (SELECT oid FROM pg_database WHERE datname = current_database()) " +
          "ORDER BY total_exec_time DESC LIMIT 10"
      );
      return mapRowRows(rows.rows).map((r) => ({
        queryId: `${r.queryId || r.queryid || "unknown"}`,
        avgMs: Number(r.mean_exec_time),
        totalElapsedMs: Number(r.total_exec_time),
        p95Ms: null,
        ioWait: "unknown",
        cpuMs: null,
        regressionScore: null,
        sharedBlocksRead: r.shared_blks_read == null ? null : Number(r.shared_blks_read),
        sharedBlocksHit: r.shared_blks_hit == null ? null : Number(r.shared_blks_hit),
        executionCount: Number(r.calls || 0),
        rows: Number(r.rows || 0),
        source: "live",
        metricEvidence: {
          collector: "pg_stat_statements",
          aggregation: "cumulative_since_statistics_reset",
          unavailable: { p95Ms: "requires_execution_samples", cpuMs: "not_collected_by_pg_stat_statements",
            ioWait: "block_counts_are_not_wait_durations", regressionScore: "requires_comparable_baseline" },
        },
      }));
    } catch (error) {
      const message = String(error?.message || error);
      if (/pg_stat_statements|does not exist|undefined_table/i.test(message)) {
        return {
          error: "pg_stat_statements_unavailable",
          queryStats: [],
          remediation: "enable the pg_stat_statements extension and preload it in shared_preload_libraries",
          source: "live_error",
        };
      }
      return {
        error: "query_stats_unavailable",
        queryStats: [],
        message,
        source: "live_error",
      };
    } finally {
      client.release();
    }
  }

  async lockAnalysis() {
    if (!this.driver || !this.pool) {
      return {
        deadlockRisk: "unknown",
        topWaiters: [],
        blockingChains: [],
        remediationPlan: ["configure live connection for lock analysis"],
        source: "mock",
      };
    }
    const client = await this.pool.connect();
    try {
      const result = await client.query(
        "SELECT a.pid, a.wait_event_type, a.wait_event, a.state, " +
          "EXTRACT(MILLISECONDS FROM (now() - COALESCE(a.query_start, now())))::int AS duration_ms, " +
          "c.relname AS relation_name " +
          "FROM pg_stat_activity a " +
          "LEFT JOIN pg_locks l ON l.pid = a.pid AND NOT l.granted " +
          "LEFT JOIN pg_class c ON c.oid = l.relation " +
          "WHERE a.wait_event_type IS NOT NULL OR NOT l.granted " +
          "ORDER BY duration_ms DESC LIMIT 20"
      );
      const rows = mapRowRows(result.rows);
      const topWaiters = rows.map((row) => ({
        session: String(row.pid),
        waitType: row.wait_event || row.wait_event_type || "unknown",
        durationMs: Number(row.duration_ms || 0),
        relation: row.relation_name || null,
        state: row.state || "unknown",
      }));
      return {
        deadlockRisk: topWaiters.some((row) => row.durationMs > 10000) ? "high" : topWaiters.length ? "medium" : "low",
        topWaiters,
        blockingChains: [],
        remediationPlan: topWaiters.length
          ? ["inspect blocking pids with pg_blocking_pids", "shorten long transactions", "add missing indexes on lock-heavy joins"]
          : ["no lock waits observed"],
        source: "live",
      };
    } finally {
      client.release();
    }
  }

  async indexUsage({ schema = "public", table } = {}) {
    if (!this.driver || !this.pool) {
      return { indexes: [], recommendation: "configure live connection for index usage", source: "mock" };
    }
    const client = await this.pool.connect();
    try {
      const params = table ? [schema, table] : [schema];
      const tableFilter = table ? "AND s.relname = $2 " : "";
      const result = await client.query(
        "SELECT s.relname, i.relname AS indexrelname, ui.idx_scan, ui.idx_tup_read, ui.idx_tup_fetch, " +
          "pg_relation_size(i.oid) AS index_size_bytes " +
          "FROM pg_stat_user_indexes ui " +
          "JOIN pg_class s ON s.oid = ui.relid " +
          "JOIN pg_class i ON i.oid = ui.indexrelid " +
          "JOIN pg_namespace n ON n.oid = s.relnamespace " +
          "WHERE n.nspname = $1 " +
          tableFilter +
          "ORDER BY ui.idx_scan DESC, pg_relation_size(i.oid) DESC LIMIT 20",
        params
      );
      const indexes = mapRowRows(result.rows).map((row) => ({
        table: row.relname,
        index: row.indexrelname,
        usageScore: Number(row.idx_scan || 0),
        tuplesRead: Number(row.idx_tup_read || 0),
        tuplesFetched: Number(row.idx_tup_fetch || 0),
        storageBytes: Number(row.index_size_bytes || 0),
        recommendation: Number(row.idx_scan || 0) === 0 ? "review unused index before dropping" : "keep monitoring workload benefit",
      }));
      return { table, indexes, source: "live" };
    } finally {
      client.release();
    }
  }

  async explainQuery({ query, sql, analyze }) {
    const statement = String(sql || query || "");
    const safety = validateSqlSafety(statement, { readOnly: true });
    if (!safety.safe) {
      return {
        error: "unsafe_sql",
        executed: false,
        violations: safety.violations,
        source: this.driver && this.pool ? "live" : "mock",
      };
    }
    if (!statement || !this.driver || !this.pool) {
      return {
        plan: "Adapter-ExecutionPlan(offline)",
        bottlenecks: [],
        rewriteHints: [],
        estimatedCost: null,
        confidence: "low",
        source: "mock",
      };
    }
    const client = await this.pool.connect();
    try {
      const explainOptions = "BUFFERS, FORMAT JSON";
      const explainPrefix = analyze === true ? `EXPLAIN (ANALYZE, ${explainOptions})` : `EXPLAIN (${explainOptions})`;
      const explain = await client.query(`${explainPrefix} ${statement}`);
      const plan = explain.rows?.[0]?.["QUERY PLAN"];
      const root = plan?.[0]?.Plan;
      if (!root) throw new Error("EXPLAIN returned no plan");
      const bottlenecks = [];
      const rewriteHints = [];
      const pending = [root];
      while (pending.length) {
        const node = pending.pop();
        if (node["Node Type"] === "Seq Scan" && node.Filter) {
          bottlenecks.push("filtered sequential scan; compare selectivity and table size before tuning");
          rewriteHints.push("evaluate predicate index candidates against measured workload");
        }
        if (Number(node["Temp Written Blocks"]) > 0 || node["Sort Space Type"] === "Disk") {
          bottlenecks.push("temporary disk usage observed in execution plan");
          rewriteHints.push("inspect spilling operators and memory requirements");
        }
        pending.push(...(node.Plans || []));
      }
      return {
        plan,
        bottlenecks: [...new Set(bottlenecks)],
        rewriteHints: [...new Set(rewriteHints)],
        estimatedCost: Number.isFinite(root["Total Cost"]) ? root["Total Cost"] : null,
        costUnit: "postgres_planner_cost",
        confidence: "medium",
        sourceQuery: statement,
        source: "live",
      };
    } catch (_error) {
      return {
        error: "EXPLAIN_FAILED",
        message: "Explain not available for statement",
        plan: "adapter_explain_unavailable",
        source: "live",
      };
    } finally {
      client.release();
    }
  }

  async detectPii({ database, schema = "public", table }) {
    const catalog = this.sampleCatalog.postgres?.schemas?.[database]?.[schema]?.tables?.[table];
    if (!this.driver || !this.pool) {
      if (!catalog) {
        return { piiColumns: [], sensitivityLevel: "unknown", policyViolations: [], remediation: "no schema context", source: "mock" };
      }
      const piiColumns = catalog.columns.filter((c) => c.pii).map((c) => c.name);
      return {
        piiColumns,
        sensitivityLevel: piiColumns.length ? "high" : "low",
        policyViolations: piiColumns.length ? ["PII exposure candidate detected"] : [],
        remediation: piiColumns.length ? "mask output and apply least privilege" : "no direct PII in sampled metadata",
        source: "mock",
      };
    }
    if (!table) {
      return { piiColumns: [], sensitivityLevel: "unknown", policyViolations: ["missing_target_table"], remediation: "provide table" };
    }
    const client = await this.pool.connect();
    try {
      const result = await client.query(
        "SELECT column_name FROM information_schema.columns WHERE table_schema=$1 AND table_name=$2 AND " +
          "(column_name ILIKE '%email%' OR column_name ILIKE '%ssn%' OR column_name ILIKE '%phone%' OR column_name ILIKE '%iban%')",
        [schema, table]
      );
      const piiColumns = mapRowRows(result.rows).map((r) => r.column_name || r);
      return {
        piiColumns,
        sensitivityLevel: piiColumns.length ? "high" : "low",
        policyViolations: piiColumns.length ? ["PII exposure candidate detected"] : [],
        remediation: piiColumns.length ? "mask output and narrow projection" : "no direct PII columns detected",
        source: "live",
      };
    } finally {
      client.release();
    }
  }

  async executeSql(sql, options = {}) {
    const statement = String(sql || "").trim();
    if (!statement) {
      return { error: "missing_sql", executed: false, source: "mock" };
    }
    const safety = validateSqlSafety(statement, {
      readOnly: !options.isMigration,
      allowWrite: Boolean(options.isMigration || options.allowWrite),
      isMigration: Boolean(options.isMigration),
    });
    if (!safety.safe) {
      return {
        error: "unsafe_sql",
        executed: false,
        violations: safety.violations,
        statement,
        database: options.database,
        schema: options.schema,
        tool: options.tool,
        source: this.driver && this.pool ? "live" : "mock",
      };
    }
    const fallback = {
      statement,
      executed: false,
      affectedRows: 0,
      durationMs: 0,
      database: options.database,
      schema: options.schema,
      tool: options.tool,
      source: this.driver && this.pool ? "live" : "mock",
    };
    if (!this.driver || !this.pool) {
      return {
        ...fallback,
        mockReason: "no_connection",
      };
    }
    const start = Date.now();
    const client = await this.pool.connect();
    try {
      const result = await client.query(statement);
      return {
        ...fallback,
        executed: true,
        affectedRows: result?.rowCount || 0,
        durationMs: Date.now() - start,
        fields: result?.fields ? result.fields.length : 0,
        source: "live",
      };
    } catch (error) {
      return {
        ...fallback,
        error: "execution_failed",
        message: String(error?.message || error),
        durationMs: Date.now() - start,
        source: "live_error",
      };
    } finally {
      client.release();
    }
  }
}

module.exports = {
  PostgresAdapter,
};
