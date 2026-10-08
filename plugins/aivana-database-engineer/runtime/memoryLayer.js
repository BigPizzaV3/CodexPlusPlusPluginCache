const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { withState, importOnce } = require("./stateStore");

function stateFile(context) {
  return context.stateFile || path.join(process.env.CODEXDB_STATE_DIR || path.join(process.cwd(), ".codexdb"), "runtime-state.json");
}

function importMemory(db, file) {
  importOnce(db, "legacy_memory", () => {
    const legacy = path.join(path.dirname(file), "memory.json");
    if (!fs.existsSync(legacy)) return;
    const state = JSON.parse(fs.readFileSync(legacy, "utf8"));
    if (!state || typeof state !== "object" || Array.isArray(state)) throw new Error("Invalid legacy memory");
    const insert = db.prepare("INSERT INTO memory(category,value) VALUES(?,?)");
    for (const [category, entries] of Object.entries(state)) {
      if (!Array.isArray(entries)) throw new Error("Invalid legacy memory category");
      for (const entry of entries) insert.run(category, JSON.stringify(entry));
    }
  });
}

function remember(context, category, entry) {
  const file = stateFile(context);
  const limit = Number(category === "executionReplays" ? context.policy?.replay?.maxEntries || 1000 : context.policy?.memory?.maxEntries || 250);
  if (!Number.isSafeInteger(limit) || limit < 1) throw new Error("Invalid memory retention limit");
  return withState(file, (db) => {
    importMemory(db, file);
    const record = { ...entry, id: "mem-" + crypto.randomUUID(), ts: new Date().toISOString() };
    db.prepare("INSERT INTO memory(category,value) VALUES(?,?)").run(category, JSON.stringify(record));
    db.prepare("DELETE FROM memory WHERE category=? AND sequence NOT IN (SELECT sequence FROM memory WHERE category=? ORDER BY sequence DESC LIMIT ?)")
      .run(category, category, limit);
    return { status: "recorded", category, id: record.id };
  });
}

function recall(context, category, limit = 5) {
  const count = Number(limit);
  if (!Number.isSafeInteger(count) || count < 0) throw new Error("Invalid memory recall limit");
  const file = stateFile(context);
  return withState(file, (db) => {
    importMemory(db, file);
    return db.prepare("SELECT value FROM memory WHERE category=? ORDER BY sequence DESC LIMIT ?")
      .all(category, count).map((row) => JSON.parse(row.value));
  });
}

function caseScope(args) {
  const keys = ["systemId", "environment", "product", "productVersion"];
  if (keys.some((key) => typeof args[key] !== "string" || !args[key].trim() || args[key].length > 160)) throw new Error("Complete case scope is required");
  return Object.fromEntries(keys.map((key) => [key, args[key]]));
}

function validityContext(input) {
  const fields = ["schemaHash", "dataProfileHash", "loadProfileHash", "configurationHash"];
  if (!input || fields.some((key) => !/^[a-f0-9]{64}$/.test(input[key] || "")) ||
      typeof input.deployment !== "string" || !input.deployment.trim() || input.deployment.length > 160) throw new Error("Complete recommendation validity context required");
  return Object.fromEntries([...fields, "deployment"].map((key) => [key, input[key]]));
}

function assessValidity(record, current) {
  const reasons = [];
  if (record.status !== "closed" || record.review?.outcome !== "confirmed") reasons.push("case_not_confirmed");
  if (record.invalidatedAt) reasons.push("recommendation_invalidated");
  if (!record.proposal?.validityContext) reasons.push("original_context_missing");
  if (!current) reasons.push("current_context_missing");
  if (current && record.proposal?.validityContext) {
    for (const key of Object.keys(current)) if (current[key] !== record.proposal.validityContext[key]) reasons.push(`${key}_changed`);
  }
  const captured = Date.parse(record.followUp?.lastCapturedAt);
  const maxAge = (record.proposal?.validityHours || 24) * 3600000;
  if (!Number.isFinite(captured) || captured > Date.now() || Date.now() - captured > maxAge) reasons.push("follow_up_stale_or_missing");
  for (const review of [record.verification, record.followUp]) {
    if (review?.decision !== "repeatable_observed_improvement" || review.businessIntegrity?.decision !== "matched_supplied_controls") {
      reasons.push("technical_or_business_evidence_missing"); break;
    }
  }
  return { status: reasons.length ? "requires_revalidation" : "within_recorded_validity", reasons,
    executionAuthorized: false, basis: "supplied_context_hashes_not_live_drift_monitoring" };
}

function recommendationValidity(context, args) {
  const record = advisoryCase(context, { ...args, action: "read" }).case;
  if (args.action === "invalidate") {
    if (typeof args.reason !== "string" || !args.reason.trim() || args.reason.length > 1000) throw new Error("Invalidation reason required");
    if (args.expectedRevision !== record.revision || record.events.length >= 100) throw new Error("Case revision conflict or event limit");
    record.invalidatedAt = new Date().toISOString();
    record.invalidationReason = require("./auditLogger").sanitizeObject(args.reason);
    record.revision++;
    record.events.push({ action: "invalidate", revision: record.revision, at: record.invalidatedAt });
    withState(stateFile(context), (db) => {
      const result = db.prepare("UPDATE advisory_cases SET revision=?,value=? WHERE id=? AND scope=? AND revision=?")
        .run(record.revision, JSON.stringify(record), record.id, JSON.stringify(caseScope(args)), args.expectedRevision);
      if (result.changes !== 1) throw new Error("Case revision conflict");
    });
  } else if (args.action !== "check") throw new Error("Validity action must be check or invalidate");
  return { usp: "recommendation_validity", source: "local_case_record", caseId: record.id, revision: record.revision,
    ...assessValidity(record, args.validityContext ? validityContext(args.validityContext) : null) };
}

function advisoryCase(context, args) {
  const scope = caseScope(args);
  const scopeKey = JSON.stringify(scope);
  const { sanitizeObject } = require("./auditLogger");
  const { repeatedBenchmarkReview, businessReconciliation, correlateHypotheses } = require("./diagnosticEvidence");
  const hash = (value) => crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");
  const groupKey = (group) => JSON.stringify(["companyId", "currency", "unit", "metric"].map((key) => {
    if (typeof group?.[key] !== "string" || !group[key].trim() || group[key].length > 160) throw new Error("Complete business control group required");
    return group[key];
  }));
  const contractFor = (input) => {
    if (!input || !/^[a-f0-9]{64}$/.test(input.definitionHash || "") || typeof input.period !== "string" || !input.period.trim() || input.period.length > 160
      || typeof input.deployment !== "string" || !input.deployment.trim() || input.deployment.length > 160 || !Array.isArray(input.groups) || !input.groups.length || input.groups.length > 10000) throw new Error("Business contract required before test approval");
    const groups = input.groups.map(groupKey).sort();
    if (new Set(groups).size !== groups.length) throw new Error("Duplicate contracted group");
    return { definitionHash: input.definitionHash, period: input.period, deployment: input.deployment, groups };
  };
  const requiredText = (value, name) => {
    if (typeof value !== "string" || !value.trim() || value.length > 4000) throw new Error(`${name} is required (maximum 4000 characters)`);
    return sanitizeObject(value);
  };
  return withState(stateFile(context), (db) => {
    db.exec("CREATE TABLE IF NOT EXISTS advisory_cases (id TEXT PRIMARY KEY, scope TEXT NOT NULL, revision INTEGER NOT NULL, value TEXT NOT NULL)");
    db.exec("CREATE INDEX IF NOT EXISTS advisory_cases_scope ON advisory_cases(scope)");
    if (args.action === "create") {
      const record = { id: crypto.randomUUID(), scope, revision: 1, status: "opened",
        objective: requiredText(args.objective, "objective"), events: [], createdAt: new Date().toISOString() };
      db.prepare("INSERT INTO advisory_cases VALUES(?,?,?,?)").run(record.id, scopeKey, 1, JSON.stringify(record));
      return { usp: "advisory_case", source: "local_case_record", case: record, executionAuthorized: false };
    }
    if (args.action === "quality_report") {
      const records = db.prepare("SELECT value FROM advisory_cases WHERE scope=?").all(scopeKey).map((r) => JSON.parse(r.value));
      const closed = records.filter((r) => r.status === "closed");
      const counts = Object.fromEntries(["confirmed", "false_positive", "inconclusive"].map((outcome) => [outcome, closed.filter((r) => r.review.outcome === outcome).length]));
      const businessQualified = closed.filter((r) => r.review.outcome === "confirmed" && r.verification?.businessIntegrity?.decision === "matched_supplied_controls" && r.followUp?.businessIntegrity?.decision === "matched_supplied_controls").length;
      return { usp: "advisory_case", source: "local_case_record", scope, totalCases: records.length, reviewedCases: closed.length, counts,
        businessQualifiedConfirmations: businessQualified, legacyOrUnqualifiedConfirmations: counts.confirmed - businessQualified,
        confirmationRate: closed.length ? counts.confirmed / closed.length : null,
        correctedCases: closed.filter((r) => r.review.corrected).length,
        limitations: ["User-recorded reviews, not independently attested", "No inference across systems or product versions", "No trained-model or causal-accuracy claim"] };
    }
    if (args.action === "find_confirmed") {
      const workloadId = requiredText(args.workloadId, "workloadId");
      if (!/^[a-f0-9]{64}$/.test(args.customizationHash || "")) throw new Error("customizationHash required");
      const records = db.prepare("SELECT value FROM advisory_cases WHERE scope=? ORDER BY rowid DESC LIMIT 1000").all(scopeKey).map((r) => JSON.parse(r.value));
      const matches = records.filter((r) => !r.invalidatedAt && r.status === "closed" && r.review?.outcome === "confirmed"
        && r.proposal?.workloadId === workloadId && r.proposal?.customizationHash === args.customizationHash
        && r.verification?.decision === "repeatable_observed_improvement" && r.followUp?.decision === "repeatable_observed_improvement"
        && r.verification?.businessIntegrity?.decision === "matched_supplied_controls" && r.followUp?.businessIntegrity?.decision === "matched_supplied_controls");
      return { usp: "advisory_case", source: "local_case_record", matches: matches.slice(0, 10).map((r) => ({ caseId: r.id, objective: r.objective,
        change: r.proposal.change, proposalHash: r.proposalHash, corrected: r.review.corrected,
        verificationHashes: r.verification.evidenceHashes, followUpHashes: r.followUp.evidenceHashes,
        validity: assessValidity(r, args.validityContext ? validityContext(args.validityContext) : null) })),
        scannedCases: records.length, scanLimit: 1000, executionAuthorized: false,
        limitations: ["Exact scope, workload and customization matching; not a causal recommendation", "User-reviewed outcomes are not independently attested", "Most recent 1000 scoped cases searched"] };
    }
    if (typeof args.caseId !== "string") throw new Error("caseId is required");
    const row = db.prepare("SELECT value FROM advisory_cases WHERE id=? AND scope=?").get(args.caseId, scopeKey);
    if (!row) throw new Error("Case unavailable in this scope");
    const record = JSON.parse(row.value);
    if (args.action === "read") return { usp: "advisory_case", source: "local_case_record", case: record, executionAuthorized: false };
    if (!Number.isSafeInteger(args.expectedRevision) || args.expectedRevision !== record.revision) throw new Error("Case revision conflict; read before updating");
    if (record.events.length >= 100) throw new Error("Case event limit reached");
    const transitions = { diagnose: "opened", propose: "diagnosed", approve_test: "proposed", verify: "test_approved", follow_up: "verified", close: "followed_up" };
    if (!transitions[args.action] || transitions[args.action] !== record.status) throw new Error("Invalid case transition");
    if (args.action === "diagnose") {
      if (!Array.isArray(args.evidenceRefs) || !args.evidenceRefs.length || args.evidenceRefs.length > 50) throw new Error("Evidence references required");
      record.diagnosis = { hypothesis: requiredText(args.hypothesis, "hypothesis"), evidenceRefs: args.evidenceRefs.map((r) => requiredText(r, "evidenceRef")), evidenceBasis: "supplied_references_not_attested" };
      if (args.causalEvidence) record.diagnosis.correlation = correlateHypotheses({ ...args.causalEvidence, ...scope });
      record.status = "diagnosed";
    } else if (args.action === "propose") {
      if (!/^[a-f0-9]{64}$/.test(args.customizationHash || "")) throw new Error("customizationHash required");
      record.proposal = { change: requiredText(args.change, "change"), rollback: requiredText(args.rollback, "rollback"), testPlan: requiredText(args.testPlan, "testPlan"),
        workloadId: requiredText(args.workloadId, "workloadId"), customizationHash: args.customizationHash, businessContract: contractFor(args.businessContract) };
      if (args.validityContext) {
        const hours = args.validityHours ?? 24;
        if (!Number.isFinite(hours) || hours <= 0 || hours > 720) throw new Error("Validity hours must be positive and at most 720");
        record.proposal.validityContext = validityContext(args.validityContext);
        record.proposal.validityHours = hours;
      }
      record.proposalHash = crypto.createHash("sha256").update(JSON.stringify(record.proposal)).digest("hex");
      record.status = "proposed";
    } else if (args.action === "approve_test") {
      if (args.proposalHash !== record.proposalHash) throw new Error("Approval does not match proposal");
      if (!Number.isFinite(Date.parse(args.approvedAt)) || Date.parse(args.approvedAt) > Date.now()
        || Date.now() - Date.parse(args.approvedAt) > 7 * 86400000) throw new Error("Recent test approval timestamp required");
      record.testApproval = { reviewer: requiredText(args.reviewer, "reviewer"), reference: requiredText(args.approvalRef, "approvalRef"), approvedAt: args.approvedAt, source: "user_supplied_not_authenticated", proposalHash: record.proposalHash };
      record.status = "test_approved";
    } else if (args.action === "verify" || args.action === "follow_up") {
      if (args.proposalHash !== record.proposalHash) throw new Error("Measurements must reference the approved proposal");
      if (args.measurements?.repetitions?.some((pair) => pair.before?.systemId !== scope.systemId || pair.after?.systemId !== scope.systemId
        || pair.before?.environment !== scope.environment || pair.after?.environment !== scope.environment
        || pair.before?.productVersion !== scope.productVersion || pair.after?.productVersion !== scope.productVersion
        || pair.before?.product !== scope.product || pair.after?.product !== scope.product)) throw new Error("Benchmark does not match case scope");
      const review = repeatedBenchmarkReview(args.measurements || {});
      const contract = record.proposal.businessContract;
      if (!contract) throw new Error("Legacy proposal lacks business contract; create a new case");
      for (const pair of args.measurements.repetitions) {
        if (pair.before.workloadId !== record.proposal.workloadId) throw new Error("Benchmark workload differs from proposal");
      }
      const business = businessReconciliation(args.businessControls || {});
      for (const exported of [args.businessControls.before, args.businessControls.after]) {
        if (Object.keys(scope).some((key) => exported[key] !== scope[key]) || exported.definitionHash !== contract.definitionHash
          || exported.period !== contract.period || exported.deployment !== contract.deployment
          || exported.snapshotHash !== args.measurements.repetitions[0].before.datasetHash) throw new Error("Business evidence does not match approved contract or benchmark snapshot");
        if (hash(exported.controls.map(groupKey).sort()) !== hash(contract.groups)) throw new Error("Business evidence omits or adds contracted groups");
        if (Date.parse(exported.capturedAt) < Date.parse(record.testApproval.approvedAt)) throw new Error("Business evidence predates test approval");
      }
      review.businessIntegrity = { ...business, firstCapturedAt: args.businessControls.before.capturedAt, lastCapturedAt: args.businessControls.after.capturedAt };
      if (Date.parse(review.firstCapturedAt) < Date.parse(record.testApproval.approvedAt)) throw new Error("Measurements predate test approval");
      if (args.action === "follow_up") {
        if (Date.parse(review.firstCapturedAt) <= Date.parse(record.verification.lastCapturedAt)) throw new Error("Follow-up needs newer measurements");
        if (review.workloadFingerprint !== record.verification.workloadFingerprint || review.policyHash !== record.verification.policyHash) throw new Error("Follow-up workload or policy changed");
        if (Date.parse(review.businessIntegrity.firstCapturedAt) <= Date.parse(record.verification.businessIntegrity.lastCapturedAt)) throw new Error("Follow-up business evidence must be newer");
      }
      const field = args.action === "verify" ? "verification" : "followUp";
      record[field] = review;
      record.status = args.action === "verify" ? "verified" : "followed_up";
    } else {
      if (!["confirmed", "false_positive", "inconclusive"].includes(args.outcome) || typeof args.corrected !== "boolean") throw new Error("Explicit review outcome and corrected boolean required");
      if (args.outcome === "confirmed" && (record.verification.decision !== "repeatable_observed_improvement" || record.followUp.decision !== "repeatable_observed_improvement")) throw new Error("Cannot confirm improvement without successful verification and follow-up");
      if (args.outcome === "confirmed" && (record.verification.businessIntegrity?.decision !== "matched_supplied_controls" || record.followUp.businessIntegrity?.decision !== "matched_supplied_controls")) throw new Error("Cannot confirm improvement with missing or failed business controls");
      record.review = { outcome: args.outcome, corrected: args.corrected, reviewer: requiredText(args.reviewer, "reviewer"), note: requiredText(args.note, "note") };
      record.status = "closed";
    }
    record.revision++;
    record.events.push({ action: args.action, revision: record.revision, at: new Date().toISOString() });
    db.prepare("UPDATE advisory_cases SET revision=?,value=? WHERE id=? AND scope=?").run(record.revision, JSON.stringify(record), record.id, scopeKey);
    return { usp: "advisory_case", source: "local_case_record", case: record, executionAuthorized: false };
  });
}

function diagnosticSession(context, args) {
  if (Buffer.byteLength(JSON.stringify(args)) > 1024 * 1024) throw new Error("Diagnostic input exceeds 1 MiB");
  const scope = { ...caseScope(args), deployment: args.deployment };
  if (typeof scope.deployment !== "string" || !scope.deployment.trim() || scope.deployment.length > 160) throw new Error("Deployment required");
  const evidence = require("./diagnosticEvidence");
  const { sanitizeObject } = require("./auditLogger");
  const hash = (input) => crypto.createHash("sha256").update(JSON.stringify(input)).digest("hex");
  const hypotheses = (ids) => {
    if (!Array.isArray(ids) || ids.length < 2 || ids.length > 20 || new Set(ids).size !== ids.length ||
        ids.some((id) => typeof id !== "string" || !id.trim() || id.length > 160)) throw new Error("Two to twenty unique hypothesis IDs required");
    return [...ids];
  };
  const reply = (record) => ({ usp: "diagnostic_session", source: "local_diagnostic_record", session: record,
    nextAction: record.status === "awaiting_result" ? "record_result" : record.status === "model_revision_required" ? "revise_model"
      : record.status === "ready_for_verification" ? "record_verification" : record.status === "verified" ? "continue_case_verification_and_follow_up" : "plan_test",
    executionAuthorized: false, rootCauseProven: false });
  return withState(stateFile(context), (db) => {
    db.exec("CREATE TABLE IF NOT EXISTS diagnostic_sessions (id TEXT PRIMARY KEY, scope TEXT NOT NULL, revision INTEGER NOT NULL, value TEXT NOT NULL)");
    const key = JSON.stringify(scope);
    if (args.action === "start") {
      if (typeof args.objective !== "string" || !args.objective.trim() || args.objective.length > 2000) throw new Error("Diagnostic objective required");
      const record = { id: crypto.randomUUID(), scope, objective: sanitizeObject(args.objective), revision: 1,
        status: "investigating", hypotheses: hypotheses(args.hypotheses), results: [], events: [], createdAt: new Date().toISOString() };
      db.prepare("INSERT INTO diagnostic_sessions VALUES(?,?,?,?)").run(record.id, key, 1, JSON.stringify(record));
      return reply(record);
    }
    const row = db.prepare("SELECT value FROM diagnostic_sessions WHERE id=? AND scope=?").get(String(args.sessionId || ""), key);
    if (!row) throw new Error("Diagnostic session unavailable in scope");
    const record = JSON.parse(row.value);
    if (args.action === "read") return reply(record);
    if (args.expectedRevision !== record.revision || record.events.length >= 100) throw new Error("Diagnostic revision conflict or event limit");
    if (args.action === "plan_test") {
      if (record.status !== "investigating") throw new Error("Revise model or record the outstanding result before planning");
      const plan = sanitizeObject({ ...scope, hypotheses: record.hypotheses, tests: args.tests,
        availableEvidence: args.availableEvidence, ...(args.maxEstimatedMinutes === undefined ? {} : { maxEstimatedMinutes: args.maxEstimatedMinutes }) });
      const selected = evidence.selectEvidenceTest(plan);
      if (!selected.selectedTestId) throw new Error("No eligible discriminating test");
      record.plan = { input: plan, inputHash: hash(plan), selectedTestId: selected.selectedTestId, createdAt: new Date().toISOString() };
      record.status = "awaiting_result";
    } else if (args.action === "record_result") {
      if (record.status !== "awaiting_result" || args.planHash !== record.plan.inputHash) throw new Error("Result must match outstanding plan");
      if (Object.keys(scope).some((key) => args.resultScope?.[key] !== scope[key])) throw new Error("Result scope differs from diagnostic session");
      if (!Number.isFinite(Date.parse(args.observedAt)) || Date.parse(args.observedAt) < Date.parse(record.plan.createdAt)) throw new Error("Result predates planned test");
      const used = new Set(record.results.flatMap((item) => item.evidenceRefs));
      if (Array.isArray(args.evidenceRefs) && args.evidenceRefs.some((ref) => used.has(ref))) throw new Error("Evidence already recorded");
      const result = evidence.evaluateDiagnosticOutcome({ plan: record.plan.input, testId: args.testId,
        observedOutcomeId: args.observedOutcomeId, observedAt: args.observedAt,
        evidenceRefs: args.evidenceRefs, resultScope: args.resultScope });
      record.results.push({ ...result, evidenceRefs: sanitizeObject(args.evidenceRefs), observedAt: args.observedAt });
      record.hypotheses = result.remainingHypotheses;
      record.status = result.requiresModelRevision ? "model_revision_required" : record.hypotheses.length === 1 ? "ready_for_verification" : "investigating";
      delete record.plan;
    } else if (args.action === "revise_model") {
      if (record.status === "verified" || record.status === "awaiting_result") throw new Error("Cannot replace a verified or outstanding test model");
      if (typeof args.reason !== "string" || !args.reason.trim() || args.reason.length > 2000) throw new Error("Model revision reason required");
      record.hypotheses = hypotheses(args.hypotheses);
      record.modelRevisionReason = sanitizeObject(args.reason);
      record.status = "investigating";
    } else if (args.action === "record_trace_review") {
      if (!Array.isArray(args.causalEvidence?.hypotheses) || args.causalEvidence.hypotheses.length !== record.hypotheses.length ||
          args.causalEvidence.hypotheses.some((item) => !record.hypotheses.includes(item.id))) throw new Error("Trace hypotheses differ from diagnostic model");
      record.traceReview = evidence.correlateHypotheses({ ...args.causalEvidence, ...scope });
    } else if (args.action === "record_verification") {
      if (record.status !== "ready_for_verification") throw new Error("Resolve the diagnostic test before verification");
      for (const pair of args.measurements?.repetitions || []) {
        for (const sample of [pair.before, pair.after]) {
          if (["systemId", "environment", "product", "productVersion"].some((key) => sample?.[key] !== scope[key]) ||
              Date.parse(sample?.capturedAt) < Date.parse(record.results.at(-1).observedAt)) throw new Error("Verification scope or chronology mismatch");
        }
      }
      if ([args.businessControls?.before, args.businessControls?.after].some((item) => item?.deployment !== scope.deployment)) throw new Error("Verification deployment mismatch");
      record.verification = evidence.outcomeEvidenceGate({ measurements: args.measurements, businessControls: args.businessControls });
      record.status = record.verification.decision === "verified_improvement" ? "verified" : "ready_for_verification";
    } else throw new Error("Unknown diagnostic action");
    record.revision++;
    record.events.push({ action: args.action, revision: record.revision, at: new Date().toISOString() });
    const stored = JSON.stringify(sanitizeObject(record));
    if (Buffer.byteLength(stored) > 2 * 1024 * 1024) throw new Error("Diagnostic history exceeds 2 MiB");
    db.prepare("UPDATE diagnostic_sessions SET revision=?,value=? WHERE id=? AND scope=?")
      .run(record.revision, stored, record.id, key);
    return reply(record);
  });
}

function consumeAdminApproval(context, approval) {
  if (approval?.authorized !== true || !/^[a-f0-9]{64}$/.test(approval.receiptHash || "") || !approval.issuer || !approval.nonce ||
      !Number.isFinite(Date.parse(approval.expiresAt)) || Date.parse(approval.expiresAt) <= Date.now()) {
    throw new Error("Verified unexpired approval required");
  }
  return withState(stateFile(context), (db) => {
    db.exec("CREATE TABLE IF NOT EXISTS consumed_admin_approvals (id TEXT PRIMARY KEY, receipt_hash TEXT NOT NULL, expires_at TEXT NOT NULL, consumed_at TEXT NOT NULL)");
    const id = crypto.createHash("sha256").update(JSON.stringify([approval.issuer, approval.nonce])).digest("hex");
    if (db.prepare("SELECT id FROM consumed_admin_approvals WHERE id=?").get(id)) return { consumed: false, reason: "approval_already_consumed" };
    db.prepare("INSERT INTO consumed_admin_approvals VALUES(?,?,?,?)").run(id, approval.receiptHash, approval.expiresAt, new Date().toISOString());
    return { consumed: true, receiptHash: approval.receiptHash };
  });
}

function advisorWorkflow(context, args) {
  if (!["start", "resume"].includes(args.action)) throw new Error("Workflow action must be start or resume");
  const result = advisoryCase(context, { ...args, action: args.action === "start" ? "create" : "read" });
  const record = result.case;
  const stages = {
    opened: ["diagnose", ["hypothesis", "evidenceRefs"]],
    diagnosed: ["propose", ["change", "rollback", "testPlan", "workloadId", "customizationHash", "businessContract"]],
    proposed: ["approve_test", ["proposalHash", "reviewer", "approvalRef", "approvedAt"]],
    test_approved: ["verify", ["proposalHash", "measurements", "businessControls"]],
    verified: ["follow_up", ["proposalHash", "measurements", "businessControls"]],
    followed_up: ["close", ["outcome", "corrected", "reviewer", "note"]],
  };
  const next = stages[record.status];
  return { usp: "advisor_workflow", source: "local_case_record", case: record,
    nextStep: next ? { tool: "advisory_case", action: next[0], requiredInputs: next[1], expectedRevision: record.revision,
      requiresActualUserApproval: next[0] === "approve_test" } : null,
    outcome: record.review?.outcome ?? "not_closed", executionAuthorized: false,
    availableEvidenceTools: ["erp_crm_evidence_plan", "erp_crm_import_diagnostics", "causal_evidence_review", "next_evidence_test", "diagnostic_session",
      "business_impact_priority", "outcome_evidence_gate", "recommendation_validity", "repeated_benchmark_review", "business_reconciliation_compare"],
    decisionBoundary: "Confirmed requires passing technical and contracted business evidence at verification and follow-up; workflow never authorizes writes" };
}

// Supplied cumulative counters only. No persisted monitoring, percentile reconstruction or causality.
// Each window repeats engine/systemId/database and has start/end UTC ISO, metrics[], queries[].
// Counter: {metric,unit,start:{value,counterEpoch},end:{value,counterEpoch}}.
function operationalWindowCompare(args) {
  const result = { usp: "operational_window_compare", source: "supplied_evidence", status: "insufficient_evidence",
    comparable: false, reasonCodes: [], metrics: [], queries: [], missingQueries: { before: [], after: [] },
    slo: [], causalityEstablished: false, improvementEstablished: false, backgroundMonitoring: false, executionAuthorized: false };
  const fail = (reason) => { result.reasonCodes.push(reason); return result; };
  const text = (value) => typeof value === "string" && value.length > 0 && value.length <= 200 && value === value.trim() && !/[\u0000-\u001f\u007f]/.test(value);
  const shape = (value, required, optional = []) => value && typeof value === "object" && !Array.isArray(value)
    && required.every((key) => Object.hasOwn(value, key)) && Object.keys(value).every((key) => required.includes(key) || optional.includes(key));
  const units = { execution_count: "count", elapsed_time: "ms", cpu_time: "ms", logical_reads: "count", physical_reads: "count",
    rows: "count", errors: "count", lock_wait_time: "ms", bytes_read: "bytes", bytes_written: "bytes" };
  try {
    const raw = JSON.stringify(args);
    if (!raw || Buffer.byteLength(raw, "utf8") > 2 * 1024 * 1024) return fail("input_exceeds_2_mib_or_missing");
    const input = JSON.parse(raw);
    if (!shape(input, ["engine", "systemId", "database", "before", "after"], ["slo"])) return fail("invalid_input_schema");
    const scope = ["engine", "systemId", "database"];
    if (!["sqlserver", "postgres", "mysql", "mariadb"].includes(input.engine) || !scope.every((key) => text(input[key]))) return fail("invalid_scope");
    result.scope = Object.fromEntries(scope.map((key) => [key, input[key]]));
    const timestamp = (value) => {
      const parsed = typeof value === "string" ? Date.parse(value) : NaN;
      return Number.isFinite(parsed) && new Date(parsed).toISOString() === value ? parsed : NaN;
    };
    let count = 0;
    const validateMetrics = (metrics) => {
      if (!Array.isArray(metrics)) return false;
      count += metrics.length;
      if (count > 1000) return false;
      const seen = new Set();
      return metrics.every((counter) => {
        if (!shape(counter, ["metric", "unit", "start", "end"]) || !Object.hasOwn(units, counter.metric)
          || units[counter.metric] !== counter.unit || seen.has(counter.metric)) return false;
        seen.add(counter.metric);
        return [counter.start, counter.end].every((sample) => shape(sample, ["value", "counterEpoch"])
          && Number.isSafeInteger(sample.value) && sample.value >= 0 && text(sample.counterEpoch));
      });
    };
    for (const side of ["before", "after"]) {
      const window = input[side];
      if (!shape(window, [...scope, "start", "end", "metrics", "queries"])) return fail("invalid_window_schema");
      if (!scope.every((key) => window[key] === input[key])) return fail("window_scope_mismatch");
      if (!Array.isArray(window.queries) || window.queries.length > 1000 || !validateMetrics(window.metrics)) return fail("invalid_or_excessive_metrics");
      const ids = new Set();
      for (const query of window.queries) {
        if (!shape(query, ["queryId", "metrics"]) || !text(query.queryId) || ids.has(query.queryId)
          || !validateMetrics(query.metrics)) return fail("invalid_query_metrics_or_duplicate_id");
        ids.add(query.queryId);
      }
      const start = timestamp(window.start);
      const end = timestamp(window.end);
      if (!Number.isSafeInteger(end - start) || end <= start || end > Date.now()) return fail("invalid_window_time");
    }
    const beforeMs = timestamp(input.before.end) - timestamp(input.before.start);
    const afterMs = timestamp(input.after.end) - timestamp(input.after.start);
    if (beforeMs !== afterMs) return fail("unequal_window_duration");
    if (timestamp(input.before.end) > timestamp(input.after.start)) return fail("overlapping_or_reversed_windows");
    result.durationSeconds = beforeMs / 1000;
    const slos = input.slo === undefined ? [] : input.slo;
    if (!Array.isArray(slos) || slos.length > 1000) return fail("invalid_slo");
    const sloKeys = new Set();
    for (const slo of slos) {
      if (!shape(slo, ["metric", "unit", "aggregation", "operator", "threshold"], ["queryId"])
        || !Object.hasOwn(units, slo.metric) || !["delta", "rate"].includes(slo.aggregation)
        || slo.unit !== (slo.aggregation === "rate" ? `${units[slo.metric]}/s` : units[slo.metric])
        || !["lte", "gte"].includes(slo.operator) || !Number.isFinite(slo.threshold) || slo.threshold < 0
        || slo.threshold > Number.MAX_SAFE_INTEGER || (Object.hasOwn(slo, "queryId") && !text(slo.queryId))) return fail("invalid_slo");
      const key = JSON.stringify([slo.queryId ?? null, slo.metric, slo.aggregation]);
      if (sloKeys.has(key)) return fail("duplicate_slo");
      sloKeys.add(key);
    }
    const compare = (before, after) => {
      const left = new Map(before.map((counter) => [counter.metric, counter]));
      const right = new Map(after.map((counter) => [counter.metric, counter]));
      return [...new Set([...left.keys(), ...right.keys()])].map((metric) => {
        const a = left.get(metric), b = right.get(metric);
        const row = { metric, unit: units[metric], status: "insufficient_evidence" };
        if (!a || !b) return { ...row, reason: "metric_missing", missingFrom: a ? "after" : "before" };
        if (new Set([a.start.counterEpoch, a.end.counterEpoch, b.start.counterEpoch, b.end.counterEpoch]).size !== 1) return { ...row, reason: "counter_epoch_mismatch" };
        if (input.before.end === input.after.start && a.end.value !== b.start.value) return { ...row, reason: "inconsistent_shared_boundary" };
        if (a.end.value < a.start.value || b.end.value < b.start.value || b.start.value < a.end.value) return { ...row, reason: "counter_reset_or_decrease" };
        const beforeDelta = a.end.value - a.start.value;
        const afterDelta = b.end.value - b.start.value;
        return { ...row, status: "comparable_observation", counterEpoch: a.start.counterEpoch,
          beforeDelta, afterDelta, deltaChange: afterDelta - beforeDelta,
          beforeRate: beforeDelta / result.durationSeconds, afterRate: afterDelta / result.durationSeconds, rateUnit: `${units[metric]}/s` };
      });
    };
    result.metrics = compare(input.before.metrics, input.after.metrics);
    const beforeQueries = new Map(input.before.queries.map((query) => [query.queryId, query]));
    const afterQueries = new Map(input.after.queries.map((query) => [query.queryId, query]));
    for (const queryId of new Set([...beforeQueries.keys(), ...afterQueries.keys()])) {
      const before = beforeQueries.get(queryId), after = afterQueries.get(queryId);
      if (!before || !after) {
        const side = before ? "after" : "before";
        result.missingQueries[side].push(queryId);
        result.queries.push({ queryId, status: "insufficient_evidence", reason: "query_missing", missingFrom: side, metrics: [] });
      } else {
        const metrics = compare(before.metrics, after.metrics);
        result.queries.push({ queryId, metrics, status: metrics.length && metrics.every((row) => row.status === "comparable_observation") ? "comparable_observation" : "insufficient_evidence" });
      }
    }
    const rows = [...result.metrics, ...result.queries.flatMap((query) => query.metrics)];
    if (!rows.length) result.reasonCodes.push("no_matched_counter_evidence");
    if (rows.some((row) => row.status !== "comparable_observation")) result.reasonCodes.push("counter_evidence_incomparable");
    if (result.queries.some((query) => query.status !== "comparable_observation")) result.reasonCodes.push("query_evidence_missing_or_incomparable");
    result.comparable = result.reasonCodes.length === 0;
    result.status = result.comparable ? "comparable_observations" : "insufficient_evidence";
    for (const slo of slos) {
      const candidates = slo.queryId === undefined ? result.metrics : result.queries.find((query) => query.queryId === slo.queryId)?.metrics || [];
      const row = candidates.find((metric) => metric.metric === slo.metric);
      if (!result.comparable || !row || row.status !== "comparable_observation") {
        result.slo.push({ ...slo, status: "not_evaluated", reason: "comparable_metric_required" });
      } else {
        const before = slo.aggregation === "rate" ? row.beforeRate : row.beforeDelta;
        const after = slo.aggregation === "rate" ? row.afterRate : row.afterDelta;
        const meets = (value) => slo.operator === "lte" ? value <= slo.threshold : value >= slo.threshold;
        result.slo.push({ ...slo, status: "evaluated_supplied_threshold", before, after, beforeMeets: meets(before), afterMeets: meets(after) });
      }
    }
    return result;
  } catch { return fail("malformed_supplied_evidence"); }
}

function blockingTimeline(args = {}) {
  const text = (value) => typeof value === "string" && value.length > 0 && value.length <= 200;
  const time = (value) => {
    const parsed = typeof value === "string" ? Date.parse(value) : NaN;
    if (!Number.isFinite(parsed) || new Date(parsed).toISOString() !== value || parsed > Date.now()) throw new Error("Canonical nonfuture UTC timestamp required");
    return parsed;
  };
  if (!["sqlserver", "postgres", "mysql", "mariadb"].includes(args.engine) || !text(args.systemId) || !text(args.database) ||
      !Array.isArray(args.frames) || !args.frames.length || args.frames.length > 120 ||
      Buffer.byteLength(JSON.stringify(args)) > 2 * 1024 * 1024) throw new Error("Bounded scoped blocking frames required");
  const sessions = new Map(), timeline = [];
  let previousTime = -Infinity, count = 0;
  for (const frame of args.frames) {
    if (["engine", "systemId", "database"].some((key) => frame?.[key] !== args[key]) || !text(frame.evidenceRef) ||
        !Array.isArray(frame.sessions) || frame.sessions.length > 500) throw new Error("Invalid blocking frame scope or evidence");
    const captured = time(frame.capturedAt);
    if (captured <= previousTime) throw new Error("Frames must have distinct ascending capture times");
    previousTime = captured;
    count += frame.sessions.length;
    if (count > 20000) throw new Error("Session observation limit exceeded");
    const byId = new Map();
    for (const session of frame.sessions) {
      if (!text(session.sessionId) || byId.has(session.sessionId) || time(session.startedAt) > captured ||
          !Array.isArray(session.blockedBy) || session.blockedBy.length > 100 || session.blockedBy.some((id) => !text(id)) ||
          new Set(session.blockedBy).size !== session.blockedBy.length) throw new Error("Invalid or duplicate session observation");
      byId.set(session.sessionId, session);
    }
    const key = (session) => JSON.stringify([session.sessionId, session.startedAt]);
    const edges = [], gaps = [], cycles = [];
    for (const session of frame.sessions) {
      const id = key(session);
      if (!sessions.has(id)) sessions.set(id, { sessionId: session.sessionId, startedAt: session.startedAt,
        firstObservedAt: frame.capturedAt, lastObservedAt: frame.capturedAt, observedFrames: 0, blockedFrames: 0 });
      const summary = sessions.get(id);
      summary.lastObservedAt = frame.capturedAt;
      summary.observedFrames++;
      summary.blockedFrames += Number(session.blockedBy.length > 0);
      for (const blocker of session.blockedBy) {
        const target = byId.get(blocker);
        if (!target) gaps.push({ waitingSession: id, blockerSessionId: blocker, reason: "blocker_not_observed_in_frame" });
        else edges.push({ waitingSession: id, blockingSession: key(target) });
      }
    }
    const adjacency = new Map(frame.sessions.map((session) => [key(session), []]));
    for (const edge of edges) adjacency.get(edge.waitingSession).push(edge.blockingSession);
    const visited = new Set(), active = new Set();
    const visit = (id) => {
      if (active.has(id)) { cycles.push({ session: id, reason: "cycle_observed_not_a_database_deadlock_verdict" }); return; }
      if (visited.has(id)) return;
      active.add(id);
      for (const target of adjacency.get(id)) visit(target);
      active.delete(id); visited.add(id);
    };
    for (const id of adjacency.keys()) visit(id);
    const blockers = new Set(edges.map((edge) => edge.blockingSession));
    const roots = frame.sessions.filter((session) => !session.blockedBy.length && blockers.has(key(session))).map(key);
    timeline.push({ capturedAt: frame.capturedAt, evidenceRef: frame.evidenceRef,
      observedSessions: frame.sessions.length, blockedSessions: frame.sessions.filter((session) => session.blockedBy.length).length,
      edges, observedRootBlockers: roots, gaps, cycles });
  }
  return { usp: "blocking_timeline", source: "supplied_session_snapshots", scope: { engine: args.engine, systemId: args.systemId, database: args.database },
    timeline, sessions: [...sessions.values()], status: timeline.some((frame) => frame.gaps.length || frame.cycles.length) ? "requires_investigation" : "observations_available",
    executionAuthorized: false, deadlockProven: false, rootCauseProven: false, continuousBlockingDurationMs: null,
    limitations: ["Session identity includes start time; reused session IDs are not merged across starts",
      "Missing sessions are not assumed terminated or unblocked; sampling gaps hide intermediate changes",
      "Cross-database blockers may be outside supplied scope and remain unresolved",
      "Blocking references and timestamps are supplied, not independently attested",
      "Cycles are observations, not a native deadlock graph; no KILL, cancellation, or remediation executed"] };
}

module.exports = { remember, recall, advisoryCase, advisorWorkflow, recommendationValidity, diagnosticSession, consumeAdminApproval, operationalWindowCompare, blockingTimeline };
