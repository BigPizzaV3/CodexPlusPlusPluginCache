const test = require("node:test");
const assert = require("node:assert/strict");
const { dispatch } = require("../runtime/orchestrator");

test("index_roi_simulator ranks index candidates by read benefit minus write and storage cost", async () => {
  const result = await dispatch("index_roi_simulator", {
    candidates: [
      { id: "idx_events_user_email", readBenefitMs: 180, readQps: 40, writePenaltyMs: 3, writeQps: 8, storageMb: 512 },
      { id: "idx_events_payload_gin", readBenefitMs: 70, readQps: 8, writePenaltyMs: 12, writeQps: 90, storageMb: 8192 },
    ],
  });

  assert.equal(result.usp, "index_roi_simulator");
  assert.equal(result.rankedCandidates[0].id, "idx_events_user_email");
  assert.ok(result.rankedCandidates[0].roiScore > result.rankedCandidates[1].roiScore);
  assert.ok(result.recommendation.includes("idx_events_user_email"));
});

test("plan_regression_watch detects plan hash changes and tail latency regressions", async () => {
  const result = await dispatch("plan_regression_watch", {
    snapshots: [
      { capturedAt: "2026-05-28T10:00:00Z", queryId: "q1", planHash: "aaa", p95Ms: 120, calls: 1000 },
      { capturedAt: "2026-05-29T10:00:00Z", queryId: "q1", planHash: "bbb", p95Ms: 420, calls: 1100 },
    ],
  });

  assert.equal(result.usp, "plan_regression_watch");
  assert.equal(result.regressionDetected, true);
  assert.ok(result.findings.some((finding) => finding.id === "plan_hash_changed"));
  assert.ok(result.findings.some((finding) => finding.id === "tail_latency_regression"));
});

test("parameter_sensitivity_guard flags parameter-sensitive plan variance", async () => {
  const result = await dispatch("parameter_sensitivity_guard", {
    executions: [
      { parameterShape: "small_customer", rows: 10, p95Ms: 25, planHash: "seek" },
      { parameterShape: "large_customer", rows: 120000, p95Ms: 1800, planHash: "scan" },
    ],
  });

  assert.equal(result.usp, "parameter_sensitivity_guard");
  assert.equal(result.parameterSensitive, true);
  assert.ok(result.mitigations.includes("use_parameter_sensitive_plan_strategy"));
});

test("maintenance_window_advisor turns bloat and stale stats into a safe runbook", async () => {
  const result = await dispatch("maintenance_window_advisor", {
    engine: "postgres",
    tables: [
      { table: "events", deadTuplePct: 28, statsAgeHours: 96, bloatPct: 35, writeQps: 200 },
      { table: "customers", deadTuplePct: 3, statsAgeHours: 6, bloatPct: 4, writeQps: 10 },
    ],
  });

  assert.equal(result.usp, "maintenance_window_advisor");
  assert.equal(result.runbook[0].table, "events");
  assert.ok(result.runbook[0].actions.includes("analyze"));
  assert.ok(result.runbook[0].actions.includes("vacuum"));
});

test("slo_impact_guard translates database regressions into error budget impact", async () => {
  const result = await dispatch("slo_impact_guard", {
    sloTargetMs: 300,
    observedP95Ms: 750,
    requestsPerMinute: 12000,
    criticalPath: "checkout",
  });

  assert.equal(result.usp, "slo_impact_guard");
  assert.equal(result.status, "slo_breach");
  assert.ok(result.errorBudgetBurnRate > 1);
  assert.ok(result.executiveSummary.includes("checkout"));
});
