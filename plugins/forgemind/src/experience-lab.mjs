import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { ForgeMindError } from './errors.mjs';
import { writeJsonAtomic } from './io.mjs';
import { resolveWorkspace } from './paths.mjs';
import { artifactStatePath } from './artifact-store.mjs';
import { inspectProject } from './project.mjs';
import { listSignals } from './signals.mjs';
import { publishProjectDocument } from './project-documents.mjs';
import { deriveProjectProfile, deriveVentureContext } from './project-profile.mjs';

export async function createOpportunityCase({ workspace, goal, options = {}, projectProfile = null, ventureContext = null }) {
  const root = await resolveWorkspace(workspace);
  const [profile, derivedProfile] = await Promise.all([inspectProject(root), projectProfile ? Promise.resolve(projectProfile) : deriveProjectProfile({ workspace: root })]);
  const context = ventureContext ?? deriveVentureContext(derivedProfile);
  const signals = await listSignals({ workspace: root });
  const score = marketChanceScore(options, signals.length, profile.stacks.length, derivedProfile);
  const businessCase = calculateBusinessCase(options, derivedProfile);
  const result = {
    schemaVersion: 1, status: 'passed', generatedAt: new Date().toISOString(),
    goal: String(goal ?? '').trim() || 'improve a high-friction user task',
    evidence: {
      basis: signals.length ? 'project-and-imported-signals' : 'project-profile-assumptions',
      signalCount: signals.length,
      note: signals.length ? 'Market chance uses imported signals and explicit assumptions.' : 'No customer signals are present; market chance and business case are illustrative assumptions, not market facts.',
    },
    projectProfile: derivedProfile, ventureContext: context, marketChance: score,
    businessCase,
    recommendation: score.total >= 70 && businessCase.twelveMonthNet > 0 ? 'validate-with-qualified-users' : 'refine-assumptions-before-build',
    artifactPath: '.codex-orchestrator/experience/opportunity-case-latest.json', errors: [],
  };
  const document = await publishProjectDocument({ workspace: root, name: 'market-opportunity.md', title: 'Market Opportunity', body: renderOpportunity(result) });
  if (document) result.projectDocuments = ['docs/forgemind/market-opportunity.md'];
  await save(root, 'opportunity-case-latest.json', result);
  return result;
}

function renderOpportunity(result) {
  const score = result.marketChance;
  const business = result.businessCase;
  return `## Product bet\n\n${result.goal}\n\n## Market chance\n\n- Score: **${score.total}/100** (${score.band})\n- Confidence: ${score.confidence}\n- Evidence basis: ${result.evidence.basis}\n- Recommendation: ${result.recommendation}\n\n## Business case\n\n- Annual revenue: ${business.annualRevenue}\n- Gross profit: ${business.grossProfit}\n- Twelve-month net: ${business.twelveMonthNet}\n- ROI: ${business.roiPercent ?? 'not applicable'}%\n- Break-even months: ${business.breakEvenMonths ?? 'not reached'}\n\n## Assumptions\n\n\`\`\`json\n${JSON.stringify(business.assumptions, null, 2)}\n\`\`\`\n\n## Required validation\n\n${business.requiredValidation.map((item) => `- ${item}`).join('\n')}`;
}

export async function createExperienceCanvas({ workspace, goal, options = {} }) {
  const root = await resolveWorkspace(workspace);
  const opportunity = await createOpportunityCase({ workspace: root, goal, options });
  const task = opportunity.goal;
  const variants = [
    ['guided', 'Guided accelerator', 'Make the next safe action explicit with rationale and reversible feedback.', 78, 72, 26],
    ['compressed', 'Workflow eliminator', 'Remove one handoff or data-entry step from the decisive user task.', 86, 68, 42],
    ['autonomous', 'Bounded autonomous outcome', 'Delegate one narrow, reversible result with visible evidence and approval boundaries.', 91, 58, 61],
  ].map(([id, title, thesis, value, confidence, risk]) => ({
    id, title, thesis: `${thesis} Applied to: ${task}`,
    experiment: 'Run five task-based sessions; measure completion, time-to-outcome, error recovery, and willingness to continue.',
    killCondition: 'Task completion or time-to-outcome does not improve against the baseline after five qualified sessions.',
    score: { userValue: value, evidenceConfidence: confidence, deliveryRisk: risk, total: value + confidence - risk },
  }));
  const safe = variants.filter((variant) => variant.score.deliveryRisk <= 65).sort((a, b) => b.score.total - a.score.total);
  const result = {
    schemaVersion: 1, status: 'passed', generatedAt: new Date().toISOString(), task,
    uxFailureForecast: [
      { risk: 'unclear-primary-action', prevention: 'Make one primary action and its expected outcome explicit.' },
      { risk: 'state-gap', prevention: 'Design loading, empty, error, success, keyboard, narrow-viewport, and recovery states before build.' },
      { risk: 'trust-gap', prevention: 'Show rationale, boundaries, confirmation, and undo for consequential automation.' },
      { risk: 'measurement-gap', prevention: 'Capture baseline task time, completion, recovery, and evidence before claiming improvement.' },
    ],
    counterfactualTournament: { candidates: variants, selected: safe[0], selectionRule: 'Maximize value plus confidence while excluding unsafe or irreversible variants.' },
    taskTimeOptimizer: { baselineSeconds: number(options['baseline-seconds'], 300), targetSeconds: number(options['target-seconds'], 180), targetReductionPercent: percentageReduction(options), metric: 'median time from task start to verified outcome' },
    opportunity,
    artifactPath: '.codex-orchestrator/experience/canvas-latest.json', errors: [],
  };
  await save(root, 'canvas-latest.json', result);
  return result;
}

export async function recordExperienceEvidence({ workspace, task, states, layers, viewport }) {
  const root = await resolveWorkspace(workspace);
  if (!String(task ?? '').trim()) throw new ForgeMindError('FM_EXPERIENCE_TASK_REQUIRED', 'Experience evidence requires --task.');
  const stateList = list(states, ['loading', 'empty', 'error', 'success', 'keyboard', 'narrow-viewport', 'recovery']);
  const layerList = list(layers, ['semantic-accessibility', 'component-state', 'browser-critical-flow', 'visual-comparison']);
  const result = {
    schemaVersion: 1, status: 'recorded', recordedAt: new Date().toISOString(), task: String(task),
    stateMatrix: stateList.map((state) => ({ state, status: 'planned', evidenceRequired: evidenceForState(state) })),
    testLayers: layerList.map((layer) => ({ layer, status: 'planned' })),
    viewport: String(viewport ?? '1280x720'),
    claimBoundary: 'This record is a test plan until test commands and visual artifacts are attached.',
    artifactPath: '.codex-orchestrator/experience/evidence-latest.json', errors: [],
  };
  await save(root, 'evidence-latest.json', result);
  return result;
}

export async function detectDesignDrift({ workspace, baseline, candidate }) {
  const root = await resolveWorkspace(workspace);
  if (!baseline || !candidate) throw new ForgeMindError('FM_EXPERIENCE_DRIFT_INPUT_REQUIRED', 'Design drift requires --baseline and --candidate JSON snapshots.');
  const [left, right] = await Promise.all([readSnapshot(baseline), readSnapshot(candidate)]);
  const dimensions = ['components', 'tokens', 'copy', 'breakpoints', 'interactions'];
  const drift = dimensions.map((dimension) => ({ dimension, added: difference(right[dimension], left[dimension]), removed: difference(left[dimension], right[dimension]) })).filter((item) => item.added.length || item.removed.length);
  const result = { schemaVersion: 1, status: drift.length ? 'review-required' : 'aligned', comparedAt: new Date().toISOString(), drift, baseline: path.basename(baseline), candidate: path.basename(candidate), artifactPath: '.codex-orchestrator/experience/design-drift-latest.json', errors: [] };
  await save(root, 'design-drift-latest.json', result);
  return result;
}

export async function proposeTestRepair({ workspace, failure, selector }) {
  const root = await resolveWorkspace(workspace);
  if (!String(failure ?? '').trim()) throw new ForgeMindError('FM_EXPERIENCE_FAILURE_REQUIRED', 'Test repair requires --failure.');
  const result = {
    schemaVersion: 1, status: 'review-required', generatedAt: new Date().toISOString(), failure: String(failure), selector: selector ?? null,
    proposal: { action: 'Inspect the DOM and replace brittle selectors with an accessible role, name, or stable test id only if it still identifies the same user intent.', autoApply: false, requiredReview: ['Confirm the critical task is unchanged.', 'Run the unhappy path and keyboard flow.', 'Review screenshot evidence if layout changed.'] },
    artifactPath: '.codex-orchestrator/experience/test-repair-latest.json', errors: [],
  };
  await save(root, 'test-repair-latest.json', result);
  return result;
}

export async function createTrustworthyDemo({ workspace, title }) {
  const root = await resolveWorkspace(workspace);
  const [opportunity, evidence] = await Promise.all([readLatest(root, 'opportunity-case-latest.json'), readLatest(root, 'evidence-latest.json')]);
  const result = {
    schemaVersion: 1, status: 'passed', generatedAt: new Date().toISOString(), title: String(title ?? opportunity?.goal ?? 'ForgeMind experience demo'),
    storyboard: [
      { scene: 'Problem', claim: opportunity?.goal ?? 'State the observed user task and its evidence boundary.' },
      { scene: 'Outcome', claim: 'Show the decisive user task, not a feature tour.' },
      { scene: 'Proof', claim: `Show only recorded test layers: ${(evidence?.testLayers ?? []).map((item) => item.layer).join(', ') || 'none recorded'}.` },
      { scene: 'Boundary', claim: 'State assumptions, residual risk, kill condition, and next validation step.' },
    ],
    prohibitedClaims: ['Do not claim market validation without customer evidence.', 'Do not claim a test passed without an attached successful run.', 'Do not hide unresolved accessibility, visual, or recovery gaps.'],
    artifactPath: '.codex-orchestrator/experience/demo-latest.json', errors: [],
  };
  await save(root, 'demo-latest.json', result);
  return result;
}

function marketChanceScore(options, signals, stacks, profile) {
  const categoryBias = { 'enterprise-operations': { reach: 35, feasibility: 62 }, 'creator-saas': { reach: 60, feasibility: 72 }, 'developer-tools': { reach: 48, feasibility: 70 }, 'b2b-software': { reach: 50, feasibility: 65 } }[profile.productCategory.value] ?? { reach: 50, feasibility: 65 };
  const dimensions = { pain: number(options.pain, signals ? 75 : 50), frequency: number(options.frequency, signals ? 70 : 45), willingnessToPay: number(options['willingness-to-pay'], 55), reach: number(options.reach, categoryBias.reach), differentiation: number(options.differentiation, 65), feasibility: number(options.feasibility, categoryBias.feasibility + Math.min(stacks * 3, 15)), evidence: Math.min(100, 25 + signals * 15) };
  const weights = { pain: 0.2, frequency: 0.15, willingnessToPay: 0.15, reach: 0.1, differentiation: 0.15, feasibility: 0.1, evidence: 0.15 };
  const total = Math.round(Object.entries(weights).reduce((sum, [key, weight]) => sum + dimensions[key] * weight, 0));
  return { dimensions, total, band: total >= 75 ? 'strong' : total >= 55 ? 'promising' : 'weak', confidence: signals ? 'signal-informed' : 'assumption-led', evidence: Object.fromEntries(Object.keys(dimensions).map((key) => [key, Number.isFinite(Number(options[key])) ? 'observed' : 'assumption'])) };
}

function calculateBusinessCase(options, profile) {
  const mappings = { addressableAccounts: 'market-size', monthlyPrice: 'price', grossMarginPercent: 'gross-margin', buildCost: 'build-cost', monthlyRunCost: 'monthly-cost' };
  const assumptionSources = {}; const assumptions = {};
  for (const [key, flag] of Object.entries(mappings)) {
    const explicit = Number(options[flag]); const derived = profile.commercialAssumptions[key];
    assumptions[key] = Number.isFinite(explicit) ? Math.max(0, explicit) : derived.value;
    assumptionSources[key] = Number.isFinite(explicit) ? { source: 'cli', evidence: 'observed', input: `--${flag}` } : { source: derived.evidence === 'observed' ? 'project-evidence' : derived.evidence === 'inferred' ? 'project-inference' : 'assumption', evidence: derived.evidence, inputs: derived.sources };
  }
  assumptions.penetrationPercent = number(options.penetration, 2);
  assumptionSources.penetrationPercent = Number.isFinite(Number(options.penetration)) ? { source: 'cli', evidence: 'observed', input: '--penetration' } : { source: 'assumption', evidence: 'assumption', inputs: ['no observed penetration evidence'] };
  const annualRevenue = assumptions.addressableAccounts * (assumptions.penetrationPercent / 100) * assumptions.monthlyPrice * 12;
  const grossProfit = annualRevenue * (assumptions.grossMarginPercent / 100);
  const twelveMonthNet = grossProfit - assumptions.buildCost - (assumptions.monthlyRunCost * 12);
  const monthlyContribution = (annualRevenue / 12) * (assumptions.grossMarginPercent / 100) - assumptions.monthlyRunCost;
  return { assumptions, assumptionSources, annualRevenue: round(annualRevenue), grossProfit: round(grossProfit), twelveMonthNet: round(twelveMonthNet), roiPercent: assumptions.buildCost ? round((twelveMonthNet / assumptions.buildCost) * 100) : null, breakEvenMonths: monthlyContribution > 0 ? round(assumptions.buildCost / monthlyContribution) : null, confidence: 'illustrative-until-validated', requiredValidation: ['Confirm buyer segment and reachable accounts.', 'Validate price and willingness to pay.', 'Measure build and operating cost with the selected architecture.'] };
}

function number(value, fallback) { const parsed = Number(value); return Number.isFinite(parsed) ? Math.max(0, parsed) : fallback; }
function round(value) { return Math.round(value * 100) / 100; }
function list(value, fallback) { return value ? String(value).split('|').map((item) => item.trim()).filter(Boolean) : fallback; }
function difference(left = [], right = []) { const rightSet = new Set((right ?? []).map(String)); return [...new Set((left ?? []).map(String))].filter((item) => !rightSet.has(item)); }
function percentageReduction(options) { const baseline = number(options['baseline-seconds'], 300); const target = number(options['target-seconds'], 180); return baseline > 0 ? round(((baseline - target) / baseline) * 100) : 0; }
function evidenceForState(state) { return state === 'keyboard' ? 'Focus order, accessible name, keyboard escape route.' : state === 'narrow-viewport' ? 'Responsive screenshot or browser assertion.' : state === 'error' ? 'Visible recovery path and announced error.' : 'Task assertion and user-visible outcome.'; }
async function readSnapshot(file) { const parsed = JSON.parse(await readFile(path.resolve(file), 'utf8')); return Object.fromEntries(['components', 'tokens', 'copy', 'breakpoints', 'interactions'].map((key) => [key, Array.isArray(parsed[key]) ? parsed[key] : []])); }
async function readLatest(root, name) { try { return JSON.parse(await readFile(artifactStatePath(root, 'experience', name), 'utf8')); } catch { return null; } }
async function save(root, name, value) { await writeJsonAtomic(artifactStatePath(root, 'experience', name), value); }
