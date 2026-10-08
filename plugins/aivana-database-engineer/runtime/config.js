const path = require("node:path");

function asBoolean(raw, fallback = false) {
  if (raw === undefined || raw === null) {
    return fallback;
  }
  const normalized = String(raw).trim().toLowerCase();
  return ["1", "true", "yes", "on", "enabled"].includes(normalized);
}

const defaultPolicy = {
  sandboxPolicy: {
    allowHighRiskInSandbox: false,
    highRiskDecision: "BLOCK",
  },
  risk: {
    LOW: {
      action: "AUTO_EXECUTE",
      requiresApproval: false,
      maxExecutionWindowMs: 5000,
    },
    MEDIUM: {
      action: "HUMAN_APPROVAL",
      requiresApproval: true,
      maxExecutionWindowMs: 120000,
    },
    HIGH: {
      action: "BLOCK",
      requiresApproval: true,
      maxExecutionWindowMs: 0,
    },
    CRITICAL: {
      action: "SANDBOX_ONLY",
      requiresApproval: true,
      maxExecutionWindowMs: 30000,
    },
  },
  piiColumnHints: ["email", "phone", "ssn", "taxid", "iban", "passport", "address"],
  intentDefaults: {
    roundTripMode: "parser_lightpath",
    stableExecutionPolicy: true,
  },
  restrictedSchemas: ["pg_catalog", "information_schema", "sys", "mysql", "master", "msdb"],
  allowedWriteActionsInProduction: [
    "simulate_query",
    "propose_migration",
    "create_index",
    "optimize_query",
  ],
  rolePolicy: {
    defaultRole: "developer",
    roleAliases: {
      admin: "db_admin",
      dba: "db_admin",
      "lead_dba": "db_admin",
    },
    roles: {
      db_admin: {
        allowedWriteActionsInProduction: [
          "simulate_query",
          "propose_migration",
          "create_index",
          "rollback_migration",
          "optimize_query",
          "create_partitioning",
        ],
        allowedSchemasInProduction: ["public", "dbo", "analytics", "app_schema"],
      },
      platform_engineer: {
        allowedWriteActionsInProduction: ["simulate_query", "propose_migration", "optimize_query"],
        allowedSchemasInProduction: ["public", "analytics"],
      },
      developer: {
        allowedWriteActionsInProduction: ["simulate_query"],
        allowedSchemasInProduction: ["public", "dbo"],
      },
      observer: {
        allowedWriteActionsInProduction: [],
        allowedSchemasInProduction: ["public", "dbo"],
      },
    },
    rolePrefix: "role:",
  },
  defaultEnvironment: "lab",
  queryAllowlistMode: "off",
  queryAllowlist: [],
  migrationSigning: {
    requireInProduction: true,
    enforceForTools: ["create_index", "create_partitioning", "rollback_migration", "propose_migration", "optimize_query", "simulate_query"],
    allowDryRunWithoutSignature: true,
    requireNotExpired: true,
  },
  auth: {
    provider: "env_json",
    requireLiveConnection: false,
    liveConnectionTimeoutMs: 5000,
    secretStorePaths: ["CODEXDB_SECRET_FILE", "CODEXDB_SECRETS_FILE"],
    secretStoreEnv: ["CODEXDB_SECRET_JSON", "CODEXDB_SECRETS_JSON"],
    allowedProfileEnvKeys: ["CODEXDB_CONNECTION_PROFILE", "CODEXDB_PROFILE"],
  },
  rls: {
    enabled: false,
    requireTenantContext: false,
    allowedTenantIds: [],
    fallbackMode: "warn",
  },
  replay: {
    enabled: true,
    includePayload: false,
    maxEntries: 5000,
    emitDecisionGraph: true,
  },
};

const sampleCatalog = {
  sqlserver: {
    databases: [
      { database: "app_prod", engine: "sqlserver", state: "online", owner: "dbo" },
      { database: "app_audit", engine: "sqlserver", state: "online", owner: "dbo" },
      { database: "analytics", engine: "sqlserver", state: "readonly", owner: "report" },
    ],
    schemas: {
      app_prod: {
        public: {
          tables: {
            users: {
              columns: [
                { name: "id", type: "int", nullable: false, isPrimaryKey: true },
                { name: "email", type: "varchar(255)", nullable: false, pii: true },
                { name: "created_at", type: "datetime2", nullable: false },
              ],
              indexes: [{ name: "pk_users", unique: true, seekScore: 0.94 }],
              relationships: [{ target: "orders", cardinality: "one-to-many", via: "user_id" }],
              containsPII: true,
              rowCountHint: 120_000,
            },
            orders: {
              columns: [
                { name: "id", type: "int", nullable: false, isPrimaryKey: true },
                { name: "user_id", type: "int", nullable: false, isForeignKey: true },
                { name: "total_amount", type: "decimal(18,2)", nullable: false },
                { name: "status", type: "varchar(20)", nullable: false },
              ],
              indexes: [{ name: "ix_orders_user_id", unique: false, seekScore: 0.74 }],
              relationships: [],
              containsPII: false,
              rowCountHint: 860_000,
            },
          },
        },
      },
      analytics: {
        public: {
          tables: {
            query_snapshot: {
              columns: [
                { name: "id", type: "bigint", nullable: false, isPrimaryKey: true },
                { name: "query_hash", type: "binary(16)", nullable: false },
                { name: "duration_ms", type: "int", nullable: false },
                { name: "cpu_ms", type: "int", nullable: false },
              ],
              indexes: [{ name: "pk_query_snapshot", unique: true, seekScore: 0.61 }],
              relationships: [],
              containsPII: false,
              rowCountHint: 3_200_000,
            },
          },
        },
      },
    },
  },
  postgres: {
    databases: [
      { database: "analytics", engine: "postgres", state: "online", owner: "postgres" },
      { database: "dw", engine: "postgres", state: "read-only", owner: "meta" },
    ],
    schemas: {
      analytics: {
        public: {
          tables: {
            events: {
              columns: [
                { name: "event_id", type: "uuid", nullable: false, isPrimaryKey: true },
                { name: "user_email", type: "text", nullable: false, pii: true },
                { name: "payload", type: "jsonb", nullable: true },
              ],
              indexes: [{ name: "events_pkey", unique: true, seekScore: 0.88 }],
              relationships: [{ target: "customers", cardinality: "many-to-one", via: "payload->>'customer_id'" }],
              containsPII: true,
              rowCountHint: 42_000_000,
            },
            customers: {
              columns: [
                { name: "customer_id", type: "uuid", nullable: false, isPrimaryKey: true },
                { name: "name", type: "text", nullable: false },
                { name: "email", type: "text", nullable: false, pii: true },
              ],
              indexes: [{ name: "customers_pkey", unique: true, seekScore: 0.9 }],
              relationships: [],
              containsPII: true,
              rowCountHint: 1_200_000,
            },
          },
        },
      },
    },
  },
};

function getPolicy() {
  const overrides = {};
  try {
    overrides.piiColumnHints = process.env.CODEXDB_PII_HINTS
      ? process.env.CODEXDB_PII_HINTS.split(",").map((x) => x.trim().toLowerCase()).filter(Boolean)
      : undefined;
  } catch {}
  try {
    const allowHighRiskInSandbox = process.env.CODEXDB_SCOPE_HIGH_TO_SANDBOX;
    if (allowHighRiskInSandbox !== undefined) {
      overrides.sandboxPolicy = {
        ...defaultPolicy.sandboxPolicy,
        allowHighRiskInSandbox: String(allowHighRiskInSandbox).trim().toLowerCase() === "true",
        highRiskDecision: asBoolean(allowHighRiskInSandbox, defaultPolicy.sandboxPolicy.allowHighRiskInSandbox) ? "SCOPE_TO_SANDBOX" : "BLOCK",
      };
    }
  } catch {}
  try {
    if (process.env.CODEXDB_AUTH_SECRET_PROVIDER) {
      overrides.auth = {
        ...defaultPolicy.auth,
        provider: process.env.CODEXDB_AUTH_SECRET_PROVIDER,
      };
    }
    if (process.env.CODEXDB_REQUIRE_LIVE_CONNECTION !== undefined || process.env.CODEXDB_LIVE_CONNECTION_TIMEOUT_MS) {
      overrides.auth = {
        ...defaultPolicy.auth,
        ...(overrides.auth || {}),
        requireLiveConnection: asBoolean(process.env.CODEXDB_REQUIRE_LIVE_CONNECTION, defaultPolicy.auth.requireLiveConnection),
        liveConnectionTimeoutMs: Number(process.env.CODEXDB_LIVE_CONNECTION_TIMEOUT_MS || defaultPolicy.auth.liveConnectionTimeoutMs),
      };
    }
    if (process.env.CODEXDB_RLS_ENABLED !== undefined) {
      overrides.rls = {
        ...defaultPolicy.rls,
        enabled: asBoolean(process.env.CODEXDB_RLS_ENABLED, defaultPolicy.rls.enabled),
      };
    }
    if (process.env.CODEXDB_RLS_REQUIRE_TENANT_CONTEXT !== undefined) {
      overrides.rls = {
        ...defaultPolicy.rls,
        ...overrides.rls,
        requireTenantContext: asBoolean(process.env.CODEXDB_RLS_REQUIRE_TENANT_CONTEXT, defaultPolicy.rls.requireTenantContext),
      };
    }
    if (process.env.CODEXDB_RLS_TENANTS) {
      overrides.rls = {
        ...defaultPolicy.rls,
        ...overrides.rls,
        allowedTenantIds: process.env.CODEXDB_RLS_TENANTS.split(",").map((x) => x.trim()).filter(Boolean),
      };
    }
  } catch {}
  try {
    overrides.restrictedSchemas = process.env.CODEXDB_RESTRICTED_SCHEMAS
      ? process.env.CODEXDB_RESTRICTED_SCHEMAS.split(",").map((x) => x.trim().toLowerCase()).filter(Boolean)
      : undefined;
  } catch {}
  try {
    overrides.defaultEnvironment = process.env.CODEXDB_DEFAULT_ENV || defaultPolicy.defaultEnvironment;
  } catch {}
  try {
    const rolePolicyOverride = process.env.CODEXDB_ROLE_POLICY;
    if (rolePolicyOverride) {
      const parsedRolePolicy = JSON.parse(rolePolicyOverride);
      overrides.rolePolicy = {
        ...defaultPolicy.rolePolicy,
        ...parsedRolePolicy,
        roles: {
          ...defaultPolicy.rolePolicy.roles,
          ...(parsedRolePolicy.roles || {}),
        },
      };
    }
  } catch {}
  try {
    const allowedWrites = process.env.CODEXDB_ALLOWED_WRITE_ACTIONS_PROD;
    if (allowedWrites) {
      overrides.allowedWriteActionsInProduction = allowedWrites
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean);
    }
  } catch {}
  try {
    const queryAllowlistMode = process.env.CODEXDB_QUERY_ALLOWLIST_MODE;
    if (queryAllowlistMode) {
      overrides.queryAllowlistMode = queryAllowlistMode.trim().toLowerCase();
    }
  } catch {}
  try {
    const rawQueryAllowlist = process.env.CODEXDB_QUERY_ALLOWLIST;
    if (rawQueryAllowlist) {
      overrides.queryAllowlist = rawQueryAllowlist
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean);
    }
  } catch {}
  try {
    overrides.migrationSigning = {
      ...defaultPolicy.migrationSigning,
      requireInProduction: asBoolean(process.env.CODEXDB_REQUIRE_MIGRATION_SIGNATURE, defaultPolicy.migrationSigning.requireInProduction),
      allowDryRunWithoutSignature: asBoolean(
        process.env.CODEXDB_ALLOW_DRYRUN_WITHOUT_SIGNATURE,
        defaultPolicy.migrationSigning.allowDryRunWithoutSignature,
      ),
      requireNotExpired: asBoolean(
        process.env.CODEXDB_REQUIRE_MIGRATION_SIGNATURE_NOT_EXPIRED,
        defaultPolicy.migrationSigning.requireNotExpired,
      ),
    };
    if (process.env.CODEXDB_MIGRATION_SIGNING_TOOLS) {
      overrides.migrationSigning.enforceForTools = process.env.CODEXDB_MIGRATION_SIGNING_TOOLS
        .split(",")
        .map((x) => x.trim().toLowerCase())
        .filter(Boolean);
    }
  } catch {}
  try {
    overrides.replay = {
      ...defaultPolicy.replay,
      enabled: asBoolean(process.env.CODEXDB_REPLAY_ENABLED, defaultPolicy.replay.enabled),
      includePayload: asBoolean(process.env.CODEXDB_REPLAY_INCLUDE_PAYLOAD, defaultPolicy.replay.includePayload),
      maxEntries: Number(process.env.CODEXDB_REPLAY_MAX_ENTRIES || defaultPolicy.replay.maxEntries),
    };
  } catch {}

  return {
    ...defaultPolicy,
    ...overrides,
    piiColumnHints: overrides.piiColumnHints || defaultPolicy.piiColumnHints,
    restrictedSchemas: overrides.restrictedSchemas || defaultPolicy.restrictedSchemas,
    allowedWriteActionsInProduction:
      overrides.allowedWriteActionsInProduction || defaultPolicy.allowedWriteActionsInProduction,
    rolePolicy: overrides.rolePolicy || defaultPolicy.rolePolicy,
    queryAllowlistMode: overrides.queryAllowlistMode || defaultPolicy.queryAllowlistMode,
    queryAllowlist: overrides.queryAllowlist || defaultPolicy.queryAllowlist,
    migrationSigning: overrides.migrationSigning || defaultPolicy.migrationSigning,
    auth: overrides.auth || defaultPolicy.auth,
    rls: overrides.rls || defaultPolicy.rls,
    sandboxPolicy: overrides.sandboxPolicy || defaultPolicy.sandboxPolicy,
    replay: overrides.replay || defaultPolicy.replay,
    defaultEnvironment: process.env.CODEXDB_DEFAULT_ENV || defaultPolicy.defaultEnvironment,
  };
}

function resolveCatalog() {
  return {
    sampleCatalog,
    policy: getPolicy(),
    projectRoot: process.cwd(),
    stateFile: path.join(process.env.CODEXDB_STATE_DIR || path.join(process.cwd(), ".codexdb"), "runtime-state.json"),
  };
}

module.exports = {
  defaultPolicy,
  sampleCatalog,
  getPolicy,
  resolveCatalog,
};
