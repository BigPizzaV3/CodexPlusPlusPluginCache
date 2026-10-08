import { artifactStatePath } from './artifact-store.mjs';
import { writeJsonAtomic } from './io.mjs';
import { resolveWorkspace } from './paths.mjs';

const ROLES = ['builder', 'target-user', 'security', 'sales', 'support', 'contrarian'];
export async function evaluateProductLab({ workspace, candidate }) {
  const root = await resolveWorkspace(workspace); const title = String(candidate?.title ?? 'candidate');
  const perspectives = ROLES.map((role) => ({ role, claim: `${role} evaluation for ${title}`, evidenceRequired: role === 'target-user' ? 'qualified task evidence' : role === 'security' ? 'threat and policy review' : 'testable acceptance evidence', primaryRisk: role === 'contrarian' ? 'candidate does not materially replace the status quo' : `${role} evidence is missing`, recommendation: role === 'security' || role === 'contrarian' ? 'validate' : 'investigate' }));
  const critical = perspectives.filter((item) => ['security', 'contrarian'].includes(item.role)).map((item) => item.primaryRisk);
  const result = { schemaVersion: 1, status: 'passed', candidateId: candidate?.id ?? null, perspectives, adjustment: { scoreDelta: -critical.length * 3, state: 'validate', blockers: critical }, claimBoundary: 'Lab perspectives are structured counterarguments, not real user research or independent security approval.', artifactPath: '.codex-orchestrator/product-lab/latest.json', errors: [] };
  await writeJsonAtomic(artifactStatePath(root, 'product-lab', 'latest.json'), result); return result;
}
