import { ForgeMindError } from '../errors.mjs';
import { appendFlightEvent } from './flight.mjs';
import { stableId, verifyRecord } from './integrity.mjs';
import { saveForgeRecord } from './store.mjs';

export async function analyzeGenome({ workspace, outcomes, minCohort = 3, now = new Date() }) {
  if (!Array.isArray(outcomes)) throw new ForgeMindError('FM_GENOME_INPUT_INVALID', 'Engineering Genome requires an outcomes array.');
  if (!Number.isInteger(Number(minCohort)) || Number(minCohort) < 1) throw new ForgeMindError('FM_GENOME_INPUT_INVALID', 'Minimum cohort must be a positive integer.');
  const grouped = new Map();
  for (const outcome of outcomes) {
    validateOutcome(outcome);
    const stacks = [...new Set(outcome.project?.stacks ?? [])].sort();
    const key = JSON.stringify([outcome.taskCategory, outcome.route, stacks]);
    if (!grouped.has(key)) grouped.set(key, { category: outcome.taskCategory, route: outcome.route, stacks, outcomes: [] });
    grouped.get(key).outcomes.push(outcome);
  }
  const cohorts = [...grouped.values()].map((group) => summarize(group, Number(minCohort))).sort((left, right) => left.category.localeCompare(right.category) || left.route.localeCompare(right.route) || left.stacks.join(',').localeCompare(right.stacks.join(',')));
  const record = {
    schemaVersion: 1,
    protocol: 'forgemind-engineering-genome-v1',
    id: stableId('genome', { outcomes: outcomes.map((item) => item.id).sort(), minCohort }),
    analyzedAt: now.toISOString(),
    minCohort: Number(minCohort),
    outcomeCount: outcomes.length,
    cohorts,
  };
  const saved = await saveForgeRecord({ workspace, area: 'genome', record });
  await appendFlightEvent({ workspace, event: { capability: 'genome', action: 'analyze', subject: saved.record.id, status: 'analyzed', outcomeCount: outcomes.length }, now });
  return { schemaVersion: 1, status: 'analyzed', record: saved.record, evidencePath: saved.path, errors: [] };
}

export async function recommendFromGenome({ genome, task }) {
  if (verifyRecord(genome).status !== 'valid') throw new ForgeMindError('FM_GENOME_INVALID', 'Engineering Genome record is missing or tampered.');
  const stacks = task.stacks ?? [];
  const matching = genome.cohorts.filter((cohort) => cohort.category === task.category && (!stacks.length || !cohort.stacks.length || cohort.stacks.some((stack) => stacks.includes(stack))));
  const eligible = matching.filter((cohort) => cohort.eligible);
  if (!eligible.length) {
    return {
      schemaVersion: 1,
      status: 'insufficient-evidence',
      route: 'forgemind-guide',
      confidence: 'low',
      sampleSize: matching.reduce((sum, cohort) => sum + cohort.sampleSize, 0),
      evidence: matching.flatMap((cohort) => cohort.outcomeIds).sort(),
      missingEvidence: [`minimum cohort of ${genome.minCohort} outcomes per route`],
      rationale: 'No matching route has enough measured outcomes for a genome recommendation.',
    };
  }
  const ranked = eligible.sort((left, right) => right.effectivenessScore - left.effectivenessScore || right.sampleSize - left.sampleSize || left.route.localeCompare(right.route));
  const winner = ranked[0];
  return {
    schemaVersion: 1,
    status: 'recommended',
    route: winner.route,
    confidence: winner.confidence,
    sampleSize: winner.sampleSize,
    evidence: winner.outcomeIds,
    alternative: ranked[1]?.route ?? 'forgemind-guide',
    missingEvidence: [],
    rationale: `${winner.route} has the strongest measured success rate (${winner.successRate}%) and effectiveness score (${winner.effectivenessScore}).`,
  };
}

function summarize(group, minCohort) {
  const count = group.outcomes.length;
  const successes = group.outcomes.filter(successful).length;
  const successRate = round(successes / count * 100);
  const averageCorrections = average(group.outcomes.map((item) => Number(item.correctionCount ?? 0)));
  const averageResidualDefects = average(group.outcomes.map((item) => Number(item.residualDefects ?? 0)));
  const averageDurationMinutes = average(group.outcomes.map((item) => Number(item.durationMinutes ?? 0)));
  const effectivenessScore = round(Math.max(0, successRate - averageCorrections * 5 - averageResidualDefects * 10 - Math.min(20, averageDurationMinutes / 10)));
  return {
    id: stableId('cohort', { category: group.category, route: group.route, stacks: group.stacks }),
    category: group.category,
    route: group.route,
    stacks: group.stacks,
    sampleSize: count,
    eligible: count >= minCohort,
    confidence: count >= 10 ? 'high' : count >= 3 ? 'medium' : 'low',
    successRate,
    averageCorrections,
    averageResidualDefects,
    averageDurationMinutes,
    effectivenessScore,
    outcomeIds: group.outcomes.map((item) => item.id).sort(),
  };
}

function successful(outcome) { return outcome.verificationStatus === 'passed' && Boolean(outcome.userAccepted) && Number(outcome.residualDefects ?? 0) === 0; }
function average(values) { return values.length ? round(values.reduce((sum, value) => sum + value, 0) / values.length) : 0; }
function round(value) { return Number(value.toFixed(2)); }
function validateOutcome(outcome) { for (const field of ['id', 'taskCategory', 'route']) if (!String(outcome?.[field] ?? '').trim()) throw new ForgeMindError('FM_GENOME_INPUT_INVALID', `Outcome field is required: ${field}`); }
