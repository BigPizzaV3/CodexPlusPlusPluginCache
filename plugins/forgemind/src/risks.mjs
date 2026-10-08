import path from 'node:path';

import { getGitState } from './git.mjs';
import { writeJsonAtomic } from './io.mjs';
import { assertContained, resolveWorkspace } from './paths.mjs';

export async function scanRisks({ workspace, changedFiles }) {
  const root = await resolveWorkspace(workspace);
  if (changedFiles === undefined) {
    try { changedFiles = (await getGitState(root)).changedFiles; }
    catch { changedFiles = []; }
  }
  const risks = [];
  const add = (severity, category, message, evidence, mitigation) => risks.push({ severity, category, message, evidence, mitigation });

  for (const raw of changedFiles) {
    const file = raw.replaceAll('\\', '/');
    const base = path.posix.basename(file).toLowerCase();
    if (base === '.env' || /(?:secret|credential|private[-_]?key)/i.test(file)) {
      add('blocker', 'secrets', 'Secret-like file is part of the change.', file, 'Remove it and rotate exposed credentials.');
    }
    if (/(?:^|\/)migrations?\//i.test(file) || /\.sql$/i.test(file)) {
      add('high', 'migration', 'Database migration requires explicit review and rollback.', file, 'Review forward and rollback migrations.');
    }
    if (/(?:^|\/)(?:package-lock\.json|pnpm-lock\.yaml|yarn\.lock)$/i.test(file)) {
      add('medium', 'dependency', 'Dependency resolution changed.', file, 'Run dependency audit and project tests.');
    }
  }

  const status = risks.some((risk) => risk.severity === 'blocker') ? 'blocked' : risks.length ? 'risks-found' : 'clear';
  const report = { schemaVersion: 1, generatedAt: new Date().toISOString(), status, risks };
  const output = assertContained(root, path.join(root, '.codex-orchestrator', 'reports', 'risk-radar-latest.json'));
  await writeJsonAtomic(output, report);
  return { ...report, evidencePath: '.codex-orchestrator/reports/risk-radar-latest.json' };
}
