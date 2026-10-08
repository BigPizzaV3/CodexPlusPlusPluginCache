import { readFile } from 'node:fs/promises';

import { artifactStatePath } from './artifact-store.mjs';
import { invalidInput } from './errors.mjs';
import { writeJsonAtomic } from './io.mjs';
import { createInnovationPortfolio } from './innovation-portfolio.mjs';
import { createRadicalPortfolio } from './radical-product.mjs';
import { startChildAutopilot } from './autopilot.mjs';
import { evaluateProductLab } from './product-lab.mjs';

const DEFAULT_CONCURRENCY = 3;

export async function discoverPortfolio({ workspace, goal, maxConcurrentCandidates = DEFAULT_CONCURRENCY }) {
  const root = workspace;
  const [radical, innovation] = await Promise.all([createRadicalPortfolio({ workspace, goal }), createInnovationPortfolio({ workspace, goal })]);
  const candidates = dedupe([
    ...radical.ideas.map((item) => radicalCandidate(item)),
    ...innovation.candidates.map((item) => innovationCandidate(item)),
  ]).sort((left, right) => right.score - left.score || left.id.localeCompare(right.id));
  const labs = await Promise.all(candidates.map((candidate) => evaluateProductLab({ workspace: root, candidate })));
  candidates.forEach((candidate, index) => { candidate.productLab = labs[index].adjustment; candidate.score += labs[index].adjustment.scoreDelta; candidate.state = labs[index].adjustment.state === 'held' ? 'held' : candidate.state; });
  const portfolio = { schemaVersion: 1, id: `portfolio-${Date.now().toString(36)}`, status: 'ready', goal: String(goal ?? '').trim() || radical.goal, maxConcurrentCandidates: finite(maxConcurrentCandidates, DEFAULT_CONCURRENCY), evidence: { basis: radical.evidence.basis, note: 'Candidates are repository-aware hypotheses. They are not market facts until supported by qualified evidence.' }, candidates: candidates.sort((left, right) => right.score - left.score || left.id.localeCompare(right.id)), learningLedger: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), artifactPath: '.codex-orchestrator/portfolio/latest.json', errors: [] };
  await save(workspace, portfolio);
  return portfolio;
}

export async function getPortfolio({ workspace }) { const portfolio = await load(workspace); return portfolio ? { schemaVersion: 1, status: portfolio.status, portfolio, errors: [] } : { schemaVersion: 1, status: 'missing', nextAction: 'Run portfolio discover first.', errors: [] }; }

export async function runPortfolio({ workspace }) {
  const portfolio = await requirePortfolio(workspace);
  const active = portfolio.candidates.filter((item) => ['running', 'ready'].includes(item.state));
  for (const candidate of portfolio.candidates.filter((item) => item.state === 'queued')) {
    if (active.length >= portfolio.maxConcurrentCandidates) break;
    if (active.some((other) => conflicts(candidate, other))) continue;
    const mission = await startChildAutopilot({ workspace, goal: candidate.outcome, autonomy: { maxActions: 10 }, id: `${portfolio.id}-${candidate.id}` });
    candidate.state = 'ready'; candidate.missionId = mission.mission.id; candidate.startedAt = new Date().toISOString(); active.push(candidate);
  }
  portfolio.updatedAt = new Date().toISOString(); portfolio.status = active.length ? 'running' : portfolio.candidates.every((item) => ['stopped', 'completed'].includes(item.state)) ? 'completed' : 'ready';
  await save(workspace, portfolio);
  return { schemaVersion: 1, status: portfolio.status, portfolio, activeCandidates: active.map(summary), errors: [] };
}

export async function stopCandidate({ workspace, id, reason }) { const portfolio = await requirePortfolio(workspace); const candidate = portfolio.candidates.find((item) => item.id === id); if (!candidate) throw invalidInput('FM_PORTFOLIO_CANDIDATE_UNKNOWN', `Unknown portfolio candidate: ${id}`); candidate.state = 'stopped'; candidate.stopReason = String(reason ?? 'Stopped by portfolio policy.'); candidate.stoppedAt = new Date().toISOString(); portfolio.learningLedger.push({ candidateId: id, outcome: 'stopped', reason: candidate.stopReason, at: candidate.stoppedAt }); portfolio.updatedAt = candidate.stoppedAt; await save(workspace, portfolio); return { schemaVersion: 1, status: 'passed', portfolio, candidate, errors: [] }; }

function radicalCandidate(item) { return candidate({ id: `radical-${item.id}`, source: 'radical', title: item.title, outcome: item.goal, interactionReplaced: item.interactionReplaced, tenXHypothesis: item.tenXHypothesis, aiCentrality: item.aiCore, moat: item.moat, killCondition: item.killCondition, score: item.score.total, evidenceBasis: item.evidenceBasis }); }
function innovationCandidate(item) { return candidate({ id: item.id, source: 'innovation', title: item.title, outcome: item.problemFocus, interactionReplaced: item.thesis, tenXHypothesis: `Create a category-level improvement for ${item.problemFocus} through ${item.title}.`, aiCentrality: item.archetype, moat: item.moat, killCondition: item.killCondition, score: item.score.total, evidenceBasis: item.evidenceBasis }); }
function candidate(input) { return { ...input, targetUser: 'Qualified user of the current repository application', metric: 'Independent completion, time-to-outcome, and reversal rate', guardrails: ['no critical defect', 'no accessibility regression', 'reversible change only'], rollback: { kind: 'revert-or-compensate', required: true }, conflictSurface: [`candidate:${input.id}`], state: 'queued', evidence: [] }; }
function dedupe(candidates) { const seen = new Set(); return candidates.filter((item) => { const key = `${item.interactionReplaced}|${item.outcome}`.toLowerCase(); if (seen.has(key)) return false; seen.add(key); return true; }); }
function conflicts(left, right) { return left.conflictSurface.some((item) => right.conflictSurface.includes(item)); }
function summary(item) { return { id: item.id, title: item.title, state: item.state, missionId: item.missionId ?? null, score: item.score }; }
async function load(workspace) { try { return JSON.parse(await readFile(path(workspace), 'utf8')); } catch (error) { if (error.code === 'ENOENT') return null; throw error; } }
async function requirePortfolio(workspace) { const portfolio = await load(workspace); if (!portfolio) throw invalidInput('FM_PORTFOLIO_MISSING', 'Run portfolio discover first.'); return portfolio; }
async function save(workspace, portfolio) { await writeJsonAtomic(path(workspace), portfolio); }
function path(workspace) { return artifactStatePath(workspace, 'portfolio', 'latest.json'); }
function finite(value, fallback) { const number = Number(value); return Number.isInteger(number) && number > 0 ? number : fallback; }
