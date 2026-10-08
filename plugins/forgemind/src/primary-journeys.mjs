import { writeJsonAtomic } from './io.mjs';
import { artifactStatePath } from './artifact-store.mjs';
import { publishProjectDocument, markdownTable } from './project-documents.mjs';
import { scanAppIntelligence } from './app-intelligence.mjs';
import { createInnovationPortfolio } from './innovation-portfolio.mjs';
import { createRadicalPortfolio } from './radical-product.mjs';
import { createOpportunityCase, createTrustworthyDemo } from './experience-lab.mjs';
import { createFinancialModel, runDiscoveryLoop } from './product-ops-lab.mjs';
import { createExperienceCanvas, recordExperienceEvidence } from './experience-lab.mjs';
import { createCompletionContract } from './completion.mjs';
import { planUiTesting } from './product-ops-lab.mjs';
import { resolveWorkspace } from './paths.mjs';
import { deriveProjectProfile, deriveVentureContext } from './project-profile.mjs';
import { createMarketIntelligence } from './market-intelligence.mjs';
import { runFoundation } from './foundation.mjs';

export async function runCompass({ workspace, goal }) {
  const root = await resolveWorkspace(workspace);
  const { outcome, goalSource } = resolveGoal(goal, 'compass');
  const projectProfile = await deriveProjectProfile({ workspace: root });
  const foundation = await runFoundation({ workspace: root, goal: outcome, mode: 'compass' });
  const recommendedJourney = compassJourney(outcome);
  const result = {
    schemaVersion: 1, status: 'passed', generatedAt: new Date().toISOString(), goal: outcome, goalSource, projectProfile,
    recommendedJourney, handoff: recommendedJourney === 'xray' ? '$forgemind-xray' : '$forgemind-compass', foundation: foundationLink(foundation),
    rationale: `Compass selected ${recommendedJourney} from the stated outcome and the project profile; this is routing guidance, not a claim about customer demand.`,
    nextAction: recommendedJourney === 'xray' ? 'Continue with $forgemind-xray using the same outcome.' : `Continue with $forgemind-compass; ForgeMind will apply the ${recommendedJourney} route internally.`,
    claimBoundary: 'Compass is a local routing recommendation. Any customer, market, pricing, or outcome claim remains evidence-labelled in the selected journey.',
    artifactPath: '.codex-orchestrator/primary/compass-latest.json', errors: [],
  };
  await save(root, 'compass-latest.json', result);
  return result;
}

export async function runSpark({ workspace, goal }) {
  const root = await resolveWorkspace(workspace);
  const { outcome, goalSource } = resolveGoal(goal, 'spark');
  const projectProfile = await deriveProjectProfile({ workspace: root });
  const foundation = await runFoundation({ workspace: root, goal: outcome, mode: 'spark' });
  const result = {
    schemaVersion: 1, status: 'passed', generatedAt: new Date().toISOString(), goal: outcome, goalSource, projectProfile,
    foundation: foundationLink(foundation), directions: [
      direction('eliminate', 'Remove the most repetitive step and let the system prepare a reversible outcome.', outcome, 92),
      direction('anticipate', 'Detect intent from project context and offer the next decision before the user asks.', outcome, 88),
      direction('compress', 'Replace a multi-screen workflow with one evidence-backed outcome interaction.', outcome, 85),
      direction('learn', 'Use opt-in outcome feedback to improve the next recommendation without retaining raw prompts.', outcome, 82),
      direction('embed', 'Move the capability into the user’s existing work surface instead of adding a dashboard.', outcome, 78),
    ],
    selectedDirection: 'eliminate',
    nextAction: 'Run evolve for an existing app, or venture to validate the selected direction commercially.',
    claimBoundary: 'These are creative hypotheses grounded in the stated goal and repository context, not customer validation.',
    artifactPath: '.codex-orchestrator/primary/spark-latest.json', errors: [],
  };
  await save(root, 'spark-latest.json', result);
  return result;
}

export async function runEvolve({ workspace, goal }) {
  const root = await resolveWorkspace(workspace); const { outcome, goalSource } = resolveGoal(goal, 'evolve');
  const [projectProfile, intelligence, radical, opportunity, foundation] = await Promise.all([
    deriveProjectProfile({ workspace: root }),
    scanAppIntelligence({ workspace: root }), createRadicalPortfolio({ workspace: root, goal: outcome }), createOpportunityCase({ workspace: root, goal: outcome }),
    runFoundation({ workspace: root, goal: outcome, mode: 'evolve' }),
  ]);
  const result = { schemaVersion: 1, status: 'passed', generatedAt: new Date().toISOString(), goal: outcome, goalSource, projectProfile, foundation: foundationLink(foundation), intelligence, radicalOptions: radical.ideas, selectedDirection: radical.ideas[0], opportunity,
    nextAction: 'Run council decide to challenge the selected transformation, then ship plan for bounded delivery.',
    claimBoundary: 'The selected direction is a repository-aware hypothesis; validate it with customers before claiming demand.', artifactPath: '.codex-orchestrator/primary/evolve-latest.json', errors: [] };
  const document = await publishProjectDocument({ workspace: root, name: 'evolution-brief.md', title: 'Product Evolution Brief', body: `## Outcome\n\n${outcome}\n\n## Selected direction\n\n${result.selectedDirection.title}\n\n${result.selectedDirection.thesis}\n\n## Kill condition\n\n${result.selectedDirection.killCondition}\n\n## Boundary\n\n${result.claimBoundary}` });
  if (document) result.projectDocuments = ['docs/forgemind/evolution-brief.md'];
  await save(root, 'evolve-latest.json', result); return result;
}

export async function runVenture({ workspace, goal, options = {} }) {
  const root = await resolveWorkspace(workspace); const { outcome, goalSource } = resolveGoal(goal, 'venture');
  const projectProfile = await deriveProjectProfile({ workspace: root });
  const ventureContext = deriveVentureContext(projectProfile);
  const [opportunity, financialModel, discoveryLoop, foundation] = await Promise.all([
    createOpportunityCase({ workspace: root, goal: outcome, options: { ...options, profileCategory: projectProfile.productCategory.value }, projectProfile, ventureContext }), createFinancialModel({ workspace: root, options, projectProfile }), runDiscoveryLoop({ workspace: root, goal: outcome }),
    runFoundation({ workspace: root, goal: outcome, mode: 'venture' }),
  ]);
  const marketIntelligence = await createMarketIntelligence({ workspace: root, projectProfile, financialModel });
  const conservative = financialModel.scenarios.find((item) => item.name === 'conservative');
  const result = { schemaVersion: 1, status: 'passed', generatedAt: new Date().toISOString(), goal: outcome, goalSource, projectProfile, foundation: foundationLink(foundation), ventureContext, evidenceGaps: projectProfile.evidenceGaps, opportunity, financialModel, marketIntelligence, discoveryLoop,
    recommendation: opportunity.recommendation === 'validate-with-qualified-users' && conservative?.viabilityScore >= 50 ? 'validate' : 'research-first',
    nextAction: 'Import customer or market evidence, then re-run venture before committing material delivery spend.',
    claimBoundary: 'Market scores and financial scenarios are explicit assumptions unless supported by imported sources; they are not market facts, forecasts, or investment advice.', artifactPath: '.codex-orchestrator/primary/venture-latest.json', errors: [] };
  const document = await publishProjectDocument({ workspace: root, name: 'venture-case.md', title: 'Venture Case', body: `## Outcome\n\n${outcome}\n\n## Project profile\n\n${markdownTable([['productCategory', projectProfile.productCategory.value, projectProfile.productCategory.evidence], ['targetAudience', projectProfile.targetAudience.value, projectProfile.targetAudience.evidence], ['primaryJob', projectProfile.primaryJob.value, projectProfile.primaryJob.evidence], ['deploymentModel', projectProfile.deploymentModel.value, projectProfile.deploymentModel.evidence]].map(([field, value, evidence]) => ({ field, value, evidence })))}\n\n## Recommendation\n\n${result.recommendation}\n\n## Market basis\n\n${opportunity.evidence.note}\n\n## Financial assumption sources\n\n${markdownTable(Object.entries(financialModel.assumptionSources).map(([field, item]) => ({ field, value: item.value, source: item.source, evidence: item.evidence })))}\n\n## Financial scenarios\n\n${markdownTable(financialModel.scenarios.map((item) => ({ scenario: item.name, annualRevenue: item.annualRevenue, twelveMonthNet: item.twelveMonthNet, viabilityScore: item.viabilityScore })))}\n\n## Missing evidence\n\n${projectProfile.evidenceGaps.map((item) => `- ${item}`).join('\n') || '_No profile evidence gaps recorded._'}\n\n## Boundary\n\n${result.claimBoundary}` });
  if (document) result.projectDocuments = ['docs/forgemind/venture-case.md'];
  await save(root, 'venture-latest.json', result); return result;
}

export async function runCouncil({ workspace, goal }) {
  const root = await resolveWorkspace(workspace); const { outcome, goalSource } = resolveGoal(goal, 'council');
  const [projectProfile, opportunity, foundation] = await Promise.all([deriveProjectProfile({ workspace: root }), createOpportunityCase({ workspace: root, goal: outcome }), runFoundation({ workspace: root, goal: outcome, mode: 'council' })]);
  const perspectives = [
    ['product', 'Prioritize only the smallest outcome that removes a measurable user step.', 'Use completion time and independent success as the decision metric.'],
    ['customer', 'Do not infer demand from repository structure; validate the painful moment with qualified users.', 'No launch claim without customer or behavioral evidence.'],
    ['technical', 'Use a feature flag, observable events, and a rollback path for the first release.', 'Avoid irreversible data and architecture changes.'],
    ['risk', 'Automation must show its rationale, boundary, and recovery route.', 'Pause for production access, external spend, or high-stakes decisions.'],
    ['contrarian', 'A better workflow may be less valuable than deleting it entirely.', 'Test whether the user would prefer no new interface.'],
  ].map(([role, position, condition]) => ({ role, position, condition, evidenceBasis: opportunity.evidence.basis }));
  const result = { schemaVersion: 1, status: 'passed', generatedAt: new Date().toISOString(), goal: outcome, goalSource, projectProfile, foundation: foundationLink(foundation), perspectives,
    decision: 'validate-a-reversible-thin-slice', dissent: 'Customer demand remains an assumption until external evidence is imported.', owner: 'product owner', metric: 'independent completion and time-to-outcome', killCondition: 'Stop when qualified users do not complete the core task better than the current alternative.', nextAction: 'Run ship plan with a feature flag and the stated kill condition.', artifactPath: '.codex-orchestrator/primary/council-latest.json', errors: [] };
  const document = await publishProjectDocument({ workspace: root, name: 'council-decision.md', title: 'Council Decision', body: `## Decision\n\n${result.decision}\n\n## Perspectives\n\n${markdownTable(perspectives)}\n\n## Dissent\n\n${result.dissent}\n\n## Kill condition\n\n${result.killCondition}` });
  if (document) result.projectDocuments = ['docs/forgemind/council-decision.md']; await save(root, 'council-latest.json', result); return result;
}

export async function runPortfolio({ workspace, goal }) {
  const root = await resolveWorkspace(workspace); const { outcome, goalSource } = resolveGoal(goal, 'portfolio');
  const [projectProfile, portfolio, foundation] = await Promise.all([deriveProjectProfile({ workspace: root }), createInnovationPortfolio({ workspace: root, goal: outcome }), runFoundation({ workspace: root, goal: outcome, mode: 'portfolio' })]); const selected = portfolio.candidates[0];
  const result = { schemaVersion: 1, status: 'passed', generatedAt: new Date().toISOString(), goal: outcome, goalSource, projectProfile, foundation: foundationLink(foundation), selectedBet: selected,
    epics: [{ id: 'epic-1', outcome, metric: selected.experiment, killCondition: selected.killCondition, stories: ['Instrument the baseline.', 'Implement one reversible thin slice behind a flag.', 'Run target-user and quality checks.', 'Decide using recorded evidence.'] }],
    sprint: { goal: 'Prove or disprove the selected bet with the smallest releasable slice.', order: ['baseline', 'thin-slice', 'verification', 'decision'] }, nextAction: 'Run ship plan to convert the first story into an implementation contract.', artifactPath: '.codex-orchestrator/primary/portfolio-latest.json', errors: [] };
  await save(root, 'portfolio-latest.json', result); return result;
}

export async function runShowcase({ workspace, goal }) {
  const root = await resolveWorkspace(workspace); const { outcome, goalSource } = resolveGoal(goal, 'showcase'); const [projectProfile, demo, foundation] = await Promise.all([deriveProjectProfile({ workspace: root }), createTrustworthyDemo({ workspace: root, title: outcome }), runFoundation({ workspace: root, goal: outcome, mode: 'showcase' })]);
  const result = { schemaVersion: 1, status: 'passed', generatedAt: new Date().toISOString(), goal: outcome, goalSource, projectProfile, foundation: foundationLink(foundation), demo,
    narrative: { audience: 'decision makers and early users', tension: 'The current workflow leaves a material outcome manual or unproven.', transformation: 'Show one user outcome, evidence, boundary, and decision—not a feature tour.', ask: 'Approve a bounded validation release.' }, nextAction: 'Attach real verification and customer evidence before presenting outcomes as proven.', artifactPath: '.codex-orchestrator/primary/showcase-latest.json', errors: [] };
  await save(root, 'showcase-latest.json', result); return result;
}

export async function runShip({ workspace, goal }) {
  const root = await resolveWorkspace(workspace); const { outcome, goalSource } = resolveGoal(goal, 'ship');
  const [projectProfile, contract, canvas, uiTestPlan, foundation] = await Promise.all([deriveProjectProfile({ workspace: root }), createCompletionContract({ workspace: root, goal: outcome }), createExperienceCanvas({ workspace: root, goal: outcome }), planUiTesting({ workspace: root }), runFoundation({ workspace: root, goal: outcome, mode: 'embedded' })]);
  const result = { schemaVersion: 1, status: 'passed', generatedAt: new Date().toISOString(), goal: outcome, goalSource, projectProfile, contract, canvas, uiTestPlan,
    foundation: foundationLink(foundation), executionMode: 'developer-autonomous-with-hard-stops', hardStops: contract.executionPolicy.pauseOnlyFor, nextAction: foundation.scope === 'foundation-required' ? `Implement Foundation story: ${foundation.nextStory?.title ?? 'resolve Foundation readiness blockers'}.` : 'Implement the first open criterion, run the smallest relevant tests, and continue until the contract is satisfied or a hard stop is reached.', artifactPath: '.codex-orchestrator/primary/ship-latest.json', errors: [] };
  await save(root, 'ship-latest.json', result); return result;
}

function direction(id, thesis, goal, score) { return { id, thesis: `${thesis} Applied to: ${goal}`, score, metric: 'independent completion and time-to-outcome', killCondition: 'Stop if the new interaction does not reduce the core task time or improve independent completion in five qualified sessions.' }; }
function resolveGoal(goal, journey) {
  const value = String(goal ?? '').trim();
  if (value) return { outcome: value, goalSource: 'user' };
  return { outcome: ZERO_INPUT_DEFAULTS[journey], goalSource: 'zero-input-default' };
}
const ZERO_INPUT_DEFAULTS = {
  compass: 'Choose the strongest safe ForgeMind journey for the current project and its highest-value unresolved outcome.',
  spark: 'Discover five radical AI product opportunities that eliminate the highest-friction workflow in this project.',
  evolve: 'Radically transform the highest-friction workflow in this existing application with an AI-central, reversible MVP.',
  venture: 'Validate the strongest available product opportunity with market evidence, USP differentiation, and a transparent business case.',
  council: 'Choose the strongest next reversible product or delivery decision for this project.',
  portfolio: 'Turn the strongest available product opportunity into a measurable, reversible delivery portfolio.',
  showcase: 'Create a truthful, proof-carrying narrative for the strongest available product opportunity.',
  ship: 'Implement and verify the smallest reversible MVP with the greatest measurable user impact.',
};
function compassJourney(goal) {
  const value = String(goal).toLowerCase();
  if (/market|price|pricing|business case|venture|segment|competitor|demand/.test(value)) return 'venture';
  if (/implement|build|fix|test|release|ship|deploy/.test(value)) return 'ship';
  if (/existing app|existing application|improve|transform|refactor/.test(value)) return 'evolve';
  if (/idea|brainstorm|radical|innovative|disruptive/.test(value)) return 'spark';
  if (/decide|decision|choose|trade-?off|risk/.test(value)) return 'council';
  return 'leap';
}
function foundationLink(foundation) { return { foundationId: foundation.foundationId, scope: foundation.scope, readiness: foundation.readiness, nextStory: foundation.nextStory }; }
async function save(workspace, name, value) { await writeJsonAtomic(artifactStatePath(workspace, 'primary', name), value); }
