import { artifactStatePath } from './artifact-store.mjs';
import { writeJsonAtomic } from './io.mjs';
import { resolveWorkspace } from './paths.mjs';

export async function createExperienceIntelligence({ workspace, projectProfile, mission }) {
  const root = await resolveWorkspace(workspace);
  const result = {
    schemaVersion: 1, status: 'planned', generatedAt: new Date().toISOString(),
    outcomeContract: { outcome: projectProfile.primaryJob.value, stepsToEliminate: 'Identify and remove the highest-friction repeated interaction before adding UI.', aiDecision: 'Show the decision rationale, uncertainty, approval boundary, and undo path for consequential automation.' },
    qualityGate: { status: 'planned', requiredStates: ['loading', 'empty', 'error', 'success', 'keyboard', 'narrow-viewport', 'recovery'], requiredEvidence: ['baseline screenshot', 'candidate screenshot', 'critical-flow assertion', 'accessibility result'], releaseRule: 'Do not claim visual quality without recorded state and accessibility evidence.' },
    aiUxCritic: { status: 'planned', checks: ['information hierarchy', 'cognitive load', 'unnecessary interaction count', 'AI rationale and uncertainty', 'recovery and undo', 'mobile and keyboard flow'], output: 'concrete patch candidates ranked by user impact and evidence gap' },
    outcomeMetrics: ['time-to-outcome', 'independent completion', 'AI suggestion acceptance', 'AI correction rate', 'undo rate', 'repeat use', 'task abandonment'],
    adaptiveInterface: { roles: ['new user', 'routine operator', 'expert reviewer'], rule: 'Progressively disclose controls; retain direct override for expert and consequential actions.' },
    multimodalIntake: { enabled: true, inputs: ['text', 'document', 'screenshot', 'email', 'ticket', 'voice transcript'], output: 'structured task, evidence links, proposed outcome, and human approval boundary' },
    aiMemory: { scope: 'project-local', rule: 'Persist only confirmed decisions, corrections, policies, and outcomes; never treat raw prompts as durable truth.' },
    counterfactuals: [{ id: 'do-nothing', question: 'What is the measured cost of retaining the current workflow?', evidenceNeeded: 'baseline completion, time, error, or support evidence' }, { id: 'reversible-alternative', question: 'What is the smallest reversible automation that can test the outcome?', evidenceNeeded: 'thin-slice completion and undo evidence' }],
    selfHealing: { trigger: 'Repeated abandonment, correction, error, or undo signals', response: 'Create a bounded UX repair experiment, preserve the prior interaction, and require visual plus functional evidence before rollout.' },
    missionPacket: mission?.nextPacket?.id ?? null,
    claimBoundary: 'This is an experience-quality contract and improvement plan; it does not prove user satisfaction, visual quality, or AI benefit until evidence is recorded.',
    artifactPath: '.codex-orchestrator/experience-intelligence/latest.json', errors: [],
  };
  await writeJsonAtomic(artifactStatePath(root, 'experience-intelligence', 'latest.json'), result);
  return result;
}
