const { BaseDbAdapter } = require("./baseAdapter");
const { validateSqlSafety } = require("../sqlSafety");
const { buildConnectionString } = require("@tediousjs/connection-string");

function mapRow(rows = []) {
  return rows.map((r) => r.value || r);
}

function resolveMockTables(sampleCatalog, database, schema) {
  const requested = sampleCatalog.sqlserver?.schemas?.[database]?.[schema]?.tables;
  if (requested) {
    return requested;
  }
  if (schema === "dbo") {
    return sampleCatalog.sqlserver?.schemas?.[database]?.public?.tables || {};
  }
  return {};
}

const discoveryKinds = ["table", "view", "materialized_view", "column", "index", "primary_key", "foreign_key", "unique", "check", "default", "trigger", "procedure", "function", "sequence", "partition"];
const sqlDiscoveryQueries = {
  table: "SELECT TOP (10001) s.name AS [schema], t.name AS name, t.is_memory_optimized, t.temporal_type_desc FROM sys.tables t JOIN sys.schemas s ON s.schema_id=t.schema_id WHERE t.is_ms_shipped=0",
  view: "SELECT TOP (10001) s.name AS [schema], v.name AS name, m.definition, m.is_schema_bound FROM sys.views v JOIN sys.schemas s ON s.schema_id=v.schema_id LEFT JOIN sys.sql_modules m ON m.object_id=v.object_id WHERE v.is_ms_shipped=0",
  column: `SELECT TOP (10001) s.name AS [schema], QUOTENAME(t.name)+'.'+QUOTENAME(c.name) AS name, t.name AS table_name,
    c.name AS column_name, c.column_id AS ordinal, ty.name AS data_type, SCHEMA_NAME(ty.schema_id) AS type_schema,
    c.max_length, c.precision, c.scale, c.is_nullable, c.is_identity, c.is_computed, cc.definition
    FROM sys.columns c JOIN sys.objects t ON t.object_id=c.object_id JOIN sys.schemas s ON s.schema_id=t.schema_id
    JOIN sys.types ty ON ty.user_type_id=c.user_type_id LEFT JOIN sys.computed_columns cc ON cc.object_id=c.object_id AND cc.column_id=c.column_id
    WHERE t.is_ms_shipped=0 AND t.type IN ('U','V')`,
  index: `SELECT TOP (10001) s.name AS [schema], QUOTENAME(t.name)+'.'+QUOTENAME(i.name) AS name, t.name AS table_name,
    i.name AS index_name, i.type_desc AS index_type, i.is_unique, i.is_disabled, i.filter_definition,
    (SELECT ic.column_id, c.name, ic.key_ordinal, ic.is_descending_key, ic.is_included_column FROM sys.index_columns ic
      JOIN sys.columns c ON c.object_id=ic.object_id AND c.column_id=ic.column_id
      WHERE ic.object_id=i.object_id AND ic.index_id=i.index_id ORDER BY ic.index_column_id FOR JSON PATH) AS columns_json
    FROM sys.indexes i JOIN sys.objects t ON t.object_id=i.object_id JOIN sys.schemas s ON s.schema_id=t.schema_id
    WHERE t.is_ms_shipped=0 AND t.type IN ('U','V') AND i.index_id>0 AND i.name IS NOT NULL`,
  foreign_key: `SELECT TOP (10001) s.name AS [schema], QUOTENAME(t.name)+'.'+QUOTENAME(k.name) AS name, t.name AS table_name,
    k.name AS constraint_name, rs.name AS referenced_schema, rt.name AS referenced_table, k.is_disabled, k.is_not_trusted,
    k.delete_referential_action_desc, k.update_referential_action_desc,
    (SELECT pc.name AS parent_column, rc.name AS referenced_column FROM sys.foreign_key_columns f
      JOIN sys.columns pc ON pc.object_id=f.parent_object_id AND pc.column_id=f.parent_column_id
      JOIN sys.columns rc ON rc.object_id=f.referenced_object_id AND rc.column_id=f.referenced_column_id
      WHERE f.constraint_object_id=k.object_id ORDER BY f.constraint_column_id FOR JSON PATH) AS columns_json
    FROM sys.foreign_keys k JOIN sys.tables t ON t.object_id=k.parent_object_id JOIN sys.schemas s ON s.schema_id=t.schema_id
    LEFT JOIN sys.tables rt ON rt.object_id=k.referenced_object_id LEFT JOIN sys.schemas rs ON rs.schema_id=rt.schema_id WHERE t.is_ms_shipped=0`,
  check: `SELECT TOP (10001) s.name AS [schema], QUOTENAME(t.name)+'.'+QUOTENAME(k.name) AS name, t.name AS table_name,
    k.name AS constraint_name, k.definition, k.is_disabled, k.is_not_trusted FROM sys.check_constraints k
    JOIN sys.tables t ON t.object_id=k.parent_object_id JOIN sys.schemas s ON s.schema_id=t.schema_id WHERE t.is_ms_shipped=0`,
  default: `SELECT TOP (10001) s.name AS [schema], QUOTENAME(t.name)+'.'+QUOTENAME(k.name) AS name, t.name AS table_name,
    k.name AS constraint_name, c.name AS column_name, k.definition FROM sys.default_constraints k
    JOIN sys.tables t ON t.object_id=k.parent_object_id JOIN sys.schemas s ON s.schema_id=t.schema_id
    JOIN sys.columns c ON c.object_id=t.object_id AND c.column_id=k.parent_column_id WHERE t.is_ms_shipped=0`,
  trigger: `SELECT TOP (10001) s.name AS [schema], QUOTENAME(t.name)+'.'+QUOTENAME(k.name) AS name, t.name AS table_name,
    k.name AS trigger_name, k.is_disabled, k.is_instead_of_trigger, m.definition FROM sys.triggers k
    JOIN sys.objects t ON t.object_id=k.parent_id JOIN sys.schemas s ON s.schema_id=t.schema_id
    LEFT JOIN sys.sql_modules m ON m.object_id=k.object_id WHERE k.parent_class=1 AND k.is_ms_shipped=0 AND t.is_ms_shipped=0`,
  sequence: `SELECT TOP (10001) s.name AS [schema], q.name AS name, CONVERT(nvarchar(100),q.start_value) AS start_value,
    CONVERT(nvarchar(100),q.increment) AS increment, CONVERT(nvarchar(100),q.minimum_value) AS minimum,
    CONVERT(nvarchar(100),q.maximum_value) AS maximum, q.is_cycling FROM sys.sequences q JOIN sys.schemas s ON s.schema_id=q.schema_id WHERE q.is_ms_shipped=0`,
  partition: `SELECT TOP (10001) s.name AS [schema], QUOTENAME(t.name)+'.partition_'+CONVERT(varchar(12),p.partition_number) AS name,
    t.name AS table_name, p.partition_number, ps.name AS partition_scheme, pf.name AS partition_function, pf.boundary_value_on_right,
    CONVERT(nvarchar(4000),lo.value) AS lower_boundary, CONVERT(nvarchar(4000),hi.value) AS upper_boundary
    FROM sys.partitions p JOIN sys.tables t ON t.object_id=p.object_id JOIN sys.schemas s ON s.schema_id=t.schema_id
    JOIN sys.indexes i ON i.object_id=p.object_id AND i.index_id=p.index_id JOIN sys.partition_schemes ps ON ps.data_space_id=i.data_space_id
    JOIN sys.partition_functions pf ON pf.function_id=ps.function_id
    LEFT JOIN sys.partition_range_values lo ON lo.function_id=pf.function_id AND lo.boundary_id=p.partition_number-1
    LEFT JOIN sys.partition_range_values hi ON hi.function_id=pf.function_id AND hi.boundary_id=p.partition_number
    WHERE t.is_ms_shipped=0 AND p.index_id IN (0,1)`,
};
for (const [kind, type] of [["primary_key", "PK"], ["unique", "UQ"]]) {
  sqlDiscoveryQueries[kind] = `SELECT TOP (10001) s.name AS [schema], QUOTENAME(t.name)+'.'+QUOTENAME(k.name) AS name, t.name AS table_name,
    k.name AS constraint_name, k.unique_index_id,
    (SELECT c.name, ic.key_ordinal, ic.is_descending_key FROM sys.index_columns ic
      JOIN sys.columns c ON c.object_id=ic.object_id AND c.column_id=ic.column_id
      WHERE ic.object_id=k.parent_object_id AND ic.index_id=k.unique_index_id AND ic.key_ordinal>0 ORDER BY ic.key_ordinal FOR JSON PATH) AS columns_json
    FROM sys.key_constraints k JOIN sys.tables t ON t.object_id=k.parent_object_id JOIN sys.schemas s ON s.schema_id=t.schema_id
    WHERE t.is_ms_shipped=0 AND k.type='${type}'`;
}
for (const [kind, types] of [["procedure", "'P','PC'"], ["function", "'FN','IF','TF','FS','FT'"]]) {
  sqlDiscoveryQueries[kind] = `SELECT TOP (10001) s.name AS [schema], o.name AS name, o.type_desc AS routine_type, m.definition,
    m.execute_as_principal_id FROM sys.objects o JOIN sys.schemas s ON s.schema_id=o.schema_id
    LEFT JOIN sys.sql_modules m ON m.object_id=o.object_id WHERE o.is_ms_shipped=0 AND o.type IN (${types})`;
}

class SqlServerAdapter extends BaseDbAdapter {
  constructor(context, connectionConfig) {
    super(context);
    this.connectionConfig = connectionConfig;
    this.connection = null;
    this.driver = null;
  }

  async initialize() {
    const windowsAuth = this.connectionConfig?.authentication === "windows";
    try {
      this.driver = require(windowsAuth ? "mssql/msnodesqlv8" : "mssql");
    } catch (_error) {
      if (windowsAuth) throw new Error("Windows authentication requires the optional msnodesqlv8 package and Microsoft ODBC driver");
      this.driver = null;
      return { initialized: true, adapter: "mock_sqlserver" };
    }
    if (!this.connectionConfig || (!this.connectionConfig.server && !this.connectionConfig.connectionString)) {
      return { initialized: true, adapter: "mock_sqlserver" };
    }
    const poolConfig = this.connectionConfig.connectionString
      ? this.connectionConfig.connectionString
      : {
          server: this.connectionConfig.server,
          ...(windowsAuth ? { connectionString: buildConnectionString({
            Driver: this.connectionConfig.odbcDriver || "ODBC Driver 18 for SQL Server",
            Server: this.connectionConfig.port ? `${this.connectionConfig.server},${Number(this.connectionConfig.port)}` : this.connectionConfig.server,
            Database: this.connectionConfig.database,
            Trusted_Connection: true,
            Encrypt: String(this.connectionConfig.encrypt || "true").toLowerCase() !== "false",
            TrustServerCertificate: String(this.connectionConfig.trustServerCertificate || "false").toLowerCase() === "true",
          }) } : {}),
          user: this.connectionConfig.user,
          password: this.connectionConfig.password,
          database: this.connectionConfig.database,
          ...(this.connectionConfig.port ? { port: Number(this.connectionConfig.port) } : {}),
          connectionTimeout: Number(this.context.policy?.auth?.liveConnectionTimeoutMs || 5000),
          requestTimeout: Number(this.connectionConfig.requestTimeoutMs || 30000),
          pool: {
            max: Number(this.connectionConfig.poolMax || 5),
            min: 0,
          },
          options: {
            ...(windowsAuth ? { trustedConnection: true } : {}),
            encrypt: String(this.connectionConfig.encrypt || "true").toLowerCase() !== "false",
            trustServerCertificate: String(this.connectionConfig.trustServerCertificate || "false").toLowerCase() === "true",
          },
        };
    this.connection = new this.driver.ConnectionPool(poolConfig);
    await this.connection.connect();
    return { initialized: true, adapter: "sqlserver_adapter" };
  }

  async close() {
    if (this.connection && this.connection.close) {
      await this.connection.close();
    }
    return { closed: true };
  }

  getCapabilities() {
    const live = Boolean(this.driver && this.connection);
    return { engine: "sqlserver", live, discover: live, readOnly: live, explain: live, performance: live, security: live,
      capabilitiesAreNotPermissionChecks: true, limitations: ["Performance and metadata depend on catalog/DMV privileges; explain is not execution approval", "Discovery and security have no offline fallback"] };
  }

  async _readCatalog(sql) {
    if (!this.driver || !this.connection) throw new Error("Live SQL Server connection required");
    const request = this.connection.request();
    let timedOut = false;
    // Request.cancel works for both tedious and msnodesqlv8 without changing shared pool configuration.
    const timer = setTimeout(() => { timedOut = true; request.cancel(); }, 5000);
    try {
      const result = await request.query(sql);
      if (timedOut) throw new Error("Catalog query timeout");
      if (!Array.isArray(result.recordset)) throw new Error("Invalid catalog response");
      if (result.recordset.length > 10000 || Buffer.byteLength(JSON.stringify(result.recordset)) > 8 * 1024 * 1024) {
        throw Object.assign(new Error("Catalog limit exceeded; discovery is incomplete"), { code: "CATALOG_LIMIT" });
      }
      return result.recordset;
    } finally { clearTimeout(timer); }
  }

  async discoverDatabase() {
    const [identity] = await this._readCatalog("SELECT DB_NAME() AS [database], CONVERT(nvarchar(128),SERVERPROPERTY('ProductVersion')) AS version, HAS_PERMS_BY_NAME(DB_NAME(),'DATABASE','VIEW DEFINITION') AS view_definition");
    if (!identity?.database || !identity?.version) throw new Error("Missing live database identity");
    const objects = [], coverage = {}, limitations = ["Visible user catalogs only; VIEW DEFINITION does not attest absence of object-level denies",
      "SQL Server 2016+ catalogs; encrypted/CLR definitions may be unavailable; DDL triggers and legacy bound defaults are outside V1",
      "Indexed views are represented as views plus indexes, not materialized_view objects", "Catalog queries are not one atomic snapshot"];
    const identities = new Set();
    for (const kind of discoveryKinds) {
      if (!sqlDiscoveryQueries[kind]) { coverage[kind] = "unsupported"; continue; }
      let rows;
      try { rows = await this._readCatalog(`${sqlDiscoveryQueries[kind]} ORDER BY 1,2 /* discovery:${kind} */`); }
      catch (error) {
        if (![229, 230, 208, 207, 15151].includes(error.number)) throw error;
        coverage[kind] = "unavailable"; limitations.push(`${kind}: catalog permission or version unavailable`); continue;
      }
      coverage[kind] = "collected";
      for (const row of rows) {
        const { schema, name, definition, columns_json, ...attributes } = row;
        const id = JSON.stringify([kind, schema, name]);
        if (typeof schema !== "string" || !schema || typeof name !== "string" || !name || identities.has(id)) throw new Error("Invalid or duplicate catalog identity");
        if (columns_json !== undefined) {
          attributes.columns = JSON.parse(columns_json);
          if (!Array.isArray(attributes.columns)) throw new Error("Invalid catalog column collection");
        }
        if (Object.hasOwn(row, "definition") && definition === null) attributes.definitionUnavailable = true;
        identities.add(id);
        objects.push({ kind, schema, name, ...(typeof definition === "string" ? { definition } : {}), attributes });
      }
    }
    return { engine: "sqlserver", database: identity.database, version: identity.version, objects, coverage, limitations, source: "live", complete: false };
  }

  async getSecurityFindings() {
    if (!this.driver || !this.connection) throw new Error("Live SQL Server connection required");
    const queries = {
      database_grants: `SELECT TOP (10001) pr.name AS principal, p.state_desc, p.permission_name, p.class_desc, p.major_id, p.minor_id,
        OBJECT_SCHEMA_NAME(CASE WHEN p.class=1 THEN p.major_id END) AS object_schema, OBJECT_NAME(CASE WHEN p.class=1 THEN p.major_id END) AS object_name
        FROM sys.database_permissions p JOIN sys.database_principals pr ON pr.principal_id=p.grantee_principal_id
        WHERE p.state IN ('G','W') AND (p.permission_name IN ('CONTROL','ALTER','IMPERSONATE','TAKE OWNERSHIP','ALTER ANY USER','ALTER ANY ROLE')
          OR (pr.name='public' AND p.permission_name IN ('INSERT','UPDATE','DELETE','EXECUTE')))`,
      database_admin_memberships: `SELECT TOP (10001) m.name AS principal, r.name AS role FROM sys.database_role_members rm
        JOIN sys.database_principals m ON m.principal_id=rm.member_principal_id JOIN sys.database_principals r ON r.principal_id=rm.role_principal_id
        WHERE r.name IN ('db_owner','db_securityadmin','db_ddladmin')`,
      server_admin_memberships: `SELECT TOP (10001) m.name AS principal, r.name AS role FROM sys.server_role_members rm
        JOIN sys.server_principals m ON m.principal_id=rm.member_principal_id JOIN sys.server_principals r ON r.principal_id=rm.role_principal_id
        WHERE r.name IN ('sysadmin','securityadmin','serveradmin')`,
      server_grants: `SELECT TOP (10001) pr.name AS principal, p.permission_name, p.state_desc FROM sys.server_permissions p
        JOIN sys.server_principals pr ON pr.principal_id=p.grantee_principal_id WHERE p.state IN ('G','W')
        AND p.permission_name IN ('CONTROL SERVER','ALTER ANY LOGIN','IMPERSONATE ANY LOGIN','ALTER ANY SERVER ROLE')`,
      execution_context: `SELECT TOP (10001) s.name AS [schema], o.name AS object_name, m.execute_as_principal_id,
        USER_NAME(NULLIF(m.execute_as_principal_id,-2)) AS execution_principal FROM sys.sql_modules m
        JOIN sys.objects o ON o.object_id=m.object_id JOIN sys.schemas s ON s.schema_id=o.schema_id
        WHERE o.is_ms_shipped=0 AND m.execute_as_principal_id IS NOT NULL`,
    };
    const findings = [], coverage = {}, limitations = ["Visible direct grants and memberships only; not an effective-permission or exploitability proof",
      "Server metadata can be unavailable on hosted databases or hidden by permissions", "No MFA, unused-account, nested membership or external identity assessment"];
    for (const [category, sql] of Object.entries(queries)) {
      let rows;
      try { rows = await this._readCatalog(`${sql} ORDER BY 1 /* security:${category} */`); }
      catch (error) {
        if (![229, 230, 208, 207, 15151].includes(error.number)) throw error;
        coverage[category] = "unavailable"; limitations.push(`${category}: catalog unavailable`); continue;
      }
      coverage[category] = "collected";
      for (const row of rows) findings.push({ id: `${category}:${require("node:crypto").createHash("sha256").update(JSON.stringify(row)).digest("hex")}`,
        severity: category === "execution_context" ? "medium" : "high", evidence: row,
        reason: category === "execution_context" ? "Module uses an explicit execution principal or OWNER; review privilege boundary" : "Elevated catalog privilege or broad grant requires least-privilege review" });
    }
    return require("../auditLogger").sanitizeObject({ source: "live", findings, coverage, limitations });
  }

  async listDatabases() {
    if (!this.driver || !this.connection) {
      return mapRow(this.sampleCatalog.sqlserver?.databases || []);
    }
    const result = await this.connection.request().query("SELECT name FROM sys.databases WHERE name NOT IN ('master','tempdb','model','msdb')");
    return mapRow(result.recordset).map((name) => ({
      database: typeof name === "string" ? name : name.name,
      engine: "sqlserver",
      state: "online",
      owner: "dbo",
    }));
  }

  async listTables({ database, schema = "dbo" }) {
    const dbData = resolveMockTables(this.sampleCatalog, database, schema);
    if (!this.driver || !this.connection) {
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
    const request = this.connection.request();
    request.input("schema", this.driver.VarChar, schema);
    const result = await request.query(
      "SELECT t.name AS name, SUM(p.rows) AS row_count_hint, COUNT(DISTINCT i.index_id) AS index_count " +
        "FROM sys.schemas s JOIN sys.tables t ON t.schema_id=s.schema_id " +
        "LEFT JOIN sys.partitions p ON p.object_id=t.object_id AND p.index_id IN (0,1) " +
        "LEFT JOIN sys.indexes i ON i.object_id=t.object_id AND i.index_id > 0 " +
        "WHERE s.name=@schema GROUP BY t.name ORDER BY t.name"
    );
    return mapRow(result.recordset).map((row) => ({
      database,
      schema,
      table: row.name || row,
      type: "table",
      rowCountHint: Number(row.row_count_hint || 0),
      indexCount: Number(row.index_count || 0),
      containsPIIFlag: /email|ssn|phone|iban/i.test(String(row.name || row)),
    }));
  }

  async describeTable({ database, schema = "dbo", table }) {
    const catalog = resolveMockTables(this.sampleCatalog, database, schema)?.[table];
    if (!this.driver || !this.connection) {
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
    if (!database || !table) {
      return { error: "missing_target" };
    }
    const request = this.connection.request();
    request.input("schema", this.driver.VarChar, schema);
    request.input("table", this.driver.VarChar, table);
    const columns = await request.query(
      "SELECT c.name FROM sys.columns c JOIN sys.tables t ON t.object_id=c.object_id JOIN sys.schemas s ON t.schema_id=s.schema_id WHERE s.name=@schema AND t.name=@table"
    );
    const indexes = await request.query(
      "SELECT i.name, i.is_unique FROM sys.indexes i " +
      "JOIN sys.tables t ON t.object_id=i.object_id " +
      "JOIN sys.schemas s ON t.schema_id=s.schema_id " +
      "WHERE s.name=@schema AND t.name=@table AND i.index_id > 0"
    );
    return {
      database,
      schema,
      table,
      sampleColumns: mapRow(columns.recordset).map((c) => ({ name: c.name || c })),
      indexes: mapRow(indexes.recordset).map((i) => ({ name: i.name || i, unique: Boolean(i.is_unique) })),
      riskNotes: [],
    };
  }

  async describeRelationships({ database, schema = "dbo" }) {
    const schemaCatalog = this.sampleCatalog.sqlserver?.schemas?.[database]?.[schema]?.tables || {};
    if (!this.driver || !this.connection) {
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
    const request = this.connection.request();
    request.input("schema", this.driver.VarChar, schema);
    const fkRows = await request.query(
      "SELECT OBJECT_NAME(f.parent_object_id) AS source_table, OBJECT_NAME(f.referenced_object_id) AS target_table " +
      "FROM sys.foreign_keys f " +
      "JOIN sys.tables t ON t.object_id = f.parent_object_id " +
      "JOIN sys.schemas s ON s.schema_id = t.schema_id " +
      "WHERE s.name=@schema"
    );
    return {
      edges: mapRow(fkRows.recordset).map((row) => ({
        source: row.source_table,
        target: row.target_table,
        cardinality: "many-to-one",
        joinHint: "foreign key join",
        criticality: "medium",
      })),
    };
  }

  async queryStats() {
    const catalog = this.sampleCatalog.sqlserver || {};
    if (!this.driver || !this.connection) {
      return [
        { queryId: "sql-001", avgMs: 180, p95Ms: 700, ioWait: "low", cpuMs: 65, regressionScore: 0.12 },
        { queryId: "sql-002", avgMs: 24, p95Ms: 40, ioWait: "medium", cpuMs: 11, regressionScore: 0.06 },
      ];
    }
    const top = await this.connection.request().query(
      "SELECT TOP (10) qs.plan_handle, qs.statement_start_offset, qs.statement_end_offset, " +
      "qs.execution_count, qs.total_worker_time, qs.total_elapsed_time " +
      "FROM sys.dm_exec_query_stats qs " +
      "CROSS APPLY sys.dm_exec_plan_attributes(qs.plan_handle) AS pa " +
      "WHERE pa.attribute = 'dbid' AND CONVERT(int, pa.value) = DB_ID() " +
      "ORDER BY qs.total_worker_time DESC"
    );
    return mapRow(top.recordset).map((q) => ({
      queryId: `${Buffer.isBuffer(q.plan_handle) ? q.plan_handle.toString("hex") : q.plan_handle || "unknown"}:${q.statement_start_offset}:${q.statement_end_offset}`,
      avgMs: Number(q.execution_count) > 0 ? Number(q.total_elapsed_time) / Number(q.execution_count) / 1000 : null,
      totalElapsedMs: Number(q.total_elapsed_time) / 1000,
      p95Ms: null,
      ioWait: "unknown",
      cpuMs: Number(q.execution_count) > 0 ? Number(q.total_worker_time) / Number(q.execution_count) / 1000 : null,
      executionCount: Number(q.execution_count),
      regressionScore: null,
      source: "live",
      metricEvidence: {
        collector: "sys.dm_exec_query_stats",
        aggregation: "cached_plan_lifetime",
        cpuMs: "mean_worker_time_per_execution",
        unavailable: { p95Ms: "requires_execution_samples", ioWait: "not_collected_by_query_stats",
          regressionScore: "requires_comparable_baseline" },
      },
    }));
  }

  async lockAnalysis() {
    if (!this.driver || !this.connection) {
      return {
        deadlockRisk: "unknown",
        topWaiters: [],
        blockingChains: [],
        remediationPlan: ["configure live connection for lock analysis"],
        source: "mock",
      };
    }
    const result = await this.connection.request().query(
      "SELECT TOP (20) wt.session_id, wt.wait_type, wt.wait_duration_ms, wt.blocking_session_id, wt.resource_description " +
        "FROM sys.dm_os_waiting_tasks wt " +
        "WHERE wt.blocking_session_id IS NOT NULL OR wt.wait_type LIKE 'LCK%' " +
        "ORDER BY wt.wait_duration_ms DESC"
    );
    const rows = mapRow(result.recordset);
    const topWaiters = rows.map((row) => ({
      session: String(row.session_id),
      waitType: row.wait_type || "unknown",
      durationMs: Number(row.wait_duration_ms || 0),
      blockingSession: row.blocking_session_id ? String(row.blocking_session_id) : null,
      resource: row.resource_description || null,
    }));
    return {
      deadlockRisk: topWaiters.some((row) => row.durationMs > 10000) ? "high" : topWaiters.length ? "medium" : "low",
      topWaiters,
      blockingChains: topWaiters
        .filter((row) => row.blockingSession)
        .map((row) => ({ waiter: row.session, blocker: row.blockingSession, waitType: row.waitType })),
      remediationPlan: topWaiters.length
        ? ["inspect blocking sessions", "shorten transaction scope", "review missing indexes on blocked resources"]
        : ["no blocking waits observed"],
      source: "live",
    };
  }

  async indexUsage({ schema = "dbo", table } = {}) {
    if (!this.driver || !this.connection) {
      return { indexes: [], recommendation: "configure live connection for index usage", source: "mock" };
    }
    const request = this.connection.request();
    request.input("schema", this.driver.VarChar, schema);
    if (table) {
      request.input("table", this.driver.VarChar, table);
    }
    const tableFilter = table ? "AND t.name=@table " : "";
    const result = await request.query(
      "SELECT TOP (20) t.name AS table_name, i.name AS index_name, " +
        "COALESCE(us.user_seeks, 0) AS user_seeks, COALESCE(us.user_scans, 0) AS user_scans, " +
        "COALESCE(us.user_lookups, 0) AS user_lookups, COALESCE(us.user_updates, 0) AS user_updates " +
        "FROM sys.indexes i " +
        "JOIN sys.tables t ON t.object_id=i.object_id " +
        "JOIN sys.schemas s ON s.schema_id=t.schema_id " +
        "LEFT JOIN sys.dm_db_index_usage_stats us ON us.object_id=i.object_id AND us.index_id=i.index_id AND us.database_id=DB_ID() " +
        "WHERE s.name=@schema AND i.index_id > 0 " +
        tableFilter +
        "ORDER BY (COALESCE(us.user_seeks, 0) + COALESCE(us.user_scans, 0) + COALESCE(us.user_lookups, 0)) DESC"
    );
    const indexes = mapRow(result.recordset).map((row) => {
      const reads = Number(row.user_seeks || 0) + Number(row.user_scans || 0) + Number(row.user_lookups || 0);
      const writes = Number(row.user_updates || 0);
      return {
        table: row.table_name,
        index: row.index_name,
        usageScore: reads,
        reads,
        writes,
        recommendation: reads === 0 && writes > 0 ? "review write-only index before dropping" : "keep monitoring workload benefit",
      };
    });
    return { table, indexes, source: "live" };
  }

  async explainQuery({ query, sql }) {
    const statement = String(sql || query || "");
    const safety = validateSqlSafety(statement, { readOnly: true });
    if (!safety.safe) {
      return {
        error: "unsafe_sql",
        executed: false,
        violations: safety.violations,
        source: this.driver && this.connection ? "live" : "mock",
      };
    }
    if (!statement || !this.driver || !this.connection) {
      return {
        plan: "Adapter-ExecutionPlan(offline)",
        bottlenecks: [],
        rewriteHints: [],
        estimatedCost: null,
        confidence: "low",
        source: "mock",
      };
    }
    const transaction = new this.driver.Transaction(this.connection);
    await transaction.begin();
    let failure;
    let cleanupFailed = false;
    let output;
    try {
      await new this.driver.Request(transaction).batch("SET SHOWPLAN_XML ON");
      const result = await new this.driver.Request(transaction).batch(statement);
      const planRow = mapRow(result.recordset)[0] || {};
      const plan =
        planRow["Microsoft SQL Server 2005 XML Showplan"] ||
        planRow.ShowPlanXML ||
        planRow.showplan_xml ||
        "showplan_xml_unavailable";
      if (plan === "showplan_xml_unavailable") throw new Error("SQL Server returned no execution plan");
      output = {
        plan,
        bottlenecks: [],
        rewriteHints: ["validate predicates and projected indexes against showplan"],
        estimatedCost: null,
        confidence: plan === "showplan_xml_unavailable" ? "low" : "medium",
        source: "live",
        sourceQuery: statement,
      };
    } catch (error) {
      failure = error;
    } finally {
      try {
        await new this.driver.Request(transaction).batch("SET SHOWPLAN_XML OFF");
      } catch (error) {
        failure ||= error;
        cleanupFailed = true;
      }
      try { await transaction.rollback(); }
      catch (error) { failure ||= error; cleanupFailed = true; }
      if (cleanupFailed) await this.close();
    }
    if (failure) throw failure;
    return output;
  }

  async replicationStatus() {
    if (!this.driver || !this.connection) {
      return {
        topology: "primary-replica-1",
        lagSeconds: 0.0,
        trend: "stable",
        consistencyRisk: "low",
        action: "no configured replication adapter",
      };
    }
    const rs = await this.connection.request().query("SELECT @@SERVERNAME AS server_name, SERVERPROPERTY('IsHadrEnabled') AS hadr_enabled");
    const row = mapRow(rs.recordset)[0] || {};
    return {
      topology: row.hadr_enabled ? "hadr_enabled" : "standalone_or_unknown",
      lagSeconds: 0,
      trend: "stable",
      consistencyRisk: row.hadr_enabled ? "low" : "unknown",
      action: row.hadr_enabled ? "monitor_dtc_and_replication" : "confirm_replication_topology",
      source: "live",
    };
  }

  async detectPii({ database, schema = "dbo", table }) {
    const catalog = this.sampleCatalog.sqlserver?.schemas?.[database]?.[schema]?.tables?.[table];
    if (!this.driver || !this.connection) {
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
    const request = this.connection.request();
    request.input("schema", this.driver.VarChar, schema);
    request.input("table", this.driver.VarChar, table);
    const rows = await request.query(
      "SELECT c.name AS name FROM sys.columns c " +
      "JOIN sys.tables t ON c.object_id = t.object_id " +
      "JOIN sys.schemas s ON t.schema_id = s.schema_id " +
      "WHERE s.name=@schema AND t.name=@table AND " +
      "(c.name LIKE '%email%' OR c.name LIKE '%ssn%' OR c.name LIKE '%phone%' OR c.name LIKE '%iban%')"
    );
    const piiColumns = mapRow(rows.recordset).map((r) => r.name || r);
    return {
      piiColumns,
      sensitivityLevel: piiColumns.length ? "high" : "low",
      policyViolations: piiColumns.length ? ["PII exposure candidate detected"] : [],
      remediation: piiColumns.length ? "mask output and narrow projection" : "no direct PII columns detected",
      source: "live",
    };
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
        source: this.driver && this.connection ? "live" : "mock",
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
      source: this.driver && this.connection ? "live" : "mock",
    };
    if (!this.driver || !this.connection) {
      return {
        ...fallback,
        mockReason: "no_connection",
      };
    }
    const start = Date.now();
    try {
      const result = await this.connection.request().query(statement);
      return {
        ...fallback,
        executed: true,
        affectedRows: result?.rowsAffected?.reduce((sum, value) => sum + Number(value || 0), 0) || 0,
        durationMs: Date.now() - start,
        columns: result?.recordset ? result.recordset.columns : null,
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
    }
  }
}

module.exports = {
  SqlServerAdapter,
};
