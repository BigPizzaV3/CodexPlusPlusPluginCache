import { ForgeMindError } from '../errors.mjs';
import { appendFlightEvent } from './flight.mjs';
import { stableId, verifyRecord } from './integrity.mjs';
import { saveForgeRecord } from './store.mjs';

const CONSTRAINT_TYPES = ['forbid-path', 'require-evidence', 'max-user-steps'];
const METRIC_DIRECTIONS = ['decrease-by-percent', 'increase-by-percent', 'min', 'max'];

export async function compileStrategy({ workspace, input, now = new Date() }) {
  validateStrategy(input);
  const constraints = input.constraints.map((rule) => ({ id: rule.id, type: rule.type, value: rule.value }));
  const metrics = input.metrics.map((metric) => ({ id: metric.id, direction: metric.direction, target: Number(metric.target), baseline: metric.baseline === undefined ? null : Number(metric.baseline), guardrail: Boolean(metric.guardrail) }));
  const record = {
    schemaVersion: 1,
    protocol: 'forgemind-executable-strategy-v1',
    id: stableId('strategy', input),
    compiledAt: now.toISOString(),
    name: input.name,
    goal: input.goal,
    nonGoals: [...new Set(input.nonGoals ?? [])].sort(),
    constraints,
    metrics,
    acceptanceRules: constraints.map((rule) => ({ id: `accept_${rule.id}`, sourceConstraint: rule.id, assertion: rule.type, expected: rule.value })),
    telemetry: metrics.map((metric) => ({ metricId: metric.id, required: true, direction: metric.direction, target: metric.target, baseline: metric.baseline, guardrail: metric.guardrail })),
    policyAdditions: {
      protectedPathPatterns: constraints.filter((rule) => rule.type === 'forbid-path').map((rule) => String(rule.value)).sort(),
      requiredEvidence: constraints.filter((rule) => rule.type === 'require-evidence').map((rule) => String(rule.value)).sort(),
      maximumUserSteps: constraints.find((rule) => rule.type === 'max-user-steps')?.value ?? null,
    },
    driftChecks: [
      ...constraints.map((rule) => ({ id: `drift_${rule.id}`, kind: 'constraint', sourceId: rule.id })),
      ...metrics.map((metric) => ({ id: `drift_metric_${metric.id}`, kind: 'metric', sourceId: metric.id })),
    ],
  };
  const saved = await saveForgeRecord({ workspace, area: 'strategies', record });
  await appendFlightEvent({ workspace, event: { capability: 'strategy', action: 'compile', subject: saved.record.id, status: 'compiled' }, now });
  return { schemaVersion: 1, status: 'compiled', record: saved.record, evidencePath: saved.path, errors: [] };
}

export async function checkStrategy({ workspace, strategy, delivery, now = new Date() }) {
  if (verifyRecord(strategy).status !== 'valid') throw new ForgeMindError('FM_STRATEGY_INVALID', 'Strategy record is missing or tampered.');
  const rules = [];
  for (const constraint of strategy.constraints) {
    let passed;
    let evidence;
    if (constraint.type === 'forbid-path') {
      const matches = (delivery.changedFiles ?? []).filter((file) => String(file).replaceAll('\\', '/').startsWith(String(constraint.value).replaceAll('\\', '/')));
      passed = matches.length === 0;
      evidence = matches.length ? matches : ['no-forbidden-path-match'];
    } else if (constraint.type === 'require-evidence') {
      passed = (delivery.evidence ?? []).includes(constraint.value);
      evidence = passed ? [constraint.value] : ['missing-evidence'];
    } else {
      passed = Number(delivery.userSteps) <= Number(constraint.value);
      evidence = [`actual:${delivery.userSteps ?? 'missing'}`, `max:${constraint.value}`];
    }
    rules.push({ id: constraint.id, kind: constraint.type, status: passed ? 'passed' : 'failed', evidence });
  }
  for (const metric of strategy.metrics) {
    const actual = Number(delivery.metrics?.[metric.id]);
    const passed = Number.isFinite(actual) && metricPasses(metric, actual);
    rules.push({ id: `metric_${metric.id}`, kind: metric.guardrail ? 'guardrail-metric' : 'outcome-metric', status: passed ? 'passed' : 'failed', evidence: [`actual:${Number.isFinite(actual) ? actual : 'missing'}`, `target:${metric.target}`] });
  }
  const failed = rules.filter((rule) => rule.status === 'failed');
  const status = failed.length ? 'blocked' : 'aligned';
  const record = {
    schemaVersion: 1,
    protocol: 'forgemind-strategy-check-v1',
    id: stableId('strategy_check', { strategy: strategy.id, delivery, failed: failed.map((rule) => rule.id) }),
    checkedAt: now.toISOString(),
    strategyId: strategy.id,
    strategyDigest: strategy.digest.value,
    verificationStatus: delivery.verificationStatus ?? 'missing',
    status,
    result: failed.length ? `Strategic drift detected in ${failed.length} rule(s).` : 'Delivery is aligned with the executable strategy.',
    rules,
  };
  const saved = await saveForgeRecord({ workspace, area: 'strategies/checks', record });
  await appendFlightEvent({ workspace, event: { capability: 'strategy', action: 'check', subject: saved.record.id, status }, now });
  return { ...saved.record, errors: [] };
}

function metricPasses(metric, actual) {
  if (metric.direction === 'max') return actual <= metric.target;
  if (metric.direction === 'min') return actual >= metric.target;
  if (!Number.isFinite(metric.baseline)) return false;
  if (metric.direction === 'decrease-by-percent') return actual <= metric.baseline * (1 - metric.target / 100);
  return actual >= metric.baseline * (1 + metric.target / 100);
}

function validateStrategy(input) {
  for (const field of ['name', 'goal']) if (!String(input?.[field] ?? '').trim()) throw new ForgeMindError('FM_STRATEGY_INPUT_INVALID', `Strategy field is required: ${field}`);
  if (!Array.isArray(input.constraints) || input.constraints.length === 0) throw new ForgeMindError('FM_STRATEGY_INPUT_INVALID', 'Strategy requires constraints.');
  if (!Array.isArray(input.metrics) || input.metrics.length === 0) throw new ForgeMindError('FM_STRATEGY_INPUT_INVALID', 'Strategy requires metrics.');
  for (const constraint of input.constraints) if (!constraint.id || !CONSTRAINT_TYPES.includes(constraint.type)) throw new ForgeMindError('FM_STRATEGY_INPUT_INVALID', `Unsupported strategy constraint: ${constraint.type}`);
  for (const metric of input.metrics) if (!metric.id || !METRIC_DIRECTIONS.includes(metric.direction) || !Number.isFinite(Number(metric.target))) throw new ForgeMindError('FM_STRATEGY_INPUT_INVALID', `Invalid strategy metric: ${metric.id ?? 'missing'}`);
}
