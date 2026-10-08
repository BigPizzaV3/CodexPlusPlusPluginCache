const test = require("node:test");
const assert = require("node:assert/strict");
const { dispatch } = require("../runtime/orchestrator");

test("autonomous_dba_copilot produces an evidence-backed DBA action loop", async () => {
  const result = await dispatch("autonomous_dba_copilot", {
    question: "Checkout is slow after release 42",
    sql: "SELECT * FROM orders WHERE status = 'paid'",
    waits: [{ waitType: "LCK_M_X", waitMs: 5000 }],
    evidence: { hasLivePlan: true, hasWaits: true, hasRollback: true },
  });

  assert.equal(result.usp, "autonomous_dba_copilot");
  assert.ok(result.loopSteps.includes("collect_evidence"));
  assert.ok(result.decisionPackage.evidenceGrade);
});

test("performance_pr_reviewer flags migration performance risks before merge", async () => {
  const result = await dispatch("performance_pr_reviewer", {
    pullRequest: "PR-42",
    changes: [
      { type: "add_foreign_key", table: "orders", column: "customer_id", hasSupportingIndex: false },
      { type: "add_index", name: "ix_orders_status", table: "orders" },
    ],
  });

  assert.equal(result.usp, "performance_pr_reviewer");
  assert.equal(result.mergeDecision, "block");
  assert.ok(result.findings.some((finding) => finding.id === "foreign_key_without_index"));
});

test("cross_tool_devops_analyzer normalizes Flyway Liquibase SSDT and Redgate artifacts", async () => {
  const result = await dispatch("cross_tool_devops_analyzer", {
    artifacts: [
      { tool: "flyway", path: "V42__add_index.sql", content: "CREATE INDEX ix_orders_status ON orders(status)" },
      { tool: "liquibase", path: "changelog.xml", content: "<addForeignKeyConstraint />" },
      { tool: "ssdt", path: "database.sqlproj", content: "<DacPacName>App</DacPacName>" },
    ],
  });

  assert.equal(result.usp, "cross_tool_devops_analyzer");
  assert.equal(result.normalizedArtifacts.length, 3);
  assert.ok(result.pipelineAdvice.includes("run_policy_gates_before_apply"));
});

test("ai_guarded_sql_generator generates SQL with policy and performance guardrails", async () => {
  const result = await dispatch("ai_guarded_sql_generator", {
    intent: "list recent paid orders",
    table: "orders",
    filters: { status: "paid" },
    limit: 100,
    tenantId: "tenant-a",
  });

  assert.equal(result.usp, "ai_guarded_sql_generator");
  assert.ok(result.sql.includes("LIMIT 100"));
  assert.equal(result.guardrails.includes("tenant_context_required"), true);
});

test("synthetic_workload_lab creates anonymized workload and data profile", async () => {
  const result = await dispatch("synthetic_workload_lab", {
    tables: [{ table: "orders", rowCount: 1000000, piiColumns: ["email"] }],
    queryFamilies: [{ fingerprint: "orders by status", calls: 2000, p95Ms: 300 }],
  });

  assert.equal(result.usp, "synthetic_workload_lab");
  assert.ok(result.syntheticDataPlan.tables[0].maskedColumns.includes("email"));
  assert.ok(result.workloadScript.steps.length >= 1);
});

test("vendor_neutral_devops_brain chooses the right action across toolchains", async () => {
  const result = await dispatch("vendor_neutral_devops_brain", {
    tools: ["flyway", "liquibase", "ssdt", "redgate"],
    changeType: "schema_migration",
    riskLevel: "high",
  });

  assert.equal(result.usp, "vendor_neutral_devops_brain");
  assert.equal(result.strategy.controlPlane, "plugin_policy_layer");
  assert.ok(result.strategy.toolAdapters.length >= 4);
});

test("compliance_query_assistant rewrites SQL with tenant pii and audit constraints", async () => {
  const result = await dispatch("compliance_query_assistant", {
    sql: "SELECT email, total FROM orders",
    tenantId: "tenant-a",
    piiColumns: ["email"],
  });

  assert.equal(result.usp, "compliance_query_assistant");
  assert.ok(result.safeSql.includes("tenant_id"));
  assert.ok(result.maskedColumns.includes("email"));
});

test("migration_twin_simulator models SQL Server to Postgres workload risk", async () => {
  const result = await dispatch("migration_twin_simulator", {
    sourceEngine: "sqlserver",
    targetEngine: "postgres",
    queries: [
      { queryId: "q1", sql: "SELECT TOP 100 * FROM events", calls: 1000, p95Ms: 200 },
      { queryId: "q2", sql: "SELECT JSON_VALUE(payload, '$.x') FROM events", calls: 500, p95Ms: 300 },
    ],
  });

  assert.equal(result.usp, "migration_twin_simulator");
  assert.ok(result.queryRisks.length >= 2);
  assert.ok(result.overallRisk !== "low");
});

test("policy_gated_self_healing creates safe runbooks instead of blind changes", async () => {
  const result = await dispatch("policy_gated_self_healing", {
    incidentType: "lock_pressure",
    riskLevel: "high",
    environment: "production",
  });

  assert.equal(result.usp, "policy_gated_self_healing");
  assert.equal(result.executionMode, "approval_required");
  assert.ok(result.runbook.some((step) => step.gate === "human_approval"));
});

test("advisor_memory_recommender learns from prior outcomes", async () => {
  await dispatch("advisor_feedback_loop", {
    recommendationId: "narrow_projection",
    applied: true,
    beforeP95Ms: 500,
    afterP95Ms: 250,
  });
  const result = await dispatch("advisor_memory_recommender", {
    recommendationId: "narrow_projection",
  });

  assert.equal(result.usp, "advisor_memory_recommender");
  assert.ok(result.memoryMatches.length >= 1);
  assert.ok(result.confidenceHint !== "unknown");
});

test("concurrent processes retain every advisor memory update", async () => {
  const { execFile } = require("node:child_process");
  const { promisify } = require("node:util");
  const path = require("node:path");
  const fs = require("node:fs");
  const os = require("node:os");
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "codexdb-concurrency-"));
  try {
    const modulePath = require.resolve("../runtime/memoryLayer");
    const script = `const {remember} = require(process.argv[1]);
      for (let i = 0; i < 20; i++) remember({stateFile: process.argv[2]},
        'advisorFeedback', {recommendationId: process.argv[3] + '-' + i});`;
    const writers = await Promise.allSettled(Array.from({ length: 6 }, (_, index) =>
      promisify(execFile)(process.execPath, ["-e", script, modulePath,
        path.join(directory, "runtime-state.json"), String(index)])));
    for (const writer of writers) if (writer.status === "rejected") throw writer.reason;
    const rows = require("../runtime/memoryLayer").recall({ stateFile: path.join(directory, "runtime-state.json") }, "advisorFeedback", 200);
    assert.equal(rows.length, 120);
    assert.equal(new Set(rows.map((entry) => entry.recommendationId)).size, 120);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
