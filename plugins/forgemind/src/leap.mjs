import { readFile } from 'node:fs/promises';
import { writeJsonAtomic } from './io.mjs';
import { artifactStatePath } from './artifact-store.mjs';
import { resolveWorkspace } from './paths.mjs';
import { scanAppIntelligence } from './app-intelligence.mjs';
import { createCompletionContract } from './completion.mjs';
import { createOpportunityCase } from './experience-lab.mjs';
import { createInnovationPortfolio } from './innovation-portfolio.mjs';
import { createRadicalBlueprint, createRadicalPortfolio, createShadowModePlan } from './radical-product.mjs';
import { markdownTable, publishProjectDocument } from './project-documents.mjs';
import { deriveProjectProfile } from './project-profile.mjs';
import { invalidInput } from './errors.mjs';

const HARD_STOPS = ['secrets-or-credentials', 'production-access', 'data-deletion', 'irreversible-migration', 'external-spend', 'high-stakes-decision'];

export async function runLeap({ workspace, goal, mode = 'yolo', autonomy = {} }) {
  const root = await resolveWorkspace(workspace);
  const requestedGoal = String(goal ?? '').trim();
  const outcome = requestedGoal || 'Analyze this project and autonomously create the strongest disruptive AI product opportunity as a reversible, tested MVP.';
  const goalSource = requestedGoal ? 'user' : 'zero-input-default';
  const selectedMode = ['yolo', 'guided'].includes(String(mode).toLowerCase()) ? String(mode).toLowerCase() : 'yolo';
  const [projectProfile, appIntelligence, innovation, radical, opportunity] = await Promise.all([
    deriveProjectProfile({ workspace: root }),
    scanAppIntelligence({ workspace: root }),
    createInnovationPortfolio({ workspace: root, goal: outcome }),
    createRadicalPortfolio({ workspace: root, goal: outcome }),
    createOpportunityCase({ workspace: root, goal: outcome }),
  ]);
  const [selected, contrarian] = radical.ideas.slice(0, 2);
  const commercialWedge = innovation.candidates[0] ?? null;
  const blueprint = await createRadicalBlueprint({ workspace: root, id: selected.id, selectionMode: 'leap-deterministic' });
  const shadowMode = await createShadowModePlan({ workspace: root });
  const mvpOutcome = `${selected.title}: ${selected.mvp}`;
  const completionContract = await createCompletionContract({ workspace: root, goal: mvpOutcome, acceptance: [
    `Implement one reversible MVP for ${selected.title} that replaces the selected workflow.`,
    `Measure the 10x hypothesis: ${selected.tenXHypothesis}`,
    `Preserve an explicit rollback or recovery path and stop on: ${selected.killCondition}`,
    'Run the smallest relevant functional, GUI, accessibility, and risk checks; record unavailable checks as gaps.',
  ] });
  const record = {
    schemaVersion: 1,
    status: 'ready-for-autonomous-delivery',
    generatedAt: new Date().toISOString(),
    goal: outcome,
    goalSource,
    projectProfile,
    mode: selectedMode,
    hardStopBoundary: HARD_STOPS,
    autonomyPolicy: {
      continueWithoutRoutineQuestions: true,
      maxExternalSpend: finite(autonomy.maxExternalSpend, 0),
      productionAccess: Boolean(autonomy.productionAccess),
      requireFeatureFlag: autonomy.requireFeatureFlag !== false,
      implementationHandoff: '$forgemind-complete with bounded YOLO delivery',
      hardStopBoundary: HARD_STOPS,
    },
    appIntelligence,
    radicalOptions: radical.ideas,
    selectedBet: summarizeBet(selected),
    contrarianBet: summarizeBet(contrarian),
    commercialWedge: commercialWedge ? summarizeCommercialWedge(commercialWedge) : null,
    opportunity,
    businessCase: opportunity.businessCase,
    radicalBlueprint: blueprint,
    shadowMode,
    completionContract,
    testerPlan: { panels: ['target-user', 'functional', 'accessibility', 'adversarial'], successRule: '4 of 5 qualified target users complete the core task and no critical finding remains.', decision: 'collect-evidence-before-scale' },
    uxBaseline: { states: ['loading', 'empty', 'error', 'success', 'keyboard', 'narrow-viewport', 'recovery'], rule: 'Capture browser and accessibility evidence for changed decisive tasks before release.' },
    heroLoop: createHeroLoop(selectedMode, autonomy),
    phases: [{ id: 'select', state: 'completed' }, { id: 'implement', state: 'ready' }, { id: 'verify', state: 'blocked-by-evidence' }, { id: 'release', state: 'blocked-by-evidence' }],
    nextAction: 'Hero Loop: implement the first ready work packet autonomously, record real evidence, repair failures within the packet budget, and report only at a hard stop or final handoff.',
    artifactPath: '.codex-orchestrator/leap/latest.json',
    errors: [],
  };
  const document = await publishProjectDocument({ workspace: root, name: 'leap-decision.md', title: 'Leap Decision', body: renderDecision(record) });
  if (document) record.projectDocuments = ['docs/forgemind/leap-decision.md'];
  await writeJsonAtomic(artifactStatePath(root, 'leap', 'latest.json'), record);
  return record;
}

export async function getLeapStatus({ workspace }) {
  const root = await resolveWorkspace(workspace);
  try { const record = JSON.parse(await readFile(artifactStatePath(root, 'leap', 'latest.json'), 'utf8')); return { schemaVersion: 1, status: 'passed', leap: record, nextAction: next(record), errors: [] }; }
  catch { return { schemaVersion: 1, status: 'missing', nextAction: 'Run leap run --goal "<outcome>" first.', errors: [] }; }
}

export async function continueLeap({ workspace }) {
  const state = await getLeapStatus({ workspace });
  if (state.status === 'missing') return state;
  const nextPacket = readyPacket(state.leap.heroLoop);
  return { ...state, status: 'ready-for-autonomous-delivery', nextPacket, nextAction: nextPacket ? `Hero Loop: ${nextPacket.instruction}` : next(state.leap), handoff: '$forgemind-ship', errors: [] };
}

export async function advanceLeap({ workspace, packet, outcome, evidence = [] }) {
  const root = await resolveWorkspace(workspace);
  const state = await getLeapStatus({ workspace: root });
  if (state.status === 'missing') return state;
  const record = state.leap; const heroLoop = record.heroLoop;
  if (!heroLoop?.enabled) throw invalidInput('FM_LEAP_HERO_DISABLED', 'Hero Loop is available only for YOLO mode.');
  const current = readyPacket(heroLoop);
  if (!current || current.id !== packet) throw invalidInput('FM_LEAP_PACKET_ORDER', `Expected ready packet: ${current?.id ?? 'none'}.`);
  const normalizedEvidence = Array.isArray(evidence) ? evidence.map(String).filter(Boolean) : [];
  const result = String(outcome ?? '').toLowerCase();
  if (!['passed', 'failed'].includes(result)) throw invalidInput('FM_LEAP_OUTCOME_INVALID', '--outcome must be passed or failed.');
  if (!normalizedEvidence.length) throw invalidInput('FM_LEAP_EVIDENCE_REQUIRED', 'Hero Loop advancement requires at least one real evidence reference.');
  if (result === 'passed') { current.state = 'completed'; current.completedAt = new Date().toISOString(); current.evidence = normalizedEvidence; unlockNext(heroLoop); }
  else { current.attempts += 1; current.failures.push({ at: new Date().toISOString(), evidence: normalizedEvidence }); if (current.attempts >= heroLoop.maxRepairAttempts) { current.state = 'blocked'; heroLoop.status = 'hard-stop'; heroLoop.blocker = `Repair budget exhausted for ${current.id}; provide a human decision or narrower scope.`; } else { current.state = 'ready'; heroLoop.status = 'repairing'; heroLoop.lastRecovery = `Repair ${current.id} using the recorded failed evidence before advancing.`; } }
  const nextPacket = readyPacket(heroLoop);
  if (!nextPacket && !heroLoop.blocker) heroLoop.status = 'evidence-gate';
  record.updatedAt = new Date().toISOString();
  await writeJsonAtomic(artifactStatePath(root, 'leap', 'latest.json'), record);
  return { schemaVersion: 1, status: heroLoop.status === 'hard-stop' ? 'blocked' : 'ready-for-autonomous-delivery', heroLoop, nextPacket, nextAction: heroLoop.status === 'repairing' ? heroLoop.lastRecovery : nextPacket ? `Hero Loop: ${nextPacket.instruction}` : 'Collect the remaining human validation and release evidence before scaling.', errors: [] };
}

function summarizeBet(idea) {
  return { id: idea.id, title: idea.title, interactionReplaced: idea.interactionReplaced, tenXHypothesis: idea.tenXHypothesis, mvp: idea.mvp, moat: idea.moat, killCondition: idea.killCondition, evidenceBasis: idea.evidenceBasis, score: idea.score };
}

function summarizeCommercialWedge(candidate) {
  return { id: candidate.id, title: candidate.title, thesis: candidate.thesis, monetization: candidate.monetization, moat: candidate.moat, killCondition: candidate.killCondition, evidenceBasis: candidate.evidenceBasis, score: candidate.score };
}

function createHeroLoop(mode, autonomy) {
  const enabled = mode === 'yolo';
  const packets = [
    packet('implement-thin-slice', 'Implement the selected reversible thin slice behind the required flag or recovery path.', 'The selected workflow replacement is implemented and reversible.'),
    packet('functional-proof', 'Run the smallest relevant automated and unhappy-path checks; repair failures before moving on.', 'Relevant functional checks have recorded results.'),
    packet('experience-proof', 'Verify decisive GUI states, keyboard path, narrow viewport, and accessibility evidence.', 'Critical experience states have recorded evidence or explicit gaps.'),
    packet('risk-and-release', 'Run risk and readiness checks, document rollback, and prepare the bounded release handoff.', 'Release readiness and rollback evidence are recorded.'),
  ];
  if (enabled) packets[0].state = 'ready';
  return { enabled, status: enabled ? 'active' : 'guided', maxRepairAttempts: finite(autonomy.maxRepairAttempts, 2), packets };
}
function packet(id, instruction, acceptance) { return { id, instruction, acceptance, state: 'pending', attempts: 0, evidence: [], failures: [] }; }
function readyPacket(heroLoop) { return heroLoop?.packets?.find((item) => item.state === 'ready') ?? null; }
function unlockNext(heroLoop) { const pending = heroLoop.packets.find((item) => item.state === 'pending'); if (pending) pending.state = 'ready'; else heroLoop.status = 'evidence-gate'; }

function renderDecision(record) {
  const selected = record.selectedBet;
  return `## Goal\n\n${record.goal}\n\n## Selected disruptive bet\n\n- **${selected.title}** — ${selected.interactionReplaced}\n- 10x hypothesis: ${selected.tenXHypothesis}\n- MVP: ${selected.mvp}\n- Moat: ${selected.moat}\n- Kill condition: ${selected.killCondition}\n\n## Contrarian\n\n**${record.contrarianBet.title}** — retained as a credible alternative, not discarded as a false certainty.\n\n## Commercial wedge\n\n${record.commercialWedge ? `${record.commercialWedge.title}: ${record.commercialWedge.monetization}` : 'No commercial wedge available.'}\n\n## Market and business-case boundary\n\n- Market chance: ${record.opportunity.marketChance.total}/100 (${record.opportunity.marketChance.confidence})\n- Business case confidence: ${record.businessCase.confidence}\n- Do not treat assumptions as validated demand, willingness to pay, or ROI.\n\n## Five disruptive options\n\n${markdownTable(record.radicalOptions.map((idea) => ({ title: idea.title, score: idea.score.total, mvp: idea.mvp, killCondition: idea.killCondition })))}\n\n## Autonomous delivery policy\n\nContinue without routine questions. Stop only for: ${record.autonomyPolicy.hardStopBoundary.join(', ')}.`;
}
function finite(value, fallback) { const parsed = Number(value); return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback; }
function next(record) { return record.phases.find((phase) => phase.state === 'ready') ? 'Continue with $forgemind-complete and the selected reversible MVP.' : 'Collect tester, GUI, accessibility, and release evidence before scaling.'; }
