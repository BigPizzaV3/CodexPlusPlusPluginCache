import { access } from 'node:fs/promises';
import path from 'node:path';

import { writeJsonAtomic } from './io.mjs';
import { assertContained, resolveWorkspace } from './paths.mjs';
import { inspectProject } from './project.mjs';
import { artifactStatePath } from './artifact-store.mjs';

export async function buildCapabilityManifest({ workspace }) {
  const root = await resolveWorkspace(workspace);
  const profile = await inspectProject(root);
  const checks = {
    tests: profile.commands.some((item) => item.category === 'test'),
    build: profile.commands.some((item) => item.category === 'build'),
    lint: profile.commands.some((item) => item.category === 'lint'),
    continuousIntegration: await exists(path.join(root, '.github', 'workflows')),
    container: await exists(path.join(root, 'Dockerfile')) || await exists(path.join(root, 'docker-compose.yml')),
    documentation: await exists(path.join(root, 'README.md')),
    changelog: await exists(path.join(root, 'CHANGELOG.md')),
    releaseEvidence: await exists(artifactStatePath(root, 'evidence', 'latest.json')),
  };
  const manifest = { schemaVersion: 1, generatedAt: new Date().toISOString(), status: 'passed', project: { stacks: profile.stacks, packageManager: profile.packageManager }, capabilities: checks, missing: Object.entries(checks).filter(([, present]) => !present).map(([name]) => name), errors: [] };
  await writeJsonAtomic(assertContained(root, path.join(root, '.codex-orchestrator', 'reports', 'capability-manifest-latest.json')), manifest);
  return manifest;
}

async function exists(candidate) { try { await access(candidate); return true; } catch { return false; } }
