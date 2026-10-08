import { writeJsonAtomic } from './io.mjs';
import { artifactStatePath } from './artifact-store.mjs';
import { ForgeMindError } from './errors.mjs';
import { resolveWorkspace } from './paths.mjs';
import { deriveProjectProfile } from './project-profile.mjs';

const CONTEXTS = new Set(['idea', 'project', 'quality']);
const OUTCOMES = new Set(['improve', 'mvp', 'ship']);
const MODES = new Set(['guided', 'autonomous']);

export async function runStart({ workspace, context, outcome, mode } = {}) {
  validate(context, CONTEXTS, 'CONTEXT', 'context');
  validate(outcome, OUTCOMES, 'OUTCOME', 'outcome');
  validate(mode, MODES, 'MODE', 'mode');

  const root = await resolveWorkspace(workspace);
  let projectProfile = null;
  let inspectionFailure = null;
  try {
    projectProfile = await deriveProjectProfile({ workspace: root });
  } catch (error) {
    inspectionFailure = error instanceof Error ? error.message : String(error);
  }

  const result = createRecommendation({ context, outcome, mode, projectProfile, inspectionFailure });
  await writeJsonAtomic(artifactStatePath(root, 'primary', 'start-latest.json'), result);
  return result;
}

function validate(value, accepted, codeSuffix, option) {
  if (value !== undefined && !accepted.has(value)) {
    throw new ForgeMindError(
      `FM_START_${codeSuffix}_INVALID`,
      `--${option} must be one of: ${[...accepted].join(', ')}.`,
      { exitCode: 2 },
    );
  }
}

function createRecommendation({ context, outcome, mode, projectProfile, inspectionFailure }) {
  const routingSignals = [];
  const missingEvidence = [];
  if (!context) missingEvidence.push('starting-context');
  if (!outcome) missingEvidence.push('desired-outcome');
  if (!mode) missingEvidence.push('working-style');
  if (inspectionFailure) missingEvidence.push(`project-inspection: ${inspectionFailure}`);

  const conflicting = context === 'quality' && ['improve', 'mvp'].includes(outcome);
  if (conflicting) routingSignals.push('conflicting-inputs');
  if (context) routingSignals.push(`context:${context}`);
  if (outcome) routingSignals.push(`outcome:${outcome}`);
  if (mode) routingSignals.push(`mode:${mode}`);
  if (projectProfile) routingSignals.push(`project-category:${projectProfile.productCategory.value}`);

  const recommendation = selectJourney({ context, outcome, mode, inspectionFailure });
  const confidence = confidenceFor({ context, outcome, mode, conflicting, inspectionFailure });
  const journeyLabel = recommendation.journey[0].toUpperCase() + recommendation.journey.slice(1);
  return {
    schemaVersion: 1,
    status: 'passed',
    generatedAt: new Date().toISOString(),
    inputs: { context: context ?? null, outcome: outcome ?? null, mode: mode ?? null },
    ...(projectProfile ? { projectProfile } : { projectInspection: 'unavailable' }),
    routingSignals,
    recommendedJourney: recommendation.journey,
    handoff: recommendation.journey === 'xray' ? '$forgemind-xray' : '$forgemind-compass',
    nextAction: recommendation.journey === 'xray' ? 'Continue with $forgemind-xray for read-only quality assessment.' : `Continue with $forgemind-compass; ForgeMind will apply the ${journeyLabel} route internally.`,
    rationale: `${journeyLabel} is the safest next ForgeMind journey for the declared context and desired outcome.`,
    confidence,
    alternativeJourney: recommendation.alternative,
    autonomyBoundary: 'This recommendation did not run a journey, adapter, or product change. Any selected autonomous journey keeps its existing hard stops for credentials, production access, irreversible changes, spending, and high-stakes decisions.',
    missingEvidence,
    claimBoundary: 'This is local routing guidance based on declared inputs and project context; it is not evidence of customer demand, market fit, or release readiness.',
    artifactPath: '.codex-orchestrator/primary/start-latest.json',
    errors: [],
  };
}

function selectJourney({ context, outcome, mode, inspectionFailure }) {
  if (inspectionFailure || !context || !outcome || !mode) return { journey: 'compass', command: 'compass run', alternative: 'leap' };
  if (context === 'quality') return { journey: 'xray', command: 'xray run', alternative: ['improve', 'mvp'].includes(outcome) ? 'leap' : 'ship' };
  if (outcome === 'ship') return { journey: 'ship', command: 'ship plan', alternative: 'xray' };
  if ((context === 'project' && (outcome === 'mvp' || mode === 'autonomous')) || (context === 'idea' && outcome === 'mvp')) {
    return { journey: 'leap', command: 'leap run', alternative: 'compass' };
  }
  if (context === 'project' && outcome === 'improve') return { journey: 'evolve', command: 'evolve run', alternative: 'leap' };
  return { journey: 'compass', command: 'compass run', alternative: 'leap' };
}

function confidenceFor({ context, outcome, mode, conflicting, inspectionFailure }) {
  if (inspectionFailure || !context || !outcome || !mode) return 0.35;
  if (conflicting) return 0.6;
  return 0.85;
}

