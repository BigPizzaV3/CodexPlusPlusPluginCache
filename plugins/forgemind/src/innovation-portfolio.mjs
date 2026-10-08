import path from 'node:path';

import { writeTextAtomic } from './io.mjs';
import { resolveWorkspace } from './paths.mjs';
import { artifactStatePath } from './artifact-store.mjs';
import { inspectProject } from './project.mjs';
import { clusterSignals, listSignals } from './signals.mjs';

const BETS = [
  ['workflow-elimination', 'Zero-step workflow', 'Remove a recurring handoff by preparing the next best action before a user asks.', 'Offer it as a premium automation tier.', 'Completion rate stays below 60% after 10 qualified sessions.'],
  ['contextual-intelligence', 'Contextual decision copilot', 'Turn the app\'s existing context into a recommendation with rationale and a one-click action.', 'Package decision support for high-value seats.', 'Users do not accept or edit the recommendation in at least 40% of qualified sessions.'],
  ['trust-by-design', 'Explainable automation', 'Automate a reversible task while showing source context, confidence, and an undo path.', 'Sell governance and auditability to teams.', 'The trust review identifies an unmitigated high-severity risk.'],
  ['data-flywheel', 'Learning workflow loop', 'Capture a privacy-safe outcome after a user completes the workflow and improve the next recommendation.', 'Make accumulated workflow learning a retention advantage.', 'The loop cannot collect a lawful, useful outcome signal without added user burden.'],
  ['collaboration-moat', 'Shared decision handoff', 'Convert an individual action into an evidence-backed handoff with owner, rationale, and next step.', 'Charge for team coordination and accountable records.', 'The handoff does not reduce clarification cycles in five team trials.'],
  ['vertical-wedge', 'Domain-specific accelerator', 'Package the highest-friction workflow as a focused, opinionated experience for one buyer segment.', 'Price on the avoided specialist time or risk.', 'Interviews do not reveal a segment with an urgent, repeated version of the problem.'],
  ['proactive-operations', 'Proactive exception resolver', 'Detect a known failure pattern and propose the smallest safe corrective action before escalation.', 'Offer prevention as an operational reliability add-on.', 'Precision is below 70% in a reviewed pilot set.'],
  ['integration-moat', 'System-of-record bridge', 'Connect the current workflow to the next system users already open, preserving context and proof.', 'Monetize integrations and enterprise workflow coverage.', 'The integration cannot save a measurable manual step in a time-boxed prototype.'],
  ['outcome-pricing', 'Outcome-backed value meter', 'Measure a user-visible outcome the app improves and expose it as a transparent value report.', 'Align pricing with verified value rather than feature count.', 'A buyer cannot name a credible value metric or owner for it.'],
  ['category-creation', 'Autonomous micro-product', 'Let users delegate one narrow, reversible result instead of operating a feature screen.', 'Create a new premium autonomous-workflow category.', 'A safe bounded task cannot be defined with an explicit rollback path.'],
];

export async function createInnovationPortfolio({ workspace, goal }) {
  const root = await resolveWorkspace(workspace);
  const profile = await inspectProject(root);
  const signals = await listSignals({ workspace: root });
  const clusters = clusterSignals(signals);
  const focus = String(goal ?? '').trim() || 'improve the product\'s highest-friction user workflow';
  const sourceSignalIds = clusters.flatMap((cluster) => cluster.sourceSignalIds).slice(0, 8);
  const evidenceBasis = sourceSignalIds.length ? 'external-signal-ids' : 'project-profile-assumption';
  const candidates = BETS.map(([archetype, title, thesis, monetization, killCondition], index) => {
    const score = scoreCandidate(index, sourceSignalIds.length, profile.stacks.length);
    return {
      id: `innovation-${String(index + 1).padStart(2, '0')}`,
      archetype, title, status: 'hypothesis', problemFocus: focus,
      thesis: `${thesis} Applied to: ${focus}`,
      firstMvp: `Prototype the smallest ${archetype.replaceAll('-', ' ')} loop for ${focus}; measure one user outcome before expanding scope.`,
      moat: moatFor(archetype), monetization,
      experiment: 'Recruit five qualified users, run a task-based prototype, and measure completion, time saved, and willingness to continue.',
      killCondition, sourceSignalIds, evidenceBasis, score,
      recommendation: evidenceBasis === 'external-signal-ids' && score.total >= 78 ? 'build-candidate' : 'validate-first',
    };
  });
  const rankedCandidates = candidates.sort((left, right) => right.score.total - left.score.total || left.id.localeCompare(right.id));
  const portfolio = {
    schemaVersion: 1, status: 'passed', generatedAt: new Date().toISOString(), goal: focus,
    project: { stacks: profile.stacks, packageManager: profile.packageManager, detectedCommands: profile.commands },
    evidence: { basis: evidenceBasis, sourceSignalIds, clusterCount: clusters.length, note: sourceSignalIds.length ? 'Signal IDs ground the portfolio; each bet remains a hypothesis until tested.' : 'No imported signals were found. These are project-aware assumptions, not market evidence.' },
    candidates: rankedCandidates,
    recommendedNextStep: rankedCandidates[0].recommendation === 'build-candidate' ? 'Select one candidate, define its test and rollback boundary, then use launch-mvp.' : 'Validate the top three candidates with qualified users before committing implementation.',
    artifactPath: '.codex-orchestrator/product/innovation-portfolio-latest.json', errors: [],
  };
  const target = artifactStatePath(root, 'product', 'innovation-portfolio-latest.json');
  await writeTextAtomic(target, `${JSON.stringify(portfolio, null, 2)}\n`);
  return portfolio;
}

function scoreCandidate(index, signalCount, stackCount) {
  const score = { userValue: 18 - (index % 3), differentiation: 19 - (index % 4), evidenceStrength: Math.min(15, 5 + signalCount * 2), feasibility: 14 - Math.floor(index / 4) + Math.min(2, stackCount), monetization: 14 - (index % 3), timeToMvp: 14 - Math.floor(index / 3), trustFit: 6 + (index % 4) };
  score.total = Object.values(score).reduce((sum, value) => sum + value, 0);
  return score;
}

function moatFor(archetype) {
  return {
    'workflow-elimination': 'Embedded workflow context and accumulated completion patterns.',
    'contextual-intelligence': 'Product-specific context, feedback, and action history.',
    'trust-by-design': 'Auditable evidence, permission boundaries, and reversible execution.',
    'data-flywheel': 'Privacy-safe outcome learning that improves local recommendations.',
    'collaboration-moat': 'Shared decisions become reusable team operating knowledge.',
    'vertical-wedge': 'Deep fit for a narrow, urgent workflow and its terminology.',
    'proactive-operations': 'Observed exception patterns and verified remediation outcomes.',
    'integration-moat': 'Context continuity across the tools already used in the workflow.',
    'outcome-pricing': 'A trusted link between product use and measurable customer value.',
    'category-creation': 'A reliable library of bounded autonomous tasks with rollback evidence.',
  }[archetype];
}
