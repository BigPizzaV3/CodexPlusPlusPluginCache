import { artifactStatePath } from './artifact-store.mjs';
import { writeJsonAtomic } from './io.mjs';
import { resolveWorkspace } from './paths.mjs';

export async function createGrowthLoop({ workspace, goal }) {
  const root = await resolveWorkspace(workspace); const focus = String(goal ?? 'improve product value').trim();
  const lane = (id, hypothesis, metric, killCondition) => ({ id, hypothesis, metric, guardrail: 'No external contact, billing change, or spend without configured adapter and policy.', killCondition, evidence: 'assumption-until-local-or-supplied-evidence', actionBoundary: 'draft-only' });
  const loop = { schemaVersion: 1, status: 'planned', goal: focus, generatedAt: new Date().toISOString(), lanes: [lane('activation', `A clearer outcome flow improves first-value completion for ${focus}.`, 'activation completion', 'No improvement over baseline.'), lane('retention', `Outcome memory improves repeat success for ${focus}.`, 'repeat completion', 'No repeat-use improvement.'), lane('monetization', `Verified value makes pricing clearer for ${focus}.`, 'price-sensitive intent', 'No credible value owner or metric.'), lane('value-proof', `Evidence-linked results prove value for ${focus}.`, 'time saved and undo rate', 'Value cannot be measured safely.')], claimBoundary: 'Growth outputs are experiments and assumptions, not market facts, customer communication, or billing actions.', artifactPath: '.codex-orchestrator/growth/latest.json', errors: [] };
  await writeJsonAtomic(artifactStatePath(root, 'growth', 'latest.json'), loop); return loop;
}
