import path from 'node:path';

import { readFile } from 'node:fs/promises';

import { ForgeMindError } from './errors.mjs';
import { writeJsonAtomic } from './io.mjs';
import { assertContained } from './paths.mjs';

const TESTERS = [
  { id: 'target-user', purpose: 'Desirability', prompt: 'Can the intended user complete the core job without coaching?', evidence: ['task completion', 'observed friction', 'verbatim feedback'] },
  { id: 'functional', purpose: 'Reliability', prompt: 'Does the change meet acceptance criteria, including realistic edge cases?', evidence: ['acceptance results', 'defects', 'reproduction steps'] },
  { id: 'accessibility', purpose: 'Inclusion', prompt: 'Can keyboard, assistive-technology, and reduced-motion users complete the task?', evidence: ['keyboard path', 'semantics review', 'contrast or motion findings'] },
  { id: 'adversarial', purpose: 'Trust', prompt: 'What misuse, confusing promise, unsafe default, or broken boundary could harm adoption?', evidence: ['misuse scenario', 'risk rating', 'mitigation or stop reason'] },
];

export async function createMvpTestPlan({ workspace, goal, audience = 'target users' }) {
  const outcome = String(goal ?? '').trim();
  if (!outcome) throw new ForgeMindError('FM_TEST_PLAN_INVALID', 'MVP test planning requires a goal.');
  const plan = {
    schemaVersion: 1,
    status: 'planned',
    generatedAt: new Date().toISOString(),
    goal: outcome,
    audience: String(audience),
    hypothesis: `For ${String(audience)}, ${outcome} solves a meaningful task better than the current alternative.`,
    testTask: 'Complete the smallest end-to-end task without coaching.',
    successMetric: 'At least 4 of 5 target-user sessions complete the task independently and no critical functional, accessibility, or trust finding remains.',
    killCondition: 'Stop or rescope when fewer than 2 of 5 target-user sessions complete the task independently, or a critical safety or trust finding remains unresolved.',
    testerPanels: TESTERS,
    decisionRules: { scale: 'Success metric met and no critical finding.', iterate: 'Mixed signal with a specific, reversible improvement.', stop: 'Kill condition met or problem evidence is weak.' },
    evidenceRules: ['Label simulated feedback as simulated.', 'Do not store names, contact details, raw recordings, or credentials.', 'Keep observed evidence separate from assumptions.'],
    handoffs: ['acceptance-criteria-builder', 'visual-qa', 'discovery-operations', 'user-feedback-capture'],
    errors: [],
  };
  await writeJsonAtomic(assertContained(workspace, path.join(workspace, '.codex-orchestrator', 'product', 'mvp-test-plan-latest.json')), plan);
  return plan;
}

export async function recordMvpTestResult({ workspace, result }) {
  if (!TESTERS.some((panel) => panel.id === result.panel)) throw new ForgeMindError('FM_MVP_TEST_INVALID', 'Unknown tester panel.');
  if (!['passed', 'failed', 'blocked'].includes(result.outcome)) throw new ForgeMindError('FM_MVP_TEST_INVALID', 'Outcome must be passed, failed, or blocked.');
  const completed = String(result.completed).toLowerCase() === 'true';
  const normalized = {
    id: `test_${Date.now()}_${Math.random().toString(16).slice(2, 10)}`,
    recordedAt: new Date().toISOString(), panel: result.panel, outcome: result.outcome, completed,
    critical: Boolean(result.critical), simulated: Boolean(result.simulated), evidence: split(result.evidence), note: String(result.note ?? '').slice(0, 1000),
  };
  const records = await readResults(workspace);
  records.push(normalized);
  await writeJsonAtomic(resultsPath(workspace), records);
  return evaluateMvpTests({ workspace });
}

export async function evaluateMvpTests({ workspace }) {
  const plan = await readPlan(workspace);
  const results = await readResults(workspace);
  const target = results.filter((result) => result.panel === 'target-user');
  const critical = results.filter((result) => result.critical || result.outcome === 'blocked');
  const coveredPanels = new Set(results.map((result) => result.panel));
  const completed = target.filter((result) => result.completed && result.outcome === 'passed').length;
  let decision = 'pending';
  if (critical.length || (target.length >= 5 && completed < 2)) decision = 'stop';
  else if (target.length >= 5 && completed >= 4 && TESTERS.every((panel) => coveredPanels.has(panel.id)) && results.every((result) => result.outcome === 'passed')) decision = 'scale';
  else if (target.length >= 5) decision = 'iterate';
  const report = { schemaVersion: 1, status: decision === 'pending' ? 'collecting' : 'decided', generatedAt: new Date().toISOString(), decision, targetSessions: target.length, independentCompletions: completed, coveredPanels: [...coveredPanels].sort(), criticalFindings: critical.length, results, nextAction: decision === 'pending' ? 'Collect five target-user sessions and one result from every tester panel.' : decision === 'iterate' ? 'Create a reversible improvement and retest.' : decision === 'scale' ? 'Advance to delivery or release with evidence.' : 'Stop or rescope before further delivery.', errors: [] };
  await writeJsonAtomic(assertContained(workspace, path.join(workspace, '.codex-orchestrator', 'product', 'mvp-test-decision-latest.json')), report);
  return report;
}

async function readPlan(workspace) {
  try { return JSON.parse(await readFile(assertContained(workspace, path.join(workspace, '.codex-orchestrator', 'product', 'mvp-test-plan-latest.json')), 'utf8')); }
  catch { throw new ForgeMindError('FM_MVP_TEST_PLAN_MISSING', 'Create an MVP test plan before recording results.'); }
}

async function readResults(workspace) {
  try { return JSON.parse(await readFile(resultsPath(workspace), 'utf8')); }
  catch (error) { if (error.code === 'ENOENT') return []; throw error; }
}

function resultsPath(workspace) { return assertContained(workspace, path.join(workspace, '.codex-orchestrator', 'product', 'mvp-test-results.json')); }
function split(value) { return value ? String(value).split('|').map((item) => item.trim()).filter(Boolean) : []; }
