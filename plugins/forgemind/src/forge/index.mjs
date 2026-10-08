import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';

import { ForgeMindError, invalidInput } from '../errors.mjs';
import { loadForgeRecord } from './store.mjs';

export const FORGE_CAPABILITIES = ['trust', 'strategy', 'genome', 'flight', 'tournament', 'shrink', 'loop', 'escrow', 'federate'];
const MAX_INPUT_BYTES = 2 * 1024 * 1024;

export async function runForge({ workspace, positionals = [], options = {} }) {
  const capability = positionals[0] ?? 'help';
  const action = positionals[1] ?? defaultAction(capability);
  if (capability === 'help') return { schemaVersion: 1, status: 'passed', capabilities: FORGE_CAPABILITIES, usage: 'forgemind forge <capability> <action> [options]', errors: [] };
  if (!FORGE_CAPABILITIES.includes(capability)) throw invalidInput('FM_FORGE_CAPABILITY_UNKNOWN', `Unknown Forge capability: ${capability}`);
  if (capability === 'trust') return runTrust({ workspace, action, options });
  if (capability === 'strategy') return runStrategy({ workspace, action, options });
  if (capability === 'genome') return runGenome({ workspace, action, options });
  if (capability === 'flight') return runFlight({ workspace, action });
  if (capability === 'tournament') return runTournamentAction({ workspace, action, options });
  if (capability === 'shrink') return runShrink({ workspace, action, options });
  if (capability === 'loop') return runLoop({ workspace, action, options });
  if (capability === 'escrow') return runEscrow({ workspace, action, options });
  return runFederate({ workspace, action, options });
}

async function runTrust({ workspace, action, options }) {
  const { createTrustContract, evaluateTrust, importAgentEvidence, verifyTrustRecord } = await import('./trust.mjs');
  if (action === 'create') return createTrustContract({ workspace, input: await readJsonInput(workspace, options.input) });
  if (action === 'import') return importAgentEvidence({ workspace, input: await readJsonInput(workspace, options.input) });
  if (action === 'evaluate') return evaluateTrust({
    workspace,
    contract: await loadForgeRecord({ workspace, area: 'trust/contracts', reference: required(options.contract, 'contract') }),
    evidence: await loadForgeRecord({ workspace, area: 'trust/evidence', reference: required(options.evidence, 'evidence') }),
  });
  if (action === 'verify') return { ...verifyTrustRecord(await readJsonInput(workspace, options.input)), errors: [] };
  throw unknownAction('trust', action);
}

async function runStrategy({ workspace, action, options }) {
  const { checkStrategy, compileStrategy } = await import('./strategy.mjs');
  if (action === 'compile') return compileStrategy({ workspace, input: await readJsonInput(workspace, options.input) });
  if (action === 'check') return checkStrategy({
    workspace,
    strategy: await loadForgeRecord({ workspace, area: 'strategies', reference: required(options.strategy, 'strategy') }),
    delivery: await readJsonInput(workspace, options.input),
  });
  throw unknownAction('strategy', action);
}

async function runGenome({ workspace, action, options }) {
  const { analyzeGenome, recommendFromGenome } = await import('./genome.mjs');
  if (action === 'analyze') {
    const input = await readJsonInput(workspace, options.input);
    return analyzeGenome({ workspace, outcomes: input.outcomes, minCohort: input.minCohort ?? 3 });
  }
  if (action === 'recommend') return recommendFromGenome({
    genome: await loadForgeRecord({ workspace, area: 'genome', reference: required(options.genome, 'genome') }),
    task: await readJsonInput(workspace, options.input),
  });
  throw unknownAction('genome', action);
}

async function runFlight({ workspace, action }) {
  const { readFlightEvents, replayFlight, verifyFlight } = await import('./flight.mjs');
  if (action === 'verify') return verifyFlight({ workspace });
  if (action === 'replay') return replayFlight({ workspace });
  if (action === 'list') return { schemaVersion: 1, status: 'passed', events: await readFlightEvents({ workspace }), errors: [] };
  throw unknownAction('flight', action);
}

async function runTournamentAction({ workspace, action, options }) {
  if (action !== 'run') throw unknownAction('tournament', action);
  const { runTournament } = await import('./tournament.mjs');
  return runTournament({ workspace, input: await readJsonInput(workspace, options.input) });
}

async function runShrink({ workspace, action, options }) {
  if (action !== 'analyze') throw unknownAction('shrink', action);
  const { analyzeShrink } = await import('./shrink.mjs');
  return analyzeShrink({ workspace, input: await readJsonInput(workspace, options.input) });
}

async function runLoop({ workspace, action, options }) {
  const { advanceProductLoop, createProductLoop } = await import('./product-loop.mjs');
  if (action === 'create') return createProductLoop({ workspace, input: await readJsonInput(workspace, options.input) });
  if (action === 'advance') return advanceProductLoop({
    workspace,
    loop: await loadForgeRecord({ workspace, area: 'loops', reference: required(options.loop, 'loop') }),
    event: await readJsonInput(workspace, options.input),
  });
  if (action === 'status') {
    const record = await loadForgeRecord({ workspace, area: 'loops', reference: required(options.loop, 'loop') });
    return { schemaVersion: 1, status: 'passed', loop: record, errors: [] };
  }
  throw unknownAction('loop', action);
}

async function runEscrow({ workspace, action, options }) {
  const { createEvidenceEscrow, evaluateEscrow, releaseEscrow } = await import('./escrow.mjs');
  if (action === 'create') return createEvidenceEscrow({ workspace, input: await readJsonInput(workspace, options.input) });
  if (action === 'evaluate') return evaluateEscrow({
    workspace,
    escrow: await loadForgeRecord({ workspace, area: 'escrows', reference: required(options.escrow, 'escrow') }),
    attestation: await loadForgeRecord({ workspace, area: 'trust/attestations', reference: required(options.attestation, 'attestation') }),
    submission: await readJsonInput(workspace, options.input),
  });
  if (action === 'release') return releaseEscrow({
    workspace,
    escrow: await loadForgeRecord({ workspace, area: 'escrows', reference: required(options.escrow, 'escrow') }),
    evaluation: await loadForgeRecord({ workspace, area: 'escrows/evaluations', reference: required(options.evaluation, 'evaluation') }),
  });
  throw unknownAction('escrow', action);
}

async function runFederate({ workspace, action, options }) {
  const { aggregateFederatedBundles, exportFederatedBundle } = await import('./federate.mjs');
  const input = await readJsonInput(workspace, options.input);
  if (action === 'export') return exportFederatedBundle({ workspace, outcomes: input.outcomes, minCohort: input.minCohort ?? 5 });
  if (action === 'aggregate') return aggregateFederatedBundles({ workspace, bundles: input.bundles });
  throw unknownAction('federate', action);
}

async function readJsonInput(workspace, inputPath) {
  if (!inputPath) throw invalidInput('FM_FORGE_INPUT_REQUIRED', 'Forge action requires --input <json-file>.');
  const target = path.isAbsolute(inputPath) ? inputPath : path.resolve(workspace, inputPath);
  let metadata;
  try { metadata = await stat(target); }
  catch (error) { throw invalidInput('FM_FORGE_INPUT_INVALID', `Forge input could not be read: ${target}`, { cause: error }); }
  if (!metadata.isFile()) throw invalidInput('FM_FORGE_INPUT_INVALID', `Forge input is not a file: ${target}`);
  if (metadata.size > MAX_INPUT_BYTES) throw invalidInput('FM_FORGE_INPUT_TOO_LARGE', `Forge input exceeds ${MAX_INPUT_BYTES} bytes.`);
  try { return JSON.parse(await readFile(target, 'utf8')); }
  catch (error) { throw invalidInput('FM_FORGE_INPUT_INVALID', `Forge input is not valid JSON: ${error.message}`); }
}

function defaultAction(capability) { return capability === 'flight' ? 'verify' : 'help'; }
function required(value, name) { if (!value) throw invalidInput('FM_FORGE_REFERENCE_REQUIRED', `Forge action requires --${name} <id>.`); return value; }
function unknownAction(capability, action) { return invalidInput('FM_FORGE_ACTION_UNKNOWN', `Unknown ${capability} action: ${action}`); }
