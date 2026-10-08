const test = require("node:test");
const assert = require("node:assert/strict");
const { dispatch } = require("../runtime/orchestrator");

test("ai_strategy_synthesizer creates an AI database roadmap", async () => {
  const result = await dispatch("ai_strategy_synthesizer", {
    objective: "make database operations AI-native for enterprise teams",
    maturity: "pilot",
    priorities: ["latency", "governance", "cost"],
  });

  assert.equal(result.usp, "ai_strategy_synthesizer");
  assert.equal(result.source, "analysis");
  assert.ok(result.roadmap.length >= 3);
  assert.ok(result.guardrails.includes("closed_loop_dry_run"));
  assert.ok(result.recommendations.some((item) => item.includes("AI")));
});

test("cognitive_schema_mapper maps schema signals into business ontology", async () => {
  const result = await dispatch("cognitive_schema_mapper", {
    tables: ["orders", "payments", "customers"],
    domainTerms: ["checkout", "customer", "revenue"],
  });

  assert.equal(result.usp, "cognitive_schema_mapper");
  assert.ok(result.ontology.entities.some((entity) => entity.name === "orders"));
  assert.ok(Array.isArray(result.semanticGaps));
  assert.ok(result.evidence.includes("schema_terms"));
});

test("llm_prompt_risk_auditor flags ambiguous and unsafe AI SQL intent", async () => {
  const result = await dispatch("llm_prompt_risk_auditor", {
    prompt: "Fix production by dropping slow indexes and update all customers",
    environment: "production",
  });

  assert.equal(result.usp, "llm_prompt_risk_auditor");
  assert.ok(result.risks.includes("destructive_intent"));
  assert.ok(result.risks.includes("production_scope"));
  assert.notEqual(result.decision, "dry_run_ready");
});

test("ai_decision_simulator simulates agent decisions under policy constraints", async () => {
  const result = await dispatch("ai_decision_simulator", {
    proposedAction: "create index on orders(status)",
    evidence: { hasLivePlan: true, hasRollback: false },
    policy: { requireHumanApproval: true },
  });

  assert.equal(result.usp, "ai_decision_simulator");
  assert.ok(result.simulatedDecisions.length >= 3);
  assert.ok(result.simulatedDecisions.some((decision) => decision.id === "defer_for_approval"));
  assert.ok(["needs_more_evidence", "approval_required", "do_not_proceed"].includes(result.decision));
});

test("autonomous_learning_backlog converts feedback into prioritized learning tasks", async () => {
  const result = await dispatch("autonomous_learning_backlog", {
    outcomes: [{ tool: "sql_performance_advisor", result: "recommendation lacked rollback proof" }],
    incidents: ["checkout latency regression"],
  });

  assert.equal(result.usp, "autonomous_learning_backlog");
  assert.ok(result.learningBacklog.length >= 3);
  assert.ok(result.learningBacklog[0].priority >= result.learningBacklog.at(-1).priority);
  assert.equal(result.executionMode, "analysis_only");
});

test("knowledge_gap_detector finds missing context before AI action", async () => {
  const result = await dispatch("knowledge_gap_detector", {
    objective: "recommend production index",
    evidence: { hasSchema: true, hasLivePlan: false, hasTelemetry: false, hasPolicy: true },
  });

  assert.equal(result.usp, "knowledge_gap_detector");
  assert.ok(result.knowledgeGaps.includes("live_execution_plan"));
  assert.ok(result.knowledgeGaps.includes("telemetry_correlation"));
  assert.equal(result.decision, "needs_more_evidence");
});

test("ai_trust_scorecard scores explainability, safety, reproducibility, and governance", async () => {
  const result = await dispatch("ai_trust_scorecard", {
    evidence: { hasExplanation: true, hasPolicy: true, hasReplay: false, hasRollback: true },
  });

  assert.equal(result.usp, "ai_trust_scorecard");
  assert.ok(result.trustScore.total >= 0);
  assert.ok(result.trustScore.dimensions.explainability >= 0);
  assert.ok(result.confidence);
});

test("semantic_incident_predictor predicts likely incident classes", async () => {
  const result = await dispatch("semantic_incident_predictor", {
    signals: ["lock waits", "stale statistics", "tenant hot key"],
    workload: "checkout write path",
  });

  assert.equal(result.usp, "semantic_incident_predictor");
  assert.ok(result.predictions.length >= 3);
  assert.ok(result.predictions.some((prediction) => prediction.incidentClass === "lock_contention"));
  assert.equal(result.source, "analysis");
});

test("cross_agent_consensus_builder summarizes agreement and disagreement", async () => {
  const result = await dispatch("cross_agent_consensus_builder", {
    agentFindings: [
      { agent: "performance", recommendation: "rewrite query", confidence: 0.8 },
      { agent: "cost", recommendation: "rewrite query", confidence: 0.7 },
      { agent: "compliance", recommendation: "require approval", confidence: 0.9 },
    ],
  });

  assert.equal(result.usp, "cross_agent_consensus_builder");
  assert.ok(result.consensus.recommendation.includes("rewrite query"));
  assert.ok(result.disagreements.length >= 1);
  assert.ok(result.confidence);
});

test("ai_roi_narrative_generator produces executive ROI evidence", async () => {
  const result = await dispatch("ai_roi_narrative_generator", {
    teamHoursSavedMonthly: 80,
    avoidedIncidents: 2,
    costSavingsMonthly: 12000,
    sloImprovementPct: 18,
    hourlyRate: 120,
    incidentCost: 10000,
  });

  assert.equal(result.usp, "ai_roi_narrative_generator");
  assert.ok(result.executiveNarrative.includes("AI"));
  assert.ok(result.roiSignals.monthlyValueScore > 0);
  assert.ok(result.evidence.length >= 3);
});

test("heuristic outputs do not claim measured probabilities or invent unit costs", async () => {
  const prediction = await dispatch("semantic_incident_predictor", { signals: [] });
  assert.ok(prediction.predictions.every((p) => p.likelihood === null && !p.matched));
  assert.equal(prediction.confidence.score, null);
  assert.equal(prediction.evidenceClassification.measuredOutcome, false);
  const counterfactual = await dispatch("counterfactual_risk_engine", {});
  assert.equal(counterfactual.recommendedScenario, null);
  assert.ok(counterfactual.scenarios.every((s) => s.expectedP95DeltaMs === null));
  const roi = await dispatch("ai_roi_narrative_generator", { teamHoursSavedMonthly: 5 });
  assert.equal(roi.roiSignals.monthlyValueScore, null);
  await assert.rejects(dispatch("ai_roi_narrative_generator", { teamHoursSavedMonthly: "5" }), /ROI/);
});

test("live_evidence_smoke_profile defines live telemetry proof requirements", async () => {
  const result = await dispatch("live_evidence_smoke_profile", {
    engine: "postgres",
    evidence: { hasLiveConnection: true, hasPgStatStatements: true, hasExplainPlan: true },
  });

  assert.equal(result.usp, "live_evidence_smoke_profile");
  assert.equal(result.decision, "dry_run_ready");
  assert.ok(result.requiredEvidence.includes("live_connection"));
  assert.equal(result.source, "analysis");
});

test("formal_contract_catalog summarizes stable tool contracts", async () => {
  const result = await dispatch("formal_contract_catalog", {
    tools: ["ai_strategy_synthesizer", "autonomous_ops_briefing"],
  });

  assert.equal(result.usp, "formal_contract_catalog");
  assert.ok(result.contracts.length >= 2);
  assert.ok(result.contracts.every((contract) => contract.version === "1.0"));
});

test("governance_proof_packet exports audit-ready AI decision proof", async () => {
  const result = await dispatch("governance_proof_packet", {
    action: "recommend checkout index",
    policyDecision: "REQUIRES_APPROVAL",
    evidence: { hasRollback: true, hasPolicy: true },
  });

  assert.equal(result.usp, "governance_proof_packet");
  assert.equal(result.decision, "approval_required");
  assert.ok(result.proofPacket.requiredApprovals.includes("human_operator"));
});

test("benchmark_roi_proof converts measured before-after metrics into ROI proof", async () => {
  const result = await dispatch("benchmark_roi_proof", {
    baselineP95Ms: 900,
    candidateP95Ms: 420,
    baselineMonthlyCost: 50000,
    candidateMonthlyCost: 42000,
  });

  assert.equal(result.usp, "benchmark_roi_proof");
  assert.ok(result.roiProof.latencyImprovementPct > 0);
  assert.ok(result.roiProof.monthlyCostSavings > 0);
});

test("pilot_success_pack creates a 30-minute pilot plan", async () => {
  const result = await dispatch("pilot_success_pack", {
    service: "checkout",
    engine: "postgres",
  });

  assert.equal(result.usp, "pilot_success_pack");
  assert.ok(result.timelineMinutes <= 30);
  assert.ok(result.successCriteria.length >= 4);
});

test("visual_executive_report renders board-ready markdown", async () => {
  const result = await dispatch("visual_executive_report", {
    objective: "reduce checkout p95",
    decision: "needs_more_evidence",
  });

  assert.equal(result.usp, "visual_executive_report");
  assert.ok(result.reportMarkdown.includes("# Executive Database Operations Report"));
  assert.ok(result.reportMarkdown.includes("Decision"));
});

test("enterprise_security_proof states zero autonomous write boundary", async () => {
  const result = await dispatch("enterprise_security_proof", {
    tenantScoped: true,
    secretsRedacted: true,
    productionApplyRequested: true,
  });

  assert.equal(result.usp, "enterprise_security_proof");
  assert.equal(result.securityBoundary.zeroAutonomousWrite, true);
  assert.equal(result.decision, "approval_required");
});

test("competitive_battlecards produce buyer-facing differentiation", async () => {
  const result = await dispatch("competitive_battlecards", {
    competitors: ["generic_ai_copilot", "monitoring_tool", "sql_ide"],
  });

  assert.equal(result.usp, "competitive_battlecards");
  assert.ok(result.battlecards.length >= 3);
  assert.ok(result.battlecards.some((card) => card.competitor === "generic_ai_copilot"));
});
