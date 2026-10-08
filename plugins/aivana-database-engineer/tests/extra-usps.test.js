const test = require("node:test");
const assert = require("node:assert/strict");
const { dispatch } = require("../runtime/orchestrator");

test("sql_code_review_assistant reviews SQL like a senior DBA", async () => {
  const result = await dispatch("sql_code_review_assistant", {
    sql: "SELECT * FROM orders WHERE LOWER(status) = 'paid'",
    context: "pull_request",
  });

  assert.equal(result.usp, "sql_code_review_assistant");
  assert.ok(result.reviewComments.some((comment) => comment.id === "select_star"));
  assert.ok(result.reviewComments.some((comment) => comment.id === "function_on_predicate"));
});

test("schema_compare_intelligence explains schema diffs by risk and intent", async () => {
  const result = await dispatch("schema_compare_intelligence", {
    before: [{ table: "orders", columns: ["id", "status"] }],
    after: [{ table: "orders", columns: ["id", "status", "customer_id"], foreignKeys: [{ column: "customer_id", indexed: false }] }],
  });

  assert.equal(result.usp, "schema_compare_intelligence");
  assert.ok(result.diffSummary.addedColumns.includes("orders.customer_id"));
  assert.ok(result.risks.some((risk) => risk.id === "new_fk_without_index"));
});

test("query_contract_tester validates query shape against expected contract", async () => {
  const result = await dispatch("query_contract_tester", {
    sql: "SELECT id, total FROM orders LIMIT 50",
    contract: { requiredColumns: ["id", "total"], maxRows: 100, readOnly: true },
  });

  assert.equal(result.usp, "query_contract_tester");
  assert.equal(result.contractStatus, "pass");
  assert.equal(result.violations.length, 0);
});

test("rollback_rehearsal_engine creates rollback proof checklist", async () => {
  const result = await dispatch("rollback_rehearsal_engine", {
    change: "CREATE INDEX ix_orders_status ON orders(status)",
    rollback: "DROP INDEX ix_orders_status",
    validationQueries: ["SELECT count(*) FROM orders"],
  });

  assert.equal(result.usp, "rollback_rehearsal_engine");
  assert.equal(result.rehearsalStatus, "ready");
  assert.ok(result.steps.some((step) => step.id === "validate_after_rollback"));
});

test("release_train_risk_board aggregates release risk across database changes", async () => {
  const result = await dispatch("release_train_risk_board", {
    releases: [
      { id: "rel-1", changes: [{ riskLevel: "high" }, { riskLevel: "medium" }] },
      { id: "rel-2", changes: [{ riskLevel: "low" }] },
    ],
  });

  assert.equal(result.usp, "release_train_risk_board");
  assert.equal(result.releaseBoard[0].id, "rel-1");
  assert.equal(result.releaseBoard[0].decision, "hold");
});

test("observability_signal_router maps signals to the right advisor tools", async () => {
  const result = await dispatch("observability_signal_router", {
    signals: [
      { type: "wait", waitType: "LCK_M_X" },
      { type: "plan_change", queryId: "q1" },
      { type: "slo_breach", path: "checkout" },
    ],
  });

  assert.equal(result.usp, "observability_signal_router");
  assert.ok(result.routes.includes("wait_event_root_cause"));
  assert.ok(result.routes.includes("plan_regression_watch"));
});

test("fleet_health_scorecard ranks database fleet health", async () => {
  const result = await dispatch("fleet_health_scorecard", {
    databases: [
      { name: "prod-a", p95Ms: 800, errorBudgetBurnRate: 3, replicationLagSeconds: 10 },
      { name: "prod-b", p95Ms: 120, errorBudgetBurnRate: 0.5, replicationLagSeconds: 0 },
    ],
  });

  assert.equal(result.usp, "fleet_health_scorecard");
  assert.equal(result.scorecard[0].database, "prod-a");
  assert.equal(result.scorecard[0].status, "critical");
});

test("index_hypothesis_generator turns query smells into index hypotheses", async () => {
  const result = await dispatch("index_hypothesis_generator", {
    sql: "SELECT * FROM orders WHERE status = 'paid' AND created_at > '2026-01-01'",
    table: "orders",
  });

  assert.equal(result.usp, "index_hypothesis_generator");
  assert.ok(result.hypotheses[0].columns.includes("status"));
  assert.ok(result.hypotheses[0].validationPlan.includes("benchmark_ab_runner"));
});

test("developer_sql_coach provides educational feedback", async () => {
  const result = await dispatch("developer_sql_coach", {
    sql: "SELECT * FROM orders",
    developerLevel: "junior",
  });

  assert.equal(result.usp, "developer_sql_coach");
  assert.ok(result.lesson);
  assert.ok(result.actionItems.includes("avoid_select_star"));
});

test("environment_drift_detector detects config drift across environments", async () => {
  const result = await dispatch("environment_drift_detector", {
    environments: [
      { name: "staging", settings: { maxDop: 4, compatibilityLevel: 160 } },
      { name: "production", settings: { maxDop: 8, compatibilityLevel: 150 } },
    ],
  });

  assert.equal(result.usp, "environment_drift_detector");
  assert.ok(result.driftFindings.some((finding) => finding.setting === "maxDop"));
  assert.equal(result.driftStatus, "drift_detected");
});
