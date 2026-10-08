import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { writeTextAtomic } from './io.mjs';
import { assertContained, resolveWorkspace } from './paths.mjs';
import { inspectProject } from './project.mjs';

const ARTIFACTS = {
  'prd.md': 'docs/forgemind/prd.md',
  'epics.md': 'docs/forgemind/epics.md',
  'story.md': 'docs/forgemind/stories/_story-template.md',
  'acceptance.md': 'docs/forgemind/acceptance/_acceptance-template.md',
  'traceability.md': 'docs/forgemind/traceability.md',
  'release-readiness.md': 'docs/forgemind/release-readiness.md',
  'rollback-plan.md': 'docs/forgemind/rollback-plan.md',
  'differentiation-matrix.md': 'docs/forgemind/differentiation-matrix.md',
  'workflow-status.md': '.codex-orchestrator/workflow-status.md',
  'workflow-graph.md': '.codex-orchestrator/workflow-graph.md',
};

const MEMORY = [
  'conventions.md',
  'decisions.md',
  'mistakes.md',
  'outcome-memory.md',
  'preferences.md',
  'risk-zones.md',
  'self-update-proposals.md',
  'usp-backlog.md',
  'usp-ideas.md',
  'verification-registry.md',
  'verification.md',
];

export async function initializeWorkspace({ workspace, pluginRoot, withMemory = false, withArtifacts = false }) {
  const root = await resolveWorkspace(workspace);
  const resolvedPlugin = path.resolve(pluginRoot);
  const created = [];
  const preserved = [];
  const profile = await inspectProject(root);

  await createJson(root, '.codex-orchestrator/project.json', profile, created, preserved);
  await createText(
    root,
    '.codex-orchestrator/project.md',
    renderProfile(profile),
    created,
    preserved,
  );

  if (withMemory) {
    for (const name of MEMORY) {
      const source = assertContained(resolvedPlugin, path.join(resolvedPlugin, 'templates', 'memory', name));
      await createText(root, `.codex-orchestrator/memory/shared/${name}`, await readFile(source, 'utf8'), created, preserved);
    }
  }

  if (withArtifacts) {
    for (const [name, destination] of Object.entries(ARTIFACTS)) {
      const source = assertContained(resolvedPlugin, path.join(resolvedPlugin, 'templates', 'artifacts', name));
      await createText(root, destination, await readFile(source, 'utf8'), created, preserved);
    }
  }

  return { schemaVersion: 1, status: 'passed', root, created, preserved };
}

async function createText(root, relative, content, created, preserved) {
  const target = assertContained(root, path.join(root, relative));
  try {
    await writeTextAtomic(target, content, { ifAbsent: true });
    created.push(relative.replaceAll('\\', '/'));
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
    preserved.push(relative.replaceAll('\\', '/'));
  }
}

async function createJson(root, relative, value, created, preserved) {
  const target = assertContained(root, path.join(root, relative));
  try {
    await writeTextAtomic(target, `${JSON.stringify(value, null, 2)}\n`, { ifAbsent: true });
    created.push(relative.replaceAll('\\', '/'));
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
    preserved.push(relative.replaceAll('\\', '/'));
  }
}

function renderProfile(profile) {
  return `# ForgeMind Project Profile\n\n- Stacks: ${profile.stacks.join(', ') || 'unknown'}\n- Package manager: ${profile.packageManager ?? 'none detected'}\n- Commands: ${profile.commands.length}\n`;
}
