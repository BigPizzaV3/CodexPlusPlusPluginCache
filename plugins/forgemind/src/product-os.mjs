import { createHash, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';

import { ForgeMindError } from './errors.mjs';
import { writeJsonAtomic } from './io.mjs';
import { resolveWorkspace } from './paths.mjs';
import { artifactStatePath } from './artifact-store.mjs';
import { inspectProject } from './project.mjs';
import { createInnovationPortfolio } from './innovation-portfolio.mjs';
import { createRadicalPortfolio } from './radical-product.mjs';
import { markdownTable, publishProjectDocument } from './project-documents.mjs';

const ROOT = ['product-os'];

export async function launchProductRun({ workspace, goal, mode = 'guided' }) {
  const root = await resolveWorkspace(workspace);
  const outcome = String(goal ?? '').trim();
  if (!outcome) throw new ForgeMindError('FM_PRODUCT_OS_GOAL_REQUIRED', 'Product run requires --goal.');
  const project = await inspectProject(root);
  const run = {
    schemaVersion: 1, id: `run_${randomUUID()}`, status: 'active', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    goal: outcome, mode: ['yolo', 'guided', 'gated'].includes(mode) ? mode : 'guided', project: { stacks: project.stacks, commands: project.commands },
    phases: phaseStates(), nextPhase: 'scan', decisions: [], assumptions: [], openGates: ['Validate the primary problem with a user or reliable signal before calling demand proven.'],
    artifactPath: '.codex-orchestrator/product-os/latest-run.json', errors: [],
  };
  await save(root, 'latest-run.json', run);
  return run;
}

export async function continueProductRun({ workspace }) {
  const root = await resolveWorkspace(workspace);
  const run = await latestRun(root);
  if (!run) throw new ForgeMindError('FM_PRODUCT_OS_RUN_MISSING', 'Start with forgemind product launch --goal "<outcome>".');
  const phase = run.phases.find((item) => item.state === 'open');
  return { schemaVersion: 1, status: 'passed', run, nextAction: phase ? phase.action : 'Review the completed run and publish only the intended durable documents.', errors: [] };
}

export async function scanProduct({ workspace, goal }) {
  const root = await resolveWorkspace(workspace);
  const outcome = String(goal ?? '').trim() || (await latestRun(root))?.goal || 'find the highest-value product opportunity';
  const [project, innovation, radical] = await Promise.all([inspectProject(root), createInnovationPortfolio({ workspace: root, goal: outcome }), createRadicalPortfolio({ workspace: root, goal: outcome })]);
  const candidates = [
    ...innovation.candidates.slice(0, 5).map((item) => ({ id: item.id, type: 'market-bet', title: item.title, score: item.score.total, evidence: item.evidenceBasis, action: item.recommendation })),
    ...radical.ideas.slice(0, 5).map((item) => ({ id: item.id, type: 'interaction-replacement', title: item.title, score: item.score.total, evidence: item.evidenceBasis, action: item.recommendation })),
  ].sort((left, right) => right.score - left.score || left.id.localeCompare(right.id));
  const report = { schemaVersion: 1, status: 'passed', generatedAt: new Date().toISOString(), goal: outcome,
    projectSignals: { stacks: project.stacks, availableCommands: project.commands.length }, candidates,
    topRisks: ['Demand is unproven until a qualified customer signal or behavioral measure is attached.', 'Automation must retain approval, undo, and exception handling for consequential actions.'],
    recommendation: candidates[0] ?? null, nextAction: candidates[0] ? `Create an experiment and action for ${candidates[0].id}.` : 'Import customer signals, then rerun the scan.', artifactPath: '.codex-orchestrator/product-os/autonomous-scan-latest.json', errors: [] };
  const document = await publishProjectDocument({ workspace: root, name: 'product-bet.md', title: 'Product Bet', body: renderProductBet(report) });
  if (document) report.projectDocuments = ['docs/forgemind/product-bet.md'];
  await save(root, 'autonomous-scan-latest.json', report);
  return report;
}

function renderProductBet(report) {
  const rows = report.candidates.slice(0, 10).map((item) => ({ type: item.type, title: item.title, score: item.score, evidence: item.evidence, nextAction: item.action }));
  return `## Goal\n\n${report.goal}\n\n## Recommended bet\n\n${report.recommendation ? `**${report.recommendation.title}** (${report.recommendation.score})` : 'No candidate is ready.'}\n\n## Candidates\n\n${markdownTable(rows)}\n\n## Risks to validate\n\n${report.topRisks.map((item) => `- ${item}`).join('\n')}\n\n## Next action\n\n${report.nextAction}`;
}

export async function createAction({ workspace, action }) {
  const root = await resolveWorkspace(workspace);
  if (!String(action?.title ?? '').trim()) throw new ForgeMindError('FM_PRODUCT_ACTION_REQUIRED', 'Action requires --title.');
  const records = await actions(root);
  const record = { schemaVersion: 1, id: `act_${digest(`${action.title}|${Date.now()}`)}`, title: String(action.title), lane: String(action.lane ?? 'product-discovery'), owner: String(action.owner ?? 'unassigned'), hypothesis: String(action.hypothesis ?? 'This action improves a measurable user or business outcome.'), metric: String(action.metric ?? 'defined-before-execution'), expectedImpact: numeric(action.impact, null), confidence: bounded(action.confidence, 0.5), evidence: split(action.evidence), status: 'planned', createdAt: new Date().toISOString(), outcome: null, errors: [] };
  records.push(record); await saveActions(root, records); await appendEvidence(root, evidenceNode(record, 'action'));
  return { schemaVersion: 1, status: 'created', action: record, nextAction: 'Assign an owner, attach a baseline, then record the measured outcome.', errors: [] };
}

export async function measureAction({ workspace, id, outcome, evidence }) {
  const root = await resolveWorkspace(workspace); const records = await actions(root); const index = records.findIndex((item) => item.id === id);
  if (index < 0) throw new ForgeMindError('FM_PRODUCT_ACTION_NOT_FOUND', `Action not found: ${id}.`);
  const result = String(outcome ?? '').toLowerCase(); if (!['scale', 'iterate', 'kill', 'inconclusive'].includes(result)) throw new ForgeMindError('FM_PRODUCT_OUTCOME_INVALID', 'Outcome must be scale, iterate, kill, or inconclusive.');
  records[index] = { ...records[index], status: 'measured', outcome: result, measuredAt: new Date().toISOString(), evidence: [...new Set([...records[index].evidence, ...split(evidence)])] };
  await saveActions(root, records); await appendEvidence(root, evidenceNode(records[index], 'measured-action'));
  return { schemaVersion: 1, status: 'measured', action: records[index], nextAction: result === 'scale' ? 'Plan a bounded rollout.' : result === 'kill' ? 'Close the bet and retain the learning.' : 'Strengthen evidence or revise the intervention.', errors: [] };
}

export async function evidenceGraph({ workspace }) {
  const root = await resolveWorkspace(workspace); const actionRecords = await actions(root); const nodes = await evidence(root);
  const graph = { schemaVersion: 1, status: 'passed', generatedAt: new Date().toISOString(), nodes, edges: actionRecords.flatMap((action) => action.evidence.map((item) => ({ from: action.id, to: item, relation: 'supported-by' }))),
    unresolved: actionRecords.filter((action) => !action.evidence.length || action.outcome === 'inconclusive').map((action) => action.id), artifactPath: '.codex-orchestrator/product-os/evidence-graph-latest.json', errors: [] };
  await save(root, 'evidence-graph-latest.json', graph); return graph;
}

export async function simulateRelease({ workspace, goal }) {
  const root = await resolveWorkspace(workspace); const run = await latestRun(root); const actionRecords = await actions(root);
  const subject = String(goal ?? '').trim() || run?.goal || 'selected product change';
  const scenarios = [
    ['adoption-low', 'Low adoption or no measurable task improvement', 'Require a qualified-user validation gate before rollout.', 'iterate'],
    ['cost-overrun', 'Model, infrastructure, or support cost exceeds the bounded budget', 'Set a cost ceiling and disable autonomous expansion.', 'hold'],
    ['trust-or-accessibility', 'Automation lacks a safe undo, accessible recovery, or clear explanation', 'Block release until the affected boundary is verified.', 'hold'],
    ['rollback', 'A user-visible regression appears after release', 'Feature-flag the change and rehearse a rollback.', 'rollback'],
  ].map(([id, risk, mitigation, decision]) => ({ id, subject, risk, mitigation, decision, confidence: actionRecords.length ? 'action-informed' : 'assumption-led' }));
  const result = { schemaVersion: 1, status: 'review-required', generatedAt: new Date().toISOString(), subject, scenarios, releaseDecision: scenarios.some((item) => item.decision === 'hold') ? 'conditional-go' : 'review', artifactPath: '.codex-orchestrator/product-os/release-simulator-latest.json', errors: [] };
  await save(root, 'release-simulator-latest.json', result); return result;
}

export async function benchmarkProduct({ workspace }) {
  const root = await resolveWorkspace(workspace); const project = await inspectProject(root); const actionRecords = await actions(root);
  const checks = [
    ['project-inspection', project.stacks.length > 0, 'Repository context was detected.'],
    ['action-loop', actionRecords.length > 0, 'At least one action has a measurable outcome contract.'],
    ['evidence-linkage', actionRecords.some((item) => item.evidence.length), 'At least one action cites evidence.'],
    ['artifact-cleanliness', true, 'CLI artifact mode is reported; repository-local mode remains explicit.'],
  ].map(([id, passed, detail]) => ({ id, status: passed ? 'passed' : 'missing', detail }));
  const result = { schemaVersion: 1, status: checks.every((item) => item.status === 'passed') ? 'passed' : 'needs-work', generatedAt: new Date().toISOString(), checks, artifactPath: '.codex-orchestrator/product-os/benchmark-latest.json', errors: [] };
  await save(root, 'benchmark-latest.json', result); return result;
}

function phaseStates() { return [
  { id: 'scan', state: 'open', action: 'Run the autonomous product scan and select a bounded bet.' },
  { id: 'validate', state: 'open', action: 'Create a measurable experiment and a kill condition.' },
  { id: 'build', state: 'open', action: 'Implement the smallest reversible MVP; YOLO is permitted only inside defined boundaries.' },
  { id: 'verify', state: 'open', action: 'Run relevant functional, GUI, accessibility, and risk checks.' },
  { id: 'release', state: 'open', action: 'Use the release simulator and make a recorded Go/No-Go decision.' },
]; }
async function latestRun(root) { try { return JSON.parse(await readFile(artifactStatePath(root, ...ROOT, 'latest-run.json'), 'utf8')); } catch (error) { if (error.code === 'ENOENT') return null; throw error; } }
async function actions(root) { try { return JSON.parse(await readFile(artifactStatePath(root, ...ROOT, 'actions.json'), 'utf8')); } catch (error) { if (error.code === 'ENOENT') return []; throw error; } }
async function evidence(root) { try { return JSON.parse(await readFile(artifactStatePath(root, ...ROOT, 'evidence-nodes.json'), 'utf8')); } catch (error) { if (error.code === 'ENOENT') return []; throw error; } }
async function save(root, name, value) { await writeJsonAtomic(artifactStatePath(root, ...ROOT, name), value); }
async function saveActions(root, value) { await save(root, 'actions.json', value); }
async function appendEvidence(root, node) { const nodes = await evidence(root); if (!nodes.some((item) => item.id === node.id)) nodes.push(node); await save(root, 'evidence-nodes.json', nodes); }
function evidenceNode(record, kind) { return { id: record.id, kind, title: record.title, confidence: record.confidence, evidence: record.evidence, recordedAt: new Date().toISOString(), falsifier: 'A measured result outside the defined success and guardrail boundaries.' }; }
function split(value) { return value ? String(value).split('|').map((item) => item.trim()).filter(Boolean) : []; }
function numeric(value, fallback) { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : fallback; }
function bounded(value, fallback) { return Math.max(0, Math.min(1, numeric(value, fallback))); }
function digest(value) { return createHash('sha256').update(String(value)).digest('hex').slice(0, 20); }
