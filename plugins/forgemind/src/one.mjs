import { artifactStatePath } from './artifact-store.mjs';
import { writeJsonAtomic } from './io.mjs';
import { resolveWorkspace } from './paths.mjs';
import { runCompass } from './primary-journeys.mjs';
import { getFoundationStatus, runFoundation } from './foundation.mjs';
import { getAutopilotStatus, startAutopilot } from './autopilot.mjs';
import { getDesignFidelityStatus } from './design-fidelity.mjs';

export async function runForgeMindOne({ workspace, goal }) {
  const root = await resolveWorkspace(workspace);
  const compass = await runCompass({ workspace: root, goal });
  const foundation = await runFoundation({ workspace: root, goal: compass.goal, mode: 'one' });
  const autopilot = await startAutopilot({ workspace: root, goal: compass.goal });
  const result = {
    schemaVersion: 1, status: 'ready', goal: compass.goal, goalSource: compass.goalSource, route: compass.recommendedJourney,
    foundation: { foundationId: foundation.foundationId, scope: foundation.scope, readiness: foundation.readiness, nextStory: foundation.nextStory },
    autopilot, nextAction: nextAction({ foundation, autopilot }), hardStops: autopilot.mission.autonomy.hardStops,
    artifactPath: '.codex-orchestrator/one/latest.json', errors: [],
  };
  await writeJsonAtomic(artifactStatePath(root, 'one', 'latest.json'), result);
  return result;
}

export async function getForgeMindStatus({ workspace }) {
  const root = await resolveWorkspace(workspace);
  const [foundation, autopilot, fidelity] = await Promise.all([
    getFoundationStatus({ workspace: root }), getAutopilotStatus({ workspace: root }), getDesignFidelityStatus({ workspace: root }),
  ]);
  const status = autopilot.status === 'held' ? 'held' : foundation.status === 'missing' && autopilot.status === 'missing' ? 'missing' : 'ready';
  return { schemaVersion: 1, status, foundation, autopilot, fidelity, nextAction: nextAction({ foundation, autopilot, fidelity }), errors: [] };
}

function nextAction({ foundation, autopilot, fidelity = null }) {
  if (fidelity?.status === 'awaiting-selection') return 'Select one persisted Product Design proposal.';
  if (fidelity?.status === 'needs-correction') return 'Implement the bounded Design Fidelity correction, then rerun measured verification.';
  if (autopilot.status === 'held') return autopilot.mission?.holdReason ?? 'Resolve the active Autopilot hard stop.';
  if (foundation.nextStory) return `Implement Foundation story: ${foundation.nextStory.title}.`;
  if (autopilot.nextPacket) return `Autopilot next packet: ${autopilot.nextPacket.instruction}`;
  return foundation.nextAction ?? autopilot.nextAction ?? 'Run forgemind one --goal "<outcome>".';
}
