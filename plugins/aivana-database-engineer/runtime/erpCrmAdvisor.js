const catalog = require("./erp-crm-catalog.json");

const deployments = new Set(["saas", "on_premises", "private_cloud"]);
const sources = new Set(["telemetry_export", "application_trace", "query_plan", "configuration_review", "manual_review"]);
const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
const metricSignals = {
  slowRequestCount: "applicationLatencySloExceeded",
  throttledRequestCount: "apiThrottlingObserved",
  deadlockCount: "deadlockObserved",
  crossTenantViolationCount: "tenantScopeLeak",
  duplicatePostingCount: "duplicateBusinessPosting",
  missingDeltaChangeCount: "lostDeltaChanges",
  retryAfterViolationCount: "retriesIgnoreBackoff",
  reconciliationMismatchCount: "missingReconciliation",
  businessKeyCollisionCount: "businessKeyCollision",
  ignoredXmlFailureCount: "xmlBusinessFailureIgnored",
};
const isRecord = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const isLabel = (value) => typeof value === "string" && /^[A-Za-z0-9][A-Za-z0-9_.:/ -]{0,99}$/.test(value);

function getCatalog() {
  return { usp: "erp_crm_vendor_catalog", ...structuredClone(catalog),
    liveApiCollectors: ["dataverse_plugin_trace", "salesforce_query_plan"],
    source: "reference_catalog", availableSourceTypes: [...sources],
    executionMode: "analysis_only", exhaustiveCoverage: false };
}

function selectProfile(args) {
  const profile = catalog.profiles.find((item) => item.id === args.product);
  if (!profile) throw new Error("Unsupported product; use erp_crm_vendor_catalog for explicit product IDs");
  return profile;
}

function getRules(profile) {
  return catalog.rules.filter((rule) => rule.products.includes("*") || rule.products.includes(profile.id));
}

function evidencePlan(args = {}) {
  const profile = selectProfile(args);
  return {
    usp: "erp_crm_evidence_plan", product: profile.id, profile: structuredClone(profile),
    source: "reference_catalog", executionMode: "analysis_only", nativeConnector: false,
    collectionTool: ["dynamics-dataverse", "salesforce"].includes(profile.id) ? "erp_crm_collect_api" : null,
    requiredContext: ["product", "productVersion", "systemId", "environment", "deployment"],
    acceptedSources: [...sources], collect: profile.collect,
    supportedMetrics: Object.entries(metricSignals).filter(([, signal]) => getRules(profile).some((rule) => rule.signal === signal))
      .map(([name, signal]) => ({ name, signal, type: "nonnegative_integer", riskWhen: "greater_than_zero" })),
    checks: getRules(profile).map(({ id, signal, title, nextStep, owner, reference, basis }) =>
      ({ id, signal, title, nextStep, owner, reference: reference || null, basis, expectedValue: "boolean risk indicator, never assumed false" })),
    boundaries: ["Configured API collectors are read-only; native SQL access is not implied",
      "Collect redacted evidence using the vendor-supported interface",
      "Do not execute generated SQL or modify vendor-managed tables",
      "Validate behavior against the actual product release and customization inventory"],
  };
}

function analyze(args = {}) {
  if (!isRecord(args)) throw new Error("Arguments must be an object");
  const profile = selectProfile(args);
  const rules = getRules(profile);
  const maxAgeHours = args.maxEvidenceAgeHours ?? 168;
  if (!Number.isFinite(maxAgeHours) || maxAgeHours < 1 || maxAgeHours > 8760) {
    throw new Error("maxEvidenceAgeHours must be a number between 1 and 8760");
  }
  const bundles = args.evidence ?? [];
  if (!Array.isArray(bundles) || bundles.length > 200) throw new Error("evidence must be an array of at most 200 bundles");
  const missingContext = ["productVersion", "systemId", "environment"].filter((key) => !isLabel(args[key]));
  if (!deployments.has(args.deployment)) missingContext.push("deployment");
  const invalidEvidence = [];
  const accepted = [];
  const refs = new Set();
  const now = Date.now();
  const allowedSignals = new Set(rules.map((rule) => rule.signal));
  for (const [index, bundle] of bundles.entries()) {
    let reason;
    if (!isRecord(bundle) || (!isRecord(bundle.observations) && !isRecord(bundle.metrics))) reason = "invalid_bundle";
    else if (bundle.observations !== undefined && !isRecord(bundle.observations)) reason = "invalid_observations";
    else if (bundle.metrics !== undefined && !isRecord(bundle.metrics)) reason = "invalid_metrics";
    else if (!isLabel(bundle.ref) || refs.has(bundle.ref)) reason = "invalid_or_duplicate_reference";
    else if (missingContext.length) reason = "missing_system_context";
    else if (["product", "productVersion", "systemId", "environment", "deployment"].some((key) => bundle[key] !== args[key])) reason = "scope_mismatch";
    else if (!sources.has(bundle.sourceType)) reason = "unsupported_source_type";
    else if (typeof bundle.observedAt !== "string" || !/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(bundle.observedAt) || !Number.isFinite(Date.parse(bundle.observedAt))) reason = "invalid_timestamp";
    else if (Date.parse(bundle.observedAt) > now) reason = "future_evidence";
    else if (now - Date.parse(bundle.observedAt) > maxAgeHours * 3600000) reason = "stale_evidence";
    else if (Object.values(bundle.observations || {}).some((value) => typeof value !== "boolean")) reason = "non_boolean_observation";
    else if (Object.keys(bundle.observations || {}).some((key) => !allowedSignals.has(key))) reason = "unknown_or_wrong_product_signal";
    else if (Object.entries(bundle.metrics || {}).some(([key, value]) => !Object.hasOwn(metricSignals, key)
      || !allowedSignals.has(metricSignals[key]) || !Number.isSafeInteger(value) || value < 0)) reason = "invalid_or_wrong_product_metric";
    const observations = reason ? {} : { ...(bundle.observations || {}) };
    if (!reason) {
      for (const [key, value] of Object.entries(bundle.metrics || {})) {
        const signal = metricSignals[key];
        if (Object.hasOwn(observations, signal) && observations[signal] !== (value > 0)) reason = "contradictory_metric_and_observation";
        observations[signal] = value > 0;
      }
    }
    if (reason) invalidEvidence.push({ index, reason });
    else {
      refs.add(bundle.ref);
      accepted.push({ ...bundle, observations });
    }
  }
  const checks = rules.map((rule) => {
    const supporting = accepted.filter((bundle) => Object.hasOwn(bundle.observations, rule.signal));
    const values = new Set(supporting.map((bundle) => bundle.observations[rule.signal]));
    const status = values.size > 1 ? "conflicting_evidence" : values.size === 0 ? "not_assessed"
      : values.has(true) ? "risk_indicator" : "not_observed";
    return { id: rule.id, title: rule.title, area: rule.area, severity: rule.severity, status,
      evidenceRefs: supporting.map((bundle) => bundle.ref),
      evidenceTypes: [...new Set(supporting.map((bundle) => bundle.sourceType))],
      measurements: supporting.flatMap((bundle) => Object.entries(bundle.metrics || {})
        .filter(([name]) => metricSignals[name] === rule.signal)
        .map(([name, value]) => ({ name, value, evidenceRef: bundle.ref }))),
      owner: rule.owner, nextStep: rule.nextStep, basis: rule.basis,
      reference: rule.reference || null };
  });
  const findings = checks.filter((check) => check.status === "risk_indicator")
    .sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity] || a.id.localeCompare(b.id));
  const unresolved = checks.filter((check) => ["not_assessed", "conflicting_evidence"].includes(check.status));
  const evaluated = checks.length - unresolved.length;
  return {
    usp: "erp_crm_risk_analyzer", product: profile.id, productName: profile.name,
    catalogVersion: catalog.version, referenceReviewedAt: catalog.reviewedAt,
    source: "supplied_evidence_analysis", executionMode: "analysis_only",
    nativeConnector: false, exhaustiveCoverage: false, rootCauseConfirmed: false,
    decision: findings.length ? "review_required" : unresolved.length || invalidEvidence.length || missingContext.length
      ? "insufficient_evidence" : "no_indicators_in_supplied_evidence",
    missingContext, invalidEvidence, findings, checks,
    coverage: { applicable: checks.length, evaluated, unresolved: unresolved.length,
      percent: Math.round(evaluated / checks.length * 100), scope: "catalog_checks_only" },
    maxEvidenceAgeHours: maxAgeHours,
    nextActions: [...findings, ...unresolved].map(({ id, owner, nextStep, status }) => ({ id, owner, nextStep, status })),
    limitations: ["Input observations are supplied assessments, not independently verified telemetry",
      "No indicators is not proof of a healthy, secure or compliant ERP/CRM system",
      "Coverage excludes unknown modules, customizations and vendor releases not reviewed",
      "SQL Server/PostgreSQL connectivity does not imply native support for SaaS, HANA or Oracle Database"],
  };
}

module.exports = { getCatalog, evidencePlan, analyze };
