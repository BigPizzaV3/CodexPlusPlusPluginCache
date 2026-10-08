const test = require("node:test");
const assert = require("node:assert/strict");
const { dispatch } = require("../runtime/orchestrator");

test("evidence_pack_generator builds a DBA-ready case file", async () => {
  const result = await dispatch("evidence_pack_generator", {
    question: "Why is checkout slow?",
    sql: "SELECT * FROM orders WHERE status = 'paid'",
    planFindings: [{ id: "sequential_scan", severity: "medium" }],
    waits: [{ waitType: "PAGEIOLATCH_SH", waitMs: 1200 }],
    recommendation: "add covering index",
  });

  assert.equal(result.usp, "evidence_pack_generator");
  assert.equal(result.caseFile.sections.includes("sql"), true);
  assert.ok(result.executiveSummary.includes("checkout"));
  assert.ok(result.evidenceGrade);
});

test("auto_tuning_experiment_designer creates a controlled experiment plan", async () => {
  const result = await dispatch("auto_tuning_experiment_designer", {
    hypothesis: "covering index reduces checkout p95",
    candidateChange: "CREATE INDEX ix_orders_status ON orders(status)",
    successMetric: "p95Ms",
    baseline: { p95Ms: 700 },
    target: { p95Ms: 350 },
  });

  assert.equal(result.usp, "auto_tuning_experiment_designer");
  assert.equal(result.experiment.successCriteria.metric, "p95Ms");
  assert.ok(result.experiment.abortCriteria.length >= 1);
});

test("migration_performance_predictor detects cross-engine slowdown risks", async () => {
  const result = await dispatch("migration_performance_predictor", {
    sourceEngine: "sqlserver",
    targetEngine: "postgres",
    sql: "WITH recent AS (SELECT TOP 100 * FROM events ORDER BY created_at DESC) SELECT * FROM recent WHERE JSON_VALUE(payload, '$.x') = '1'",
  });

  assert.equal(result.usp, "migration_performance_predictor");
  assert.ok(result.risks.some((risk) => risk.id === "top_syntax_translation"));
  assert.ok(result.risks.some((risk) => risk.id === "json_function_translation"));
});

test("workload_replay_risk_simulator estimates rollout blast radius", async () => {
  const result = await dispatch("workload_replay_risk_simulator", {
    change: "add index on events(user_email)",
    workload: [
      { queryId: "q1", calls: 2000, p95Ms: 120, writesPerSecond: 1 },
      { queryId: "q2", calls: 50, p95Ms: 900, writesPerSecond: 200 },
    ],
  });

  assert.equal(result.usp, "workload_replay_risk_simulator");
  assert.ok(result.riskScore > 0);
  assert.ok(result.sideEffects.writeAmplificationRisk);
});

test("index_portfolio_optimizer finds redundant and high-cost indexes", async () => {
  const result = await dispatch("index_portfolio_optimizer", {
    indexes: [
      { name: "ix_orders_status", columns: ["status"], reads: 1000, writes: 500 },
      { name: "ix_orders_status_created", columns: ["status", "created_at"], reads: 2000, writes: 600 },
      { name: "ix_orders_unused", columns: ["legacy"], reads: 0, writes: 900 },
    ],
  });

  assert.equal(result.usp, "index_portfolio_optimizer");
  assert.ok(result.redundantIndexes.some((item) => item.name === "ix_orders_status"));
  assert.ok(result.dropCandidates.some((item) => item.name === "ix_orders_unused"));
});

test("incident_timeline_builder creates a causal performance story", async () => {
  const result = await dispatch("incident_timeline_builder", {
    events: [
      { ts: "2026-05-30T10:00:00Z", type: "deployment", summary: "release 42" },
      { ts: "2026-05-30T10:03:00Z", type: "plan_change", summary: "plan hash changed" },
      { ts: "2026-05-30T10:05:00Z", type: "slo_breach", summary: "checkout p95 breached" },
    ],
  });

  assert.equal(result.usp, "incident_timeline_builder");
  assert.equal(result.timeline[0].type, "deployment");
  assert.ok(result.narrative.includes("release 42"));
});

test("advisor_confidence_grader labels evidence strength honestly", async () => {
  const result = await dispatch("advisor_confidence_grader", {
    evidence: { hasLivePlan: true, hasBenchmark: false, hasWaits: true, hasRollback: true },
  });

  assert.equal(result.usp, "advisor_confidence_grader");
  assert.ok(["strong_live_evidence", "moderate_evidence", "heuristic_only"].includes(result.grade));
  assert.ok(result.missingEvidence.includes("benchmark"));
});

test("change_ticket_exporter creates an approval-ready change ticket", async () => {
  const result = await dispatch("change_ticket_exporter", {
    title: "Add checkout covering index",
    problem: "checkout p95 breach",
    recommendation: "create index",
    rollback: "drop index",
    riskLevel: "medium",
  });

  assert.equal(result.usp, "change_ticket_exporter");
  assert.ok(result.ticket.title.includes("checkout"));
  assert.ok(result.ticket.approvalChecklist.includes("rollback_plan_attached"));
});

test("cost_to_performance_advisor balances latency gain against cost", async () => {
  const result = await dispatch("cost_to_performance_advisor", {
    currentMonthlyCost: 1200,
    projectedMonthlyCost: 1500,
    currentP95Ms: 900,
    projectedP95Ms: 300,
  });

  assert.equal(result.usp, "cost_to_performance_advisor");
  assert.ok(result.latencyImprovementPct > 60);
  assert.ok(result.costDelta > 0);
});

test("schema_evolution_guard blocks risky schema changes before release", async () => {
  const result = await dispatch("schema_evolution_guard", {
    changes: [
      { type: "add_foreign_key", table: "orders", column: "customer_id", hasSupportingIndex: false },
      { type: "add_column_with_default", table: "events", nullable: false, defaultExpression: "now()" },
    ],
  });

  assert.equal(result.usp, "schema_evolution_guard");
  assert.equal(result.releaseRisk, "high");
  assert.ok(result.findings.some((finding) => finding.id === "foreign_key_without_index"));
});
