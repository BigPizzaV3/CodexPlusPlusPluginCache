import { artifactStatePath } from './artifact-store.mjs';
import { invalidInput } from './errors.mjs';
import { writeJsonAtomic } from './io.mjs';
import { resolveWorkspace } from './paths.mjs';
import { createApplicationTwin } from './application-twin.mjs';

export async function createUxEvolution({ workspace, workflowId }) {
  const root = await resolveWorkspace(workspace); const twin = await createApplicationTwin({ workspace: root }); const workflow = workflowId ? twin.workflows.find((item) => item.id === workflowId) : twin.workflows[0];
  if (!workflow) throw invalidInput('FM_UX_WORKFLOW_MISSING', 'Twin has no detectable workflow; provide observed workflow evidence first.');
  const experiment = { schemaVersion: 1, status: 'planned', generatedAt: new Date().toISOString(), workflow, baseline: { state: 'missing', needed: ['baseline completion', 'time-to-outcome', 'error or abandonment rate'] }, replacement: { outcomeFlow: 'Replace the current interaction with a reversible outcome-first flow.', featureFlag: `fm-ux-${workflow.id}`, preserveExistingFlow: true }, metric: 'independent completion and time-to-outcome', guardrails: ['no critical defect', 'no accessibility regression', 'undo and recovery remain available'], requiredEvidence: ['functional assertion', 'baseline and candidate visual evidence', 'accessibility result', 'rollback proof'], decision: 'hold-until-evidence', rollback: { kind: 'disable-feature-flag-and-preserve-existing-flow', required: true }, claimBoundary: 'This is a staged UX experiment, not a claim that the replacement is better.', artifactPath: '.codex-orchestrator/ux-evolution/latest.json', errors: [] };
  await writeJsonAtomic(artifactStatePath(root, 'ux-evolution', 'latest.json'), experiment); return experiment;
}
