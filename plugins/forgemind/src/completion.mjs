import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { ForgeMindError } from './errors.mjs';
import { writeJsonAtomic } from './io.mjs';
import { resolveWorkspace } from './paths.mjs';
import { inspectProject } from './project.mjs';
import { artifactStatePath } from './artifact-store.mjs';

const RELATIVE_PATH = ['completion', 'latest.json'];

export async function createCompletionContract({ workspace, goal, acceptance = [] }) {
  const root = await resolveWorkspace(workspace);
  const outcome = String(goal ?? '').trim();
  if (!outcome) throw new ForgeMindError('FM_COMPLETE_GOAL_REQUIRED', 'Complete requires --goal.');
  const project = await inspectProject(root);
  const criteria = acceptance.length ? acceptance : defaultCriteria(outcome, project);
  const contract = {
    schemaVersion: 1,
    status: 'active',
    createdAt: new Date().toISOString(),
    goal: outcome,
    definitionOfDone: criteria.map((criterion, index) => ({ id: `done-${index + 1}`, criterion, state: 'open' })),
    executionPolicy: {
      continueByDefault: true,
      evidenceGapsAreBlockers: false,
      pauseOnlyFor: ['secrets-or-credentials', 'production-access', 'data-deletion', 'irreversible-migration', 'external-spend', 'high-stakes-decision'],
    },
    project: { stacks: project.stacks, commands: project.commands },
    nextAction: 'Implement the first open criterion and continue until all achievable criteria are satisfied.',
    artifactPath: '.codex-orchestrator/completion/latest.json',
    errors: [],
  };
  await writeJsonAtomic(artifactStatePath(root, ...RELATIVE_PATH), contract);
  return contract;
}

export async function getCompletionContract({ workspace }) {
  const root = await resolveWorkspace(workspace);
  try {
    const contract = JSON.parse(await readFile(artifactStatePath(root, ...RELATIVE_PATH), 'utf8'));
    const open = contract.definitionOfDone.filter((item) => item.state !== 'satisfied');
    return { ...contract, openCriteria: open, nextAction: open.length ? `Continue with: ${open[0].criterion}` : 'Review final evidence and close the completion contract.' };
  } catch (error) {
    if (error?.code === 'ENOENT') return { schemaVersion: 1, status: 'missing', nextAction: 'Start with forgemind complete --goal "<outcome>".', errors: [] };
    throw error;
  }
}

function defaultCriteria(goal, project) {
  return [
    `The requested outcome is implemented end to end: ${goal}.`,
    'All directly affected integrations, callers, and user-visible states are updated coherently.',
    project.commands.some((command) => command.category === 'test') ? 'The smallest relevant available test command is run and its result is recorded.' : 'A focused verification approach is performed and any unavailable automated test is recorded as a gap.',
    'The final diff is inspected; residual risks and intentionally unproven behavior are reported truthfully.',
  ];
}
