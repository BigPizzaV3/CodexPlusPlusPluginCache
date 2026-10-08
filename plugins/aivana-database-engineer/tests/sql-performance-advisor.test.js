const test = require("node:test");
const assert = require("node:assert/strict");
const { dispatch } = require("../runtime/orchestrator");

test("sql_problem_detector finds common SQL performance smells", async () => {
  const result = await dispatch("sql_problem_detector", {
    sql: "SELECT * FROM events WHERE user_email = 'a@example.com'",
    engine: "postgres",
  });

  assert.equal(result.usp, "sql_problem_detector");
  assert.ok(result.findings.some((finding) => finding.id === "select_star"));
  assert.ok(result.findings.some((finding) => finding.id === "unbounded_result"));
  assert.ok(result.evidence.sqlFingerprint);
});

test("plan_diff_intelligence explains plan changes and likely causes", async () => {
  const result = await dispatch("plan_diff_intelligence", {
    beforePlan: { join: "Nested Loop", scan: "Index Scan", cost: 100, rows: 1000 },
    afterPlan: { join: "Hash Join", scan: "Seq Scan", cost: 420, rows: 90000 },
  });

  assert.equal(result.usp, "plan_diff_intelligence");
  assert.ok(result.planChanges.some((change) => change.type === "scan_changed"));
  assert.ok(result.likelyCauses.length >= 1);
  assert.ok(result.confidence > 0);
});

test("recommendation_ranker orders actions by impact, risk, and effort", async () => {
  const result = await dispatch("recommendation_ranker", {
    recommendations: [
      { id: "add_index", impact: "high", risk: "medium", effort: "medium" },
      { id: "narrow_projection", impact: "medium", risk: "low", effort: "low" },
    ],
  });

  assert.equal(result.usp, "recommendation_ranker");
  assert.equal(result.rankedRecommendations[0].id, "narrow_projection");
  assert.ok(result.rankedRecommendations[0].score > 0);
});

test("advisor_feedback_loop records outcomes and updates recommendation confidence", async () => {
  const result = await dispatch("advisor_feedback_loop", {
    recommendationId: "narrow_projection",
    applied: true,
    beforeP95Ms: 300,
    afterP95Ms: 180,
  });

  assert.equal(result.usp, "advisor_feedback_loop");
  assert.equal(result.outcome.improved, true);
  assert.ok(result.learning.confidenceDelta > 0);
});

test("benchmark_ab_runner creates before after benchmark comparison", async () => {
  const result = await dispatch("benchmark_ab_runner", {
    baseline: { p95Ms: 300, cpuMs: 80, rows: 10000 },
    candidate: { p95Ms: 190, cpuMs: 55, rows: 10000 },
  });

  assert.equal(result.usp, "benchmark_ab_runner");
  assert.ok(result.delta.p95Ms < 0);
  assert.equal(result.winner, "candidate");
});

test("workload_impact_analyzer summarizes top workload impact", async () => {
  const result = await dispatch("workload_impact_analyzer", {
    queries: [
      { queryId: "q1", p95Ms: 900, calls: 20, cpuMs: 70 },
      { queryId: "q2", p95Ms: 120, calls: 2000, cpuMs: 15 },
    ],
  });

  assert.equal(result.usp, "workload_impact_analyzer");
  assert.equal(result.topImpactQueries[0].queryId, "q2");
  assert.ok(result.hotspots.length >= 1);
});

test("consultant_brain produces advisory answer with confidence and next test", async () => {
  const result = await dispatch("consultant_brain", {
    question: "Why is this query slow and what should I do first?",
    sql: "SELECT * FROM events WHERE user_email = 'a@example.com'",
    engine: "postgres",
    database: "analytics",
    schema: "public",
    table: "events",
  });

  assert.equal(result.usp, "consultant_brain");
  assert.ok(result.answer.summary);
  assert.ok(result.answer.recommendation);
  assert.ok(result.answer.nextTest);
  assert.ok(["low", "medium", "high"].includes(result.answer.confidence));
});

test("sql_performance_advisor orchestrates detector, ranking, workload, and consultant answer", async () => {
  const result = await dispatch("sql_performance_advisor", {
    question: "Optimize this events lookup",
    sql: "SELECT * FROM events WHERE user_email = 'a@example.com'",
    engine: "postgres",
    database: "analytics",
    schema: "public",
    table: "events",
    baseline: { p95Ms: 300, cpuMs: 80, rows: 10000 },
    candidate: { p95Ms: 210, cpuMs: 60, rows: 10000 },
  });

  assert.equal(result.usp, "sql_performance_advisor");
  assert.ok(result.diagnosis.findings.length >= 1);
  assert.ok(result.rankedRecommendations.length >= 1);
  assert.ok(result.consultantAnswer.summary);
  assert.ok(result.evidenceChain.includes("sql_problem_detector"));
});
