import { ForgeMindError } from '../errors.mjs';
import { appendFlightEvent } from './flight.mjs';
import { stableId, verifyRecord } from './integrity.mjs';
import { saveForgeRecord } from './store.mjs';

const TRANSITIONS = {
  signal: 'form-hypothesis',
  hypothesis: 'approve-experiment',
  experiment: 'record-delivery',
  delivery: 'measure',
};

export async function createProductLoop({ workspace, input, now = new Date() }) {
  validateLoopInput(input);
  const loopId = stableId('product_loop', input);
  const record = {
    schemaVersion: 1,
    protocol: 'forgemind-autonomous-product-loop-v1',
    id: revisionId(loopId, 1),
    loopId,
    revision: 1,
    parentDigest: null,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    name: input.name,
    state: 'signal',
    decision: null,
    decisionRationale: null,
    hypothesis: input.hypothesis,
    successMetric: normalizeMetric(input.successMetric),
    guardrails: input.guardrails.map(normalizeMetric),
    measurements: null,
    references: { signalRefs: [...new Set(input.signalRefs)].sort(), trustContractId: null, experimentId: null, proofId: null, attestationId: null },
    history: [{ revision: 1, state: 'signal', event: 'created', timestamp: now.toISOString() }],
  };
  const saved = await saveForgeRecord({ workspace, area: 'loops', record });
  await appendFlightEvent({ workspace, event: { capability: 'loop', action: 'create', subject: loopId, status: 'signal', revision: 1 }, now });
  return { schemaVersion: 1, status: 'created', record: saved.record, evidencePath: saved.path, errors: [] };
}

export async function advanceProductLoop({ workspace, loop, event, now = new Date() }) {
  if (verifyRecord(loop).status !== 'valid') throw new ForgeMindError('FM_LOOP_INVALID', 'Product loop record is missing or tampered.');
  const expected = TRANSITIONS[loop.state];
  if (!expected || event?.type !== expected) throw new ForgeMindError('FM_LOOP_TRANSITION_INVALID', `State ${loop.state} requires event ${expected ?? 'none'}; received ${event?.type ?? 'missing'}.`);
  const next = structuredClone(loop);
  delete next.digest;
  next.revision += 1;
  next.id = revisionId(loop.loopId, next.revision);
  next.parentDigest = loop.digest.value;
  next.updatedAt = now.toISOString();
  if (event.type === 'form-hypothesis') {
    if (!String(event.hypothesis ?? '').trim()) throw new ForgeMindError('FM_LOOP_EVIDENCE_REQUIRED', 'Hypothesis text is required.');
    next.hypothesis = event.hypothesis;
    next.state = 'hypothesis';
  } else if (event.type === 'approve-experiment') {
    if (!event.experiment?.id || !event.experiment?.trustContractId) throw new ForgeMindError('FM_LOOP_EVIDENCE_REQUIRED', 'Experiment ID and trust contract ID are required.');
    next.references.experimentId = event.experiment.id;
    next.references.trustContractId = event.experiment.trustContractId;
    next.state = 'experiment';
  } else if (event.type === 'record-delivery') {
    if (!event.delivery?.proofId || !event.delivery?.attestationId) throw new ForgeMindError('FM_LOOP_EVIDENCE_REQUIRED', 'Delivery proof and trusted attestation IDs are required.');
    next.references.proofId = event.delivery.proofId;
    next.references.attestationId = event.delivery.attestationId;
    next.state = 'delivery';
  } else {
    if (!event.metrics || typeof event.metrics !== 'object') throw new ForgeMindError('FM_LOOP_EVIDENCE_REQUIRED', 'Measured metrics are required.');
    const guardrailFailures = next.guardrails.filter((metric) => !metricPasses(metric, event.metrics[metric.id])).map((metric) => metric.id);
    const success = metricPasses(next.successMetric, event.metrics[next.successMetric.id]);
    next.measurements = Object.fromEntries(Object.entries(event.metrics).map(([key, value]) => [key, Number(value)]));
    if (guardrailFailures.length) {
      next.state = 'rollback';
      next.decision = 'rollback';
      next.decisionRationale = `Rollback required because guardrail metric(s) failed: ${guardrailFailures.join(', ')}.`;
    } else if (success) {
      next.state = 'scale';
      next.decision = 'scale';
      next.decisionRationale = 'Scale because the declared success metric passed and every guardrail held.';
    } else {
      next.state = 'iterate';
      next.decision = 'iterate';
      next.decisionRationale = 'Iterate because guardrails held but the declared success metric is not proven.';
    }
  }
  next.history.push({ revision: next.revision, state: next.state, event: event.type, timestamp: now.toISOString() });
  const saved = await saveForgeRecord({ workspace, area: 'loops', record: next });
  await appendFlightEvent({ workspace, event: { capability: 'loop', action: event.type, subject: loop.loopId, status: next.state, revision: next.revision }, now });
  return { schemaVersion: 1, status: 'advanced', record: saved.record, evidencePath: saved.path, errors: [] };
}

function revisionId(loopId, revision) { return `${loopId}_r${String(revision).padStart(4, '0')}`; }
function normalizeMetric(metric) { return { id: metric.id, direction: metric.direction, target: Number(metric.target), baseline: metric.baseline === undefined ? null : Number(metric.baseline) }; }

function metricPasses(metric, rawActual) {
  const actual = Number(rawActual);
  if (!Number.isFinite(actual)) return false;
  if (metric.direction === 'max') return actual <= metric.target;
  if (metric.direction === 'min') return actual >= metric.target;
  if (!Number.isFinite(metric.baseline)) return false;
  if (metric.direction === 'decrease-by-percent') return actual <= metric.baseline * (1 - metric.target / 100);
  if (metric.direction === 'increase-by-percent') return actual >= metric.baseline * (1 + metric.target / 100);
  return false;
}

function validateLoopInput(input) {
  for (const field of ['name', 'hypothesis']) if (!String(input?.[field] ?? '').trim()) throw new ForgeMindError('FM_LOOP_INPUT_INVALID', `Product loop field is required: ${field}`);
  if (!Array.isArray(input.signalRefs) || input.signalRefs.length === 0) throw new ForgeMindError('FM_LOOP_INPUT_INVALID', 'Product loop requires signal references.');
  if (!input.successMetric?.id || !input.successMetric?.direction || !Number.isFinite(Number(input.successMetric.target))) throw new ForgeMindError('FM_LOOP_INPUT_INVALID', 'Product loop success metric is invalid.');
  if (!Array.isArray(input.guardrails) || input.guardrails.length === 0) throw new ForgeMindError('FM_LOOP_INPUT_INVALID', 'Product loop requires at least one guardrail.');
}
