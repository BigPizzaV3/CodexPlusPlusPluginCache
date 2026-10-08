import { appendMemoryEntry, readActiveMemory } from './memory.mjs';
import { resolveWorkspace } from './paths.mjs';

export async function recordOutcomeMemory({ workspace, subject, statement, evidence = [], confidence = 0.7 }) {
  const root = await resolveWorkspace(workspace);
  return appendMemoryEntry({ workspace: root, scope: 'shared', entry: { type: 'outcome', subject: String(subject ?? 'autopilot'), statement: String(statement ?? ''), source: 'verified-forgemind-outcome', evidence, confidence, reviewState: 'approved', nonExpiring: true, sensitivity: 'internal' } });
}
export async function readOutcomeMemory({ workspace }) { return readActiveMemory({ workspace: await resolveWorkspace(workspace), scope: 'shared' }).then((items) => items.filter((item) => item.type === 'outcome')); }
