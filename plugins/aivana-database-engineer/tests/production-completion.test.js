const test = require("node:test");
const assert = require("node:assert/strict");
const { dispatch } = require("../runtime/orchestrator");

test("production_rollout_orchestrator returns go/no-go gates", async () => {
  const result = await dispatch("production_rollout_orchestrator", {
    engine: "postgres",
    database: "analytics",
    schema: "public",
    table: "events",
    proposedSql: "CREATE INDEX ix_events_created_at ON events(created_at)",
    environment: "production",
  });

  assert.equal(result.usp, "production_rollout_orchestrator");
  assert.ok(Array.isArray(result.gates));
  assert.ok(result.gates.some((gate) => gate.id === "production_readiness"));
  assert.ok(["go", "no_go", "needs_evidence"].includes(result.rolloutDecision));
});

test("connector checks report configured state without external calls", async () => {
  const pgvector = await dispatch("pgvector_connector_check", { engine: "postgres" });
  const prometheus = await dispatch("prometheus_connector_ingest", { metrics: [{ name: "db_qps", value: 42 }] });
  const grafana = await dispatch("grafana_annotation_export", { incidentId: "inc-1", text: "query regression" });
  const neo4j = await dispatch("neo4j_graph_export", { graphName: "schema" });

  assert.equal(pgvector.usp, "pgvector_connector_check");
  assert.ok(["configured", "not_configured"].includes(pgvector.status));
  assert.equal(prometheus.normalizedMetrics.length, 1);
  assert.ok(grafana.annotation);
  assert.ok(neo4j.export.cypher.length >= 1);
});

test("operator workflows summarize multiple lower-level capabilities", async () => {
  const onboard = await dispatch("onboard_database", {
    engine: "postgres",
    database: "analytics",
    schema: "public",
    table: "events",
  });
  const health = await dispatch("run_health_assessment", {
    engine: "postgres",
    database: "analytics",
    schema: "public",
    table: "events",
  });
  const incident = await dispatch("investigate_incident", {
    engine: "postgres",
    database: "analytics",
    deploymentId: "deploy-42",
  });
  const optimize = await dispatch("optimize_workload", {
    engine: "postgres",
    database: "analytics",
    schema: "public",
    table: "events",
    sql: "SELECT * FROM events WHERE user_email = 'a@example.com'",
  });

  assert.equal(onboard.workflow, "onboard_database");
  assert.ok(onboard.steps.length >= 3);
  assert.equal(health.workflow, "run_health_assessment");
  assert.ok(health.summary);
  assert.equal(incident.workflow, "investigate_incident");
  assert.ok(incident.triage);
  assert.equal(optimize.workflow, "optimize_workload");
  assert.ok(optimize.rewriteLab);
});

test("prepare_production_rollout and release_readiness_report produce operator reports", async () => {
  const rollout = await dispatch("prepare_production_rollout", {
    engine: "postgres",
    database: "analytics",
    schema: "public",
    table: "events",
    proposedSql: "CREATE INDEX ix_events_email ON events(user_email)",
  });
  const report = await dispatch("release_readiness_report", {
    environment: "production",
    engine: "postgres",
  });

  assert.equal(rollout.workflow, "prepare_production_rollout");
  assert.ok(rollout.rolloutPlan);
  assert.ok(rollout.verification);
  assert.equal(report.usp, "release_readiness_report");
  assert.ok(report.sections.productionReadiness);
  assert.ok(Array.isArray(report.openBlockers));
});
