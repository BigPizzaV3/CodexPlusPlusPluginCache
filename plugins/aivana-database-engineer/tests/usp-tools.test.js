const test = require("node:test");
const assert = require("node:assert/strict");
const { dispatch } = require("../runtime/orchestrator");

test("retrieve_context returns memory and retrieval metadata", async () => {
  const result = await dispatch("retrieve_context", {
    query: "orders latency after deployment",
    sources: ["ddl", "runbooks", "tickets"],
  });

  assert.equal(result.retrieval.query, "orders latency after deployment");
  assert.ok(Array.isArray(result.retrieval.sources));
  assert.ok(Array.isArray(result.contextPacks));
});

test("query_time_machine reconstructs historical query states", async () => {
  const result = await dispatch("query_time_machine", {
    queryId: "q-1122",
    windowHours: 24,
  });

  assert.equal(result.queryId, "q-1122");
  assert.ok(Array.isArray(result.timeline));
  assert.ok(result.regressionPoint);
});

test("deadlock_simulator predicts deadlock risk", async () => {
  const result = await dispatch("deadlock_simulator", {
    transactions: [
      { id: "t1", locks: ["orders:write", "users:read"] },
      { id: "t2", locks: ["users:write", "orders:read"] },
    ],
  });

  assert.ok(["low", "medium", "high"].includes(result.deadlockRisk));
  assert.ok(Array.isArray(result.waitForGraph.edges));
});

test("evolve_indexes produces index evolution recommendations", async () => {
  const result = await dispatch("evolve_indexes", {
    engine: "postgres",
    database: "analytics",
    schema: "public",
    table: "events",
  });

  assert.equal(result.table, "events");
  assert.ok(Array.isArray(result.recommendations));
  assert.ok(result.evolutionPlan);
});

test("describe_business_layer maps tables to business entities", async () => {
  const result = await dispatch("describe_business_layer", {
    engine: "sqlserver",
    database: "app_prod",
    schema: "public",
  });

  assert.ok(Array.isArray(result.businessEntities));
  assert.ok(result.semanticSummary.nodeCount >= 1);
});

test("cost_intelligence ranks cost drivers", async () => {
  const result = await dispatch("cost_intelligence", {
    sql: "SELECT * FROM orders WHERE status = 'open'",
    baselineP95: 80,
  });

  assert.ok(Array.isArray(result.costDrivers));
  assert.ok(result.unitEconomics);
});

test("telemetry_correlation summarizes observability signals", async () => {
  const result = await dispatch("telemetry_correlation", {
    deploymentId: "deploy-42",
  });

  assert.equal(result.deploymentId, "deploy-42");
  assert.ok(result.correlation);
  assert.ok(Array.isArray(result.telemetryRefs));
});

test("agent_coordination returns a multi-agent execution plan", async () => {
  const result = await dispatch("agent_coordination", {
    objective: "reduce checkout query latency",
    riskLevel: "MEDIUM",
  });

  assert.equal(result.objective, "reduce checkout query latency");
  assert.ok(Array.isArray(result.coordinationPlan.steps));
});
