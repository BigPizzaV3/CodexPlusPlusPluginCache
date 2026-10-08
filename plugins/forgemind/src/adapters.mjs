import { access, readFile } from 'node:fs/promises';
import path from 'node:path';

import { artifactStatePath } from './artifact-store.mjs';
import { ForgeMindError, invalidInput } from './errors.mjs';
import { writeJsonAtomic } from './io.mjs';
import { evaluateAction } from './policy.mjs';
import { runProcess } from './process.mjs';
import { redactValue } from './redact.mjs';

const TYPES = new Set(['local-command', 'workspace-preview', 'git-draft', 'pr-draft', 'read-only-connector', 'feature-flag-sandbox']);
const SECRET_KEY = /(?:secret|token|password|credential|api[_-]?key)/i;

export function validateAdapterManifest(manifest) {
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) throw invalidInput('FM_ADAPTER_INVALID', 'Adapter manifest must be an object.');
  if (!TYPES.has(manifest.type)) throw invalidInput('FM_ADAPTER_TYPE_INVALID', 'Adapter type is not supported.');
  if (!Array.isArray(manifest.operations) || !manifest.operations.length || !manifest.operations.every((item) => typeof item === 'string')) throw invalidInput('FM_ADAPTER_OPERATIONS_INVALID', 'Adapter operations must be a non-empty string array.');
  if (!manifest.rollback || typeof manifest.rollback !== 'object') throw invalidInput('FM_ADAPTER_ROLLBACK_REQUIRED', 'Adapter manifest requires a rollback or compensating action.');
  if (hasSecret(manifest)) throw invalidInput('FM_ADAPTER_SECRET_REJECTED', 'Adapter manifests must reference credentials externally and cannot contain secrets.');
  return { ...manifest, operations: [...new Set(manifest.operations)].sort() };
}

export async function executeAdapter({ workspace, mission, action, grant, policy, config = {} }) {
  if (!action?.idempotencyKey) throw invalidInput('FM_ADAPTER_IDEMPOTENCY_REQUIRED', 'Adapter action requires an idempotencyKey.');
  const manifest = validateAdapterManifest(action.manifest);
  if (!manifest.operations.includes(action.operation)) throw invalidInput('FM_ADAPTER_OPERATION_DENIED', 'Adapter operation is not declared by its manifest.');
  const existing = await readReceipt(workspace, action.idempotencyKey);
  if (existing) return { ...existing, replayed: true };
  const grantDecision = evaluateGrant({ policy, grant, action, now: new Date() });
  if (grantDecision.decision !== 'allow') return saveReceipt(workspace, receipt(action, manifest, grantDecision, 'held', null, config));
  const preview = previewAction(workspace, action);
  if (!preview.safe) return saveReceipt(workspace, receipt(action, manifest, { decision: 'deny', rationale: preview.reason }, 'held', null, config));
  let result;
  if (manifest.type === 'local-command') {
    if (!Array.isArray(action.args)) throw invalidInput('FM_ADAPTER_ARGS_INVALID', 'Local command adapter requires args array.');
    result = await runProcess(action.command, action.args.map(String), { cwd: workspace });
    const status = result.exitCode === 0 ? 'succeeded' : 'failed';
    return saveReceipt(workspace, receipt(action, manifest, grantDecision, status, { ...result, preview }, config));
  }
  return saveReceipt(workspace, receipt(action, manifest, grantDecision, 'succeeded', { preview, dryRun: true }, config));
}

export function evaluateGrant({ policy, grant, action, now = new Date() }) {
  if (!grant || grant.missionId !== action.missionId) return { decision: 'deny', source: 'grant', rationale: 'A matching mission grant is required.' };
  if (!grant.expiresAt || new Date(grant.expiresAt) <= now) return { decision: 'deny', source: 'grant', rationale: 'Grant is absent or expired.' };
  if (!Array.isArray(grant.operations) || !grant.operations.includes(action.operation)) return { decision: 'deny', source: 'grant', rationale: 'Grant does not allow this operation.' };
  if (Number.isInteger(grant.maxActions) && grant.maxActions < 1) return { decision: 'deny', source: 'grant', rationale: 'Grant action budget is exhausted.' };
  const policyDecision = evaluateAction(policy, { kind: action.kind ?? 'command', path: action.path });
  if (policyDecision.decision !== 'allow') return policyDecision;
  return { decision: 'allow', source: 'grant', rationale: 'Policy and scoped grant allow this action.' };
}

function previewAction(workspace, action) {
  if (action.path) {
    const resolved = path.resolve(workspace, action.path);
    if (resolved !== path.resolve(workspace) && !resolved.startsWith(`${path.resolve(workspace)}${path.sep}`)) return { safe: false, reason: 'Adapter path escapes the workspace.' };
  }
  return { safe: true, command: action.command ?? null, args: action.args ?? [], path: action.path ?? null };
}
function receipt(action, manifest, policyDecision, status, result, config) {
  const redacted = redactValue({ action: { operation: action.operation, command: action.command, args: action.args, path: action.path }, result }, config);
  return { schemaVersion: 1, idempotencyKey: action.idempotencyKey, missionId: action.missionId, adapter: { type: manifest.type, operation: action.operation }, preview: result?.preview ?? previewAction(process.cwd(), action), rollback: manifest.rollback, policyDecision, status, result: redacted.value.result ?? null, redactions: redacted.types, createdAt: new Date().toISOString(), errors: [] };
}
async function saveReceipt(workspace, value) { await writeJsonAtomic(receiptPath(workspace, value.idempotencyKey), value); return value; }
async function readReceipt(workspace, key) { try { return JSON.parse(await readFile(receiptPath(workspace, key), 'utf8')); } catch (error) { if (error.code === 'ENOENT') return null; throw error; } }
function receiptPath(workspace, key) { if (!/^[A-Za-z0-9._-]{1,120}$/.test(String(key))) throw new ForgeMindError('FM_ADAPTER_IDEMPOTENCY_INVALID', 'idempotencyKey must be a safe filename.'); return artifactStatePath(workspace, 'adapters', 'receipts', `${key}.json`); }
function hasSecret(value) { if (Array.isArray(value)) return value.some(hasSecret); if (!value || typeof value !== 'object') return false; return Object.entries(value).some(([key, child]) => SECRET_KEY.test(key) || hasSecret(child)); }
