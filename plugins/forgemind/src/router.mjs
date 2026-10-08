import { evaluateAction } from './policy.mjs';

const BASE_ROUTES = {
  bug: 'forgemind-build',
  feature: 'forgemind-build',
  innovation: 'forgemind-explore',
  release: 'forgemind-verify',
  security: 'forgemind-verify',
};

const ROUTE_TOKEN_COST = {
  'forgemind-guide': 180,
  'forgemind-explore': 700,
  'forgemind-plan': 550,
  'forgemind-build': 500,
  'forgemind-verify': 450,
  'forgemind-learn': 350,
};

export function recommendRoute({ profile, task, outcomes = [], policy, routing = {} }) {
  const base = BASE_ROUTES[task.category] ?? 'forgemind-guide';
  const matching = outcomes.filter((outcome) =>
    outcome.taskCategory === task.category && stackMatch(profile.stacks ?? [], outcome.project?.stacks ?? []),
  );
  const scores = new Map([[base, 1]]);
  for (const outcome of matching) {
    const route = normalizeRoute(outcome.route);
    scores.set(route, (scores.get(route) ?? 0) + outcome.effectiveness);
  }
  const ranked = [...scores.entries()].sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]));
  let primaryRoute = ranked[0][0];
  let alternative = ranked.find(([route]) => route !== primaryRoute)?.[0] ?? (primaryRoute === base ? 'forgemind-guide' : base);
  const missingEvidence = [];
  if (!matching.length) missingEvidence.push('matching-outcomes');
  if (!BASE_ROUTES[task.category]) missingEvidence.push('known-task-category');
  const selectedEvidence = matching.filter((outcome) => normalizeRoute(outcome.route) === primaryRoute).map((outcome) => outcome.id).sort();
  const margin = ranked[0][1] - (ranked[1]?.[1] ?? 0);
  let confidence = !BASE_ROUTES[task.category] ? 0.3 : matching.length ? Math.min(0.95, 0.55 + selectedEvidence.length * 0.1 + margin * 0.05) : 0.45;
  let escalation = { decision: 'none', source: null, rationale: 'No elevated task risk declared.' };
  if (task.risk) {
    escalation = evaluateAction(policy, { kind: task.risk, path: task.path });
    if (escalation.decision === 'deny') {
      alternative = primaryRoute;
      primaryRoute = 'forgemind-guide';
      confidence = 1;
    }
  }
  const maxSkillTokens = routing.maxSkillTokens ?? 800;
  const selectedCost = ROUTE_TOKEN_COST[primaryRoute] ?? 650;
  const alternativeCost = ROUTE_TOKEN_COST[alternative] ?? 650;
  const budget = { maxSkillTokens, selectedCost, decision: 'within-budget', fallback: null };
  if (escalation.decision !== 'deny' && selectedCost > maxSkillTokens && alternativeCost <= maxSkillTokens) {
    const previous = primaryRoute;
    primaryRoute = alternative;
    alternative = previous;
    budget.decision = 'fallback';
    budget.fallback = previous;
    confidence = Math.min(confidence, 0.7);
  } else if (escalation.decision !== 'deny' && selectedCost > maxSkillTokens) {
    budget.decision = 'escalate';
    budget.fallback = 'forgemind-guide';
  }
  return {
    schemaVersion: 1,
    primaryRoute,
    confidence: Number(confidence.toFixed(2)),
    evidence: selectedEvidence,
    alternative,
    escalation,
    budget,
    missingEvidence,
    rationale: selectedEvidence.length
      ? `${primaryRoute} has the strongest matching local outcome score.`
      : `${primaryRoute} is the safe base route for ${task.category ?? 'unknown'} tasks.`,
  };
}

function normalizeRoute(route) {
  if (Object.values(BASE_ROUTES).includes(route) || route === 'forgemind-guide' || route === 'forgemind-plan' || route === 'forgemind-learn') return route;
  if (['innovation-first-autopilot', 'idea-to-mvp', 'usp-ai-strategist'].includes(route)) return 'forgemind-explore';
  if (['finish-branch', 'security-reviewer', 'mvp-test-lab'].includes(route)) return 'forgemind-verify';
  if (['learning-loop', 'outcome-memory'].includes(route)) return 'forgemind-learn';
  return 'forgemind-build';
}

function stackMatch(current, historical) {
  if (!current.length || !historical.length) return true;
  return current.some((stack) => historical.includes(stack));
}
