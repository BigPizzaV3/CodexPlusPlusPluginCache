const crypto = require("node:crypto");
const { analyze } = require("./erpCrmAdvisor");
const object = (x) => x && typeof x === "object" && !Array.isArray(x);
const numeric = (x) => typeof x === "number" && Number.isFinite(x) && x >= 0;
const digest = (x) => crypto.createHash("sha256").update(JSON.stringify(x)).digest("hex");
const scopeKeys = ["product", "productVersion", "systemId", "environment", "deployment"];
const scope = (args) => Object.fromEntries(scopeKeys.map((key) => [key, args[key]]));

function importDiagnostics(args) {
  if (!object(args) || !object(args.data)) throw new Error("data must be a structured diagnostic export");
  if (Buffer.byteLength(JSON.stringify(args.data)) > 2 * 1024 * 1024) throw new Error("Diagnostic export exceeds 2 MiB");
  const metrics = {};
  const observations = {};
  const timestamps = [];
  let processed = 0;
  const recordTime = (value) => {
    if (typeof value !== "string" || !value.includes("T") || !Number.isFinite(Date.parse(value))) throw new Error("Diagnostic event requires an ISO timestamp");
    timestamps.push(value);
  };
  if (args.format === "salesforce_query_plan") {
    if (args.product !== "salesforce") throw new Error("Salesforce product context required");
    const plans = args.data.plans;
    if (!Array.isArray(plans) || !plans.length || plans.some((p) => !object(p) || !numeric(p.relativeCost))) throw new Error("Invalid Salesforce query plan export");
    observations.nonSelectiveSoql = Math.min(...plans.map((p) => p.relativeCost)) > 1;
    processed = plans.length;
    recordTime(args.observedAt);
  } else if (args.format === "dataverse_plugin_trace") {
    if (args.product !== "dynamics-dataverse") throw new Error("Dataverse product context required");
    if (!numeric(args.sloMs) || args.sloMs === 0) throw new Error("A positive user-defined sloMs is required");
    const rows = args.data.value;
    if (!Array.isArray(rows) || rows.length > 10000) throw new Error("Invalid Dataverse trace export");
    for (const row of rows) {
      if (!object(row) || !numeric(row.performanceexecutionduration)) throw new Error("Invalid plug-in execution duration");
      recordTime(row.createdon);
      metrics.slowRequestCount = (metrics.slowRequestCount || 0) + Number(row.performanceexecutionduration > args.sloMs);
      processed++;
    }
  } else if (["normalized_events", "azure_monitor"].includes(args.format)) {
    let records = args.data.records;
    if (args.format === "azure_monitor") {
      if (args.data.error) throw new Error("Partial or failed Azure Monitor query results are not accepted");
      const table = args.data.tables?.find((item) => item.name === "PrimaryResult");
      if (!table || !Array.isArray(table.columns) || !Array.isArray(table.rows)) throw new Error("Missing Azure Monitor PrimaryResult table");
      const names = table.columns.map((column) => column.name);
      if (names.some((name) => typeof name !== "string") || new Set(names).size !== names.length) throw new Error("Invalid Azure Monitor columns");
      records = table.rows.map((row) => {
        if (!Array.isArray(row) || row.length !== names.length) throw new Error("Invalid Azure Monitor row width");
        return Object.fromEntries(names.map((name, i) => [name === "TimeGenerated" ? "timestamp" : name, row[i]]));
      });
    }
    if (!Array.isArray(records) || records.length > 10000) throw new Error("records must contain at most 10000 events");
    const eventMetrics = { deadlock: "deadlockCount", duplicate_posting: "duplicatePostingCount",
      missing_delta: "missingDeltaChangeCount", tenant_violation: "crossTenantViolationCount",
      reconciliation_mismatch: "reconciliationMismatchCount", business_key_collision: "businessKeyCollisionCount" };
    for (const row of records) {
      if (!object(row)) throw new Error("Invalid event");
      if (row.systemId !== args.systemId) throw new Error("Event systemId does not match collection scope");
      recordTime(row.timestamp);
      if (Object.hasOwn(eventMetrics, row.eventType)) {
        const name = eventMetrics[row.eventType];
        metrics[name] = (metrics[name] || 0) + 1;
      } else if (row.eventType === "http") {
        if (!Number.isInteger(row.statusCode) || row.statusCode < 100 || row.statusCode > 599) throw new Error("Invalid HTTP status code");
        if (row.statusCode === 429) {
          metrics.throttledRequestCount = (metrics.throttledRequestCount || 0) + 1;
          if (row.retryDelayMs !== undefined) {
            if (!numeric(row.retryAfterMs) || !numeric(row.retryDelayMs)) throw new Error("Retry comparison requires numeric retryAfterMs and retryDelayMs");
            metrics.retryAfterViolationCount = (metrics.retryAfterViolationCount || 0) + Number(row.retryDelayMs < row.retryAfterMs);
          }
        }
      } else throw new Error("Unsupported diagnostic eventType");
      processed++;
    }
  } else throw new Error("Unsupported diagnostic export format");
  timestamps.sort((a, b) => Date.parse(a) - Date.parse(b));
  const ref = "export-" + digest(args.data).slice(0, 32);
  const bundle = { ...scope(args), ref, sourceType: args.format === "salesforce_query_plan" ? "query_plan" : "telemetry_export",
    observedAt: timestamps[0] || args.observedAt, metrics, observations };
  // The newest date is checked as well: an old first row must not hide future data.
  if (timestamps.some((date) => Date.parse(date) > Date.now())) throw new Error("Diagnostic export contains future events");
  const assessment = analyze({ ...args, evidence: processed ? [bundle] : [] });
  if (assessment.invalidEvidence.length || assessment.missingContext.length) throw new Error("Diagnostic context, timestamps or freshness failed validation");
  return { usp: "erp_crm_import_diagnostics", format: args.format, recordsProcessed: processed,
    source: "imported_diagnostics", executionMode: "analysis_only", exportHash: digest(args.data),
    evidence: processed ? [bundle] : [], assessment, partial: args.data["@odata.nextLink"] !== undefined,
    samplingBoundary: "Only supplied rows were assessed; missing event types are not cleared" };
}

async function readJson(response) {
  if (!response.ok) throw new Error(`Diagnostic API returned HTTP ${response.status}; response body omitted`);
  const chunks = [];
  let bytes = 0;
  if (!response.body) throw new Error("Diagnostic API returned no body");
  for await (const chunk of response.body) {
    bytes += chunk.length;
    if (bytes > 2 * 1024 * 1024) throw new Error("Diagnostic API response exceeds 2 MiB");
    chunks.push(Buffer.from(chunk));
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

async function collectApi(args, fetchImpl = fetch) {
  const validation = analyze({ ...args, evidence: [] });
  if (validation.missingContext.length) throw new Error("Complete product and system context is required before collection");
  const provider = args.product === "dynamics-dataverse" ? "DATAVERSE" : args.product === "salesforce" ? "SALESFORCE" : null;
  if (!provider) throw new Error("Live API collection currently supports Dataverse traces and Salesforce query plans; use diagnostic imports for other products");
  const origin = process.env[`CODEXDB_${provider}_URL`];
  const token = process.env[`CODEXDB_${provider}_ACCESS_TOKEN`];
  if (!origin || !token) throw new Error("Diagnostic API URL and access token are not configured");
  if (!process.env[`CODEXDB_${provider}_SYSTEM_ID`] || process.env[`CODEXDB_${provider}_SYSTEM_ID`] !== args.systemId) throw new Error("Configured API system scope does not match systemId");
  const base = new URL(origin);
  const suffix = provider === "DATAVERSE" ? ".dynamics.com" : ".salesforce.com";
  if (base.protocol !== "https:" || base.username || base.password || !base.hostname.endsWith(suffix)
    || (base.port && base.port !== "443") || base.pathname !== "/" || base.search || base.hash) throw new Error("Unsupported diagnostic API origin");
  if (!/^\d{1,3}\.\d$/.test(args.apiVersion || "")) throw new Error("Explicit apiVersion such as 9.2 or 65.0 is required");
  const cap = args.maxPages ?? 3;
  if (!Number.isInteger(cap) || cap < 1 || cap > 10) throw new Error("maxPages must be between 1 and 10");
  let url;
  if (provider === "DATAVERSE") {
    url = new URL(`/api/data/v${args.apiVersion}/plugintracelogs`, base);
    url.searchParams.set("$select", "performanceexecutionduration,createdon");
    url.searchParams.set("$orderby", "createdon desc");
    url.searchParams.set("$filter", `createdon ge ${new Date(Date.now() - (args.maxEvidenceAgeHours ?? 168) * 3600000).toISOString()}`);
  } else {
    if (typeof args.soql !== "string" || !/^\s*SELECT\b/i.test(args.soql) || args.soql.length > 20000) throw new Error("A bounded SELECT SOQL statement is required");
    url = new URL(`/services/data/v${args.apiVersion}/query/`, base);
    url.searchParams.set("explain", args.soql);
  }
  const initialPath = url.pathname;
  const rows = [];
  const visited = new Set();
  let data;
  let pages = 0;
  while (url && pages < cap) {
    if (url.origin !== base.origin || url.pathname !== initialPath || url.username || url.password || visited.has(url.href)) throw new Error("Unsafe or cyclic pagination link");
    visited.add(url.href);
    const response = await fetchImpl(url, { method: "GET", redirect: "error",
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json", Prefer: "odata.maxpagesize=100" },
      signal: AbortSignal.timeout(15000) });
    data = await readJson(response);
    pages++;
    if (provider === "SALESFORCE") { url = null; break; }
    if (!Array.isArray(data.value)) throw new Error("Invalid Dataverse trace response");
    rows.push(...data.value);
    if (rows.length > 10000) throw new Error("Diagnostic row limit exceeded");
    url = data["@odata.nextLink"] ? new URL(data["@odata.nextLink"], base) : null;
  }
  const result = importDiagnostics({ ...args,
    format: provider === "DATAVERSE" ? "dataverse_plugin_trace" : "salesforce_query_plan",
    observedAt: new Date().toISOString(), data: provider === "DATAVERSE" ? { value: rows, ...(url ? { "@odata.nextLink": "remaining" } : {}) } : data });
  return { ...result, usp: "erp_crm_collect_api", source: "live_api_diagnostics", pages,
    collectorOrigin: base.origin, tokenReturned: false, collectionScope: "configured_endpoint_and_supplied_product_context" };
}

function compareBenchmark(args) {
  const { before, after } = args;
  if (!object(before) || !object(after)) throw new Error("before and after benchmark runs are required");
  const required = ["systemId", "workloadId", "datasetHash", "parameterSetHash", "engine", "concurrency"];
  for (const key of required) {
    if (before[key] === undefined || after[key] === undefined || before[key] !== after[key]
      || (key !== "concurrency" && (typeof before[key] !== "string" || !before[key].trim()))) throw new Error(`Incomparable benchmark ${key}`);
  }
  if (typeof before.runId !== "string" || !before.runId || typeof after.runId !== "string" || !after.runId || before.runId === after.runId) throw new Error("Distinct benchmark runIds are required");
  for (const run of [before, after]) {
    const time = Date.parse(run.capturedAt);
    if (!Number.isFinite(time) || time > Date.now() || Date.now() - time > 7 * 86400000) throw new Error("Benchmark run is stale or has an invalid timestamp");
  }
  if (Date.parse(after.capturedAt) < Date.parse(before.capturedAt)) throw new Error("Candidate benchmark predates baseline");
  if (!Number.isInteger(before.concurrency) || before.concurrency < 1) throw new Error("Invalid benchmark concurrency");
  const minSamples = args.minSamples ?? 10;
  if (!Number.isInteger(minSamples) || minSamples < 5 || minSamples > 10000) throw new Error("minSamples must be between 5 and 10000");
  const regressionPct = args.maxRegressionPct ?? 5;
  if (!numeric(regressionPct)) throw new Error("Invalid regression threshold");
  for (const run of [before, after]) {
    if (!Array.isArray(run.samples) || run.samples.length < minSamples || run.samples.length > 10000) throw new Error("Insufficient or excessive benchmark samples");
    const seen = new Set();
    for (const sample of run.samples) {
      if (!object(sample) || typeof sample.caseId !== "string" || !sample.caseId || seen.has(sample.caseId)
        || !numeric(sample.durationMs) || !Number.isSafeInteger(sample.rowCount) || sample.rowCount < 0
        || typeof sample.resultHash !== "string" || !/^[a-f0-9]{64}$/i.test(sample.resultHash)
        || typeof sample.error !== "boolean") throw new Error("Invalid benchmark sample or missing result proof");
      seen.add(sample.caseId);
    }
  }
  const afterMap = new Map(after.samples.map((sample) => [sample.caseId, sample]));
  if (before.samples.length !== after.samples.length || before.samples.some((sample) => !afterMap.has(sample.caseId))) throw new Error("Benchmark cases do not match");
  const semanticMismatches = before.samples.filter((sample) => {
    const other = afterMap.get(sample.caseId);
    return sample.resultHash !== other.resultHash || sample.rowCount !== other.rowCount;
  }).map((sample) => sample.caseId);
  const errors = [...before.samples, ...after.samples].filter((sample) => sample.error).length;
  const summary = (samples) => {
    const durations = samples.map((sample) => sample.durationMs).sort((a, b) => a - b);
    return { count: samples.length, p50Ms: durations[Math.ceil(durations.length * 0.5) - 1],
      p95Ms: durations[Math.ceil(durations.length * 0.95) - 1], meanMs: durations.reduce((a, b) => a + b, 0) / durations.length };
  };
  const baseline = summary(before.samples);
  const candidate = summary(after.samples);
  const changePct = baseline.p95Ms > 0 ? (candidate.p95Ms - baseline.p95Ms) / baseline.p95Ms * 100 : null;
  return { usp: "benchmark_evidence_compare", source: "supplied_measurements", baseline, candidate,
    semanticMismatches, errors, p95ChangePct: changePct, maxRegressionPct: regressionPct,
    decision: errors || semanticMismatches.length ? "rejected_correctness" : changePct === null ? "insufficient_resolution"
      : changePct > regressionPct ? "regression" : "within_observed_budget",
    beforeRunId: before.runId, afterRunId: after.runId,
    inputHash: digest({ before, after }), statisticalSignificanceClaimed: false,
    limitations: ["Result hashes and timings are supplied evidence; not independently attested", "Observed samples do not prove production-wide gains"] };
}

function workloadRegressionGuard(args) {
  const comparison = compareBenchmark(args);
  const maxCaseRegressionPct = args.maxCaseRegressionPct ?? 10;
  const noiseFloorMs = args.noiseFloorMs ?? 1;
  if (!numeric(maxCaseRegressionPct) || !numeric(noiseFloorMs)) throw new Error("Invalid case regression budget");
  const candidate = new Map(args.after.samples.map((sample) => [sample.caseId, sample]));
  const caseBudgets = args.caseBudgets ?? [];
  if (!Array.isArray(caseBudgets) || caseBudgets.length > candidate.size) throw new Error("Invalid caseBudgets");
  const seenBudgets = new Set();
  const baselineCases = new Map(args.before.samples.map((sample) => [sample.caseId, sample]));
  const budgetChecks = caseBudgets.map((budget) => {
    if (!object(budget) || !candidate.has(budget.caseId) || seenBudgets.has(budget.caseId)
      || typeof budget.businessProcess !== "string" || !budget.businessProcess.trim() || budget.businessProcess.length > 200
      || !numeric(budget.maxDurationMs) || budget.maxDurationMs === 0) throw new Error("Invalid or duplicate business case budget");
    seenBudgets.add(budget.caseId);
    const beforeMs = baselineCases.get(budget.caseId).durationMs;
    const afterMs = candidate.get(budget.caseId).durationMs;
    const breached = afterMs > budget.maxDurationMs;
    return { caseId: budget.caseId, businessProcess: budget.businessProcess, maxDurationMs: budget.maxDurationMs,
      beforeMs, afterMs, breached, newlyBreached: breached && beforeMs <= budget.maxDurationMs,
      status: breached ? "breached" : "within_observed_budget" };
  });
  const budgetBreaches = budgetChecks.filter((check) => check.breached);
  const regressions = args.before.samples.flatMap((before) => {
    const after = candidate.get(before.caseId);
    const deltaMs = after.durationMs - before.durationMs;
    const deltaPct = before.durationMs > 0 ? deltaMs / before.durationMs * 100 : null;
    if (deltaMs <= noiseFloorMs || (deltaPct !== null && deltaPct <= maxCaseRegressionPct)) return [];
    return [{ caseId: before.caseId, beforeMs: before.durationMs, afterMs: after.durationMs, deltaMs, deltaPct }];
  }).sort((a, b) => b.deltaMs - a.deltaMs);
  const correctnessFailed = comparison.decision === "rejected_correctness";
  return { usp: "workload_regression_guard", source: "supplied_measurements", comparison,
    decision: correctnessFailed ? "rejected_correctness" : budgetBreaches.length ? "business_budget_breached" : regressions.length ? "case_regression_detected" : comparison.decision,
    regressions, casesChecked: args.before.samples.length, maxCaseRegressionPct, noiseFloorMs,
    budgetChecks, budgetBreaches,
    budgetCoverage: { assessed: budgetChecks.length, total: candidate.size, unassessedCaseIds: [...candidate.keys()].filter((id) => !seenBudgets.has(id)) },
    policyHash: digest({ maxCaseRegressionPct, noiseFloorMs, maxRegressionPct: comparison.maxRegressionPct, caseBudgets }),
    aggregateMaskedRegression: !correctnessFailed && comparison.decision === "within_observed_budget" && regressions.length > 0,
    nextAction: correctnessFailed ? "resolve_result_mismatches_or_errors" : budgetBreaches.length ? "review_business_budget_breaches_with_process_owner" : regressions.length ? "repeat_flagged_cases_under_controlled_load" : "review_representative_workload_before_approval",
    approvalGranted: false, statisticalSignificanceClaimed: false,
    limitations: [...comparison.limitations, "Single paired cases flag review candidates, not statistically established regressions"] };
}

function repeatedBenchmarkReview(args) {
  if (!Array.isArray(args.repetitions) || args.repetitions.length < 3 || args.repetitions.length > 30) throw new Error("Supply 3 to 30 paired repetitions");
  if (!object(args.sampling) || !Number.isSafeInteger(args.sampling.warmupIterations) || args.sampling.warmupIterations < 1
    || !["alternating", "randomized"].includes(args.sampling.executionOrder)
    || typeof args.sampling.collectionRef !== "string" || !args.sampling.collectionRef.trim() || args.sampling.collectionRef.length > 4000) throw new Error("Warm-up and execution-order evidence required");
  const minImprovementPct = args.minImprovementPct ?? 5;
  if (!numeric(minImprovementPct) || minImprovementPct > 100) throw new Error("Invalid minimum improvement");
  const seen = new Set();
  let workloadFingerprint;
  let lastTime = -Infinity;
  const reviews = args.repetitions.map((pair) => {
    const review = workloadRegressionGuard({ ...pair, minSamples: args.minSamples, maxRegressionPct: args.maxRegressionPct,
      maxCaseRegressionPct: args.maxCaseRegressionPct, noiseFloorMs: args.noiseFloorMs, caseBudgets: args.caseBudgets });
    for (const run of [pair.before, pair.after]) {
      const fingerprint = digest(Object.fromEntries(["systemId", "environment", "product", "productVersion", "workloadId", "datasetHash", "parameterSetHash", "engine", "concurrency"].map((key) => [key, run[key] ?? null])));
      if (workloadFingerprint && workloadFingerprint !== fingerprint) throw new Error("Repeated benchmark workload or scope changed");
      workloadFingerprint = fingerprint;
      if (seen.has(run.runId)) throw new Error("Repeated run IDs are not independent evidence");
      seen.add(run.runId);
    }
    if (Date.parse(pair.before.capturedAt) <= lastTime) throw new Error("Repetitions must be chronologically separate");
    lastTime = Date.parse(pair.after.capturedAt);
    return review;
  });
  const changes = reviews.map((r) => r.comparison.p95ChangePct).filter((value) => value !== null).sort((a, b) => a - b);
  const allImproved = reviews.every((r) => r.decision === "within_observed_budget" && r.comparison.p95ChangePct !== null && r.comparison.p95ChangePct < 0 && r.comparison.p95ChangePct <= -minImprovementPct);
  return { usp: "repeated_benchmark_review", source: "supplied_measurements", workloadFingerprint,
    policyHash: digest({ guard: reviews[0].policyHash, minImprovementPct, minSamples: args.minSamples ?? 10 }),
    decision: reviews.some((r) => r.decision === "rejected_correctness") ? "rejected_correctness"
      : reviews.some((r) => ["regression", "case_regression_detected", "business_budget_breached"].includes(r.decision)) ? "regression_or_budget_breach"
      : allImproved ? "repeatable_observed_improvement" : "inconclusive",
    repetitionCount: reviews.length, minImprovementPct,
    p95ChangeRange: changes.length ? { min: changes[0], max: changes.at(-1), median: changes[Math.floor(changes.length / 2)] } : null,
    firstCapturedAt: args.repetitions[0].before.capturedAt, lastCapturedAt: args.repetitions.at(-1).after.capturedAt,
    evidenceHashes: reviews.map((r) => r.comparison.inputHash), reviews,
    sampling: { warmupIterations: args.sampling.warmupIterations, executionOrder: args.sampling.executionOrder,
      collectionRef: require("./auditLogger").sanitizeObject(args.sampling.collectionRef), attestation: "supplied_not_independently_verified" },
    statisticalSignificanceClaimed: false, productionApproval: false };
}

function qualificationMatrix(args) {
  const gates = ["second_machine_install", "hosted_ci", "sqlserver_auth_matrix", "dataverse_tenant", "salesforce_tenant", "production_configuration", "customer_benchmark", "privacy_terms_published"];
  if (!Array.isArray(args.receipts) || args.receipts.length > gates.length) throw new Error("Bounded qualification receipts required");
  if (typeof args.releaseHash !== "string" || !/^[a-f0-9]{64}$/.test(args.releaseHash)) throw new Error("Release SHA256 required");
  const seen = new Set();
  for (const r of args.receipts) {
    if (!object(r) || !gates.includes(r.gate) || seen.has(r.gate) || !["passed", "failed"].includes(r.status)
      || r.releaseHash !== args.releaseHash || typeof r.evidenceRef !== "string" || !r.evidenceRef.trim()
      || typeof r.reviewer !== "string" || !r.reviewer.trim()
      || !Number.isFinite(Date.parse(r.observedAt)) || Date.parse(r.observedAt) > Date.now()
      || Date.now() - Date.parse(r.observedAt) > 30 * 86400000) throw new Error("Invalid, duplicate, stale or wrong-release receipt");
    seen.add(r.gate);
  }
  const checks = gates.map((gate) => {
    const r = args.receipts.find((receipt) => receipt.gate === gate);
    return r ? require("./auditLogger").sanitizeObject({ gate, status: r.status, releaseHash: r.releaseHash,
      evidenceRef: r.evidenceRef, reviewer: r.reviewer, observedAt: r.observedAt }) : { gate, status: "not_run" };
  });
  return { usp: "release_qualification_matrix", source: "supplied_receipts", releaseHash: args.releaseHash, checks,
    decision: checks.every((r) => r.status === "passed") ? "ready_for_independent_review" : "hold",
    publicationAuthorized: false, independentlyVerified: false };
}

function businessReconciliation(args) {
  const { before, after } = args;
  if (!object(before) || !object(after)) throw new Error("Two business control exports are required");
  const dimensions = ["companyId", "currency", "unit", "metric"];
  const text = (value) => typeof value === "string" && value.trim().length > 0 && value.length <= 160;
  const decimal = (value) => {
    if (typeof value !== "string" || !/^-?(?:0|[1-9]\d{0,37})(?:\.\d{1,18})?$/.test(value)) throw new Error("Amounts require plain decimal strings (up to 38 integer and 18 fractional digits)");
    const negative = value.startsWith("-");
    const [whole, fraction = ""] = (negative ? value.slice(1) : value).split(".");
    return (negative ? -1n : 1n) * BigInt(whole + fraction.padEnd(18, "0"));
  };
  const display = (value) => {
    const negative = value < 0n;
    const digits = (negative ? -value : value).toString().padStart(19, "0");
    const fraction = digits.slice(-18).replace(/0+$/, "");
    return `${negative ? "-" : ""}${digits.slice(0, -18)}${fraction ? "." + fraction : ""}`;
  };
  for (const key of [...scopeKeys, "period", "snapshotHash", "definitionHash"]) {
    if (!text(before[key]) || before[key] !== after[key]) throw new Error(`Incomparable business export ${key}`);
  }
  for (const key of ["snapshotHash", "definitionHash"]) {
    if (!/^[a-f0-9]{64}$/.test(before[key])) throw new Error(`Invalid ${key}`);
  }
  if (!text(before.exportId) || !text(after.exportId) || before.exportId === after.exportId) throw new Error("Distinct export IDs required");
  const toMap = (run) => {
    if (typeof run.capturedAt !== "string" || !run.capturedAt.includes("T") || !Number.isFinite(Date.parse(run.capturedAt))
      || Date.parse(run.capturedAt) > Date.now() || Date.now() - Date.parse(run.capturedAt) > 7 * 86400000) throw new Error("Business export requires a fresh timestamp");
    if (!Array.isArray(run.controls) || run.controls.length < 1 || run.controls.length > 10000) throw new Error("Supply 1 to 10000 control groups");
    const map = new Map();
    for (const control of run.controls) {
      if (!object(control) || dimensions.some((key) => !text(control[key])) || !Number.isSafeInteger(control.rowCount) || control.rowCount < 0) throw new Error("Control dimensions and exact row count required");
      const key = JSON.stringify(dimensions.map((dimension) => control[dimension]));
      if (map.has(key)) throw new Error("Duplicate business control group");
      const amount = decimal(control.amount);
      if (control.rowCount === 0 && amount !== 0n) throw new Error("Empty control group cannot have a nonzero total");
      map.set(key, { dimensions: Object.fromEntries(dimensions.map((d) => [d, control[d]])), amount, rowCount: control.rowCount });
    }
    return map;
  };
  const baseline = toMap(before);
  const candidate = toMap(after);
  if (Date.parse(after.capturedAt) < Date.parse(before.capturedAt)) throw new Error("Candidate export predates baseline");
  const differences = [];
  let matchedGroups = 0;
  for (const key of [...new Set([...baseline.keys(), ...candidate.keys()])].sort()) {
    const a = baseline.get(key);
    const b = candidate.get(key);
    if (!a || !b) {
      differences.push({ ...(a || b).dimensions, reason: a ? "missing_group" : "unexpected_group" });
    } else if (a.amount !== b.amount || a.rowCount !== b.rowCount) {
      differences.push({ ...a.dimensions, reason: "control_mismatch", beforeAmount: display(a.amount), afterAmount: display(b.amount),
        amountDelta: display(b.amount - a.amount), beforeRowCount: a.rowCount, afterRowCount: b.rowCount,
        amountChanged: a.amount !== b.amount, rowCountChanged: a.rowCount !== b.rowCount });
    } else matchedGroups++;
  }
  return { usp: "business_reconciliation_compare", source: "supplied_control_exports",
    decision: differences.length ? "rejected_business_correctness" : "matched_supplied_controls",
    scope: scope(before), period: before.period, matchedGroups, beforeGroups: baseline.size, afterGroups: candidate.size,
    differences, inputHash: digest({ before, after }), snapshotHash: before.snapshotHash, definitionHash: before.definitionHash,
    precision: "exact_base10_no_float_rounding", productionApproval: false,
    limitations: ["Equal aggregates do not prove row-level or business-semantic equivalence", "Snapshot and control definitions are supplied, not independently attested", "No implicit currency conversion or cross-company netting"] };
}

function correlateHypotheses(args) {
  const fields = ["systemId", "environment", "product", "productVersion"];
  const validText = (v) => typeof v === "string" && v.trim().length > 0 && v.length <= 1000;
  if (fields.some((key) => !validText(args[key])) || !Array.isArray(args.events) || !args.events.length || args.events.length > 200
    || !Array.isArray(args.hypotheses) || !args.hypotheses.length || args.hypotheses.length > 20) throw new Error("Scoped events and bounded hypotheses required");
  const events = new Map();
  for (const event of args.events) {
    if (!object(event) || !validText(event.id) || events.has(event.id) || !validText(event.traceId)
      || !["application", "integration", "database"].includes(event.layer) || fields.some((key) => event[key] !== args[key])
      || !numeric(event.durationMs) || event.durationMs > 86400000 || !validText(event.evidenceRef)
      || typeof event.startedAt !== "string" || !event.startedAt.includes("T") || !Number.isFinite(Date.parse(event.startedAt))
      || Date.parse(event.startedAt) + event.durationMs > Date.now() || Date.now() - Date.parse(event.startedAt) > 7 * 86400000) throw new Error("Invalid, stale, duplicate or cross-scope event");
    events.set(event.id, event);
  }
  const ids = new Set();
  const hypotheses = args.hypotheses.map((hypothesis) => {
    if (!object(hypothesis) || !validText(hypothesis.id) || ids.has(hypothesis.id) || !validText(hypothesis.claim)) throw new Error("Unique hypothesis ID and claim required");
    ids.add(hypothesis.id);
    for (const refs of [hypothesis.supportRefs, hypothesis.refuteRefs]) {
      if (!Array.isArray(refs) || refs.length > 200 || new Set(refs).size !== refs.length || refs.some((ref) => !events.has(ref))) throw new Error("Hypothesis references must resolve to unique events");
    }
    if (hypothesis.supportRefs.some((ref) => hypothesis.refuteRefs.includes(ref))) throw new Error("One event cannot both support and refute the same hypothesis");
    const support = hypothesis.supportRefs.map((ref) => events.get(ref));
    const sameTrace = support.length >= 2 && new Set(support.map((event) => event.traceId)).size === 1;
    const layers = [...new Set(support.map((event) => event.layer))];
    const overlapping = support.length >= 2 && Math.max(...support.map((event) => Date.parse(event.startedAt)))
      <= Math.min(...support.map((event) => Date.parse(event.startedAt) + event.durationMs));
    const correlated = sameTrace && layers.length >= 2 && overlapping;
    return { id: hypothesis.id, claim: require("./auditLogger").sanitizeObject(hypothesis.claim),
      supportRefs: hypothesis.supportRefs, refuteRefs: hypothesis.refuteRefs, sameTrace, layers, overlapping,
      status: hypothesis.refuteRefs.length ? (support.length ? "conflicting_evidence" : "refuted_by_supplied_evidence")
        : correlated ? "correlated_hypothesis_not_proven" : "insufficient_correlated_evidence" };
  });
  return { usp: "causal_evidence_review", source: "supplied_event_evidence", scope: Object.fromEntries(fields.map((key) => [key, args[key]])),
    hypotheses, evidenceIndex: [...events.values()].map((event) => require("./auditLogger").sanitizeObject({ id: event.id,
      traceId: event.traceId, layer: event.layer, evidenceRef: event.evidenceRef, startedAt: event.startedAt, durationMs: event.durationMs })),
    alternativesProvided: hypotheses.length > 1, inputHash: digest(args), rootCauseProven: false,
    nextAction: hypotheses.some((h) => h.refuteRefs.length) ? "resolve_conflicting_evidence" : "design_controlled_discriminating_test",
    limitations: ["Support/refutation labels and trace IDs are supplied, not independently verified", "Overlapping cross-layer events show correlation, not causation", "Nonoverlapping events can still be causally related; absence of overlap is not exoneration"] };
}

function selectEvidenceTest(args) {
  const text = (x) => typeof x === "string" && x.trim().length > 0 && x.length <= 200;
  const uniqueStrings = (items, max) => Array.isArray(items) && items.length <= max && items.every(text) && new Set(items).size === items.length;
  if (scopeKeys.some((key) => !text(args[key])) || !uniqueStrings(args.hypotheses, 20) || args.hypotheses.length < 2
    || !uniqueStrings(args.availableEvidence, 100) || !Array.isArray(args.tests) || !args.tests.length || args.tests.length > 50) throw new Error("Scoped hypotheses, evidence and bounded tests required");
  const budget = args.maxEstimatedMinutes ?? 30;
  if (!numeric(budget) || budget === 0) throw new Error("Positive test-time budget required");
  const seen = new Set();
  const ranked = args.tests.map((test) => {
    if (!object(test) || !text(test.id) || seen.has(test.id) || typeof test.readOnly !== "boolean"
      || !numeric(test.estimatedMinutes) || test.estimatedMinutes === 0 || !uniqueStrings(test.requiresEvidence, 100)
      || !Array.isArray(test.outcomes) || test.outcomes.length < 2 || test.outcomes.length > 20
      || scopeKeys.some((key) => test[key] !== args[key])) throw new Error("Invalid, duplicate or cross-scope test");
    seen.add(test.id);
    const outcomeIds = new Set();
    const covered = new Set();
    const outcomes = test.outcomes.map((outcome) => {
      if (!object(outcome) || !text(outcome.id) || outcomeIds.has(outcome.id)
        || !uniqueStrings(outcome.compatibleHypotheses, 20) || !outcome.compatibleHypotheses.length
        || outcome.compatibleHypotheses.some((id) => !args.hypotheses.includes(id))) throw new Error("Invalid test outcome model");
      outcomeIds.add(outcome.id);
      outcome.compatibleHypotheses.forEach((id) => covered.add(id));
      return { id: outcome.id, remainingHypotheses: [...outcome.compatibleHypotheses],
        eliminatedUnderModel: args.hypotheses.filter((id) => !outcome.compatibleHypotheses.includes(id)) };
    });
    if (covered.size !== args.hypotheses.length) throw new Error("Outcome model silently omits a hypothesis");
    const blockers = [];
    if (!test.readOnly) blockers.push("requires_separate_mutation_approval");
    if (test.estimatedMinutes > budget) blockers.push("estimated_time_exceeds_budget");
    const missingEvidence = test.requiresEvidence.filter((ref) => !args.availableEvidence.includes(ref));
    if (missingEvidence.length) blockers.push("missing_prerequisite_evidence");
    const worstCaseRemaining = Math.max(...outcomes.map((outcome) => outcome.remainingHypotheses.length));
    const minimumEliminatedUnderModel = args.hypotheses.length - worstCaseRemaining;
    if (!minimumEliminatedUnderModel) blockers.push("no_worst_case_discrimination");
    return { id: test.id, estimatedMinutes: test.estimatedMinutes, blockers, missingEvidence, outcomes,
      worstCaseRemaining, minimumEliminatedUnderModel, eligible: !blockers.length };
  }).sort((a, b) => Number(b.eligible) - Number(a.eligible) || b.minimumEliminatedUnderModel - a.minimumEliminatedUnderModel
    || a.estimatedMinutes - b.estimatedMinutes || a.id.localeCompare(b.id));
  const selected = ranked.find((test) => test.eligible);
  return { usp: "next_evidence_test", source: "supplied_test_models", scope: scope(args),
    decision: selected ? "test_proposal_ready_for_review" : "needs_better_test_or_evidence",
    selectedTestId: selected?.id ?? null, rankedTests: ranked, maxEstimatedMinutes: budget, inputHash: digest(args),
    executionAuthorized: false, measuredInformationGain: false,
    unexpectedOutcomeAction: "stop_and_revise_hypotheses_and_outcome_model",
    limitations: ["Outcome compatibility, completeness and cost are supplied assumptions, not learned probabilities",
      "Hypothesis elimination is valid only under the supplied model; it is not proof of root cause",
      "A read-only label does not verify SQL safety or authorize a production test"] };
}

const boundedText = (value, max = 200) => typeof value === "string" && value.trim().length > 0 && value.length <= max;
function isoTime(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(value)
    || !Number.isFinite(Date.parse(value)) || new Date(`${value.slice(0, 19)}Z`).toISOString().slice(0, 19) !== value.slice(0, 19)) throw new Error("Valid ISO timestamp required");
  return Date.parse(value);
}
function freshTime(value, now) {
  const time = isoTime(value);
  if (time > now || now - time > 7 * 86400000) throw new Error("Observation is stale or in the future");
  return time;
}
function fullScope(value) {
  if (!object(value) || scopeKeys.some((key) => !boundedText(value[key]))) throw new Error("Complete bounded five-field scope required");
  return scope(value);
}
function hashedOutput(result) {
  const clean = require("./auditLogger").sanitizeObject(result);
  return { ...clean, outputHash: digest(clean) };
}

function evaluateDiagnosticOutcome(args) {
  if (!object(args) || !object(args.plan)) throw new Error("Original diagnostic plan required");
  const selection = selectEvidenceTest(args.plan);
  const resultScope = fullScope(args.resultScope);
  if (Object.keys(args.resultScope).length !== scopeKeys.length || scopeKeys.some((key) => resultScope[key] !== selection.scope[key])) throw new Error("Result scope differs from plan");
  if (!boundedText(args.testId) || args.testId !== selection.selectedTestId) throw new Error("Only the selected eligible test can be evaluated");
  if (!boundedText(args.observedOutcomeId) || !Array.isArray(args.evidenceRefs) || !args.evidenceRefs.length || args.evidenceRefs.length > 128
    || args.evidenceRefs.some((ref) => !boundedText(ref, 4000)) || new Set(args.evidenceRefs.map((ref) => ref.trim())).size !== args.evidenceRefs.length) throw new Error("Bounded outcome and unique supplied evidence references required");
  freshTime(args.observedAt, Date.now());
  const outcome = selection.rankedTests.find((test) => test.id === args.testId).outcomes.find((item) => item.id === args.observedOutcomeId);
  return hashedOutput({ usp: "diagnostic_outcome_review", source: "supplied_outcome_evidence", scope: resultScope,
    testId: args.testId, observedOutcomeId: args.observedOutcomeId, observedAt: args.observedAt, evidenceRefs: args.evidenceRefs,
    planHash: selection.inputHash, inputHash: digest(args), requiresModelRevision: !outcome,
    decision: outcome ? "narrowed_under_supplied_model" : "stop_and_revise_model",
    remainingHypotheses: outcome ? outcome.remainingHypotheses : [...args.plan.hypotheses], eliminatedUnderModel: outcome ? outcome.eliminatedUnderModel : [],
    rootCauseProven: false, executionAuthorized: false, independentlyVerified: false,
    limitations: ["References and observed outcomes are supplied, not independently verified", "Elimination holds only under the supplied outcome model; it proves no causality"] });
}

function prioritizeBusinessImpact(args) {
  const resultScope = fullScope(args);
  if (!Array.isArray(args.processes) || !args.processes.length || args.processes.length > 128) throw new Error("Supply 1 to 128 business processes");
  const now = Date.now();
  const ids = new Set();
  const names = new Set();
  const rankedProcesses = args.processes.map((p) => {
    if (!object(p) || !boundedText(p.id) || !boundedText(p.name) || ids.has(p.id.trim()) || names.has(p.name.trim())
      || !boundedText(p.evidenceRef, 4000) || !["critical", "high", "normal"].includes(p.criticality)
      || !Number.isSafeInteger(p.affectedTransactions) || p.affectedTransactions < 0 || !Number.isSafeInteger(p.blockedTransactions)
      || p.blockedTransactions < 0 || p.blockedTransactions > p.affectedTransactions
      || (p.p95Ms != null && !numeric(p.p95Ms)) || (p.sloMs != null && (!numeric(p.sloMs) || p.sloMs === 0))
      || scopeKeys.some((key) => Object.hasOwn(p, key) && p[key] !== args[key])) throw new Error("Invalid, duplicate or cross-scope business process");
    ids.add(p.id.trim()); names.add(p.name.trim()); freshTime(p.observedAt, now);
    const deadline = p.deadlineAt == null ? null : isoTime(p.deadlineAt);
    if (deadline !== null && Math.abs(deadline - now) > 366 * 86400000) throw new Error("Deadline exceeds one-year assessment bounds");
    const sloBreached = p.p95Ms == null || p.sloMs == null ? null : p.p95Ms > p.sloMs;
    const criticalityRank = { critical: 3, high: 2, normal: 1 }[p.criticality];
    return { id: p.id, name: p.name, evidenceRef: p.evidenceRef, observedAt: p.observedAt, criticality: p.criticality,
      affectedTransactions: p.affectedTransactions, blockedTransactions: p.blockedTransactions, p95Ms: p.p95Ms ?? null, sloMs: p.sloMs ?? null, deadlineAt: p.deadlineAt ?? null,
      unassessed: [p.p95Ms == null && "p95Ms", p.sloMs == null && "sloMs", deadline === null && "deadlineAt"].filter(Boolean),
      reasons: { blockedTransactions: p.blockedTransactions, criticality: p.criticality, sloBreached, deadlineStatus: deadline === null ? "unassessed" : deadline <= now ? "overdue" : "upcoming", affectedTransactions: p.affectedTransactions },
      urgencyKey: [p.blockedTransactions > 0 ? criticalityRank : 0, Number(sloBreached === true), deadline === null ? 0 : deadline <= now ? 2 : 1,
        deadline === null ? 0 : -deadline, p.blockedTransactions, criticalityRank, p.affectedTransactions] };
  });
  rankedProcesses.sort((a, b) => {
    for (let i = 0; i < a.urgencyKey.length; i++) if (a.urgencyKey[i] !== b.urgencyKey[i]) return b.urgencyKey[i] - a.urgencyKey[i];
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
  return hashedOutput({ usp: "business_impact_priority", source: "supplied_business_metrics", scope: resultScope, rankedProcesses,
    assessedAt: new Date(now).toISOString(), inputHash: digest(args), executionAuthorized: false, monetaryImpact: "unassessed",
    ordering: ["blocked_criticality_desc", "slo_breached_first", "overdue_then_upcoming_then_unassessed", "earliest_deadline", "blocked_transactions_desc", "criticality_desc", "affected_transactions_desc", "id_ascending"],
    limitations: ["Lexicographic urgency is not an AI score or ROI estimate", "Missing metrics are unassessed, not zero; supplied evidence is not independently attested"] });
}

function outcomeEvidenceGate(args) {
  if (!object(args) || !object(args.measurements) || !object(args.businessControls)) throw new Error("Measurements and business control exports required");
  const performance = repeatedBenchmarkReview(args.measurements);
  const business = businessReconciliation(args.businessControls);
  const resultScope = fullScope(args.businessControls.before);
  const now = Date.now();
  for (const run of [args.businessControls.before, args.businessControls.after, ...args.measurements.repetitions.flatMap((pair) => [pair.before, pair.after])]) {
    fullScope(run); freshTime(run.capturedAt, now);
    if (scopeKeys.some((key) => run[key] !== resultScope[key])) throw new Error("Benchmark and business control scope mismatch");
  }
  if (args.measurements.repetitions.some((pair) => [pair.before, pair.after].some((run) => run.datasetHash !== business.snapshotHash))) throw new Error("Benchmark dataset and business snapshot mismatch");
  return hashedOutput({ usp: "outcome_evidence_gate", source: "supplied_measurements_and_controls", scope: resultScope, performance, business,
    decision: business.decision !== "matched_supplied_controls" ? "rejected_business_correctness" : performance.decision === "repeatable_observed_improvement" ? "verified_improvement" : performance.decision,
    inputHash: digest(args), productionApproval: false, executionAuthorized: false, rootCauseProven: false,
    expectedControlCompletenessVerified: false,
    limitations: ["Passing supplied evidence is not independent attestation, causality proof or production authorization",
      "Without independently trusted approved case groups, matching supplied controls cannot attest expected completeness"] });
}

function matchingScope(value, expected) {
  fullScope(value);
  if (scopeKeys.some((key) => value[key] !== expected[key])) throw new Error("Evidence scope mismatch");
}

function correlateProcessTraces(args) {
  const resultScope = fullScope(args);
  if (!Array.isArray(args.spans) || !args.spans.length || args.spans.length > 512
    || Buffer.byteLength(JSON.stringify(args)) > 2 * 1024 * 1024) throw new Error("Supply 1 to 512 bounded spans");
  const now = Date.now();
  const ids = new Set();
  const bySpan = new Map();
  const key = (traceId, spanId) => JSON.stringify([traceId, spanId]);
  const spans = args.spans.map((span) => {
    matchingScope(span, resultScope);
    if (!["id", "traceId", "spanId", "processId"].every((field) => boundedText(span[field])) || ids.has(span.id)
      || (span.parentSpanId !== null && !boundedText(span.parentSpanId)) || !["app", "api", "db", "wait", "plan"].includes(span.layer)
      || !boundedText(span.evidenceRef, 4000) || !numeric(span.durationMs) || span.durationMs > 86400000) throw new Error("Invalid or duplicate span evidence");
    const started = freshTime(span.startedAt, now);
    if (started + span.durationMs > now) throw new Error("Span ends in the future");
    ids.add(span.id);
    const clean = { id: span.id, traceId: span.traceId, spanId: span.spanId, parentSpanId: span.parentSpanId,
      processId: span.processId, layer: span.layer, startedAt: span.startedAt, durationMs: span.durationMs, evidenceRef: span.evidenceRef };
    const index = key(span.traceId, span.spanId);
    if (!bySpan.has(index)) bySpan.set(index, []);
    bySpan.get(index).push(clean);
    return clean;
  });
  const links = [], unconnected = [], ambiguous = [];
  for (const span of spans) {
    const own = bySpan.get(key(span.traceId, span.spanId));
    if (own.length > 1) { ambiguous.push({ id: span.id, reason: "duplicate_trace_span_identity", candidateIds: own.map((s) => s.id) }); continue; }
    if (span.parentSpanId === null) { unconnected.push({ id: span.id, reason: "explicit_root_no_parent" }); continue; }
    const parents = bySpan.get(key(span.traceId, span.parentSpanId)) || [];
    if (parents.length > 1) { ambiguous.push({ id: span.id, reason: "multiple_parent_candidates", candidateIds: parents.map((s) => s.id) }); continue; }
    if (!parents.length) { unconnected.push({ id: span.id, reason: "parent_not_supplied_in_trace" }); continue; }
    const parent = parents[0];
    if (parent.processId !== span.processId) { unconnected.push({ id: span.id, reason: "parent_process_mismatch" }); continue; }
    links.push({ parentId: parent.id, childId: span.id, traceId: span.traceId, processId: span.processId,
      parentLayer: parent.layer, childLayer: span.layer, basis: "supplied_trace_and_parent_span_ids" });
  }
  const parentByChild = new Map(links.map((link) => [link.childId, link.parentId]));
  // Parent cycles invalidate structural evidence even when every individual ID resolves.
  for (const span of spans) {
    const path = new Set();
    let id = span.id;
    while (parentByChild.has(id)) {
      if (path.has(id)) throw new Error("Cyclic span parent relationship");
      path.add(id); id = parentByChild.get(id);
    }
  }
  return hashedOutput({ usp: "process_trace_correlation", source: "supplied_trace_spans", scope: resultScope, spans, links, unconnected, ambiguous,
    inputHash: digest(args), rootCauseProven: false, executionAuthorized: false,
    limitations: ["Explicit roots have no parent; unresolved and ambiguous mappings are not inferred",
      "Supplied trace structure is not independently attested and proves no causality", "Time proximity and query text are never join keys; durations may overlap and are not summed"] });
}

function measureBusinessOutcome(args) {
  if (!object(args) || !object(args.before) || !object(args.after) || !object(args.businessControls)
    || Buffer.byteLength(JSON.stringify(args)) > 2 * 1024 * 1024) throw new Error("Bounded process runs and business controls required");
  const resultScope = fullScope(args.before);
  const now = Date.now();
  const seenEvents = new Set();
  const readWindow = (window) => {
    if (!object(window)) throw new Error("Explicit measurement window required");
    const start = freshTime(window.startAt, now), end = freshTime(window.endAt, now);
    if (end <= start || end - start > 86400000) throw new Error("Measurement window must be positive and at most 24 hours");
    return { start, end };
  };
  const summarize = (run) => {
    matchingScope(run, resultScope);
    if (!boundedText(run.exportId) || !boundedText(run.processId) || typeof run.cohortHash !== "string" || !/^[a-f0-9]{64}$/.test(run.cohortHash)
      || typeof run.datasetHash !== "string" || !/^[a-f0-9]{64}$/.test(run.datasetHash) || !numeric(run.sloMs) || run.sloMs === 0
      || !Array.isArray(run.events) || !run.events.length || run.events.length > 1000) throw new Error("Process, cohort, dataset, SLO and 1 to 1000 events required");
    const window = readWindow(run.window);
    const cases = new Set();
    for (const event of run.events) {
      matchingScope(event, resultScope);
      if (!boundedText(event.eventId) || seenEvents.has(event.eventId) || !boundedText(event.caseId) || cases.has(event.caseId)
        || event.processId !== run.processId || event.cohortHash !== run.cohortHash || !["success", "error"].includes(event.status)
        || !numeric(event.durationMs) || !numeric(event.blockedMs) || event.blockedMs > event.durationMs
        || !boundedText(event.evidenceRef, 4000)) throw new Error("Invalid, duplicate or incompatible process event");
      const started = freshTime(event.startedAt, now);
      if (started < window.start || started >= window.end || started + event.durationMs > window.end) throw new Error("Process event outside measurement window");
      seenEvents.add(event.eventId); cases.add(event.caseId);
    }
    const durations = run.events.map((event) => event.durationMs).sort((a, b) => a - b);
    const count = run.events.length;
    const successCount = run.events.filter((event) => event.status === "success").length;
    const sloBreachCount = run.events.filter((event) => event.durationMs > run.sloMs).length;
    const blockedCount = run.events.filter((event) => event.blockedMs > 0).length;
    return { window, cases, metrics: { eventCount: count, successCount, errorCount: count - successCount,
      successRate: successCount / count, errorRate: (count - successCount) / count,
      sloBreachCount, sloBreachRate: sloBreachCount / count, blockedCount, blockedRate: blockedCount / count,
      totalBlockedMs: run.events.reduce((sum, event) => sum + event.blockedMs, 0),
      meanMs: durations.reduce((sum, duration) => sum + duration, 0) / count, p95Ms: durations[Math.ceil(count * 0.95) - 1] } };
  };
  const before = summarize(args.before), after = summarize(args.after);
  if (args.before.exportId === args.after.exportId || ["processId", "cohortHash", "datasetHash", "sloMs"].some((key) => args.before[key] !== args.after[key])
    || before.window.end > after.window.start || before.window.end - before.window.start !== after.window.end - after.window.start
    || before.cases.size !== after.cases.size || [...before.cases].some((id) => !after.cases.has(id))) throw new Error("Incompatible process, cohort or measurement windows");
  const business = businessReconciliation(args.businessControls);
  for (const side of ["before", "after"]) {
    const control = args.businessControls[side], run = args[side];
    matchingScope(control, resultScope);
    const window = readWindow(control.window), expected = side === "before" ? before.window : after.window;
    if (control.processId !== run.processId || control.cohortHash !== run.cohortHash || control.snapshotHash !== run.datasetHash
      || window.start !== expected.start || window.end !== expected.end || freshTime(control.capturedAt, now) < window.end) throw new Error("Business controls do not match process, cohort, snapshot or window");
  }
  const deltas = Object.fromEntries(Object.keys(before.metrics).map((key) => [key, after.metrics[key] - before.metrics[key]]));
  const lowerIsBetter = ["errorCount", "sloBreachCount", "blockedCount", "totalBlockedMs", "meanMs", "p95Ms"];
  const regressions = lowerIsBetter.filter((key) => deltas[key] > 0), improvements = lowerIsBetter.filter((key) => deltas[key] < 0);
  return hashedOutput({ usp: "business_outcome_measurement", source: "supplied_process_events_and_controls", scope: resultScope,
    processId: args.before.processId, cohortHash: args.before.cohortHash, sloMs: args.before.sloMs,
    windows: { before: args.before.window, after: args.after.window }, baseline: before.metrics, candidate: after.metrics, deltas, regressions, improvements, business,
    evidenceRefs: [...new Set([...args.before.events, ...args.after.events].map((event) => event.evidenceRef))],
    decision: business.decision !== "matched_supplied_controls" ? "rejected_business_correctness" : regressions.length ? "observed_regression" : improvements.length ? "observed_improvement" : "no_observed_change",
    inputHash: digest(args), rootCauseProven: false, executionAuthorized: false, monetaryImpact: "unassessed", expectedControlCompletenessVerified: false,
    limitations: ["Matched supplied case IDs and equal-duration windows do not attest representative or complete cohorts",
      "Control completeness requires a trusted external process contract", "Observed differences are not causal, statistically significant or ROI estimates; blocking is per-event elapsed time, not summed wait spans"] });
}

function consultingProject(context, args) {
  const identifier = (value) => typeof value === "string" && /^[A-Za-z0-9][A-Za-z0-9_.-]{0,99}$/.test(value);
  if (!object(args) || !identifier(args.tenantId) || !identifier(args.projectId)
    || !["create", "get", "update", "export"].includes(args.action)) throw new Error("Explicit tenantId, projectId and supported action required");
  const sections = ["goals", "systems", "findings", "decisions", "evidence"];
  const cleanText = (value) => {
    if (!boundedText(value, 4000)) throw new Error("Bounded nonempty project text required");
    return require("./auditLogger").sanitizeObject(value)
      .replace(/-----BEGIN [^-]*PRIVATE KEY-----[\s\S]*?-----END [^-]*PRIVATE KEY-----/g, "[redacted]")
      .replace(/\b(password|pwd|secret|token|api[_-]?key|authorization|credential)\s*[:=]\s*(?:"[^"]*"|'[^']*'|[^\s;]+)/gi, "$1=[redacted]");
  };
  const refs = (value) => {
    if (!Array.isArray(value) || value.length > 100 || value.some((id) => !identifier(id)) || new Set(value).size !== value.length) throw new Error("Unique bounded evidence IDs required");
    return [...value];
  };
  const path = require("node:path");
  const file = context.stateFile || path.join(process.env.CODEXDB_STATE_DIR || path.join(process.cwd(), ".codexdb"), "runtime-state.json");
  return require("./stateStore").withState(file, (db) => {
    db.exec("CREATE TABLE IF NOT EXISTS consulting_projects (tenant_id TEXT NOT NULL, project_id TEXT NOT NULL, revision INTEGER NOT NULL, value TEXT NOT NULL, PRIMARY KEY(tenant_id,project_id))");
    const stored = db.prepare("SELECT value FROM consulting_projects WHERE tenant_id=? AND project_id=?").get(args.tenantId, args.projectId);
    if (args.action === "create" ? Boolean(stored) : !stored) throw new Error(args.action === "create" ? "Project already exists" : "Project unavailable in tenant");
    const now = new Date().toISOString();
    let project = stored ? JSON.parse(stored.value) : { tenantId: args.tenantId, projectId: args.projectId, revision: 0,
      createdAt: now, ...Object.fromEntries(sections.map((key) => [key, []])), acceptance: { status: "pending" } };
    if (["create", "update"].includes(args.action)) {
      if (args.action === "update" && (!Number.isSafeInteger(args.expectedRevision) || args.expectedRevision !== project.revision)) throw new Error("Project revision conflict");
      if (!object(args.data) || !Object.keys(args.data).length || Object.keys(args.data).some((key) => ![...sections, "acceptance"].includes(key))) throw new Error("Explicit supported project sections required");
      for (const key of sections) if (Object.hasOwn(args.data, key)) {
        const rows = args.data[key];
        if (!Array.isArray(rows) || rows.length > 100) throw new Error("Project section exceeds 100 entries");
        const ids = new Set();
        project[key] = rows.map((row) => {
          if (!object(row) || !identifier(row.id) || ids.has(row.id) || Object.keys(row).some((field) => !["id", "text", "evidenceRefs"].includes(field))) throw new Error("Invalid or duplicate project entry");
          ids.add(row.id);
          return { id: row.id, text: cleanText(row.text), evidenceRefs: refs(row.evidenceRefs ?? []) };
        });
      }
      if (!project.goals.length || !project.systems.length) throw new Error("Project requires goals and systems");
      if (sections.some((key) => Object.hasOwn(args.data, key))) project.acceptance = { status: "pending" };
      if (Object.hasOwn(args.data, "acceptance")) {
        const a = args.data.acceptance;
        if (!object(a) || !["pending", "accepted", "rejected"].includes(a.status)
          || Object.keys(a).some((key) => !["status", "reviewer", "recordedAt", "note", "evidenceRefs"].includes(key))) throw new Error("Invalid supplied acceptance");
        if (a.status === "pending") project.acceptance = { status: "pending" };
        else {
          const evidenceRefs = refs(a.evidenceRefs);
          if (!evidenceRefs.length || isoTime(a.recordedAt) > Date.now()) throw new Error("Acceptance requires nonfuture timestamp and evidence");
          project.acceptance = { status: a.status, reviewer: cleanText(a.reviewer), recordedAt: a.recordedAt, note: cleanText(a.note), evidenceRefs,
            attestation: "supplied_not_independently_verified" };
        }
      }
      const evidenceIds = new Set(project.evidence.map((entry) => entry.id));
      for (const entry of [...sections.flatMap((key) => project[key]), project.acceptance]) {
        if ((entry.evidenceRefs || []).some((id) => !evidenceIds.has(id))) throw new Error("Dangling project evidence reference");
      }
      project = { ...project, revision: project.revision + 1, updatedAt: now };
      const value = JSON.stringify(project);
      if (Buffer.byteLength(value) > 1024 * 1024) throw new Error("Project exceeds 1 MiB");
      if (args.action === "create") db.prepare("INSERT INTO consulting_projects(tenant_id,project_id,revision,value) VALUES(?,?,?,?)").run(args.tenantId, args.projectId, project.revision, value);
      else {
        const result = db.prepare("UPDATE consulting_projects SET revision=?,value=? WHERE tenant_id=? AND project_id=? AND revision=?").run(project.revision, value, args.tenantId, args.projectId, args.expectedRevision);
        if (result.changes !== 1) throw new Error("Project revision conflict");
      }
    }
    const result = { project, executionAuthorized: false, approvalGranted: false,
      limitations: ["Tenant/project separation is local namespacing, not authentication or authorization", "Acceptance is a supplied statement, not independently verified approval", "Do not supply secrets; recognizable credential patterns are redacted, arbitrary confidential text cannot be identified reliably"] };
    if (args.action !== "export") return result;
    if (!["json", "markdown"].includes(args.format)) throw new Error("Export format must be json or markdown");
    // Encode user text before Markdown parsing; it can never introduce HTML, links or fences.
    const md = (value) => Array.from(String(value)).map((char) => `&#${char.codePointAt(0)};`).join("");
    const report = args.format === "json" ? JSON.stringify(result, null, 2) : ["# Consulting Project", `Project: ${md(project.projectId)}`,
      `Tenant: ${md(project.tenantId)}`, `Revision: ${project.revision}`, ...sections.flatMap((key) => [`## ${key}`,
        ...project[key].map((entry) => `- ${md(entry.id)}: ${md(entry.text)} (Evidence: ${md(entry.evidenceRefs.join(", "))})`)]),
      "## Acceptance", md(JSON.stringify(project.acceptance)), "## Limitations", ...result.limitations.map(md), "Execution authorized: false"].join("\n\n");
    return { ...result, format: args.format, report, reportHash: digest(report) };
  });
}

module.exports = { importDiagnostics, collectApi, compareBenchmark, workloadRegressionGuard, repeatedBenchmarkReview, qualificationMatrix, businessReconciliation, correlateHypotheses, selectEvidenceTest, evaluateDiagnosticOutcome, prioritizeBusinessImpact, outcomeEvidenceGate, correlateProcessTraces, measureBusinessOutcome, consultingProject };
