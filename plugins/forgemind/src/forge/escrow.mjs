import { ForgeMindError } from '../errors.mjs';
import { appendFlightEvent } from './flight.mjs';
import { stableId, verifyRecord } from './integrity.mjs';
import { saveForgeRecord } from './store.mjs';

export async function createEvidenceEscrow({ workspace, input, now = new Date() }) {
  validateEscrowInput(input);
  const record = {
    schemaVersion: 1,
    protocol: 'forgemind-evidence-escrow-v1',
    id: stableId('escrow', input),
    createdAt: now.toISOString(),
    name: input.name,
    custody: 'evidence-only-no-funds',
    contractId: input.contractId,
    milestones: input.milestones.map((milestone) => ({ id: milestone.id, requiredEvidence: [...new Set(milestone.requiredEvidence)].sort() })),
    requiredApprovers: [...new Set(input.requiredApprovers ?? [])].sort(),
    status: 'held',
  };
  const saved = await saveForgeRecord({ workspace, area: 'escrows', record });
  await appendFlightEvent({ workspace, event: { capability: 'escrow', action: 'create', subject: saved.record.id, status: 'held', contractId: input.contractId }, now });
  return { schemaVersion: 1, status: 'created', record: saved.record, evidencePath: saved.path, errors: [] };
}

export async function evaluateEscrow({ workspace, escrow, attestation, submission, now = new Date() }) {
  requireValid(escrow, 'escrow');
  requireValid(attestation, 'attestation');
  const blockers = [];
  if (attestation.protocol !== 'forgemind-trust-attestation-v1' || attestation.status !== 'trusted' || attestation.blockers?.length) blockers.push('attestation:not-trusted');
  if (attestation.contractId !== escrow.contractId) blockers.push('attestation:contract-mismatch');
  for (const milestone of escrow.milestones) {
    const supplied = submission?.milestoneEvidence?.[milestone.id] ?? [];
    for (const evidence of milestone.requiredEvidence) if (!supplied.includes(evidence)) blockers.push(`milestone:${milestone.id}:${evidence}`);
  }
  const approved = new Set((submission?.approvals ?? []).filter((approval) => approval.status === 'approved').map((approval) => approval.party));
  for (const party of escrow.requiredApprovers) if (!approved.has(party)) blockers.push(`approval:${party}`);
  const status = blockers.length ? 'held' : 'releasable';
  const record = {
    schemaVersion: 1,
    protocol: 'forgemind-evidence-escrow-evaluation-v1',
    id: stableId('escrow_evaluation', { escrow: escrow.id, attestation: attestation.id, submission, blockers }),
    evaluatedAt: now.toISOString(),
    escrowId: escrow.id,
    contractId: escrow.contractId,
    attestationId: attestation.id,
    attestationDigest: attestation.digest.value,
    custody: 'evidence-only-no-funds',
    status,
    blockers,
    milestoneEvidence: escrow.milestones.map((milestone) => ({ id: milestone.id, supplied: [...new Set(submission?.milestoneEvidence?.[milestone.id] ?? [])].sort(), required: milestone.requiredEvidence })),
    approvals: [...approved].sort(),
  };
  const saved = await saveForgeRecord({ workspace, area: 'escrows/evaluations', record });
  await appendFlightEvent({ workspace, event: { capability: 'escrow', action: 'evaluate', subject: saved.record.id, status, escrowId: escrow.id }, now });
  return { schemaVersion: 1, status, blockers, record: saved.record, evidencePath: saved.path, errors: [] };
}

export async function releaseEscrow({ workspace, escrow, evaluation, now = new Date() }) {
  requireValid(escrow, 'escrow');
  requireValid(evaluation, 'evaluation');
  if (evaluation.protocol !== 'forgemind-evidence-escrow-evaluation-v1' || evaluation.escrowId !== escrow.id || evaluation.status !== 'releasable' || evaluation.blockers.length) {
    throw new ForgeMindError('FM_ESCROW_NOT_RELEASABLE', 'Evidence escrow cannot release until every proof, milestone, and approval gate passes.');
  }
  const record = {
    schemaVersion: 1,
    protocol: 'forgemind-evidence-escrow-receipt-v1',
    id: stableId('escrow_receipt', { escrow: escrow.id, evaluation: evaluation.id }),
    releasedAt: now.toISOString(),
    custody: 'evidence-only-no-funds',
    escrowId: escrow.id,
    contractId: escrow.contractId,
    evaluationId: evaluation.id,
    evaluationDigest: evaluation.digest.value,
    attestationId: evaluation.attestationId,
    attestationDigest: evaluation.attestationDigest,
    status: 'released',
  };
  const saved = await saveForgeRecord({ workspace, area: 'escrows/receipts', record });
  await appendFlightEvent({ workspace, event: { capability: 'escrow', action: 'release', subject: saved.record.id, status: 'released', escrowId: escrow.id }, now });
  return { schemaVersion: 1, status: 'released', record: saved.record, evidencePath: saved.path, errors: [] };
}

function requireValid(record, type) { if (verifyRecord(record).status !== 'valid') throw new ForgeMindError('FM_ESCROW_RECORD_INVALID', `Evidence escrow ${type} record is missing or tampered.`); }
function validateEscrowInput(input) {
  for (const field of ['name', 'contractId']) if (!String(input?.[field] ?? '').trim()) throw new ForgeMindError('FM_ESCROW_INPUT_INVALID', `Evidence escrow field is required: ${field}`);
  if (!Array.isArray(input.milestones) || input.milestones.length === 0) throw new ForgeMindError('FM_ESCROW_INPUT_INVALID', 'Evidence escrow requires milestones.');
  for (const milestone of input.milestones) if (!milestone.id || !Array.isArray(milestone.requiredEvidence) || milestone.requiredEvidence.length === 0) throw new ForgeMindError('FM_ESCROW_INPUT_INVALID', 'Every escrow milestone requires an ID and evidence types.');
}
