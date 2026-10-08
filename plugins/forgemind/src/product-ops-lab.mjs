import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { ForgeMindError } from './errors.mjs';
import { writeJsonAtomic } from './io.mjs';
import { resolveWorkspace } from './paths.mjs';
import { artifactStatePath } from './artifact-store.mjs';
import { inspectProject } from './project.mjs';
import { listSignals } from './signals.mjs';
import { markdownTable, publishProjectDocument } from './project-documents.mjs';
import { runProcess } from './process.mjs';

const ROOT = ['.codex-orchestrator', 'product-ops'];

export async function recordResearch({ workspace, input, source = 'manual-research' }) {
  const root = await resolveWorkspace(workspace);
  if (!input) throw new ForgeMindError('FM_RESEARCH_INPUT_REQUIRED', 'Research import requires --input JSON.');
  const entries = JSON.parse(await readFile(path.resolve(input), 'utf8'));
  if (!Array.isArray(entries) || !entries.length) throw new ForgeMindError('FM_RESEARCH_INVALID', 'Research input must be a non-empty JSON array.');
  const records = entries.map((entry, index) => ({
    id: entry.id ?? `research_${digest(`${entry.url}|${entry.title}|${index}`)}`,
    title: required(entry.title, 'title'), url: required(entry.url, 'url'), claim: required(entry.claim, 'claim'),
    publishedAt: entry.publishedAt ?? null, retrievedAt: entry.retrievedAt ?? new Date().toISOString(),
    source: entry.source ?? source, evidenceType: entry.evidenceType ?? 'secondary', confidence: bounded(entry.confidence, 0.5),
    limitations: array(entry.limitations), commercial: object(entry.commercial),
  }));
  const result = { schemaVersion: 1, status: 'recorded', importedAt: new Date().toISOString(), records, claimBoundary: 'Imported sources support only their stated claims; validate customer fit and current relevance before deciding.', errors: [] };
  await save(root, 'research-latest.json', result);
  return result;
}

export async function createFinancialModel({ workspace, options = {}, projectProfile = null }) {
  const root = await resolveWorkspace(workspace);
  const { values: base, sources: assumptionSources } = assumptions(options, projectProfile);
  const scenarios = [
    ['conservative', 0.65, 1.25, 1.3], ['base', 1, 1, 1], ['upside', 1.35, 0.85, 0.8],
  ].map(([name, revenueFactor, churnFactor, cacFactor]) => scenario(name, base, revenueFactor, churnFactor, cacFactor));
  const result = { schemaVersion: 1, status: 'passed', generatedAt: new Date().toISOString(), assumptions: base, assumptionSources, scenarios, decisionRule: 'Proceed only if the conservative scenario reaches contribution-positive acquisition inside the available runway.', claimBoundary: 'Financial outputs are scenario calculations from explicit assumptions, not forecasts or investment advice.', errors: [] };
  const document = await publishProjectDocument({ workspace: root, name: 'financial-model.md', title: 'Financial Model', body: renderFinancialModel(result) });
  if (document) result.projectDocuments = ['docs/forgemind/financial-model.md'];
  await save(root, 'financial-model-latest.json', result);
  return result;
}

function renderFinancialModel(result) {
  const scenarioRows = result.scenarios.map((item) => ({ scenario: item.name, annualRevenue: item.annualRevenue, grossProfit: item.grossProfit, twelveMonthNet: item.twelveMonthNet, ltvToCac: item.ltvToCac ?? 'n/a', viabilityScore: item.viabilityScore }));
  const sources = Object.entries(result.assumptionSources).map(([field, item]) => ({ field, value: item.value, source: item.source, evidence: item.evidence }));
  return `## Decision rule\n\n${result.decisionRule}\n\n## Scenarios\n\n${markdownTable(scenarioRows)}\n\n## Assumption sources\n\n${markdownTable(sources)}\n\n## Assumptions\n\n\`\`\`json\n${JSON.stringify(result.assumptions, null, 2)}\n\`\`\`\n\n## Boundary\n\n${result.claimBoundary}`;
}

export async function recordTelemetry({ workspace, input, source = 'manual-export' }) {
  const root = await resolveWorkspace(workspace);
  if (!input) throw new ForgeMindError('FM_TELEMETRY_INPUT_REQUIRED', 'Telemetry import requires --input JSON.');
  const events = JSON.parse(await readFile(path.resolve(input), 'utf8'));
  if (!Array.isArray(events)) throw new ForgeMindError('FM_TELEMETRY_INVALID', 'Telemetry input must be a JSON array.');
  const normalized = events.map((event, index) => ({ id: event.id ?? `evt_${digest(JSON.stringify(event) + index)}`, name: required(event.name, 'name'), occurredAt: event.occurredAt ?? new Date().toISOString(), user: event.user ?? null, session: event.session ?? null, value: numeric(event.value, null), properties: object(event.properties), source }));
  const metrics = summarizeTelemetry(normalized);
  const result = { schemaVersion: 1, status: 'recorded', recordedAt: new Date().toISOString(), events: normalized, metrics, privacy: 'Import only pseudonymous, minimized data. ForgeMind stores the supplied event payload locally in the workspace.', errors: [] };
  await save(root, 'telemetry-latest.json', result);
  return result;
}

export async function runDiscoveryLoop({ workspace, goal }) {
  const root = await resolveWorkspace(workspace);
  const [signals, research, telemetry] = await Promise.all([listSignals({ workspace: root }), latest(root, 'research-latest.json'), latest(root, 'telemetry-latest.json')]);
  const result = { schemaVersion: 1, status: 'passed', generatedAt: new Date().toISOString(), goal: String(goal ?? 'prioritize the next product bet'),
    inputs: { customerSignals: signals.length, citedResearch: research?.records?.length ?? 0, telemetryEvents: telemetry?.events?.length ?? 0 },
    loops: [
      { name: 'listen', action: 'Import interviews, support, sales, reviews, and product telemetry with source and date.', evidence: signals.length + (research?.records?.length ?? 0) },
      { name: 'triangulate', action: 'Separate observed demand from desk research and behavioral data; flag disagreements.', evidence: telemetry?.metrics?.eventCount ?? 0 },
      { name: 'bet', action: 'Choose one reversible experiment with a kill condition and an owner.', evidence: 0 },
      { name: 'learn', action: 'Record outcome, update confidence, and reprioritize the portfolio.', evidence: 0 },
    ],
    nextAction: signals.length || research?.records?.length || telemetry?.events?.length ? 'create-or-update-an-experiment' : 'collect-at-least-one-customer-or-behavioral-signal',
    claimBoundary: 'No causal conclusion is made from imported telemetry or research alone.', errors: [] };
  await save(root, 'discovery-loop-latest.json', result);
  return result;
}

export async function createPortfolioCockpit({ workspace }) {
  const root = await resolveWorkspace(workspace);
  const [opportunity, finance, telemetry, loop] = await Promise.all(['opportunity-case-latest.json', 'financial-model-latest.json', 'telemetry-latest.json', 'discovery-loop-latest.json'].map((name) => latest(root, name)));
  const score = Math.round(((opportunity?.marketChance?.total ?? 0) * 0.45) + ((finance?.scenarios?.find((item) => item.name === 'conservative')?.viabilityScore ?? 0) * 0.35) + (Math.min(100, (telemetry?.metrics?.eventCount ?? 0) * 5) * 0.2));
  const result = { schemaVersion: 1, status: 'passed', generatedAt: new Date().toISOString(), score, band: score >= 70 ? 'prioritize' : score >= 45 ? 'validate' : 'park',
    cards: [{ id: 'selected-bet', title: opportunity?.goal ?? 'No selected opportunity', marketChance: opportunity?.marketChance?.total ?? null, conservativeViability: finance?.scenarios?.find((item) => item.name === 'conservative')?.viabilityScore ?? null, telemetryEvents: telemetry?.metrics?.eventCount ?? 0, discoveryState: loop?.nextAction ?? 'run discovery loop', decision: score >= 70 ? 'prioritize' : score >= 45 ? 'validate' : 'park' }],
    evidenceGaps: [!opportunity && 'market case missing', !finance && 'financial scenarios missing', !telemetry && 'telemetry missing'].filter(Boolean), errors: [] };
  await save(root, 'portfolio-cockpit-latest.json', result);
  return result;
}

export async function planUiTesting({ workspace, url }) {
  const root = await resolveWorkspace(workspace); const project = await inspectProject(root);
  const tools = [{ layer: 'semantic-accessibility', recommendation: 'Use the repository accessibility test layer or axe with a critical-flow browser run.', executable: false }];
  if (project.stacks.includes('node')) tools.push({ layer: 'browser-critical-flow', recommendation: 'Playwright is preferred when available; capture desktop and narrow-viewport evidence.', executable: existsSync(path.join(root, 'node_modules', 'playwright')) });
  tools.push({ layer: 'perceptual-visual-regression', recommendation: 'Provide an SSIM or pixelmatch result from the project visual runner; byte identity is not accepted as a visual-quality claim.', executable: false });
  const result = { schemaVersion: 1, status: 'planned', generatedAt: new Date().toISOString(), url: url ?? null, detectedStacks: project.stacks, tools, requiredStates: ['loading', 'empty', 'error', 'success', 'keyboard', 'narrow-viewport', 'recovery'], errors: [] };
  await save(root, 'ui-test-plan-latest.json', result); return result;
}

export async function runUiTest({ workspace, command, timeoutSeconds = 120 }) {
  const root = await resolveWorkspace(workspace); if (!command) throw new ForgeMindError('FM_UI_TEST_COMMAND_REQUIRED', 'UI test execution requires --command with a declared package.json script name.');
  const script = await resolveUiTestScript(root, command);
  const timeout = Math.min(600, Math.max(1, Number(timeoutSeconds) || 120)) * 1000;
  const run = await executePackageScript(script, root, timeout);
  const result = { schemaVersion: 1, status: run.exitCode === 0 && !run.timedOut ? 'passed' : 'failed', ranAt: new Date().toISOString(), command: `npm run ${script}`, script, timeoutSeconds: timeout / 1000, ...run, claimBoundary: 'This proves only the recorded declared package script result; inspect its artifacts and critical user flow before release.', errors: [] };
  await save(root, 'ui-test-run-latest.json', result); return result;
}

export async function recordPerceptualComparison({ workspace, input, threshold = 0.02 }) {
  const root = await resolveWorkspace(workspace); if (!input) throw new ForgeMindError('FM_PERCEPTUAL_INPUT_REQUIRED', 'Perceptual comparison requires --input JSON from a visual runner.');
  const report = JSON.parse(await readFile(path.resolve(input), 'utf8')); const difference = numeric(report.differenceRatio ?? report.diffRatio, null);
  if (difference === null || difference < 0 || difference > 1) throw new ForgeMindError('FM_PERCEPTUAL_INVALID', 'Visual report needs differenceRatio between 0 and 1.');
  const result = { schemaVersion: 1, status: difference <= Number(threshold) ? 'passed' : 'review-required', method: report.method ?? 'perceptual-runner', differenceRatio: difference, threshold: Number(threshold), baseline: report.baseline ?? null, candidate: report.candidate ?? null, claimBoundary: 'A passing numeric threshold still requires human review for meaningful visual changes.', errors: [] };
  await save(root, 'perceptual-comparison-latest.json', result); return result;
}

export async function stageTestRepair({ workspace, failure, replacement }) {
  const root = await resolveWorkspace(workspace); if (!failure || !replacement) throw new ForgeMindError('FM_REPAIR_INPUT_REQUIRED', 'Staged repair requires --failure and --replacement.');
  const result = { schemaVersion: 1, status: 'review-required', generatedAt: new Date().toISOString(), failure: String(failure), replacement: String(replacement), mode: 'staged-no-source-write', gates: ['Confirm same user intent.', 'Run the affected test and unhappy path.', 'Review accessibility and visual evidence.', 'Apply the source edit only after reviewer approval.'], errors: [] };
  await save(root, 'staged-test-repair-latest.json', result); return result;
}

function assumptions(o, profile) {
  const mappings = { addressableAccounts: 'market-size', monthlyPrice: 'price', grossMarginPercent: 'gross-margin', monthlyChurnPercent: 'churn', customerAcquisitionCost: 'cac', salesCycleMonths: 'sales-cycle', buildCost: 'build-cost', monthlyRunCost: 'monthly-cost', monthlyNewCustomers: 'new-customers', startingCustomers: 'starting-customers' };
  const values = {}; const sources = {};
  for (const [key, option] of Object.entries(mappings)) {
    const explicit = Number(o[option]); const derived = profile?.commercialAssumptions?.[key];
    if (Number.isFinite(explicit)) { values[key] = Math.max(0, explicit); sources[key] = { value: values[key], source: 'cli', evidence: 'observed', input: `--${option}` }; }
    else if (derived && Number.isFinite(Number(derived.value))) { values[key] = Math.max(0, Number(derived.value)); sources[key] = { value: values[key], source: derived.evidence === 'observed' ? 'project-evidence' : derived.evidence === 'inferred' ? 'project-inference' : 'assumption', evidence: derived.evidence, inputs: derived.sources }; }
    else { values[key] = numeric(undefined, 0); sources[key] = { value: values[key], source: 'assumption', evidence: 'missing', inputs: ['no project or CLI value'] }; }
  }
  return { values, sources };
}
function scenario(name, a, revenueFactor, churnFactor, cacFactor) {
  const acquired = a.monthlyNewCustomers * 12 * revenueFactor;
  const churned = (a.startingCustomers + acquired / 2) * (a.monthlyChurnPercent / 100) * 12 * churnFactor;
  const endCustomers = Math.max(0, a.startingCustomers + acquired - churned);
  const revenue = endCustomers * a.monthlyPrice * 12;
  const grossProfit = revenue * a.grossMarginPercent / 100;
  const acquisitionCost = acquired * a.customerAcquisitionCost * cacFactor;
  const net = grossProfit - acquisitionCost - a.buildCost - a.monthlyRunCost * 12;
  const ltv = a.monthlyChurnPercent > 0 ? a.monthlyPrice * (a.grossMarginPercent / 100) / (a.monthlyChurnPercent / 100) : null;
  const viabilityScore = Math.max(0, Math.min(100, Math.round(
    (net > 0 ? 50 : 15) + Math.min(30, endCustomers) + Math.min(20, (ltv ?? 0) / Math.max(1, a.customerAcquisitionCost * cacFactor)),
  )));
  return { name, acquiredCustomers: round(acquired), churnedCustomers: round(churned), endCustomers: round(endCustomers), annualRevenue: round(revenue), grossProfit: round(grossProfit), acquisitionCost: round(acquisitionCost), twelveMonthNet: round(net), ltv: ltv === null ? null : round(ltv), ltvToCac: ltv === null || !a.customerAcquisitionCost ? null : round(ltv / (a.customerAcquisitionCost * cacFactor)), viabilityScore };
}
function summarizeTelemetry(events) { const names = {}; const users = new Set(); for (const e of events) { names[e.name] = (names[e.name] ?? 0) + 1; if (e.user) users.add(e.user); } return { eventCount: events.length, uniqueKnownUsers: users.size, eventsByName: names }; }
async function resolveUiTestScript(workspace, command) {
  const script = String(command).trim();
  if (!/^[A-Za-z0-9:_-]+$/.test(script)) throw new ForgeMindError('FM_UI_TEST_SCRIPT_INVALID', 'UI test command must be a simple declared package.json script name.');
  let packageJson;
  try { packageJson = JSON.parse(await readFile(path.join(workspace, 'package.json'), 'utf8')); } catch { throw new ForgeMindError('FM_UI_TEST_SCRIPT_INVALID', 'UI test execution requires a readable package.json with declared scripts.'); }
  if (typeof packageJson.scripts?.[script] !== 'string' || !packageJson.scripts[script].trim()) throw new ForgeMindError('FM_UI_TEST_SCRIPT_INVALID', `UI test script "${script}" is not declared in package.json.`);
  return script;
}

async function executePackageScript(script, cwd, timeout) {
  const run = await runProcess('npm', ['run', script], { cwd, timeoutMs: timeout, maxOutputBytes: 12_000 });
  return { ...run, stdout: run.stdout.slice(-12000), stderr: run.stderr.slice(-12000) };
}
function required(value, name) { if (!String(value ?? '').trim()) throw new ForgeMindError('FM_INPUT_REQUIRED', `Research record requires ${name}.`); return String(value); }
function numeric(value, fallback) { const parsed = Number(value); return Number.isFinite(parsed) ? Math.max(0, parsed) : fallback; }
function bounded(value, fallback) { return Math.min(1, Math.max(0, numeric(value, fallback))); }
function array(value) { return Array.isArray(value) ? value.map(String) : []; }
function object(value) { return value && typeof value === 'object' && !Array.isArray(value) ? value : {}; }
function round(value) { return Math.round(value * 100) / 100; }
function digest(value) { return createHash('sha256').update(String(value)).digest('hex').slice(0, 24); }
async function latest(root, name) { try { return JSON.parse(await readFile(artifactStatePath(root, ...ROOT.slice(1), name), 'utf8')); } catch { return null; } }
async function save(root, name, value) { await writeJsonAtomic(artifactStatePath(root, ...ROOT.slice(1), name), value); }
