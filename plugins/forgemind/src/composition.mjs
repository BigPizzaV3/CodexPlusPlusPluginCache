import path from 'node:path';

import { ForgeMindError } from './errors.mjs';
import { writeJsonAtomic } from './io.mjs';
import { assertContained, resolveWorkspace } from './paths.mjs';

const ROLES = [
  { id: 'discovery', triggers: /problem|research|customer|idea|market|discover/i, outcome: 'evidence-backed problem framing' },
  { id: 'product', triggers: /feature|mvp|value|roadmap|requirements|story/i, outcome: 'scoped product decision' },
  { id: 'architecture', triggers: /architecture|design|system|integration|api|data/i, outcome: 'implementable technical design' },
  { id: 'delivery', triggers: /build|implement|ship|code|fix|refactor/i, outcome: 'working change with bounded scope' },
  { id: 'quality', triggers: /test|verify|release|security|risk|review/i, outcome: 'verified release decision' },
];

export async function composeTeam({ workspace, goal, risk = 'medium' }) {
  if (!String(goal ?? '').trim()) throw new ForgeMindError('FM_COMPOSE_INVALID', 'Composition requires a goal.');
  const root = await resolveWorkspace(workspace);
  const selected = ROLES.filter((role) => role.triggers.test(goal));
  if (!selected.some((role) => role.id === 'delivery')) selected.push(ROLES.find((role) => role.id === 'delivery'));
  if (['medium', 'high'].includes(String(risk))) selected.push(ROLES.find((role) => role.id === 'quality'));
  const roles = [...new Map(selected.map((role) => [role.id, role])).values()];
  const composition = { schemaVersion: 1, generatedAt: new Date().toISOString(), status: 'planned', goal: String(goal), risk: String(risk), roles: roles.map((role, index) => ({ id: role.id, outcome: role.outcome, handoffTo: roles[index + 1]?.id ?? null })), operatingRule: 'Each role returns evidence, open risks, and a next-action handoff; no role may override a safety stop.', errors: [] };
  await writeJsonAtomic(assertContained(root, path.join(root, '.codex-orchestrator', 'composition', 'latest.json')), composition);
  return composition;
}
