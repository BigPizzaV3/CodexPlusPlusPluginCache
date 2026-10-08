import { artifactStatePath } from './artifact-store.mjs';
import { invalidInput } from './errors.mjs';
import { writeJsonAtomic } from './io.mjs';
import { resolveWorkspace } from './paths.mjs';

export async function createIntegrationMesh({ workspace, integrations = [] }) {
  const root = await resolveWorkspace(workspace); if (!Array.isArray(integrations)) throw invalidInput('FM_MESH_INTEGRATIONS_INVALID', 'Integrations must be an array.');
  const connectors = integrations.map((item) => { const mode = String(item.mode ?? 'unconfigured'); const held = mode === 'unconfigured' || mode === 'production-mutable' || Object.keys(item).some((key) => /secret|token|password|credential/i.test(key)); return { name: String(item.name ?? 'unnamed'), mode, operations: Array.isArray(item.operations) ? item.operations : [], status: held ? 'held' : 'planned', actionBoundary: held ? 'Requires explicit adapter, scoped grant, and policy allow.' : 'Adapter receipts remain required.', dataMinimization: 'Send only declared fields.' }; });
  const mesh = { schemaVersion: 1, status: connectors.some((item) => item.status === 'held') ? 'held' : 'planned', generatedAt: new Date().toISOString(), connectors, actionPlan: connectors.map((item) => ({ connector: item.name, idempotency: 'required', rollback: 'required', evidence: 'adapter receipt required' })), claimBoundary: 'Integration Mesh does not execute connectors and never bypasses Autopilot adapters.', artifactPath: '.codex-orchestrator/integration-mesh/latest.json', errors: [] };
  await writeJsonAtomic(artifactStatePath(root, 'integration-mesh', 'latest.json'), mesh); return mesh;
}
