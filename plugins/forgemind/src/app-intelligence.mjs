import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { artifactStatePath } from './artifact-store.mjs';
import { writeJsonAtomic } from './io.mjs';
import { inspectProject } from './project.mjs';
import { resolveWorkspace } from './paths.mjs';

export async function scanAppIntelligence({ workspace }) {
  const root = await resolveWorkspace(workspace); const profile = await inspectProject(root);
  const files = await walk(root, root); const find = (pattern) => files.filter((file) => pattern.test(file));
  const report = { schemaVersion: 1, status: 'passed', generatedAt: new Date().toISOString(),
    architecture: { stacks: profile.stacks, packageManager: profile.packageManager, commands: profile.commands },
    interfaces: find(/(^|\/)(app|pages|routes|views|components)\//i).map((file) => ({ kind: 'ui-or-route', sourceFile: file, confidence: 'repository-derived' })),
    dataSignals: find(/(prisma|schema|model|migration|supabase|database|api)/i).map((file) => ({ sourceFile: file, confidence: 'repository-derived' })),
    testSignals: find(/(^|\/)(test|tests|__tests__)\//i).map((file) => ({ sourceFile: file, confidence: 'repository-derived' })),
    flowHypotheses: find(/(^|\/)(pages|routes|views)\//i).slice(0, 20).map((file) => ({ status: 'hypothesis', sourceFiles: [file], confidence: 'repository-derived', statement: `A user flow may begin in ${file}.` })),
    artifactPath: '.codex-orchestrator/intelligence/project-model-latest.json', errors: [] };
  await writeJsonAtomic(artifactStatePath(root, 'intelligence', 'project-model-latest.json'), report); return report;
}
async function walk(root, current) { const entries = await readdir(current, { withFileTypes: true }); const out = []; for (const entry of entries) { if (['node_modules', '.git', 'dist', '.codex-orchestrator'].includes(entry.name)) continue; const full = path.join(current, entry.name); if (entry.isDirectory()) out.push(...await walk(root, full)); else if (entry.isFile()) out.push(path.relative(root, full).replaceAll(path.sep, '/')); } return out; }
