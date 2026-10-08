import { ForgeMindError } from '../errors.mjs';
import { appendFlightEvent } from './flight.mjs';
import { stableId, verifyRecord } from './integrity.mjs';
import { saveForgeRecord } from './store.mjs';

const SUPPORTED_VENDORS = ['openai', 'anthropic', 'github', 'cursor', 'ci', 'custom'];

export async function createTrustContract({ workspace, input, now = new Date() }) {
  validateContract(input);
  const normalized = {
    schemaVersion: 1,
    protocol: 'forgemind-agent-trust-v1',
    id: stableId('contract', input),
    createdAt: now.toISOString(),
    title: input.title,
    intent: input.intent,
    acceptanceCriteria: input.acceptanceCriteria.map((criterion) => ({
      id: criterion.id,
      description: criterion.description,
      evidenceType: criterion.evidenceType,
      mandatory: criterion.mandatory !== false,
    })),
    requiredEvidence: [...new Set(input.requiredEvidence)].sort(),
    policy: {
      allowedVendors: [...new Set(input.policy?.allowedVendors ?? SUPPORTED_VENDORS)].sort(),
      requireNoViolations: input.policy?.requireNoViolations !== false,
      requiredApprovals: [...new Set(input.policy?.requiredApprovals ?? [])].sort(),
    },
    rollbackRequired: Boolean(input.rollbackRequired),
    budgets: {
      maxDurationMinutes: finiteOrNull(input.budgets?.maxDurationMinutes),
      maxCostUnits: finiteOrNull(input.budgets?.maxCostUnits),
    },
  };
  const saved = await saveForgeRecord({ workspace, area: 'trust/contracts', record: normalized });
  await appendFlightEvent({ workspace, event: { capability: 'trust', action: 'create', subject: saved.record.id, status: 'created' }, now });
  return { schemaVersion: 1, status: 'created', record: saved.record, evidencePath: saved.path, errors: [] };
}

export async function importAgentEvidence({ workspace, input, now = new Date() }) {
  validateEvidence(input);
  const normalized = {
    schemaVersion: 1,
    protocol: 'forgemind-agent-evidence-v1',
    id: stableId('agent_evidence', { producer: input.producer, repository: input.repository, acceptance: input.acceptance, artifacts: input.artifacts }),
    importedAt: now.toISOString(),
    untrustedContent: true,
    producer: {
      vendor: input.producer.vendor.toLowerCase(),
      agent: input.producer.agent,
      model: input.producer.model ?? null,
      runId: input.producer.runId,
    },
    repository: { commit: input.repository?.commit ?? null, dirty: Boolean(input.repository?.dirty) },
    acceptance: input.acceptance.map((item) => ({ criterionId: item.criterionId, status: item.status, evidence: [...new Set(item.evidence ?? [])].sort() })),
    artifacts: input.artifacts.map((item) => ({ type: item.type, path: item.path, status: item.status, digest: item.digest ?? null })),
    verification: { status: input.verification?.status ?? 'missing', commands: [...new Set(input.verification?.commands ?? [])] },
    policy: { violations: [...new Set(input.policy?.violations ?? [])], approvals: [...new Set(input.policy?.approvals ?? [])] },
    rollback: { status: input.rollback?.status ?? 'missing', steps: [...new Set(input.rollback?.steps ?? [])] },
    actuals: { durationMinutes: finiteOrNull(input.actuals?.durationMinutes), costUnits: finiteOrNull(input.actuals?.costUnits) },
    notes: input.notes ?? null,
  };
  const saved = await saveForgeRecord({ workspace, area: 'trust/evidence', record: normalized });
  await appendFlightEvent({ workspace, event: { capability: 'trust', action: 'import', subject: saved.record.id, status: 'imported', producer: normalized.producer.vendor }, now });
  return { schemaVersion: 1, status: 'imported', record: saved.record, evidencePath: saved.path, errors: [] };
}

export async function evaluateTrust({ workspace, contract, evidence, now = new Date() }) {
  requireValidRecord(contract, 'contract');
  requireValidRecord(evidence, 'evidence');
  const acceptanceMissing = contract.acceptanceCriteria.filter((criterion) => criterion.mandatory).filter((criterion) => {
    const result = evidence.acceptance.find((item) => item.criterionId === criterion.id);
    const artifact = evidence.artifacts.find((item) => item.type === criterion.evidenceType && item.status === 'passed');
    return result?.status !== 'passed' || !artifact;
  }).map((criterion) => criterion.id);
  const requiredEvidenceMissing = contract.requiredEvidence.filter((type) => !evidence.artifacts.some((artifact) => artifact.type === type && artifact.status === 'passed'));
  const acceptancePassed = acceptanceMissing.length === 0 && requiredEvidenceMissing.length === 0;
  const verificationPassed = evidence.verification.status === 'passed' && evidence.verification.commands.length > 0;
  const vendorAllowed = contract.policy.allowedVendors.includes(evidence.producer.vendor);
  const policyPassed = vendorAllowed && (!contract.policy.requireNoViolations || evidence.policy.violations.length === 0)
    && contract.policy.requiredApprovals.every((approval) => evidence.policy.approvals.includes(approval));
  const provenancePassed = Boolean(evidence.producer.vendor && evidence.producer.agent && evidence.producer.runId && evidence.repository.commit);
  const rollbackPassed = !contract.rollbackRequired || (evidence.rollback.status === 'documented' && evidence.rollback.steps.length > 0);
  const budgetFailures = [];
  if (contract.budgets.maxDurationMinutes !== null && (evidence.actuals.durationMinutes === null || evidence.actuals.durationMinutes > contract.budgets.maxDurationMinutes)) budgetFailures.push('duration');
  if (contract.budgets.maxCostUnits !== null && (evidence.actuals.costUnits === null || evidence.actuals.costUnits > contract.budgets.maxCostUnits)) budgetFailures.push('cost');
  const gates = [
    gate('acceptance-and-required-evidence', acceptancePassed, 35, [...acceptanceMissing, ...requiredEvidenceMissing]),
    gate('verification', verificationPassed, 25, verificationPassed ? [] : ['verification']),
    gate('policy', policyPassed, 20, [...(vendorAllowed ? [] : ['vendor']), ...evidence.policy.violations, ...contract.policy.requiredApprovals.filter((approval) => !evidence.policy.approvals.includes(approval))]),
    gate('provenance', provenancePassed, 10, provenancePassed ? [] : ['producer-or-commit']),
    gate('rollback', rollbackPassed, 10, rollbackPassed ? [] : ['rollback']),
    gate('budget', budgetFailures.length === 0, 0, budgetFailures),
  ];
  const blockers = gates.filter((item) => item.status === 'failed').flatMap((item) => item.details.map((detail) => `${item.name}:${detail}`));
  const score = gates.filter((item) => item.status === 'passed').reduce((sum, item) => sum + item.weight, 0);
  const status = blockers.length ? 'rejected' : 'trusted';
  const record = {
    schemaVersion: 1,
    protocol: 'forgemind-trust-attestation-v1',
    id: stableId('attestation', { contract: contract.id, evidence: evidence.id, score, blockers }),
    evaluatedAt: now.toISOString(),
    contractId: contract.id,
    contractDigest: contract.digest.value,
    evidenceId: evidence.id,
    evidenceDigest: evidence.digest.value,
    status,
    score,
    gates,
    blockers,
  };
  const saved = await saveForgeRecord({ workspace, area: 'trust/attestations', record });
  await appendFlightEvent({ workspace, event: { capability: 'trust', action: 'evaluate', subject: saved.record.id, status, contractId: contract.id, evidenceId: evidence.id }, now });
  return { ...saved.record, errors: [] };
}

export function verifyTrustRecord(record) {
  return verifyRecord(record);
}

function gate(name, passed, weight, details) { return { name, status: passed ? 'passed' : 'failed', weight, details }; }

function requireValidRecord(record, name) {
  if (verifyRecord(record).status !== 'valid') throw new ForgeMindError('FM_TRUST_RECORD_INVALID', `Trust ${name} record is missing or tampered.`);
}

function validateContract(input) {
  for (const field of ['title', 'intent']) if (!String(input?.[field] ?? '').trim()) throw new ForgeMindError('FM_TRUST_CONTRACT_INVALID', `Trust contract field is required: ${field}`);
  if (!Array.isArray(input.acceptanceCriteria) || input.acceptanceCriteria.length === 0) throw new ForgeMindError('FM_TRUST_CONTRACT_INVALID', 'Trust contract requires acceptance criteria.');
  if (!Array.isArray(input.requiredEvidence) || input.requiredEvidence.length === 0) throw new ForgeMindError('FM_TRUST_CONTRACT_INVALID', 'Trust contract requires evidence types.');
  for (const criterion of input.acceptanceCriteria) for (const field of ['id', 'description', 'evidenceType']) if (!String(criterion[field] ?? '').trim()) throw new ForgeMindError('FM_TRUST_CONTRACT_INVALID', `Acceptance criterion field is required: ${field}`);
}

function validateEvidence(input) {
  for (const field of ['vendor', 'agent', 'runId']) if (!String(input?.producer?.[field] ?? '').trim()) throw new ForgeMindError('FM_TRUST_EVIDENCE_INVALID', `Evidence producer field is required: ${field}`);
  if (!SUPPORTED_VENDORS.includes(input.producer.vendor.toLowerCase())) throw new ForgeMindError('FM_TRUST_VENDOR_UNSUPPORTED', `Unsupported evidence vendor: ${input.producer.vendor}`);
  if (!Array.isArray(input.acceptance) || !Array.isArray(input.artifacts)) throw new ForgeMindError('FM_TRUST_EVIDENCE_INVALID', 'Evidence acceptance and artifacts must be arrays.');
}

function finiteOrNull(value) { return value === undefined || value === null || value === '' ? null : Number.isFinite(Number(value)) ? Number(value) : null; }
