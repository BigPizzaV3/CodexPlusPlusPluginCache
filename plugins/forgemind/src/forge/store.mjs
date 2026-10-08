import { access, readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

import { loadConfig } from '../config.mjs';
import { ForgeMindError } from '../errors.mjs';
import { writeJsonAtomic } from '../io.mjs';
import { assertContained, resolveWorkspace } from '../paths.mjs';
import { redactValue } from '../redact.mjs';
import { sealRecord, verifyRecord } from './integrity.mjs';

const AREA_PATTERN = /^[a-z0-9][a-z0-9-]*(?:\/[a-z0-9][a-z0-9-]*)*$/;
const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;

export async function saveForgeRecord({ workspace, area, record }) {
  const root = await resolveWorkspace(workspace);
  validateArea(area);
  if (!ID_PATTERN.test(String(record?.id ?? ''))) throw new ForgeMindError('FM_FORGE_ID_INVALID', 'Forge record ID is missing or invalid.');
  const config = await loadConfig(root);
  const redacted = redactValue(record, config.redaction);
  const sealed = sealRecord({ ...redacted.value, redaction: { matches: redacted.matches, types: redacted.types } });
  const directory = forgeArea(root, area);
  const target = assertContained(directory, path.join(directory, `${sealed.id}.json`));
  await writeJsonAtomic(target, sealed);
  return { schemaVersion: 1, status: 'saved', record: sealed, path: target };
}

export async function loadForgeRecord({ workspace, area, reference }) {
  const root = await resolveWorkspace(workspace);
  validateArea(area);
  const directory = forgeArea(root, area);
  let target;
  if (ID_PATTERN.test(String(reference ?? ''))) target = path.join(directory, `${reference}.json`);
  else target = path.resolve(root, String(reference ?? ''));
  target = assertContained(directory, target);
  let record;
  try { record = JSON.parse(await readFile(target, 'utf8')); }
  catch (error) { throw new ForgeMindError('FM_FORGE_RECORD_NOT_FOUND', `Forge record could not be loaded: ${reference}`, { cause: error }); }
  if (verifyRecord(record).status !== 'valid') throw new ForgeMindError('FM_FORGE_RECORD_TAMPERED', `Forge record digest is invalid: ${reference}`);
  return record;
}

export async function listForgeRecords({ workspace, area }) {
  const root = await resolveWorkspace(workspace);
  validateArea(area);
  const directory = forgeArea(root, area);
  try {
    const files = (await readdir(directory)).filter((file) => file.endsWith('.json')).sort();
    return Promise.all(files.map(async (file) => loadForgeRecord({ workspace: root, area, reference: file.slice(0, -5) })));
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
}

export function forgeArea(workspace, area) {
  validateArea(area);
  const base = assertContained(workspace, path.join(workspace, '.codex-orchestrator', 'forge'));
  return assertContained(base, path.join(base, ...area.split('/')));
}

export async function forgeRecordExists({ workspace, area, id }) {
  try { await access(path.join(forgeArea(path.resolve(workspace), area), `${id}.json`)); return true; }
  catch { return false; }
}

function validateArea(area) {
  if (!AREA_PATTERN.test(String(area ?? ''))) throw new ForgeMindError('FM_FORGE_AREA_INVALID', `Invalid Forge storage area: ${area}`);
}
