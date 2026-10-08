import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { loadConfig } from './config.mjs';
import { ForgeMindError } from './errors.mjs';
import { canonicalJson, writeTextAtomic } from './io.mjs';
import { assertContained, resolveWorkspace } from './paths.mjs';
import { redactValue } from './redact.mjs';

export async function appendMemoryEntry({ workspace, scope, entry, now = new Date(), config }) {
  const root = await resolveWorkspace(workspace);
  validateScope(scope);
  const loadedConfig = config ?? await loadConfig(root);
  const candidate = normalizeEntry(scope, entry, now);
  const redaction = redactValue(candidate, loadedConfig.redaction);
  if (redaction.matches) {
    throw new ForgeMindError('FM_MEMORY_SENSITIVE', `Memory entry contains ${redaction.matches} secret-like value(s).`);
  }
  validateEntry(candidate);

  const file = memoryFile(root, scope);
  const entries = await readEntries(file);
  const duplicate = entries.find((existing) => existing.id === candidate.id);
  if (duplicate) return { schemaVersion: 1, status: 'duplicate', entry: duplicate };
  entries.push(candidate);
  await writeTextAtomic(file, `${entries.map((item) => JSON.stringify(item)).join('\n')}\n`);
  await writeMemoryView(root, scope, entries);
  return { schemaVersion: 1, status: 'created', entry: candidate };
}

export async function readActiveMemory({ workspace, scope, now = new Date() }) {
  const root = await resolveWorkspace(workspace);
  validateScope(scope);
  const entries = await readEntries(memoryFile(root, scope));
  const superseded = new Set(entries.map((entry) => entry.supersedes).filter(Boolean));
  const instant = now instanceof Date ? now : new Date(now);
  return entries.filter((entry) => {
    if (entry.reviewState === 'rejected' || superseded.has(entry.id)) return false;
    if (!entry.nonExpiring && entry.expiresAt && new Date(entry.expiresAt) <= instant) return false;
    return true;
  });
}

export function findMemoryConflicts(entries) {
  const groups = new Map();
  for (const entry of entries) {
    const key = `${entry.type}:${entry.subject}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(entry);
  }
  return [...groups.entries()]
    .filter(([, values]) => new Set(values.map((entry) => entry.statement)).size > 1)
    .map(([key, values]) => {
      const ordered = [...values].sort((left, right) => left.id.localeCompare(right.id));
      return {
        key,
        entryIds: ordered.map((entry) => entry.id),
        statements: ordered.map((entry) => entry.statement),
      };
    })
    .sort((left, right) => left.key.localeCompare(right.key));
}

function normalizeEntry(scope, entry, now) {
  const identity = {
    scope,
    type: String(entry.type ?? '').trim(),
    subject: String(entry.subject ?? '').trim(),
    statement: String(entry.statement ?? '').trim(),
    source: String(entry.source ?? '').trim(),
  };
  const id = `fm_${createHash('sha256').update(canonicalJson(identity)).digest('hex').slice(0, 24)}`;
  return {
    schemaVersion: 1,
    id,
    ...identity,
    evidence: [...new Set((entry.evidence ?? []).map(String))],
    author: String(entry.author ?? 'unknown'),
    createdAt: (entry.createdAt ? new Date(entry.createdAt) : now).toISOString(),
    reviewedAt: entry.reviewedAt ? new Date(entry.reviewedAt).toISOString() : null,
    confidence: Number(entry.confidence ?? 0.5),
    reviewState: entry.reviewState ?? 'pending',
    expiresAt: entry.expiresAt ? new Date(entry.expiresAt).toISOString() : null,
    nonExpiring: Boolean(entry.nonExpiring),
    sensitivity: entry.sensitivity ?? 'internal',
    supersedes: entry.supersedes ?? null,
  };
}

function validateEntry(entry) {
  for (const field of ['type', 'subject', 'statement', 'source']) {
    if (!entry[field]) throw new ForgeMindError('FM_MEMORY_INVALID', `Memory field is required: ${field}`);
  }
  if (entry.confidence < 0 || entry.confidence > 1) throw new ForgeMindError('FM_MEMORY_INVALID', 'Memory confidence must be between 0 and 1.');
  if (!['pending', 'approved', 'rejected'].includes(entry.reviewState)) throw new ForgeMindError('FM_MEMORY_INVALID', `Invalid review state: ${entry.reviewState}`);
  if (!['public', 'internal', 'sensitive'].includes(entry.sensitivity)) throw new ForgeMindError('FM_MEMORY_INVALID', `Invalid sensitivity: ${entry.sensitivity}`);
  if (!entry.nonExpiring && !entry.expiresAt) throw new ForgeMindError('FM_MEMORY_INVALID', 'Memory must declare expiresAt or nonExpiring.');
}

function validateScope(scope) {
  if (!['shared', 'personal'].includes(scope)) throw new ForgeMindError('FM_MEMORY_SCOPE_INVALID', `Invalid memory scope: ${scope}`);
}

function memoryFile(root, scope) {
  return assertContained(root, path.join(root, '.codex-orchestrator', 'memory', scope, 'entries.jsonl'));
}

async function readEntries(file) {
  let content;
  try { content = await readFile(file, 'utf8'); } catch (error) { if (error.code === 'ENOENT') return []; throw error; }
  return content.split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
}

async function writeMemoryView(root, scope, entries) {
  const file = assertContained(root, path.join(root, '.codex-orchestrator', 'memory', scope, 'memory.md'));
  const rows = [...entries].sort((left, right) => left.id.localeCompare(right.id)).map((entry) =>
    `- **${entry.type}/${entry.subject}** (${entry.reviewState}, ${entry.confidence}): ${entry.statement} — ${entry.source} [${entry.id}]`,
  );
  await writeTextAtomic(file, `# ForgeMind ${scope} memory\n\n${rows.join('\n')}\n`);
}
