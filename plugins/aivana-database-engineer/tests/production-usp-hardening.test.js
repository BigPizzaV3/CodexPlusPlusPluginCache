const test = require("node:test");
const assert = require("node:assert/strict");
const { dispatch } = require("../runtime/orchestrator");

function withEnv(overrides, fn) {
  const previous = {};
  for (const key of Object.keys(overrides)) {
    previous[key] = process.env[key];
    process.env[key] = overrides[key];
  }
  return Promise.resolve()
    .then(fn)
    .finally(() => {
      for (const key of Object.keys(overrides)) {
        if (previous[key] === undefined) {
          delete process.env[key];
        } else {
          process.env[key] = previous[key];
        }
      }
    });
}

test("retrieve_context reports configured pgvector and neo4j grounding", async () => {
  await withEnv({
    CODEXDB_PGVECTOR_CONNECTION_STRING: "postgres://user:secret@example/db",
    CODEXDB_NEO4J_URI: "neo4j://example",
  }, async () => {
    const result = await dispatch("retrieve_context", {
      query: "checkout query regression",
      sources: ["ddl", "runbooks"],
    });

    assert.equal(result.grounding.connectorStatus.pgvector, "configured");
    assert.equal(result.grounding.connectorStatus.neo4j, "configured");
    assert.deepEqual(result.grounding.missingConnectors, []);
  });
});

test("semantic_memory_index emits pgvector upsert contract when configured", async () => {
  await withEnv({
    CODEXDB_PGVECTOR_CONNECTION_STRING: "postgres://user:secret@example/db",
  }, async () => {
    const result = await dispatch("semantic_memory_index", {
      query: "orders latency",
      documents: [{ id: "runbook-1", text: "orders latency index runbook" }],
    });

    assert.equal(result.index.persistence, "pgvector");
    assert.equal(result.connector.status, "configured");
    assert.equal(result.connector.upsertRequest.connectionString, "***redacted***");
  });
});

test("telemetry_connector_ingest normalizes OpenTelemetry metric payloads", async () => {
  const result = await dispatch("telemetry_connector_ingest", {
    provider: "otel",
    resourceMetrics: [
      {
        scopeMetrics: [
          {
            metrics: [
              {
                name: "db.query.duration",
                unit: "ms",
                dataPoints: [{ asDouble: 950, attributes: { "db.system": "postgresql" } }],
              },
            ],
          },
        ],
      },
    ],
  });

  assert.equal(result.normalizedSignals.length, 1);
  assert.equal(result.normalizedSignals[0].name, "db.query.duration");
  assert.equal(result.normalizedSignals[0].severity, "high");
  assert.equal(result.source, "otel_payload");
});

test("estimate_cost uses supplied plan metrics as live evidence", async () => {
  const result = await dispatch("estimate_cost", {
    sql: "SELECT * FROM orders WHERE status = 'open'",
    planMetrics: {
      p95Ms: 420,
      cpuMs: 110,
      sharedBlocksRead: 900,
      lockWaitMs: 20,
    },
  });

  assert.equal(result.source, "live_evidence");
  assert.equal(result.estimatedCost.baseline.p95Ms, 420);
  assert.equal(result.estimatedImpact.regressionDelta.p95Ms, result.estimatedCost.regressionForecast.expectedP95MsDelta);
});

test("rls_masking_router blocks tenant-scoped tables when tenant context is required", async () => {
  await withEnv({
    CODEXDB_RLS_ENABLED: "true",
    CODEXDB_RLS_REQUIRE_TENANT_CONTEXT: "true",
  }, async () => {
    const result = await dispatch("rls_masking_router", {
      engine: "postgres",
      database: "analytics",
      schema: "public",
      table: "events",
      requestedColumns: ["event_id", "user_email"],
    });

    assert.equal(result.blocked, true);
    assert.equal(result.routePlan.rlsMode, "tenant_context_required");
    assert.ok(result.controls.includes("tenant_context_required"));
  });
});
