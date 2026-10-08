import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { loadConfig } from './config.mjs';
import { parseCsv } from './csv.mjs';
import { ForgeMindError } from './errors.mjs';
import { canonicalJson, writeTextAtomic } from './io.mjs';
import { resolveWorkspace } from './paths.mjs';
import { artifactStatePath } from './artifact-store.mjs';
import { redactValue } from './redact.mjs';

const STOP_WORDS = new Set(['about', 'after', 'again', 'cannot', 'could', 'from', 'hard', 'hours', 'into', 'lacks', 'long', 'take', 'takes', 'that', 'their', 'there', 'these', 'they', 'this', 'with', 'without']);

export async function importSignals({ workspace, input, format, sourceType = 'external-export', config }) {
  const root = await resolveWorkspace(workspace);
  const absolute = path.resolve(input);
  const content = await readFile(absolute, 'utf8');
  const selectedFormat = format ?? extensionFormat(absolute);
  const rows = parseInput(content, selectedFormat);
  if (!rows.length) throw new ForgeMindError('FM_SIGNAL_INVALID', 'Signal input contains no records.');
  const loadedConfig = config ?? await loadConfig(root);
  const importedAt = new Date().toISOString();
  const signals = rows.map((row, index) => normalizeSignal(row, { sourceType, input: absolute, index, importedAt, config: loadedConfig }));
  const existing = await listSignals({ workspace: root });
  const byId = new Map(existing.map((signal) => [signal.id, signal]));
  for (const signal of signals) byId.set(signal.id, signal);
  const file = signalFile(root);
  await writeTextAtomic(file, `${[...byId.values()].map((item) => JSON.stringify(item)).join('\n')}\n`);
  return { schemaVersion: 1, status: 'passed', imported: signals.length, signals, evidencePath: '.codex-orchestrator/product/signals.jsonl' };
}

export async function listSignals({ workspace }) {
  const root = await resolveWorkspace(workspace);
  try { return (await readFile(signalFile(root), 'utf8')).split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line)); }
  catch (error) { if (error.code === 'ENOENT') return []; throw error; }
}

export function clusterSignals(signals) {
  const remaining = new Map(signals.map((signal) => [signal.id, signal]));
  const clusters = [];
  while (remaining.size) {
    const frequencies = new Map();
    for (const signal of remaining.values()) {
      for (const term of terms(signal.problem)) frequencies.set(term, (frequencies.get(term) ?? 0) + 1);
    }
    const key = [...frequencies.entries()].sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))[0]?.[0] ?? 'misc';
    const members = [...remaining.values()].filter((signal) => key === 'misc' || terms(signal.problem).includes(key));
    for (const member of members) remaining.delete(member.id);
    const sourceSignalIds = members.map((signal) => signal.id).sort();
    clusters.push({
      key,
      sourceSignalIds,
      signalCount: members.length,
      totalFrequency: members.reduce((sum, signal) => sum + Number(signal.frequency ?? 1), 0),
      maxSeverity: Math.max(...members.map((signal) => Number(signal.severity ?? 1))),
      containsSensitive: members.some((signal) => signal.sensitivity === 'sensitive'),
      problems: members.map((signal) => signal.problem),
    });
  }
  return clusters.sort((left, right) => right.signalCount - left.signalCount || left.key.localeCompare(right.key));
}

export function createUspRecords(clusters) {
  return clusters.map((cluster) => {
    const score = {
      revenuePotential: Math.min(20, cluster.maxSeverity * 4),
      differentiation: 14,
      dataAvailability: Math.min(15, cluster.signalCount * 5),
      trustFeasibility: cluster.containsSensitive ? 7 : 13,
      buildEffort: 10,
      timeToMvp: 10,
    };
    score.total = Object.values(score).reduce((sum, value) => sum + value, 0);
    const id = `usp_${createHash('sha256').update(canonicalJson({ key: cluster.key, sources: cluster.sourceSignalIds })).digest('hex').slice(0, 24)}`;
    return {
      schemaVersion: 1,
      id,
      title: `Evidence-backed ${titleCase(cluster.key)} workflow`,
      sourceSignalIds: cluster.sourceSignalIds,
      hypothesis: `Solving the recurring ${cluster.key} problem will reduce effort or uncertainty for affected users.`,
      experiment: `Measure completion time and correction count for a ${cluster.key} MVP with the cited signal owners.`,
      status: 'proposed',
      score,
      outcome: null,
    };
  });
}

export async function saveUspRecords({ workspace, records }) {
  const root = await resolveWorkspace(workspace);
  const file = artifactStatePath(root, 'product', 'usp-backlog.jsonl');
  await writeTextAtomic(file, `${records.map((record) => JSON.stringify(record)).join('\n')}\n`);
  return { schemaVersion: 1, status: 'passed', records, evidencePath: '.codex-orchestrator/product/usp-backlog.jsonl' };
}

function normalizeSignal(row, context) {
  const problem = String(row.problem ?? row.issue ?? row.text ?? '').trim();
  if (!problem) throw new ForgeMindError('FM_SIGNAL_INVALID', `Signal row ${context.index + 1} is missing problem.`);
  const source = { type: context.sourceType, file: path.basename(context.input), row: context.index + 1 };
  const id = `sig_${createHash('sha256').update(canonicalJson({ source, problem })).digest('hex').slice(0, 24)}`;
  const candidate = {
    schemaVersion: 1,
    id,
    importedAt: context.importedAt,
    source,
    trust: 'external-untrusted',
    date: row.date ? new Date(row.date).toISOString() : null,
    audience: String(row.audience ?? 'unspecified'),
    problem,
    frequency: positiveNumber(row.frequency, 1),
    severity: Math.min(5, positiveNumber(row.severity, 1)),
    evidence: row.evidence ? [String(row.evidence)] : [],
    sensitivity: ['public', 'internal', 'sensitive'].includes(row.sensitivity) ? row.sensitivity : 'internal',
  };
  const redacted = redactValue(candidate, context.config.redaction);
  return { ...redacted.value, redacted: redacted.matches > 0, redactionTypes: redacted.types };
}

function parseInput(content, format) {
  if (format === 'json') {
    const parsed = JSON.parse(content);
    return Array.isArray(parsed) ? parsed : [parsed];
  }
  if (format === 'jsonl') return content.split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
  if (format === 'md' || format === 'markdown') return content.split(/\r?\n/).map((line) => line.match(/^\s*[-*]\s+(.+)/)?.[1]).filter(Boolean).map((problem) => ({ problem }));
  if (format === 'csv') return parseCsv(content);
  throw new ForgeMindError('FM_SIGNAL_INVALID', `Unsupported signal format: ${format}`);
}

function extensionFormat(file) {
  const extension = path.extname(file).slice(1).toLowerCase();
  return extension === 'markdown' ? 'md' : extension;
}

function terms(text) {
  return [...new Set(String(text).toLowerCase().match(/[a-z0-9]{4,}/g) ?? [])].filter((term) => !STOP_WORDS.has(term));
}

function positiveNumber(value, fallback) {
  const number = Number(value ?? fallback);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

function titleCase(value) { return value.charAt(0).toUpperCase() + value.slice(1); }

function signalFile(root) { return artifactStatePath(root, 'product', 'signals.jsonl'); }
