import { ForgeMindError } from '../errors.mjs';
import { appendFlightEvent } from './flight.mjs';
import { stableId } from './integrity.mjs';
import { saveForgeRecord } from './store.mjs';

const RISK_SCORES = { none: 100, low: 80, medium: 50, high: 20, blocker: 0 };
const WEIGHTS = { outcome: 0.30, acceptance: 0.25, risk: 0.15, complexity: 0.10, cost: 0.10, time: 0.10 };

export async function runTournament({ workspace, input, now = new Date() }) {
  validateTournament(input);
  const candidates = input.candidates.map((candidate) => evaluateCandidate(candidate, input));
  const eligible = candidates.filter((candidate) => candidate.status === 'eligible');
  const ranked = [...eligible].sort((left, right) => right.score - left.score || left.id.localeCompare(right.id));
  const bestScore = ranked[0]?.score ?? null;
  const tiedCandidates = bestScore === null ? [] : ranked.filter((candidate) => candidate.score === bestScore).map((candidate) => candidate.id).sort();
  const status = !ranked.length ? 'no-eligible-candidate' : tiedCandidates.length > 1 ? 'tie' : 'selected';
  const winner = status === 'selected' ? ranked[0] : null;
  const frontier = paretoFrontier(eligible);
  const record = {
    schemaVersion: 1,
    protocol: 'forgemind-future-tournament-v1',
    id: stableId('tournament', input),
    evaluatedAt: now.toISOString(),
    name: input.name,
    status,
    hardGates: ['verification-passed', 'valid-proof', 'no-policy-violations', `acceptance-at-least-${input.minimumAcceptance}`],
    weights: WEIGHTS,
    budgets: input.budgets,
    candidates,
    winner,
    tiedCandidates,
    paretoFrontier: frontier,
    rationale: status === 'selected'
      ? `${winner.id} won after hard gates and transparent weighted scoring.`
      : status === 'tie' ? 'Top candidates are tied; ForgeMind preserves uncertainty.' : 'Every candidate failed at least one hard gate.',
  };
  const saved = await saveForgeRecord({ workspace, area: 'tournaments', record });
  await appendFlightEvent({ workspace, event: { capability: 'tournament', action: 'run', subject: saved.record.id, status, winner: winner?.id ?? null }, now });
  return { ...saved.record, errors: [] };
}

function evaluateCandidate(candidate, tournament) {
  const blockers = [];
  if (candidate.verificationStatus !== 'passed') blockers.push('verification');
  if (candidate.proofStatus !== 'valid') blockers.push('proof');
  if ((candidate.policyViolations ?? []).length) blockers.push('policy');
  if (Number(candidate.acceptancePercent) < Number(tournament.minimumAcceptance)) blockers.push('acceptance');
  const riskScore = RISK_SCORES[candidate.risk] ?? 0;
  const complexityScore = Math.max(0, Math.min(100, (11 - Number(candidate.complexity)) * 10));
  const costScore = budgetScore(candidate.costUnits, tournament.budgets.maxCostUnits);
  const timeScore = budgetScore(candidate.durationMinutes, tournament.budgets.maxDurationMinutes);
  const score = round(
    Number(candidate.outcomeScore) * WEIGHTS.outcome
    + Number(candidate.acceptancePercent) * WEIGHTS.acceptance
    + riskScore * WEIGHTS.risk
    + complexityScore * WEIGHTS.complexity
    + costScore * WEIGHTS.cost
    + timeScore * WEIGHTS.time,
  );
  return {
    ...candidate,
    status: blockers.length ? 'disqualified' : 'eligible',
    blockers,
    componentScores: { outcome: Number(candidate.outcomeScore), acceptance: Number(candidate.acceptancePercent), risk: riskScore, complexity: complexityScore, cost: costScore, time: timeScore },
    score,
  };
}

function paretoFrontier(candidates) {
  return candidates.filter((candidate) => !candidates.some((other) => other.id !== candidate.id && dominates(other, candidate)))
    .map((candidate) => ({ id: candidate.id, score: candidate.score }))
    .sort((left, right) => right.score - left.score || left.id.localeCompare(right.id));
}

function dominates(left, right) {
  const leftValues = [left.outcomeScore, left.acceptancePercent, RISK_SCORES[left.risk], -left.complexity, -left.costUnits, -left.durationMinutes].map(Number);
  const rightValues = [right.outcomeScore, right.acceptancePercent, RISK_SCORES[right.risk], -right.complexity, -right.costUnits, -right.durationMinutes].map(Number);
  return leftValues.every((value, index) => value >= rightValues[index]) && leftValues.some((value, index) => value > rightValues[index]);
}

function budgetScore(actual, maximum) { return round(Math.max(0, Math.min(100, (1 - Number(actual) / Number(maximum)) * 100))); }
function round(value) { return Number(value.toFixed(2)); }

function validateTournament(input) {
  if (!String(input?.name ?? '').trim()) throw new ForgeMindError('FM_TOURNAMENT_INVALID', 'Tournament name is required.');
  if (!Array.isArray(input.candidates) || input.candidates.length < 2) throw new ForgeMindError('FM_TOURNAMENT_INVALID', 'Tournament requires at least two candidates.');
  if (!Number.isFinite(Number(input.minimumAcceptance))) throw new ForgeMindError('FM_TOURNAMENT_INVALID', 'Tournament minimum acceptance is required.');
  if (!(Number(input.budgets?.maxCostUnits) > 0) || !(Number(input.budgets?.maxDurationMinutes) > 0)) throw new ForgeMindError('FM_TOURNAMENT_INVALID', 'Tournament positive cost and duration budgets are required.');
  const ids = new Set();
  for (const candidate of input.candidates) {
    if (!String(candidate.id ?? '').trim() || ids.has(candidate.id)) throw new ForgeMindError('FM_TOURNAMENT_INVALID', `Candidate ID is missing or duplicated: ${candidate.id}`);
    ids.add(candidate.id);
    for (const field of ['outcomeScore', 'acceptancePercent', 'complexity', 'costUnits', 'durationMinutes']) if (!Number.isFinite(Number(candidate[field]))) throw new ForgeMindError('FM_TOURNAMENT_INVALID', `Candidate numeric field is invalid: ${field}`);
  }
}
