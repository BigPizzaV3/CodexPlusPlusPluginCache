import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { ForgeMindError } from './errors.mjs';
import { writeJsonAtomic } from './io.mjs';
import { assertContained, resolveWorkspace } from './paths.mjs';
import { inspectProject } from './project.mjs';

export async function createIdeaToMvpBrief({ workspace, goal }) {
  if (!String(goal ?? '').trim()) throw new ForgeMindError('FM_IDEA_TO_MVP_INVALID', 'Idea-to-MVP requires a product goal.');
  const root = await resolveWorkspace(workspace);
  const profile = await inspectProject(root);
  const brief = { schemaVersion: 1, generatedAt: new Date().toISOString(), status: 'planned', goal: String(goal), existingApp: { stacks: profile.stacks, packageManager: profile.packageManager, detectedCommands: profile.commands, readme: await readReadme(root) }, stages: [
    { id: 'opportunity', outcome: 'Ranked customer problems, alternatives, and market evidence.' },
    { id: 'ideation', outcome: 'Divergent disruptive concepts, then a ranked shortlist.' },
    { id: 'mvp', outcome: 'One measurable hypothesis with scope, success metric, and kill condition.' },
    { id: 'testing', outcome: 'A decisive tester plan covering desirability, reliability, inclusion, and trust.' },
    { id: 'delivery', outcome: 'Smallest implementation, verification, visual review when relevant, and release evidence.' },
  ], routing: ['forgemind-explore', 'forgemind-plan', 'forgemind-build', 'forgemind-verify'], errors: [] };
  await writeJsonAtomic(assertContained(root, path.join(root, '.codex-orchestrator', 'product', 'idea-to-mvp-latest.json')), brief);
  return brief;
}

async function readReadme(root) {
  try { return (await readFile(path.join(root, 'README.md'), 'utf8')).replace(/\s+/g, ' ').trim().slice(0, 1000); }
  catch { return null; }
}
