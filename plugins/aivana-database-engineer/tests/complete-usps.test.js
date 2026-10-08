const test = require("node:test");
const assert = require("node:assert/strict");
const { dispatch } = require("../runtime/orchestrator");

test("rls_masking_router creates tenant and pii-safe routing plan", async () => {
  const result = await dispatch("rls_masking_router", {
    engine: "postgres",
    database: "analytics",
    schema: "public",
    table: "events",
    tenantId: "tenant-a",
    requestedColumns: ["event_id", "user_email", "payload"],
  });

  assert.equal(result.usp, "rls_masking_router");
  assert.ok(result.routePlan);
  assert.ok(result.routePlan.projectedColumns.some((column) => column.masked === true));
  assert.ok(result.controls.includes("tenant_scope_filter"));
  assert.ok(result.safeSql.includes("tenant_id"));
});

test("explainable_refactoring_dossier explains before and after change risk", async () => {
  const result = await dispatch("explainable_refactoring_dossier", {
    beforeSql: "SELECT * FROM events",
    afterSql: "SELECT event_id FROM events LIMIT 500",
    objective: "reduce IO and PII exposure",
  });

  assert.equal(result.usp, "explainable_refactoring_dossier");
  assert.ok(result.before.risk);
  assert.ok(result.after.risk);
  assert.ok(Array.isArray(result.explanation.reasons));
  assert.ok(result.rollbackPlan.steps.length >= 1);
});

test("performance_forecast predicts p95 and budget risk", async () => {
  const result = await dispatch("performance_forecast", {
    sql: "SELECT * FROM events WHERE user_email = 'a@example.com'",
    baselineP95: 120,
    trafficGrowthPct: 35,
    budgetLimitUnits: 80,
  });

  assert.equal(result.usp, "performance_forecast");
  assert.ok(result.forecast.predictedP95Ms > 0);
  assert.ok(["low", "medium", "high"].includes(result.budgetRisk.level));
  assert.ok(Array.isArray(result.recommendations));
});

test("semantic_memory_index builds local retrievable memory index", async () => {
  const result = await dispatch("semantic_memory_index", {
    documents: [
      { id: "runbook-1", text: "orders latency after deploy compare query plans" },
      { id: "policy-1", text: "mask email columns and require tenant scope" },
    ],
    query: "email tenant policy",
  });

  assert.equal(result.usp, "semantic_memory_index");
  assert.ok(result.index.documentCount >= 2);
  assert.ok(result.matches[0].score > 0);
  assert.equal(result.mode, "local_token_vector");
});

test("telemetry_connector_ingest normalizes observability events", async () => {
  const result = await dispatch("telemetry_connector_ingest", {
    provider: "otel",
    signals: [
      { name: "db.query.duration", value: 950, unit: "ms", attributes: { queryId: "q-1" } },
      { name: "db.lock.wait", value: 120, unit: "ms", attributes: { table: "events" } },
    ],
  });

  assert.equal(result.usp, "telemetry_connector_ingest");
  assert.equal(result.normalizedSignals.length, 2);
  assert.ok(result.correlationRefs.length >= 1);
  assert.ok(result.routingTargets.includes("telemetry_correlation"));
});

test("autonomous_verification_loop creates prove-before-apply gates", async () => {
  const result = await dispatch("autonomous_verification_loop", {
    tool: "create_index",
    engine: "postgres",
    database: "analytics",
    schema: "public",
    table: "events",
    proposedSql: "CREATE INDEX ix_events_email ON events(user_email)",
  });

  assert.equal(result.usp, "autonomous_verification_loop");
  assert.equal(result.verificationStatus, "pending_evidence");
  assert.ok(result.gates.some((gate) => gate.id === "replay"));
  assert.ok(result.releaseDecision);
});

test("sql_firewall_learning learns fingerprints and proposes policy rules", async () => {
  const result = await dispatch("sql_firewall_learning", {
    samples: [
      "SELECT event_id FROM events WHERE user_email = 'a@example.com'",
      "SELECT event_id FROM events WHERE user_email = 'b@example.com'",
      "DROP TABLE events",
    ],
  });

  assert.equal(result.usp, "sql_firewall_learning");
  assert.ok(result.learnedFingerprints.length >= 1);
  assert.ok(result.driftFindings.some((finding) => finding.severity === "critical"));
  assert.ok(result.proposedPolicyRules.length >= 1);
});

test("workload_twin simulates traffic and index scenarios", async () => {
  const result = await dispatch("workload_twin", {
    engine: "postgres",
    database: "analytics",
    schema: "public",
    table: "events",
    scenario: { trafficGrowthPct: 30, addIndex: ["user_email"], dropIndex: [] },
  });

  assert.equal(result.usp, "workload_twin");
  assert.ok(result.simulation.baseline);
  assert.ok(result.simulation.projected);
  assert.ok(Array.isArray(result.scenarioFindings));
});
