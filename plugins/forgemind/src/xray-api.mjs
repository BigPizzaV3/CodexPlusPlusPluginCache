const SAFE_METHODS = new Set(['GET', 'HEAD']);

export async function executeApiChecks({ config, fetchImpl = fetch, now = () => performance.now() }) {
  const validated = validate(config);
  if (validated.gap) return { receipts: [], findings: [], gaps: [validated.gap] };
  const receipts = [];
  const findings = [];
  const gaps = [];
  for (const check of config.checks) {
    const url = new URL(check.path, config.baseUrl).href;
    const started = now();
    let response;
    try { response = await fetchImpl(url, { method: check.method, redirect: 'error' }); }
    catch (error) { gaps.push({ code: 'FM_XRAY_API_TARGET_UNAVAILABLE', checkId: check.id, surfaceId: 'api', message: `Local API check ${check.id} could not reach its target.`, nextAction: 'Start the configured local API target and rerun Xray.' }); continue; }
    const durationMs = now() - started;
    const receipt = { id: `api-${check.id}`, adapter: 'api-fetch', kind: 'api', status: response.ok ? 'passed' : 'failed', surfaceIds: ['api'], componentIds: ['api-contracts', 'functional-correctness'], url, method: check.method, statusCode: response.status, durationMs, evidence: [`api:${check.id}:${response.status}`] };
    receipts.push(receipt);
    if (!response.ok) findings.push(finding(check, `API check failed: ${check.id}`, `Expected a successful response, received ${response.status}.`, receipt));
    if (config.performance?.responseMs !== undefined && durationMs > config.performance.responseMs) findings.push(finding(check, `Performance budget exceeded: ${check.id}`, `Response took ${durationMs}ms; configured budget is ${config.performance.responseMs}ms.`, receipt));
  }
  return { receipts, findings, gaps };
}

function validate(config) {
  try {
    const base = new URL(config?.baseUrl);
    const safeHost = base.hostname === 'localhost' || base.hostname === '::1' || /^127\./.test(base.hostname) || base.hostname.endsWith('.test');
    const checks = Array.isArray(config?.checks) && config.checks.length > 0 && config.checks.every((check) => SAFE_METHODS.has(check?.method) && /^[a-z0-9-]+$/i.test(check?.id ?? '') && /^\/(?!\/)(?!.*\.\.)(?!.*[#?])[^\s]*$/.test(check?.path ?? ''));
    if (!['http:', 'https:'].includes(base.protocol) || !safeHost || base.username || base.password || !checks) throw new Error('unsafe');
    return {};
  } catch { return { gap: { code: 'FM_XRAY_API_TARGET_UNSAFE', surfaceId: 'api', message: 'Xray API checks require explicit local/test GET or HEAD targets without credentials or unsafe paths.', nextAction: 'Correct the project-local Xray API configuration and rerun Xray.' } }; }
}

function finding(check, title, actual, receipt) { return { id: `finding-${receipt.id}-${title.startsWith('Performance') ? 'performance' : 'status'}`, severity: 'high', surfaces: ['api'], componentIds: receipt.componentIds, title, expected: 'A successful local API response within the configured budget.', actual, evidence: receipt.evidence, reproduction: `${check.method} ${check.path}` }; }
