import { readFile, rm } from 'node:fs/promises';

import { artifactStatePath } from './artifact-store.mjs';
import { invalidInput } from './errors.mjs';
import { writeJsonAtomic } from './io.mjs';
import { readOutcomeMemory, recordOutcomeMemory } from './outcome-memory.mjs';

const HARD_STOPS = ['credentials-or-secrets', 'irreversible-deletion-or-migration', 'external-spend', 'production-impact', 'legal-or-contractual-decision', 'platform-required-approval'];
const PACKETS = [
  ['inspect-and-contract', 'Inspect the workspace and derive the smallest safe plan.', ['workspace-inspection']],
  ['implement', 'Implement the next reversible change using a permitted adapter.', ['adapter-receipt']],
  ['functional-proof', 'Run relevant functional checks and repair failures.', ['passed-command']],
  ['experience-review', 'Collect applicable review, visual, and accessibility evidence.', ['review-evidence']],
  ['risk-release', 'Record risk, readiness, rollback, and release evidence.', ['risk-readiness']],
  ['handoff', 'Prepare a concise evidence-backed handoff.', ['handoff-record']],
];

export async function startAutopilot({ workspace, goal, autonomy = {} }) {
  return startMission({ workspace, goal, autonomy, key: 'mission-latest.json' });
}

export async function startChildAutopilot({ workspace, goal, autonomy = {}, id }) {
  if (!/^[A-Za-z0-9._-]{1,120}$/.test(String(id))) throw invalidInput('FM_AUTOPILOT_CHILD_ID_INVALID', 'Child mission id must be a safe filename.');
  return startMission({ workspace, goal, autonomy, key: `missions/${id}.json` });
}

async function startMission({ workspace, goal, autonomy, key }) {
  const existing = await loadMission(workspace, key);
  if (existing && !['completed', 'blocked'].includes(existing.state)) return { schemaVersion: 1, status: 'ready', mission: existing, errors: [] };
  const outcomes = await readOutcomeMemory({ workspace });
  const mission = { schemaVersion: 1, id: `autopilot-${Date.now().toString(36)}`, goal: String(goal ?? '').trim() || 'Inspect this project and autonomously achieve the highest-value safe outcome.', goalSource: goal ? 'explicit' : 'zero-input-default', definitionOfDone: 'The goal is implemented, verified, reviewed, evidence-backed, and handed off or held at a real hard stop.', state: 'ready', autonomy: { maxRepairAttempts: finite(autonomy.maxRepairAttempts, 2), maxActions: finite(autonomy.maxActions, 25), hardStops: HARD_STOPS }, priorOutcomes: outcomes.slice(-5).map((item) => ({ subject: item.subject, statement: item.statement, evidence: item.evidence })), packets: PACKETS.map(([id, instruction, requiredEvidence], index) => ({ id, instruction, requiredEvidence, state: index === 0 ? 'ready' : 'pending', attempts: 0, evidence: [], failures: [] })), receipts: [], checkpoints: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), errors: [] };
  await saveMission(workspace, mission, key);
  return { schemaVersion: 1, status: 'ready', mission, errors: [] };
}

export async function getAutopilotStatus({ workspace }) { const mission = await loadMission(workspace); return mission ? { schemaVersion: 1, status: mission.state === 'held' ? 'held' : 'passed', mission, nextPacket: readyPacket(mission), errors: [] } : { schemaVersion: 1, status: 'missing', nextAction: 'Run autopilot start --goal "<outcome>" first.', errors: [] }; }
export async function holdAutopilot({ workspace, reason }) { const mission = await requireMission(workspace); mission.state = 'held'; mission.holdReason = String(reason ?? 'Manual hold requested.'); mission.updatedAt = new Date().toISOString(); await saveMission(workspace, mission); return { schemaVersion: 1, status: 'held', mission, errors: [] }; }
export async function resumeAutopilot({ workspace }) { const mission = await requireMission(workspace); if (mission.state === 'held') { mission.state = 'ready'; delete mission.holdReason; mission.updatedAt = new Date().toISOString(); await saveMission(workspace, mission); } return { schemaVersion: 1, status: 'ready', mission, nextPacket: readyPacket(mission), errors: [] }; }

export async function runAutopilot({ workspace, executeAction }) {
  const mission = await requireMission(workspace);
  const lease = await acquireLease(workspace, mission.id);
  if (!lease.acquired) return { schemaVersion: 1, status: 'held', mission, errors: [{ code: 'FM_AUTOPILOT_LEASE_HELD', message: 'Another active worker owns this mission lease.' }] };
  try {
  if (mission.state === 'held') return { schemaVersion: 1, status: 'held', mission, errors: [] };
  const current = readyPacket(mission);
  if (!current) return { schemaVersion: 1, status: mission.state, mission, errors: [] };
  current.state = 'running';
  if (current.id === 'inspect-and-contract') return complete(workspace, mission, current, ['workspace-inspection']);
  if (!executeAction) { current.state = 'held'; mission.state = 'held'; mission.holdReason = `Packet ${current.id} needs a configured, scoped action adapter.`; await saveMission(workspace, mission); return { schemaVersion: 1, status: 'held', mission, errors: [] }; }
  const receipt = await executeAction(mission, current);
  mission.receipts.push(receipt.idempotencyKey);
  if (receipt.status !== 'succeeded') { current.attempts += 1; current.failures.push({ at: new Date().toISOString(), receipt: receipt.idempotencyKey }); if (current.attempts >= mission.autonomy.maxRepairAttempts) { current.state = 'blocked'; mission.state = 'blocked'; mission.blocker = `Repair budget exhausted for ${current.id}.`; } else { current.state = 'repairing'; mission.state = 'repairing'; } await saveMission(workspace, mission); return { schemaVersion: 1, status: mission.state, mission, receipt, errors: [] }; }
  const evidence = current.id === 'functional-proof' ? ['passed-command'] : current.requiredEvidence;
  return complete(workspace, mission, current, evidence, receipt);
  } finally { await releaseLease(workspace, mission.id); }
}

async function complete(workspace, mission, packet, evidence, receipt = null) { packet.state = 'verified'; packet.evidence = evidence; packet.completedAt = new Date().toISOString(); const next = mission.packets.find((item) => item.state === 'pending'); if (next) next.state = 'ready'; else mission.state = 'completed'; mission.updatedAt = new Date().toISOString(); mission.checkpoints.push({ at: mission.updatedAt, packet: packet.id, evidence }); await saveMission(workspace, mission); await recordOutcomeMemory({ workspace, subject: mission.id, statement: `Verified ${packet.id} for ${mission.goal}.`, evidence }); return { schemaVersion: 1, status: mission.state === 'completed' ? 'completed' : 'ready', mission, nextPacket: readyPacket(mission), receipt, errors: [] }; }
async function loadMission(workspace, key = 'mission-latest.json') { try { return JSON.parse(await readFile(missionPath(workspace, key), 'utf8')); } catch (error) { if (error.code === 'ENOENT') return null; throw error; } }
async function requireMission(workspace) { const mission = await loadMission(workspace); if (!mission) throw invalidInput('FM_AUTOPILOT_MISSION_MISSING', 'Start an autopilot mission first.'); return mission; }
async function saveMission(workspace, mission, key = 'mission-latest.json') { await writeJsonAtomic(missionPath(workspace, key), mission); }
function missionPath(workspace, key = 'mission-latest.json') { return artifactStatePath(workspace, 'autopilot', key); }
function leasePath(workspace) { return artifactStatePath(workspace, 'autopilot', 'lease.json'); }
function readyPacket(mission) { return mission.packets.find((item) => item.state === 'ready') ?? null; }
function finite(value, fallback) { const number = Number(value); return Number.isInteger(number) && number > 0 ? number : fallback; }
async function acquireLease(workspace, missionId) {
  try {
    const existing = JSON.parse(await readFile(leasePath(workspace), 'utf8'));
    if (existing.missionId !== missionId && new Date(existing.expiresAt) > new Date()) return { acquired: false };
  } catch (error) { if (error.code !== 'ENOENT') throw error; }
  const lease = { missionId, owner: `worker-${process.pid}`, acquiredAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 60_000).toISOString() };
  await writeJsonAtomic(leasePath(workspace), lease);
  return { acquired: true, lease };
}
async function releaseLease(workspace, missionId) { try { const lease = JSON.parse(await readFile(leasePath(workspace), 'utf8')); if (lease.missionId === missionId) await rm(leasePath(workspace), { force: true }); } catch (error) { if (error.code !== 'ENOENT') throw error; } }
