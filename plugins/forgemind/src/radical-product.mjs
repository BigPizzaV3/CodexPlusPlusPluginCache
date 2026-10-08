import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { ForgeMindError, invalidInput } from './errors.mjs';
import { writeTextAtomic } from './io.mjs';
import { resolveWorkspace } from './paths.mjs';
import { artifactStatePath } from './artifact-store.mjs';
import { inspectProject } from './project.mjs';
import { clusterSignals, listSignals } from './signals.mjs';

const PARADIGMS = [
  ['invisible-workflow-compiler', 'Invisible Workflow Compiler', 'A recurring multi-step interaction becomes one intent plus a reviewed outcome.', 'Observed task events, product context, policy, and user corrections.', 'Event intake, workflow candidate, one-click preview, explicit undo.', 'The agent cannot identify a repeated workflow or save at least 70% of its active steps.'],
  ['outcome-operator', 'Outcome Operator', 'The user states the result; an agent plans and completes bounded work across the current app.', 'Goal, project context, permissions, historical outcomes, and live task state.', 'Goal composer, action preview, bounded executor, proof and rollback record.', 'The result cannot be decomposed into a reversible action plan with an accountable owner.'],
  ['product-digital-twin', 'Product Digital Twin', 'The product tests competing futures before teams build a conventional feature.', 'Repository context, telemetry, customer signals, market assumptions, and experiment results.', 'Three scenario simulator, uncertainty ledger, experiment selector, decision record.', 'The scenarios do not change a build, pricing, or experiment decision in five product reviews.'],
  ['self-deleting-interface', 'Self-Deleting Interface', 'The system identifies UI that only transports information and replaces it with proactive action.', 'Screen states, task traces, accessibility structure, support friction, and acceptance outcomes.', 'Interaction inventory, eliminate/automate/keep ranking, replacement agent flow, UI regression tests.', 'Removing or automating the interaction lowers completion or creates an unmitigated accessibility risk.'],
  ['autonomous-experiment-cell', 'Autonomous Experiment Cell', 'Instead of a feature backlog, the product runs evidence-bounded experiments that scale, iterate, or stop.', 'Hypotheses, exposure, product telemetry, tester evidence, costs, and guardrail metrics.', 'Hypothesis contract, feature-flag adapter, telemetry mapping, automatic decision draft.', 'The experiment lacks a measurable outcome, safe guardrail, or explicit stop condition.'],
];

export async function createRadicalPortfolio({ workspace, goal }) {
  const root = await resolveWorkspace(workspace);
  const profile = await inspectProject(root);
  const signals = await listSignals({ workspace: root });
  const clusters = clusterSignals(signals);
  const focus = String(goal ?? '').trim() || 'eliminate the highest-friction workflow in this app';
  const sourceSignalIds = clusters.flatMap((cluster) => cluster.sourceSignalIds).slice(0, 8);
  const evidenceBasis = sourceSignalIds.length ? 'external-signal-ids' : 'project-profile-assumption';
  const ideas = PARADIGMS.map(([id, title, replacement, data, mvp, killCondition], index) => ({
    id, title, status: 'hypothesis', goal: focus, interactionReplaced: replacement,
    tenXHypothesis: `Reduce the active user steps for ${focus} by at least 90% while preserving a visible review and rollback path.`,
    aiCore: data, mvp, moat: moatFor(id), killCondition, sourceSignalIds, evidenceBasis,
    score: scoreIdea(index, sourceSignalIds.length, profile.stacks.length),
    recommendation: sourceSignalIds.length ? 'validate-first' : 'assumption-first',
  })).sort((left, right) => right.score.total - left.score.total || left.id.localeCompare(right.id));
  const portfolio = {
    schemaVersion: 1, status: 'passed', generatedAt: new Date().toISOString(), goal: focus,
    currentAppBreakdown: {
      known: `Detected stacks: ${profile.stacks.join(', ') || 'unknown'}; available project commands: ${profile.commands.length}.`,
      assumptions: ['The existing workflow must be observed or described before its removal is treated as validated.', 'No user behavior, market claim, or ROI claim is inferred from repository structure alone.'],
      standardStepsToChallenge: ['manual data gathering', 'screen-to-screen handoffs', 'status checking', 'copying context between tools', 'unverified decisions'],
    },
    evidence: { basis: evidenceBasis, sourceSignalIds, note: sourceSignalIds.length ? 'Signals ground the hypotheses; they do not prove demand or autonomy safety.' : 'No imported signals found: all radical bets remain repository-aware assumptions.' },
    ideas, selectionCriteria: ['status-quo break', '10x step reduction', 'AI centrality', 'MVP feasibility', 'defensible data or workflow moat', 'reversible trust boundary'],
    nextAction: 'Use radical select --id <idea-id>, then radical blueprint and radical shadow-mode before autonomous execution.',
    artifactPath: '.codex-orchestrator/product/radical-portfolio-latest.json', errors: [],
  };
  await persist(root, 'radical-portfolio-latest.json', portfolio);
  return portfolio;
}

export async function selectRadicalIdea({ workspace, id, selectionMode = 'explicit' }) {
  if (!String(id ?? '').trim()) throw invalidInput('FM_RADICAL_ID_REQUIRED', 'Radical selection requires --id from radical portfolio.');
  const root = await resolveWorkspace(workspace);
  const portfolio = await readArtifact(root, 'radical-portfolio-latest.json');
  const idea = portfolio.ideas?.find((candidate) => candidate.id === id);
  if (!idea) throw invalidInput('FM_RADICAL_ID_UNKNOWN', `Unknown radical idea: ${id}.`);
  const rationale = selectionMode === 'leap-deterministic'
    ? 'Selected by Leap using the deterministic disruption score; it remains an assumption-led product bet until validated with qualified evidence.'
    : 'Selected explicitly by the product team; score is a prioritization aid, not an autonomous product decision.';
  const selection = { schemaVersion: 1, status: 'passed', generatedAt: new Date().toISOString(), selected: idea, rationale, requiredBeforeBuild: ['named target workflow', 'success metric', 'kill condition', 'permission boundary', 'rollback path'], errors: [] };
  await persist(root, 'radical-selection-latest.json', selection);
  return selection;
}

export async function createRadicalBlueprint({ workspace, id, selectionMode }) {
  const root = await resolveWorkspace(workspace);
  const selected = id ? (await selectRadicalIdea({ workspace: root, id, selectionMode })).selected : (await readArtifact(root, 'radical-selection-latest.json')).selected;
  const blueprint = {
    schemaVersion: 1, status: 'passed', generatedAt: new Date().toISOString(), idea: selected,
    newParadigm: `Replace the existing interaction with ${selected.title}: ${selected.interactionReplaced}`,
    uxFlow: ['User supplies one outcome or confirms detected intent.', 'System gathers permitted context and drafts a reversible action plan.', 'User sees only consequential decisions, exceptions, and an undo path.', 'System produces outcome evidence and learns from explicit corrections.'],
    minimalUi: ['Outcome composer or contextual one-click trigger', 'Action preview for consequential work', 'Exception and rollback surface', 'No dashboard is required for the core task.'],
    aiCore: { responsibilities: ['infer bounded intent', 'retrieve permitted context', 'rank reversible actions', 'explain material decisions', 'detect confidence or policy gaps'], decisionRule: 'Autonomously execute only actions inside the configured permission, cost, reversibility, and confidence boundaries; otherwise create a review request.', data: selected.aiCore },
    mvp: { components: selected.mvp.split(', ').map((name) => name.trim()), integrations: ['optional model-provider adapter', 'local evidence store', 'existing app action adapter', 'telemetry or tester input'], buildSteps: ['Map one repeated workflow and its baseline steps.', 'Implement the outcome contract and preview.', 'Add a bounded action adapter with undo or compensating action.', 'Instrument completion, edits, exceptions, and rollback.', 'Run target-user, functional, accessibility, and adversarial tests.'] },
    proof: { successMetric: selected.tenXHypothesis, killCondition: selected.killCondition, replacedFunction: selected.interactionReplaced, moat: selected.moat },
    artifactPath: '.codex-orchestrator/product/radical-blueprint-latest.json', errors: [],
  };
  await persist(root, 'radical-blueprint-latest.json', blueprint);
  return blueprint;
}

export async function createShadowModePlan({ workspace, id }) {
  const root = await resolveWorkspace(workspace);
  const blueprint = id ? await createRadicalBlueprint({ workspace: root, id }) : await readArtifact(root, 'radical-blueprint-latest.json');
  const plan = { schemaVersion: 1, status: 'passed', generatedAt: new Date().toISOString(), ideaId: blueprint.idea.id,
    phases: [
      { name: 'observe', action: 'Collect privacy-minimized workflow events; do not act.', exitEvidence: 'Repeated workflow and baseline step count are confirmed.' },
      { name: 'suggest', action: 'Draft the outcome and action plan for user review.', exitEvidence: 'Users accept or edit the suggestion at a defined rate.' },
      { name: 'approve', action: 'Execute only a user-approved reversible action.', exitEvidence: 'Functional, accessibility, and rollback evidence pass.' },
      { name: 'bounded-autopilot', action: 'Execute only pre-authorized low-risk actions inside limits.', exitEvidence: 'Guardrails, costs, exceptions, and undo remain within thresholds.' },
    ],
    hardBoundaries: ['Never access secrets or production without approval.', 'Never make irreversible, destructive, externally billed, or high-stakes decisions autonomously.', 'Stop and surface an exception when confidence, policy, or rollback requirements are unmet.'],
    artifactPath: '.codex-orchestrator/product/radical-shadow-mode-latest.json', errors: [] };
  await persist(root, 'radical-shadow-mode-latest.json', plan);
  return plan;
}

function scoreIdea(index, signalCount, stackCount) {
  const score = { disruption: 25 - index, stepReduction: 22 - (index % 3), aiCentrality: 18 - (index % 2), feasibility: 15 - Math.floor(index / 2) + Math.min(2, stackCount), moat: 12 - (index % 3), evidenceStrength: Math.min(8, 2 + signalCount) };
  score.total = Object.values(score).reduce((sum, value) => sum + value, 0);
  return score;
}

function moatFor(id) {
  return { 'invisible-workflow-compiler': 'A product-specific record of completed workflow patterns and corrections.', 'outcome-operator': 'Trusted action adapters, permission policies, and outcome evidence inside the customer workflow.', 'product-digital-twin': 'Calibrated product decisions linked to actual experiments and customer context.', 'self-deleting-interface': 'A ranked map of removable UI and verified replacement flows.', 'autonomous-experiment-cell': 'A compounding archive of hypotheses, guardrails, and measured product outcomes.' }[id];
}

async function persist(root, name, value) {
  const target = artifactStatePath(root, 'product', name);
  await writeTextAtomic(target, `${JSON.stringify(value, null, 2)}\n`);
}

async function readArtifact(root, name) {
  const target = artifactStatePath(root, 'product', name);
  try { return JSON.parse(await readFile(target, 'utf8')); }
  catch { throw new ForgeMindError('FM_RADICAL_ARTIFACT_MISSING', `Create the required Radical Product artifact first: ${name}.`); }
}
