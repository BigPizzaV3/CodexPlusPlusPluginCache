const test = require("node:test");
const assert = require("node:assert/strict");
const { dispatch } = require("../runtime/orchestrator");

test("objective_to_ops_plan decomposes an enterprise operator goal", async () => {
  const result = await dispatch("objective_to_ops_plan", {
    objective: "reduce checkout p95 below 300ms without production risk",
    service: "checkout",
    sloTargetMs: 300,
    environment: "production",
  });

  assert.equal(result.usp, "objective_to_ops_plan");
  assert.equal(result.autonomyMode, "closed_loop_dry_run");
  assert.ok(result.measurableObjectives.some((item) => item.metric === "p95Ms"));
  assert.ok(result.guardrails.includes("no_production_apply"));
  assert.ok(result.candidateWorkflows.includes("sql_performance_advisor"));
});

test("autonomous_experiment_planner creates dry-run experiments and abort criteria", async () => {
  const result = await dispatch("autonomous_experiment_planner", {
    objective: "reduce checkout latency",
    sql: "SELECT * FROM orders WHERE status = 'paid'",
    table: "orders",
  });

  assert.equal(result.usp, "autonomous_experiment_planner");
  assert.equal(result.executionMode, "closed_loop_dry_run");
  assert.ok(result.experiments.length >= 4);
  assert.ok(result.experiments.every((experiment) => experiment.mode === "dry_run"));
  assert.ok(result.abortCriteria.includes("requires_real_apply"));
});

test("counterfactual_risk_engine compares multiple dry-run scenarios", async () => {
  const result = await dispatch("counterfactual_risk_engine", {
    objective: "fix checkout p95",
    proposedChange: "CREATE INDEX ix_orders_status ON orders(status)",
  });

  assert.equal(result.usp, "counterfactual_risk_engine");
  assert.ok(result.scenarios.length >= 3);
  assert.ok(result.scenarios.some((scenario) => scenario.id === "do_nothing"));
  assert.ok(["dry_run_ready", "needs_more_evidence", "approval_required", "do_not_proceed"].includes(result.decision));
});

test("decision_evidence_compiler produces executive evidence and missing-evidence fields", async () => {
  const result = await dispatch("decision_evidence_compiler", {
    objective: "reduce checkout p95",
    evidence: { hasLivePlan: true, hasWaits: false, hasRollback: true },
  });

  assert.equal(result.usp, "decision_evidence_compiler");
  assert.ok(result.executivePacket.summary.includes("checkout"));
  assert.ok(result.confidence);
  assert.ok(Array.isArray(result.missingEvidence));
});

test("confidence_budget_manager decides whether enough evidence exists", async () => {
  const result = await dispatch("confidence_budget_manager", {
    evidence: { hasLivePlan: true, hasBenchmark: false, hasWaits: true, hasRollback: true },
    threshold: 0.75,
  });

  assert.equal(result.usp, "confidence_budget_manager");
  assert.ok(result.confidenceBudget.score >= 0);
  assert.ok(["dry_run_ready", "needs_more_evidence", "approval_required", "do_not_proceed"].includes(result.decision));
  assert.ok(Array.isArray(result.missingEvidence));
});

test("autonomy_boundary_enforcer blocks production apply", async () => {
  const result = await dispatch("autonomy_boundary_enforcer", {
    requestedAction: "apply_index",
    environment: "production",
    executionMode: "apply",
  });

  assert.equal(result.usp, "autonomy_boundary_enforcer");
  assert.equal(result.decision, "approval_required");
  assert.equal(result.boundary.allowedAutonomousExecution, false);
  assert.ok(result.requiredApprovals.includes("human_operator"));
});

test("operator_goal_monitor creates watch criteria for platform objectives", async () => {
  const result = await dispatch("operator_goal_monitor", {
    service: "checkout",
    goals: { p95Ms: 300, monthlyCost: 5000, maxIncidentSeverity: "medium" },
  });

  assert.equal(result.usp, "operator_goal_monitor");
  assert.ok(result.watchCriteria.some((criterion) => criterion.metric === "p95Ms"));
  assert.ok(result.escalationPolicy);
  assert.equal(result.source, "analysis");
});

test("dry_run_action_critic finds hidden blast radius and evidence weakness", async () => {
  const result = await dispatch("dry_run_action_critic", {
    proposedAction: "create index on orders(status)",
    hasRollback: false,
    tenantScoped: false,
    evidence: { hasLivePlan: false },
  });

  assert.equal(result.usp, "dry_run_action_critic");
  assert.ok(result.criticisms.includes("rollback_gap"));
  assert.ok(result.criticisms.includes("tenant_blast_radius_unknown"));
  assert.ok(["needs_more_evidence", "approval_required", "do_not_proceed"].includes(result.decision));
});

test("next_best_safe_action never returns unsafe apply action", async () => {
  const result = await dispatch("next_best_safe_action", {
    objective: "reduce checkout p95",
    candidates: [
      { id: "apply_index", action: "apply production index", risk: "high", mode: "apply" },
      { id: "run_explain", action: "run explain diagnostics", risk: "low", mode: "dry_run" },
    ],
  });

  assert.equal(result.usp, "next_best_safe_action");
  assert.equal(result.safeNextAction.mode, "dry_run");
  assert.notEqual(result.safeNextAction.id, "apply_index");
  assert.ok(["dry_run_ready", "needs_more_evidence"].includes(result.decision));
});

test("autonomous_ops_briefing creates final closed-loop briefing", async () => {
  const result = await dispatch("autonomous_ops_briefing", {
    objective: "reduce checkout p95 below 300ms without production risk",
    service: "checkout",
    evidence: { hasLivePlan: true, hasWaits: true, hasRollback: true },
    candidates: [{ id: "run_explain", action: "run explain diagnostics", risk: "low", mode: "dry_run" }],
  });

  assert.equal(result.usp, "autonomous_ops_briefing");
  assert.ok(result.boardSummary.includes("Autonomous Database Operations"));
  assert.ok(result.decision);
  assert.ok(result.confidence);
  assert.ok(result.safeNextAction);
  assert.equal(result.source, "analysis");
});
