import { writeTextAtomic } from './io.mjs';
import { resolveWorkspace } from './paths.mjs';
import { artifactStatePath } from './artifact-store.mjs';
import { inspectProject } from './project.mjs';
import { listSignals } from './signals.mjs';

const OPPORTUNITIES = [
  ['outcome-agent', 'Outcome Agent', 'Replace a repeated multi-step workflow with a bounded agent that prepares an explainable, reversible result.', 'Users complete the outcome without opening a feature screen.', 'agent completion, edit rate, undo rate', 'Product-specific workflow context, feedback, and verified completion outcomes.'],
  ['predictive-workflow', 'Predictive Workflow', 'Detect a likely risk, next step, or missing decision before the user searches for it.', 'The product moves from a passive record system to proactive guidance.', 'accepted recommendation rate, prevented delay, false-positive rate', 'Historical workflow patterns linked to a specific customer context.'],
  ['multimodal-intake', 'Multimodal Intake', 'Turn an email, screenshot, PDF, or voice note into a reviewed structured work item.', 'Users provide natural evidence instead of completing a rigid form.', 'intake completion, correction rate, time saved', 'Domain schema plus correction feedback from real intake outcomes.'],
  ['company-memory', 'Company Memory', 'Provide a cited, permission-aware account memory of decisions, commitments, risks, and unresolved work.', 'Teams ask for an answer instead of manually reconstructing history.', 'time to context, citation-open rate, correction rate', 'Tenant-scoped decision and outcome history with provenance.'],
  ['simulation', 'Decision Simulator', 'Compare reversible product, capacity, pricing, or workflow scenarios with explicit assumptions.', 'Users decide from trade-offs rather than a single opaque recommendation.', 'decision time, scenario adoption, assumption corrections', 'Customer-specific operating data and retained decision outcomes.'],
  ['autonomous-qa', 'Autonomous QA Triage', 'Collect safe local evidence, group failures, and propose a reproducible, non-destructive next step.', 'Teams receive evidence-linked defect priorities rather than a raw error queue.', 'reproduction rate, triage time, escaped-defect rate', 'Repository, release, and verified test evidence.'],
];

export async function createSaasOpportunityEngine({ workspace, goal }) {
  const root = await resolveWorkspace(workspace);
  const [profile, signals] = await Promise.all([inspectProject(root), listSignals({ workspace: root })]);
  const focus = String(goal ?? '').trim() || 'improve the highest-friction recurring SaaS workflow with an AI-central, reversible outcome';
  const evidenceBasis = signals.length ? 'imported-signals-plus-project-context' : 'project-context-assumption';
  const opportunityCards = OPPORTUNITIES.map(([id, title, replacement, disruption, metrics, moat], index) => ({
    id, title, status: 'hypothesis', focus, aiCentrality: 'AI performs the core interpretation, prediction, synthesis, or bounded action; it is not a decorative text feature.',
    interactionReplaced: replacement, disruptiveOutcome: disruption, successMetrics: metrics.split(', '), moat,
    firstExperiment: { featureFlag: `fm-${id}`, cohort: 'internal → opted-in test tenants → measured expansion', duration: 'two weeks or 20 qualified outcome attempts', guardrails: ['no cross-tenant data access', 'human review before consequential action', 'undo or compensating action where mutation is possible', 'bounded model cost'], killCondition: `Stop when ${metrics.split(', ')[0]} does not improve against the recorded baseline without a guardrail breach.` },
    score: score(index, signals.length, profile.stacks.length), evidenceBasis,
  })).sort((a, b) => b.score.total - a.score.total || a.id.localeCompare(b.id));
  const result = {
    schemaVersion: 1, status: 'passed', generatedAt: new Date().toISOString(), goal: focus,
    evidence: { basis: evidenceBasis, signalCount: signals.length, claimBoundary: signals.length ? 'Imported signals inform prioritization; every opportunity remains a hypothesis until measured with the stated cohort.' : 'No customer or behavioral signals were imported. The opportunities are repository-aware assumptions, not claims about demand, churn, or willingness to pay.' },
    project: { stacks: profile.stacks, packageManager: profile.packageManager, commands: profile.commands }, opportunityCards,
    saasOperatingPlan: {
      activationMap: { ahaMoment: 'first independently completed customer outcome', instrument: ['activation_started', 'first_value_completed', 'time_to_first_value', 'correction_or_undo'], decision: 'Compare first-value completion and time against the baseline by cohort.' },
      churnRadar: { rule: 'Rank only explicit, privacy-approved product signals such as declining core-action frequency, unresolved failures, and missing first value.', output: 'risk hypotheses with evidence references; never a claim that an account will churn.', action: 'Prepare a reviewed next-best-action draft, never contact customers automatically.' },
      pricingLab: { rule: 'Test packaging and value metrics with qualified buyers or opted-in cohorts; do not change billing automatically.', metrics: ['value-metric comprehension', 'conversion intent', 'retention intent'], guardrail: 'No customer-facing price or entitlement change without explicit approval.' },
      featureToRevenueTrace: { rule: 'Link each experiment to one activation, retention, conversion, or expansion hypothesis and its evidence—not asserted revenue.', fields: ['feature flag', 'target segment', 'value metric', 'baseline', 'result', 'decision'] },
      tenantSafetyGate: { checks: ['tenant-scoped retrieval', 'role and permission check', 'redacted logs', 'export boundary', 'audit receipt'], rule: 'Hold if the tenant boundary, permission path, or audit evidence is missing.' },
      integrationHealth: { checks: ['webhook signature and retry policy', 'API version compatibility', 'OAuth scope minimization', 'rate-limit and failure evidence'], rule: 'Report a gap instead of invoking external integrations without an explicit adapter.' },
      releaseCohorts: { stages: ['internal', 'opted-in test tenants', 'measured expansion'], metrics: ['feature outcome', 'guardrail result', 'support burden', 'rollback rate'], killSwitch: 'Disable the feature flag and preserve the evidence record when a guardrail breaches.' },
    },
    recommendedNextStep: { opportunity: opportunityCards[0].id, action: 'Record a baseline, implement the smallest feature-flagged thin slice, then evaluate the stated cohort and guardrails before expansion.' },
    artifactPath: '.codex-orchestrator/product/saas-ai-opportunity-engine-latest.json', errors: [],
  };
  await writeTextAtomic(artifactStatePath(root, 'product', 'saas-ai-opportunity-engine-latest.json'), `${JSON.stringify(result, null, 2)}\n`);
  return result;
}

function score(index, signalCount, stackCount) {
  const score = { userImpact: 24 - index, differentiation: 20 - (index % 3), aiLeverage: 18 - (index % 4), evidence: Math.min(15, 5 + signalCount * 2), feasibility: 14 - Math.floor(index / 3) + Math.min(2, stackCount), trustFit: 9 - (index % 3) };
  score.total = Object.values(score).reduce((sum, value) => sum + value, 0);
  return score;
}
