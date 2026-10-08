import path from 'node:path';

import { ForgeMindError } from './errors.mjs';
import { writeJsonAtomic } from './io.mjs';
import { assertContained, resolveWorkspace } from './paths.mjs';

export async function createDelegationPlan({ workspace, goal, budget = 3 }) {
  if (!String(goal ?? '').trim()) throw new ForgeMindError('FM_DELEGATION_INVALID', 'Delegation requires a goal.');
  const limit = Number(budget);
  if (!Number.isInteger(limit) || limit < 1 || limit > 8) throw new ForgeMindError('FM_DELEGATION_INVALID', 'Budget must be an integer between 1 and 8.');
  const base = [
    ['discover', 'Clarify outcome, evidence, and constraints.'],
    ['deliver', 'Implement the smallest verified change.'],
    ['verify', 'Review evidence, risk, and release readiness.'],
  ].slice(0, limit);
  const plan = { schemaVersion: 1, generatedAt: new Date().toISOString(), status: 'planned', goal: String(goal), budget: limit, execution: 'plan-only', tasks: base.map(([id, instruction], index) => ({ id: `${id}-${index + 1}`, instruction, dependsOn: index ? [`${base[index - 1][0]}-${index}`] : [], handoff: 'Return artifacts, verification evidence, open risks, and the next action.' })), errors: [] };
  const root = await resolveWorkspace(workspace);
  await writeJsonAtomic(assertContained(root, path.join(root, '.codex-orchestrator', 'delegation', 'latest.json')), plan);
  return plan;
}
