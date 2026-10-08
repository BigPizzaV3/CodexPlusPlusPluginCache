import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { loadConfig } from './config.mjs';
import { getGitState } from './git.mjs';
import { canonicalJson, writeJsonAtomic, writeTextAtomic } from './io.mjs';
import { assertContained, resolveWorkspace } from './paths.mjs';
import { redactValue } from './redact.mjs';
import { artifactStatePath } from './artifact-store.mjs';

export async function createDeliveryProof(options) {
  const workspace = await resolveWorkspace(options.workspace);
  const git = await getGitState(workspace);
  const generatedAt = new Date().toISOString();
  const blockers = [];
  if (options.verification?.status !== 'passed') blockers.push('verification');
  for (const risk of options.risks?.risks ?? []) if (risk.severity === 'blocker') blockers.push(`risk:${risk.category}`);
  if (git.dirty) blockers.push('dirty-worktree');
  if (!(options.acceptanceCriteria?.length)) blockers.push('acceptance-missing');
  if (!(options.rollback?.length)) blockers.push('rollback-missing');
  if (options.unresolved?.length) blockers.push('uncertainty');

  const evidence = [options.verification?.evidencePath, options.risks?.evidencePath, ...(options.evidence ?? [])]
    .filter(Boolean)
    .map((item) => String(item).replaceAll('\\', '/'))
    .filter((item) => !path.isAbsolute(item));
  const identity = createHash('sha256').update(git.commit).update(options.intent ?? '').update(generatedAt).digest('hex').slice(0, 12);
  const deliveryId = `delivery-${generatedAt.replace(/[:.]/g, '-').replace('Z', '')}-${identity}`;
  const payload = {
    schemaVersion: 1,
    deliveryId,
    generatedAt,
    status: blockers.length ? 'blocked' : 'ready',
    intent: String(options.intent ?? ''),
    acceptanceCriteria: options.acceptanceCriteria ?? [],
    git,
    changedFiles: git.changedFiles,
    decisions: options.decisions ?? [],
    verification: options.verification ?? { status: 'missing', commands: [], errors: [] },
    risks: options.risks ?? { status: 'missing', risks: [] },
    rollback: options.rollback ?? [],
    unresolved: options.unresolved ?? [],
    blockers: [...new Set(blockers)],
    evidence: [...new Set(evidence)],
    outcome: options.outcome ?? null,
  };
  const config = options.config ?? await loadConfig(workspace);
  const redacted = redactValue(payload, config.redaction);
  if (redacted.matches) {
    redacted.value.blockers = [...new Set([...redacted.value.blockers, 'sensitive-data-redacted'])];
    redacted.value.status = 'blocked';
  }
  const proof = { ...redacted.value, digest: canonicalProofDigest(redacted.value) };
  const relativeDirectory = `.codex-orchestrator/evidence/${deliveryId}`;
  const directory = assertContained(workspace, path.join(workspace, relativeDirectory));
  const proofPath = `${relativeDirectory}/delivery-proof.json`;
  await writeJsonAtomic(path.join(directory, 'delivery-proof.json'), proof);
  await writeTextAtomic(path.join(directory, 'delivery-proof.md'), renderProof(proof));
  await writeTextAtomic(path.join(directory, 'sha256.txt'), `${proof.digest}\n`);
  await writeJsonAtomic(artifactStatePath(workspace, 'evidence', 'latest.json'), { schemaVersion: 1, proofPath, digest: proof.digest });
  return { schemaVersion: 1, status: proof.status, proof, proofPath, digestPath: `${relativeDirectory}/sha256.txt` };
}

export async function verifyDeliveryProof({ workspace, proofPath }) {
  const root = await resolveWorkspace(workspace);
  const absolute = assertContained(root, path.join(root, proofPath));
  const proof = JSON.parse(await readFile(absolute, 'utf8'));
  const expected = canonicalProofDigest(proof);
  if (proof.digest !== expected) {
    return { schemaVersion: 1, status: 'tampered', error: { code: 'FM_PROOF_TAMPERED', message: 'Delivery proof digest does not match its payload.' } };
  }
  const current = await getGitState(root);
  if (proof.git?.commit !== current.commit || proof.git?.snapshotHash !== current.snapshotHash) {
    return { schemaVersion: 1, status: 'stale', error: { code: 'FM_PROOF_STALE', message: 'Git state changed after delivery proof creation.' }, current };
  }
  if (proof.status !== 'ready' || proof.blockers?.length) {
    return { schemaVersion: 1, status: 'blocked', error: { code: 'FM_PROOF_BLOCKED', message: 'Delivery proof contains blockers.' }, proof };
  }
  return { schemaVersion: 1, status: 'valid', digest: proof.digest, proofPath };
}

export function canonicalProofDigest(proof) {
  const { digest: _digest, ...payload } = proof;
  return createHash('sha256').update(canonicalJson(payload)).digest('hex');
}

function renderProof(proof) {
  return `# ForgeMind Delivery Proof\n\n- ID: ${proof.deliveryId}\n- Status: ${proof.status}\n- Commit: ${proof.git.commit}\n- Digest: ${proof.digest}\n\n## Intent\n\n${proof.intent}\n\n## Acceptance Criteria\n\n${proof.acceptanceCriteria.map((item) => `- ${item}`).join('\n')}\n\n## Blockers\n\n${proof.blockers.map((item) => `- ${item}`).join('\n') || '- none'}\n`;
}
