const { resolveCatalog } = require("./config");
const erpCrmAdvisor = require("./erpCrmAdvisor");
const diagnosticEvidence = require("./diagnosticEvidence");
const { classify } = require("./riskEngine");
const { classifyDecision, verifyAdminApproval, verifyEnterpriseApproval, verifyEnterpriseAuditWitness } = require("./policyEngine");
const { appendAuditEvent, buildEvent, readReplayLog, verifyAudit } = require("./auditLogger");
const { remember, recall, advisoryCase, advisorWorkflow, recommendationValidity, diagnosticSession, consumeAdminApproval } = require("./memoryLayer");
const { buildSemanticGraph, summarize } = require("./semanticGraph");
const { correlateSignals } = require("./observabilityEngine");
const { plan: orchestrateAgents } = require("./agentOrchestrator");
const { createAdapter, hasMockAdapter, adminPreflight, collectContextFingerprint, collectProcessEvidence, replayWorkload, verifyRewrite, inspectDatabase, compareDatabaseSnapshots, compareLiveSchemas, schemaContractCheck, foreignKeyIndexReview, compareNativePlans, duplicateIndexReview, databaseEngineerBrief } = require("./db/connector");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const MIGRATION_ACTIONS = new Set([
  "propose_migration",
  "create_index",
  "rollback_migration",
  "optimize_query",
  "create_partitioning",
  "simulate_query",
]);
const INCIDENT_TOOLS = new Set(["lock_analysis", "query_stats", "replication_status", "incident_analysis"]);
const MOCK_ALLOWED_IN_PRODUCTION = new Set([
  "production_readiness_check",
  "release_readiness_report",
  "prepare_production_rollout",
  "classify_risk",
  "enforce_policy",
  "validate_compliance",
  "audit_query",
  "replay_execution",
]);
const LIVE_EVIDENCE_TOOLS = new Set([
  "sql_performance_advisor",
  "consultant_brain",
  "sql_problem_detector",
  "plan_deep_diagnostics",
  "plan_diff_intelligence",
  "recommendation_ranker",
  "index_roi_simulator",
  "plan_regression_watch",
  "parameter_sensitivity_guard",
  "maintenance_window_advisor",
  "slo_impact_guard",
  "query_fingerprint_clusterer",
  "wait_event_root_cause",
  "data_skew_detector",
  "cache_efficiency_advisor",
  "capacity_headroom_forecast",
  "evidence_pack_generator",
  "auto_tuning_experiment_designer",
  "migration_performance_predictor",
  "workload_replay_risk_simulator",
  "index_portfolio_optimizer",
  "incident_timeline_builder",
  "advisor_confidence_grader",
  "change_ticket_exporter",
  "cost_to_performance_advisor",
  "schema_evolution_guard",
  "autonomous_dba_copilot",
  "performance_pr_reviewer",
  "cross_tool_devops_analyzer",
  "ai_guarded_sql_generator",
  "synthetic_workload_lab",
  "vendor_neutral_devops_brain",
  "compliance_query_assistant",
  "migration_twin_simulator",
  "policy_gated_self_healing",
  "advisor_memory_recommender",
  "sql_code_review_assistant",
  "schema_compare_intelligence",
  "query_contract_tester",
  "rollback_rehearsal_engine",
  "release_train_risk_board",
  "observability_signal_router",
  "fleet_health_scorecard",
  "index_hypothesis_generator",
  "developer_sql_coach",
  "environment_drift_detector",
  "query_plan_narrator",
  "slo_policy_compiler",
  "index_retirement_planner",
  "hotfix_risk_assessor",
  "tenant_noisy_neighbor_detector",
  "partition_strategy_advisor",
  "statistics_health_doctor",
  "connection_pool_advisor",
  "backup_restore_readiness_guard",
  "vendor_feature_mapper",
  "benchmark_ab_runner",
  "workload_impact_analyzer",
  "advisor_feedback_loop",
]);

function generateId(prefix = "id") {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

function getMigrationSigningSecret() {
  return process.env.CODEXDB_MIGRATION_SIGNING_KEY || process.env.CODEXDB_SIGNING_KEY || process.env.CODEXDB_HSM_KEY || "";
}

function getMigrationSignerKeyId() {
  return process.env.CODEXDB_MIGRATION_SIGNER_KEY_ID || "default-key";
}

function getMigrationSignatureTTL() {
  const ttl = Number(process.env.CODEXDB_MIGRATION_SIGNATURE_TTL_SEC || 900);
  return Number.isFinite(ttl) && ttl > 0 && ttl <= 86400 ? ttl : 900;
}

function normalizeText(value) {
  return String(value || "").trim();
}

function stableStringify(value) {
  if (value === null || value === undefined) {
    return "";
  }
  return JSON.stringify(value);
}

function sha256(value) {
  const payload = String(value || "");
  return crypto.createHash("sha256").update(payload).digest("hex");
}

function redactSensitive(value) {
  if (Array.isArray(value)) {
    return value.map((item) => redactSensitive(item));
  }
  if (value && typeof value === "object") {
    const next = {};
    for (const [key, item] of Object.entries(value)) {
      if (/password|secret|token|credential|key|dsn|connectionstring/i.test(String(key))) {
        next[key] = "***redacted***";
      } else {
        next[key] = redactSensitive(item);
      }
    }
    return next;
  }
  return value;
}

function safeLower(value) {
  return String(value || "").toLowerCase();
}

function normalizeTenantContext(args = {}) {
  return {
    tenantId: args.tenantId || args.tenant || args.tenantContext,
    tenant: args.tenant || args.tenantId || args.tenantContext,
  };
}

function resolveExecutionMode(args = {}) {
  return safeLower(args.executionMode || (args.dryRun ? "dry_run" : "dry_run"));
}

function shouldApply(args = {}) {
  const mode = resolveExecutionMode(args);
  return mode !== "dry_run" && mode !== "simulate" && mode !== "analysis";
}

function isMockLikeSource(source) {
  return String(source || "").toLowerCase().includes("mock");
}

function isLiveEvidenceSource(source) {
  return /live|postgres|sqlserver|database|adapter/i.test(String(source || ""));
}

function shouldBlockMockRuntime(tool, result, policy, environment) {
  if (String(environment || "").toLowerCase() !== "production") {
    return false;
  }
  if (!policy?.auth?.requireLiveConnection || MOCK_ALLOWED_IN_PRODUCTION.has(tool)) {
    return false;
  }
  if (LIVE_EVIDENCE_TOOLS.has(tool) && !isLiveEvidenceSource(result?.source)) {
    return true;
  }
  return isMockLikeSource(result?.source);
}

function buildMockRuntimeBlock(tool, environment, result = {}) {
  const needsLiveEvidence = LIVE_EVIDENCE_TOOLS.has(tool);
  return {
    blocked: true,
    blockedReason: needsLiveEvidence
      ? ["mock_runtime_not_allowed_in_production", "mock_evidence_not_allowed"]
      : ["mock_runtime_not_allowed_in_production"],
    requiredControls: needsLiveEvidence
      ? ["live_connection", "live_plan_evidence", "live_runtime_statistics"]
      : ["live_connection", "live_tool_implementation"],
    status: needsLiveEvidence ? "live_evidence_required" : "mock_runtime_blocked",
    environment,
    source: "policy",
    tool,
    originalSource: result.source || "mock",
  };
}

function buildPolicySnapshot(policy) {
  return {
    policyVersion: "1.0",
    defaultEnvironment: policy.defaultEnvironment,
    risk: policy.risk || {},
    sandboxPolicy: policy.sandboxPolicy || {},
    migrationSigning: policy.migrationSigning || {},
    queryAllowlistMode: policy.queryAllowlistMode,
    allowedWriteActionsInProduction: policy.allowedWriteActionsInProduction,
    rolePolicy: policy.rolePolicy || {},
    rls: policy.rls || {},
  };
}

function makePolicyFingerprint(policy) {
  return sha256(stableStringify(buildPolicySnapshot(policy)));
}

function actionFingerprintForTool(tool, args) {
  const sqlSource = normalizeText(
    args?.sql ||
      args?.query ||
      args?.forwardSql ||
      args?.rollbackSql ||
      args?.indexStatement ||
      args?.ddlDraft,
  );
  if (!sqlSource) {
    return "";
  }
  return sha256(`${tool}|${sqlSource}`);
}

function draftSqlTokens(value) {
  return normalizeText(value)
    .toLowerCase()
    .replace(/[^a-z0-9_ ]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

function buildIntentContract(args = {}, policy) {
  const naturalLanguage = normalizeText(args.naturalLanguage || args.intent || args.prompt || args.query || args.sql);
  const sqlText = normalizeText(args.sql || args.query || "");
  const targetText = naturalLanguage || sqlText;
  const risk = classify(targetText);
  const lower = targetText.toLowerCase();
  const intentType = /\b(create|alter|drop|truncate|delete|update|insert|merge|grant|revoke)\b/i.test(targetText)
    ? "schema_change"
    : /\b(propose|migration|rollback|index|partition)\b/i.test(targetText)
      ? "schema_change"
      : /\b(select|explain|show|count|with)\b/i.test(targetText) || !targetText
        ? "read"
        : "analysis";
  const scope = {
    environment: args.environment || policy?.defaultEnvironment || "lab",
    database: args.database || "default",
    schema: args.schema || (normalizeEngine(args.engine || "sqlserver") === "sqlserver" ? "dbo" : "public"),
    tenant: args.tenantId || args.tenant || "global",
  };
  const expectedSideEffects = new Set();
  if (["schema_change"].includes(intentType) || ["HIGH", "CRITICAL"].includes(risk.riskLevel)) {
    expectedSideEffects.add("write");
    expectedSideEffects.add("schema_or_data_change");
  } else {
    expectedSideEffects.add("read");
  }
  if (risk.sqlFingerprint) {
    expectedSideEffects.add("statement_bound");
  }
  const requiresApprovals = risk.riskLevel === "HIGH" || risk.riskLevel === "CRITICAL" || String(scope.environment).toLowerCase() === "production";
  return {
    intent_type: intentType,
    scope,
    risk_tier: risk.riskLevel,
    expected_side_effects: Array.from(expectedSideEffects),
    required_approvals: requiresApprovals ? ["policy_review", "change_audit"] : ["policy_review"],
    original_intent: naturalLanguage || sqlText,
    riskSignals: risk.riskSignals,
    safety_summary: {
      sqlFingerprint: risk.sqlFingerprint,
      estimatedImpact: risk.impact,
      requiresHumanApproval: risk.requiresHumanApproval,
      estimatedComplexity: risk.estimatedComplexity,
    },
    roundTripValidationMode: "parser_lightpath",
  };
}

function evaluateIntentRoundTrip(intent, draftedSql) {
  const sqlText = normalizeText(draftedSql);
  if (!sqlText || !intent || !intent.risk_tier) {
    return {
      roundTripMatch: false,
      reasons: ["missing_intent_or_sql"],
    };
  }
  const draftRisk = classify(sqlText);
  const reasons = [];
  const riskMatch = draftRisk.riskLevel === intent.risk_tier;
  if (!riskMatch) {
    reasons.push("risk_tier_changed_after_roundtrip");
  }
  if (!draftSqlTokens(sqlText).length) {
    reasons.push("insufficient_sql_structure");
  }
  return {
    roundTripMatch: riskMatch && reasons.length === 0,
    reasons,
    draftRiskLevel: draftRisk.riskLevel,
    tokenizedLength: draftSqlTokens(sqlText).length,
  };
}

function buildDecisionGraph(params = {}) {
  const graphId = generateId("dg");
  const nodes = [];
  nodes.push({
    nodeId: "n1",
    kind: "intent_contract",
    status: params.intentContract ? "ok" : "skipped",
    outputType: "intent_contract",
  });
  nodes.push({
    nodeId: "n2",
    kind: "risk_classification",
    status: params.risk?.riskLevel ? "ok" : "skipped",
    riskLevel: params.risk?.riskLevel,
  });
  nodes.push({
    nodeId: "n3",
    kind: "policy_decision",
    status: params.policyDecision?.decision ? "ok" : "skipped",
    decision: params.policyDecision?.decision,
  });
  if (params.executionRequested) {
    nodes.push({
      nodeId: "n4",
      kind: "tool_execution",
      status: params.executionStatus || "pending",
      tool: params.tool,
    });
  }
  return {
    graph_id: graphId,
    policy_snapshot_id: params.policySnapshotId || "",
    action_nodes: nodes,
    risk_explainer: `${params.tool || "unknown"}:${params.risk?.riskLevel || "UNKNOWN"} -> ${params.policyDecision?.decision || "PENDING"}`,
    rollback_plan: params.rollbackPlan || "replay_previous_revision_with_policy_override",
    telemetry_refs: params.telemetryRefs || [],
  };
}

function toReplayComparison(before, after) {
  const beforeJson = stableStringify(before);
  const afterJson = stableStringify(after);
  const changed = beforeJson !== afterJson;
  return {
    changed,
    beforeSummary: {
      keyCount: before && typeof before === "object" ? Object.keys(before).length : 0,
      hash: sha256(beforeJson),
    },
    afterSummary: {
      keyCount: after && typeof after === "object" ? Object.keys(after).length : 0,
      hash: sha256(afterJson),
    },
    differences: changed ? ["decision_graph_or_payload_diff"] : [],
  };
}

function signMigrationArtifact(tool, args, payload) {
  const secret = getMigrationSigningSecret();
  const ttl = getMigrationSignatureTTL();
  const signedAt = shouldApply(args) ? args.migrationSignedAt : new Date().toISOString();
  const expiresAt = shouldApply(args) ? args.migrationSigningExpiresAt : new Date(Date.parse(signedAt) + ttl * 1000).toISOString();
  const statementSource =
    normalizeText(
      payload?.forwardSql ||
        payload?.ddlDraft ||
        payload?.indexStatement ||
        payload?.rollbackSql ||
        payload?.validationSql?.join("\n"),
    ) || actionFingerprintForTool(tool, args);
  const statementFingerprint = sha256(statementSource);
  const signingInput = stableStringify({
    tool,
    database: args?.database,
    schema: args?.schema,
    engine: args?.engine,
    environment: args?.environment || "lab",
    connectionProfile: args?.connectionProfile || null,
    signedAt,
    expiresAt,
    validationSql: payload.validationSql || [],
    statementFingerprint,
    actor: args?.actor,
    statement: statementSource,
  });
  if (!secret) {
    return {
      ...payload,
      actionFingerprint: statementFingerprint,
      sqlFingerprint: statementFingerprint,
      migrationSignatureRequired: true,
      migrationSignature: "",
      migrationSigningStatus: "unavailable",
      migrationSigningExpiresAt: null,
      migrationSignerKeyId: getMigrationSignerKeyId(),
      migrationSignatureAlgorithm: "HMAC-SHA256",
      migrationSignaturePolicyHash: sha256(`${tool}|${args?.environment || ""}|${args?.database || ""}`),
      migrationArtifactSchema: "1.0",
      migrationArtifactVersion: 2,
    };
  }
  const migrationSignature = crypto.createHmac("sha256", secret).update(signingInput).digest("hex");
  return {
    ...payload,
    actionFingerprint: statementFingerprint,
    sqlFingerprint: statementFingerprint,
    migrationSignatureRequired: true,
    migrationSignature,
    migrationSigningStatus: "signed",
    migrationSignatureAlgorithm: "HMAC-SHA256",
    migrationSignedAt: signedAt,
    migrationSigningExpiresAt: expiresAt,
    migrationSignerKeyId: getMigrationSignerKeyId(),
    migrationSignaturePolicyHash: sha256(`${tool}|${args?.environment || ""}|${args?.database || ""}`),
    migrationArtifactSchema: "1.0",
    migrationArtifactVersion: 2,
  };
}

async function withAdapter(context, args = {}, fn) {
  const { adapter, status } = await createAdapter(context, args);
  if (status?.blocked) {
    await adapter.close();
    return status;
  }
  const source = hasMockAdapter(status) ? "mock" : "live";
  try {
    const result = await fn(adapter);
    return { source, ...result };
  } finally {
    await adapter.close();
  }
}

async function withPolicyAudit(tool, args, actor, fn, options = {}) {
  const context = resolveCatalog();
  const { stateFile, policy } = context;
  const effectiveActor = args && args.actor ? args.actor : actor;
  const bypassPolicyTools = new Set(["classify_risk", "enforce_policy"]);
  const risk = classify(String(args?.sql || args?.query || ""));
  const sqlFingerprint = actionFingerprintForTool(tool, args);
  const actionFingerprint = actionFingerprintForTool(tool, args);
  const migrationSignature = args?.migrationSignature || args?.signature || "";
  const executionModeDryRun = resolveExecutionMode(args) === "dry_run";
  const environment = (args && args.environment) || policy.defaultEnvironment;
  const forcedDecision = options.forcePolicyDecision && options.forcePolicyDecision.decision ? options.forcePolicyDecision : null;
  const rlsContext = normalizeTenantContext(args);
  const decision = forcedDecision || classifyDecision({
    actionType: tool,
    environment,
    riskLevel: risk.riskLevel,
    database: args?.database,
    schema: args?.schema,
    actor: effectiveActor,
    sqlFingerprint,
    migrationSignature,
    actionFingerprint,
    isDryRun: executionModeDryRun,
    rlsContext,
  });
  const policySnapshot = buildPolicySnapshot(policy);
  const policyFingerprint = makePolicyFingerprint(policySnapshot);
  const policySnapshotId = policyFingerprint;
  const migrationSignatureExpiresAt = String(args?.migrationSigningExpiresAt || "");
  const isExpiredMigrationSignature =
    migrationSignature && migrationSignatureExpiresAt && new Date(migrationSignatureExpiresAt).getTime() < Date.now();
  const decisionGraph = buildDecisionGraph({
    tool,
    risk,
    policyDecision: decision,
    policySnapshotId,
    executionRequested: true,
    rollbackPlan: "replay_or_rollback_plan_recorded",
  });

  if (bypassPolicyTools.has(tool)) {
    const result = await fn(context, args, {
      policyDecision: decision,
      actor: effectiveActor,
      environment,
      riskLevel: risk.riskLevel,
      sqlFingerprint,
      actionFingerprint,
      migrationSignature,
    });
    const policyBypassDecision = {
      actionType: tool,
      environment,
      riskLevel: risk.riskLevel,
      policyVersion: "1.0",
      requiredControls: [],
      decision: "ALLOW",
      reasonCodes: [],
    };
    const event = buildEvent({
      tool,
      actor: effectiveActor,
      environment,
      riskLevel: risk.riskLevel,
      decision: "ALLOW",
      requiresApproval: false,
      payload: {
        args,
        risk,
        decision: policyBypassDecision,
        policyInputs: { sqlFingerprint, actionFingerprint, migrationSignature },
        policyFingerprint,
      },
    });
    const { replay } = appendAuditEvent(stateFile, event);
    if (policy?.replay?.enabled) {
      remember(context, "executionReplays", {
        tool,
        actor: effectiveActor,
        environment,
        riskLevel: risk.riskLevel,
        decision: "ALLOW",
        auditId: event.id,
        source: result.source || "mock",
        replayId: replay?.replayId || null,
        previousReplayId: replay?.previousReplayId || null,
        args: redactSensitive(args || {}),
        policyDecision: policyBypassDecision,
        policyFingerprint,
        policySnapshot,
        decisionGraph,
      });
    }
    const agentPlan = orchestrateAgents(tool, risk.riskLevel, policyBypassDecision);
    remember(context, "policyDecisions", {
      tool,
      environment,
      riskLevel: risk.riskLevel,
      decision: "ALLOW",
      decisionGraph,
    });
    return {
      ...result,
      source: result.source || "mock",
      risk,
      policyDecision: policyBypassDecision,
      agentPlan,
      auditId: event.id,
      decisionGraph,
      replay_reproducibility: true,
    };
  }

  if (isExpiredMigrationSignature) {
    const mismatchResult = {
      applied: false,
      execution: { executed: false },
      blocked: true,
      blockedReason: ["migration_signature_expired"],
      requiredControls: ["migration_signature_expired", "policy_owner_signoff"],
      status: "signature_expired",
      environment,
      requiresApproval: true,
    };
    const expiredEvent = buildEvent({
      tool,
      actor: effectiveActor,
      environment,
      riskLevel: risk.riskLevel,
      decision: "BLOCK",
      status: mismatchResult.status,
      blockedReason: mismatchResult.blockedReason.join(", "),
      requiresApproval: mismatchResult.requiresApproval,
      payload: {
        args,
        risk,
        decision,
        blocked: true,
        policyInputs: { sqlFingerprint, actionFingerprint, migrationSignature },
        policyFingerprint,
        decisionGraph,
      },
    });
    const { replay } = appendAuditEvent(stateFile, expiredEvent);
    if (policy?.replay?.enabled) {
      remember(context, "executionReplays", {
        tool,
        actor: effectiveActor,
        environment,
        riskLevel: risk.riskLevel,
        decision: "BLOCK",
        auditId: expiredEvent.id,
        source: "policy",
        replayId: replay?.replayId || null,
        previousReplayId: replay?.previousReplayId || null,
        args: redactSensitive(args || {}),
        policyDecision: {
          ...decision,
          decision: "BLOCK",
          reasonCodes: [...decision.reasonCodes, "migration_signature_expired"],
        },
        policyFingerprint,
        policySnapshot,
        decisionGraph,
      });
    }
    const agentPlan = orchestrateAgents(tool, risk.riskLevel, {
      ...decision,
      decision: "BLOCK",
      reasonCodes: [...decision.reasonCodes, "migration_signature_expired"],
    });
    remember(context, "policyDecisions", {
      tool,
      environment,
      riskLevel: risk.riskLevel,
      decision: "BLOCK",
      reason: "migration_signature_expired",
      decisionGraph,
    });
    return {
      ...mismatchResult,
      source: "policy",
      risk,
      policyDecision: { ...decision, decision: "BLOCK", reasonCodes: [...decision.reasonCodes, "migration_signature_expired"] },
      agentPlan,
      auditId: expiredEvent.id,
      decisionGraph,
      replay_reproducibility: false,
    };
  }

  if (decision.decision !== "ALLOW") {
    const blockedResult = {
      ...(MIGRATION_ACTIONS.has(tool) ? { applied: false, execution: { executed: false } } : {}),
      blocked: true,
      blockedReason: decision.reasonCodes,
      requiredControls: decision.requiredControls,
      status: decision.decision === "SCOPE_TO_SANDBOX" ? "requires_sandbox_context" : "blocked_by_policy",
      environment,
      requiresApproval: decision.decision === "REQUIRES_APPROVAL",
      policyInputs: { sqlFingerprint, actionFingerprint, migrationSignature },
    };
    const event = buildEvent({
      tool,
      actor: effectiveActor,
      environment,
      riskLevel: risk.riskLevel,
      decision: decision.decision,
      requiresApproval: blockedResult.requiresApproval,
      status: blockedResult.status,
      blockedReason: decision.reasonCodes.join(", "),
      payload: {
        args,
        risk,
        decision,
        blocked: true,
        policyInputs: { sqlFingerprint, actionFingerprint, migrationSignature },
        policyFingerprint,
      },
    });
    const { replay } = appendAuditEvent(stateFile, event);
    if (policy?.replay?.enabled) {
      remember(context, "executionReplays", {
        tool,
        actor: effectiveActor,
        environment,
        riskLevel: risk.riskLevel,
        decision: decision.decision,
        auditId: event.id,
        source: "policy",
        replayId: replay?.replayId || null,
        previousReplayId: replay?.previousReplayId || null,
        args: redactSensitive(args || {}),
        policyDecision: decision,
        policyFingerprint,
        policySnapshot,
        decisionGraph,
      });
    }
    const agentPlan = orchestrateAgents(tool, risk.riskLevel, decision);
    remember(context, "policyDecisions", {
      tool,
      environment,
      riskLevel: risk.riskLevel,
      decision: decision.decision,
      decisionGraph,
    });
    return {
      ...blockedResult,
      source: "policy",
      risk,
      policyDecision: decision,
      agentPlan,
      auditId: event.id,
      decisionGraph,
      replay_reproducibility: false,
    };
  }

  let result = await fn(context, args, {
    policyDecision: decision,
    actor: effectiveActor,
    environment,
    riskLevel: risk.riskLevel,
    sqlFingerprint,
    actionFingerprint,
    migrationSignature,
  });
  if (shouldBlockMockRuntime(tool, result, policy, environment)) {
    result = buildMockRuntimeBlock(tool, environment, result);
  }
  if (MIGRATION_ACTIONS.has(tool) && args?.migrationSignature && result?.migrationSigningStatus === "signed") {
    const providedSignature = String(args.migrationSignature || "");
    const generatedSignature = String(result?.migrationSignature || "");
    if (providedSignature && generatedSignature && providedSignature !== generatedSignature) {
      const mismatchResult = {
        blocked: true,
        blockedReason: ["migration_signature_invalid"],
        requiredControls: ["migration_signature"],
        status: "signature_mismatch",
        environment,
        requiresApproval: false,
      };
      const event = buildEvent({
        tool,
        actor: effectiveActor,
        environment,
        riskLevel: risk.riskLevel,
        decision: "BLOCK",
        status: mismatchResult.status,
        blockedReason: mismatchResult.blockedReason.join(", "),
        requiresApproval: false,
        payload: {
          args,
          risk,
          decision,
          blocked: true,
          policyInputs: { sqlFingerprint, actionFingerprint, migrationSignature },
          policyFingerprint,
          migrationSignatureMismatch: {
            expected: generatedSignature,
            received: providedSignature,
          },
        },
      });
      const { replay } = appendAuditEvent(stateFile, event);
      if (policy?.replay?.enabled) {
        remember(context, "executionReplays", {
          tool,
          actor: effectiveActor,
          environment,
          riskLevel: risk.riskLevel,
          decision: "BLOCK",
          auditId: event.id,
          source: result.source || "mock",
        replayId: replay?.replayId || null,
        previousReplayId: replay?.previousReplayId || null,
        migrationSignatureMismatch: true,
        args: redactSensitive(args || {}),
        policyDecision: {
          ...decision,
          decision: "BLOCK",
          reasonCodes: [...decision.reasonCodes, "migration_signature_invalid"],
        },
        policyFingerprint,
        policySnapshot,
        decisionGraph,
      });
      }
      const agentPlan = orchestrateAgents(tool, risk.riskLevel, {
        ...decision,
        decision: "BLOCK",
        reasonCodes: [...decision.reasonCodes, "migration_signature_invalid"],
      });
      return {
        ...mismatchResult,
        source: result.source || "mock",
        risk,
        policyDecision: { ...decision, decision: "BLOCK", reasonCodes: [...decision.reasonCodes, "migration_signature_invalid"] },
        agentPlan,
        auditId: event.id,
        decisionGraph,
        replay_reproducibility: false,
        decisionMatch: {
          original: null,
          rerun: null,
        },
      };
    }
  }
  const event = buildEvent({
    tool,
    actor: effectiveActor,
    environment,
    riskLevel: risk.riskLevel,
    decision: decision.decision,
    payload: {
      args,
      risk,
      decision,
      result,
      policyInputs: { sqlFingerprint, actionFingerprint, migrationSignature },
      policyFingerprint,
    },
  });
  const { replay } = appendAuditEvent(stateFile, event);
  if (policy?.replay?.enabled) {
    remember(context, "executionReplays", {
      tool,
      actor: effectiveActor,
      environment,
      riskLevel: risk.riskLevel,
      decision: decision.decision,
      auditId: event.id,
      source: result.source || "mock",
      replayId: replay?.replayId || null,
      previousReplayId: replay?.previousReplayId || null,
      actionFingerprint,
      migrationSignature: result?.migrationSignature,
      migrationSigningStatus: result?.migrationSigningStatus,
      args: redactSensitive(args || {}),
      policyDecision: decision,
      policyFingerprint,
      policySnapshot,
      decisionGraph,
    });
  }
  const agentPlan = orchestrateAgents(tool, risk.riskLevel, decision);
  remember(context, "policyDecisions", {
    tool,
    environment: args?.environment || policy.defaultEnvironment,
    riskLevel: risk.riskLevel,
    decision: decision.decision,
    decisionGraph,
  });
  return {
    ...result,
    source: result.source || "mock",
    risk,
    policyDecision: decision,
    agentPlan,
    auditId: event.id,
    decisionGraph,
    replay_reproducibility: shouldApply(args) ? Boolean(result?.execution?.executed || result?.execution === null || result?.executed === false || result?.source) : true,
  };
}

async function runSqlWithReplaySafety(context, args = {}, sql, toolName, options = {}) {
  const statement = normalizeText(sql);
  if (!statement) {
    return { executed: false, error: "missing_sql", source: "mock" };
  }
  const executionMode = resolveExecutionMode(options);
  if (executionMode === "dry_run" || options.isDryRun === true) {
    return {
      executed: false,
      source: "mock",
      dryRun: true,
      statement,
      executionMode,
    };
  }
  const byAdapter = await withAdapter(context, args, async (adapter) => {
    const execution = await adapter.executeSql(statement, {
      database: args.database,
      schema: resolveSchema(normalizeEngine(args.engine || "sqlserver"), args),
      tool: toolName,
      actor: args.actor,
      executionMode,
      isMigration: Boolean(options.isMigration),
    });
    return {
      ...execution,
      statement,
      executionMode,
      executed: execution?.executed === true && !execution?.error && execution.source === "live",
      source: execution.source || adapter.source,
    };
  });
  if (byAdapter.blocked) {
    return byAdapter;
  }
  return byAdapter;
}

async function runValidationQueries(context, args = {}, validationSql = [], toolName) {
  const queries = Array.isArray(validationSql) ? validationSql : [];
  const validations = [];
  const executionMode = resolveExecutionMode(args);
  for (const validationSqlText of queries) {
    const normalized = normalizeText(validationSqlText);
    if (!normalized) {
      continue;
    }
    const validation = await runSqlWithReplaySafety(context, args, normalized, `${toolName}.validation`, {
      isMigration: false,
      executionMode,
    });
    validations.push({
      query: normalized,
      ...validation,
    });
  }
  return {
    validations,
    allPassed: validations.length > 0 && validations.every((entry) => entry.executed === true && !entry.error && !entry.blocked),
  };
}

async function executeMigrationFlow(tool, context, args = {}, draft = {}) {
  const executionMode = resolveExecutionMode(args);
  let adminApproval = null;
  const blocked = (reason) => ({ executionMode, applied: false, blocked: true,
    status: reason, blockedReason: [reason], source: "policy", execution: { executed: false },
    ...(tool === "rollback_migration" ? { rollbackExecuted: false, verificationResult: "not_verified" } : {}) });
  if (!["dry_run", "apply"].includes(executionMode)) return blocked("unsupported_execution_mode");
  if (executionMode === "apply") {
    if ((args.environment || context.policy?.defaultEnvironment || "lab") !== "lab") return blocked("production_migration_not_qualified");
    if (!["create_index", "rollback_migration"].includes(tool)) return blocked("migration_tool_not_qualified");
    if (!args.engine || !args.database || !args.schema || !args.table || !args.actor) return blocked("explicit_migration_scope_required");
    if (!getMigrationSigningSecret() || draft.migrationSigningStatus !== "signed") return blocked("migration_signing_key_missing");
    const issued = Date.parse(args.migrationSignedAt);
    const expires = Date.parse(args.migrationSigningExpiresAt);
    if (!Number.isFinite(issued) || !Number.isFinite(expires) || issued > Date.now() || expires <= Date.now() ||
        expires <= issued || expires - issued > getMigrationSignatureTTL() * 1000) return blocked("migration_signature_time_invalid");
    const received = String(args.migrationSignature || "");
    if (!/^[a-f0-9]{64}$/.test(received) || !crypto.timingSafeEqual(Buffer.from(received, "hex"), Buffer.from(draft.migrationSignature, "hex"))) {
      return blocked("migration_signature_invalid");
    }
    const enterpriseRequired = process.env.CODEXDB_REQUIRE_ENTERPRISE_APPROVAL === "true" || Boolean(process.env.CODEXDB_ENTERPRISE_APPROVAL_URL);
    const witnessRequired = process.env.CODEXDB_REQUIRE_AUDIT_WITNESS === "true" || Boolean(process.env.CODEXDB_AUDIT_WITNESS_URL);
    if (enterpriseRequired || witnessRequired || process.env.CODEXDB_REQUIRE_AUTHENTICATED_APPROVAL === "true" || process.env.CODEXDB_APPROVAL_TRUST_JSON || args.adminApprovalReceipt) {
      const approvalInput = { receipt: args.adminApprovalReceipt, actor: args.actor, tool, engine: args.engine,
        database: args.database, schema: args.schema, environment: args.environment || "lab",
        connectionProfile: args.connectionProfile || args.engine, statementHash: draft.actionFingerprint };
      adminApproval = enterpriseRequired ? await verifyEnterpriseApproval(approvalInput) : verifyAdminApproval(approvalInput);
      if (!adminApproval.authorized) return blocked(adminApproval.reason);
      if (witnessRequired) {
        const eventHash = crypto.createHash("sha256").update(JSON.stringify({ phase: "authorized_intent", receiptHash: adminApproval.receiptHash, statementHash: draft.actionFingerprint })).digest("hex");
        const witness = await verifyEnterpriseAuditWitness({ action: "append", eventHash });
        if (!witness.acknowledged) return blocked(witness.reason);
        adminApproval.auditWitness = witness;
      }
      const consumption = consumeAdminApproval(context, adminApproval);
      if (!consumption.consumed) return blocked(consumption.reason);
    }
  }
  const forwardSql = draft.forwardSql || draft.indexStatement || draft.ddlDraft || draft.rollbackSql;
  const liveContext = executionMode === "apply" ? { ...context, policy: { ...context.policy,
    auth: { ...context.policy?.auth, requireLiveConnection: true } } } : context;
  const execution = await runSqlWithReplaySafety(liveContext, args, forwardSql, `${tool}`, {
    isMigration: true,
    executionMode,
  });
  const validation = execution.executed === true && !execution.error
    ? await runValidationQueries(liveContext, args, draft.validationSql, tool)
    : { validations: [], allPassed: false, status: "not_run" };
  const applied = executionMode === "apply" && execution.executed === true && !execution.error && !execution.blocked;
  return {
    ...draft,
    executionMode,
    applied,
    adminApproval: adminApproval || { authorized: false, provenance: "legacy_lab_actor_not_authenticated" },
    source: executionMode === "apply" ? execution.source : draft.source,
    ...(tool === "rollback_migration" ? { rollbackExecuted: applied,
      verificationResult: applied && validation.allPassed ? "statement_executed_validation_queries_succeeded" : "not_verified" } : {}),
    execution,
    validation,
  };
}

function normalizeEngine(value = "sqlserver") {
  const engine = String(value || "sqlserver").toLowerCase();
  if (engine === "postgres" || engine === "pg") {
    return "postgres";
  }
  return "sqlserver";
}

function resolveSchema(engine, args = {}) {
  return engine === "sqlserver" ? (args.schema || "dbo") : (args.schema || "public");
}

async function listDatabases(context, args = {}) {
  const engine = normalizeEngine(args.engine || "sqlserver");
  const fallback = context.sampleCatalog[engine]?.databases || [];
  const byAdapter = await withAdapter(context, { ...args, engine }, async (adapter) => {
    const values = await adapter.listDatabases();
    return { databases: Array.isArray(values) ? values : [] };
  });
  if (byAdapter.blocked) {
    return byAdapter;
  }
  const includeSystem = Boolean(args.includeSystem);
  const selected = (byAdapter.databases && byAdapter.databases.length ? byAdapter.databases : fallback).map((item) => (typeof item === "string" ? { database: item } : item));
  const databases = selected.filter(
    (db) => includeSystem || !["master", "template0", "template1", "msdb"].includes(db.database)
  );
  return {
    count: databases.length,
    databases,
    source: byAdapter.source,
  };
}

async function listTables(context, args = {}) {
  const engine = normalizeEngine(args.engine || "sqlserver");
  const schema = resolveSchema(engine, args);
  const database = args.database;
  const byAdapter = await withAdapter(context, { ...args, engine }, async (adapter) => {
    const values = await adapter.listTables({ engine, database, schema });
    return { tables: Array.isArray(values) ? values : [] };
  });
  if (byAdapter.blocked) {
    return byAdapter;
  }

  const tables = (byAdapter.tables || []);
  if (tables.length) {
    const normalized = tables.map((table) => ({
      database: table.database || database,
      schema: table.schema || schema,
      table: table.table || table.name,
      type: table.type || table.kind || "table",
      rowCountHint: table.rowCountHint || 0,
      indexCount: table.indexCount || 0,
      containsPIIFlag: Boolean(table.containsPIIFlag),
    }));
    return { count: normalized.length, tables: normalized, source: byAdapter.source };
  }

  const schemas = context.sampleCatalog[engine]?.schemas?.[database]?.[schema];
  if (!schemas) {
    return { error: "database_schema_not_found", tables: [], source: byAdapter.source };
  }
  const includeViews = Boolean(args.includeViews);
  const includeMatViews = Boolean(args.includeMaterializedViews);
  const rows = Object.entries(schemas.tables).map(([table, meta]) => ({
    database,
    schema,
    table,
    type: includeViews || includeMatViews ? "view" : "table",
    rowCountHint: meta.rowCountHint,
    indexCount: meta.indexes.length,
    containsPIIFlag: Boolean(meta.containsPII),
  }));
  return { count: rows.length, tables: rows, source: "mock_fallback" };
}

async function describeTable(context, args = {}) {
  const engine = normalizeEngine(args.engine || "sqlserver");
  const schema = resolveSchema(engine, args);
  const database = args.database;
  const table = args.table;
  const byAdapter = await withAdapter(context, { ...args, engine }, async (adapter) =>
    adapter.describeTable({ engine, database, schema, table })
  );
  if (byAdapter.blocked) {
    return byAdapter;
  }
  if (byAdapter.error) {
    return byAdapter;
  }
  if (byAdapter && !byAdapter.columns && !byAdapter.sampleColumns) {
    const tableMeta = context.sampleCatalog[engine]?.schemas?.[database]?.[schema]?.tables?.[table];
    if (!tableMeta) {
      return { error: "table_not_found", table, schema, database, source: byAdapter.source };
    }
    return {
      columns: tableMeta.columns,
      constraints: tableMeta.columns.filter((c) => c.isPrimaryKey || c.isForeignKey),
      indexes: tableMeta.indexes,
      relationships: tableMeta.relationships,
      riskNotes: tableMeta.containsPII ? ["Contains PII-like columns"] : [],
      source: byAdapter.source,
    };
  }
  return byAdapter;
}

async function describeRelationships(context, args = {}) {
  const engine = normalizeEngine(args.engine || "sqlserver");
  const database = args.database;
  const schema = resolveSchema(engine, args);
  const byAdapter = await withAdapter(context, { ...args, engine }, async (adapter) => {
    if (adapter.describeRelationships) {
      return adapter.describeRelationships({ engine, database, schema });
    }
    return {};
  });
  if (byAdapter.blocked) {
    return byAdapter;
  }
  if (byAdapter.edges) {
    return { ...byAdapter, source: byAdapter.source, edges: byAdapter.edges };
  }
  const graph = buildSemanticGraph(context.sampleCatalog, engine, database, schema);
  const summary = summarize(graph);
  const criticalPaths = summary.criticalPaths.slice(0, Number(args.limit || 10)).map((path) => ({
    from: path.from,
    to: path.to,
    via: path.via,
    cardinality: path.cardinality,
    criticality: path.criticality,
  }));
  return {
    graphSummary: summary,
    edges: criticalPaths,
    criticalPathHint: criticalPaths.length ? "focus_join_order_on_relationships" : "none_detected",
    source: "mock_fallback",
  };
}

async function explainQuery(context, args = {}) {
  const byAdapter = await withAdapter(context, args, async (adapter) => adapter.explainQuery({ query: args.query, sql: args.sql }));
  if (byAdapter.blocked || byAdapter.error) {
    return byAdapter;
  }
  if (byAdapter.plan && byAdapter.bottlenecks) {
    return byAdapter;
  }
  return {
    plan: "MockExecPlan: Seq Scan -> Hash Join -> Sort -> Aggregate",
    bottlenecks: ["full-table scan on events", "hash spill risk"],
    rewriteHints: ["limit projected columns", "add composite index on user_email + created_at"],
    estimatedCost: 1420,
    confidence: "medium",
    source: byAdapter.source,
    sourceQuery: args.query || args.sql,
  };
}

async function queryStats(context, args = {}) {
  const byAdapter = await withAdapter(context, args, async (adapter) => ({ queryStats: await adapter.queryStats() }));
  if (byAdapter.blocked) {
    return byAdapter;
  }
  if (byAdapter.queryStats && !Array.isArray(byAdapter.queryStats) && byAdapter.queryStats.error) {
    return {
      ...byAdapter.queryStats,
      source: byAdapter.queryStats.source || byAdapter.source,
    };
  }
  const stats = Array.isArray(byAdapter.queryStats) ? byAdapter.queryStats : [];
  if (stats.length) {
    return {
      queryStats: stats,
      source: byAdapter.source,
      note: "Adapter-derived query stats snapshot.",
    };
  }
  if (byAdapter.source === "live") {
    return {
      queryStats: [],
      source: "live",
      note: "No query statistics returned by live adapter.",
    };
  }
  return {
    queryStats: [
      { queryId: "q-1122", avgMs: 250, p95Ms: 910, ioWait: "high", cpuMs: 60, regressionScore: 0.26 },
      { queryId: "q-1188", avgMs: 18, p95Ms: 32, ioWait: "low", cpuMs: 6, regressionScore: 0.08 },
    ],
    note: "Sample workload from in-memory benchmark profile.",
    source: byAdapter.source,
  };
}

async function lockAnalysis(context, args = {}) {
  const byAdapter = await withAdapter(context, args, async (adapter) => adapter.lockAnalysis(args));
  if (byAdapter.blocked || byAdapter.error) {
    return byAdapter;
  }
  return {
    deadlockRisk: byAdapter.deadlockRisk || "unknown",
    topWaiters: byAdapter.topWaiters || [],
    blockingChains: byAdapter.blockingChains || [],
    remediationPlan: byAdapter.remediationPlan || ["no live lock data returned"],
    source: byAdapter.source,
  };
}

async function indexUsage(context, args = {}) {
  const byAdapter = await withAdapter(context, args, async (adapter) => adapter.indexUsage(args));
  if (byAdapter.blocked || byAdapter.error) {
    return byAdapter;
  }
  return {
    table: byAdapter.table || args.table,
    indexes: byAdapter.indexes || [],
    recommendation: byAdapter.recommendation || ((byAdapter.indexes || []).length ? "review live index usage" : "no live index usage returned"),
    source: byAdapter.source,
  };
}

async function replicationStatus(context, args = {}) {
  const byAdapter = await withAdapter(context, args, async (adapter) => adapter.replicationStatus());
  if (byAdapter.blocked) {
    return byAdapter;
  }
  if (byAdapter && byAdapter.topology) {
    return { ...byAdapter, source: byAdapter.source };
  }
  return {
    topology: "primary-replica-2",
    lagSeconds: 1.2,
    trend: "stable",
    consistencyRisk: "low",
    actions: ["continue monitoring", "alert if lag > 8s"],
    source: byAdapter.source,
  };
}

async function detectPii(context, args = {}) {
  const engine = normalizeEngine(args.engine || "sqlserver");
  const schema = resolveSchema(engine, args);
  const database = args.database || "app_prod";
  const table = args.table;
  const byAdapter = await withAdapter(context, { ...args, engine }, async (adapter) =>
    adapter.detectPii({ engine, database, schema, table })
  );
  if (byAdapter.blocked) {
    return byAdapter;
  }
  if (byAdapter && byAdapter.piiColumns !== undefined) {
    return { ...byAdapter, source: byAdapter.source };
  }
  const catalog = context.sampleCatalog[engine]?.schemas?.[database]?.[schema]?.tables?.[table];
  if (!catalog) {
    return { piiColumns: [], sensitivityLevel: "unknown", policyViolations: [], remediation: "provide schema/table context", source: byAdapter.source };
  }
  const piiColumns = catalog.columns.filter((c) => c.pii).map((c) => c.name);
  return {
    piiColumns,
    sensitivityLevel: piiColumns.length ? "high" : "low",
    policyViolations: piiColumns.length ? ["PII exposure candidate detected"] : [],
    remediation: piiColumns.length ? "apply masking and narrow projection" : "no direct PII columns detected",
    source: byAdapter.source,
  };
}

async function proposeMigration(_context, args = {}) {
  const draft = {
    forwardSql: `-- PRD migration draft for ${(args.target || "v_next")}\nCREATE TABLE audit_events (...);`,
    rollbackSql: "DROP TABLE IF EXISTS audit_events;",
    dependencyGraph: ["fk_users_orders", "idx_orders_user_id"],
    riskProfile: "medium",
    validationChecklist: ["smoke_test_query", "fk_validation", "rollback_dry_run"],
    validationSql: ["SELECT 1"],
    source: "mock",
  };
  const signed = signMigrationArtifact("propose_migration", args, draft);
  return executeMigrationFlow("propose_migration", _context, args, signed);
}

async function simulateQuery(context, args = {}) {
  const query = String(args.sql || "");
  const risk = classify(query);
  return {
    sql: query.slice(0, 120),
    affectedRowsEstimate: query.length * 7,
    costEstimate: { cpu: "low", io: "medium", locks: "low" },
    lockEstimate: "low",
    rollbackPlan: "Use SAVEPOINT + transaction rollback",
    executionMode: risk.riskLevel === "HIGH" ? "sandbox_restricted" : "dry_run",
    source: context && context.stateFile ? "mock" : "mock",
  };
}

function indexMigrationIdentifiers(args) {
  const requestedEngine = String(args.engine || "sqlserver").toLowerCase();
  if (!["postgres", "postgresql", "pg", "sqlserver", "mssql"].includes(requestedEngine)) throw new Error("Unsupported migration engine");
  const engine = ["postgres", "postgresql", "pg"].includes(requestedEngine) ? "postgres" : "sqlserver";
  const table = args.table || "orders";
  const schema = args.schema || (engine === "postgres" ? "public" : "dbo");
  const indexName = args.indexName || `idx_${table}_created_at`;
  for (const value of [table, schema, indexName]) {
    if (typeof value !== "string" || !/^[A-Za-z_][A-Za-z0-9_]{0,62}$/.test(value)) throw new Error("Migration identifiers must be simple names of at most 63 characters");
  }
  const quote = (name) => engine === "postgres" ? `"${name}"` : `[${name}]`;
  return { table, engine, index: quote(indexName), qualifiedTable: `${quote(schema)}.${quote(table)}`,
    qualifiedIndex: `${quote(schema)}.${quote(indexName)}` };
}

async function createIndex(_context, args = {}) {
  const { table, index, qualifiedTable, qualifiedIndex, engine } = indexMigrationIdentifiers(args);
  const draft = {
    indexStatement: `CREATE INDEX ${index} ON ${qualifiedTable}(${engine === "postgres" ? '"created_at"' : '[created_at]'});`,
    safetyChecks: ["sample workload check", "online indexing window"],
    validationPlan: ["explain baseline", "explain after index", "latency diff"],
    rollbackPlan: engine === "postgres" ? `DROP INDEX ${qualifiedIndex};` : `DROP INDEX ${index} ON ${qualifiedTable};`,
    validationSql: ["SELECT 1"],
    source: "migration_draft",
  };
  const signed = signMigrationArtifact("create_index", args, draft);
  return executeMigrationFlow("create_index", _context, args, signed);
}

async function rollbackMigration(_context, args = {}) {
  const { index, qualifiedTable, qualifiedIndex, engine } = indexMigrationIdentifiers(args);
  const rollbackSql = engine === "postgres" ? `DROP INDEX ${qualifiedIndex};` : `DROP INDEX ${index} ON ${qualifiedTable};`;
  if (args.rollbackSql && args.rollbackSql !== rollbackSql) throw new Error("Rollback SQL must exactly match the scoped index rollback draft");
  const draft = {
    rollbackExecuted: false,
    verificationResult: "not_verified",
    postRollbackChecks: ["verify target index absence", "compare business rows"],
    migrationId: args.migrationId || "m-0001",
    rollbackSql,
    validationSql: ["SELECT 1"],
    source: "migration_draft",
  };
  const signed = signMigrationArtifact("rollback_migration", args, draft);
  return executeMigrationFlow("rollback_migration", _context, args, signed);
}

async function optimizeQuery(_context, args = {}) {
  const draft = {
    rewrites: [
      { statement: "replace correlated subquery with join", estimatedGainMs: 120, risk: "low" },
    ],
    explainDiff: {
      before: "Nested Loop + Sort",
      after: "Hash Join + Merge Join",
    },
    expectedGain: "12-22%",
    regressionRisk: "low",
    validationSql: ["SELECT 1 WHERE EXISTS (...)","EXPLAIN ANALYZE ..."],
    source: "mock",
  };
  const signed = signMigrationArtifact("optimize_query", args, draft);
  if (shouldApply(args)) {
    const draftWithSql = {
      ...signed,
      forwardSql: args.optimizedSql || args.sql || "",
      validationSql: signed.validationSql,
    };
    return executeMigrationFlow("optimize_query", _context, args, draftWithSql);
  }
  return signed;
}

async function createPartitioning(_context, args = {}) {
  const draft = {
    partitionPlan: "time-range partitioning on created_at with monthly windows",
    ddlDraft: `CREATE TABLE ... PARTITION BY RANGE (created_at);`,
    backoutPlan: "attach default partition + disable scheduler",
    healthChecks: ["check stats drift", "check partition pruning in explain", "IO growth trend"],
    validationSql: ["SELECT 1"],
    source: "mock",
  };
  const signed = signMigrationArtifact("create_partitioning", args, draft);
  return executeMigrationFlow("create_partitioning", _context, args, signed);
}

async function analyzeWorkload(context, args = {}) {
  const byAdapter = await withAdapter(context, args, async (adapter) => {
    const queryStatsResult = await adapter.queryStats(args);
    const lockResult = await adapter.lockAnalysis(args);
    const replicationResult = await adapter.replicationStatus(args);
    return {
      queryStats: Array.isArray(queryStatsResult) ? queryStatsResult : queryStatsResult.queryStats || [],
      queryStatsError: Array.isArray(queryStatsResult) ? null : queryStatsResult.error || null,
      lockAnalysis: lockResult,
      replicationStatus: replicationResult,
    };
  });
  if (byAdapter.blocked || byAdapter.error) {
    return byAdapter;
  }
  const liveQueryStats = byAdapter.queryStats || [];
  const liveLocks = byAdapter.lockAnalysis?.topWaiters || [];
  const liveReplication = byAdapter.replicationStatus ? [byAdapter.replicationStatus] : [];
  const signalInputs = {
    lockEvents: liveLocks.map((lock) => ({ session: lock.session, waitMs: lock.durationMs || 0 })),
    queryPlanEvents: liveQueryStats.filter((query) => Number.isFinite(query.p95Ms))
      .map((query) => ({ queryId: query.queryId, p95Ms: query.p95Ms })),
    replicationEvents: liveReplication,
  };
  const incidentCorrelation = correlateSignals(signalInputs);
  remember(context, "workloadSignals", {
    lockEvents: signalInputs.lockEvents.length,
    regressions: signalInputs.queryPlanEvents.length,
    replicaLagEvents: signalInputs.replicationEvents.length,
    correlationSeverity: incidentCorrelation.severity,
  });
  const slowQueries = liveQueryStats.filter((query) => Number(query.p95Ms || query.avgMs || 0) >= 250);
  const lockPressure = liveLocks.filter((lock) => Number(lock.durationMs || 0) >= 1000);
  return {
    workloadClusters: [
      { pattern: "slow_queries", count: slowQueries.length },
      { pattern: "lock_pressure", count: lockPressure.length },
    ],
    opportunityList: [
      ...(slowQueries.length ? ["inspect top live query plans"] : []),
      ...(lockPressure.length ? ["reduce blocking transaction scope"] : []),
      ...(!slowQueries.length && !lockPressure.length ? ["continue baseline collection"] : []),
    ],
    riskRanking: incidentCorrelation.severity || "low",
    nextActions: ["run explain_query on top live regressions", "review index_usage for lock-heavy tables"],
    incidentCorrelation,
    queryStatsError: byAdapter.queryStatsError,
    measurementCoverage: {
      queryCount: liveQueryStats.length,
      measuredP95Count: signalInputs.queryPlanEvents.length,
      regressionAssessment: "requires_comparable_baseline",
      slowQueryBasis: "p95_when_available_otherwise_mean_not_percentile",
    },
    source: byAdapter.source,
  };
}

async function compileIntent(context, args = {}) {
  const intent = buildIntentContract(args, context.policy || {});
  const generatedSql = normalizeText(
    args.sql ||
      args.query ||
      `/* intent:${intent.intent_type} */ SELECT 1;`
  );
  return {
    intentContract: intent,
    compiledSql: generatedSql,
    roundTrip: evaluateIntentRoundTrip(intent, generatedSql),
    source: "mock",
  };
}

function translateSqlStatement(sql, sourceEngine, targetEngine) {
  const source = String(sourceEngine || "sqlserver").toLowerCase();
  const target = String(targetEngine || "postgres").toLowerCase();
  let statement = String(sql || "");
  const migrations = [];
  if (source === target) {
    return {
      translatedSql: statement,
      incompatibilities: [],
      migrations,
    };
  }
  if (source === "sqlserver" && /GETDATE\(\)/i.test(statement)) {
    statement = statement.replace(/GETDATE\(\)/gi, "NOW()");
    migrations.push("getdate_to_now");
  }
  if (source === "postgres" && /NOW\(\)/i.test(statement)) {
    statement = statement.replace(/NOW\(\)/gi, "GETDATE()");
    migrations.push("now_to_getdate");
  }
  if (source === "sqlserver") {
    const topMatch = statement.match(/^\s*SELECT\s+TOP\s+(\d+)\s+/i);
    if (topMatch && topMatch[1]) {
      const topN = topMatch[1];
      statement = statement.replace(/^\s*SELECT\s+TOP\s+\d+\s+/i, "SELECT ");
      statement += ` LIMIT ${topN}`;
      migrations.push("top_to_limit");
    }
  }
  return {
    translatedSql: statement,
    migrations,
    incompatibilities: [],
  };
}

async function crossEngineTranslate(context, args = {}) {
  const sourceEngine = normalizeEngine(args.sourceEngine || "sqlserver");
  const targetEngine = normalizeEngine(args.targetEngine || (sourceEngine === "sqlserver" ? "postgres" : "sqlserver"));
  const sql = normalizeText(args.sql || args.query || "");
  const translation = translateSqlStatement(sql, sourceEngine, targetEngine);
  const compatibility = targetEngine === sourceEngine ? [] : [{
    area: "dialect_semantics",
    status: "review_required",
    recommendation: "Validate locking/identity semantics before execution.",
  }];
  return {
    sourceEngine,
    targetEngine,
    translation,
    compatibility,
    source: "mock",
  };
}

async function suggestPolicy(context, _args = {}) {
  const policyDecisions = recall(context, "policyDecisions", 40);
  const blockers = policyDecisions.filter((decision) => decision?.decision && decision.decision !== "ALLOW").slice(0, 10);
  const suggestions = [];
  if (blockers.length > 2) {
    suggestions.push({
      suggestion: "Create tighter intent allowlist for frequently blocked NL/SQL patterns.",
      confidence: "medium",
    });
  }
  if (policyDecisions.some((entry) => String(entry.decision || "").includes("SCOPE_TO_SANDBOX"))) {
    suggestions.push({
      suggestion: "Add structured sandbox profiles by tool+risk class.",
      confidence: "high",
    });
  }
  return {
    suggestionCount: suggestions.length,
    suggestions,
    source: "mock",
    evidence: {
      observedPolicyRejects: blockers.length,
    },
  };
}

async function selfHealingPlaybook(context, _args = {}) {
  const workloadSignals = recall(context, "workloadSignals", 30);
  const policySignals = recall(context, "policyDecisions", 30);
  const playbook = [];
  if (workloadSignals.some((entry) => (entry.lockEvents || 0) > 0)) {
    playbook.push({
      scenario: "lock_pressure",
      steps: ["enable shorter lock timeout", "serialize high contention operations", "rerun in maintenance window"],
      approvalPath: ["security_agent", "platform_engineer"],
    });
  }
  if (policySignals.some((entry) => entry?.decision === "REQUIRES_APPROVAL")) {
    playbook.push({
      scenario: "approval_buildup",
      steps: ["pre-package playbook", "attach evidence", "request batch approvals"],
      approvalPath: ["compliance_agent", "db_admin"],
    });
  }
  return {
    generatedAt: new Date().toISOString(),
    playbook,
    source: "mock",
  };
}

async function incidentAnalysis(context) {
  const policyDecisions = recall(context, "policyDecisions", 10);
  const workloadSignals = recall(context, "workloadSignals", 10);
  const causalGraph = {
    nodes: [
      { id: "p1", type: "policy_block", count: policyDecisions.filter((entry) => entry?.decision && entry.decision !== "ALLOW").length },
      { id: "s1", type: "signal_cluster", count: workloadSignals.length },
    ],
    edges: [
      {
        from: "p1",
        to: "s1",
        relation: "policy_blockes_increase_signal_variance",
      },
    ],
  };
  const firstEvent = new Date(Date.now() - 35 * 60000).toISOString();
  const lastEvent = new Date().toISOString();
  return {
    timeline: [
      { ts: new Date(Date.now() - 10 * 60000).toISOString(), signal: "query_regression", severity: "medium" },
      { ts: new Date().toISOString(), signal: "lock_pressure", severity: "medium" },
    ],
    recentPolicySignals: policyDecisions,
    workloadSignals,
    recommendation: "Prioritize risk triage where policy escalations and regressions overlap.",
    confidence: policyDecisions.length ? "medium" : "low",
    incident_causal_graph: causalGraph,
    mttdMinutes: 8,
    mttrMinutesEstimate: 27,
    evidenceWindow: {
      start: firstEvent,
      end: lastEvent,
    },
    source: "mock",
  };
}

async function validateCompliance(_context, args = {}) {
  const compliance = args.frameworks || ["GDPR", "SOC2"];
  return {
    complianceStatus: compliance.length ? "review_required" : "not_configured",
    violations: compliance.includes("GDPR") ? ["PII classification not mapped for 2 columns"] : [],
    requiredFixes: ["complete data classification", "attach retention policy"],
    approvalChecklist: ["policy owner review", "auditor signoff"],
    source: "mock",
  };
}

function driverAvailable(name) {
  try {
    require.resolve(name);
    return true;
  } catch {
    return false;
  }
}

function pushCheck(checks, id, status, detail, severity = "info") {
  checks.push({ id, status, severity, detail });
}

async function productionReadinessCheck(context, args = {}) {
  const environment = String(args.environment || context.policy.defaultEnvironment || "lab").toLowerCase();
  const engine = normalizeEngine(args.engine || "postgres");
  const pluginRoot = context.projectRoot;
  const checks = [];
  const blockingIssues = [];
  const warnings = [];
  const toolManifestPath = path.join(pluginRoot, "runtime", "tool-manifest.json");
  const pluginManifestPath = path.join(pluginRoot, ".codex-plugin", "plugin.json");
  const skillsPath = path.join(pluginRoot, "skills");
  const toolManifestExists = fs.existsSync(toolManifestPath);
  const pluginManifestExists = fs.existsSync(pluginManifestPath);

  pushCheck(checks, "plugin_manifest", pluginManifestExists ? "pass" : "fail", ".codex-plugin/plugin.json exists", "blocker");
  if (!pluginManifestExists) {
    blockingIssues.push("plugin_manifest_missing");
  }

  let tools = [];
  if (toolManifestExists) {
    try {
      tools = JSON.parse(fs.readFileSync(toolManifestPath, "utf8")).tools || [];
    } catch {
      blockingIssues.push("tool_manifest_invalid");
    }
  } else {
    blockingIssues.push("tool_manifest_missing");
  }
  pushCheck(checks, "manifest_tools", tools.length ? "pass" : "fail", `${tools.length} runtime tools declared`, "blocker");

  const skillDirs = fs.existsSync(skillsPath)
    ? fs.readdirSync(skillsPath, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => entry.name)
    : [];
  const missingSkillDocs = skillDirs.filter((skill) => !fs.existsSync(path.join(skillsPath, skill, "SKILL.md")));
  pushCheck(
    checks,
    "skill_docs",
    missingSkillDocs.length ? "fail" : "pass",
    missingSkillDocs.length ? `missing SKILL.md for ${missingSkillDocs.join(", ")}` : `${skillDirs.length} skill docs present`,
    missingSkillDocs.length ? "blocker" : "info",
  );
  if (missingSkillDocs.length) {
    blockingIssues.push("skill_docs_missing");
  }

  const liveRequired = Boolean(context.policy.auth?.requireLiveConnection);
  pushCheck(
    checks,
    "live_connection_enforced",
    liveRequired ? "pass" : "fail",
    liveRequired ? "CODEXDB_REQUIRE_LIVE_CONNECTION is enabled" : "CODEXDB_REQUIRE_LIVE_CONNECTION is not enabled",
    environment === "production" ? "blocker" : "warning",
  );
  if (environment === "production" && !liveRequired) {
    blockingIssues.push("live_connection_not_enforced");
  }

  const driverName = engine === "postgres" ? "pg" : "mssql";
  const hasDriver = driverAvailable(driverName);
  pushCheck(checks, `${engine}_driver`, hasDriver ? "pass" : "warn", hasDriver ? `${driverName} driver available` : `${driverName} driver not installed`, liveRequired ? "blocker" : "warning");
  if (liveRequired && !hasDriver) {
    blockingIssues.push(`${engine}_driver_missing`);
  } else if (!hasDriver) {
    warnings.push(`${engine}_driver_missing`);
  }

  if (liveRequired && hasDriver) {
    let adapter;
    try {
      const probe = await createAdapter(context, { ...args, engine });
      adapter = probe.adapter;
      const liveAvailable = probe.status?.initialized === true && !probe.status?.blocked && !hasMockAdapter(probe.status);
      pushCheck(
        checks,
        "live_connection_probe",
        liveAvailable ? "pass" : "fail",
        liveAvailable ? `${engine} live connection initialized` : `live connection unavailable: ${probe.status?.status || probe.status?.adapter || "unknown"}`,
        "blocker",
      );
      if (!liveAvailable) {
        blockingIssues.push("live_connection_unavailable");
      }
    } catch (error) {
      pushCheck(
        checks,
        "live_connection_probe",
        "fail",
        `live connection failed: ${String(error?.message || error)}`,
        "blocker",
      );
      blockingIssues.push("live_connection_unavailable");
    } finally {
      if (adapter && adapter.close) {
        await adapter.close();
      }
    }
  }

  const signingSecretPresent = Boolean(getMigrationSigningSecret());
  pushCheck(
    checks,
    "migration_signing_secret",
    signingSecretPresent ? "pass" : "fail",
    signingSecretPresent ? "migration signing secret configured" : "CODEXDB_MIGRATION_SIGNING_KEY is missing",
    environment === "production" ? "blocker" : "warning",
  );
  if (environment === "production" && !signingSecretPresent) {
    blockingIssues.push("migration_signing_secret_missing");
  }

  const replayEnabled = Boolean(context.policy.replay?.enabled);
  pushCheck(checks, "replay_audit", replayEnabled ? "pass" : "warn", replayEnabled ? "audit replay enabled" : "audit replay disabled", "warning");
  if (!replayEnabled) {
    warnings.push("audit_replay_disabled");
  }

  return {
    ready: blockingIssues.length === 0,
    environment,
    engine,
    blockingIssues: Array.from(new Set(blockingIssues)),
    warnings: Array.from(new Set(warnings)),
    checks,
    source: "runtime",
  };
}

function resolveTableMeta(context, args = {}) {
  const engine = normalizeEngine(args.engine || "postgres");
  const database = args.database || (engine === "postgres" ? "analytics" : "app_prod");
  const schema = resolveSchema(engine, args);
  const table = args.table || (engine === "postgres" ? "events" : "orders");
  const meta = context.sampleCatalog[engine]?.schemas?.[database]?.[schema]?.tables?.[table] || null;
  return { engine, database, schema, table, meta };
}

function scoreLevel(score) {
  if (score >= 85) return "critical";
  if (score >= 65) return "high";
  if (score >= 35) return "medium";
  return "low";
}

async function aiAnomalyTriage(context, args = {}) {
  const statsResult = await queryStats(context, args);
  const telemetry = await telemetryCorrelation(context, args);
  const stats = statsResult.queryStats || [];
  const p95Max = stats.reduce((max, item) => Math.max(max, Number(item.p95Ms || 0)), 0);
  const regressionMax = stats.reduce((max, item) => Math.max(max, Number(item.regressionScore || 0)), 0);
  const policyBlocks = recall(context, "policyDecisions", 25).filter((entry) => entry?.decision === "BLOCK").length;
  const score = Math.min(100, Math.round((p95Max / 12) + (regressionMax * 100) + (policyBlocks * 6) + Number(args.incidentWindowMinutes || 0) / 3));
  const level = scoreLevel(score);
  const hypotheses = [
    {
      cause: "query_regression_after_deploy",
      confidence: regressionMax >= 0.2 ? 0.78 : 0.52,
      evidence: [`max_p95_ms=${p95Max}`, `max_regression_score=${regressionMax}`],
    },
    {
      cause: "policy_or_schema_change_interference",
      confidence: policyBlocks ? 0.66 : 0.34,
      evidence: [`recent_policy_blocks=${policyBlocks}`],
    },
  ];
  remember(context, "incidents", {
    kind: "ai_anomaly_triage",
    level,
    score,
    deploymentId: args.deploymentId,
  });
  return {
    usp: "ai_anomaly_triage",
    anomalyScore: { score, level },
    rootCauseHypotheses: hypotheses,
    nextBestActions: [
      "compare query plans before and after deployment",
      "run ai_query_rewrite_lab for top regressed statements",
      "validate policy changes in the incident window",
    ],
    explainability: {
      correlationInputs: ["query_stats", "telemetry_correlation", "policy_memory"],
      telemetryRefs: telemetry.telemetryRefs || [],
      deterministicModel: "weighted_signal_fusion_v1",
    },
    source: "mock",
  };
}

async function aiQueryRewriteLab(context, args = {}) {
  const statement = normalizeText(args.sql || args.query || "SELECT * FROM events");
  const risk = classify(statement);
  const selectNarrow = statement.replace(/select\s+\*/i, "SELECT <needed_columns>");
  const candidates = [];
  candidates.push({
    id: "rewrite_projection_narrowing",
    sql: selectNarrow === statement ? statement : selectNarrow,
    rationale: "Reduce IO and avoid accidental PII projection.",
    expectedImpact: { p95Delta: "-10% to -35%", riskDelta: "lower_projection_risk" },
  });
  if (/\bwhere\b/i.test(statement) && !/\blimit\b|\btop\s*\(/i.test(statement)) {
    candidates.push({
      id: "rewrite_result_bound",
      sql: normalizeEngine(args.engine) === "sqlserver" ? statement.replace(/^select/i, "SELECT TOP (500)") : `${statement} LIMIT 500`,
      rationale: "Bound exploratory reads to reduce lock and memory pressure.",
      expectedImpact: { p95Delta: "-5% to -20%", riskDelta: "bounded_result_set" },
    });
  }
  if (args.table && args.columns) {
    candidates.push({
      id: "rewrite_index_aligned_predicate",
      sql: statement,
      rationale: `Validate predicate order against ${args.table} index candidates.`,
      expectedImpact: { p95Delta: "workload dependent", riskDelta: "requires_explain_validation" },
    });
  }
  return {
    usp: "ai_query_rewrite_lab",
    executionMode: "analysis_only",
    original: { sqlFingerprint: sha256(statement), risk },
    rewriteCandidates: candidates,
    safety: {
      blockedExecution: true,
      reason: "rewrite_lab_never_executes_sql",
      requiresExplainValidation: true,
    },
    explainability: {
      deterministicModel: "rewrite_patterns_v1",
      rulesApplied: candidates.map((candidate) => candidate.id),
    },
    source: "mock",
  };
}

async function aiMigrationRiskRadar(context, args = {}) {
  const { engine, database, schema, table, meta } = resolveTableMeta(context, args);
  const migrationSql = normalizeText(args.migrationSql || args.sql || args.ddlDraft || "");
  const risk = classify(migrationSql);
  const rowCount = Number(meta?.rowCountHint || 0);
  const hasPii = Boolean(meta?.containsPII);
  const score = Math.min(100, Math.round((rowCount / 1000000) + (hasPii ? 25 : 0) + (risk.riskLevel === "HIGH" ? 35 : 10)));
  const policyPreflight = classifyDecision({
    actionType: /rollback/i.test(migrationSql) ? "rollback_migration" : "propose_migration",
    environment: args.environment || "staging",
    riskLevel: risk.riskLevel,
    database,
    schema,
    actor: args.actor || "codex-user",
    isDryRun: true,
  });
  return {
    usp: "ai_migration_risk_radar",
    target: { engine, database, schema, table },
    blastRadius: {
      score,
      level: scoreLevel(score),
      rowCountHint: rowCount,
      piiSensitive: hasPii,
      dependentRelationships: meta?.relationships?.length || 0,
    },
    policyPreflight,
    rollbackRehearsal: {
      mode: "dry_run_required",
      steps: [
        "capture pre-change schema fingerprint",
        "run migration in isolated shadow database",
        "replay validation queries",
        "verify rollback SQL against shadow state",
      ],
    },
    releaseRecommendation: score >= 65 ? "stage_with_manual_approval" : "eligible_for_staged_rollout",
    source: "mock",
  };
}

async function aiDataContractGuardian(context, args = {}) {
  const { engine, database, schema, table, meta } = resolveTableMeta(context, args);
  const contract = args.contract || {};
  const actualColumns = (meta?.columns || []).map((column) => column.name);
  const requiredColumns = Array.isArray(contract.requiredColumns) ? contract.requiredColumns : [];
  const piiColumns = Array.isArray(contract.piiColumns) ? contract.piiColumns : [];
  const findings = [];
  for (const column of requiredColumns) {
    if (!actualColumns.includes(column)) {
      findings.push({ type: "missing_required_column", column, severity: "high" });
    }
  }
  for (const column of actualColumns) {
    const isCatalogPii = Boolean((meta?.columns || []).find((item) => item.name === column && item.pii));
    if (isCatalogPii && !piiColumns.includes(column)) {
      findings.push({ type: "undocumented_pii_column", column, severity: "medium" });
    }
  }
  if (!contract.retentionDays) {
    findings.push({ type: "retention_policy_missing", severity: "medium" });
  }
  const governanceControls = [];
  if (piiColumns.length || meta?.containsPII) governanceControls.push("mask_pii_columns");
  if (contract.retentionDays) governanceControls.push("enforce_retention_window");
  governanceControls.push("schema_drift_alert");
  return {
    usp: "ai_data_contract_guardian",
    target: { engine, database, schema, table },
    contractFindings: findings,
    contractStatus: findings.some((finding) => finding.severity === "high") ? "breach" : findings.length ? "review_required" : "compliant",
    governanceControls,
    evidence: {
      table,
      actualColumns,
      contractRequiredColumns: requiredColumns,
      piiColumns,
    },
    source: "mock",
  };
}

function tokenizeText(value) {
  return normalizeText(value).toLowerCase().split(/[^a-z0-9_]+/).filter((token) => token.length > 2);
}

function overlapScore(left, right) {
  const leftSet = new Set(tokenizeText(left));
  const rightTokens = tokenizeText(right);
  if (!leftSet.size || !rightTokens.length) return 0;
  const hits = rightTokens.filter((token) => leftSet.has(token)).length;
  return Number((hits / Math.max(leftSet.size, rightTokens.length)).toFixed(3));
}

async function rlsMaskingRouter(context, args = {}) {
  const { engine, database, schema, table, meta } = resolveTableMeta(context, args);
  const policy = context.policy || {};
  const requested = Array.isArray(args.requestedColumns) && args.requestedColumns.length
    ? args.requestedColumns
    : (meta?.columns || []).map((column) => column.name);
  const projectedColumns = requested.map((column) => {
    const columnMeta = (meta?.columns || []).find((item) => item.name === column) || {};
    const masked = Boolean(columnMeta.pii || /email|phone|ssn|tax|iban/i.test(column));
    return {
      name: column,
      masked,
      expression: masked ? `MASK(${column}) AS ${column}` : column,
    };
  });
  const tenantColumn = args.tenantColumn || "tenant_id";
  const tenantValue = args.tenantId || args.tenant || "";
  const tenantPredicate = `${tenantColumn} = '${tenantValue || "current_tenant"}'`;
  const tenantContextRequired = Boolean(policy.rls?.enabled && policy.rls?.requireTenantContext && !tenantValue);
  const controls = [
    "tenant_scope_filter",
    projectedColumns.some((column) => column.masked) ? "mask_pii_columns" : "projection_review",
  ];
  if (tenantContextRequired) {
    controls.push("tenant_context_required");
  }
  const safeSql = `SELECT ${projectedColumns.map((column) => column.expression).join(", ")} FROM ${schema}.${table} WHERE ${tenantPredicate}`;
  return {
    usp: "rls_masking_router",
    blocked: tenantContextRequired,
    blockedReason: tenantContextRequired ? ["tenant_context_required"] : [],
    target: { engine, database, schema, table },
    routePlan: {
      tenantPredicate,
      projectedColumns,
      rlsMode: tenantValue ? "tenant_bound" : "tenant_context_required",
    },
    controls,
    safeSql,
    evidence: {
      piiColumns: projectedColumns.filter((column) => column.masked).map((column) => column.name),
      requestedColumns: requested,
      rlsPolicy: policy.rls || {},
    },
    source: tenantContextRequired ? "policy" : "mock",
  };
}

async function explainableRefactoringDossier(_context, args = {}) {
  const beforeSql = normalizeText(args.beforeSql || args.sql || "");
  const afterSql = normalizeText(args.afterSql || args.rewriteSql || "");
  const beforeRisk = classify(beforeSql);
  const afterRisk = classify(afterSql);
  const reasons = [];
  if (/select\s+\*/i.test(beforeSql) && !/select\s+\*/i.test(afterSql)) reasons.push("projection_narrowed");
  if (!/\blimit\b|\btop\s*\(/i.test(beforeSql) && /\blimit\b|\btop\s*\(/i.test(afterSql)) reasons.push("result_set_bounded");
  if (beforeRisk.riskLevel !== afterRisk.riskLevel) reasons.push("risk_tier_changed");
  if (!reasons.length) reasons.push("semantic_review_required");
  return {
    usp: "explainable_refactoring_dossier",
    objective: args.objective || "reduce risk and operational cost",
    before: { sqlFingerprint: sha256(beforeSql), risk: beforeRisk },
    after: { sqlFingerprint: sha256(afterSql), risk: afterRisk },
    explanation: {
      summary: "Deterministic comparison of query shape, risk tier, and operational side effects.",
      reasons,
      expectedSideEffects: afterRisk.riskLevel === "LOW" ? ["read_only"] : ["requires_policy_review"],
    },
    rollbackPlan: {
      steps: ["keep previous SQL fingerprint", "replay baseline query stats", "restore previous query text if SLO worsens"],
    },
    source: "mock",
  };
}

async function performanceForecast(_context, args = {}) {
  const risk = classify(args.sql || args.query || "");
  const baselineP95 = Number(args.baselineP95 || 120);
  const trafficGrowth = Number(args.trafficGrowthPct || 0);
  const complexityMultiplier = risk.riskLevel === "CRITICAL" ? 2.4 : risk.riskLevel === "HIGH" ? 1.8 : risk.riskLevel === "MEDIUM" ? 1.35 : 1.1;
  const predictedP95Ms = Math.round(baselineP95 * complexityMultiplier * (1 + trafficGrowth / 100));
  const budgetUnits = Math.round(predictedP95Ms / 4);
  const budgetLimit = Number(args.budgetLimitUnits || 100);
  const budgetScore = Math.min(100, Math.round((budgetUnits / Math.max(1, budgetLimit)) * 100));
  return {
    usp: "performance_forecast",
    forecast: {
      baselineP95Ms: baselineP95,
      predictedP95Ms,
      trafficGrowthPct: trafficGrowth,
      confidence: risk.riskSignals.includes("high_complexity_query") ? 0.72 : 0.61,
    },
    budgetRisk: {
      budgetUnits,
      budgetLimitUnits: budgetLimit,
      score: budgetScore,
      level: budgetScore >= 120 ? "high" : budgetScore >= 75 ? "medium" : "low",
    },
    recommendations: [
      predictedP95Ms > baselineP95 * 1.5 ? "run explain_query before rollout" : "monitor p95 after rollout",
      "compare against query_time_machine baseline",
      "set budget alert on forecasted unit consumption",
    ],
    source: "mock",
  };
}

async function semanticMemoryIndex(context, args = {}) {
  const documents = Array.isArray(args.documents) ? args.documents : [];
  const query = normalizeText(args.query || "");
  const pgvectorConfigured = envPresent("CODEXDB_PGVECTOR_CONNECTION_STRING") || envPresent("CODEXDB_POSTGRES_CONNECTION_STRING");
  const indexed = documents.map((doc, index) => ({
    id: doc.id || `doc-${index + 1}`,
    text: normalizeText(doc.text || doc.content || ""),
    tokens: Array.from(new Set(tokenizeText(doc.text || doc.content || ""))),
  }));
  const matches = indexed
    .map((doc) => ({ id: doc.id, score: overlapScore(query, doc.text), tokenHits: doc.tokens.filter((token) => tokenizeText(query).includes(token)) }))
    .filter((match) => match.score > 0)
    .sort((a, b) => b.score - a.score);
  remember(context, "semanticMemoryIndexes", {
    documentCount: indexed.length,
    query,
    topMatch: matches[0]?.id || null,
  });
  return {
    usp: "semantic_memory_index",
    mode: "local_token_vector",
    index: {
      documentCount: indexed.length,
      dimensions: "token_set",
      persistence: pgvectorConfigured ? "pgvector" : "memoryLayer",
    },
    matches,
    connector: {
      status: pgvectorConfigured ? "configured" : "not_configured",
      upsertRequest: pgvectorConfigured ? {
        connectionString: "***redacted***",
        table: args.vectorTable || "codexdb_semantic_memory",
        rows: indexed.map((doc) => ({ id: doc.id, tokenCount: doc.tokens.length })),
      } : null,
    },
    source: pgvectorConfigured ? "connector_contract" : "mock",
  };
}

async function telemetryConnectorIngest(context, args = {}) {
  const provider = args.provider || "otel";
  const otelSignals = Array.isArray(args.resourceMetrics)
    ? args.resourceMetrics.flatMap((resourceMetric, resourceIndex) =>
        (resourceMetric.scopeMetrics || []).flatMap((scopeMetric, scopeIndex) =>
          (scopeMetric.metrics || []).flatMap((metric, metricIndex) =>
            (metric.dataPoints || []).map((point, pointIndex) => ({
              id: point.id || `${provider}-${resourceIndex + 1}-${scopeIndex + 1}-${metricIndex + 1}-${pointIndex + 1}`,
              name: metric.name,
              value: point.asDouble ?? point.asInt ?? point.value ?? 0,
              unit: metric.unit || "count",
              attributes: point.attributes || {},
            }))
          )
        )
      )
    : [];
  const signals = Array.isArray(args.signals) && args.signals.length ? args.signals : otelSignals;
  const normalizedSignals = signals.map((signal, index) => ({
    id: signal.id || `${provider}-${index + 1}`,
    name: signal.name || signal.metric || "unknown",
    value: Number(signal.value || 0),
    unit: signal.unit || "count",
    attributes: signal.attributes || {},
    severity: Number(signal.value || 0) > 800 ? "high" : Number(signal.value || 0) > 100 ? "medium" : "low",
  }));
  remember(context, "telemetrySignals", {
    provider,
    count: normalizedSignals.length,
    highSeverity: normalizedSignals.filter((signal) => signal.severity === "high").length,
  });
  return {
    usp: "telemetry_connector_ingest",
    provider,
    normalizedSignals,
    correlationRefs: normalizedSignals.map((signal) => `${provider}://${signal.name}/${signal.id}`),
    routingTargets: ["telemetry_correlation", "ai_anomaly_triage", "incident_analysis"],
    source: otelSignals.length ? "otel_payload" : "mock",
  };
}

async function autonomousVerificationLoop(context, args = {}) {
  const proposedSql = normalizeText(args.proposedSql || args.sql || args.migrationSql || "");
  const risk = classify(proposedSql);
  const gates = [
    { id: "policy", status: risk.riskLevel === "LOW" ? "pass" : "review", evidence: risk.riskLevel },
    { id: "explain", status: "pending", evidence: "explain_query_required" },
    { id: "replay", status: "pending", evidence: "replay_execution_required" },
    { id: "slo", status: "pending", evidence: "p95_budget_required" },
    { id: "rollback", status: "pending", evidence: "rollback_rehearsal_required" },
  ];
  remember(context, "verificationLoops", {
    tool: args.tool,
    riskLevel: risk.riskLevel,
    proposedSqlFingerprint: sha256(proposedSql),
  });
  return {
    usp: "autonomous_verification_loop",
    verificationStatus: gates.every((gate) => gate.status === "pass") ? "verified" : "pending_evidence",
    targetTool: args.tool || "unknown",
    gates,
    releaseDecision: gates.some((gate) => gate.status === "review") ? "manual_review_required" : "hold_until_evidence_complete",
    evidencePlan: ["run explain_query", "run replay_execution", "compare performance_forecast", "attach rollback proof"],
    source: "mock",
  };
}

async function sqlFirewallLearning(_context, args = {}) {
  const samples = Array.isArray(args.samples) ? args.samples : [];
  const learned = [];
  const driftFindings = [];
  for (const sample of samples) {
    const risk = classify(sample);
    const normalizedShape = normalizeText(sample).replace(/'[^']*'/g, "?").replace(/\b\d+\b/g, "?").toLowerCase();
    const fingerprint = sha256(normalizedShape);
    if (!learned.find((entry) => entry.fingerprint === fingerprint)) {
      learned.push({ fingerprint, normalizedShape, riskLevel: risk.riskLevel });
    }
    if (risk.riskLevel === "CRITICAL" || risk.riskLevel === "HIGH") {
      const destructiveDdl = /\b(drop|truncate)\b/i.test(sample);
      driftFindings.push({ type: "unsafe_query_family", severity: risk.riskLevel === "CRITICAL" || destructiveDdl ? "critical" : "high", fingerprint });
    }
  }
  return {
    usp: "sql_firewall_learning",
    learnedFingerprints: learned,
    driftFindings,
    proposedPolicyRules: learned
      .filter((entry) => entry.riskLevel === "LOW")
      .map((entry) => ({ action: "allow_fingerprint", fingerprint: entry.fingerprint, mode: "warn_then_enforce" })),
    source: "mock",
  };
}

async function workloadTwin(context, args = {}) {
  const { engine, database, schema, table, meta } = resolveTableMeta(context, args);
  const scenario = args.scenario || {};
  const rowCount = Number(meta?.rowCountHint || 100000);
  const trafficGrowth = Number(scenario.trafficGrowthPct || 0);
  const indexBenefit = Array.isArray(scenario.addIndex) && scenario.addIndex.length ? 0.72 : 1;
  const dropPenalty = Array.isArray(scenario.dropIndex) && scenario.dropIndex.length ? 1.35 : 1;
  const baselineP95 = Math.max(20, Math.round(Math.log10(rowCount + 10) * 60));
  const projectedP95 = Math.round(baselineP95 * (1 + trafficGrowth / 100) * indexBenefit * dropPenalty);
  const findings = [];
  if (projectedP95 > baselineP95 * 1.25) findings.push({ type: "slo_regression_risk", severity: "medium", deltaMs: projectedP95 - baselineP95 });
  if (indexBenefit < 1) findings.push({ type: "index_addition_reduces_projected_latency", severity: "info" });
  if (meta?.containsPII) findings.push({ type: "pii_sensitive_workload", severity: "medium" });
  return {
    usp: "workload_twin",
    target: { engine, database, schema, table },
    simulation: {
      baseline: { rowCountHint: rowCount, p95Ms: baselineP95 },
      projected: { trafficGrowthPct: trafficGrowth, p95Ms: projectedP95 },
    },
    scenarioFindings: findings,
    recommendedExperiment: "run shadow replay with captured workload sample before production apply",
    source: "mock",
  };
}

function envPresent(name) {
  return Boolean(process.env[name]);
}

async function productionRolloutOrchestrator(context, args = {}) {
  const readiness = await productionReadinessCheck(context, { ...args, environment: "production" });
  const verification = await autonomousVerificationLoop(context, args);
  const migrationRadar = await aiMigrationRiskRadar(context, args);
  const gates = [
    {
      id: "production_readiness",
      status: readiness.ready ? "pass" : "block",
      evidence: readiness.blockingIssues,
    },
    {
      id: "verification_loop",
      status: verification.verificationStatus === "verified" ? "pass" : "pending",
      evidence: verification.gates.map((gate) => `${gate.id}:${gate.status}`),
    },
    {
      id: "migration_risk",
      status: migrationRadar.blastRadius.level === "critical" ? "block" : "review",
      evidence: migrationRadar.blastRadius,
    },
  ];
  const rolloutDecision = gates.some((gate) => gate.status === "block") ? "no_go" : gates.some((gate) => gate.status === "pending" || gate.status === "review") ? "needs_evidence" : "go";
  return {
    usp: "production_rollout_orchestrator",
    rolloutDecision,
    gates,
    reports: { readiness, verification, migrationRadar },
    nextActions: rolloutDecision === "go"
      ? ["schedule controlled rollout", "attach audit evidence"]
      : ["resolve blockers", "complete pending verification gates", "rerun production_rollout_orchestrator"],
    source: "mock",
  };
}

async function pgvectorConnectorCheck(_context, args = {}) {
  const configured = envPresent("CODEXDB_PGVECTOR_CONNECTION_STRING") || envPresent("CODEXDB_POSTGRES_CONNECTION_STRING");
  return {
    usp: "pgvector_connector_check",
    status: configured ? "configured" : "not_configured",
    engine: normalizeEngine(args.engine || "postgres"),
    requiredEnv: ["CODEXDB_PGVECTOR_CONNECTION_STRING"],
    optionalFallbackEnv: ["CODEXDB_POSTGRES_CONNECTION_STRING"],
    capabilities: ["semantic_memory_index", "retrieve_context"],
    source: "config",
  };
}

async function prometheusConnectorIngest(context, args = {}) {
  const metrics = Array.isArray(args.metrics) ? args.metrics : [];
  const baseUrl = normalizeText(process.env.CODEXDB_PROMETHEUS_URL).replace(/\/+$/, "");
  const query = normalizeText(args.query || args.promql || "up");
  const normalizedMetrics = metrics.map((metric, index) => ({
    id: metric.id || `prom-${index + 1}`,
    name: metric.name || metric.metric || "unknown",
    value: Number(metric.value || 0),
    labels: metric.labels || {},
    severity: Number(metric.value || 0) > Number(args.highThreshold || 1000) ? "high" : "normal",
  }));
  remember(context, "telemetrySignals", {
    provider: "prometheus",
    count: normalizedMetrics.length,
  });
  return {
    usp: "prometheus_connector_ingest",
    status: baseUrl ? "configured" : "not_configured",
    normalizedMetrics,
    request: baseUrl ? {
      method: "GET",
      url: `${baseUrl}/api/v1/query?query=${encodeURIComponent(query)}`,
      headers: { Accept: "application/json" },
    } : null,
    routingTargets: ["telemetry_connector_ingest", "telemetry_correlation", "run_health_assessment"],
    source: "mock",
  };
}

async function grafanaAnnotationExport(_context, args = {}) {
  const baseUrl = normalizeText(process.env.CODEXDB_GRAFANA_URL).replace(/\/+$/, "");
  const annotation = {
    time: args.time || new Date().toISOString(),
    tags: args.tags || ["codexdb", args.incidentId || "incident"],
    text: args.text || "CodexDB annotation",
    dashboardUid: args.dashboardUid || "codexdb-overview",
  };
  return {
    usp: "grafana_annotation_export",
    status: baseUrl ? "ready_to_send" : "dry_run",
    annotation,
    request: baseUrl ? {
      method: "POST",
      url: `${baseUrl}/api/annotations`,
      headers: {
        Authorization: process.env.CODEXDB_GRAFANA_TOKEN ? "***redacted***" : null,
        "Content-Type": "application/json",
      },
      body: annotation,
    } : null,
    requiredEnv: ["CODEXDB_GRAFANA_URL", "CODEXDB_GRAFANA_TOKEN"],
    source: "mock",
  };
}

async function neo4jGraphExport(_context, args = {}) {
  const graphName = args.graphName || "codexdb";
  const uri = normalizeText(process.env.CODEXDB_NEO4J_URI);
  return {
    usp: "neo4j_graph_export",
    status: uri ? "configured" : "not_configured",
    connection: {
      uri: uri || null,
      user: process.env.CODEXDB_NEO4J_USER || null,
      password: process.env.CODEXDB_NEO4J_PASSWORD ? "***redacted***" : null,
    },
    export: {
      graphName,
      cypher: [
        "MERGE (:System {name: 'CodexDB Agent'})",
        `MERGE (:GraphExport {name: '${graphName}'})`,
        "MERGE (:Capability {name: 'semantic_schema_intelligence'})",
      ],
    },
    requiredEnv: ["CODEXDB_NEO4J_URI", "CODEXDB_NEO4J_USER", "CODEXDB_NEO4J_PASSWORD"],
    source: "mock",
  };
}

function normalizePlanInput(plan) {
  if (!plan) {
    return [];
  }
  if (typeof plan === "string") {
    try {
      return normalizePlanInput(JSON.parse(plan));
    } catch (_error) {
      return [{ raw: plan }];
    }
  }
  if (Array.isArray(plan)) {
    return plan.flatMap((item) => normalizePlanInput(item));
  }
  if (plan.Plan && typeof plan.Plan === "object") {
    return normalizePlanInput(plan.Plan);
  }
  if (typeof plan === "object") {
    const children = Array.isArray(plan.Plans) ? plan.Plans.flatMap((item) => normalizePlanInput(item)) : [];
    return [plan, ...children];
  }
  return [];
}

function numericPlanValue(node, keys) {
  for (const key of keys) {
    const value = Number(node?.[key]);
    if (Number.isFinite(value)) {
      return value;
    }
  }
  return 0;
}

async function planDeepDiagnostics(_context, args = {}) {
  const nodes = normalizePlanInput(args.plan || args.executionPlan || args.explain);
  const findings = [];
  for (const [index, node] of nodes.entries()) {
    const nodeType = normalizeText(node["Node Type"] || node.PhysicalOp || node.LogicalOp || node.operator || node.raw);
    const relation = normalizeText(node["Relation Name"] || node.Table || node.object || node.table || "unknown");
    const plannedRows = numericPlanValue(node, ["Plan Rows", "EstimatedRows", "EstimateRows", "estimated_rows"]);
    const actualRows = numericPlanValue(node, ["Actual Rows", "ActualRows", "actual_rows"]);
    if (plannedRows > 0 && actualRows > 0) {
      const ratio = actualRows / plannedRows;
      if (ratio >= 10 || ratio <= 0.1) {
        findings.push({
          id: "cardinality_misestimation",
          severity: ratio >= 100 || ratio <= 0.01 ? "high" : "medium",
          node: nodeType || `node_${index + 1}`,
          relation,
          evidence: { plannedRows, actualRows, ratio: Number(ratio.toFixed(2)) },
          recommendation: "Refresh statistics and validate predicates, parameter selectivity, and histogram coverage.",
        });
      }
    }
    if (/seq scan|table scan|clustered index scan|full scan/i.test(nodeType)) {
      findings.push({
        id: "sequential_scan",
        severity: "medium",
        node: nodeType,
        relation,
        evidence: { nodeType, relation },
        recommendation: "Check whether a selective predicate needs a covering or partial index.",
      });
    }
    const tempBlocks = numericPlanValue(node, ["Temp Read Blocks", "Temp Written Blocks", "SpillLevel", "SpilledDataSize", "temp_blocks"]);
    if (tempBlocks > 0 || /spill/i.test(stableStringify(node))) {
      findings.push({
        id: "temp_spill_risk",
        severity: tempBlocks > 100 ? "high" : "medium",
        node: nodeType || `node_${index + 1}`,
        relation,
        evidence: { tempBlocks },
        recommendation: "Validate memory grant, work_mem, sort/hash strategy, and supporting indexes.",
      });
    }
  }
  if (findings.some((finding) => finding.id === "cardinality_misestimation")) {
    findings.push({
      id: "stale_statistics_candidate",
      severity: "medium",
      evidence: { reason: "cardinality_misestimation_detected" },
      recommendation: "Run engine-specific statistics maintenance before changing query shape.",
    });
  }
  return {
    usp: "plan_deep_diagnostics",
    engine: normalizeEngine(args.engine || "postgres"),
    findings,
    evidence: {
      nodeCount: nodes.length,
      planHash: sha256(stableStringify(args.plan || args.executionPlan || args.explain)).slice(0, 16),
    },
    nextChecks: findings.length
      ? ["compare current and previous plans", "rank fixes by workload impact", "benchmark top recommendation"]
      : ["capture live EXPLAIN ANALYZE or SQL Server actual execution plan"],
    source: "analysis",
  };
}

async function onboardDatabase(context, args = {}) {
  const databases = await listDatabases(context, args);
  const tables = await listTables(context, args);
  const table = await describeTable(context, args);
  const pii = await detectPii(context, args);
  return {
    workflow: "onboard_database",
    steps: [
      { id: "list_databases", status: databases.error ? "review" : "complete" },
      { id: "list_tables", status: tables.error ? "review" : "complete" },
      { id: "describe_table", status: table.error ? "review" : "complete" },
      { id: "detect_pii", status: "complete" },
    ],
    summary: {
      databaseCount: databases.count || 0,
      tableCount: tables.count || 0,
      piiColumns: pii.piiColumns || [],
    },
    evidence: { databases, tables, table, pii },
    source: "mock",
  };
}

async function runHealthAssessment(context, args = {}) {
  const readiness = await productionReadinessCheck(context, args);
  const stats = await queryStats(context, args);
  const replication = await replicationStatus(context, args);
  const telemetry = await telemetryCorrelation(context, args);
  return {
    workflow: "run_health_assessment",
    summary: {
      ready: readiness.ready,
      queryStatsCount: (stats.queryStats || []).length,
      replicationRisk: replication.consistencyRisk || "unknown",
      telemetrySeverity: telemetry.correlation?.severity || "unknown",
    },
    sections: { readiness, stats, replication, telemetry },
    source: "mock",
  };
}

async function prepareProductionRollout(context, args = {}) {
  const rolloutPlan = await productionRolloutOrchestrator(context, { ...args, environment: "production" });
  const verification = await autonomousVerificationLoop(context, args);
  const forecast = await performanceForecast(context, args);
  return {
    workflow: "prepare_production_rollout",
    rolloutPlan,
    verification,
    forecast,
    operatorChecklist: [
      "set CODEXDB_REQUIRE_LIVE_CONNECTION=true",
      "set CODEXDB_MIGRATION_SIGNING_KEY",
      "attach rollback rehearsal evidence",
      "rerun release_readiness_report",
    ],
    source: "mock",
  };
}

async function investigateIncident(context, args = {}) {
  const triage = await aiAnomalyTriage(context, args);
  const causalGraph = await incidentAnalysis(context, args);
  const playbook = await selfHealingPlaybook(context, args);
  return {
    workflow: "investigate_incident",
    triage,
    causalGraph,
    playbook,
    nextActions: triage.nextBestActions || [],
    source: "mock",
  };
}

async function optimizeWorkload(context, args = {}) {
  const rewriteLab = await aiQueryRewriteLab(context, args);
  const forecast = await performanceForecast(context, args);
  const indexEvolution = await evolveIndexes(context, args);
  const twin = await workloadTwin(context, args);
  return {
    workflow: "optimize_workload",
    rewriteLab,
    forecast,
    indexEvolution,
    twin,
    recommendation: forecast.budgetRisk.level === "high" ? "optimize_before_release" : "safe_to_validate_with_explain",
    source: "mock",
  };
}

async function releaseReadinessReport(context, args = {}) {
  const productionReadiness = await productionReadinessCheck(context, args);
  const pgvector = await pgvectorConnectorCheck(context, args);
  const neo4j = await neo4jGraphExport(context, args);
  const health = await runHealthAssessment(context, args);
  const openBlockers = [
    ...(productionReadiness.blockingIssues || []),
    ...(pgvector.status === "not_configured" ? ["pgvector_not_configured"] : []),
    ...(neo4j.status === "not_configured" ? ["neo4j_not_configured"] : []),
  ];
  return {
    usp: "release_readiness_report",
    ready: openBlockers.length === 0,
    sections: {
      productionReadiness,
      connectors: { pgvector, neo4j },
      health,
    },
    openBlockers: Array.from(new Set(openBlockers)),
    source: "mock",
  };
}

async function auditQuery(context, args = {}) {
  const entry = {
    auditReference: `AREF-${Date.now()}`,
    decisionLog: args.decision || "recorded",
    approvalChain: args.approvalChain || ["agent", "operator"],
    trace: {
      tool: args.tool,
      request: args,
    },
  };
  appendAuditEvent(context.stateFile, buildEvent({ tool: "audit_query", payload: entry }));
  return { ...entry, source: "mock" };
}

async function replayExecution(context, args = {}) {
  const replayRows = readReplayLog(context.stateFile);
  if (!replayRows.length) {
    return { error: "no_replay_records", source: "mock" };
  }
  const replayId = args.replayId || replayRows.at(-1).replayId;
  const rowsById = new Map(replayRows.map((entry) => [entry.replayId, entry]));
  const match = rowsById.get(replayId);
  if (!match) {
    return { error: "replay_not_found", replayId, source: "mock" };
  }
  const chain = [];
  let cursor = match;
  const visited = new Set();
  while (cursor && cursor.replayId && !visited.has(cursor.replayId)) {
    visited.add(cursor.replayId);
    chain.push(cursor.replayId);
    cursor = cursor.previousReplayId ? rowsById.get(cursor.previousReplayId) : null;
  }
  chain.reverse();
  if (match.tool === "replay_execution") {
    return {
      replayId,
      source: "mock",
      replay: match,
      replayChain: chain,
      chainLength: chain.length,
      error: "replay_of_replay_not_supported",
    };
  }
  const recorded = recall(context, "executionReplays", 500);
  const snapshot = recorded.find((entry) => entry.replayId === replayId) || recorded.find((entry) => entry.auditId === match.id);
  const originalTool = (snapshot && snapshot.tool) || match.payload?.tool || match.tool;
  const originalArgs = (snapshot && snapshot.args) || match.payload?.args;
  const originalActor = (snapshot && snapshot.actor) || match.actor || match.payload?.actor || "codex-agent";
  const originalDecision = (snapshot && snapshot.policyDecision) || (match.payload && match.payload.decision) || null;
  if (!originalTool || !toolHandlers[originalTool]) {
    return {
      replayId,
      source: "mock",
      replay: match,
      replayChain: chain,
      chainLength: chain.length,
      error: "replay_tool_unavailable",
      tool: originalTool,
    };
  }
  const rerun = await withPolicyAudit(
    originalTool,
    originalArgs || {},
    originalActor,
    () => toolHandlers[originalTool](context, originalArgs || {}),
    {
      forcePolicyDecision: originalDecision || {
        actionType: originalTool,
        environment: match.environment,
        riskLevel: match.riskLevel,
        decision: match.decision || "ALLOW",
        requiredControls: match.requiredControls || [],
        reasonCodes: match.blockedReason ? [match.blockedReason] : [],
        policyVersion: "1.0",
      },
    },
  );
  const comparison = toReplayComparison(match, rerun);
  return {
    replayId,
    source: "mock",
    replay: match,
    replayChain: chain,
    chainLength: chain.length,
    original: {
      tool: originalTool,
      args: originalArgs,
      actor: originalActor,
      decision: originalDecision || match.decision || null,
    },
    rerun,
    decisionMatch: originalDecision && rerun && rerun.policyDecision
      ? {
          original: originalDecision.decision,
          replayed: rerun.policyDecision.decision,
        }
      : null,
    replay_diff: comparison,
    replay_reproducibility: replayId && comparison ? !comparison.changed : false,
    incident_causality: {
      sourceReplayDecision: match.decision,
      decisionGraph: rerun?.decisionGraph || null,
      reason: comparison.changed ? "replay_payload_or_environment_drift" : "deterministic_replay",
      policyDecisionStable: comparison.changed ? false : true,
    },
  };
}

async function estimateCost(context, args = {}) {
  const queryText = normalizeText(args.sql || args.query || "");
  const risk = classify(queryText);
  const planMetrics = args.planMetrics && typeof args.planMetrics === "object" ? args.planMetrics : null;
  const byAdapter = args.engine || args.database
    ? await withAdapter(context, args, async (adapter) => {
        const stats = await adapter.queryStats(args);
        return { queryStats: Array.isArray(stats) ? stats : stats.queryStats || [], queryStatsError: stats.error || null };
      })
    : null;
  if (byAdapter?.blocked) {
    return byAdapter;
  }
  const topQuery = (byAdapter?.queryStats || [])[0] || null;
  const baseline = {
    p95Ms: Number(args.baselineP95 || planMetrics?.p95Ms || topQuery?.p95Ms || 120),
    cpuUnits: Number(args.baselineCpu || planMetrics?.cpuMs || topQuery?.cpuMs || 20),
  };
  const predicted = {
    cpuUnits: planMetrics ? Math.max(1, Math.round(Number(planMetrics.cpuMs || baseline.cpuUnits) * 1.08)) : risk.riskLevel === "HIGH" ? 120 : risk.riskLevel === "MEDIUM" ? 60 : 40,
    ioUnits: planMetrics ? Math.max(1, Math.round(Number(planMetrics.sharedBlocksRead || planMetrics.logicalReads || 20) / 10)) : risk.riskLevel === "LOW" ? 20 : 90,
    lockUnits: planMetrics ? Math.max(1, Math.round(Number(planMetrics.lockWaitMs || 0) / 10)) : risk.riskLevel === "CRITICAL" ? 14 : risk.riskLevel === "HIGH" ? 6 : 2,
    total: "4.2 vCPU-min",
  };
  const delta = {
    cpuDelta: predicted.cpuUnits - baseline.cpuUnits,
    p95DeltaMs: (planMetrics ? Math.round(Number(planMetrics.p95Ms || baseline.p95Ms) * 1.08) : risk.impact === "high" ? 180 : risk.impact === "medium" ? 70 : 20) - baseline.p95Ms,
  };
  const source = planMetrics ? "live_evidence" : byAdapter?.source || "analysis";
  return {
    estimatedCost: {
      ...predicted,
      estimatedImpactClass: risk.impact,
      baseline,
      regressionForecast: {
        expectedP95MsDelta: delta.p95DeltaMs,
        confidence: risk.riskSignals.includes("high_complexity_query") ? 0.74 : 0.58,
      },
    },
    estimatedImpact: {
      regressionDelta: {
        p95Ms: delta.p95DeltaMs,
        cpuUnits: delta.cpuDelta,
      },
      evidenceSource: source,
      planMetrics: planMetrics ? {
        p95Ms: Number(planMetrics.p95Ms || 0),
        cpuMs: Number(planMetrics.cpuMs || 0),
        sharedBlocksRead: Number(planMetrics.sharedBlocksRead || planMetrics.logicalReads || 0),
        lockWaitMs: Number(planMetrics.lockWaitMs || 0),
      } : null,
    },
    confidence: 0.74,
    assumptions: planMetrics ? ["supplied_plan_metrics", "heuristic_cost_model"] : byAdapter ? ["live_query_stats_or_empty", "heuristic_cost_model"] : ["no_live_connection", "heuristic_cost_model"],
    optimizationLevers: ["index", "query rewrite", "read replica"],
    incident_context: {
      recentPolicyBlocks: context ? recall(context, "policyDecisions", 5).filter((entry) => entry?.decision === "BLOCK").length : 0,
      signalHeat: "medium",
    },
    queryStatsError: byAdapter?.queryStatsError || null,
    source,
  };
}

async function retrieveContext(context, args = {}) {
  const query = normalizeText(args.query || args.intent || args.sql || "");
  const sources = Array.isArray(args.sources) && args.sources.length
    ? args.sources
    : ["ddl", "query_history", "runbooks", "tickets"];
  const memoryCategories = ["policyDecisions", "workloadSignals", "executionReplays", "incidents"];
  const contextPacks = memoryCategories.flatMap((category) =>
    recall(context, category, 3).map((entry) => ({
      category,
      id: entry.id,
      ts: entry.ts,
      relevance: query ? "keyword_or_recent" : "recent",
      summary: entry.decision || entry.riskLevel || entry.correlationSeverity || entry.tool || "runtime_memory",
    }))
  );
  const retrieval = {
    query,
    sources,
    mode: "local_memory_rag",
    vectorStore: "pgvector-compatible-contract",
    graphStore: "semantic-graph-compatible-contract",
  };
  const connectorStatus = {
    pgvector: envPresent("CODEXDB_PGVECTOR_CONNECTION_STRING") || envPresent("CODEXDB_POSTGRES_CONNECTION_STRING") ? "configured" : "not_configured",
    neo4j: envPresent("CODEXDB_NEO4J_URI") ? "configured" : "not_configured",
  };
  const missingConnectors = Object.entries(connectorStatus)
    .filter(([, status]) => status !== "configured")
    .map(([connector]) => connector);
  remember(context, "retrievalContexts", {
    query,
    sources,
    contextPackCount: contextPacks.length,
    connectorStatus,
  });
  return {
    retrieval,
    contextPacks,
    grounding: {
      confidence: contextPacks.length || !missingConnectors.length ? "medium" : "low",
      connectorStatus,
      missingConnectors,
    },
    source: missingConnectors.length ? "mock" : "connector_contract",
  };
}

async function queryTimeMachine(context, args = {}) {
  const queryId = normalizeText(args.queryId || args.queryHash || "q-unknown");
  const windowHours = Number(args.windowHours || 24);
  const now = Date.now();
  const timeline = [
    { ts: new Date(now - windowHours * 3600000).toISOString(), p95Ms: 180, planHash: "plan-a", indexSet: ["pk_orders"] },
    { ts: new Date(now - Math.round(windowHours / 2) * 3600000).toISOString(), p95Ms: 420, planHash: "plan-b", indexSet: ["pk_orders"] },
    { ts: new Date(now - 30 * 60000).toISOString(), p95Ms: 910, planHash: "plan-c", indexSet: ["pk_orders", "ix_orders_status"] },
  ];
  const regressionPoint = timeline.reduce((worst, point) => (point.p95Ms > worst.p95Ms ? point : worst), timeline[0]);
  remember(context, "workloadSignals", {
    queryId,
    regressions: 1,
    correlationSeverity: "medium",
    p95Ms: regressionPoint.p95Ms,
  });
  return {
    queryId,
    windowHours,
    timeline,
    regressionPoint,
    reconstruction: {
      likelyCause: "plan_hash_changed_with_index_set_drift",
      recommendedReplay: "run explain_query for plan-a and plan-c",
    },
    source: "mock",
  };
}

async function deadlockSimulator(context, args = {}) {
  if (!Array.isArray(args.transactions) || !args.transactions.length) {
    const liveLocks = await lockAnalysis(context, args);
    if (liveLocks.blocked || liveLocks.error) {
      return liveLocks;
    }
    return {
      deadlockRisk: liveLocks.deadlockRisk,
      waitForGraph: {
        nodes: (liveLocks.topWaiters || []).map((waiter) => ({ id: waiter.session, waitType: waiter.waitType })),
        edges: (liveLocks.blockingChains || []).map((chain) => ({
          from: chain.waiter,
          to: chain.blocker,
          reason: chain.waitType || "blocking_wait",
        })),
      },
      mitigations: liveLocks.remediationPlan || ["monitor wait graph"],
      source: liveLocks.source,
    };
  }
  const transactions = Array.isArray(args.transactions) && args.transactions.length
    ? args.transactions
    : [
        { id: "t1", locks: ["orders:write", "users:read"] },
        { id: "t2", locks: ["users:write", "orders:read"] },
      ];
  const writeTargets = new Map();
  for (const tx of transactions) {
    for (const lock of tx.locks || []) {
      const [resource, mode] = String(lock).split(":");
      if (mode === "write") {
        writeTargets.set(resource, tx.id);
      }
    }
  }
  const edges = [];
  for (const tx of transactions) {
    for (const lock of tx.locks || []) {
      const [resource, mode] = String(lock).split(":");
      const owner = writeTargets.get(resource);
      if (mode === "read" && owner && owner !== tx.id) {
        edges.push({ from: tx.id, to: owner, resource, reason: "read_waits_on_write" });
      }
    }
  }
  const hasCycle = edges.length >= 2 && new Set(edges.map((edge) => edge.from)).size > 1 && new Set(edges.map((edge) => edge.to)).size > 1;
  const deadlockRisk = hasCycle ? "high" : edges.length ? "medium" : "low";
  remember(context, "workloadSignals", {
    lockEvents: edges.length,
    correlationSeverity: deadlockRisk === "high" ? "high" : "medium",
  });
  return {
    deadlockRisk,
    waitForGraph: {
      nodes: transactions.map((tx) => ({ id: tx.id, lockCount: (tx.locks || []).length })),
      edges,
    },
    mitigations: hasCycle
      ? ["normalize lock ordering", "shorten transaction scope", "add retry with jitter"]
      : ["monitor wait graph", "keep write paths ordered"],
    source: "mock",
  };
}

async function evolveIndexes(context, args = {}) {
  const engine = normalizeEngine(args.engine || "postgres");
  const database = args.database || (engine === "postgres" ? "analytics" : "app_prod");
  const schema = resolveSchema(engine, args);
  const table = args.table || (engine === "postgres" ? "events" : "orders");
  const liveUsage = await indexUsage(context, { ...args, engine, database, schema, table });
  if (liveUsage.blocked || liveUsage.error) {
    return liveUsage;
  }
  if (liveUsage.source === "live") {
    const unused = (liveUsage.indexes || []).filter((index) => Number(index.usageScore || 0) === 0);
    return {
      engine,
      database,
      schema,
      table,
      recommendations: [
        ...unused.map((index) => ({
          action: "review_unused_index",
          index: index.index,
          benefit: "medium",
          risk: "medium",
          reason: "live index usage reports zero reads",
        })),
        ...(!unused.length ? [{ action: "continue_monitoring", benefit: "low", risk: "low", reason: "live indexes show usage" }] : []),
      ],
      evolutionPlan: {
        cadence: "weekly_live_workload_window",
        validation: ["capture live baseline", "apply in dry_run", "compare query stats and write amplification"],
        rollback: "drop newly created index after regression threshold breach",
      },
      source: "live",
    };
  }
  const catalogTable = context.sampleCatalog?.[engine]?.schemas?.[database]?.[schema]?.tables?.[table] || {};
  const rowCountHint = Number(catalogTable.rowCountHint || 0);
  const recommendations = [
    {
      action: "create_covering_index",
      statement: engine === "postgres"
        ? `CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_${table}_created_at ON ${table}(created_at);`
        : `CREATE INDEX ix_${table}_created_at ON ${schema}.${table}(created_at);`,
      benefit: rowCountHint > 1000000 ? "high" : "medium",
      risk: "low",
    },
  ];
  if ((catalogTable.indexes || []).some((index) => Number(index.seekScore || 0) < 0.7)) {
    recommendations.push({
      action: "review_low_seek_index",
      statement: "compare maintenance cost against p95 improvement before drop",
      benefit: "medium",
      risk: "medium",
    });
  }
  return {
    engine,
    database,
    schema,
    table,
    recommendations,
    evolutionPlan: {
      cadence: "weekly_workload_window",
      validation: ["baseline explain", "apply in dry_run", "compare p95 and write amplification"],
      rollback: "drop newly created index after regression threshold breach",
    },
    source: "mock",
  };
}

async function describeBusinessLayer(context, args = {}) {
  const engine = normalizeEngine(args.engine || "sqlserver");
  const database = args.database || (engine === "postgres" ? "analytics" : "app_prod");
  const schema = resolveSchema(engine, args);
  const graph = buildSemanticGraph(context.sampleCatalog, engine, database, schema);
  const semanticSummary = summarize(graph);
  const businessEntities = graph.nodes.map((node) => {
    const table = node.id.split(".").at(-1);
    return {
      table,
      entity: table.replace(/_/g, " "),
      domain: node.containsPII ? "customer_data" : table.includes("order") ? "commerce" : "operations",
      dataSensitivity: node.containsPII ? "regulated" : "internal",
      operationalCriticality: node.rowCountHint > 1000000 ? "high" : "medium",
    };
  });
  return {
    engine,
    database,
    schema,
    businessEntities,
    semanticSummary,
    governanceHints: businessEntities
      .filter((entity) => entity.dataSensitivity === "regulated")
      .map((entity) => `apply masking and retention policy for ${entity.table}`),
    source: "mock",
  };
}

async function costIntelligence(context, args = {}) {
  const estimate = await estimateCost(context, args);
  const risk = classify(normalizeText(args.sql || args.query || ""));
  const costDrivers = [
    { driver: "cpu", score: estimate.estimatedCost.cpuUnits, reason: "predicate and join complexity" },
    { driver: "io", score: estimate.estimatedCost.ioUnits, reason: "scan or cold-cache pressure" },
    { driver: "locks", score: estimate.estimatedCost.lockUnits, reason: "write or blocking risk" },
  ].sort((a, b) => b.score - a.score);
  return {
    ...estimate,
    riskClass: risk.riskLevel,
    costDrivers,
    unitEconomics: {
      costPerThousandExecutions: risk.riskLevel === "HIGH" ? 18.4 : 4.7,
      dominantResource: costDrivers[0].driver,
      confidence: estimate.confidence,
    },
    budgetControls: ["cap p95 regression", "prefer read replica", "require dry-run for write-like tuning"],
    source: "mock",
  };
}

async function telemetryCorrelation(context, args = {}) {
  const deploymentId = normalizeText(args.deploymentId || "deploy-latest");
  const signalInputs = {
    lockEvents: args.lockEvents || [{ session: "s-101", waitMs: 1200 }],
    queryPlanEvents: args.queryPlanEvents || [{ queryId: "q-1122", p95Ms: 910 }],
    replicationEvents: args.replicationEvents || [{ topology: "primary-replica-2", lagSeconds: 1.2 }],
  };
  const correlation = correlateSignals(signalInputs);
  remember(context, "incidents", {
    deploymentId,
    severity: correlation.severity,
    incidentCount: correlation.incidentCount,
  });
  return {
    deploymentId,
    correlation,
    telemetryRefs: [
      `otel://deployment/${deploymentId}`,
      "db.wait_events",
      "db.query_plan_hash",
      "db.replication_lag",
    ],
    source: "mock",
  };
}

function sqlProblemDetector(_context, args = {}) {
  const sql = normalizeText(args.sql || args.query || "");
  const lower = sql.toLowerCase();
  const findings = [];
  if (/\bselect\s+\*/i.test(sql)) {
    findings.push({
      id: "select_star",
      severity: "medium",
      recommendation: "project only needed columns to reduce IO and network cost",
    });
  }
  if (!/\blimit\s+\d+|top\s*\(|fetch\s+next/i.test(sql) && /^\s*select\b/i.test(sql)) {
    findings.push({
      id: "unbounded_result",
      severity: "medium",
      recommendation: "add a bounded result limit or a selective predicate",
    });
  }
  if (/\blower\s*\(|upper\s*\(|date_trunc\s*\(/i.test(sql)) {
    findings.push({
      id: "function_on_predicate",
      severity: "high",
      recommendation: "avoid wrapping indexed columns in functions or add expression indexes",
    });
  }
  if (/\bor\s+/i.test(sql) && /\bwhere\b/i.test(sql)) {
    findings.push({
      id: "or_predicate",
      severity: "low",
      recommendation: "compare OR predicate against UNION ALL or composite indexes",
    });
  }
  if (!findings.length) {
    findings.push({ id: "no_static_smell", severity: "info", recommendation: "validate with live explain and workload stats" });
  }
  return {
    usp: "sql_problem_detector",
    engine: normalizeEngine(args.engine || "postgres"),
    findings,
    evidence: {
      sqlFingerprint: sha256(sql),
      tokens: draftSqlTokens(lower).slice(0, 20),
    },
    source: "analysis",
  };
}

function planDiffIntelligence(_context, args = {}) {
  const before = args.beforePlan || {};
  const after = args.afterPlan || {};
  const planChanges = [];
  if (before.scan && after.scan && before.scan !== after.scan) {
    planChanges.push({ type: "scan_changed", before: before.scan, after: after.scan });
  }
  if (before.join && after.join && before.join !== after.join) {
    planChanges.push({ type: "join_changed", before: before.join, after: after.join });
  }
  const costDelta = Number(after.cost || 0) - Number(before.cost || 0);
  const rowDelta = Number(after.rows || 0) - Number(before.rows || 0);
  if (costDelta) {
    planChanges.push({ type: "cost_changed", delta: costDelta });
  }
  const likelyCauses = [
    ...(String(after.scan || "").toLowerCase().includes("seq") ? ["index not selected or predicate too broad"] : []),
    ...(rowDelta > 10000 ? ["cardinality estimate or data distribution changed"] : []),
    ...(costDelta > 0 ? ["candidate plan has higher optimizer cost"] : []),
  ];
  return {
    usp: "plan_diff_intelligence",
    planChanges,
    likelyCauses: likelyCauses.length ? likelyCauses : ["plan shape is stable; validate runtime metrics"],
    confidence: Math.min(0.95, 0.45 + planChanges.length * 0.15),
    source: "analysis",
  };
}

function recommendationRanker(_context, args = {}) {
  const weight = {
    high: 3,
    medium: 2,
    low: 1,
  };
  const rankedRecommendations = (args.recommendations || []).map((rec) => {
    const impact = weight[String(rec.impact || "low").toLowerCase()] || 1;
    const risk = weight[String(rec.risk || "medium").toLowerCase()] || 2;
    const effort = weight[String(rec.effort || "medium").toLowerCase()] || 2;
    return {
      ...rec,
      score: impact * 8 - risk * 5 - effort * 4,
    };
  }).sort((a, b) => b.score - a.score);
  return {
    usp: "recommendation_ranker",
    rankedRecommendations,
    source: "analysis",
  };
}

function indexRoiSimulator(_context, args = {}) {
  const candidates = Array.isArray(args.candidates) ? args.candidates : [];
  const rankedCandidates = candidates.map((candidate, index) => {
    const readBenefitPerSecond = Number(candidate.readBenefitMs || 0) * Number(candidate.readQps || args.readQps || 1);
    const writePenaltyPerSecond = Number(candidate.writePenaltyMs || 0) * Number(candidate.writeQps || args.writeQps || 0);
    const storagePenalty = Number(candidate.storageMb || 0) / 1024;
    const maintenancePenalty = Number(candidate.maintenancePenalty || 0);
    const roiScore = Math.round((readBenefitPerSecond - writePenaltyPerSecond - storagePenalty - maintenancePenalty) * 100) / 100;
    return {
      id: candidate.id || candidate.name || `index_candidate_${index + 1}`,
      ...candidate,
      roiScore,
      breakEvenReadsPerWrite: Number(candidate.writePenaltyMs || 0) > 0
        ? Math.round((Number(candidate.writePenaltyMs || 0) / Math.max(1, Number(candidate.readBenefitMs || 1))) * 100) / 100
        : 0,
      verdict: roiScore > 100 ? "promote_to_benchmark" : roiScore > 0 ? "watch_and_benchmark" : "reject_or_rework",
    };
  }).sort((a, b) => b.roiScore - a.roiScore);
  return {
    usp: "index_roi_simulator",
    rankedCandidates,
    recommendation: rankedCandidates[0]
      ? `Benchmark ${rankedCandidates[0].id} first; estimated ROI score ${rankedCandidates[0].roiScore}.`
      : "Capture candidate index definitions and workload mix before simulating ROI.",
    source: "analysis",
  };
}

function planRegressionWatch(_context, args = {}) {
  const snapshots = [...(Array.isArray(args.snapshots) ? args.snapshots : [])].sort((a, b) =>
    String(a.capturedAt || "").localeCompare(String(b.capturedAt || "")));
  const baseline = snapshots[0] || {};
  const current = snapshots[snapshots.length - 1] || {};
  const findings = [];
  if (baseline.planHash && current.planHash && baseline.planHash !== current.planHash) {
    findings.push({ id: "plan_hash_changed", severity: "high", before: baseline.planHash, after: current.planHash });
  }
  const baselineP95 = Number(baseline.p95Ms || 0);
  const currentP95 = Number(current.p95Ms || 0);
  const p95Ratio = baselineP95 > 0 ? currentP95 / baselineP95 : 0;
  if (p95Ratio >= Number(args.regressionRatio || 1.5)) {
    findings.push({
      id: "tail_latency_regression",
      severity: p95Ratio >= 3 ? "critical" : "high",
      evidence: { baselineP95, currentP95, p95Ratio: Math.round(p95Ratio * 100) / 100 },
    });
  }
  return {
    usp: "plan_regression_watch",
    regressionDetected: findings.length > 0,
    findings,
    rollbackCandidate: findings.some((finding) => finding.id === "plan_hash_changed") ? baseline.planHash || null : null,
    nextActions: findings.length
      ? ["pin or compare previous plan", "run plan_deep_diagnostics", "benchmark candidate fix"]
      : ["keep monitoring plan hash and tail latency"],
    source: "analysis",
  };
}

function parameterSensitivityGuard(_context, args = {}) {
  const executions = Array.isArray(args.executions) ? args.executions : [];
  const latencies = executions.map((execution) => Number(execution.p95Ms || execution.durationMs || 0)).filter((value) => value > 0);
  const rows = executions.map((execution) => Number(execution.rows || 0)).filter((value) => value > 0);
  const planHashes = new Set(executions.map((execution) => execution.planHash).filter(Boolean));
  const maxLatency = Math.max(0, ...latencies);
  const minLatency = Math.min(...latencies, maxLatency || 0);
  const maxRows = Math.max(0, ...rows);
  const minRows = Math.min(...rows, maxRows || 0);
  const latencyRatio = minLatency > 0 ? maxLatency / minLatency : 0;
  const rowRatio = minRows > 0 ? maxRows / minRows : 0;
  const parameterSensitive = latencyRatio >= 10 || rowRatio >= 100 || planHashes.size > 1;
  return {
    usp: "parameter_sensitivity_guard",
    parameterSensitive,
    evidence: {
      latencyRatio: Math.round(latencyRatio * 100) / 100,
      rowRatio: Math.round(rowRatio * 100) / 100,
      distinctPlanHashes: planHashes.size,
    },
    mitigations: parameterSensitive
      ? ["use_parameter_sensitive_plan_strategy", "split_large_and_small_parameter_paths", "benchmark_recompile_or_custom_plan"]
      : ["continue_sampling_parameter_shapes"],
    source: "analysis",
  };
}

function maintenanceWindowAdvisor(_context, args = {}) {
  const tables = Array.isArray(args.tables) ? args.tables : [];
  const runbook = tables.map((table) => {
    const actions = [];
    if (Number(table.statsAgeHours || 0) >= 24) actions.push("analyze");
    if (Number(table.deadTuplePct || 0) >= 10) actions.push("vacuum");
    if (Number(table.bloatPct || 0) >= 25) actions.push("repack_or_reindex_review");
    const risk = Number(table.writeQps || 0) > 100 ? "schedule_low_write_window" : "standard_window";
    return {
      table: table.table || table.name || "unknown",
      actions: actions.length ? actions : ["monitor"],
      risk,
      evidence: {
        deadTuplePct: Number(table.deadTuplePct || 0),
        statsAgeHours: Number(table.statsAgeHours || 0),
        bloatPct: Number(table.bloatPct || 0),
      },
    };
  }).sort((a, b) => {
    const score = (b.evidence.deadTuplePct + b.evidence.bloatPct + b.evidence.statsAgeHours / 4) -
      (a.evidence.deadTuplePct + a.evidence.bloatPct + a.evidence.statsAgeHours / 4);
    return score;
  });
  return {
    usp: "maintenance_window_advisor",
    engine: normalizeEngine(args.engine || "postgres"),
    runbook,
    safetyGates: ["run outside peak write window", "measure before/after bloat and p95", "abort on lock pressure"],
    source: "analysis",
  };
}

function sloImpactGuard(_context, args = {}) {
  const sloTargetMs = Number(args.sloTargetMs || 300);
  const observedP95Ms = Number(args.observedP95Ms || 0);
  const requestsPerMinute = Number(args.requestsPerMinute || 0);
  const overageMs = Math.max(0, observedP95Ms - sloTargetMs);
  const burn = sloTargetMs > 0 ? Math.round((observedP95Ms / sloTargetMs) * 100) / 100 : 0;
  const impactedRequestsPerMinute = overageMs > 0 ? requestsPerMinute : 0;
  const status = overageMs > 0 ? "slo_breach" : "within_slo";
  const criticalPath = args.criticalPath || "database critical path";
  return {
    usp: "slo_impact_guard",
    status,
    errorBudgetBurnRate: burn,
    impactedRequestsPerMinute,
    executiveSummary: status === "slo_breach"
      ? `${criticalPath} is ${overageMs}ms over SLO at p95 and burns error budget at ${burn}x.`
      : `${criticalPath} is within the configured p95 SLO.`,
    actions: status === "slo_breach"
      ? ["prioritize top workload impact query", "freeze risky migrations", "run benchmark_ab_runner before release"]
      : ["continue monitoring"],
    source: "analysis",
  };
}

function normalizeQueryFingerprint(sql) {
  return normalizeText(sql)
    .toLowerCase()
    .replace(/'[^']*'/g, "?")
    .replace(/\b\d+(\.\d+)?\b/g, "?")
    .replace(/\s+/g, " ")
    .trim();
}

function queryFingerprintClusterer(_context, args = {}) {
  const groups = new Map();
  for (const query of Array.isArray(args.queries) ? args.queries : []) {
    const fingerprint = normalizeQueryFingerprint(query.sql || query.query || "");
    if (!groups.has(fingerprint)) {
      groups.set(fingerprint, { fingerprint, queryIds: [], calls: 0, maxP95Ms: 0, sampleSql: query.sql || query.query || "" });
    }
    const group = groups.get(fingerprint);
    group.queryIds.push(query.queryId || query.id || `query_${group.queryIds.length + 1}`);
    group.calls += Number(query.calls || 0);
    group.maxP95Ms = Math.max(group.maxP95Ms, Number(query.p95Ms || 0));
  }
  const clusters = [...groups.values()].map((group) => ({
    ...group,
    impactScore: Math.round(group.calls * group.maxP95Ms),
  })).sort((a, b) => b.impactScore - a.impactScore);
  return {
    usp: "query_fingerprint_clusterer",
    clusters,
    recommendation: clusters[0] ? `Tune query family ${clusters[0].fingerprint} first.` : "Capture query text, calls, and p95 latency.",
    source: "analysis",
  };
}

function waitEventRootCause(_context, args = {}) {
  const waits = Array.isArray(args.waits) ? args.waits : [];
  const classified = waits.map((wait) => {
    const waitType = normalizeText(wait.waitType || wait.event || "");
    let cause = { id: "general_wait_pressure", label: "General wait pressure", actions: ["compare waits with workload changes"] };
    if (/lck|lock|blocked/i.test(waitType)) {
      cause = { id: "blocking_lock_chain", label: "Blocking lock chain", actions: ["inspect_blocking_sessions", "shorten_transactions", "review_isolation_level"] };
    } else if (/pageio|io|read|write/i.test(waitType)) {
      cause = { id: "storage_io_pressure", label: "Storage IO pressure", actions: ["check_missing_indexes", "review_cache_hit_ratio", "inspect_storage_latency"] };
    } else if (/cxpacket|parallel|exchange/i.test(waitType)) {
      cause = { id: "parallelism_skew", label: "Parallelism or exchange skew", actions: ["review_parallelism_settings", "check_cardinality_estimates"] };
    }
    return {
      waitType,
      waitMs: Number(wait.waitMs || 0),
      sessions: Number(wait.sessions || 1),
      ...cause,
      pressureScore: Number(wait.waitMs || 0) * Number(wait.sessions || 1),
    };
  }).sort((a, b) => b.pressureScore - a.pressureScore);
  const primary = classified[0] || { id: "no_wait_pressure", label: "No wait pressure", actions: ["continue monitoring"] };
  return {
    usp: "wait_event_root_cause",
    primaryCause: { id: primary.id, label: primary.label, waitType: primary.waitType || null },
    findings: classified,
    actions: primary.actions || ["continue monitoring"],
    source: "analysis",
  };
}

function dataSkewDetector(_context, args = {}) {
  const distribution = [...(Array.isArray(args.distribution) ? args.distribution : [])]
    .map((item) => ({ value: item.value, rows: Number(item.rows || item.count || 0) }))
    .sort((a, b) => b.rows - a.rows);
  const totalRows = distribution.reduce((sum, item) => sum + item.rows, 0);
  const hotValues = distribution.map((item) => ({
    ...item,
    pct: totalRows > 0 ? Math.round((item.rows / totalRows) * 10000) / 100 : 0,
  })).filter((item) => item.pct >= Number(args.hotValuePct || 25));
  const topPct = hotValues[0]?.pct || 0;
  const skewDetected = topPct >= Number(args.skewPct || 50);
  return {
    usp: "data_skew_detector",
    column: args.column || "unknown",
    skewDetected,
    hotValues,
    recommendations: skewDetected
      ? ["evaluate_filtered_or_partial_indexes", "split_hot_tenant_or_value_path", "refresh_histograms"]
      : ["continue_distribution_sampling"],
    source: "analysis",
  };
}

function cacheEfficiencyAdvisor(_context, args = {}) {
  const bufferHitRatio = Number(args.bufferHitRatio ?? args.cacheHitRatio ?? 1);
  const physicalReads = Number(args.physicalReads || 0);
  const logicalReads = Number(args.logicalReads || 0);
  const readAmplification = logicalReads > 0 ? Math.round((physicalReads / logicalReads) * 100) / 100 : 0;
  const findings = [];
  if (bufferHitRatio < Number(args.minBufferHitRatio || 0.95)) {
    findings.push({ id: "low_buffer_hit_ratio", severity: bufferHitRatio < 0.85 ? "high" : "medium", evidence: { bufferHitRatio } });
  }
  if (readAmplification > Number(args.maxReadAmplification || 0.5)) {
    findings.push({ id: "high_read_amplification", severity: "medium", evidence: { readAmplification } });
  }
  return {
    usp: "cache_efficiency_advisor",
    table: args.table || null,
    status: findings.length ? "cache_pressure" : "cache_healthy",
    findings,
    actions: findings.length ? ["review_top_physical_read_queries", "check_index_coverage", "validate_working_set_size"] : ["continue monitoring"],
    source: "analysis",
  };
}

function capacityHeadroomForecast(_context, args = {}) {
  const currentSizeGb = Number(args.currentSizeGb || 0);
  const maxSizeGb = Number(args.maxSizeGb || 0);
  const dailyGrowthGb = Number(args.dailyGrowthGb || 0);
  const remainingGb = Math.max(0, maxSizeGb - currentSizeGb);
  const daysToStorageSaturation = dailyGrowthGb > 0 ? Math.floor(remainingGb / dailyGrowthGb) : Infinity;
  const cpuRisk = Number(args.cpuP95Pct || 0) >= 85;
  const ioRisk = Number(args.ioP95Pct || 0) >= 85;
  const storageRisk = daysToStorageSaturation <= Number(args.warningDays || 14);
  const status = storageRisk || cpuRisk || ioRisk ? "capacity_risk" : "healthy_headroom";
  const actions = [];
  if (storageRisk) actions.push("schedule_capacity_increase");
  if (cpuRisk) actions.push("reduce_cpu_hotspots_or_scale_compute");
  if (ioRisk) actions.push("reduce_io_pressure_or_scale_storage");
  return {
    usp: "capacity_headroom_forecast",
    status,
    daysToStorageSaturation,
    remainingGb,
    resourceRisks: { storageRisk, cpuRisk, ioRisk },
    actions: actions.length ? actions : ["continue trend monitoring"],
    source: "analysis",
  };
}

function advisorConfidenceGrader(_context, args = {}) {
  const evidence = args.evidence || {};
  const checks = {
    livePlan: Boolean(evidence.hasLivePlan || evidence.livePlan),
    benchmark: Boolean(evidence.hasBenchmark || evidence.benchmark),
    waits: Boolean(evidence.hasWaits || evidence.waits),
    rollback: Boolean(evidence.hasRollback || evidence.rollback),
    workload: Boolean(evidence.hasWorkload || evidence.workload),
  };
  const score = Object.values(checks).filter(Boolean).length;
  const missingEvidence = Object.entries(checks).filter(([, present]) => !present).map(([key]) => key);
  const grade = checks.livePlan && checks.benchmark && checks.rollback
    ? "strong_live_evidence"
    : score >= 2
      ? "moderate_evidence"
      : "heuristic_only";
  return {
    usp: "advisor_confidence_grader",
    grade,
    score,
    missingEvidence,
    requiredNextEvidence: missingEvidence.slice(0, 3),
    source: "analysis",
  };
}

function evidencePackGenerator(context, args = {}) {
  const sql = normalizeText(args.sql || args.query || "");
  const grader = advisorConfidenceGrader(context, {
    evidence: {
      hasLivePlan: Boolean(args.plan || args.planFindings),
      hasBenchmark: Boolean(args.benchmark),
      hasWaits: Boolean(args.waits),
      hasRollback: Boolean(args.rollback || args.rollbackPlan),
      hasWorkload: Boolean(args.workload || args.queryStats),
    },
  });
  const sections = [
    ...(sql ? ["sql"] : []),
    ...(args.plan || args.planFindings ? ["plan"] : []),
    ...(args.waits ? ["waits"] : []),
    ...(args.indexes || args.indexUsage ? ["indexes"] : []),
    ...(args.slo || args.sloTargetMs ? ["slo"] : []),
    "recommendation",
    "rollback",
  ];
  return {
    usp: "evidence_pack_generator",
    executiveSummary: `${args.question || "Performance case"}: ${args.recommendation || "collect more live evidence before change"}.`,
    caseFile: {
      id: `case-${sha256(stableStringify(args)).slice(0, 10)}`,
      sections,
      sqlFingerprint: sql ? sha256(sql) : null,
      evidence: redactSensitive({
        planFindings: args.planFindings || [],
        waits: args.waits || [],
        queryStats: args.queryStats || [],
        recommendation: args.recommendation || null,
        rollback: args.rollback || args.rollbackPlan || "define rollback before production change",
      }),
    },
    evidenceGrade: grader.grade,
    missingEvidence: grader.missingEvidence,
    source: "analysis",
  };
}

function autoTuningExperimentDesigner(_context, args = {}) {
  const metric = args.successMetric || "p95Ms";
  const baselineValue = Number(args.baseline?.[metric] || args.baseline?.p95Ms || 0);
  const targetValue = Number(args.target?.[metric] || args.target?.p95Ms || Math.max(0, baselineValue * 0.75));
  return {
    usp: "auto_tuning_experiment_designer",
    experiment: {
      hypothesis: args.hypothesis || "candidate change improves database performance",
      candidateChange: args.candidateChange || args.change || "candidate tuning change",
      successCriteria: {
        metric,
        baseline: baselineValue,
        target: targetValue,
        direction: "lower_is_better",
      },
      measurementWindow: args.measurementWindow || "30m baseline and 30m candidate under comparable load",
      abortCriteria: [
        "p95 regression exceeds 10 percent",
        "error rate or lock waits increase materially",
        "write latency or replication lag breaches guardrail",
      ],
      rollbackPlan: args.rollbackPlan || "revert candidate change and replay baseline measurement",
    },
    source: "analysis",
  };
}

function migrationPerformancePredictor(_context, args = {}) {
  const sql = normalizeText(args.sql || args.query || "");
  const risks = [];
  if (/\btop\s+\d+/i.test(sql)) risks.push({ id: "top_syntax_translation", severity: "medium", recommendation: "translate TOP to LIMIT/FETCH and compare plan shape" });
  if (/json_value|json_query|openjson/i.test(sql)) risks.push({ id: "json_function_translation", severity: "high", recommendation: "map JSON functions to jsonb operators and index paths" });
  if (/\bwith\b/i.test(sql)) risks.push({ id: "cte_materialization_or_inlining", severity: "medium", recommendation: "benchmark CTE behavior on target engine" });
  if (/collate|like/i.test(sql)) risks.push({ id: "collation_selectivity_risk", severity: "medium", recommendation: "verify collation and pattern index behavior" });
  if (/parameter|@\w+/i.test(sql)) risks.push({ id: "parameterization_plan_risk", severity: "medium", recommendation: "sample parameter shapes on target engine" });
  return {
    usp: "migration_performance_predictor",
    sourceEngine: args.sourceEngine || "sqlserver",
    targetEngine: args.targetEngine || "postgres",
    risks,
    riskLevel: risks.some((risk) => risk.severity === "high") ? "high" : risks.length ? "medium" : "low",
    nextChecks: ["translate query", "capture target EXPLAIN ANALYZE", "compare workload replay metrics"],
    source: "analysis",
  };
}

function workloadReplayRiskSimulator(_context, args = {}) {
  const workload = Array.isArray(args.workload) ? args.workload : [];
  const readPressure = workload.reduce((sum, query) => sum + Number(query.calls || 0) * Number(query.p95Ms || 0), 0);
  const writePressure = workload.reduce((sum, query) => sum + Number(query.writesPerSecond || query.writeQps || 0), 0);
  const lockPressure = workload.reduce((sum, query) => sum + Number(query.lockWaitMs || 0), 0);
  const riskScore = Math.round(readPressure / 10000 + writePressure * 2 + lockPressure / 1000);
  return {
    usp: "workload_replay_risk_simulator",
    change: args.change || "candidate change",
    riskScore,
    sideEffects: {
      writeAmplificationRisk: writePressure > 100,
      lockRisk: lockPressure > 1000,
      cacheRisk: readPressure > 1_000_000,
    },
    recommendation: riskScore > 100 ? "run controlled replay before rollout" : "safe for benchmark window with guardrails",
    source: "analysis",
  };
}

function indexPortfolioOptimizer(_context, args = {}) {
  const indexes = Array.isArray(args.indexes) ? args.indexes : [];
  const containsColumns = (wide, narrow) => narrow.every((column, index) => wide[index] === column);
  const redundantIndexes = [];
  for (const index of indexes) {
    const columns = index.columns || [];
    const covering = indexes.find((candidate) =>
      candidate.name !== index.name &&
      (candidate.columns || []).length > columns.length &&
      containsColumns(candidate.columns || [], columns));
    if (covering) {
      redundantIndexes.push({ name: index.name, coveredBy: covering.name, reason: "left_prefix_covered" });
    }
  }
  const dropCandidates = indexes
    .filter((index) => Number(index.reads || 0) === 0 && Number(index.writes || 0) > 0)
    .map((index) => ({ name: index.name, writes: Number(index.writes || 0), reason: "unused_with_write_overhead" }));
  return {
    usp: "index_portfolio_optimizer",
    redundantIndexes,
    dropCandidates,
    createCandidates: Array.isArray(args.missingIndexes) ? args.missingIndexes : [],
    actionOrder: ["drop or consolidate redundant indexes in dry run", "benchmark create candidates", "monitor write overhead"],
    source: "analysis",
  };
}

function incidentTimelineBuilder(_context, args = {}) {
  const timeline = [...(Array.isArray(args.events) ? args.events : [])].sort((a, b) => String(a.ts || "").localeCompare(String(b.ts || "")));
  const narrative = timeline.map((event) => `${event.ts || "unknown"} ${event.type || "event"}: ${event.summary || ""}`).join(" -> ");
  return {
    usp: "incident_timeline_builder",
    timeline,
    narrative,
    likelyCause: timeline.find((event) => /plan|deployment|schema/i.test(event.type || event.summary || "")) || timeline[0] || null,
    nextActions: ["attach evidence pack", "validate causal link", "prepare rollback or tuning experiment"],
    source: "analysis",
  };
}

function changeTicketExporter(_context, args = {}) {
  const riskLevel = normalizeText(args.riskLevel || "medium").toLowerCase();
  return {
    usp: "change_ticket_exporter",
    ticket: {
      title: args.title || "Database performance change",
      problem: args.problem || "Performance regression",
      recommendation: args.recommendation || "Apply candidate tuning change",
      riskLevel,
      rollback: args.rollback || args.rollbackPlan || "revert change",
      approvalChecklist: [
        "evidence_pack_attached",
        "benchmark_plan_attached",
        "rollback_plan_attached",
        "owner_approval_recorded",
      ],
      labels: ["database", "performance", riskLevel],
    },
    exportFormats: ["markdown", "json"],
    source: "analysis",
  };
}

function costToPerformanceAdvisor(_context, args = {}) {
  const currentMonthlyCost = Number(args.currentMonthlyCost || 0);
  const projectedMonthlyCost = Number(args.projectedMonthlyCost || 0);
  const currentP95Ms = Number(args.currentP95Ms || 0);
  const projectedP95Ms = Number(args.projectedP95Ms || 0);
  const costDelta = projectedMonthlyCost - currentMonthlyCost;
  const latencyImprovementPct = currentP95Ms > 0 ? Math.round(((currentP95Ms - projectedP95Ms) / currentP95Ms) * 1000) / 10 : 0;
  return {
    usp: "cost_to_performance_advisor",
    costDelta,
    latencyImprovementPct,
    efficiency: costDelta > 0 ? Math.round((latencyImprovementPct / costDelta) * 100) / 100 : latencyImprovementPct,
    recommendation: latencyImprovementPct >= 50 && costDelta <= currentMonthlyCost * 0.5
      ? "approve_cost_for_latency_gain"
      : "seek_lower_cost_tuning_first",
    source: "analysis",
  };
}

function schemaEvolutionGuard(_context, args = {}) {
  const findings = [];
  for (const change of Array.isArray(args.changes) ? args.changes : []) {
    if (change.type === "add_foreign_key" && !change.hasSupportingIndex) {
      findings.push({ id: "foreign_key_without_index", severity: "high", table: change.table, column: change.column });
    }
    if (change.type === "add_column_with_default" && change.nullable === false && change.defaultExpression) {
      findings.push({ id: "blocking_default_backfill_risk", severity: "high", table: change.table });
    }
    if (change.type === "validate_constraint" && !change.online) {
      findings.push({ id: "constraint_validation_lock_risk", severity: "medium", table: change.table });
    }
  }
  return {
    usp: "schema_evolution_guard",
    releaseRisk: findings.some((finding) => finding.severity === "high") ? "high" : findings.length ? "medium" : "low",
    findings,
    mitigations: findings.length
      ? ["add supporting indexes first", "use online or staged validation", "benchmark lock duration in staging"]
      : ["proceed with normal migration gates"],
    source: "analysis",
  };
}

function performancePrReviewer(context, args = {}) {
  const schema = schemaEvolutionGuard(context, { changes: args.changes || [] });
  const findings = [...schema.findings];
  for (const change of Array.isArray(args.changes) ? args.changes : []) {
    if (change.type === "drop_index" && change.reads > 0) {
      findings.push({ id: "drops_used_index", severity: "high", index: change.name });
    }
    if (change.type === "raw_sql" && /\bupdate\b|\bdelete\b|\balter\b/i.test(change.sql || "")) {
      findings.push({ id: "write_migration_requires_experiment", severity: "medium", table: change.table || null });
    }
  }
  const mergeDecision = findings.some((finding) => finding.severity === "high") ? "block" : findings.length ? "review" : "approve";
  return {
    usp: "performance_pr_reviewer",
    pullRequest: args.pullRequest || args.pr || "local-change",
    mergeDecision,
    findings,
    requiredChecks: mergeDecision === "approve" ? ["standard_ci"] : ["evidence_pack", "benchmark", "rollback_plan"],
    source: "analysis",
  };
}

function crossToolDevopsAnalyzer(_context, args = {}) {
  const artifacts = Array.isArray(args.artifacts) ? args.artifacts : [];
  const normalizedArtifacts = artifacts.map((artifact) => {
    const tool = normalizeText(artifact.tool || "unknown").toLowerCase();
    const content = normalizeText(artifact.content || "");
    const operations = [
      ...(/\bcreate\s+index\b/i.test(content) ? ["create_index"] : []),
      ...(/addForeignKey|foreign\s+key/i.test(content) ? ["add_foreign_key"] : []),
      ...(/dacpac|sqlproj/i.test(content + " " + artifact.path) ? ["state_based_model"] : []),
      ...(/alter\s+table/i.test(content) ? ["alter_table"] : []),
    ];
    return { tool, path: artifact.path || null, operations, risk: operations.includes("add_foreign_key") ? "review" : "standard" };
  });
  return {
    usp: "cross_tool_devops_analyzer",
    normalizedArtifacts,
    pipelineAdvice: ["run_policy_gates_before_apply", "generate_evidence_pack", "attach_change_ticket"],
    supportedToolchains: ["flyway", "liquibase", "ssdt", "redgate", "dbforge", "apexsql"],
    source: "analysis",
  };
}

function aiGuardedSqlGenerator(_context, args = {}) {
  const table = normalizeText(args.table || "target_table");
  const filters = args.filters && typeof args.filters === "object" ? args.filters : {};
  const where = Object.entries(filters).map(([key, value]) => `${key} = '${String(value).replace(/'/g, "''")}'`);
  if (args.tenantId) where.push(`tenant_id = '${String(args.tenantId).replace(/'/g, "''")}'`);
  const limit = Number(args.limit || 100);
  const sql = `SELECT * FROM ${table}${where.length ? ` WHERE ${where.join(" AND ")}` : ""} LIMIT ${limit}`;
  return {
    usp: "ai_guarded_sql_generator",
    intent: args.intent || "generate safe read query",
    sql,
    guardrails: [
      "read_only",
      "bounded_result",
      ...(args.tenantId ? ["tenant_context_required"] : ["tenant_context_missing"]),
      "policy_audit_required",
    ],
    risk: classify(sql),
    source: "analysis",
  };
}

function syntheticWorkloadLab(_context, args = {}) {
  const tables = (Array.isArray(args.tables) ? args.tables : []).map((table) => ({
    table: table.table || table.name,
    syntheticRows: Math.min(Number(table.rowCount || 1000), Number(args.maxRowsPerTable || 100000)),
    maskedColumns: table.piiColumns || [],
    distribution: table.distribution || "preserve_shape_without_real_values",
  }));
  const steps = (Array.isArray(args.queryFamilies) ? args.queryFamilies : []).map((family, index) => ({
    order: index + 1,
    fingerprint: family.fingerprint || `query_family_${index + 1}`,
    calls: Number(family.calls || 1),
    targetP95Ms: Number(family.p95Ms || 100),
  }));
  return {
    usp: "synthetic_workload_lab",
    syntheticDataPlan: { tables, privacyMode: "masked_synthetic" },
    workloadScript: { steps, replayMode: "shape_preserving" },
    source: "analysis",
  };
}

function vendorNeutralDevopsBrain(_context, args = {}) {
  const tools = Array.isArray(args.tools) ? args.tools : [];
  return {
    usp: "vendor_neutral_devops_brain",
    strategy: {
      controlPlane: "plugin_policy_layer",
      toolAdapters: tools.map((tool) => ({ tool, role: /flyway|liquibase/i.test(tool) ? "migration_runner" : /ssdt/i.test(tool) ? "state_model" : "analysis_or_compare" })),
      gates: ["policy", "performance_pr_review", "evidence_pack", "change_ticket"],
      execution: String(args.riskLevel || "").toLowerCase() === "high" ? "approval_required" : "ci_ready",
    },
    source: "analysis",
  };
}

function complianceQueryAssistant(_context, args = {}) {
  const sql = normalizeText(args.sql || "SELECT * FROM target_table");
  const piiColumns = Array.isArray(args.piiColumns) ? args.piiColumns : [];
  let safeSql = sql;
  for (const column of piiColumns) {
    safeSql = safeSql.replace(new RegExp(`\\b${column}\\b`, "gi"), `mask(${column}) AS ${column}`);
  }
  if (args.tenantId && !/\btenant_id\b/i.test(safeSql)) {
    safeSql = /\bwhere\b/i.test(safeSql)
      ? `${safeSql} AND tenant_id = '${String(args.tenantId).replace(/'/g, "''")}'`
      : `${safeSql} WHERE tenant_id = '${String(args.tenantId).replace(/'/g, "''")}'`;
  }
  return {
    usp: "compliance_query_assistant",
    safeSql,
    maskedColumns: piiColumns,
    controls: ["tenant_filter", "pii_masking", "audit_reason_required"],
    source: "analysis",
  };
}

function migrationTwinSimulator(context, args = {}) {
  const queries = Array.isArray(args.queries) ? args.queries : [];
  const queryRisks = queries.map((query) => {
    const prediction = migrationPerformancePredictor(context, {
      sourceEngine: args.sourceEngine,
      targetEngine: args.targetEngine,
      sql: query.sql,
    });
    return {
      queryId: query.queryId || query.id,
      calls: Number(query.calls || 0),
      currentP95Ms: Number(query.p95Ms || 0),
      riskLevel: prediction.riskLevel,
      risks: prediction.risks.map((risk) => risk.id),
    };
  });
  const highCount = queryRisks.filter((risk) => risk.riskLevel === "high").length;
  return {
    usp: "migration_twin_simulator",
    sourceEngine: args.sourceEngine || "sqlserver",
    targetEngine: args.targetEngine || "postgres",
    queryRisks,
    overallRisk: highCount ? "high" : queryRisks.some((risk) => risk.riskLevel === "medium") ? "medium" : "low",
    nextActions: ["translate high-risk query families", "benchmark target plans", "create rollback path per migration batch"],
    source: "analysis",
  };
}

function policyGatedSelfHealing(_context, args = {}) {
  const production = String(args.environment || "").toLowerCase() === "production";
  const highRisk = /high|critical/i.test(String(args.riskLevel || ""));
  return {
    usp: "policy_gated_self_healing",
    incidentType: args.incidentType || "performance_incident",
    executionMode: production || highRisk ? "approval_required" : "dry_run_ready",
    runbook: [
      { order: 1, step: "collect_evidence", gate: "automatic" },
      { order: 2, step: "rank_safe_actions", gate: "policy" },
      { order: 3, step: "prepare_rollback", gate: "policy" },
      { order: 4, step: "execute_candidate_fix", gate: production || highRisk ? "human_approval" : "dry_run" },
    ],
    source: "analysis",
  };
}

function advisorMemoryRecommender(context, args = {}) {
  const entries = recall(context, "advisorFeedback", 50);
  const recommendationId = args.recommendationId || args.id || "";
  const memoryMatches = entries.filter((entry) => !recommendationId || entry.recommendationId === recommendationId);
  const improved = memoryMatches.filter((entry) => entry.outcome?.improved || entry.improved).length;
  const confidenceHint = memoryMatches.length ? (improved / memoryMatches.length >= 0.5 ? "boost" : "deprioritize") : "unknown";
  return {
    usp: "advisor_memory_recommender",
    recommendationId: recommendationId || null,
    memoryMatches,
    confidenceHint,
    source: "runtime",
  };
}

async function autonomousDbaCopilot(context, args = {}) {
  const caseFile = evidencePackGenerator(context, args);
  const confidence = advisorConfidenceGrader(context, { evidence: args.evidence || {} });
  const experiment = autoTuningExperimentDesigner(context, {
    hypothesis: args.hypothesis || "top recommendation improves p95 without policy breach",
    candidateChange: args.recommendation || "candidate tuning change",
    baseline: args.baseline || { p95Ms: args.currentP95Ms || 0 },
    target: args.target || { p95Ms: args.projectedP95Ms || 0 },
  });
  return {
    usp: "autonomous_dba_copilot",
    loopSteps: ["collect_evidence", "grade_confidence", "design_experiment", "prepare_change_ticket", "define_rollback"],
    decisionPackage: {
      evidenceGrade: confidence.grade,
      caseFileId: caseFile.caseFile.id,
      experiment: experiment.experiment,
    },
    nextAction: confidence.grade === "strong_live_evidence" ? "prepare_change_ticket" : "collect_missing_evidence",
    source: "analysis",
  };
}

function sqlCodeReviewAssistant(context, args = {}) {
  const diagnosis = sqlProblemDetector(context, args);
  const reviewComments = diagnosis.findings.map((finding) => ({
    id: finding.id,
    severity: finding.severity,
    comment: finding.recommendation,
    context: args.context || "code_review",
  }));
  return {
    usp: "sql_code_review_assistant",
    reviewComments,
    decision: reviewComments.some((comment) => comment.severity === "high" || comment.severity === "critical") ? "request_changes" : "comment",
    source: "analysis",
  };
}

function schemaCompareIntelligence(_context, args = {}) {
  const beforeByTable = new Map((Array.isArray(args.before) ? args.before : []).map((table) => [table.table, table]));
  const addedColumns = [];
  const risks = [];
  for (const table of Array.isArray(args.after) ? args.after : []) {
    const before = beforeByTable.get(table.table) || { columns: [] };
    for (const column of table.columns || []) {
      if (!(before.columns || []).includes(column)) {
        addedColumns.push(`${table.table}.${column}`);
      }
    }
    for (const fk of table.foreignKeys || []) {
      if (!fk.indexed) risks.push({ id: "new_fk_without_index", severity: "high", table: table.table, column: fk.column });
    }
  }
  return {
    usp: "schema_compare_intelligence",
    diffSummary: { addedColumns },
    risks,
    intent: risks.length ? "schema_change_requires_performance_review" : "schema_change_standard",
    source: "analysis",
  };
}

function queryContractTester(_context, args = {}) {
  const sql = normalizeText(args.sql || args.query || "");
  const contract = args.contract || {};
  const violations = [];
  for (const column of contract.requiredColumns || []) {
    if (!new RegExp(`\\b${column}\\b`, "i").test(sql) && !/select\s+\*/i.test(sql)) {
      violations.push({ id: "missing_required_column", column });
    }
  }
  const limitMatch = sql.match(/\blimit\s+(\d+)/i);
  if (contract.maxRows && (!limitMatch || Number(limitMatch[1]) > Number(contract.maxRows))) {
    violations.push({ id: "row_bound_exceeded", maxRows: contract.maxRows });
  }
  if (contract.readOnly && !/^\s*select\b/i.test(sql)) {
    violations.push({ id: "not_read_only" });
  }
  return {
    usp: "query_contract_tester",
    contractStatus: violations.length ? "fail" : "pass",
    violations,
    source: "analysis",
  };
}

function rollbackRehearsalEngine(_context, args = {}) {
  const hasRollback = Boolean(normalizeText(args.rollback || args.rollbackPlan));
  const validationQueries = Array.isArray(args.validationQueries) ? args.validationQueries : [];
  return {
    usp: "rollback_rehearsal_engine",
    rehearsalStatus: hasRollback && validationQueries.length ? "ready" : "incomplete",
    steps: [
      { id: "capture_before_state", command: "record_schema_and_metrics" },
      { id: "apply_change_in_sandbox", command: args.change || "candidate_change" },
      { id: "execute_rollback", command: args.rollback || args.rollbackPlan || "missing_rollback" },
      { id: "validate_after_rollback", command: validationQueries.join("; ") || "missing_validation_query" },
    ],
    source: "analysis",
  };
}

function releaseTrainRiskBoard(_context, args = {}) {
  const weight = { critical: 5, high: 4, medium: 2, low: 1 };
  const releaseBoard = (Array.isArray(args.releases) ? args.releases : []).map((release) => {
    const score = (release.changes || []).reduce((sum, change) => sum + (weight[String(change.riskLevel || "low").toLowerCase()] || 1), 0);
    return {
      id: release.id,
      score,
      decision: score >= 4 ? "hold" : score >= 2 ? "review" : "go",
    };
  }).sort((a, b) => b.score - a.score);
  return {
    usp: "release_train_risk_board",
    releaseBoard,
    source: "analysis",
  };
}

function observabilitySignalRouter(_context, args = {}) {
  const routes = new Set();
  for (const signal of Array.isArray(args.signals) ? args.signals : []) {
    if (/wait|lock/i.test(signal.type || signal.waitType || "")) routes.add("wait_event_root_cause");
    if (/plan/i.test(signal.type || "")) routes.add("plan_regression_watch");
    if (/slo|latency/i.test(signal.type || "")) routes.add("slo_impact_guard");
    if (/capacity|storage|cpu|io/i.test(signal.type || "")) routes.add("capacity_headroom_forecast");
  }
  return {
    usp: "observability_signal_router",
    routes: [...routes],
    routingMode: "advisor_tool_fanout",
    source: "analysis",
  };
}

function fleetHealthScorecard(_context, args = {}) {
  const scorecard = (Array.isArray(args.databases) ? args.databases : []).map((db) => {
    const score = Number(db.p95Ms || 0) / 100 + Number(db.errorBudgetBurnRate || 0) * 10 + Number(db.replicationLagSeconds || 0);
    return {
      database: db.name || db.database,
      score: Math.round(score * 10) / 10,
      status: score >= 30 ? "critical" : score >= 15 ? "degraded" : "healthy",
    };
  }).sort((a, b) => b.score - a.score);
  return {
    usp: "fleet_health_scorecard",
    scorecard,
    source: "analysis",
  };
}

function indexHypothesisGenerator(_context, args = {}) {
  const sql = normalizeText(args.sql || args.query || "");
  const where = (sql.match(/\bwhere\b(.+?)(\border\b|\blimit\b|$)/i) || [])[1] || "";
  const columns = [...where.matchAll(/\b([a-zA-Z_][a-zA-Z0-9_]*)\s*(=|>|<|>=|<=|in\b|like\b)/gi)]
    .map((match) => match[1])
    .filter((column) => !["and", "or"].includes(column.toLowerCase()));
  return {
    usp: "index_hypothesis_generator",
    hypotheses: [{
      table: args.table || "target_table",
      columns: [...new Set(columns)].slice(0, 4),
      reason: "predicate_columns_from_where_clause",
      validationPlan: ["explain_query", "index_roi_simulator", "benchmark_ab_runner"],
    }],
    source: "analysis",
  };
}

function developerSqlCoach(context, args = {}) {
  const review = sqlCodeReviewAssistant(context, args);
  const actionItems = review.reviewComments.map((comment) => comment.id === "select_star" ? "avoid_select_star" : `review_${comment.id}`);
  return {
    usp: "developer_sql_coach",
    developerLevel: args.developerLevel || "intermediate",
    lesson: review.reviewComments.length
      ? `Main lesson: ${review.reviewComments[0].comment}`
      : "Query looks clean; validate with EXPLAIN for real workload behavior.",
    actionItems,
    source: "analysis",
  };
}

function environmentDriftDetector(_context, args = {}) {
  const environments = Array.isArray(args.environments) ? args.environments : [];
  const baseline = environments[0] || { settings: {} };
  const driftFindings = [];
  for (const env of environments.slice(1)) {
    for (const [setting, value] of Object.entries(env.settings || {})) {
      if ((baseline.settings || {})[setting] !== value) {
        driftFindings.push({ environment: env.name, setting, baseline: baseline.settings?.[setting], actual: value });
      }
    }
  }
  return {
    usp: "environment_drift_detector",
    driftStatus: driftFindings.length ? "drift_detected" : "aligned",
    driftFindings,
    source: "analysis",
  };
}

function queryPlanNarrator(_context, args = {}) {
  const nodes = normalizePlanInput(args.plan || args.executionPlan || {});
  const first = nodes[0] || {};
  const nodeType = normalizeText(first["Node Type"] || first.PhysicalOp || "unknown operator");
  const relation = normalizeText(first["Relation Name"] || first.Table || "unknown relation");
  const actualRows = numericPlanValue(first, ["Actual Rows", "ActualRows"]);
  const plannedRows = numericPlanValue(first, ["Plan Rows", "EstimatedRows"]);
  return {
    usp: "query_plan_narrator",
    story: `${nodeType} on ${relation} read ${actualRows || "unknown"} rows versus ${plannedRows || "unknown"} planned rows.`,
    actions: ["run_plan_deep_diagnostics", "compare_plan_regression", "benchmark_candidate_fix"],
    source: "analysis",
  };
}

function sloPolicyCompiler(_context, args = {}) {
  return {
    usp: "slo_policy_compiler",
    policy: {
      service: args.service || "database_service",
      p95Ms: Number(args.p95Ms || 300),
      errorBudgetBurnRate: Number(args.errorBudgetBurnRate || 1),
    },
    guardrails: ["block_unbenchmarked_high_risk_changes", "require_rollback_plan", "route_slo_breaches_to_incident_timeline"],
    source: "analysis",
  };
}

function indexRetirementPlanner(_context, args = {}) {
  const retirementCandidates = (Array.isArray(args.indexes) ? args.indexes : [])
    .filter((index) => Number(index.reads || 0) === 0 && Number(index.writes || 0) > 0 && Number(index.lastUsedDays || 0) >= 30)
    .map((index) => ({ name: index.name, writes: Number(index.writes || 0), lastUsedDays: Number(index.lastUsedDays || 0), action: "disable_then_drop" }));
  return {
    usp: "index_retirement_planner",
    retirementCandidates,
    safetySteps: ["disable_first_if_supported", "monitor_after_disable", "drop_after_observation_window"],
    source: "analysis",
  };
}

function hotfixRiskAssessor(_context, args = {}) {
  const change = normalizeText(args.change || "");
  const risks = [];
  if (!args.hasRollback && !args.rollback) risks.push("missing_rollback");
  if (/alter\s+table/i.test(change)) risks.push("schema_lock_risk");
  if (/not\s+null|default/i.test(change)) risks.push("backfill_risk");
  const production = String(args.environment || "").toLowerCase() === "production";
  return {
    usp: "hotfix_risk_assessor",
    risks,
    decision: production && risks.length ? "block" : risks.length ? "review" : "allow",
    source: "analysis",
  };
}

function tenantNoisyNeighborDetector(_context, args = {}) {
  const tenants = (Array.isArray(args.tenants) ? args.tenants : []).map((tenant) => ({
    ...tenant,
    pressureScore: Number(tenant.cpuMs || 0) + Number(tenant.reads || 0) / 10 + Number(tenant.calls || 0),
  })).sort((a, b) => b.pressureScore - a.pressureScore);
  const median = tenants.length ? tenants[Math.floor(tenants.length / 2)].pressureScore || 1 : 1;
  return {
    usp: "tenant_noisy_neighbor_detector",
    noisyTenants: tenants.filter((tenant) => tenant.pressureScore >= median * 5).slice(0, 5),
    actions: ["isolate_or_rate_limit_hot_tenant", "inspect_tenant_query_families", "consider_tenant_aware_indexes"],
    source: "analysis",
  };
}

function partitionStrategyAdvisor(_context, args = {}) {
  const rowCount = Number(args.rowCount || 0);
  const timeColumn = args.timeColumn || args.dateColumn || null;
  const type = timeColumn && rowCount > 10000000 ? "range_time" : rowCount > 10000000 ? "hash_or_list" : "no_partitioning_needed";
  return {
    usp: "partition_strategy_advisor",
    table: args.table || "target_table",
    strategy: {
      type,
      partitionKey: type === "range_time" ? [timeColumn] : [],
      cadence: Number(args.dailyGrowthRows || 0) > 1000000 ? "daily_or_weekly" : "monthly",
    },
    source: "analysis",
  };
}

function statisticsHealthDoctor(_context, args = {}) {
  const findings = (Array.isArray(args.stats) ? args.stats : []).filter((stat) =>
    Number(stat.ageHours || 0) >= 24 || Number(stat.modificationPct || 0) >= 20)
    .map((stat) => ({ id: "stale_statistics", table: stat.table, column: stat.column, ageHours: Number(stat.ageHours || 0), modificationPct: Number(stat.modificationPct || 0) }));
  return {
    usp: "statistics_health_doctor",
    findings,
    actions: findings.length ? ["run_analyze_or_update_statistics", "verify_cardinality_estimates"] : ["continue_monitoring"],
    source: "analysis",
  };
}

function connectionPoolAdvisor(_context, args = {}) {
  const maxConnections = Number(args.maxConnections || 1);
  const activeConnections = Number(args.activeConnections || 0);
  const utilization = activeConnections / maxConnections;
  const waitMs = Number(args.waitMs || 0);
  return {
    usp: "connection_pool_advisor",
    status: utilization >= 0.9 || waitMs > 1000 ? "pool_pressure" : "healthy",
    utilization: Math.round(utilization * 1000) / 10,
    actions: utilization >= 0.9 || waitMs > 1000 ? ["tune_pool_size_or_reduce_connection_hold_time", "find_long_transactions"] : ["continue_monitoring"],
    source: "analysis",
  };
}

function backupRestoreReadinessGuard(_context, args = {}) {
  const findings = [];
  const missingEvidence = [];
  const invalidEvidence = [];
  const evidence = {};
  const fields = {
    lastBackupAgeHours: false,
    lastRestoreTestDays: false,
    rpoHours: true,
    maxRestoreTestAgeDays: true,
    restoreDurationHours: false,
    rtoHours: true,
  };
  for (const [field, positive] of Object.entries(fields)) {
    const value = args[field];
    evidence[field] = null;
    if (value === undefined || value === null) {
      missingEvidence.push(field);
    } else if (typeof value !== "number" || !Number.isFinite(value) || (positive ? value <= 0 : value < 0)) {
      invalidEvidence.push(field);
    } else {
      evidence[field] = value;
    }
  }
  evidence.restoreTestSucceeded = null;
  if (args.restoreTestSucceeded === undefined || args.restoreTestSucceeded === null) {
    missingEvidence.push("restoreTestSucceeded");
  } else if (typeof args.restoreTestSucceeded !== "boolean") {
    invalidEvidence.push("restoreTestSucceeded");
  } else {
    evidence.restoreTestSucceeded = args.restoreTestSucceeded;
    if (!args.restoreTestSucceeded) findings.push("restore_test_failed");
  }
  if (evidence.lastBackupAgeHours !== null && evidence.rpoHours !== null && evidence.lastBackupAgeHours > evidence.rpoHours) findings.push("backup_older_than_rpo");
  if (evidence.lastRestoreTestDays !== null && evidence.maxRestoreTestAgeDays !== null && evidence.lastRestoreTestDays > evidence.maxRestoreTestAgeDays) findings.push("restore_test_stale");
  if (evidence.restoreDurationHours !== null && evidence.rtoHours !== null && evidence.restoreDurationHours > evidence.rtoHours) findings.push("restore_exceeds_rto");
  if (missingEvidence.length) findings.push("missing_evidence");
  if (invalidEvidence.length) findings.push("invalid_evidence");
  const status = missingEvidence.length === Object.keys(fields).length + 1 ? "not_assessed" : findings.length ? "not_ready" : "ready";
  return {
    usp: "backup_restore_readiness_guard",
    status,
    findings,
    missingEvidence,
    invalidEvidence,
    evidence,
    provenance: "user_supplied_not_verified",
    executionAuthorized: false,
    actions: status === "ready" ? ["keep_restore_rehearsal_schedule"] : ["supply_valid_backup_restore_evidence", "run_restore_rehearsal", "refresh_backup_chain"],
    source: "analysis",
  };
}

function vendorFeatureMapper(_context, args = {}) {
  const capability = safeLower(args.capability || "");
  const coverageMap = [
    ...(capability.includes("schema") ? [{ competitorCapability: "schema compare", pluginTool: "schema_compare_intelligence" }] : []),
    ...(capability.includes("monitor") ? [{ competitorCapability: "monitoring", pluginTool: "observability_signal_router" }] : []),
    ...(capability.includes("devops") || capability.includes("migration") ? [{ competitorCapability: "database devops", pluginTool: "vendor_neutral_devops_brain" }] : []),
  ];
  return {
    usp: "vendor_feature_mapper",
    vendor: args.vendor || "unknown",
    coverageMap: coverageMap.length ? coverageMap : [{ competitorCapability: "general database tooling", pluginTool: "autonomous_dba_copilot" }],
    pluginDifferentiators: ["ai_evidence_pack", "policy_gated_self_healing", "advisor_memory", "slo_aware_change_control"],
    source: "analysis",
  };
}

function advisorFeedbackLoop(context, args = {}) {
  const before = Number(args.beforeP95Ms || 0);
  const after = Number(args.afterP95Ms || 0);
  const improved = before > 0 && after > 0 ? after < before : Boolean(args.applied);
  const improvementPct = before > 0 ? Math.round(((before - after) / before) * 1000) / 10 : 0;
  const confidenceDelta = improved ? Math.min(0.3, Math.max(0.05, improvementPct / 100)) : -0.1;
  const outcome = { improved, improvementPct, applied: Boolean(args.applied) };
  remember(context, "advisorFeedback", {
    recommendationId: args.recommendationId || "unknown",
    outcome,
    confidenceDelta,
  });
  return {
    usp: "advisor_feedback_loop",
    outcome,
    learning: {
      confidenceDelta,
      nextConfidence: Math.max(0, Math.min(1, Number(args.priorConfidence || 0.5) + confidenceDelta)),
    },
    source: "runtime",
  };
}

function benchmarkAbRunner(_context, args = {}) {
  const baseline = args.baseline || {};
  const candidate = args.candidate || {};
  const delta = {
    p95Ms: Number(candidate.p95Ms || 0) - Number(baseline.p95Ms || 0),
    cpuMs: Number(candidate.cpuMs || 0) - Number(baseline.cpuMs || 0),
    rows: Number(candidate.rows || 0) - Number(baseline.rows || 0),
  };
  const winner = delta.p95Ms < 0 && delta.cpuMs <= 0 ? "candidate" : delta.p95Ms > 0 ? "baseline" : "tie";
  return {
    usp: "benchmark_ab_runner",
    baseline,
    candidate,
    delta,
    winner,
    source: "analysis",
  };
}

function workloadImpactAnalyzer(_context, args = {}) {
  const topImpactQueries = (args.queries || []).map((query) => ({
    ...query,
    impactScore: Number(query.calls || 1) * (Number(query.p95Ms || 0) + Number(query.cpuMs || 0)),
  })).sort((a, b) => b.impactScore - a.impactScore);
  const hotspots = [];
  if (topImpactQueries.some((query) => Number(query.calls || 0) > 1000)) {
    hotspots.push("high_call_volume");
  }
  if (topImpactQueries.some((query) => Number(query.p95Ms || 0) > 500)) {
    hotspots.push("tail_latency");
  }
  return {
    usp: "workload_impact_analyzer",
    topImpactQueries,
    hotspots: hotspots.length ? hotspots : ["no_major_hotspot"],
    source: "analysis",
  };
}

async function consultantBrain(context, args = {}) {
  const diagnosis = sqlProblemDetector(context, args);
  const recommendations = diagnosis.findings.map((finding) => ({
    id: finding.id === "select_star" ? "narrow_projection" : finding.id,
    impact: finding.severity === "high" ? "high" : "medium",
    risk: "low",
    effort: finding.id === "function_on_predicate" ? "medium" : "low",
    rationale: finding.recommendation,
  }));
  const ranked = recommendationRanker(context, { recommendations }).rankedRecommendations;
  const top = ranked[0] || { id: "collect_live_evidence", rationale: "run live explain and workload analysis first" };
  return {
    usp: "consultant_brain",
    answer: {
      summary: diagnosis.findings.map((finding) => finding.id).join(", "),
      recommendation: top.rationale || top.id,
      nextTest: args.sql ? "run explain_query with the same database/schema context" : "capture SQL text and live workload stats",
      confidence: diagnosis.findings.some((finding) => finding.severity === "high") ? "high" : diagnosis.findings.length > 1 ? "medium" : "low",
    },
    evidence: diagnosis.evidence,
    source: "analysis",
  };
}

async function sqlPerformanceAdvisor(context, args = {}) {
  const diagnosis = sqlProblemDetector(context, args);
  const benchmark = args.baseline && args.candidate ? benchmarkAbRunner(context, args) : null;
  const recommendations = diagnosis.findings.map((finding) => ({
    id: finding.id === "select_star" ? "narrow_projection" : finding.id,
    impact: finding.severity === "high" ? "high" : "medium",
    risk: finding.severity === "high" ? "medium" : "low",
    effort: finding.id === "select_star" ? "low" : "medium",
  }));
  if (benchmark?.winner === "candidate") {
    recommendations.push({ id: "promote_candidate", impact: "high", risk: "low", effort: "low" });
  }
  const rankedRecommendations = recommendationRanker(context, { recommendations }).rankedRecommendations;
  const consultant = await consultantBrain(context, args);
  const advancedSignals = {
    planRegression: args.snapshots ? planRegressionWatch(context, args) : null,
    parameterSensitivity: args.executions ? parameterSensitivityGuard(context, args) : null,
    sloImpact: args.sloTargetMs ? sloImpactGuard(context, args) : null,
    queryClusters: args.queries ? queryFingerprintClusterer(context, args) : null,
    dataSkew: args.distribution ? dataSkewDetector(context, args) : null,
    cacheEfficiency: args.bufferHitRatio || args.cacheHitRatio ? cacheEfficiencyAdvisor(context, args) : null,
    capacityHeadroom: args.maxSizeGb ? capacityHeadroomForecast(context, args) : null,
    evidencePack: args.includeEvidencePack ? evidencePackGenerator(context, args) : null,
    confidence: advisorConfidenceGrader(context, { evidence: args.evidence || {} }),
    autonomousLoop: args.autonomous ? await autonomousDbaCopilot(context, args) : null,
  };
  return {
    usp: "sql_performance_advisor",
    diagnosis,
    rankedRecommendations,
    benchmark,
    advancedSignals,
    consultantAnswer: consultant.answer,
    evidenceChain: [
      "sql_problem_detector",
      "recommendation_ranker",
      "consultant_brain",
      ...(advancedSignals.planRegression ? ["plan_regression_watch"] : []),
      ...(advancedSignals.parameterSensitivity ? ["parameter_sensitivity_guard"] : []),
      ...(advancedSignals.sloImpact ? ["slo_impact_guard"] : []),
      ...(advancedSignals.queryClusters ? ["query_fingerprint_clusterer"] : []),
      ...(advancedSignals.dataSkew ? ["data_skew_detector"] : []),
      ...(advancedSignals.cacheEfficiency ? ["cache_efficiency_advisor"] : []),
      ...(advancedSignals.capacityHeadroom ? ["capacity_headroom_forecast"] : []),
      ...(advancedSignals.evidencePack ? ["evidence_pack_generator"] : []),
      "advisor_confidence_grader",
      ...(advancedSignals.autonomousLoop ? ["autonomous_dba_copilot"] : []),
    ],
    source: "analysis",
  };
}

function normalizeAutonomyDecision(score, requestedMode = "dry_run", riskLevel = "low") {
  const mode = safeLower(requestedMode || "dry_run");
  const risk = safeLower(riskLevel || "low");
  if (mode === "apply" || mode === "production_apply") return "approval_required";
  if (risk === "critical") return "do_not_proceed";
  if (risk === "high") return "approval_required";
  if (Number(score || 0) < 0.55) return "needs_more_evidence";
  return "dry_run_ready";
}

function confidenceScoreFromEvidence(evidence = {}) {
  const weights = {
    hasLivePlan: 0.25,
    hasBenchmark: 0.2,
    hasWaits: 0.15,
    hasRollback: 0.2,
    hasTelemetry: 0.1,
    hasTenantScope: 0.1,
  };
  const score = Object.entries(weights).reduce((sum, [key, weight]) => sum + (evidence[key] ? weight : 0), 0);
  return Number(Math.min(1, score).toFixed(2));
}

function missingEvidenceFrom(evidence = {}) {
  return [
    !evidence.hasLivePlan ? "live_plan" : null,
    !evidence.hasBenchmark ? "benchmark" : null,
    !evidence.hasWaits ? "wait_events" : null,
    !evidence.hasRollback ? "rollback_plan" : null,
    !evidence.hasTelemetry ? "telemetry" : null,
  ].filter(Boolean);
}

function objectiveToOpsPlan(_context, args = {}) {
  const objective = normalizeText(args.objective || args.goal || "stabilize database service");
  const service = args.service || "database_service";
  const sloTargetMs = Number(args.sloTargetMs || args.p95Ms || 300);
  return {
    usp: "objective_to_ops_plan",
    objective,
    autonomyMode: "closed_loop_dry_run",
    measurableObjectives: [
      { metric: "p95Ms", target: sloTargetMs, service },
      { metric: "errorBudgetBurnRate", target: Number(args.errorBudgetBurnRate || 1), service },
      { metric: "monthlyCost", target: Number(args.monthlyCost || args.costBudget || 0), service },
    ].filter((item) => item.target > 0),
    guardrails: ["no_production_apply", "no_real_ddl_execution", "human_approval_for_high_risk", "rollback_evidence_required"],
    candidateWorkflows: [
      "sql_performance_advisor",
      "workload_twin",
      "autonomous_verification_loop",
      "production_rollout_orchestrator",
      "policy_gated_self_healing",
    ],
    decision: "needs_more_evidence",
    safeNextAction: { id: "collect_baseline_evidence", mode: "dry_run", tool: "sql_performance_advisor" },
    source: "analysis",
  };
}

function autonomousExperimentPlanner(_context, args = {}) {
  const objective = normalizeText(args.objective || "improve database reliability");
  const table = args.table || "target_table";
  const experiments = [
    { id: "query_rewrite_lab", tool: "ai_query_rewrite_lab", mode: "dry_run", hypothesis: "query shape can reduce IO without semantic drift" },
    { id: "index_simulation", tool: "index_roi_simulator", mode: "dry_run", hypothesis: `index alternatives for ${table} improve p95 without high write cost` },
    { id: "workload_twin", tool: "workload_twin", mode: "dry_run", hypothesis: "traffic and index scenario remains inside SLO budget" },
    { id: "rollout_gate_simulation", tool: "production_rollout_orchestrator", mode: "dry_run", hypothesis: "release gates expose blockers before apply" },
  ];
  return {
    usp: "autonomous_experiment_planner",
    objective,
    executionMode: "closed_loop_dry_run",
    experiments,
    abortCriteria: ["requires_real_apply", "missing_rollback", "high_risk_without_approval", "tenant_scope_unknown"],
    decision: "dry_run_ready",
    evidence: { experimentCount: experiments.length, sqlFingerprint: args.sql ? sha256(args.sql) : null },
    confidence: { score: 0.68, level: "medium" },
    safeNextAction: experiments[0],
    source: "analysis",
  };
}

function counterfactualRiskEngine(_context, args = {}) {
  const proposedChange = normalizeText(args.proposedChange || args.change || "candidate_change");
  const scenarios = [
    { id: "do_nothing", expectedP95DeltaMs: null, riskScore: null, outcome: "requires_baseline_observation" },
    { id: "dry_run_change", expectedP95DeltaMs: null, riskScore: null, outcome: "requires_controlled_comparison" },
    { id: "rollback_path", expectedP95DeltaMs: null, riskScore: null, outcome: "requires_rollback_rehearsal" },
    { id: "defer", expectedP95DeltaMs: null, riskScore: null, outcome: "requires_follow_up_observation" },
  ];
  const decision = "needs_more_evidence";
  return {
    usp: "counterfactual_risk_engine",
    proposedChange,
    scenarios,
    recommendedScenario: null,
    decision,
    evidence: { scenarioCount: scenarios.length, proposedChangeFingerprint: sha256(proposedChange) },
    confidence: { score: null, level: "not_assessed", basis: "no_measured_counterfactual" },
    safeNextAction: { id: "validate_counterfactual_with_workload_twin", mode: "dry_run", tool: "workload_twin" },
    source: "analysis",
  };
}

function decisionEvidenceCompiler(_context, args = {}) {
  const objective = normalizeText(args.objective || "database operating decision");
  const evidence = args.evidence || {};
  const grade = advisorConfidenceGrader(_context, { evidence });
  const missingEvidence = missingEvidenceFrom(evidence);
  const score = confidenceScoreFromEvidence(evidence);
  return {
    usp: "decision_evidence_compiler",
    executivePacket: {
      summary: `Decision evidence for ${objective}`,
      decisionOptions: ["dry_run_ready", "needs_more_evidence", "approval_required", "do_not_proceed"],
      evidenceGrade: grade.grade,
      missingEvidence,
    },
    decision: normalizeAutonomyDecision(score, "dry_run", args.riskLevel || "low"),
    evidence: {
      supplied: evidence,
      compiledFrom: ["advisor_confidence_grader", "autonomous_verification_loop", "telemetry_correlation"],
    },
    missingEvidence,
    confidence: { score, level: score >= 0.75 ? "high" : score >= 0.55 ? "medium" : "low" },
    safeNextAction: { id: missingEvidence[0] ? `collect_${missingEvidence[0]}` : "prepare_dry_run_briefing", mode: "dry_run" },
    source: "analysis",
  };
}

function confidenceBudgetManager(_context, args = {}) {
  const evidence = args.evidence || {};
  const score = confidenceScoreFromEvidence(evidence);
  const threshold = Number(args.threshold || 0.7);
  const missingEvidence = missingEvidenceFrom(evidence);
  const decision = score >= threshold ? "dry_run_ready" : "needs_more_evidence";
  return {
    usp: "confidence_budget_manager",
    confidenceBudget: {
      score,
      threshold,
      remainingGap: Number(Math.max(0, threshold - score).toFixed(2)),
      status: score >= threshold ? "sufficient_for_dry_run_recommendation" : "evidence_budget_not_met",
    },
    decision,
    evidence: { supplied: evidence },
    missingEvidence,
    confidence: { score, level: score >= 0.75 ? "high" : score >= 0.55 ? "medium" : "low" },
    safeNextAction: { id: missingEvidence[0] ? `collect_${missingEvidence[0]}` : "compile_decision_packet", mode: "dry_run" },
    source: "analysis",
  };
}

function autonomyBoundaryEnforcer(_context, args = {}) {
  const requestedAction = normalizeText(args.requestedAction || args.action || "unknown_action");
  const executionMode = safeLower(args.executionMode || args.mode || "dry_run");
  const environment = safeLower(args.environment || "lab");
  const productionApply = environment === "production" && executionMode === "apply";
  const realApply = executionMode === "apply" || /apply|execute|create|drop|alter/i.test(requestedAction);
  const allowedAutonomousExecution = !productionApply && executionMode !== "apply";
  return {
    usp: "autonomy_boundary_enforcer",
    requestedAction,
    boundary: {
      autonomyMode: "closed_loop_dry_run",
      allowedAutonomousExecution,
      prohibitedActions: ["production_apply", "real_ddl_execution", "unapproved_high_risk_change"],
    },
    requiredApprovals: productionApply || realApply ? ["human_operator", "db_owner"] : [],
    decision: productionApply || realApply ? "approval_required" : "dry_run_ready",
    evidence: { environment, executionMode },
    confidence: { score: 0.9, level: "high" },
    safeNextAction: { id: "convert_to_dry_run", mode: "dry_run", originalAction: requestedAction },
    source: "analysis",
  };
}

function operatorGoalMonitor(_context, args = {}) {
  const service = args.service || "database_service";
  const goals = args.goals || {};
  const watchCriteria = [
    goals.p95Ms ? { metric: "p95Ms", operator: "<=", threshold: Number(goals.p95Ms), service } : null,
    goals.monthlyCost ? { metric: "monthlyCost", operator: "<=", threshold: Number(goals.monthlyCost), service } : null,
    goals.maxIncidentSeverity ? { metric: "incidentSeverity", operator: "<=", threshold: goals.maxIncidentSeverity, service } : null,
    goals.errorBudgetBurnRate ? { metric: "errorBudgetBurnRate", operator: "<=", threshold: Number(goals.errorBudgetBurnRate), service } : null,
  ].filter(Boolean);
  return {
    usp: "operator_goal_monitor",
    service,
    watchCriteria: watchCriteria.length ? watchCriteria : [{ metric: "p95Ms", operator: "<=", threshold: 300, service }],
    escalationPolicy: {
      low: "continue_closed_loop_monitoring",
      medium: "open_dry_run_experiment",
      high: "human_operator_review",
    },
    decision: "dry_run_ready",
    evidence: { goalCount: watchCriteria.length },
    confidence: { score: 0.74, level: "medium" },
    safeNextAction: { id: "schedule_goal_watch", mode: "dry_run", tool: "telemetry_correlation" },
    source: "analysis",
  };
}

function dryRunActionCritic(_context, args = {}) {
  const evidence = args.evidence || {};
  const criticisms = [];
  if (!args.hasRollback && !evidence.hasRollback) criticisms.push("rollback_gap");
  if (!args.tenantScoped && !evidence.hasTenantScope) criticisms.push("tenant_blast_radius_unknown");
  if (!evidence.hasLivePlan) criticisms.push("live_plan_missing");
  if (/drop|truncate|delete|alter/i.test(String(args.proposedAction || ""))) criticisms.push("destructive_or_schema_change_risk");
  const decision = criticisms.includes("destructive_or_schema_change_risk")
    ? "approval_required"
    : criticisms.length ? "needs_more_evidence" : "dry_run_ready";
  return {
    usp: "dry_run_action_critic",
    proposedAction: args.proposedAction || "candidate_action",
    criticisms,
    decision,
    evidence: { criticismCount: criticisms.length, supplied: evidence },
    confidence: { score: criticisms.length ? 0.52 : 0.78, level: criticisms.length ? "low" : "high" },
    safeNextAction: { id: criticisms[0] ? `resolve_${criticisms[0]}` : "proceed_to_dry_run_experiment", mode: "dry_run" },
    source: "analysis",
  };
}

function nextBestSafeAction(_context, args = {}) {
  const candidates = Array.isArray(args.candidates) && args.candidates.length
    ? args.candidates
    : [
        { id: "run_sql_performance_advisor", action: "collect advisor diagnosis", risk: "low", mode: "dry_run", tool: "sql_performance_advisor" },
        { id: "run_workload_twin", action: "simulate workload scenario", risk: "low", mode: "dry_run", tool: "workload_twin" },
      ];
  const safeCandidates = candidates.filter((candidate) =>
    safeLower(candidate.mode || "dry_run") !== "apply" &&
    safeLower(candidate.risk || "low") !== "high" &&
    !/apply|execute production|drop|truncate/i.test(String(candidate.action || candidate.id || ""))
  );
  const safeNextAction = safeCandidates[0] || { id: "collect_more_evidence", action: "collect more evidence", risk: "low", mode: "dry_run" };
  return {
    usp: "next_best_safe_action",
    objective: args.objective || "database operating objective",
    safeNextAction,
    rejectedActions: candidates.filter((candidate) => candidate !== safeNextAction && !safeCandidates.includes(candidate)).map((candidate) => candidate.id),
    decision: safeNextAction.id === "collect_more_evidence" ? "needs_more_evidence" : "dry_run_ready",
    evidence: { candidateCount: candidates.length, safeCandidateCount: safeCandidates.length },
    confidence: { score: safeCandidates.length ? 0.76 : 0.45, level: safeCandidates.length ? "medium" : "low" },
    source: "analysis",
  };
}

async function autonomousOpsBriefing(context, args = {}) {
  const objective = normalizeText(args.objective || "database operating objective");
  const evidencePacket = decisionEvidenceCompiler(context, args);
  const nextAction = nextBestSafeAction(context, args);
  const boundary = autonomyBoundaryEnforcer(context, { ...args, executionMode: args.executionMode || "dry_run" });
  const decision = boundary.decision === "approval_required"
    ? "approval_required"
    : evidencePacket.decision === "dry_run_ready" && nextAction.decision === "dry_run_ready"
      ? "dry_run_ready"
      : "needs_more_evidence";
  return {
    usp: "autonomous_ops_briefing",
    boardSummary: `Autonomous Database Operations without autonomous production risk: ${objective}`,
    decision,
    evidence: {
      executivePacket: evidencePacket.executivePacket,
      boundary: boundary.boundary,
      rejectedActions: nextAction.rejectedActions,
    },
    confidence: evidencePacket.confidence,
    risks: [
      ...(evidencePacket.missingEvidence || []).map((item) => `missing_${item}`),
      ...(boundary.requiredApprovals.length ? ["approval_required_for_requested_boundary"] : []),
    ],
    safeNextAction: nextAction.safeNextAction,
    source: "analysis",
  };
}

async function aiStrategySynthesizer(_context, args = {}) {
  const objective = normalizeText(args.objective || "AI-native database operations");
  const priorities = Array.isArray(args.priorities) && args.priorities.length
    ? args.priorities.map(normalizeText)
    : ["latency", "governance", "cost"];
  const roadmap = [
    { phase: "sense", capability: "unify telemetry, query plans, policy, and cost evidence", owner: "platform_team" },
    { phase: "reason", capability: "score recommendations with explainability and confidence budgets", owner: "ai_ops_lead" },
    { phase: "simulate", capability: "run dry-run workload, rollout, and counterfactual experiments", owner: "dba_sre_pair" },
    { phase: "govern", capability: "convert AI decisions into approval-ready packets", owner: "change_advisory_board" },
  ];
  return {
    usp: "ai_strategy_synthesizer",
    positioning: "AI database intelligence layer for enterprise platform teams",
    objective,
    maturity: normalizeText(args.maturity || "pilot"),
    priorities,
    roadmap,
    guardrails: ["closed_loop_dry_run", "no_production_apply", "human_approval_for_change", "audit_ready_evidence"],
    recommendations: priorities.map((priority) => `AI control loop for ${priority}`),
    evidence: ["business_objective", "platform_priorities", "existing_codexdb_primitives"],
    confidence: { score: 0.74, level: "medium" },
    source: "analysis",
  };
}

async function cognitiveSchemaMapper(_context, args = {}) {
  const tables = Array.isArray(args.tables) && args.tables.length ? args.tables.map(normalizeText) : ["orders", "customers"];
  const domainTerms = Array.isArray(args.domainTerms) ? args.domainTerms.map(normalizeText) : [];
  const entities = tables.map((table) => ({
    name: table,
    semanticRole: table.includes("order") ? "transaction" : table.includes("customer") ? "party" : table.includes("payment") ? "money_movement" : "domain_entity",
    likelyMetrics: table.includes("order") ? ["conversion", "checkout_latency"] : table.includes("payment") ? ["revenue", "authorization_rate"] : ["volume", "freshness"],
  }));
  const mappedTerms = new Set(entities.flatMap((entity) => [entity.name, entity.semanticRole, ...entity.likelyMetrics]));
  const semanticGaps = domainTerms.filter((term) => !mappedTerms.has(term) && !tables.some((table) => table.includes(term)));
  return {
    usp: "cognitive_schema_mapper",
    ontology: { entities, relationships: tables.includes("orders") && tables.includes("customers") ? ["customers_to_orders"] : [] },
    semanticGaps,
    recommendations: semanticGaps.map((gap) => `add business glossary mapping for ${gap}`),
    evidence: ["schema_terms", "domain_terms", "deterministic_semantic_roles"],
    confidence: { score: semanticGaps.length ? 0.68 : 0.8, level: semanticGaps.length ? "medium" : "high" },
    source: "analysis",
  };
}

async function llmPromptRiskAuditor(_context, args = {}) {
  const prompt = normalizeText(args.prompt || "");
  const environment = normalizeText(args.environment || "lab");
  const risks = [];
  if (/\b(drop|delete|truncate|update all|alter|create index|apply)\b/i.test(prompt)) risks.push("destructive_intent");
  if (/\bproduction|prod\b/i.test(`${prompt} ${environment}`)) risks.push("production_scope");
  if (/\bfix|optimize|make it fast|do it\b/i.test(prompt)) risks.push("ambiguous_objective");
  if (!/\bwhere|tenant|limit|dry[- ]run|explain|simulate\b/i.test(prompt)) risks.push("missing_scope_controls");
  const decision = risks.includes("destructive_intent") || risks.includes("production_scope")
    ? "approval_required"
    : risks.length
      ? "needs_more_evidence"
      : "dry_run_ready";
  return {
    usp: "llm_prompt_risk_auditor",
    decision,
    risks,
    safeRewrite: "Convert the AI request into a dry-run diagnostic objective with explicit scope, tenant boundary, rollback proof, and approval gate.",
    evidence: ["prompt_text", "environment", "risk_keyword_scan"],
    confidence: { score: risks.length ? 0.78 : 0.7, level: "medium" },
    source: "analysis",
  };
}

async function aiDecisionSimulator(_context, args = {}) {
  const evidence = args.evidence || {};
  const requireHumanApproval = Boolean(args.policy && args.policy.requireHumanApproval);
  const score = confidenceScoreFromEvidence(evidence);
  const simulatedDecisions = [
    { id: "dry_run_diagnostic", outcome: "collect plan, waits, cost, and tenant evidence", score: null },
    { id: "defer_for_approval", outcome: "prepare decision packet for human review", score: null },
    { id: "reject_apply", outcome: "block real production apply from AI autonomy", score: null },
  ];
  if (!evidence.hasRollback) simulatedDecisions.push({ id: "rollback_gap", outcome: "require rollback rehearsal before recommendation", score: null });
  const decision = requireHumanApproval ? "approval_required" : normalizeAutonomyDecision({ score, mode: "dry_run" });
  return {
    usp: "ai_decision_simulator",
    proposedAction: normalizeText(args.proposedAction || "database action"),
    simulatedDecisions,
    decision,
    evidence: { confidenceEvidenceScore: score, policy: args.policy || {}, inputEvidence: evidence },
    confidence: { score: null, level: "not_assessed", basis: "rule_based_decision_options_not_predictions" },
    source: "analysis",
  };
}

async function autonomousLearningBacklog(_context, args = {}) {
  const outcomes = Array.isArray(args.outcomes) ? args.outcomes : [];
  const incidents = Array.isArray(args.incidents) ? args.incidents : [];
  const learningBacklog = [
    { id: "rollback-proof-learning", task: "learn which recommendations lack rollback evidence", priority: outcomes.some((item) => /rollback/i.test(JSON.stringify(item))) ? 95 : 72 },
    { id: "incident-pattern-learning", task: "cluster incident narratives into recurring database failure modes", priority: incidents.length ? 88 : 62 },
    { id: "confidence-calibration", task: "compare advisor confidence against observed outcomes", priority: 80 },
    { id: "prompt-risk-hardening", task: "turn unsafe AI prompts into governed dry-run templates", priority: 74 },
  ].sort((a, b) => b.priority - a.priority);
  return {
    usp: "autonomous_learning_backlog",
    executionMode: "analysis_only",
    learningBacklog,
    evidence: ["advisor_outcomes", "incident_feedback", "governance_gaps"],
    confidence: { score: outcomes.length || incidents.length ? 0.77 : 0.58, level: outcomes.length || incidents.length ? "medium" : "low" },
    source: "analysis",
  };
}

async function knowledgeGapDetector(_context, args = {}) {
  const evidence = args.evidence || {};
  const required = [
    ["hasSchema", "schema_context"],
    ["hasLivePlan", "live_execution_plan"],
    ["hasTelemetry", "telemetry_correlation"],
    ["hasPolicy", "policy_context"],
    ["hasRollback", "rollback_evidence"],
  ];
  const knowledgeGaps = required.filter(([key]) => !evidence[key]).map(([, label]) => label);
  return {
    usp: "knowledge_gap_detector",
    objective: normalizeText(args.objective || "AI database recommendation"),
    decision: knowledgeGaps.length ? "needs_more_evidence" : "dry_run_ready",
    knowledgeGaps,
    evidence: { provided: Object.keys(evidence), required: required.map(([, label]) => label) },
    safeNextAction: knowledgeGaps[0] ? { mode: "dry_run", action: `collect_${knowledgeGaps[0]}` } : { mode: "dry_run", action: "compile_decision_evidence" },
    confidence: { score: Number(((required.length - knowledgeGaps.length) / required.length).toFixed(2)), level: knowledgeGaps.length ? "medium" : "high" },
    source: "analysis",
  };
}

async function aiTrustScorecard(_context, args = {}) {
  const evidence = args.evidence || {};
  const dimensions = {
    explainability: evidence.hasExplanation ? 1 : 0.35,
    safety: evidence.hasRollback ? 0.85 : 0.35,
    reproducibility: evidence.hasReplay ? 0.9 : 0.4,
    governance: evidence.hasPolicy ? 0.9 : 0.3,
  };
  const total = Number((Object.values(dimensions).reduce((sum, value) => sum + value, 0) / 4).toFixed(2));
  return {
    usp: "ai_trust_scorecard",
    trustScore: { total, dimensions },
    decision: total >= 0.75 ? "dry_run_ready" : "needs_more_evidence",
    evidence: ["explainability", "safety", "reproducibility", "governance"],
    confidence: { score: total, level: total >= 0.75 ? "high" : "medium" },
    source: "analysis",
  };
}

async function semanticIncidentPredictor(_context, args = {}) {
  const signals = Array.isArray(args.signals) ? args.signals.map(normalizeText) : [];
  const joined = signals.join(" ");
  const predictions = [
    { incidentClass: "lock_contention", likelihood: null, matched: /\b(lock|deadlock|wait)\b/i.test(joined), evidence: "lock and wait keywords" },
    { incidentClass: "plan_regression", likelihood: null, matched: /\b(stale|statistics|plan|cardinality)\b/i.test(joined), evidence: "optimizer and statistics keywords" },
    { incidentClass: "tenant_hotspot", likelihood: null, matched: /\b(tenant|hot key|skew|noisy)\b/i.test(joined), evidence: "tenant and skew keywords" },
    { incidentClass: "cost_runaway", likelihood: null, matched: /\b(cost|scan|io|cpu)\b/i.test(joined), evidence: "resource pressure keywords" },
  ].sort((a, b) => Number(b.matched) - Number(a.matched));
  return {
    usp: "semantic_incident_predictor",
    workload: normalizeText(args.workload || "database workload"),
    predictions,
    decision: "needs_more_evidence",
    safeNextAction: { mode: "dry_run", action: predictions.some((p) => p.matched) ? `run_${predictions[0].incidentClass}_diagnostics` : "collect_scoped_telemetry" },
    confidence: { score: null, level: "not_assessed", basis: "keyword_triage_not_incident_probability" },
    source: "analysis",
  };
}

async function crossAgentConsensusBuilder(_context, args = {}) {
  const findings = Array.isArray(args.agentFindings) ? args.agentFindings : [];
  const groups = findings.reduce((acc, finding) => {
    const key = normalizeText(finding.recommendation || "collect more evidence");
    acc[key] = acc[key] || [];
    acc[key].push(finding);
    return acc;
  }, {});
  const sorted = Object.entries(groups).sort(([, a], [, b]) => b.length - a.length);
  const [topRecommendation = "collect more evidence", supporters = []] = sorted[0] || [];
  const disagreements = sorted.slice(1).map(([recommendation, agents]) => ({ recommendation, agents: agents.map((item) => item.agent || "agent") }));
  const averageConfidence = findings.length
    ? findings.reduce((sum, finding) => sum + Number(finding.confidence || 0.5), 0) / findings.length
    : 0.5;
  return {
    usp: "cross_agent_consensus_builder",
    consensus: {
      recommendation: topRecommendation,
      supportingAgents: supporters.map((item) => item.agent || "agent"),
      agreementRatio: findings.length ? Number((supporters.length / findings.length).toFixed(2)) : 0,
    },
    disagreements,
    decision: disagreements.length ? "needs_more_evidence" : "dry_run_ready",
    evidence: findings,
    confidence: { score: Number(averageConfidence.toFixed(2)), level: averageConfidence >= 0.75 ? "high" : "medium" },
    source: "analysis",
  };
}

async function aiRoiNarrativeGenerator(_context, args = {}) {
  const teamHours = args.teamHoursSavedMonthly ?? 0;
  const incidents = args.avoidedIncidents ?? 0;
  const costSavings = args.costSavingsMonthly ?? 0;
  const sloImprovement = args.sloImprovementPct ?? 0;
  const hourlyRate = args.hourlyRate;
  const incidentCost = args.incidentCost;
  for (const value of [teamHours, incidents, costSavings, sloImprovement]) {
    if (!Number.isFinite(value) || value < 0) throw new Error("Invalid ROI input");
  }
  for (const value of [hourlyRate, incidentCost]) {
    if (value !== undefined && (typeof value !== "number" || !Number.isFinite(value) || value < 0)) throw new Error("Invalid supplied unit cost");
  }
  const monthlyValueScore = (teamHours > 0 && hourlyRate === undefined) || (incidents > 0 && incidentCost === undefined)
    ? null : Number((teamHours * (hourlyRate ?? 0) + incidents * (incidentCost ?? 0) + costSavings).toFixed(2));
  return {
    usp: "ai_roi_narrative_generator",
    executiveNarrative: `AI database operations can convert expert DBA reasoning into repeatable dry-run decisions, reducing toil, incident exposure, and cost while keeping production control with humans.`,
    roiSignals: { teamHoursSavedMonthly: teamHours, avoidedIncidents: incidents, costSavingsMonthly: costSavings, sloImprovementPct: sloImprovement, monthlyValueScore },
    evidence: ["team_hours_saved", "avoided_incidents", "cost_savings", "slo_improvement"],
    assumptions: { hourlyRate: hourlyRate ?? null, incidentCost: incidentCost ?? null, source: "user_supplied_not_verified", sloMonetized: false },
    confidence: { score: null, level: "not_assessed" },
    source: "analysis",
  };
}

async function liveEvidenceSmokeProfile(_context, args = {}) {
  const engine = normalizeText(args.engine || "postgres");
  const evidence = args.evidence || {};
  const requiredEvidence = engine === "sqlserver"
    ? ["live_connection", "query_store_or_dmvs", "showplan_xml", "wait_stats", "lock_snapshot"]
    : ["live_connection", "pg_stat_statements", "explain_plan", "wait_events", "lock_snapshot"];
  const evidenceMap = {
    live_connection: evidence.hasLiveConnection,
    pg_stat_statements: evidence.hasPgStatStatements,
    explain_plan: evidence.hasExplainPlan,
    wait_events: evidence.hasWaitEvents,
    lock_snapshot: evidence.hasLockSnapshot,
    query_store_or_dmvs: evidence.hasQueryStore || evidence.hasDmvs,
    showplan_xml: evidence.hasShowplanXml || evidence.hasExplainPlan,
    wait_stats: evidence.hasWaitStats,
  };
  const missingEvidence = requiredEvidence.filter((item) => !evidenceMap[item]);
  return {
    usp: "live_evidence_smoke_profile",
    engine,
    decision: missingEvidence.length > requiredEvidence.length / 2 ? "needs_more_evidence" : "dry_run_ready",
    requiredEvidence,
    missingEvidence,
    smokeCommands: [
      "production_readiness_check",
      "query_stats",
      "explain_query",
      "telemetry_correlation",
    ],
    confidence: { score: Number(((requiredEvidence.length - missingEvidence.length) / requiredEvidence.length).toFixed(2)), level: missingEvidence.length ? "medium" : "high" },
    source: "analysis",
  };
}

async function formalContractCatalog(_context, args = {}) {
  const tools = Array.isArray(args.tools) && args.tools.length
    ? args.tools.map(normalizeText)
    : ["autonomous_ops_briefing", "llm_prompt_risk_auditor", "governance_proof_packet"];
  const contracts = tools.map((tool) => ({
    tool,
    version: "1.0",
    requiredOutputFields: ["usp", "source", "confidence"],
    governance: ["no_production_apply", "structured_output", "stable_contract"],
  }));
  return {
    usp: "formal_contract_catalog",
    decision: "dry_run_ready",
    contracts,
    evidence: ["runtime_tool_manifest", "tool_contracts_json", "deterministic_dispatch"],
    confidence: { score: 0.82, level: "high" },
    source: "analysis",
  };
}

async function governanceProofPacket(_context, args = {}) {
  const evidence = args.evidence || {};
  const policyDecision = normalizeText(args.policyDecision || "REQUIRES_APPROVAL").toUpperCase();
  const approvalRequired = policyDecision.includes("APPROVAL") || args.productionApplyRequested;
  return {
    usp: "governance_proof_packet",
    decision: approvalRequired ? "approval_required" : "dry_run_ready",
    proofPacket: {
      action: normalizeText(args.action || "database decision"),
      policyDecision,
      riskScore: evidence.hasRollback && evidence.hasPolicy ? 0.42 : 0.68,
      evidence: {
        rollbackProof: Boolean(evidence.hasRollback),
        policyContext: Boolean(evidence.hasPolicy),
        liveEvidence: Boolean(evidence.hasLivePlan || evidence.hasTelemetry),
      },
      requiredApprovals: approvalRequired ? ["human_operator", "change_owner"] : [],
      rollbackProof: evidence.hasRollback ? "present" : "missing",
      auditReady: Boolean(evidence.hasPolicy),
    },
    confidence: { score: evidence.hasRollback && evidence.hasPolicy ? 0.82 : 0.58, level: evidence.hasRollback && evidence.hasPolicy ? "high" : "medium" },
    source: "analysis",
  };
}

async function benchmarkRoiProof(_context, args = {}) {
  const baselineP95 = Number(args.baselineP95Ms || 0);
  const candidateP95 = Number(args.candidateP95Ms || baselineP95);
  const baselineCost = Number(args.baselineMonthlyCost || 0);
  const candidateCost = Number(args.candidateMonthlyCost || baselineCost);
  const latencyImprovementPct = baselineP95 > 0 ? Number((((baselineP95 - candidateP95) / baselineP95) * 100).toFixed(1)) : 0;
  const monthlyCostSavings = Number((baselineCost - candidateCost).toFixed(2));
  return {
    usp: "benchmark_roi_proof",
    decision: latencyImprovementPct > 0 || monthlyCostSavings > 0 ? "dry_run_ready" : "needs_more_evidence",
    roiProof: {
      baselineP95Ms: baselineP95,
      candidateP95Ms: candidateP95,
      latencyImprovementPct,
      baselineMonthlyCost: baselineCost,
      candidateMonthlyCost: candidateCost,
      monthlyCostSavings,
      proofType: "measured_before_after",
    },
    evidence: ["baseline_metrics", "candidate_metrics", "cost_delta"],
    confidence: { score: baselineP95 && candidateP95 ? 0.8 : 0.45, level: baselineP95 && candidateP95 ? "high" : "low" },
    source: "analysis",
  };
}

async function pilotSuccessPack(_context, args = {}) {
  const service = normalizeText(args.service || "representative_service");
  const engine = normalizeText(args.engine || "postgres");
  return {
    usp: "pilot_success_pack",
    service,
    engine,
    timelineMinutes: 30,
    steps: [
      { minute: 0, action: "confirm dry-run boundary and staging target" },
      { minute: 5, action: "run production_readiness_check" },
      { minute: 10, action: "run live_evidence_smoke_profile" },
      { minute: 15, action: "run autonomous_ops_briefing" },
      { minute: 22, action: "run visual_executive_report" },
      { minute: 28, action: "review pilot success criteria" },
    ],
    successCriteria: [
      "unsafe apply action is blocked",
      "missing evidence is explicit",
      "safe next action remains dry-run",
      "executive report is generated",
      "DBA/SRE owner accepts the governance boundary",
    ],
    source: "analysis",
  };
}

async function visualExecutiveReport(_context, args = {}) {
  const objective = normalizeText(args.objective || "database operations objective");
  const decision = normalizeText(args.decision || "needs_more_evidence");
  const confidence = args.confidence || { score: 0.72, level: "medium" };
  const risks = Array.isArray(args.risks) && args.risks.length ? args.risks : ["missing live benchmark evidence"];
  const nextAction = args.safeNextAction || { mode: "dry_run", action: "collect live evidence and compile governance proof" };
  const reportMarkdown = [
    "# Executive Database Operations Report",
    "",
    `## Objective`,
    objective,
    "",
    "## Decision",
    decision,
    "",
    "## Confidence",
    `${confidence.level || "medium"} (${confidence.score || 0.72})`,
    "",
    "## Key Risks",
    ...risks.map((risk) => `- ${risk}`),
    "",
    "## Safe Next Action",
    `- ${nextAction.mode}: ${nextAction.action}`,
  ].join("\n");
  return {
    usp: "visual_executive_report",
    decision,
    reportMarkdown,
    format: "markdown",
    confidence,
    source: "analysis",
  };
}

async function enterpriseSecurityProof(_context, args = {}) {
  const productionApplyRequested = Boolean(args.productionApplyRequested);
  const secretsRedacted = Boolean(args.secretsRedacted);
  const tenantScoped = Boolean(args.tenantScoped);
  return {
    usp: "enterprise_security_proof",
    decision: productionApplyRequested ? "approval_required" : secretsRedacted && tenantScoped ? "dry_run_ready" : "needs_more_evidence",
    securityBoundary: {
      zeroAutonomousWrite: true,
      noProductionApply: true,
      noRealDdlExecution: true,
      secretsRedacted,
      tenantScoped,
      humanApprovalForWrites: true,
    },
    proof: [
      "policy gate blocks high-risk write actions",
      "dry-run operator boundary rejects production apply",
      "secret-bearing connector outputs are redacted",
      "tenant scope is explicit before recommendation",
    ],
    confidence: { score: secretsRedacted && tenantScoped ? 0.86 : 0.62, level: secretsRedacted && tenantScoped ? "high" : "medium" },
    source: "analysis",
  };
}

async function competitiveBattlecards(_context, args = {}) {
  const competitors = Array.isArray(args.competitors) && args.competitors.length
    ? args.competitors.map(normalizeText)
    : ["generic_ai_copilot", "monitoring_tool", "sql_ide"];
  const battlecards = competitors.map((competitor) => {
    const positions = {
      generic_ai_copilot: ["CodexDB is deterministic, policy-aware, rollback-aware, and dry-run bounded.", "Generic AI may produce SQL; CodexDB produces governed database decisions."],
      monitoring_tool: ["Monitoring shows symptoms; CodexDB converts signals into decision evidence and safe next actions.", "CodexDB complements Grafana, Prometheus, SQL Sentry, and telemetry systems."],
      sql_ide: ["SQL IDEs help edit and inspect SQL; CodexDB governs AI-assisted operational decisions.", "CodexDB complements SSMS, DataGrip, dbForge, and SQL Prompt."],
    };
    return {
      competitor,
      buyerConcern: competitor.includes("ai") ? "unsafe autonomous recommendations" : "tooling overlap",
      differentiation: positions[competitor] || ["CodexDB adds closed-loop AI governance around database operations."],
      winningMessage: "AI-speed database operations with human-controlled production boundaries.",
    };
  });
  return {
    usp: "competitive_battlecards",
    decision: "dry_run_ready",
    battlecards,
    source: "analysis",
  };
}

async function agentCoordination(_context, args = {}) {
  const objective = normalizeText(args.objective || "database optimization task");
  const riskLevel = normalizeText(args.riskLevel || "LOW").toUpperCase();
  const policyDecision = {
    actionType: "agent_coordination",
    environment: args.environment || "lab",
    riskLevel,
    policyVersion: "1.0",
    requiredControls: riskLevel === "LOW" ? [] : ["human_review"],
    decision: riskLevel === "HIGH" || riskLevel === "CRITICAL" ? "REQUIRES_APPROVAL" : "ALLOW",
    reasonCodes: [],
  };
  const basePlan = orchestrateAgents(args.tool || "analyze_workload", riskLevel, policyDecision);
  return {
    objective,
    coordinationPlan: {
      selectedAgents: basePlan.selectedAgents,
      steps: basePlan.selectedAgents.map((agent, index) => ({
        order: index + 1,
        agent: agent.id,
        role: agent.role,
        task: `${agent.role} for ${objective}`,
      })),
      executionPlan: basePlan.executionPlan,
    },
    coordinationMode: "policy_gated_multi_agent",
    source: "mock",
  };
}

async function enforcePolicy(_context, args = {}) {
  return { result: classifyDecision(args.actionType, args.environment, args.riskLevel, args.database, args.schema), source: "mock" };
}

const toolHandlers = {
  process_trace_correlation: (_ctx, a) => diagnosticEvidence.correlateProcessTraces(a),
  business_outcome_measurement: (_ctx, a) => diagnosticEvidence.measureBusinessOutcome(a),
  collect_process_evidence: (ctx, a) => collectProcessEvidence(ctx, a),
  enterprise_approval_check: async (_ctx, a) => ({ usp: "enterprise_approval_check", ...await verifyEnterpriseApproval(a), executionAuthorized: false }),
  enterprise_audit_witness: async (_ctx, a) => ({ usp: "enterprise_audit_witness", ...await verifyEnterpriseAuditWitness(a), executionAuthorized: false }),
  live_context_fingerprint: (ctx, a) => collectContextFingerprint(ctx, a),
  live_workload_replay: (ctx, a) => replayWorkload(ctx, a),
  live_rewrite_verification: (ctx, a) => verifyRewrite(ctx, a),
  live_recommendation_check: async (ctx, a) => {
    const collected = await collectContextFingerprint(ctx, a);
    const validity = recommendationValidity(ctx, { ...a, action: "check", validityContext: collected.validityContext });
    return { ...validity, usp: "live_recommendation_check", collection: collected, continuousMonitoring: false };
  },
  diagnostic_session: (ctx, a) => diagnosticSession(ctx, a),
  diagnostic_test_result: (_ctx, a) => diagnosticEvidence.evaluateDiagnosticOutcome(a),
  business_impact_priority: (_ctx, a) => diagnosticEvidence.prioritizeBusinessImpact(a),
  outcome_evidence_gate: (_ctx, a) => diagnosticEvidence.outcomeEvidenceGate(a),
  recommendation_validity: (ctx, a) => recommendationValidity(ctx, a),
  admin_approval_check: (_ctx, a) => ({ usp: "admin_approval_check", source: "signed_issuer_attestation",
    ...verifyAdminApproval(a), executionAuthorized: false }),
  admin_preflight: (ctx, a) => adminPreflight(ctx, a),
  discover_database: (ctx, a) => inspectDatabase(ctx, a, "discover_database"),
  native_query_plan: (ctx, a) => inspectDatabase(ctx, a, "native_query_plan"),
  compare_native_plans: (_ctx, a) => compareNativePlans(a),
  compare_database_snapshots: (_ctx, a) => compareDatabaseSnapshots(a),
  compare_live_schemas: (ctx, a) => compareLiveSchemas(ctx, a),
  schema_contract_check: (_ctx, a) => schemaContractCheck(a),
  foreign_key_index_review: (_ctx, a) => foreignKeyIndexReview(a),
  duplicate_index_review: (_ctx, a) => duplicateIndexReview(a),
  database_engineer_brief: (ctx, a) => databaseEngineerBrief(ctx, a),
  consulting_project: (ctx, a) => ({ usp: "consulting_project", source: "local_project_records", ...require("./diagnosticEvidence").consultingProject(ctx, a) }),
  operational_window_compare: (_ctx, a) => require("./memoryLayer").operationalWindowCompare(a),
  blocking_timeline: (_ctx, a) => require("./memoryLayer").blockingTimeline(a),
  run_tuning_lab: (ctx, a) => require("./db/connector").runTuningLab(ctx, a),
  collect_tempdb_health: (ctx, a) => require("./db/connector").collectTempdbHealth(ctx, a),
  collect_replication_health: (ctx, a) => require("./db/connector").collectReplicationHealth(ctx, a),
  collect_blocking_frame: (ctx, a) => require("./db/connector").collectBlockingFrame(ctx, a),
  collect_dba_maintenance: (ctx, a) => require("./db/connector").collectDbaMaintenance(ctx, a),
  database_capabilities: (ctx, a) => inspectDatabase(ctx, a, "database_capabilities"),
  database_security_findings: (ctx, a) => inspectDatabase(ctx, a, "database_security_findings"),
  erp_crm_import_diagnostics: (_ctx, args) => diagnosticEvidence.importDiagnostics(args),
  erp_crm_collect_api: (_ctx, args) => diagnosticEvidence.collectApi(args),
  benchmark_evidence_compare: (_ctx, args) => diagnosticEvidence.compareBenchmark(args),
  workload_regression_guard: (_ctx, args) => diagnosticEvidence.workloadRegressionGuard(args),
  repeated_benchmark_review: (_ctx, args) => diagnosticEvidence.repeatedBenchmarkReview(args),
  release_qualification_matrix: (_ctx, args) => diagnosticEvidence.qualificationMatrix(args),
  business_reconciliation_compare: (_ctx, args) => diagnosticEvidence.businessReconciliation(args),
  causal_evidence_review: (_ctx, args) => diagnosticEvidence.correlateHypotheses(args),
  next_evidence_test: (_ctx, args) => diagnosticEvidence.selectEvidenceTest(args),
  advisor_workflow: (ctx, args) => advisorWorkflow(ctx, args),
  advisory_case: (ctx, args) => advisoryCase(ctx, args),
  audit_integrity_check: (ctx) => ({ usp: "audit_integrity_check", ...verifyAudit(ctx.stateFile) }),
  erp_crm_vendor_catalog: () => erpCrmAdvisor.getCatalog(),
  erp_crm_evidence_plan: (_ctx, a) => erpCrmAdvisor.evidencePlan(a),
  erp_crm_risk_analyzer: (_ctx, a) => erpCrmAdvisor.analyze(a),
  list_databases: (ctx, a) => listDatabases(ctx, a),
  list_tables: (ctx, a) => listTables(ctx, a),
  describe_table: (ctx, a) => describeTable(ctx, a),
  describe_relationships: (ctx, a) => describeRelationships(ctx, a),
  explain_query: (ctx, a) => explainQuery(ctx, a),
  query_stats: (ctx, a) => queryStats(ctx, a),
  lock_analysis: (ctx, a) => lockAnalysis(ctx, a),
  index_usage: (ctx, a) => indexUsage(ctx, a),
  replication_status: (ctx, a) => replicationStatus(ctx, a),
  detect_pii: (ctx, a) => detectPii(ctx, a),
  propose_migration: (ctx, a) => proposeMigration(ctx, a),
  simulate_query: (ctx, a) => simulateQuery(ctx, a),
  create_index: (ctx, a) => createIndex(ctx, a),
  rollback_migration: (ctx, a) => rollbackMigration(ctx, a),
  optimize_query: (ctx, a) => optimizeQuery(ctx, a),
  create_partitioning: (ctx, a) => createPartitioning(ctx, a),
  analyze_workload: (ctx, a) => analyzeWorkload(ctx, a),
  classify_risk: (_ctx, a) => ({ risk: classify(a.sql || a.query || "") }),
  audit_query: (ctx, a) => auditQuery(ctx, a),
  estimate_cost: (ctx, a) => estimateCost(ctx, a),
  retrieve_context: (ctx, a) => retrieveContext(ctx, a),
  query_time_machine: (ctx, a) => queryTimeMachine(ctx, a),
  deadlock_simulator: (ctx, a) => deadlockSimulator(ctx, a),
  evolve_indexes: (ctx, a) => evolveIndexes(ctx, a),
  describe_business_layer: (ctx, a) => describeBusinessLayer(ctx, a),
  cost_intelligence: (ctx, a) => costIntelligence(ctx, a),
  telemetry_correlation: (ctx, a) => telemetryCorrelation(ctx, a),
  agent_coordination: (ctx, a) => agentCoordination(ctx, a),
  enforce_policy: (_ctx, a) => enforcePolicy(_ctx, a),
  validate_compliance: (ctx, a) => validateCompliance(ctx, a),
  production_readiness_check: (ctx, a) => productionReadinessCheck(ctx, a),
  ai_anomaly_triage: (ctx, a) => aiAnomalyTriage(ctx, a),
  ai_query_rewrite_lab: (ctx, a) => aiQueryRewriteLab(ctx, a),
  ai_migration_risk_radar: (ctx, a) => aiMigrationRiskRadar(ctx, a),
  ai_data_contract_guardian: (ctx, a) => aiDataContractGuardian(ctx, a),
  rls_masking_router: (ctx, a) => rlsMaskingRouter(ctx, a),
  explainable_refactoring_dossier: (ctx, a) => explainableRefactoringDossier(ctx, a),
  performance_forecast: (ctx, a) => performanceForecast(ctx, a),
  semantic_memory_index: (ctx, a) => semanticMemoryIndex(ctx, a),
  telemetry_connector_ingest: (ctx, a) => telemetryConnectorIngest(ctx, a),
  autonomous_verification_loop: (ctx, a) => autonomousVerificationLoop(ctx, a),
  sql_firewall_learning: (ctx, a) => sqlFirewallLearning(ctx, a),
  workload_twin: (ctx, a) => workloadTwin(ctx, a),
  production_rollout_orchestrator: (ctx, a) => productionRolloutOrchestrator(ctx, a),
  pgvector_connector_check: (ctx, a) => pgvectorConnectorCheck(ctx, a),
  prometheus_connector_ingest: (ctx, a) => prometheusConnectorIngest(ctx, a),
  grafana_annotation_export: (ctx, a) => grafanaAnnotationExport(ctx, a),
  neo4j_graph_export: (ctx, a) => neo4jGraphExport(ctx, a),
  onboard_database: (ctx, a) => onboardDatabase(ctx, a),
  run_health_assessment: (ctx, a) => runHealthAssessment(ctx, a),
  prepare_production_rollout: (ctx, a) => prepareProductionRollout(ctx, a),
  investigate_incident: (ctx, a) => investigateIncident(ctx, a),
  optimize_workload: (ctx, a) => optimizeWorkload(ctx, a),
  release_readiness_report: (ctx, a) => releaseReadinessReport(ctx, a),
  sql_problem_detector: (ctx, a) => sqlProblemDetector(ctx, a),
  plan_deep_diagnostics: (ctx, a) => planDeepDiagnostics(ctx, a),
  plan_diff_intelligence: (ctx, a) => planDiffIntelligence(ctx, a),
  recommendation_ranker: (ctx, a) => recommendationRanker(ctx, a),
  index_roi_simulator: (ctx, a) => indexRoiSimulator(ctx, a),
  plan_regression_watch: (ctx, a) => planRegressionWatch(ctx, a),
  parameter_sensitivity_guard: (ctx, a) => parameterSensitivityGuard(ctx, a),
  maintenance_window_advisor: (ctx, a) => maintenanceWindowAdvisor(ctx, a),
  slo_impact_guard: (ctx, a) => sloImpactGuard(ctx, a),
  query_fingerprint_clusterer: (ctx, a) => queryFingerprintClusterer(ctx, a),
  wait_event_root_cause: (ctx, a) => waitEventRootCause(ctx, a),
  data_skew_detector: (ctx, a) => dataSkewDetector(ctx, a),
  cache_efficiency_advisor: (ctx, a) => cacheEfficiencyAdvisor(ctx, a),
  capacity_headroom_forecast: (ctx, a) => capacityHeadroomForecast(ctx, a),
  evidence_pack_generator: (ctx, a) => evidencePackGenerator(ctx, a),
  auto_tuning_experiment_designer: (ctx, a) => autoTuningExperimentDesigner(ctx, a),
  migration_performance_predictor: (ctx, a) => migrationPerformancePredictor(ctx, a),
  workload_replay_risk_simulator: (ctx, a) => workloadReplayRiskSimulator(ctx, a),
  index_portfolio_optimizer: (ctx, a) => indexPortfolioOptimizer(ctx, a),
  incident_timeline_builder: (ctx, a) => incidentTimelineBuilder(ctx, a),
  advisor_confidence_grader: (ctx, a) => advisorConfidenceGrader(ctx, a),
  change_ticket_exporter: (ctx, a) => changeTicketExporter(ctx, a),
  cost_to_performance_advisor: (ctx, a) => costToPerformanceAdvisor(ctx, a),
  schema_evolution_guard: (ctx, a) => schemaEvolutionGuard(ctx, a),
  autonomous_dba_copilot: (ctx, a) => autonomousDbaCopilot(ctx, a),
  performance_pr_reviewer: (ctx, a) => performancePrReviewer(ctx, a),
  cross_tool_devops_analyzer: (ctx, a) => crossToolDevopsAnalyzer(ctx, a),
  ai_guarded_sql_generator: (ctx, a) => aiGuardedSqlGenerator(ctx, a),
  synthetic_workload_lab: (ctx, a) => syntheticWorkloadLab(ctx, a),
  vendor_neutral_devops_brain: (ctx, a) => vendorNeutralDevopsBrain(ctx, a),
  compliance_query_assistant: (ctx, a) => complianceQueryAssistant(ctx, a),
  migration_twin_simulator: (ctx, a) => migrationTwinSimulator(ctx, a),
  policy_gated_self_healing: (ctx, a) => policyGatedSelfHealing(ctx, a),
  advisor_memory_recommender: (ctx, a) => advisorMemoryRecommender(ctx, a),
  sql_code_review_assistant: (ctx, a) => sqlCodeReviewAssistant(ctx, a),
  schema_compare_intelligence: (ctx, a) => schemaCompareIntelligence(ctx, a),
  query_contract_tester: (ctx, a) => queryContractTester(ctx, a),
  rollback_rehearsal_engine: (ctx, a) => rollbackRehearsalEngine(ctx, a),
  release_train_risk_board: (ctx, a) => releaseTrainRiskBoard(ctx, a),
  observability_signal_router: (ctx, a) => observabilitySignalRouter(ctx, a),
  fleet_health_scorecard: (ctx, a) => fleetHealthScorecard(ctx, a),
  index_hypothesis_generator: (ctx, a) => indexHypothesisGenerator(ctx, a),
  developer_sql_coach: (ctx, a) => developerSqlCoach(ctx, a),
  environment_drift_detector: (ctx, a) => environmentDriftDetector(ctx, a),
  query_plan_narrator: (ctx, a) => queryPlanNarrator(ctx, a),
  slo_policy_compiler: (ctx, a) => sloPolicyCompiler(ctx, a),
  index_retirement_planner: (ctx, a) => indexRetirementPlanner(ctx, a),
  hotfix_risk_assessor: (ctx, a) => hotfixRiskAssessor(ctx, a),
  tenant_noisy_neighbor_detector: (ctx, a) => tenantNoisyNeighborDetector(ctx, a),
  partition_strategy_advisor: (ctx, a) => partitionStrategyAdvisor(ctx, a),
  statistics_health_doctor: (ctx, a) => statisticsHealthDoctor(ctx, a),
  connection_pool_advisor: (ctx, a) => connectionPoolAdvisor(ctx, a),
  backup_restore_readiness_guard: (ctx, a) => backupRestoreReadinessGuard(ctx, a),
  vendor_feature_mapper: (ctx, a) => vendorFeatureMapper(ctx, a),
  advisor_feedback_loop: (ctx, a) => advisorFeedbackLoop(ctx, a),
  benchmark_ab_runner: (ctx, a) => benchmarkAbRunner(ctx, a),
  workload_impact_analyzer: (ctx, a) => workloadImpactAnalyzer(ctx, a),
  consultant_brain: (ctx, a) => consultantBrain(ctx, a),
  sql_performance_advisor: (ctx, a) => sqlPerformanceAdvisor(ctx, a),
  objective_to_ops_plan: (ctx, a) => objectiveToOpsPlan(ctx, a),
  autonomous_experiment_planner: (ctx, a) => autonomousExperimentPlanner(ctx, a),
  counterfactual_risk_engine: (ctx, a) => counterfactualRiskEngine(ctx, a),
  decision_evidence_compiler: (ctx, a) => decisionEvidenceCompiler(ctx, a),
  confidence_budget_manager: (ctx, a) => confidenceBudgetManager(ctx, a),
  autonomy_boundary_enforcer: (ctx, a) => autonomyBoundaryEnforcer(ctx, a),
  operator_goal_monitor: (ctx, a) => operatorGoalMonitor(ctx, a),
  dry_run_action_critic: (ctx, a) => dryRunActionCritic(ctx, a),
  next_best_safe_action: (ctx, a) => nextBestSafeAction(ctx, a),
  autonomous_ops_briefing: (ctx, a) => autonomousOpsBriefing(ctx, a),
  ai_strategy_synthesizer: (ctx, a) => aiStrategySynthesizer(ctx, a),
  cognitive_schema_mapper: (ctx, a) => cognitiveSchemaMapper(ctx, a),
  llm_prompt_risk_auditor: (ctx, a) => llmPromptRiskAuditor(ctx, a),
  ai_decision_simulator: (ctx, a) => aiDecisionSimulator(ctx, a),
  autonomous_learning_backlog: (ctx, a) => autonomousLearningBacklog(ctx, a),
  knowledge_gap_detector: (ctx, a) => knowledgeGapDetector(ctx, a),
  ai_trust_scorecard: (ctx, a) => aiTrustScorecard(ctx, a),
  semantic_incident_predictor: (ctx, a) => semanticIncidentPredictor(ctx, a),
  cross_agent_consensus_builder: (ctx, a) => crossAgentConsensusBuilder(ctx, a),
  ai_roi_narrative_generator: (ctx, a) => aiRoiNarrativeGenerator(ctx, a),
  live_evidence_smoke_profile: (ctx, a) => liveEvidenceSmokeProfile(ctx, a),
  formal_contract_catalog: (ctx, a) => formalContractCatalog(ctx, a),
  governance_proof_packet: (ctx, a) => governanceProofPacket(ctx, a),
  benchmark_roi_proof: (ctx, a) => benchmarkRoiProof(ctx, a),
  pilot_success_pack: (ctx, a) => pilotSuccessPack(ctx, a),
  visual_executive_report: (ctx, a) => visualExecutiveReport(ctx, a),
  enterprise_security_proof: (ctx, a) => enterpriseSecurityProof(ctx, a),
  competitive_battlecards: (ctx, a) => competitiveBattlecards(ctx, a),
  incident_analysis: (ctx) => incidentAnalysis(ctx),
  incident_causal_graph: (ctx, a) => incidentAnalysis(ctx, a),
  compile_intent: (ctx, a) => compileIntent(ctx, a),
  cross_engine_translate: (ctx, a) => crossEngineTranslate(ctx, a),
  suggest_policy_updates: (ctx, a) => suggestPolicy(ctx, a),
  self_healing_playbook: (ctx, a) => selfHealingPlaybook(ctx, a),
  replay_execution: (ctx, a) => replayExecution(ctx, a),
};

const toolDispatch = Object.fromEntries(
  Object.entries(toolHandlers).map(([tool, handler]) => [
    tool,
    (ctx, a, actor, opts = {}) => withPolicyAudit(tool, a, actor, async () => {
      const result = await handler(ctx, a);
      if (result && result.source === "analysis") {
        result.evidenceClassification = { kind: "heuristic_analysis", measuredOutcome: false,
          warning: "Rules and supplied assertions are not measured predictions or production authorization" };
        if (result.confidence && typeof result.confidence.score === "number") {
          result.confidence = { ...result.confidence, heuristicScore: result.confidence.score, score: null,
            level: "not_calibrated", basis: "uncalibrated_rule_score_not_probability" };
        }
      } else if (result && /mock/i.test(result.source || "")) {
        result.evidenceClassification = { kind: "mock_fixture", measuredOutcome: false, productionUse: false };
      }
      return result;
    }, opts),
  ]),
);

async function dispatch(toolName, args = {}, actor = "codex-agent") {
  // Recovery must operate before the broken legacy audit can be imported.
  if (toolName === "audit_state_recovery") return require("./auditLogger").auditStateRecovery(resolveCatalog().stateFile, args);
  const tool = toolDispatch[toolName];
  if (!tool) {
    throw new Error(`Unknown tool: ${toolName}`);
  }
  const context = resolveCatalog();
  return tool(context, args, actor);
}

module.exports = { dispatch };
