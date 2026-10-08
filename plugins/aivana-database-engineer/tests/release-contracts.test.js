const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const manifest = require("../runtime/tool-manifest.json");

const strategicTools = [
  "objective_to_ops_plan",
  "autonomous_experiment_planner",
  "counterfactual_risk_engine",
  "decision_evidence_compiler",
  "confidence_budget_manager",
  "autonomy_boundary_enforcer",
  "operator_goal_monitor",
  "dry_run_action_critic",
  "next_best_safe_action",
  "autonomous_ops_briefing",
  "ai_strategy_synthesizer",
  "cognitive_schema_mapper",
  "llm_prompt_risk_auditor",
  "ai_decision_simulator",
  "autonomous_learning_backlog",
  "knowledge_gap_detector",
  "ai_trust_scorecard",
  "semantic_incident_predictor",
  "cross_agent_consensus_builder",
  "ai_roi_narrative_generator",
  "live_evidence_smoke_profile",
  "formal_contract_catalog",
  "governance_proof_packet",
  "benchmark_roi_proof",
  "pilot_success_pack",
  "visual_executive_report",
  "enterprise_security_proof",
  "competitive_battlecards",
];

test("strategic autonomous and AI USP tools have release contracts", () => {
  const contractsPath = path.join(root, "runtime", "tool-contracts.json");
  const contracts = JSON.parse(fs.readFileSync(contractsPath, "utf8"));

  for (const tool of strategicTools) {
    assert.ok(manifest.tools.includes(tool), `${tool} missing from manifest`);
    assert.ok(contracts[tool], `${tool} missing contract`);
    assert.equal(contracts[tool].version, "1.0");
    assert.ok(contracts[tool].input.required.length >= 1, `${tool} missing required input hints`);
    assert.ok(contracts[tool].output.required.includes("usp"), `${tool} must require usp output`);
    assert.ok(contracts[tool].output.required.includes("source"), `${tool} must require source output`);
    assert.ok(contracts[tool].governance.includes("no_production_apply"), `${tool} must preserve production boundary`);
  }
});

test("enterprise AI USP demo scenarios are executable through declared tools", () => {
  const demosPath = path.join(root, "demos", "enterprise-ai-usp-scenarios.json");
  const demos = JSON.parse(fs.readFileSync(demosPath, "utf8"));

  assert.ok(demos.scenarios.length >= 4);
  for (const scenario of demos.scenarios) {
    assert.ok(scenario.title);
    assert.ok(manifest.tools.includes(scenario.tool), `${scenario.tool} missing from manifest`);
    assert.ok(scenario.input && typeof scenario.input === "object");
    assert.ok(scenario.expectedDecision || scenario.expectedOutcome);
    assert.equal(scenario.mode, "closed_loop_dry_run");
  }
});
