import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { ForgeMindError, invalidInput } from './errors.mjs';
import { writeTextAtomic } from './io.mjs';
import { resolveWorkspace } from './paths.mjs';
import { artifactStatePath } from './artifact-store.mjs';
import { inspectProject } from './project.mjs';
import { listSignals } from './signals.mjs';

export async function operator({ workspace, action, goal, approved = false }) {
  const root = await resolveWorkspace(workspace);
  if (action === 'plan') return persist(root, 'outcome-operator-latest.json', {
    status: 'passed', goal: required(goal, 'FM_OPERATOR_GOAL_REQUIRED', 'Outcome Operator requires --goal.'),
    contract: { input: 'one outcome', actions: ['inspect permitted context', 'draft reversible action plan', 'request material-decision review'], actionAdapters: ['typed local adapter manifest', 'preview', 'undo or compensating action'], limits: { externalSpend: 0, production: false, destructive: false }, approvalRequired: true },
    next: 'Register an adapter and approve the preview before execution.',
  });
  const contract = await readArtifact(root, 'outcome-operator-latest.json');
  if (action === 'authorize') return persist(root, 'outcome-operator-authorization.json', { status: approved ? 'approved' : 'held', operatorGoal: contract.goal, approved: Boolean(approved), boundary: 'Authorization permits only the reviewed reversible action plan; no adapter is executed by this command.' });
  if (action === 'status') return { schemaVersion: 1, status: 'passed', contract, authorization: await optionalArtifact(root, 'outcome-operator-authorization.json'), errors: [] };
  throw invalidInput('FM_OPERATOR_ACTION_INVALID', 'Operator supports plan, authorize, and status.');
}

export async function observeWorkflow({ workspace, input }) {
  const root = await resolveWorkspace(workspace);
  if (!input) throw invalidInput('FM_OBSERVER_INPUT_REQUIRED', 'Workflow Observer requires --input JSON events.');
  const events = JSON.parse(await readFile(path.resolve(input), 'utf8'));
  if (!Array.isArray(events) || events.length > 10000) throw invalidInput('FM_OBSERVER_INPUT_INVALID', 'Workflow events must be an array of at most 10,000 records.');
  const groups = new Map();
  for (const event of events) { const key = String(event.workflow ?? event.action ?? 'unknown').slice(0, 120); groups.set(key, (groups.get(key) ?? 0) + 1); }
  const candidates = [...groups.entries()].map(([workflow, occurrences]) => ({ workflow, occurrences, recommendation: occurrences >= 3 ? 'observe-for-elimination' : 'insufficient-repetition' })).sort((a, b) => b.occurrences - a.occurrences);
  return persist(root, 'workflow-observer-latest.json', { status: 'passed', eventCount: events.length, retainedFields: ['workflow/action only'], discardedFields: ['user identifiers', 'raw payloads'], candidates, next: 'Use forgemind radical analyze with the strongest observed workflow.' });
}

export async function experimentAutopilot({ workspace, action, goal }) {
  const root = await resolveWorkspace(workspace);
  if (action === 'create') return persist(root, 'experiment-autopilot-latest.json', { status: 'draft', goal: required(goal, 'FM_EXPERIMENT_GOAL_REQUIRED', 'Experiment Autopilot requires --goal.'), featureFlag: `fm-${slug(goal)}`, stages: ['instrument', 'small-cohort', 'evaluate', 'scale-or-stop'], metrics: ['completion', 'time-saved', 'edit-rate', 'rollback-rate'], guardrails: ['no critical defect', 'no accessibility regression', 'no unbounded cost'], decision: 'collecting', next: 'Connect a feature flag and telemetry source, then record tester evidence.' });
  if (action === 'status') return { schemaVersion: 1, status: 'passed', experiment: await readArtifact(root, 'experiment-autopilot-latest.json'), errors: [] };
  throw invalidInput('FM_EXPERIMENT_AUTOPILOT_ACTION_INVALID', 'Experiment Autopilot supports create and status.');
}

export async function providerRegistry({ workspace }) {
  const root = await resolveWorkspace(workspace);
  const configured = await optionalJson(path.join(root, '.forgemind.providers.json'));
  const providers = Array.isArray(configured?.providers) ? configured.providers.map((provider) => ({ name: String(provider.name ?? 'unknown'), capabilities: Array.isArray(provider.capabilities) ? provider.capabilities : [], enabled: Boolean(provider.enabled), credentialsRead: false })) : [];
  return persist(root, 'ai-provider-registry-latest.json', { status: 'passed', providers, defaultPolicy: { localFirst: true, credentialsRead: false, outboundCalls: 'disabled-until-an-explicit-project-adapter-is-configured', requiredLogging: ['provider', 'model', 'cost', 'purpose', 'evidence-reference'] } });
}

export async function refactorPortfolio({ workspace }) {
  const root = await resolveWorkspace(workspace); const profile = await inspectProject(root);
  return persist(root, 'ai-native-refactor-latest.json', { status: 'passed', project: { stacks: profile.stacks, commands: profile.commands }, candidates: [
    { decision: 'automate', target: 'repeated status lookup', replacement: 'proactive outcome update', proof: 'reduced status-check events' },
    { decision: 'eliminate', target: 'manual context copying', replacement: 'permissioned context retrieval', proof: 'fewer handoff steps' },
    { decision: 'keep', target: 'material confirmation', reason: 'retains user control at consequential boundaries' },
  ], next: 'Select one candidate, create a Radical blueprint, and verify the replacement flow.' });
}

export async function truthLoop({ workspace, goal }) {
  const root = await resolveWorkspace(workspace); const signals = await listSignals({ workspace: root });
  return persist(root, 'customer-truth-loop-latest.json', { status: 'passed', goal: String(goal ?? 'validate the highest-value workflow').trim(), evidence: { signalCount: signals.length, state: signals.length ? 'signals-present' : 'assumption-only', rule: 'Signals are evidence inputs, not proof of demand or causation.' }, graph: signals.slice(0, 20).map((signal) => ({ id: signal.id, problem: signal.problem ?? null, confidence: signal.confidence ?? null })), next: 'Import counterevidence and run a bounded experiment before a product decision.' });
}

export async function autonomyReadiness({ workspace }) {
  const root = await resolveWorkspace(workspace); const artifacts = await Promise.all(['outcome-operator-latest.json', 'workflow-observer-latest.json', 'experiment-autopilot-latest.json', 'ai-provider-registry-latest.json'].map((name) => optionalArtifact(root, name)));
  const receipts = await listReceipts(root); const succeeded = receipts.some((receipt) => receipt.status === 'succeeded' && receipt.rollback);
  const mission = await optionalJson(artifactStatePath(root, 'autopilot', 'mission-latest.json'));
  const available = artifacts.filter(Boolean).length; const score = Math.min(100, available * 15 + (succeeded ? 40 : 0)); const mode = mission?.state === 'held' ? 'held' : succeeded ? 'bounded-autopilot' : available ? 'suggest' : 'observe';
  return persist(root, 'autonomy-readiness-latest.json', { status: mode === 'bounded-autopilot' ? 'ready-with-notes' : mode === 'held' ? 'held' : 'risky', mode, score, dimensions: { outcomeContract: Boolean(artifacts[0]), observedWorkflow: Boolean(artifacts[1]), experimentGuardrails: Boolean(artifacts[2]), providerGovernance: Boolean(artifacts[3]), reversibility: succeeded }, allowedNow: mode === 'bounded-autopilot' ? ['observe', 'suggest', 'bounded-autopilot'] : ['observe', 'suggest'], blockedUntilEvidence: ['autonomous production', 'destructive action', 'external spend', 'irreversible migration', 'high-stakes decision'], next: succeeded ? 'Continue only through active scoped grants and reversible adapters.' : 'Execute a configured reversible adapter successfully before bounded autopilot.' });
}

export async function truthfulDemo({ workspace, title }) {
  const root = await resolveWorkspace(workspace); const blueprint = await optionalArtifact(root, 'radical-blueprint-latest.json'); const readiness = await optionalArtifact(root, 'autonomy-readiness-latest.json');
  return persist(root, 'truthful-demo-latest.json', { status: 'passed', title: String(title ?? 'ForgeMind proof-carrying demo').trim(), claims: blueprint ? [blueprint.newParadigm, blueprint.proof?.successMetric].filter(Boolean) : [], evidenceGaps: [blueprint ? null : 'No Radical blueprint exists.', readiness?.score >= 60 ? null : 'Autonomy is not yet ready beyond observe/suggest.'].filter(Boolean), rule: 'Present only claims linked to persisted artifacts; do not portray planned automation as executed automation.' });
}

async function persist(root, name, body) { const value = { schemaVersion: 1, generatedAt: new Date().toISOString(), ...body, artifactPath: `.codex-orchestrator/product/${name}`, errors: [] }; await writeTextAtomic(artifactStatePath(root, 'product', name), `${JSON.stringify(value, null, 2)}\n`); return value; }
async function readArtifact(root, name) { const value = await optionalArtifact(root, name); if (!value) throw new ForgeMindError('FM_AI_NATIVE_ARTIFACT_MISSING', `Create the required artifact first: ${name}.`); return value; }
async function optionalArtifact(root, name) { return optionalJson(artifactStatePath(root, 'product', name)); }
async function optionalJson(file) { try { return JSON.parse(await readFile(file, 'utf8')); } catch { return null; } }
async function listReceipts(root) { try { const { readdir } = await import('node:fs/promises'); const directory = artifactStatePath(root, 'adapters', 'receipts'); return Promise.all((await readdir(directory)).filter((name) => name.endsWith('.json')).map((name) => optionalJson(path.join(directory, name)))).then((items) => items.filter(Boolean)); } catch { return []; } }
function required(value, code, message) { if (!String(value ?? '').trim()) throw invalidInput(code, message); return String(value).trim(); }
function slug(value) { return String(value).toLowerCase().replaceAll(/[^a-z0-9]+/g, '-').replaceAll(/^-|-$/g, '').slice(0, 48) || 'experiment'; }
