import { readFile } from 'node:fs/promises';

import { artifactStatePath } from './artifact-store.mjs';
import { writeJsonAtomic } from './io.mjs';
import { resolveWorkspace } from './paths.mjs';

const SUCCESS = new Set(['passed', 'ready', 'completed', 'matched', 'implementation-ready']);

export async function recordCommandOutcome({ workspace, command, status, durationMs }) {
  const root = await resolveWorkspace(workspace);
  const current = await readMetrics(root);
  const event = { command: String(command), status: String(status), durationMs: Math.max(0, Math.round(Number(durationMs) || 0)), recordedAt: new Date().toISOString() };
  const events = [...current.events, event].slice(-200);
  await writeJsonAtomic(pathFor(root), { schemaVersion: 1, events });
  return summarize(events);
}

export async function getCommandMetrics({ workspace }) { return summarize((await readMetrics(await resolveWorkspace(workspace))).events); }

async function readMetrics(workspace) { try { return JSON.parse(await readFile(pathFor(workspace), 'utf8')); } catch (error) { if (error.code === 'ENOENT') return { events: [] }; throw error; } }
function pathFor(workspace) { return artifactStatePath(workspace, 'metrics', 'command-outcomes.json'); }
function summarize(events) {
  const byCommand = {};
  for (const event of events) {
    const bucket = byCommand[event.command] ??= { runs: 0, successes: 0, durationMs: 0 };
    bucket.runs += 1; bucket.successes += SUCCESS.has(event.status) ? 1 : 0; bucket.durationMs += event.durationMs;
  }
  for (const bucket of Object.values(byCommand)) { bucket.successRate = bucket.runs ? bucket.successes / bucket.runs : 0; bucket.averageDurationMs = bucket.runs ? Math.round(bucket.durationMs / bucket.runs) : 0; delete bucket.successes; delete bucket.durationMs; }
  return { schemaVersion: 1, totalRuns: events.length, byCommand, evidencePath: '.codex-orchestrator/metrics/command-outcomes.json', errors: [] };
}
