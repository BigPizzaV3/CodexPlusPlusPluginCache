import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { writeTextAtomic } from './io.mjs';
import { findMemoryConflicts } from './memory.mjs';
import { assertContained, resolveWorkspace } from './paths.mjs';
import { verifyFlight } from './forge/flight.mjs';
import { listForgeRecords } from './forge/store.mjs';

const SECTION_IDS = [
  'verification', 'risks', 'readiness', 'proof', 'traceability', 'decisions', 'memory-conflicts', 'outcomes', 'routing', 'usp-experiments',
  'experiments', 'discovery-scorecard', 'checkpoints', 'visual-qa', 'design-fidelity', 'capabilities', 'composition', 'delegation', 'hero-control', 'autopilot', 'portfolio', 'twin', 'ux-evolution', 'product-lab', 'outcome-memory', 'growth', 'integration-mesh', 'forge-trust', 'forge-strategy', 'forge-genome', 'forge-flight', 'forge-tournament', 'forge-shrink', 'forge-loop', 'forge-escrow', 'forge-federation',
];

export async function generateDashboard({ workspace, sources = {} }) {
  const root = await resolveWorkspace(workspace);
  const reports = '.codex-orchestrator/reports';
  const memory = '.codex-orchestrator/memory/shared';
  const product = '.codex-orchestrator/product';
  const entries = await readJsonLines(root, `${memory}/entries.jsonl`);
  const latestProof = await readJson(root, '.codex-orchestrator/evidence/latest.json');
  const proof = latestProof?.proofPath ? await readJson(root, latestProof.proofPath) : null;
  const content = {
    verification: await readJson(root, `${reports}/verification-latest.json`),
    risks: await readJson(root, `${reports}/risk-radar-latest.json`),
    readiness: await readJson(root, `${reports}/release-readiness-latest.json`),
    proof,
    traceability: await readText(root, sources.traceability ?? 'docs/forgemind/traceability.md'),
    decisions: await readText(root, sources.decisions ?? `${memory}/decisions.md`),
    'memory-conflicts': entries.length ? findMemoryConflicts(entries) : null,
    outcomes: await readJsonLines(root, `${memory}/outcomes.jsonl`),
    routing: await readJson(root, `${reports}/route-latest.json`),
    'usp-experiments': await readJsonLines(root, `${product}/usp-backlog.jsonl`),
    experiments: await readJsonLines(root, `${product}/experiments.jsonl`),
    'discovery-scorecard': await readJson(root, `${product}/discovery-scorecard-latest.json`),
    checkpoints: await listJson(root, '.codex-orchestrator/checkpoints'),
    'visual-qa': await listJson(root, '.codex-orchestrator/visual-qa'),
    'design-fidelity': await readJson(root, '.codex-orchestrator/design-fidelity/report-latest.json'),
    capabilities: await readJson(root, `${reports}/capability-manifest-latest.json`),
    composition: await readJson(root, '.codex-orchestrator/composition/latest.json'),
    delegation: await readJson(root, '.codex-orchestrator/delegation/latest.json'),
    'hero-control': await readJson(root, '.codex-orchestrator/hero/control-latest.json'),
    autopilot: await readJson(root, '.codex-orchestrator/autopilot/mission-latest.json'),
    portfolio: await readJson(root, '.codex-orchestrator/portfolio/latest.json'),
    twin: await readJson(root, '.codex-orchestrator/twin/latest.json'),
    'ux-evolution': await readJson(root, '.codex-orchestrator/ux-evolution/latest.json'),
    'product-lab': await readJson(root, '.codex-orchestrator/product-lab/latest.json'),
    'outcome-memory': entries.filter((item) => item.type === 'outcome'),
    growth: await readJson(root, '.codex-orchestrator/growth/latest.json'),
    'integration-mesh': await readJson(root, '.codex-orchestrator/integration-mesh/latest.json'),
    'forge-trust': await latestForgeRecord(root, ['trust/attestations', 'trust/contracts']),
    'forge-strategy': await latestForgeRecord(root, ['strategies/checks', 'strategies']),
    'forge-genome': await latestForgeRecord(root, ['genome']),
    'forge-flight': await safeFlightVerification(root),
    'forge-tournament': await latestForgeRecord(root, ['tournaments']),
    'forge-shrink': await latestForgeRecord(root, ['shrink']),
    'forge-loop': await latestForgeRecord(root, ['loops']),
    'forge-escrow': await latestForgeRecord(root, ['escrows/receipts', 'escrows/evaluations', 'escrows']),
    'forge-federation': await latestForgeRecord(root, ['federation/benchmarks', 'federation/exports']),
  };

  const cards = SECTION_IDS.map((id) => `<section id="${id}"><h2>${escapeHtml(title(id))}</h2>${render(content[id])}</section>`).join('\n');
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>ForgeMind Command Center</title>
<style>
:root{color-scheme:light dark;font-family:system-ui,sans-serif}body{max-width:1100px;margin:auto;padding:2rem;background:#0b1220;color:#e5edf8}header{margin-bottom:2rem}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:1rem}section{background:#162238;border:1px solid #2d4263;border-radius:12px;padding:1rem;overflow:auto}h1,h2{color:#8fc7ff}pre{white-space:pre-wrap;word-break:break-word}.missing{color:#aab8ca;font-style:italic}
</style>
</head>
<body><header><h1>ForgeMind Command Center</h1><p>Local evidence only. No telemetry or remote resources.</p></header><main>${cards}</main></body>
</html>
`;
  const output = assertContained(root, path.join(root, '.codex-orchestrator', 'dashboard', 'index.html'));
  await writeTextAtomic(output, html);
  return { schemaVersion: 1, status: 'passed', path: output, sections: SECTION_IDS };
}

function render(value) {
  if (value === null || value === undefined || value === '' || (Array.isArray(value) && value.length === 0)) {
    return '<p class="missing">No evidence available.</p>';
  }
  return `<pre>${escapeHtml(typeof value === 'string' ? value : JSON.stringify(value, null, 2))}</pre>`;
}

async function readJson(root, relative) {
  const text = await readText(root, relative);
  if (text === null) return null;
  try { return JSON.parse(text); } catch { return { status: 'invalid', source: relative }; }
}

async function readJsonLines(root, relative) {
  const text = await readText(root, relative);
  if (text === null) return [];
  try { return text.split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line)); } catch { return [{ status: 'invalid', source: relative }]; }
}

async function listJson(root, relative) {
  const { readdir } = await import('node:fs/promises');
  try { return await Promise.all((await readdir(assertContained(root, path.join(root, relative)))).filter((name) => name.endsWith('.json')).map((name) => readJson(root, path.join(relative, name)))); }
  catch (error) { if (error.code === 'ENOENT') return []; throw error; }
}

async function readText(root, relative) {
  const target = assertContained(root, path.join(root, relative));
  try { return await readFile(target, 'utf8'); } catch (error) { if (error.code === 'ENOENT') return null; throw error; }
}

async function latestForgeRecord(root, areas) {
  for (const area of areas) {
    try {
      const records = await listForgeRecords({ workspace: root, area });
      if (records.length) return records.toSorted(compareForgeRecords).at(-1);
    } catch (error) {
      return { status: 'invalid', source: `.codex-orchestrator/forge/${area}`, error: error.code ?? 'FM_FORGE_READ_FAILED' };
    }
  }
  return null;
}

async function safeFlightVerification(root) {
  try {
    const result = await verifyFlight({ workspace: root });
    return result.eventCount || result.status === 'invalid' ? result : null;
  } catch (error) {
    return { status: 'invalid', source: '.codex-orchestrator/forge/flights', error: error.code ?? 'FM_FLIGHT_READ_FAILED' };
  }
}

function compareForgeRecords(left, right) {
  const leftKey = left.updatedAt ?? left.createdAt ?? left.timestamp ?? left.id;
  const rightKey = right.updatedAt ?? right.createdAt ?? right.timestamp ?? right.id;
  return String(leftKey).localeCompare(String(rightKey));
}

function escapeHtml(value) {
  return String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
}

function title(id) { return id.split('-').map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(' '); }
