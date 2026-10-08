import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { artifactStatePath } from './artifact-store.mjs';
import { writeJsonAtomic } from './io.mjs';
import { advanceLeap, getLeapStatus } from './leap.mjs';
import { deriveProjectProfile } from './project-profile.mjs';
import { benchmarkProduct, simulateRelease } from './product-os.mjs';
import { resolveWorkspace } from './paths.mjs';
import { verifyWorkspace } from './verify.mjs';
import { createExperienceIntelligence } from './experience-intelligence.mjs';
import { planUiTesting } from './product-ops-lab.mjs';
import { scanRisks } from './risks.mjs';
import { scoreReadiness } from './readiness.mjs';

export async function runHeroControl({ workspace }) {
  const root = await resolveWorkspace(workspace);
  const [leap, projectProfile, benchmark, release, config] = await Promise.all([
    getLeapStatus({ workspace: root }), deriveProjectProfile({ workspace: root }), benchmarkProduct({ workspace: root }), simulateRelease({ workspace: root }), readConfig(root),
  ]);
  const nextPacket = leap.leap?.heroLoop?.packets?.find((item) => item.state === 'ready') ?? null;
  const experience = await createExperienceIntelligence({ workspace: root, projectProfile, mission: { nextPacket } });
  const result = {
    schemaVersion: 1, status: leap.status === 'missing' ? 'needs-leap-mission' : 'ready', generatedAt: new Date().toISOString(),
    mission: { status: leap.status, nextPacket, hardStops: leap.leap?.hardStopBoundary ?? [], repairBudget: leap.leap?.heroLoop?.maxRepairAttempts ?? null },
    projectProfile,
    experiment: experimentPlan(leap.leap, config),
    integrations: integrations(config),
    release: { action: 'run-readiness-before-release', simulatedDecision: release.releaseDecision, evidenceBoundary: 'No deployment, pull request, feature-flag change, or external API call is made by Hero Control.' },
    benchmark: { product: benchmark.status, observedUsage: 'missing', next: 'Import representative run measurements before treating efficiency as proven.' },
    experience,
    execution: { dryRunByDefault: true, command: 'hero execute --run', rule: 'Execution runs local project verification only; code changes remain controlled by the active Codex mission and hard-stop policy.' },
    claimBoundary: 'Hero Control coordinates local plans and recorded evidence. It does not deploy, spend money, contact external systems, or claim market validation without supplied evidence.',
    artifactPath: '.codex-orchestrator/hero/control-latest.json', errors: [],
  };
  await writeJsonAtomic(artifactStatePath(root, 'hero', 'control-latest.json'), result);
  return result;
}

export async function executeHeroControl({ workspace, run = false }) {
  const root = await resolveWorkspace(workspace);
  const control = await runHeroControl({ workspace: root });
  if (!run) return { ...control, status: 'dry-run', nextAction: 'Review the proposed mission packet, then rerun with hero execute --run to execute detected local verification commands.', errors: [] };
  const [verification, uiTestPlan, risks, readiness] = await Promise.all([verifyWorkspace({ workspace: root, run: true, allowInferred: false }), planUiTesting({ workspace: root }), scanRisks({ workspace: root }), scoreReadiness({ workspace: root })]);
  const result = { ...control, status: verification.status === 'passed' ? 'verified' : 'verification-failed', verification, uiTestPlan, risks, readiness, nextAction: verification.status === 'passed' ? 'Run the planned GUI and accessibility checks, then record the real evidence against the current Hero Loop packet with leap advance.' : 'Repair the recorded verification failure autonomously, then rerun Hero Control.', errors: [] };
  await writeJsonAtomic(artifactStatePath(root, 'hero', 'control-latest.json'), result);
  return result;
}

export async function advanceHeroMission({ workspace, packet, outcome, evidence }) {
  return advanceLeap({ workspace, packet, outcome, evidence: split(evidence) });
}

function experimentPlan(leap, config) {
  const goal = leap?.goal ?? 'selected product outcome';
  return { featureFlag: `fm-${slug(goal)}`, stages: ['instrument', 'small-cohort', 'evaluate', 'scale-or-stop'], metrics: ['completion', 'time-to-outcome', 'edit-rate', 'rollback-rate'], guardrails: ['no critical defect', 'no accessibility regression', 'no unbounded cost'], adapter: config?.hero?.featureFlagAdapter ?? 'plan-only' };
}
function integrations(config) { return Array.isArray(config?.hero?.connectors) ? config.hero.connectors.map((item) => ({ id: String(item.id ?? 'unnamed'), type: String(item.type ?? 'unknown'), mode: ['manual-import', 'command-adapter'].includes(item.mode) ? item.mode : 'manual-import', status: 'not-connected-until-explicitly-configured' })) : []; }
async function readConfig(root) { for (const name of ['forgemind.config.json', '.forgemind.json']) { try { return JSON.parse(await readFile(path.join(root, name), 'utf8')); } catch {} } return null; }
function split(value) { return value ? String(value).split('|').map((item) => item.trim()).filter(Boolean) : []; }
function slug(value) { return String(value).toLowerCase().replaceAll(/[^a-z0-9]+/g, '-').replaceAll(/^-|-$/g, '').slice(0, 48) || 'experiment'; }
