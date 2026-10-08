import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { ForgeMindError } from '../errors.mjs';
import { writeJsonAtomic, writeTextAtomic } from '../io.mjs';
import { assertContained, resolveWorkspace } from '../paths.mjs';
import { redactValue } from '../redact.mjs';
import { loadConfig } from '../config.mjs';
import { sealRecord, verifyRecord } from './integrity.mjs';

export async function appendFlightEvent({ workspace, event, now = new Date() }) {
  const root = await resolveWorkspace(workspace);
  validateEvent(event);
  const current = await readFlightEvents({ workspace: root });
  if (current.length && (await verifyFlight({ workspace: root })).status !== 'valid') {
    throw new ForgeMindError('FM_FLIGHT_TAMPERED', 'Cannot append to an invalid flight chain.');
  }
  const sequence = current.length + 1;
  const previousDigest = current.at(-1)?.digest?.value ?? null;
  const config = await loadConfig(root);
  const redacted = redactValue(event, config.redaction);
  const sealed = sealRecord({
    schemaVersion: 1,
    id: `flight_${String(sequence).padStart(8, '0')}`,
    sequence,
    timestamp: now.toISOString(),
    previousDigest,
    ...redacted.value,
    redaction: { matches: redacted.matches, types: redacted.types },
  });
  const events = [...current, sealed];
  const paths = flightPaths(root);
  await writeTextAtomic(paths.events, `${events.map((item) => JSON.stringify(item)).join('\n')}\n`);
  await writeJsonAtomic(paths.head, sealRecord({ schemaVersion: 1, id: 'flight_head', eventCount: events.length, headDigest: sealed.digest.value }));
  return { schemaVersion: 1, status: 'recorded', event: sealed, evidencePath: '.codex-orchestrator/forge/flights/events.jsonl' };
}

export async function readFlightEvents({ workspace }) {
  const root = await resolveWorkspace(workspace);
  try { return (await readFile(flightPaths(root).events, 'utf8')).split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line)); }
  catch (error) { if (error.code === 'ENOENT') return []; throw error; }
}

export async function verifyFlight({ workspace }) {
  const root = await resolveWorkspace(workspace);
  const events = await readFlightEvents({ workspace: root });
  const errors = [];
  let previous = null;
  events.forEach((event, index) => {
    if (event.sequence !== index + 1) errors.push({ code: 'FM_FLIGHT_SEQUENCE', sequence: event.sequence, message: 'Flight sequence is not contiguous.' });
    if (event.previousDigest !== previous) errors.push({ code: 'FM_FLIGHT_LINK', sequence: event.sequence, message: 'Flight predecessor digest does not match.' });
    if (verifyRecord(event).status !== 'valid') errors.push({ code: 'FM_FLIGHT_DIGEST', sequence: event.sequence, message: 'Flight event digest is invalid.' });
    previous = event.digest?.value ?? null;
  });
  let head = null;
  try { head = JSON.parse(await readFile(flightPaths(root).head, 'utf8')); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  if (events.length || head) {
    if (!head || verifyRecord(head).status !== 'valid') errors.push({ code: 'FM_FLIGHT_HEAD', message: 'Flight head is missing or invalid.' });
    else {
      if (head.eventCount !== events.length) errors.push({ code: 'FM_FLIGHT_TRUNCATED', message: 'Flight event count differs from the anchored head.' });
      if (head.headDigest !== previous) errors.push({ code: 'FM_FLIGHT_HEAD_LINK', message: 'Flight head digest differs from the last event.' });
    }
  }
  return { schemaVersion: 1, status: errors.length ? 'invalid' : 'valid', eventCount: events.length, headDigest: previous, errors };
}

export async function replayFlight({ workspace }) {
  const verification = await verifyFlight({ workspace });
  if (verification.status !== 'valid') throw new ForgeMindError('FM_FLIGHT_TAMPERED', 'Flight replay requires a valid event chain.', { details: verification.errors });
  const events = await readFlightEvents({ workspace });
  const subjects = {};
  const capabilities = {};
  for (const event of events) {
    subjects[event.subject] = { capability: event.capability, action: event.action, status: event.status, sequence: event.sequence };
    capabilities[event.capability] = (capabilities[event.capability] ?? 0) + 1;
  }
  return {
    schemaVersion: 1,
    status: 'replayed',
    eventCount: events.length,
    subjects,
    capabilities,
    timeline: events.map(({ sequence, timestamp, capability, action, subject, status, digest }) => ({ sequence, timestamp, capability, action, subject, status, digest: digest.value })),
    errors: [],
  };
}

function flightPaths(root) {
  const directory = assertContained(root, path.join(root, '.codex-orchestrator', 'forge', 'flights'));
  return { events: path.join(directory, 'events.jsonl'), head: path.join(directory, 'head.json') };
}

function validateEvent(event) {
  for (const field of ['capability', 'action', 'subject', 'status']) {
    if (!String(event?.[field] ?? '').trim()) throw new ForgeMindError('FM_FLIGHT_EVENT_INVALID', `Flight event field is required: ${field}`);
  }
}
