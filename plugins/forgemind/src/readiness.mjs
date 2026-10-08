import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { writeJsonAtomic } from './io.mjs';
import { assertContained, resolveWorkspace } from './paths.mjs';
import { artifactStatePath } from './artifact-store.mjs';

export async function scoreReadiness({ workspace, verification, gaps, risks }) {
  const root = await resolveWorkspace(workspace);
  const resolvedVerification = verification ?? await readReport(root, 'verification-latest.json', { status: 'missing', commands: [], errors: [] });
  const resolvedGaps = gaps ?? await readReport(root, 'gap-scan-latest.json', { status: 'missing', gaps: [] });
  const resolvedRisks = risks ?? await readReport(root, 'risk-radar-latest.json', { status: 'missing', risks: [] });
  const capabilities = await readReport(root, 'capability-manifest-latest.json', null);
  const blockers = [];
  let score = 100;

  if (resolvedVerification.status !== 'passed') blockers.push('verification'), score -= 45;
  const blockerRisks = resolvedRisks.risks.filter((risk) => risk.severity === 'blocker');
  for (const risk of blockerRisks) blockers.push(risk.category);
  score -= blockerRisks.length * 30;
  score -= resolvedGaps.gaps.filter((gap) => gap.severity === 'high').length * 8;
  score -= resolvedGaps.gaps.filter((gap) => gap.severity === 'medium').length * 3;
  const proof = await latestProofStatus(root);
  if (proof.status !== 'valid') blockers.push('delivery-proof'), score -= 20;
  score = Math.max(0, Math.min(100, score));
  const status = blockers.length ? 'blocked' : score >= 80 ? 'ready' : score >= 60 ? 'ready-with-notes' : 'risky';
  const report = { schemaVersion: 1, generatedAt: new Date().toISOString(), status, score, blockers: [...new Set(blockers)], verification: resolvedVerification.status, gaps: resolvedGaps.status, risks: resolvedRisks.status, proof: proof.status, capabilities: capabilities ? { missing: capabilities.missing ?? [], generatedAt: capabilities.generatedAt } : null };
  const output = assertContained(root, path.join(root, '.codex-orchestrator', 'reports', 'release-readiness-latest.json'));
  await writeJsonAtomic(output, report);
  return { ...report, evidencePath: '.codex-orchestrator/reports/release-readiness-latest.json' };
}

async function latestProofStatus(root) {
  try {
    const latest = JSON.parse(await readFile(artifactStatePath(root, 'evidence', 'latest.json'), 'utf8'));
    const { verifyDeliveryProof } = await import('./evidence.mjs');
    return verifyDeliveryProof({ workspace: root, proofPath: latest.proofPath });
  } catch {
    return { status: 'missing' };
  }
}

async function readReport(root, name, fallback) {
  try { return JSON.parse(await readFile(artifactStatePath(root, 'reports', name), 'utf8')); } catch { return fallback; }
}
