import path from 'node:path';

import { ForgeMindError } from './errors.mjs';
import { createIdeaToMvpBrief } from './idea-to-mvp.mjs';
import { readFile } from 'node:fs/promises';

import { writeJsonAtomic } from './io.mjs';
import { createMvpTestPlan, evaluateMvpTests } from './mvp-testing.mjs';
import { assertContained } from './paths.mjs';

export async function launchMvp({ workspace, goal, audience }) {
  const outcome = String(goal ?? '').trim();
  if (!outcome) throw new ForgeMindError('FM_MVP_LAUNCH_INVALID', 'MVP launch requires a goal.');
  const brief = await createIdeaToMvpBrief({ workspace, goal: outcome });
  const testPlan = await createMvpTestPlan({ workspace, goal: outcome, audience });
  const launch = {
    schemaVersion: 1,
    status: 'active', currentStage: 'discover', completedStages: [],
    generatedAt: new Date().toISOString(),
    goal: outcome,
    audience: testPlan.audience,
    artifacts: {
      ideaToMvp: '.codex-orchestrator/product/idea-to-mvp-latest.json',
      testPlan: '.codex-orchestrator/product/mvp-test-plan-latest.json',
    },
    stages: [
      { id: 'discover', workflow: 'forgemind-explore', gate: 'One evidence-labeled MVP hypothesis, metric, and kill condition.' },
      { id: 'test', workflow: 'forgemind-verify', gate: 'Tester plan exists; critical findings must be resolved before release.' },
      { id: 'build', workflow: 'delivery-builder', gate: 'Scoped implementation meets acceptance criteria.' },
      { id: 'verify', workflow: 'quality-review', gate: 'Verification passes and residual risks are explicit.' },
      { id: 'release', workflow: 'release-readiness-score', gate: 'Delivery proof and rollback evidence support Go/No-Go.' },
    ],
    stopConditions: [testPlan.killCondition, 'Critical tester finding remains unresolved.', 'Verification fails.', 'A safety policy requires approval.'],
    errors: [],
  };
  await writeJsonAtomic(assertContained(workspace, path.join(workspace, '.codex-orchestrator', 'product', 'mvp-launch-latest.json')), launch);
  return launch;
}

export async function getMvpLaunch({ workspace }) {
  try { return JSON.parse(await readFile(launchPath(workspace), 'utf8')); }
  catch { throw new ForgeMindError('FM_MVP_LAUNCH_MISSING', 'Start an MVP launch before checking or advancing it.'); }
}

export async function advanceMvpLaunch({ workspace, stage, evidence = [] }) {
  const launch = await getMvpLaunch({ workspace });
  if (launch.status !== 'active') throw new ForgeMindError('FM_MVP_LAUNCH_CLOSED', `MVP launch is ${launch.status}.`);
  if (stage !== launch.currentStage) throw new ForgeMindError('FM_MVP_LAUNCH_ORDER', `Next required stage is ${launch.currentStage}.`);
  const supplied = split(evidence);
  if (stage === 'test') {
    const decision = await evaluateMvpTests({ workspace });
    if (decision.decision === 'pending') throw new ForgeMindError('FM_MVP_LAUNCH_TESTS_PENDING', decision.nextAction);
    if (decision.decision === 'stop') return stopLaunch(workspace, launch, 'Tester decision is stop.');
  }
  if (['build', 'verify', 'release'].includes(stage) && supplied.length === 0) throw new ForgeMindError('FM_MVP_LAUNCH_EVIDENCE_REQUIRED', `${stage} requires evidence.`);
  if (stage === 'verify' && !supplied.includes('passed')) throw new ForgeMindError('FM_MVP_LAUNCH_VERIFICATION_REQUIRED', 'Verification evidence must include passed.');
  if (stage === 'release' && (!supplied.includes('delivery-proof') || !supplied.includes('rollback'))) throw new ForgeMindError('FM_MVP_LAUNCH_RELEASE_REQUIRED', 'Release requires delivery-proof and rollback evidence.');
  const sequence = launch.stages.map((item) => item.id);
  const next = sequence[sequence.indexOf(stage) + 1] ?? null;
  const updated = { ...launch, currentStage: next, completedStages: [...launch.completedStages, { id: stage, completedAt: new Date().toISOString(), evidence: supplied }], status: next ? 'active' : 'ready-for-decision' };
  await writeJsonAtomic(launchPath(workspace), updated);
  return updated;
}

async function stopLaunch(workspace, launch, reason) {
  const stopped = { ...launch, status: 'stopped', stoppedAt: new Date().toISOString(), stopReason: reason };
  await writeJsonAtomic(launchPath(workspace), stopped);
  return stopped;
}
function launchPath(workspace) { return assertContained(workspace, path.join(workspace, '.codex-orchestrator', 'product', 'mvp-launch-latest.json')); }
function split(value) { return Array.isArray(value) ? value : String(value ?? '').split('|').map((item) => item.trim()).filter(Boolean); }
