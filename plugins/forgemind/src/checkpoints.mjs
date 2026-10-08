import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

import { ForgeMindError } from './errors.mjs';
import { writeJsonAtomic } from './io.mjs';
import { assertContained, resolveWorkspace } from './paths.mjs';
import { runProcess } from './process.mjs';

export async function saveCheckpoint({ workspace, summary, next, now = new Date() }) {
  if (!String(summary ?? '').trim() || !String(next ?? '').trim()) throw new ForgeMindError('FM_CHECKPOINT_INVALID', 'Checkpoint requires summary and next.');
  const root = await resolveWorkspace(workspace);
  const git = await runProcess('git', ['status', '--short', '--branch'], { cwd: root, maxOutputBytes: 32 * 1024 });
  const id = `chk_${createHash('sha256').update(`${now.toISOString()}|${summary}|${next}`).digest('hex').slice(0, 16)}`;
  const checkpoint = { schemaVersion: 1, id, createdAt: now.toISOString(), summary: String(summary), next: String(next), git: { available: git.exitCode === 0, status: git.exitCode === 0 ? git.stdout.trim().split(/\r?\n/).filter(Boolean) : [] } };
  await writeJsonAtomic(assertContained(root, path.join(root, '.codex-orchestrator', 'checkpoints', `${id}.json`)), checkpoint);
  return { schemaVersion: 1, status: 'saved', checkpoint, errors: [] };
}

export async function listCheckpoints({ workspace }) {
  const root = await resolveWorkspace(workspace);
  const directory = assertContained(root, path.join(root, '.codex-orchestrator', 'checkpoints'));
  try { return (await Promise.all((await readdir(directory)).filter((name) => name.endsWith('.json')).map(async (name) => JSON.parse(await readFile(path.join(directory, name), 'utf8'))))).sort((a, b) => b.createdAt.localeCompare(a.createdAt)); }
  catch (error) { if (error.code === 'ENOENT') return []; throw error; }
}

export async function resumeCheckpoint({ workspace, id }) {
  const checkpoints = await listCheckpoints({ workspace });
  const checkpoint = checkpoints.find((item) => item.id === id);
  if (!checkpoint) throw new ForgeMindError('FM_CHECKPOINT_NOT_FOUND', `Checkpoint not found: ${id}`);
  return { schemaVersion: 1, status: 'resumed', briefing: { summary: checkpoint.summary, next: checkpoint.next, git: checkpoint.git, createdAt: checkpoint.createdAt }, checkpoint, errors: [] };
}
