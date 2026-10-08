import { access, readFile } from 'node:fs/promises';
import path from 'node:path';

import { writeJsonAtomic } from './io.mjs';
import { assertContained, resolveWorkspace } from './paths.mjs';
import { artifactStatePath } from './artifact-store.mjs';

export async function scanGaps({ workspace }) {
  const root = await resolveWorkspace(workspace);
  const gaps = [];
  const add = (severity, area, message, evidence, action) => gaps.push({ severity, area, message, evidence, action });
  const verificationPath = artifactStatePath(root, 'reports', 'verification-latest.json');

  try {
    const verification = JSON.parse(await readFile(verificationPath, 'utf8'));
    if (verification.status !== 'passed') add('blocker', 'verification', 'Latest verification did not pass.', verification.status, 'Run and fix verification.');
  } catch {
    add('high', 'verification', 'No verification report found.', '.codex-orchestrator/reports/verification-latest.json', 'Run forgemind verify --run.');
  }
  if (!await exists(path.join(root, 'CHANGELOG.md'))) add('high', 'release', 'Missing CHANGELOG.md.', 'CHANGELOG.md', 'Add release notes.');
  if (!await exists(path.join(root, '.github', 'workflows', 'validate.yml'))) add('high', 'ci', 'Missing cross-platform validation workflow.', '.github/workflows/validate.yml', 'Add the CI matrix.');
  if (!await exists(path.join(root, 'docs', 'forgemind', 'traceability.md'))) add('medium', 'traceability', 'Missing traceability artifact.', 'docs/forgemind/traceability.md', 'Run forgemind init --artifacts.');

  const blockers = gaps.filter((gap) => gap.severity === 'blocker').length;
  const high = gaps.filter((gap) => gap.severity === 'high').length;
  const status = blockers ? 'blocked' : high ? 'needs-work' : gaps.length ? 'minor-gaps' : 'clear';
  const report = { schemaVersion: 1, generatedAt: new Date().toISOString(), status, gaps, blockers, high };
  const output = assertContained(root, path.join(root, '.codex-orchestrator', 'reports', 'gap-scan-latest.json'));
  await writeJsonAtomic(output, report);
  return { ...report, evidencePath: '.codex-orchestrator/reports/gap-scan-latest.json' };
}

async function exists(candidate) {
  try { await access(candidate); return true; } catch { return false; }
}
