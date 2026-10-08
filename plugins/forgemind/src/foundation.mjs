import { readFile } from 'node:fs/promises';

import { artifactStatePath } from './artifact-store.mjs';
import { invalidInput } from './errors.mjs';
import { writeJsonAtomic } from './io.mjs';
import { resolveWorkspace } from './paths.mjs';
import { deriveProjectProfile } from './project-profile.mjs';
import { publishProjectDocument } from './project-documents.mjs';

const REQUIRED = ['context', 'prd', 'architecture', 'nfrs', 'epics', 'stories', 'sprint'];

export async function runFoundation({ workspace, goal, mode = 'direct' } = {}) {
  const root = await resolveWorkspace(workspace);
  const profile = await deriveProjectProfile({ workspace: root });
  const outcome = String(goal ?? '').trim() || `Plan the smallest safe, measurable improvement for ${profile.productCategory.value || 'this project'}.`;
  const foundation = createFoundation(profile, outcome, goal ? 'user' : 'zero-input-default', mode);
  const result = resultFor(foundation, profile);
  await persist(root, result);
  return result;
}

export async function getFoundationStatus({ workspace } = {}) {
  const root = await resolveWorkspace(workspace);
  try { return JSON.parse(await readFile(statePath(root), 'utf8')); }
  catch (error) { if (error.code === 'ENOENT') return { schemaVersion: 1, status: 'missing', nextAction: 'Run foundation run first.', errors: [] }; throw error; }
}

export async function refreshFoundation({ workspace, changes = {} } = {}) {
  const root = await resolveWorkspace(workspace);
  const current = await getFoundationStatus({ workspace: root });
  if (current.status === 'missing') throw invalidInput('FM_FOUNDATION_MISSING', 'Run foundation before refresh.');
  const next = structuredClone(current);
  next.revision += 1;
  if (changes.prd && JSON.stringify(changes.prd) !== JSON.stringify(next.foundation.prd)) {
    Object.assign(next.foundation.prd, changes.prd, { revision: next.revision });
    for (const key of ['architecture', 'nfrs', 'epics', 'stories', 'sprint']) markStale(next.foundation[key]);
  }
  if (changes.architecture && next.foundation.architecture.decisionState === 'reviewed') Object.assign(next.foundation.architecture, changes.architecture);
  next.readiness = evaluateFoundationReadiness(next.foundation);
  next.status = statusFor(next.readiness);
  await persist(root, next);
  return next;
}

export function classifyFoundationScope({ goal, projectProfile } = {}) {
  const text = String(goal ?? '').toLowerCase();
  return /architecture|integration|api|database|migration|authentication|dashboard|release/.test(text) || (projectProfile?.commands?.length ?? 0) > 2 ? 'foundation-required' : 'lightweight';
}

export function evaluateFoundationReadiness(foundation) {
  const blockers = REQUIRED.filter((key) => !foundation?.[key] || (Array.isArray(foundation[key]) && !foundation[key].length)).map((key) => `${key}-missing`);
  if (foundation?.stories?.some((story) => story.state === 'stale')) blockers.push('stories-stale');
  return { status: blockers.length ? 'fail' : foundation.assumptions.length ? 'concerns' : 'pass', blockers };
}

function createFoundation(profile, goal, goalSource, mode) {
  const id = `foundation_${Date.now().toString(36)}`;
  const assumption = { id: 'customer-evidence', statement: 'Target users, demand, and success baseline require validation.', severity: 'medium', evidence: 'missing' };
  const node = (name, values = {}) => ({ id: `${id}_${name}`, revision: 1, decisionState: 'draft', state: 'ready', dependsOn: [], ...values });
  const context = node('context', { evidence: 'repository-derived', stacks: profile.stacks, commands: profile.commands, assumptions: [] });
  const prd = node('prd', { dependsOn: [context.id], outcome: goal, scope: 'One reversible, measurable thin slice.', acceptanceCriteria: ['Implement the smallest useful slice.', 'Record relevant verification evidence.', 'Preserve a rollback or recovery path.'], assumptions: [assumption] });
  const architecture = node('architecture', { dependsOn: [prd.id], decisions: ['Follow existing repository stack and conventions.', 'Use a reversible boundary for the first delivery.'], assumptions: [] });
  const nfrs = node('nfrs', { dependsOn: [architecture.id], requirements: ['Preserve applicable accessibility.', 'Avoid secrets in artifacts.', 'Record verification and rollback evidence.'], assumptions: [] });
  const epic = node('epic_1', { dependsOn: [prd.id, architecture.id, nfrs.id], title: goal, state: 'ready' });
  const story = node('story_1', { dependsOn: [epic.id], title: 'Implement the smallest reversible outcome slice', state: 'ready', acceptanceCriteria: prd.acceptanceCriteria, definitionOfDone: 'Relevant tests pass or gaps are recorded.' });
  const sprint = node('sprint', { dependsOn: [story.id], stories: [{ id: story.id, state: 'ready' }], wipLimit: 1 });
  return { id, revision: 1, goal, goalSource, mode, assumptions: [assumption], decisionsNeeded: [], context, prd, architecture, nfrs, epics: [epic], stories: [story], sprint };
}

function resultFor(foundation, profile) {
  const readiness = evaluateFoundationReadiness(foundation);
  return { schemaVersion: 1, status: statusFor(readiness), foundationId: foundation.id, revision: foundation.revision, goal: foundation.goal, goalSource: foundation.goalSource, scope: classifyFoundationScope({ goal: foundation.goal, projectProfile: profile }), foundation, readiness, assumptions: foundation.assumptions, decisionsNeeded: foundation.decisionsNeeded, nextStory: foundation.stories.find((story) => story.state === 'ready') ?? null, artifactPath: '.codex-orchestrator/foundation/latest.json', errors: [] };
}

function statusFor(readiness) { return readiness.status === 'pass' ? 'ready' : readiness.status; }
function markStale(value) { if (Array.isArray(value)) value.forEach(markStale); else if (value) value.state = 'stale'; }
function statePath(root) { return artifactStatePath(root, 'foundation', 'latest.json'); }
async function persist(root, result) {
  await writeJsonAtomic(statePath(root), result);
  const documents = [
    ['project-context.md', 'Project Context', result.foundation.context], ['prd.md', 'Product Requirements', result.foundation.prd], ['architecture-spine.md', 'Architecture Spine', result.foundation.architecture], ['non-functional-requirements.md', 'Non-Functional Requirements', result.foundation.nfrs], ['epics.md', 'Epics', result.foundation.epics], ['foundation-readiness.md', 'Foundation Readiness', result.readiness], ['sprint-status.md', 'Sprint Status', result.foundation.sprint],
  ];
  for (const [name, title, value] of documents) await publishProjectDocument({ workspace: root, name, title, body: `\`\`\`json\n${JSON.stringify(value, null, 2)}\n\`\`\`` });
  await publishProjectDocument({ workspace: root, name: 'foundation-story-1.md', title: 'Foundation Story 1', body: `## ${result.foundation.stories[0].title}\n\n${result.foundation.stories[0].acceptanceCriteria.map((item) => `- ${item}`).join('\n')}` });
}
