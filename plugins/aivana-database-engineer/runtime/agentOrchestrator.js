const agents = {
  query_agent: { role: "query_generation", riskTolerance: "medium" },
  tuning_agent: { role: "performance_optimization", riskTolerance: "low" },
  security_agent: { role: "access_and_secret_controls", riskTolerance: "low" },
  migration_agent: { role: "schema_evolution", riskTolerance: "high" },
  observability_agent: { role: "telemetry_correlation", riskTolerance: "low" },
  cost_agent: { role: "cost_optimization", riskTolerance: "low" },
  compliance_agent: { role: "governance_validation", riskTolerance: "very_low" },
  incident_agent: { role: "incident_reasoning", riskTolerance: "low" },
};

function selectAgentsForRequest(tool, riskLevel = "LOW") {
  const writeTools = new Set([
    "propose_migration",
    "rollback_migration",
    "create_index",
    "optimize_query",
    "create_partitioning",
    "simulate_query",
    "enforce_policy",
    "validate_compliance",
  ]);
  const migrationTools = new Set([
    "propose_migration",
    "rollback_migration",
    "create_partitioning",
  ]);
  const readTools = new Set([
    "list_databases",
    "list_tables",
    "describe_table",
    "describe_relationships",
    "query_stats",
    "lock_analysis",
    "index_usage",
    "replication_status",
    "detect_pii",
    "explain_query",
    "analyze_workload",
    "incident_analysis",
    "classify_risk",
    "estimate_cost",
    "audit_query",
  ]);
  const costTools = new Set(["estimate_cost", "analyze_workload", "query_stats"]);

  const base = ["query_agent", "tuning_agent", "incident_agent"];
  if (writeTools.has(tool) || riskLevel === "HIGH" || riskLevel === "CRITICAL") {
    base.push("security_agent", "compliance_agent");
  }
  if (migrationTools.has(tool) || tool.includes("migration")) {
    base.push("migration_agent", "compliance_agent");
  }
  if (readTools.has(tool) || tool.includes("query") || tool.includes("stats")) {
    base.push("observability_agent");
  }
  if (costTools.has(tool) || tool.includes("cost") || tool.includes("estimate")) {
    base.push("cost_agent");
  }
  const uniq = [...new Set(base)];
  const selected = uniq.filter((name) => agents[name]);
  return selected.map((name) => ({ id: name, ...agents[name], delegated: tool }));
}

function governanceDecision(policyDecision, selectedAgents) {
  return {
    allow: policyDecision.decision === "ALLOW",
    requiresHuman: policyDecision.decision === "REQUIRES_APPROVAL",
    blocked: policyDecision.decision === "BLOCK",
    sandboxOnly: policyDecision.decision === "SCOPE_TO_SANDBOX",
    selectedAgents: selectedAgents.map((agent) => agent.id),
  };
}

function plan(tool, riskLevel, policyDecision) {
  const selectedAgents = selectAgentsForRequest(tool, riskLevel);
  return {
    tool,
    riskLevel,
    policyDecision,
    selectedAgents,
    executionPlan: governanceDecision(policyDecision, selectedAgents),
    replayHint: `agent-run-${Date.now()}`,
  };
}

module.exports = {
  plan,
  selectAgentsForRequest,
  governanceDecision,
};
