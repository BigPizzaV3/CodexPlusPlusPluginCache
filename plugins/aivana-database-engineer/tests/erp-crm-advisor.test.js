const test = require("node:test");
const assert = require("node:assert/strict");
const { analyze, getCatalog, evidencePlan } = require("../runtime/erpCrmAdvisor");
const { dispatch } = require("../runtime/orchestrator");

const context = { product: "dynamics-dataverse", productVersion: "9.2", systemId: "crm-prod",
  environment: "production", deployment: "saas" };
const evidence = (observations, overrides = {}) => ({ ...context, ref: "trace-1", sourceType: "telemetry_export",
  observedAt: new Date(Date.now() - 1000).toISOString(), observations, ...overrides });

test("ERP profiles expose explicit coverage and valid rule references", () => {
  const catalog = getCatalog();
  assert.equal(catalog.profiles.length, 13);
  assert.equal(catalog.rules.length, 43);
  assert.equal(new Set(catalog.rules.map((r) => r.id)).size, catalog.rules.length);
  for (const profile of catalog.profiles) {
    const plan = evidencePlan({ product: profile.id });
    assert.equal(plan.nativeConnector, false);
    assert.ok(plan.checks.length >= 21);
    assert.ok(profile.reference.startsWith("https://"));
    for (const signal of profile.signals) assert.ok(plan.checks.some((rule) => rule.signal === signal));
  }
});

test("missing ERP evidence never produces a clean bill of health", () => {
  const result = analyze({ product: context.product });
  assert.equal(result.decision, "insufficient_evidence");
  assert.equal(result.coverage.percent, 0);
  assert.equal(result.findings.length, 0);
  assert.ok(result.missingContext.includes("systemId"));
  assert.ok(result.checks.every((check) => check.status === "not_assessed"));
});

test("vendor findings are prioritized and carry evidence and safe next steps", async () => {
  const result = await dispatch("erp_crm_risk_analyzer", { ...context,
    evidence: [evidence({ tdsWriteAttempt: true, retriesIgnoreBackoff: true })] });
  assert.equal(result.source, "supplied_evidence_analysis");
  assert.equal(result.decision, "review_required");
  assert.equal(result.findings[0].id, "tdsWriteAttempt");
  assert.deepEqual(result.findings[0].evidenceRefs, ["trace-1"]);
  assert.equal(result.rootCauseConfirmed, false);
  assert.equal(result.executionMode, "analysis_only");
});

for (const [name, override, reason] of [
  ["another system", { systemId: "other" }, "scope_mismatch"],
  ["another release", { productVersion: "8.0" }, "scope_mismatch"],
  ["another deployment", { deployment: "on_premises" }, "scope_mismatch"],
  ["stale evidence", { observedAt: "2020-01-01T00:00:00Z" }, "stale_evidence"],
  ["future evidence", { observedAt: "2999-01-01T00:00:00Z" }, "future_evidence"],
  ["invalid date", { observedAt: "yesterday" }, "invalid_timestamp"],
  ["coerced boolean", { observations: { tdsWriteAttempt: "false" } }, "non_boolean_observation"],
  ["other vendor signal", { observations: { suiteqlDialectMix: true } }, "unknown_or_wrong_product_signal"],
  ["unrecognized source", { sourceType: "magic_ai" }, "unsupported_source_type"],
]) {
  test(`ERP rejects ${name}`, () => {
    const result = analyze({ ...context, evidence: [evidence({ tdsWriteAttempt: true }, override)] });
    assert.equal(result.findings.length, 0);
    assert.equal(result.decision, "insufficient_evidence");
    assert.equal(result.invalidEvidence[0].reason, reason);
  });
}

test("contradictory ERP evidence stays unresolved", () => {
  const result = analyze({ ...context, evidence: [evidence({ tdsWriteAttempt: true }),
    evidence({ tdsWriteAttempt: false }, { ref: "trace-2" })] });
  assert.equal(result.checks.find((r) => r.id === "tdsWriteAttempt").status, "conflicting_evidence");
  assert.equal(result.coverage.evaluated, 0);
  assert.equal(result.decision, "insufficient_evidence");
});

test("complete negative evidence only clears supplied indicators, not the platform", () => {
  const observations = Object.fromEntries(evidencePlan(context).checks.map((r) => [r.signal, false]));
  const result = analyze({ ...context, evidence: [evidence(observations)] });
  assert.equal(result.coverage.percent, 100);
  assert.equal(result.decision, "no_indicators_in_supplied_evidence");
  assert.equal(result.exhaustiveCoverage, false);
});

test("ERP derives findings from diagnostic counts without boolean assessments", () => {
  const result = analyze({ ...context, evidence: [evidence(undefined, { metrics: { deadlockCount: 3, duplicatePostingCount: 2 } })] });
  assert.deepEqual(result.findings.map((r) => r.id), ["duplicateBusinessPosting", "deadlockObserved"]);
  assert.deepEqual(result.findings[0].measurements, [{ name: "duplicatePostingCount", value: 2, evidenceRef: "trace-1" }]);
});

test("ERP rejects invented metric values and contradictory assessments", () => {
  for (const value of [-1, "3", NaN, Infinity, 0.5]) {
    const result = analyze({ ...context, evidence: [evidence(undefined, { metrics: { deadlockCount: value } })] });
    assert.equal(result.invalidEvidence[0].reason, "invalid_or_wrong_product_metric");
  }
  const result = analyze({ ...context, evidence: [evidence({ deadlockObserved: false }, { metrics: { deadlockCount: 3 } })] });
  assert.equal(result.invalidEvidence[0].reason, "contradictory_metric_and_observation");
});

test("unknown products and malformed ERP inputs fail explicitly", () => {
  assert.throws(() => analyze({ product: "sap" }), /Unsupported product/);
  assert.throws(() => analyze({ ...context, evidence: {} }), /array/);
  assert.throws(() => analyze({ ...context, maxEvidenceAgeHours: "168" }), /number/);
  assert.throws(() => analyze(null), /object/);
});

test("ERP tools are reachable through normal runtime dispatch", async () => {
  const result = await dispatch("erp_crm_vendor_catalog", {});
  assert.equal(result.profiles.length, 13);
  const plan = await dispatch("erp_crm_evidence_plan", { product: "sage-intacct" });
  assert.ok(plan.supportedMetrics.some((m) => m.name === "ignoredXmlFailureCount"));
});

const { importDiagnostics, collectApi, compareBenchmark } = require("../runtime/diagnosticEvidence");

test("HTTP export detects rate limits and early retries without raw payload output", () => {
  const result = importDiagnostics({ ...context, format: "normalized_events", data: { records: [{
    systemId: context.systemId, timestamp: new Date().toISOString(), eventType: "http", statusCode: 429,
    retryAfterMs: 2000, retryDelayMs: 100, sensitivePayload: "must-not-return",
  }] } });
  assert.equal(result.assessment.findings.length, 2);
  assert.doesNotMatch(JSON.stringify(result), /must-not-return/);
  assert.ok(result.assessment.findings.some((r) => r.id === "retriesIgnoreBackoff"));
});

test("Azure Monitor imports structured columns and rows", () => {
  const result = importDiagnostics({ ...context, format: "azure_monitor", data: { tables: [{ name: "PrimaryResult",
    columns: [{ name: "systemId" }, { name: "TimeGenerated" }, { name: "eventType" }],
    rows: [[context.systemId, new Date().toISOString(), "deadlock"]],
  }] } });
  assert.equal(result.assessment.findings[0].id, "deadlockObserved");
});

test("Salesforce considers the cheapest available plan rather than the worst", () => {
  const result = importDiagnostics({ ...context, product: "salesforce", format: "salesforce_query_plan",
    observedAt: new Date().toISOString(), data: { plans: [{ relativeCost: 3 }, { relativeCost: 0.1 }] } });
  assert.equal(result.assessment.findings.length, 0);
  assert.equal(result.assessment.checks.find((r) => r.id === "nonSelectiveSoql").status, "not_observed");
});

test("Dataverse trace durations use the supplied application SLO", () => {
  const result = importDiagnostics({ ...context, format: "dataverse_plugin_trace", sloMs: 100, data: {
    value: [{ performanceexecutionduration: 150, createdon: new Date().toISOString() }], "@odata.nextLink": "remaining",
  } });
  assert.equal(result.assessment.findings[0].id, "applicationLatencySloExceeded");
  assert.equal(result.partial, true);
});

test("imports reject unknown events, cross-system rows and invalid measurements", () => {
  for (const row of [{ eventType: "invented" }, { eventType: "deadlock", systemId: "other" }, { eventType: "http", statusCode: "429" }]) {
    assert.throws(() => importDiagnostics({ ...context, format: "normalized_events", data: { records: [{
      systemId: context.systemId, timestamp: new Date().toISOString(), ...row,
    }] } }));
  }
});

async function collectorFixture(fn) {
  const changes = { CODEXDB_DATAVERSE_URL: "https://example.crm4.dynamics.com", CODEXDB_DATAVERSE_SYSTEM_ID: context.systemId,
    CODEXDB_DATAVERSE_ACCESS_TOKEN: "test-private-token" };
  const previous = Object.fromEntries(Object.keys(changes).map((key) => [key, process.env[key]]));
  Object.assign(process.env, changes);
  try { return await fn(); }
  finally { for (const [key, value] of Object.entries(previous)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; } }
}

test("live collector uses read-only requests and does not return tokens", async () => {
  await collectorFixture(async () => {
    const result = await collectApi({ ...context, apiVersion: "9.2", sloMs: 100 }, async (url, options) => {
      assert.equal(options.method, "GET");
      assert.equal(options.redirect, "error");
      assert.equal(url.pathname, "/api/data/v9.2/plugintracelogs");
      return Response.json({ value: [{ performanceexecutionduration: 200, createdon: new Date().toISOString() }] });
    });
    assert.equal(result.source, "live_api_diagnostics");
    assert.equal(result.assessment.findings.length, 1);
    assert.doesNotMatch(JSON.stringify(result), /test-private-token/);
  });
});

test("collector refuses cross-origin pagination before forwarding credentials", async () => {
  await collectorFixture(async () => {
    let requests = 0;
    await assert.rejects(collectApi({ ...context, apiVersion: "9.2", sloMs: 100 }, async () => {
      requests++;
      return Response.json({ value: [], "@odata.nextLink": "https://attacker.example/steal" });
    }), /Unsafe/);
    assert.equal(requests, 1);
  });
});

test("collector rejects HTTP errors without exposing response secrets", async () => {
  await collectorFixture(async () => {
    await assert.rejects(collectApi({ ...context, apiVersion: "9.2", sloMs: 100 }, async () =>
      new Response("server-secret", { status: 401 })), (error) => /401/.test(error.message) && !/server-secret/.test(error.message));
  });
});

function benchmarkFixture() {
  const run = { systemId: "db1", workloadId: "lookup", datasetHash: "dataset", parameterSetHash: "params", engine: "postgres",
    concurrency: 1, capturedAt: new Date(Date.now() - 1000).toISOString(),
    samples: Array.from({ length: 10 }, (_, index) => ({ caseId: `case-${index}`, durationMs: 100, rowCount: 1, resultHash: "a".repeat(64), error: false })) };
  return { before: { ...structuredClone(run), runId: "before" }, after: { ...structuredClone(run), runId: "after" } };
}

const { workloadRegressionGuard } = require("../runtime/diagnosticEvidence");
const { repeatedBenchmarkReview, qualificationMatrix } = require("../runtime/diagnosticEvidence");
const { businessReconciliation } = require("../runtime/diagnosticEvidence");
const { selectEvidenceTest } = require("../runtime/diagnosticEvidence");
const { evaluateDiagnosticOutcome, prioritizeBusinessImpact, outcomeEvidenceGate } = require("../runtime/diagnosticEvidence");
const { correlateProcessTraces, measureBusinessOutcome } = require("../runtime/diagnosticEvidence");

function processTraceFixture() {
  return { ...context, spans: ["app", "api", "db", "wait", "plan"].map((layer, index) => ({ ...context,
    id: `record-${index}`, traceId: "trace-1", spanId: `span-${index}`, parentSpanId: index ? `span-${index - 1}` : null,
    processId: "posting", layer, startedAt: new Date(Date.now() - 10000).toISOString(), durationMs: 100,
    evidenceRef: `trace-export:${index}` })) };
}

test("process traces link all five layers only by explicit structural IDs and sanitize references", () => {
  const input = processTraceFixture();
  input.spans[0].evidenceRef = "access_token=secret";
  input.spans[1].queryText = "PRIVATE SQL";
  const result = correlateProcessTraces(input);
  assert.equal(result.links.length, 4);
  assert.deepEqual(result.links.map((link) => link.childLayer), ["api", "db", "wait", "plan"]);
  assert.equal(result.unconnected[0].reason, "explicit_root_no_parent");
  assert.equal(result.rootCauseProven, false);
  assert.equal(result.executionAuthorized, false);
  assert.ok(!JSON.stringify(result).includes("secret"));
  assert.ok(!JSON.stringify(result).includes("PRIVATE SQL"));
  assert.match(result.outputHash, /^[a-f0-9]{64}$/);
});

test("process traces expose ambiguous identities and never join by time or SQL text", () => {
  const input = processTraceFixture();
  input.spans.push({ ...input.spans[1], id: "duplicate-span-record" });
  let result = correlateProcessTraces(input);
  assert.ok(result.ambiguous.some((item) => item.id === "record-2" && item.reason === "multiple_parent_candidates"));
  assert.ok(!result.links.some((link) => link.childId === "record-2"));
  const missing = processTraceFixture();
  missing.spans[1].traceId = "other-trace";
  missing.spans.forEach((span) => { span.queryText = "SELECT same_query"; });
  result = correlateProcessTraces(missing);
  assert.ok(result.unconnected.some((item) => item.id === "record-1" && item.reason === "parent_not_supplied_in_trace"));
  missing.spans[1].traceId = "trace-1";
  missing.spans[1].processId = "other-process";
  assert.ok(correlateProcessTraces(missing).unconnected.some((item) => item.reason === "parent_process_mismatch"));
});

test("process traces reject malformed, stale, cross-scope, excessive and cyclic evidence", () => {
  for (const mutate of [
    (x) => { x.spans = []; }, (x) => { x.spans = Array(513).fill(x.spans[0]); },
    (x) => { x.spans.push(x.spans[0]); }, (x) => { delete x.spans[0].parentSpanId; },
    ...Object.keys(context).map((key) => (x) => { x.spans[0][key] = "other"; }),
    (x) => { x.spans[0].startedAt = "2020-01-01T00:00:00Z"; },
    (x) => { x.spans[0].durationMs = 20000; }, (x) => { x.spans[0].durationMs = "10"; },
    (x) => { x.spans[0].parentSpanId = "span-4"; }, (x) => { x.spans[0].layer = "unknown"; },
    (x) => { x.spans[0].evidenceRef = " "; },
  ]) { const input = processTraceFixture(); mutate(input); assert.throws(() => correlateProcessTraces(input)); }
});

function businessOutcomeFixture() {
  const businessControls = controlFixture();
  const input = { businessControls };
  const now = Date.now();
  for (const [index, side] of ["before", "after"].entries()) {
    const start = now - 120000 + index * 60000;
    const window = { startAt: new Date(start).toISOString(), endAt: new Date(start + 30000).toISOString() };
    const common = { ...context, processId: "posting", cohortHash: "c".repeat(64) };
    input[side] = { ...common, exportId: `process-${side}`, datasetHash: "a".repeat(64), sloMs: 80, window,
      events: [0, 1].map((i) => ({ ...common, eventId: `${side}-${i}`, caseId: `case-${i}`,
        startedAt: new Date(start + i * 1000).toISOString(), durationMs: index ? 50 : 100,
        status: index ? "success" : "error", blockedMs: index ? 0 : 20, evidenceRef: `event:${side}:${i}` })) };
    Object.assign(businessControls[side], common, { window });
  }
  return input;
}

test("business outcomes measure paired success, errors, SLO and blocking with matching controls", () => {
  const input = businessOutcomeFixture();
  input.after.events.reverse();
  input.after.events[0].evidenceRef = "access_token=secret";
  const result = measureBusinessOutcome(input);
  assert.equal(result.decision, "observed_improvement");
  assert.equal(result.baseline.errorCount, 2);
  assert.equal(result.candidate.successRate, 1);
  assert.equal(result.deltas.sloBreachCount, -2);
  assert.equal(result.deltas.totalBlockedMs, -40);
  assert.equal(result.deltas.p95Ms, -50);
  assert.equal(result.business.decision, "matched_supplied_controls");
  assert.equal(result.rootCauseProven, false);
  assert.equal(result.expectedControlCompletenessVerified, false);
  assert.equal(result.monetaryImpact, "unassessed");
  assert.ok(!JSON.stringify(result).includes("secret"));
  assert.match(result.outputHash, /^[a-f0-9]{64}$/);
});

test("business outcomes cannot hide correctness failures or regressions behind improvements", () => {
  const input = businessOutcomeFixture();
  input.businessControls.after.controls[0].rowCount++;
  assert.equal(measureBusinessOutcome(input).decision, "rejected_business_correctness");
  const regression = businessOutcomeFixture();
  regression.after.events[0].durationMs = 500;
  assert.equal(measureBusinessOutcome(regression).decision, "observed_regression");
  const same = businessOutcomeFixture();
  same.after.events.forEach((event) => Object.assign(event, { durationMs: 100, status: "error", blockedMs: 20 }));
  assert.equal(measureBusinessOutcome(same).decision, "no_observed_change");
});

test("business outcomes reject missing, duplicate, incompatible and out-of-window inputs", () => {
  for (const mutate of [
    (x) => { delete x.businessControls; }, (x) => { x.after.events = []; },
    (x) => { x.after.events = Array(1001).fill(x.after.events[0]); },
    (x) => { x.after.events[0].eventId = x.before.events[0].eventId; },
    (x) => { x.after.events[0].caseId = x.after.events[1].caseId; },
    (x) => { x.after.events[0].caseId = "different-cohort-member"; },
    ...Object.keys(context).map((key) => (x) => { x.after.events[0][key] = "other"; }),
    (x) => { x.after.processId = "other"; }, (x) => { x.after.cohortHash = ["c".repeat(64)]; },
    (x) => { x.after.sloMs = 100; }, (x) => { delete x.after.events[0].blockedMs; },
    (x) => { x.after.events[0].blockedMs = 51; }, (x) => { x.after.events[0].status = "unknown"; },
    (x) => { x.after.events[0].durationMs = "10"; }, (x) => { x.after.events[0].evidenceRef = ""; },
    (x) => { x.after.events[0].startedAt = x.after.window.endAt; },
    (x) => { x.after.window.endAt = new Date(Date.parse(x.after.window.endAt) + 1).toISOString(); },
    (x) => { x.after.window = x.before.window; },
    (x) => { x.businessControls.after.processId = "other"; },
    (x) => { x.businessControls.after.cohortHash = "d".repeat(64); },
    (x) => { x.businessControls.before.snapshotHash = x.businessControls.after.snapshotHash = "d".repeat(64); },
    (x) => { x.businessControls.after.window = x.before.window; },
    (x) => { x.businessControls.after.capturedAt = x.after.window.startAt; },
  ]) { const input = businessOutcomeFixture(); mutate(input); assert.throws(() => measureBusinessOutcome(input)); }
});

function outcomeFixture() {
  return { plan: evidenceTestFixture(), testId: "compare-plans", observedOutcomeId: "stable-plan",
    observedAt: new Date(Date.now() - 1000).toISOString(), evidenceRefs: ["trace:123"], resultScope: { ...context } };
}

test("diagnostic outcome narrows only the selected supplied model and binds sanitized evidence", () => {
  const input = outcomeFixture();
  input.evidenceRefs = ["https://user:secret@example.org/trace?access_token=secret"];
  const result = evaluateDiagnosticOutcome(input);
  assert.deepEqual(result.remainingHypotheses, ["missing-index"]);
  assert.deepEqual(result.eliminatedUnderModel, ["parameter-plan"]);
  assert.equal(result.planHash, selectEvidenceTest(input.plan).inputHash);
  assert.equal(result.requiresModelRevision, false);
  assert.equal(result.rootCauseProven, false);
  assert.equal(result.executionAuthorized, false);
  assert.ok(!JSON.stringify(result).includes("secret"));
  const { outputHash, ...body } = result;
  assert.equal(outputHash, require("node:crypto").createHash("sha256").update(JSON.stringify(body)).digest("hex"));
  assert.notEqual(outputHash, evaluateDiagnosticOutcome({ ...input, evidenceRefs: ["another-trace"] }).outputHash);
  input.observedOutcomeId = "unexpected";
  const unknown = evaluateDiagnosticOutcome(input);
  assert.equal(unknown.requiresModelRevision, true);
  assert.deepEqual(unknown.remainingHypotheses, input.plan.hypotheses);
  assert.deepEqual(unknown.eliminatedUnderModel, []);
});

test("diagnostic outcome rejects invented selection, scope, malformed time and missing evidence", () => {
  for (const mutate of [
    (x) => { x.testId = "invented"; }, (x) => { x.plan.tests[0].readOnly = false; },
    (x) => { x.plan.tests.push({ ...structuredClone(x.plan.tests[0]), id: "faster", estimatedMinutes: 1 }); },
    ...Object.keys(context).map((key) => (x) => { x.resultScope[key] = "other"; }),
    (x) => { delete x.resultScope.deployment; }, (x) => { x.resultScope.extra = true; },
    ...[[], [" "], ["x", "x"], ["x".repeat(4001)], Array(129).fill("x")].map((refs) => (x) => { x.evidenceRefs = refs; }),
    ...["2020-01-01T00:00:00Z", "2026-02-30T00:00:00Z", "2026-09-13", new Date(Date.now() + 60000).toISOString()].map((time) => (x) => { x.observedAt = time; }),
  ]) { const input = outcomeFixture(); mutate(input); assert.throws(() => evaluateDiagnosticOutcome(input)); }
});

function impactFixture() {
  return { ...context, processes: ["a", "b"].map((id) => ({ id, name: `Process ${id}`, evidenceRef: `trace:${id}`,
    observedAt: new Date(Date.now() - 1000).toISOString(), affectedTransactions: 10, blockedTransactions: 0,
    p95Ms: null, sloMs: null, criticality: "normal", deadlineAt: null })) };
}

test("business impact uses transparent urgency, explicit missing metrics and deterministic ties", () => {
  const input = impactFixture();
  input.processes.reverse();
  let result = prioritizeBusinessImpact(input);
  assert.deepEqual(result.rankedProcesses.map((p) => p.id), ["a", "b"]);
  assert.deepEqual(result.rankedProcesses[0].unassessed, ["p95Ms", "sloMs", "deadlineAt"]);
  assert.equal(result.rankedProcesses[0].reasons.sloBreached, null);
  assert.equal(result.monetaryImpact, "unassessed");
  Object.assign(input.processes[0], { blockedTransactions: 1, criticality: "critical", evidenceRef: "access_token=secret" });
  Object.assign(input.processes[1], { p95Ms: 200, sloMs: 100, deadlineAt: new Date(Date.now() - 60000).toISOString() });
  result = prioritizeBusinessImpact(input);
  assert.equal(result.rankedProcesses[0].id, "b");
  assert.equal(result.rankedProcesses[1].reasons.deadlineStatus, "overdue");
  assert.ok(!JSON.stringify(result).includes("secret"));
  input.processes[0].blockedTransactions = 0;
  assert.equal(prioritizeBusinessImpact(input).rankedProcesses[0].id, "a");
});

test("business impact rejects coercion, counts, duplicate IDs and names, stale and cross-scope records", () => {
  for (const mutate of [
    (x) => { x.processes = []; }, (x) => { x.processes = Array(129).fill(x.processes[0]); },
    (x) => { x.processes[1].id = "a"; }, (x) => { x.processes[1].name = "Process a"; },
    (x) => { delete x.deployment; }, (x) => { x.processes[0].systemId = "other"; },
    ...["affectedTransactions", "blockedTransactions", "p95Ms", "sloMs"].flatMap((key) => [-1, Infinity, "1"].map((value) => (x) => { x.processes[0][key] = value; })),
    (x) => { x.processes[0].affectedTransactions = 0.5; }, (x) => { x.processes[0].blockedTransactions = 11; },
    (x) => { x.processes[0].sloMs = 0; }, (x) => { x.processes[0].criticality = "urgent"; },
    (x) => { x.processes[0].evidenceRef = " "; }, (x) => { x.processes[0].observedAt = "2020-01-01T00:00:00Z"; },
    (x) => { x.processes[0].observedAt = new Date(Date.now() + 60000).toISOString(); },
    (x) => { x.processes[0].deadlineAt = "2099-01-01T00:00:00Z"; },
  ]) { const input = impactFixture(); mutate(input); assert.throws(() => prioritizeBusinessImpact(input)); }
});

function gateFixture() {
  const measurements = repeatedFixture();
  const businessControls = caseControls();
  for (const pair of measurements.repetitions) for (const run of [pair.before, pair.after]) run.deployment = businessControls.before.deployment;
  return { measurements, businessControls };
}

test("outcome gate requires both performance and business correctness without authorization", () => {
  const input = gateFixture();
  const result = outcomeEvidenceGate(input);
  assert.equal(result.decision, "verified_improvement");
  assert.equal(result.expectedControlCompletenessVerified, false);
  assert.equal(result.executionAuthorized, false);
  assert.equal(result.productionApproval, false);
  input.businessControls.after.controls[0].rowCount++;
  assert.equal(outcomeEvidenceGate(input).decision, "rejected_business_correctness");
  const slow = gateFixture();
  slow.measurements.repetitions[1].after.samples.forEach((sample) => { sample.durationMs = 200; });
  assert.equal(outcomeEvidenceGate(slow).decision, "regression_or_budget_breach");
});

test("outcome gate rejects mismatched baselines, every scope dimension and missing proof", () => {
  for (const mutate of [
    (x) => { delete x.businessControls; },
    (x) => { x.businessControls.before.snapshotHash = x.businessControls.after.snapshotHash = "c".repeat(64); },
    ...Object.keys(context).map((key) => (x) => { x.businessControls.before[key] = x.businessControls.after[key] = "other"; }),
    (x) => { delete x.measurements.repetitions[0].before.deployment; },
    (x) => { x.measurements.repetitions[1].after.deployment = "other"; },
  ]) { const input = gateFixture(); mutate(input); assert.throws(() => outcomeEvidenceGate(input)); }
});

function evidenceTestFixture() {
  const test = { ...context, id: "compare-plans", readOnly: true, estimatedMinutes: 5, requiresEvidence: ["plan-export"],
    outcomes: [{ id: "parameter-dependent", compatibleHypotheses: ["parameter-plan"] }, { id: "stable-plan", compatibleHypotheses: ["missing-index"] }] };
  return { ...context, hypotheses: ["parameter-plan", "missing-index"], availableEvidence: ["plan-export"], tests: [test] };
}

test("next evidence test returns discriminating outcomes without claiming measured information gain", async () => {
  const result = await dispatch("next_evidence_test", evidenceTestFixture());
  assert.equal(result.selectedTestId, "compare-plans");
  assert.equal(result.rankedTests[0].minimumEliminatedUnderModel, 1);
  assert.equal(result.executionAuthorized, false);
  assert.equal(result.measuredInformationGain, false);
});

test("test selection blocks mutations, missing prerequisites and over-budget proposals", () => {
  for (const mutate of [(x) => { x.tests[0].readOnly = false; }, (x) => { x.availableEvidence = []; },
    (x) => { x.maxEstimatedMinutes = 1; }]) {
    const input = evidenceTestFixture(); mutate(input);
    assert.equal(selectEvidenceTest(input).selectedTestId, null);
  }
});

test("test selection refuses optimistic models that hide unresolved or omitted hypotheses", () => {
  const input = evidenceTestFixture();
  input.tests[0].outcomes[0].compatibleHypotheses = [...input.hypotheses];
  assert.equal(selectEvidenceTest(input).selectedTestId, null);
  input.tests[0].outcomes.forEach((o) => { o.compatibleHypotheses = ["missing-index"]; });
  assert.throws(() => selectEvidenceTest(input), /omits/);
});

test("test selector validates exact scope, IDs, costs and unknown outcome references", () => {
  for (const mutate of [(x) => { x.tests[0].systemId = "other"; }, (x) => { x.tests.push(x.tests[0]); },
    (x) => { x.tests[0].estimatedMinutes = "5"; }, (x) => { x.tests[0].outcomes[0].compatibleHypotheses = ["invented"]; },
    (x) => { x.tests[0].outcomes[1].id = x.tests[0].outcomes[0].id; }]) {
    const input = evidenceTestFixture(); mutate(input); assert.throws(() => selectEvidenceTest(input));
  }
});

test("equally discriminating eligible tests prefer lower supplied cost over blocked shortcuts", () => {
  const input = evidenceTestFixture();
  input.tests.push({ ...structuredClone(input.tests[0]), id: "cheaper", estimatedMinutes: 2 });
  input.tests.push({ ...structuredClone(input.tests[0]), id: "unsafe-shortcut", estimatedMinutes: 1, readOnly: false });
  assert.equal(selectEvidenceTest(input).selectedTestId, "cheaper");
});

function controlFixture() {
  const run = { ...context, period: "2026-09", snapshotHash: "a".repeat(64), definitionHash: "b".repeat(64),
    capturedAt: new Date(Date.now() - 1000).toISOString(), controls: [
      { companyId: "DE01", currency: "EUR", unit: "money", metric: "net_sales", amount: "9007199254740993.100000000000000001", rowCount: 5 },
      { companyId: "US01", currency: "USD", unit: "money", metric: "net_sales", amount: "-10.25", rowCount: 2 },
    ] };
  return { before: { ...structuredClone(run), exportId: "original" }, after: { ...structuredClone(run), exportId: "candidate" } };
}

test("business reconciliation preserves exact decimals and ignores group ordering", async () => {
  const input = controlFixture();
  input.after.controls.reverse();
  input.after.controls[0].amount = "-10.2500";
  const result = await dispatch("business_reconciliation_compare", input);
  assert.equal(result.decision, "matched_supplied_controls");
  assert.equal(result.matchedGroups, 2);
  assert.equal(result.productionApproval, false);
});

test("business reconciliation detects differences smaller than floating-point resolution", () => {
  const input = controlFixture();
  input.after.controls[0].amount = "9007199254740993.100000000000000002";
  const result = businessReconciliation(input);
  assert.equal(result.decision, "rejected_business_correctness");
  assert.equal(result.differences[0].amountDelta, "0.000000000000000001");
});

test("business controls reject offsetting company changes and duplicate row counts", () => {
  const input = controlFixture();
  input.after.controls[0].amount = "9007199254740994.100000000000000001";
  input.after.controls[1].amount = "-11.25";
  assert.equal(businessReconciliation(input).differences.length, 2);
  const countOnly = controlFixture();
  countOnly.after.controls[0].rowCount = 6;
  const difference = businessReconciliation(countOnly).differences[0];
  assert.equal(difference.amountChanged, false);
  assert.equal(difference.rowCountChanged, true);
});

test("business control coverage never treats missing groups as zero", () => {
  const input = controlFixture();
  input.after.controls[0].companyId = "DE02";
  const result = businessReconciliation(input);
  assert.deepEqual(result.differences.map((d) => d.reason).sort(), ["missing_group", "unexpected_group"]);
});

test("business controls reject incomparable, stale, duplicate and coerced evidence", () => {
  for (const mutate of [
    (x) => { x.after.systemId = "other"; }, (x) => { x.after.snapshotHash = "c".repeat(64); },
    (x) => { x.after.definitionHash = "c".repeat(64); }, (x) => { x.after.period = "2026-08"; },
    (x) => { x.after.capturedAt = "2020-01-01T00:00:00Z"; }, (x) => { x.after.exportId = x.before.exportId; },
    (x) => { x.after.controls.push(x.after.controls[0]); }, (x) => { x.after.controls = []; },
    ...[0.1, "1e3", "NaN", "0.0000000000000000001", null].map((amount) => (x) => { x.after.controls[0].amount = amount; }),
    (x) => { x.after.controls[0].rowCount = 0; }, (x) => { x.after.controls[0].rowCount = Number.MAX_SAFE_INTEGER + 1; },
  ]) { const input = controlFixture(); mutate(input); assert.throws(() => businessReconciliation(input)); }
});

function repeatedFixture(offset = 100000) {
  return { sampling: { warmupIterations: 2, executionOrder: "alternating", collectionRef: "local-benchmark-log" },
    repetitions: Array.from({ length: 3 }, (_, index) => {
      const pair = benchmarkFixture();
      for (const [name, run] of Object.entries(pair)) {
        Object.assign(run, { environment: "lab", product: "odoo", productVersion: "18", datasetHash: "a".repeat(64), runId: `${offset}-${index}-${name}`,
          capturedAt: new Date(Date.now() - offset + index * 1000 + (name === "after" ? 100 : 0)).toISOString() });
        if (name === "after") run.samples.forEach((s) => { s.durationMs = 50; });
      }
      return pair;
    }) };
}

test("repeated benchmarks require comparable independent runs and report spread without significance claims", () => {
  const result = repeatedBenchmarkReview(repeatedFixture());
  assert.equal(result.decision, "repeatable_observed_improvement");
  assert.deepEqual(result.p95ChangeRange, { min: -50, max: -50, median: -50 });
  assert.equal(result.statisticalSignificanceClaimed, false);
  for (const mutate of [
    (x) => { x.repetitions.pop(); }, (x) => { x.sampling.warmupIterations = 0; },
    (x) => { x.repetitions[1].before.runId = x.repetitions[0].before.runId; },
    (x) => { x.repetitions[1].before.systemId = x.repetitions[1].after.systemId = "other"; },
    (x) => { x.repetitions.reverse(); },
  ]) { const input = repeatedFixture(); mutate(input); assert.throws(() => repeatedBenchmarkReview(input)); }
});

test("one bad repetition or business breach cannot be averaged away", () => {
  const input = repeatedFixture();
  input.repetitions[1].after.samples[0].resultHash = "b".repeat(64);
  assert.equal(repeatedBenchmarkReview(input).decision, "rejected_correctness");
  const budgets = { ...repeatedFixture(), caseBudgets: [{ caseId: "case-0", businessProcess: "Close", maxDurationMs: 20 }] };
  assert.equal(repeatedBenchmarkReview(budgets).decision, "regression_or_budget_breach");
});

function caseControls(offset = 90000) {
  const input = controlFixture();
  for (const run of [input.before, input.after]) Object.assign(run, { systemId: "db1", environment: "lab", product: "odoo", productVersion: "18", capturedAt: new Date(Date.now() - offset).toISOString() });
  return input;
}

function caseProposal() {
  const controls = caseControls().before;
  return { change: "Batch lookups", rollback: "Restore prior application release", testPlan: "Compare result hashes and timings",
    workloadId: "lookup", customizationHash: "c".repeat(64), businessContract: { definitionHash: controls.definitionHash, period: controls.period, deployment: controls.deployment, groups: controls.controls } };
}

test("case lifecycle persists scoped evidence, revision guards, verification and reviewed learning", async () => {
  const scope = { systemId: "db1", environment: "lab", product: "odoo", productVersion: "18" };
  const call = (input) => dispatch("advisory_case", { ...scope, ...input });
  let record = (await call({ action: "create", objective: "Improve order posting" })).case;
  await assert.rejects(call({ action: "read", caseId: record.id, systemId: "other" }), /unavailable/);
  await assert.rejects(call({ action: "propose", caseId: record.id, expectedRevision: 1 }), /transition/);
  const update = async (action, extra) => {
    record = (await call({ action, caseId: record.id, expectedRevision: record.revision, ...extra })).case;
  };
  await update("diagnose", { hypothesis: "Repeated lookups", evidenceRefs: ["trace:123"] });
  await assert.rejects(call({ action: "propose", caseId: record.id, expectedRevision: 1 }), /revision/);
  await update("propose", caseProposal());
  await assert.rejects(call({ action: "approve_test", caseId: record.id, expectedRevision: record.revision, proposalHash: "wrong" }), /proposal/);
  await update("approve_test", { proposalHash: record.proposalHash, reviewer: "local-owner", approvalRef: "ticket-123", approvedAt: new Date(Date.now() - 300000).toISOString() });
  const verify = { action: "verify", caseId: record.id, expectedRevision: record.revision, proposalHash: record.proposalHash, measurements: repeatedFixture(), businessControls: caseControls() };
  await assert.rejects(call({ ...verify, measurements: repeatedFixture(400000) }), /predate/);
  await assert.rejects(call({ ...verify, businessControls: undefined }), /exports/);
  const incomplete = caseControls();
  incomplete.before.controls.pop(); incomplete.after.controls.pop();
  await assert.rejects(call({ ...verify, businessControls: incomplete }), /contracted/);
  await update("verify", { proposalHash: record.proposalHash, measurements: repeatedFixture(), businessControls: caseControls() });
  await assert.rejects(call({ action: "follow_up", caseId: record.id, expectedRevision: record.revision, proposalHash: record.proposalHash, measurements: repeatedFixture(200000), businessControls: caseControls() }), /newer/);
  await update("follow_up", { proposalHash: record.proposalHash, measurements: repeatedFixture(50000), businessControls: caseControls(40000) });
  await update("close", { outcome: "confirmed", corrected: false, reviewer: "owner", note: "Repeated improvements observed; supplied test evidence only" });
  assert.equal(record.status, "closed");
  const report = await call({ action: "quality_report" });
  assert.ok(report.counts.confirmed >= 1);
  const other = await call({ action: "quality_report", productVersion: "different" });
  assert.equal(other.reviewedCases, 0);
  assert.equal(other.confirmationRate, null);
  const matches = await call({ action: "find_confirmed", workloadId: "lookup", customizationHash: "c".repeat(64) });
  assert.ok(matches.matches.some((match) => match.caseId === record.id));
  for (const overrides of [{ productVersion: "different" }, { customizationHash: "d".repeat(64) }, { workloadId: "other" }, { systemId: "other" }]) {
    const mismatch = await call({ action: "find_confirmed", workloadId: "lookup", customizationHash: "c".repeat(64), ...overrides });
    assert.equal(mismatch.matches.length, 0);
  }
});

test("business mismatch blocks confirmed closure despite passing performance", async () => {
  const scope = { systemId: "db1", environment: "lab", product: "odoo", productVersion: "18" };
  let record = (await dispatch("advisory_case", { ...scope, action: "create", objective: "Negative control" })).case;
  const update = async (action, extra) => { record = (await dispatch("advisory_case", { ...scope, action, caseId: record.id, expectedRevision: record.revision, ...extra })).case; };
  await update("diagnose", { hypothesis: "Join amplification", evidenceRefs: ["export-1"] });
  await update("propose", caseProposal());
  await update("approve_test", { proposalHash: record.proposalHash, reviewer: "owner", approvalRef: "test-approval", approvedAt: new Date(Date.now() - 300000).toISOString() });
  const bad = caseControls(); bad.after.controls[0].rowCount++;
  await update("verify", { proposalHash: record.proposalHash, measurements: repeatedFixture(), businessControls: bad });
  await update("follow_up", { proposalHash: record.proposalHash, measurements: repeatedFixture(50000), businessControls: caseControls(40000) });
  await assert.rejects(update("close", { outcome: "confirmed", corrected: false, reviewer: "owner", note: "Too fast to be right" }), /business controls/);
  await update("close", { outcome: "false_positive", corrected: true, reviewer: "owner", note: "Business totals not preserved" });
  assert.equal(record.review.outcome, "false_positive");
});

test("central workflow returns the next bounded step without executing it", async () => {
  const scope = { systemId: "workflow-test", product: "postgres", productVersion: "18", environment: "lab" };
  const created = await dispatch("advisor_workflow", { ...scope, action: "start", objective: "Investigate slow report" });
  assert.equal(created.nextStep.action, "diagnose");
  const resumed = await dispatch("advisor_workflow", { ...scope, action: "resume", caseId: created.case.id });
  assert.equal(resumed.case.revision, 1);
  assert.equal(resumed.executionAuthorized, false);
  await assert.rejects(dispatch("advisor_workflow", { ...scope, action: "apply" }), /start or resume/);
});

function causalFixture() {
  const scope = { systemId: "db1", product: "odoo", productVersion: "18", environment: "lab" };
  return { ...scope, events: ["application", "database"].map((layer, index) => ({ ...scope, id: `e${index}`, layer,
    traceId: "trace-123", startedAt: new Date(Date.now() - 10000).toISOString(), durationMs: 1000, evidenceRef: `trace-export-${index}` })),
    hypotheses: [{ id: "h1", claim: "Database wait may contribute to slow request", supportRefs: ["e0", "e1"], refuteRefs: [] }] };
}

test("causal evidence correlates trace and time without asserting root cause", async () => {
  const result = await dispatch("causal_evidence_review", causalFixture());
  assert.equal(result.hypotheses[0].status, "correlated_hypothesis_not_proven");
  assert.equal(result.rootCauseProven, false);
  assert.equal(result.alternativesProvided, false);
});

test("causal evidence surfaces conflicts and missing correlation", async () => {
  const input = causalFixture();
  input.events[1].traceId = "unrelated";
  assert.equal((await dispatch("causal_evidence_review", input)).hypotheses[0].status, "insufficient_correlated_evidence");
  input.hypotheses[0].supportRefs = ["e0"];
  input.hypotheses[0].refuteRefs = ["e1"];
  assert.equal((await dispatch("causal_evidence_review", input)).hypotheses[0].status, "conflicting_evidence");
});

test("causal evidence rejects dangling, duplicated and cross-system references", async () => {
  for (const mutate of [(x) => { x.events[0].systemId = "other"; }, (x) => { x.events.push(x.events[0]); },
    (x) => { x.hypotheses[0].supportRefs = ["missing"]; }, (x) => { x.hypotheses[0].refuteRefs = ["e0"]; }]) {
    const input = causalFixture(); mutate(input); await assert.rejects(dispatch("causal_evidence_review", input));
  }
});

test("qualification matrix never turns missing or wrong-release receipts into qualification", () => {
  const releaseHash = "a".repeat(64);
  const result = qualificationMatrix({ releaseHash, receipts: [] });
  assert.equal(result.decision, "hold");
  assert.ok(result.checks.every((r) => r.status === "not_run"));
  assert.equal(result.independentlyVerified, false);
  const receipt = { gate: "hosted_ci", status: "passed", releaseHash, reviewer: "owner", evidenceRef: "ci-run", observedAt: new Date().toISOString() };
  for (const receipts of [[receipt, receipt], [{ ...receipt, releaseHash: "b".repeat(64) }], [{ ...receipt, observedAt: "2020-01-01" }]]) {
    assert.throws(() => qualificationMatrix({ releaseHash, receipts }));
  }
});

test("business budgets reject improved cases still above their absolute deadline", () => {
  const input = benchmarkFixture();
  input.after.samples.forEach((s) => { s.durationMs = 50; });
  const result = workloadRegressionGuard({ ...input, caseBudgets: [{ caseId: "case-0", businessProcess: "Order posting", maxDurationMs: 40 }] });
  assert.equal(result.decision, "business_budget_breached");
  assert.equal(result.budgetBreaches[0].newlyBreached, false);
  assert.equal(result.budgetCoverage.assessed, 1);
  assert.equal(result.budgetCoverage.unassessedCaseIds.length, 9);
  assert.match(result.policyHash, /^[a-f0-9]{64}$/);
});

test("business deadlines ignore relative noise floors and track newly breached cases", () => {
  const input = benchmarkFixture();
  input.after.samples[0].durationMs = 100.5;
  const result = workloadRegressionGuard({ ...input, caseBudgets: [{ caseId: "case-0", businessProcess: "Close", maxDurationMs: 100 }] });
  assert.equal(result.regressions.length, 0);
  assert.equal(result.budgetBreaches[0].newlyBreached, true);
  input.after.samples[0].resultHash = "b".repeat(64);
  assert.equal(workloadRegressionGuard({ ...input, caseBudgets: [{ caseId: "case-0", businessProcess: "Close", maxDurationMs: 100 }] }).decision, "rejected_correctness");
});

test("business budgets validate scope, duplicates, labels and finite positive thresholds", () => {
  const valid = { caseId: "case-0", businessProcess: "Close", maxDurationMs: 100 };
  for (const budgets of [{}, [valid, valid], [{ ...valid, caseId: "unknown" }], [{ ...valid, businessProcess: " " }],
    ...[0, -1, Infinity, "100", null].map((value) => [{ ...valid, maxDurationMs: value }])]) {
    assert.throws(() => workloadRegressionGuard({ ...benchmarkFixture(), caseBudgets: budgets }));
  }
});

test("workload guard dispatch exposes deadline evidence and policy fingerprint", async () => {
  const input = { ...benchmarkFixture(), caseBudgets: [{ caseId: "case-0", businessProcess: "Close", maxDurationMs: 100 }] };
  const result = await dispatch("workload_regression_guard", input);
  assert.equal(result.budgetChecks[0].status, "within_observed_budget");
  assert.equal(result.approvalGranted, false);
  const changed = workloadRegressionGuard({ ...input, noiseFloorMs: 2 });
  assert.notEqual(result.policyHash, changed.policyHash);
});

test("workload guard catches case regressions hidden by aggregate improvement", () => {
  const input = benchmarkFixture();
  input.before.samples[0].durationMs = 10;
  input.after.samples.forEach((s) => { s.durationMs = 50; });
  const result = workloadRegressionGuard(input);
  assert.equal(result.aggregateMaskedRegression, true);
  assert.equal(result.decision, "case_regression_detected");
  assert.equal(result.regressions[0].caseId, "case-0");
  assert.equal(result.regressions[0].deltaPct, 400);
  assert.equal(result.approvalGranted, false);
});

test("workload guard preserves correctness rejection and comparison validation", () => {
  const input = benchmarkFixture();
  input.after.samples[0].resultHash = "b".repeat(64);
  assert.equal(workloadRegressionGuard(input).decision, "rejected_correctness");
  input.after.systemId = "another-tenant";
  assert.throws(() => workloadRegressionGuard(input), /systemId/);
});

test("workload guard handles noise, zero baseline and strict numeric budgets", () => {
  const input = benchmarkFixture();
  input.before.samples[0].durationMs = 0;
  input.after.samples[0].durationMs = 0.5;
  assert.equal(workloadRegressionGuard(input).regressions.length, 0);
  input.after.samples[0].durationMs = 2;
  const result = workloadRegressionGuard(input);
  assert.equal(result.regressions[0].deltaPct, null);
  assert.equal(result.statisticalSignificanceClaimed, false);
  for (const bad of [-1, NaN, Infinity, "10", null]) {
    if (bad === null) continue;
    assert.throws(() => workloadRegressionGuard({ ...input, maxCaseRegressionPct: bad }));
    assert.throws(() => workloadRegressionGuard({ ...input, noiseFloorMs: bad }));
  }
});

test("benchmark comparison reports measured p95 improvement", () => {
  const input = benchmarkFixture();
  input.after.samples.forEach((s) => { s.durationMs = 50; });
  const result = compareBenchmark(input);
  assert.equal(result.p95ChangePct, -50);
  assert.equal(result.decision, "within_observed_budget");
  assert.equal(result.statisticalSignificanceClaimed, false);
});

test("faster but semantically different benchmark is rejected", () => {
  const input = benchmarkFixture();
  input.after.samples[0].resultHash = "b".repeat(64);
  assert.equal(compareBenchmark(input).decision, "rejected_correctness");
});

test("incomparable, stale, duplicate and incomplete benchmark evidence fails", () => {
  for (const mutate of [
    (x) => { x.after.datasetHash = "other"; },
    (x) => { x.before.systemId = x.after.systemId = null; },
    (x) => { x.after.samples.pop(); },
    (x) => { x.after.samples[0].caseId = "case-1"; },
    (x) => { x.before.capturedAt = "2020-01-01"; },
    (x) => { x.after.samples[0].error = undefined; },
  ]) { const input = benchmarkFixture(); mutate(input); assert.throws(() => compareBenchmark(input)); }
});

test("benchmark regression and error cases cannot pass", () => {
  const input = benchmarkFixture();
  input.after.samples.forEach((s) => { s.durationMs = 200; });
  assert.equal(compareBenchmark(input).decision, "regression");
  input.after.samples[0].error = true;
  assert.equal(compareBenchmark(input).decision, "rejected_correctness");
});
