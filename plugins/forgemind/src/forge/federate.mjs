import { ForgeMindError } from '../errors.mjs';
import { appendFlightEvent } from './flight.mjs';
import { stableId, verifyRecord } from './integrity.mjs';
import { saveForgeRecord } from './store.mjs';

export async function exportFederatedBundle({ workspace, outcomes, minCohort = 5, now = new Date() }) {
  if (!Array.isArray(outcomes)) throw new ForgeMindError('FM_FEDERATION_INPUT_INVALID', 'Federated export requires an outcomes array.');
  if (!Number.isInteger(Number(minCohort)) || Number(minCohort) < 2) throw new ForgeMindError('FM_FEDERATION_INPUT_INVALID', 'Federated minimum cohort must be an integer of at least 2.');
  const groups = new Map();
  for (const outcome of outcomes) {
    const category = String(outcome.taskCategory ?? 'unknown');
    const route = String(outcome.route ?? 'unknown');
    const stacks = [...new Set(outcome.project?.stacks ?? [])].sort();
    const key = JSON.stringify([category, route, stacks]);
    if (!groups.has(key)) groups.set(key, { category, route, stacks, outcomes: [] });
    groups.get(key).outcomes.push(outcome);
  }
  const published = [...groups.values()].filter((group) => group.outcomes.length >= Number(minCohort));
  const suppressed = [...groups.values()].filter((group) => group.outcomes.length < Number(minCohort));
  const cohorts = published.map(aggregateGroup).sort((left, right) => left.category.localeCompare(right.category) || left.route.localeCompare(right.route) || left.stacks.join(',').localeCompare(right.stacks.join(',')));
  const publicPayload = { minCohort: Number(minCohort), cohorts, suppression: { cohortCount: suppressed.length, outcomeCount: suppressed.reduce((sum, group) => sum + group.outcomes.length, 0) } };
  const record = {
    schemaVersion: 1,
    protocol: 'forgemind-federated-learning-bundle-v1',
    id: stableId('federated_bundle', publicPayload),
    exportedAt: now.toISOString(),
    privacy: {
      mechanism: 'cohort-aggregation-with-k-suppression',
      minCohort: Number(minCohort),
      excludedFields: ['outcome-id', 'task', 'prompt', 'code', 'path', 'project-name', 'user', 'author', 'evidence-id'],
      claim: 'k-anonymous-aggregate-not-differential-privacy',
    },
    cohorts,
    suppression: publicPayload.suppression,
  };
  const saved = await saveForgeRecord({ workspace, area: 'federation/exports', record });
  await appendFlightEvent({ workspace, event: { capability: 'federate', action: 'export', subject: saved.record.id, status: 'exported', cohortCount: cohorts.length, suppressedOutcomes: record.suppression.outcomeCount }, now });
  return { schemaVersion: 1, status: 'exported', record: saved.record, evidencePath: saved.path, errors: [] };
}

export async function aggregateFederatedBundles({ workspace, bundles, now = new Date() }) {
  if (!Array.isArray(bundles) || bundles.length === 0) throw new ForgeMindError('FM_FEDERATION_INPUT_INVALID', 'Federated aggregation requires at least one bundle.');
  for (const bundle of bundles) {
    if (verifyRecord(bundle).status !== 'valid' || bundle.protocol !== 'forgemind-federated-learning-bundle-v1') throw new ForgeMindError('FM_FEDERATION_BUNDLE_INVALID', 'Federated bundle is unsupported or tampered.');
  }
  const groups = new Map();
  for (const bundle of bundles) for (const cohort of bundle.cohorts) {
    const key = JSON.stringify([cohort.category, cohort.route, cohort.stacks]);
    if (!groups.has(key)) groups.set(key, { category: cohort.category, route: cohort.route, stacks: cohort.stacks, count: 0, successCount: 0, durationTotal: 0, correctionTotal: 0, residualDefectTotal: 0 });
    const target = groups.get(key);
    for (const field of ['count', 'successCount', 'durationTotal', 'correctionTotal', 'residualDefectTotal']) target[field] += Number(cohort[field]);
  }
  const cohorts = [...groups.values()].map(finalizeAggregate).sort((left, right) => left.category.localeCompare(right.category) || left.route.localeCompare(right.route) || left.stacks.join(',').localeCompare(right.stacks.join(',')));
  const record = {
    schemaVersion: 1,
    protocol: 'forgemind-federated-benchmark-v1',
    id: stableId('federated_benchmark', { bundleDigests: bundles.map((bundle) => bundle.digest.value).sort(), cohorts }),
    aggregatedAt: now.toISOString(),
    bundleCount: bundles.length,
    sourceBundleDigests: bundles.map((bundle) => bundle.digest.value).sort(),
    privacy: { input: 'verified-k-anonymous-aggregates-only', claim: 'pooled-aggregate-not-differential-privacy' },
    cohorts,
  };
  const saved = await saveForgeRecord({ workspace, area: 'federation/benchmarks', record });
  await appendFlightEvent({ workspace, event: { capability: 'federate', action: 'aggregate', subject: saved.record.id, status: 'aggregated', bundleCount: bundles.length }, now });
  return { schemaVersion: 1, status: 'aggregated', record: saved.record, evidencePath: saved.path, errors: [] };
}

function aggregateGroup(group) {
  const aggregate = {
    id: stableId('federated_cohort', { category: group.category, route: group.route, stacks: group.stacks }),
    category: group.category,
    route: group.route,
    stacks: group.stacks,
    count: group.outcomes.length,
    successCount: group.outcomes.filter(successful).length,
    durationTotal: sum(group.outcomes, 'durationMinutes'),
    correctionTotal: sum(group.outcomes, 'correctionCount'),
    residualDefectTotal: sum(group.outcomes, 'residualDefects'),
  };
  return finalizeAggregate(aggregate);
}

function finalizeAggregate(value) {
  return {
    ...value,
    successRate: round(value.successCount / value.count * 100),
    averageDurationMinutes: round(value.durationTotal / value.count),
    averageCorrections: round(value.correctionTotal / value.count),
    averageResidualDefects: round(value.residualDefectTotal / value.count),
  };
}

function successful(outcome) { return outcome.verificationStatus === 'passed' && Boolean(outcome.userAccepted) && Number(outcome.residualDefects ?? 0) === 0; }
function sum(outcomes, field) { return outcomes.reduce((total, outcome) => total + Number(outcome[field] ?? 0), 0); }
function round(value) { return Number(value.toFixed(2)); }
