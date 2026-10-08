import { ForgeMindError } from '../errors.mjs';
import { appendFlightEvent } from './flight.mjs';
import { stableId } from './integrity.mjs';
import { saveForgeRecord } from './store.mjs';

export async function analyzeShrink({ workspace, input, now = new Date() }) {
  validateInput(input);
  const usageThreshold = Number(input.usageThreshold);
  const outcomeThreshold = Number(input.outcomeThreshold);
  const candidates = input.capabilities.map((capability) => evaluateCapability(capability, usageThreshold, outcomeThreshold));
  const actionable = candidates.filter((candidate) => candidate.recommendation === 'remove-experiment');
  const record = {
    schemaVersion: 1,
    protocol: 'forgemind-self-shrinking-software-v1',
    id: stableId('shrink', input),
    analyzedAt: now.toISOString(),
    name: input.name,
    status: 'planned',
    sourceMutation: false,
    thresholds: { usage: usageThreshold, outcomeContribution: outcomeThreshold },
    candidates,
    expectedReduction: {
      capabilityCount: actionable.length,
      complexityPoints: actionable.reduce((sum, item) => sum + item.complexityPoints, 0),
      fileCount: new Set(actionable.flatMap((item) => item.files)).size,
    },
    executionPolicy: 'proposal-only-no-automatic-deletion',
  };
  const saved = await saveForgeRecord({ workspace, area: 'shrink', record });
  await appendFlightEvent({ workspace, event: { capability: 'shrink', action: 'analyze', subject: saved.record.id, status: 'planned', actionableCandidates: actionable.length }, now });
  return { ...saved.record, errors: [] };
}

function evaluateCapability(capability, usageThreshold, outcomeThreshold) {
  const missingEvidence = [];
  const lowValue = Number(capability.usageCount) <= usageThreshold && Number(capability.outcomeContribution) <= outcomeThreshold;
  if (!Array.isArray(capability.protectedBehaviors) || capability.protectedBehaviors.length === 0) missingEvidence.push('protected-behaviors');
  if (!Array.isArray(capability.preservationTests) || capability.preservationTests.length === 0) missingEvidence.push('preservation-tests');
  if (!Array.isArray(capability.rollback) || capability.rollback.length === 0) missingEvidence.push('rollback');
  let recommendation = 'retain';
  let rationale = 'Capability has measured use, outcome contribution, or an essential designation.';
  if (!capability.essential && lowValue) {
    recommendation = missingEvidence.length ? 'needs-evidence' : 'remove-experiment';
    rationale = missingEvidence.length
      ? 'Low-value signal exists, but safe removal evidence is incomplete.'
      : 'Low measured value and complete preservation/rollback evidence support a controlled removal experiment.';
  }
  return {
    id: capability.id,
    files: [...new Set(capability.files ?? [])].sort(),
    usageCount: Number(capability.usageCount),
    outcomeContribution: Number(capability.outcomeContribution),
    complexityPoints: Number(capability.complexityPoints),
    essential: Boolean(capability.essential),
    protectedBehaviors: [...new Set(capability.protectedBehaviors ?? [])],
    preservationTests: [...new Set(capability.preservationTests ?? [])],
    rollback: [...new Set(capability.rollback ?? [])],
    recommendation,
    missingEvidence,
    rationale,
  };
}

function validateInput(input) {
  if (!String(input?.name ?? '').trim()) throw new ForgeMindError('FM_SHRINK_INPUT_INVALID', 'Shrink analysis name is required.');
  if (!Number.isFinite(Number(input.usageThreshold)) || !Number.isFinite(Number(input.outcomeThreshold))) throw new ForgeMindError('FM_SHRINK_INPUT_INVALID', 'Shrink thresholds must be numeric.');
  if (!Array.isArray(input.capabilities) || input.capabilities.length === 0) throw new ForgeMindError('FM_SHRINK_INPUT_INVALID', 'Shrink analysis requires a capability inventory.');
  for (const capability of input.capabilities) {
    if (!String(capability.id ?? '').trim()) throw new ForgeMindError('FM_SHRINK_INPUT_INVALID', 'Capability ID is required.');
    for (const field of ['usageCount', 'outcomeContribution', 'complexityPoints']) if (!Number.isFinite(Number(capability[field])) || Number(capability[field]) < 0) throw new ForgeMindError('FM_SHRINK_INPUT_INVALID', `Capability numeric field is invalid: ${field}`);
  }
}
