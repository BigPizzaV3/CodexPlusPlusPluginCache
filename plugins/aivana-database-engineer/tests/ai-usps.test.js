const test = require("node:test");
const assert = require("node:assert/strict");
const { dispatch } = require("../runtime/orchestrator");

test("ai_anomaly_triage correlates workload, telemetry, and policy signals", async () => {
  const result = await dispatch("ai_anomaly_triage", {
    engine: "postgres",
    database: "analytics",
    incidentWindowMinutes: 45,
    deploymentId: "deploy-42",
  });

  assert.equal(result.usp, "ai_anomaly_triage");
  assert.ok(["low", "medium", "high", "critical"].includes(result.anomalyScore.level));
  assert.ok(Array.isArray(result.rootCauseHypotheses));
  assert.ok(result.rootCauseHypotheses.length >= 1);
  assert.ok(Array.isArray(result.nextBestActions));
  assert.ok(result.explainability.correlationInputs.includes("query_stats"));
});

test("ai_query_rewrite_lab generates safe rewrite candidates with explainability", async () => {
  const result = await dispatch("ai_query_rewrite_lab", {
    engine: "postgres",
    database: "analytics",
    schema: "public",
    table: "events",
    sql: "SELECT * FROM events WHERE user_email = 'a@example.com'",
  });

  assert.equal(result.usp, "ai_query_rewrite_lab");
  assert.equal(result.executionMode, "analysis_only");
  assert.ok(Array.isArray(result.rewriteCandidates));
  assert.ok(result.rewriteCandidates.length >= 1);
  assert.ok(result.rewriteCandidates[0].sql.includes("SELECT"));
  assert.ok(result.safety.blockedExecution);
});

test("ai_migration_risk_radar produces blast-radius and rollback rehearsal plan", async () => {
  const result = await dispatch("ai_migration_risk_radar", {
    engine: "sqlserver",
    database: "app_prod",
    schema: "public",
    migrationSql: "CREATE INDEX ix_orders_status ON orders(status)",
  });

  assert.equal(result.usp, "ai_migration_risk_radar");
  assert.ok(result.blastRadius);
  assert.ok(Array.isArray(result.rollbackRehearsal.steps));
  assert.ok(result.policyPreflight.decision);
  assert.ok(result.releaseRecommendation);
});

test("ai_data_contract_guardian checks schema drift, pii, and policy controls", async () => {
  const result = await dispatch("ai_data_contract_guardian", {
    engine: "postgres",
    database: "analytics",
    schema: "public",
    table: "events",
    contract: {
      requiredColumns: ["event_id", "user_email", "created_at"],
      piiColumns: ["user_email"],
      retentionDays: 90,
    },
  });

  assert.equal(result.usp, "ai_data_contract_guardian");
  assert.ok(Array.isArray(result.contractFindings));
  assert.ok(result.contractFindings.some((finding) => finding.type === "missing_required_column"));
  assert.ok(result.governanceControls.includes("mask_pii_columns"));
  assert.ok(result.evidence.table);
});
