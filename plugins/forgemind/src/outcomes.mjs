import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { loadConfig } from './config.mjs';
import { ForgeMindError } from './errors.mjs';
import { canonicalJson, writeTextAtomic } from './io.mjs';
import { assertContained, resolveWorkspace } from './paths.mjs';
import { redactValue } from './redact.mjs';

export async function recordOutcome({ workspace, outcome, now = new Date(), config }) {
  const root = await resolveWorkspace(workspace);
  validateOutcome(outcome);
  const recordedAt = now.toISOString();
  const id = `out_${createHash('sha256').update(canonicalJson({ ...outcome, recordedAt })).digest('hex').slice(0, 24)}`;
  const normalized = {
    schemaVersion: 1,
    id,
    recordedAt,
    task: outcome.task,
    taskCategory: outcome.taskCategory,
    route: outcome.route,
    project: { stacks: [...new Set(outcome.project?.stacks ?? [])].sort(), packageManager: outcome.project?.packageManager ?? null },
    durationMinutes: Number(outcome.durationMinutes ?? 0),
    verificationStatus: outcome.verificationStatus ?? 'missing',
    correctionCount: Number(outcome.correctionCount ?? 0),
    userAccepted: Boolean(outcome.userAccepted),
    residualDefects: Number(outcome.residualDefects ?? 0),
    effectiveness: effectiveness(outcome),
    evidence: [...new Set(outcome.evidence ?? [])],
  };
  const loadedConfig = config ?? await loadConfig(root);
  const redacted = redactValue(normalized, loadedConfig.redaction);
  if (redacted.matches) throw new ForgeMindError('FM_OUTCOME_SENSITIVE', 'Outcome contains secret-like values.');
  const file = outcomeFile(root);
  const existing = await listOutcomes({ workspace: root });
  existing.push(normalized);
  await writeTextAtomic(file, `${existing.map((item) => JSON.stringify(item)).join('\n')}\n`);
  return { schemaVersion: 1, status: 'created', outcome: normalized };
}

export async function listOutcomes({ workspace }) {
  const root = await resolveWorkspace(workspace);
  try {
    return (await readFile(outcomeFile(root), 'utf8')).split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
}

function effectiveness(outcome) {
  let score = outcome.verificationStatus === 'passed' ? 0.5 : -0.5;
  score += outcome.userAccepted ? 0.4 : -0.4;
  score += Number(outcome.correctionCount ?? 0) === 0 ? 0.05 : -Math.min(0.25, Number(outcome.correctionCount) * 0.1);
  score += Number(outcome.residualDefects ?? 0) === 0 ? 0.05 : -Math.min(0.25, Number(outcome.residualDefects) * 0.1);
  return Math.max(-1, Math.min(1, Number(score.toFixed(3))));
}

function validateOutcome(outcome) {
  for (const field of ['task', 'taskCategory', 'route']) {
    if (!String(outcome[field] ?? '').trim()) throw new ForgeMindError('FM_OUTCOME_INVALID', `Outcome field is required: ${field}`);
  }
  for (const field of ['correctionCount', 'residualDefects', 'durationMinutes']) {
    if (outcome[field] !== undefined && (!Number.isFinite(Number(outcome[field])) || Number(outcome[field]) < 0)) {
      throw new ForgeMindError('FM_OUTCOME_INVALID', `Outcome field must be a non-negative number: ${field}`);
    }
  }
}

function outcomeFile(root) {
  return assertContained(root, path.join(root, '.codex-orchestrator', 'memory', 'shared', 'outcomes.jsonl'));
}
