import { scanAppIntelligence } from './app-intelligence.mjs';
import { artifactStatePath } from './artifact-store.mjs';
import { writeJsonAtomic } from './io.mjs';
import { resolveWorkspace } from './paths.mjs';

export async function createApplicationTwin({ workspace }) {
  const root = await resolveWorkspace(workspace); const scan = await scanAppIntelligence({ workspace: root });
  const workflows = scan.flowHypotheses.map((flow, index) => ({ id: `flow-${index + 1}`, outcome: flow.statement, sourceFiles: flow.sourceFiles, evidence: 'repository-derived', status: 'hypothesis', frictionSignals: ['workflow must be observed before measured friction is claimed'], riskClass: 'unknown', integrationDependencies: [] }));
  const twin = { schemaVersion: 1, status: 'passed', generatedAt: new Date().toISOString(), architecture: scan.architecture, domain: { concepts: scan.dataSignals.slice(0, 50), evidence: 'repository-derived' }, actors: [{ role: 'application user', evidence: 'hypothesis', note: 'No role is inferred as fact from source paths alone.' }], surfaces: { interfaces: scan.interfaces, tests: scan.testSignals, data: scan.dataSignals }, workflows, integrationCandidates: scan.dataSignals.filter((item) => /api|supabase|database/i.test(item.sourceFile)).map((item) => ({ sourceFile: item.sourceFile, mode: 'unconfigured', actionBoundary: 'held until explicit adapter configuration' })), knowledgeGaps: ['Observed task traces or user evidence are required before workflow importance, demand, or ROI is claimed.'], claimBoundary: 'Twin relationships are repository-derived or hypotheses; they are not user, market, or production facts.', artifactPath: '.codex-orchestrator/twin/latest.json', errors: [] };
  await writeJsonAtomic(artifactStatePath(root, 'twin', 'latest.json'), twin); return twin;
}
