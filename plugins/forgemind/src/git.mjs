import { createHash } from 'node:crypto';

import { ForgeMindError } from './errors.mjs';
import { runProcess } from './process.mjs';

export async function getGitState(workspace) {
  const projectPathspec = ['--', '.', ':(exclude).codex-orchestrator/evidence/**', ':(exclude).codex-orchestrator/reports/**', ':(exclude).codex-orchestrator/dashboard/**'];
  const commitResult = await runProcess('git', ['rev-parse', 'HEAD'], { cwd: workspace });
  if (commitResult.exitCode !== 0) throw new ForgeMindError('FM_GIT_REQUIRED', 'Delivery proof requires a Git repository with at least one commit.');
  const statusResult = await runProcess('git', ['status', '--porcelain=v1', ...projectPathspec], { cwd: workspace });
  const diffResult = await runProcess('git', ['diff', '--binary', 'HEAD', ...projectPathspec], { cwd: workspace, maxOutputBytes: 2 * 1024 * 1024 });
  const dirty = Boolean(statusResult.stdout.trim());
  const filesResult = dirty
    ? await runProcess('git', ['status', '--porcelain=v1', ...projectPathspec], { cwd: workspace })
    : await runProcess('git', ['show', '--pretty=format:', '--name-only', 'HEAD'], { cwd: workspace });
  const changedFiles = dirty
    ? filesResult.stdout.split(/\r?\n/).filter(Boolean).map((line) => line.slice(3).trim().replaceAll('\\', '/')).sort()
    : filesResult.stdout.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).map((line) => line.replaceAll('\\', '/')).sort();
  const commit = commitResult.stdout.trim();
  const snapshotHash = createHash('sha256')
    .update(commit)
    .update('\0')
    .update(statusResult.stdout)
    .update('\0')
    .update(diffResult.stdout)
    .digest('hex');
  return { commit, dirty, changedFiles: [...new Set(changedFiles)], snapshotHash };
}
