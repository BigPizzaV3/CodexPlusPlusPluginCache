import { copyFile, mkdir, readFile, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';

import { ForgeMindError } from './errors.mjs';
import { artifactMetadata, artifactStatePath } from './artifact-store.mjs';
import { writeJsonAtomic } from './io.mjs';
import { assertContained } from './paths.mjs';
import { isSafeBrowserTarget } from './xray-adapters.mjs';
import { loadControlContract } from './design-fidelity-controls.mjs';
import { ALLOWED_UI_EXTENSIONS } from './design-fidelity-policy.mjs';

const VIEWPORTS = new Set(['desktop', 'mobile']);

export async function importProductDesignDraft({ workspace, input, route, viewport = 'desktop', sourceProposal = null }) {
  if (artifactMetadata().artifactMode === 'none' || !input || /^[a-z][a-z0-9+.-]*:/i.test(input) || !isSafeBrowserTarget(route) || !VIEWPORTS.has(viewport)) throw invalidDraft();
  let source;
  try {
    source = assertContained(workspace, path.resolve(workspace, input));
    if (!(await stat(source)).isFile() || !/\.png$/i.test(source)) throw invalidDraft();
  } catch (error) {
    if (error?.code === 'FM_DESIGN_FIDELITY_DRAFT_INVALID') throw error;
    throw invalidDraft();
  }
  const bytes = await readFile(source);
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  const provenance = sourceProposal ? `-${digest(`${sourceProposal.proposalSetId}|${sourceProposal.proposalId}|${sha256}`).slice(0, 12)}` : '';
  const id = `draft-${sha256.slice(0, 16)}${provenance}`;
  const image = artifactStatePath(workspace, 'design-fidelity', 'drafts', `${id}.png`);
  await mkdir(path.dirname(image), { recursive: true });
  await copyFile(source, image);
  const draft = { schemaVersion: 1, id, source: 'product-design', selectedBy: 'user', referencePath: `.codex-orchestrator/design-fidelity/drafts/${id}.png`, sha256, route, viewport, ...(sourceProposal ? { sourceProposal } : {}) };
  await writeJsonAtomic(artifactStatePath(workspace, 'design-fidelity', 'drafts', `${id}.json`), draft);
  return draft;
}

export async function createProductDesignProposals({ workspace, inputs, route, viewport = 'desktop', goal = null }) {
  if (artifactMetadata().artifactMode === 'none' || !isSafeBrowserTarget(route) || !VIEWPORTS.has(viewport)) throw invalidProposals();
  const values = String(inputs ?? '').split(',').map((value) => value.trim()).filter(Boolean);
  if (values.length !== 3) throw invalidProposals();
  const imported = [];
  for (const [index, input] of values.entries()) {
    let source;
    try {
      source = assertContained(workspace, path.resolve(workspace, input));
      if (!(await stat(source)).isFile() || !/\.png$/i.test(source)) throw invalidProposals();
    } catch (error) { if (error?.code === 'FM_DESIGN_FIDELITY_PROPOSALS_INVALID') throw error; throw invalidProposals(); }
    const bytes = await readFile(source); const sha256 = createHash('sha256').update(bytes).digest('hex');
    imported.push({ source, sha256, bytes, index });
  }
  if (new Set(imported.map((item) => item.sha256)).size !== 3) throw invalidProposals();
  const id = `proposal-set-${digest(JSON.stringify({ route, viewport, proposals: imported.map((item) => item.sha256) })).slice(0, 16)}`;
  const proposals = [];
  for (const item of imported) {
    const name = `proposal-${item.index + 1}.png`;
    const target = artifactStatePath(workspace, 'design-fidelity', 'proposals', id, name);
    await mkdir(path.dirname(target), { recursive: true }); await copyFile(item.source, target);
    proposals.push({ id: `proposal-${item.index + 1}`, title: `Option ${item.index + 1}`, rationale: 'Product Design proposal; compare it visually before selecting.', sha256: item.sha256, referencePath: `.codex-orchestrator/design-fidelity/proposals/${id}/${name}` });
  }
  const result = { schemaVersion: 1, id, status: 'awaiting-selection', source: 'product-design', goal, route, viewport, proposals, selectedProposalId: null, generatedAt: new Date().toISOString() };
  await writeJsonAtomic(artifactStatePath(workspace, 'design-fidelity', 'proposals', id, 'manifest.json'), result);
  await writeJsonAtomic(artifactStatePath(workspace, 'design-fidelity', 'active-proposal-set.json'), { schemaVersion: 1, proposalSetId: id, status: result.status, updatedAt: result.generatedAt });
  return result;
}

export async function selectProductDesignProposal({ workspace, proposalSetId, proposalId, reason = null }) {
  const manifestPath = artifactStatePath(workspace, 'design-fidelity', 'proposals', String(proposalSetId), 'manifest.json');
  let set;
  try { set = await validateProposalSet({ workspace, value: JSON.parse(await readFile(manifestPath, 'utf8')) }); } catch (error) { if (error?.code) throw error; throw new ForgeMindError('FM_DESIGN_FIDELITY_PROPOSAL_UNKNOWN', 'Select a proposal from an existing Product Design proposal set.'); }
  const proposal = set.proposals.find((item) => item.id === proposalId);
  if (!proposal || (set.selectedProposalId && set.selectedProposalId !== proposalId)) throw new ForgeMindError('FM_DESIGN_FIDELITY_PROPOSAL_UNKNOWN', 'Select a proposal ID from the current Product Design proposal set.');
  const selection = { schemaVersion: 1, id: `selection-${digest(`${set.id}|${proposalId}|${proposal.sha256}`).slice(0, 16)}`, proposalSetId: set.id, proposalId, selectedBy: 'user', selectedAt: new Date().toISOString(), ...(reason?.trim() ? { reason: String(reason).trim() } : {}), sha256: proposal.sha256 };
  const draft = await importProductDesignDraft({ workspace, input: proposal.referencePath, route: set.route, viewport: set.viewport, sourceProposal: { proposalSetId: set.id, proposalId, selectionId: selection.id } });
  selection.draftId = draft.id;
  set.status = 'selected'; set.selectedProposalId = proposalId; await writeJsonAtomic(manifestPath, set);
  await writeJsonAtomic(artifactStatePath(workspace, 'design-fidelity', 'selections', `${selection.id}.json`), selection);
  await writeJsonAtomic(artifactStatePath(workspace, 'design-fidelity', 'active-proposal-set.json'), { schemaVersion: 1, proposalSetId: set.id, status: set.status, selectedProposalId: proposalId, selectionId: selection.id, updatedAt: selection.selectedAt });
  return { selection, draft };
}

export async function loadProductDesignProposals({ workspace, proposalSetId }) {
  try { return await validateProposalSet({ workspace, value: JSON.parse(await readFile(artifactStatePath(workspace, 'design-fidelity', 'proposals', String(proposalSetId), 'manifest.json'), 'utf8')) }); }
  catch (error) { if (error?.code === 'ENOENT') return null; throw error; }
}

export async function prepareSelectedProductDesignProposal({ workspace, proposalSetId, proposalId, controlContractId }) {
  const set = await loadProductDesignProposals({ workspace, proposalSetId });
  const proposal = set?.proposals.find((item) => item.id === proposalId);
  if (!proposal || set.selectedProposalId !== proposalId) throw new ForgeMindError('FM_DESIGN_FIDELITY_SELECTION_REQUIRED', 'Select a Product Design proposal before applying it.');
  const selectionId = `selection-${digest(`${set.id}|${proposalId}|${proposal.sha256}`).slice(0, 16)}`;
  const selection = await loadSelection({ workspace, selectionId });
  const draft = await loadProductDesignDraft({ workspace, draftId: selection?.draftId });
  if (!selection || !draft || !sameSelection(selection, set, proposal, draft) || !(await hasExpectedDraftImage({ workspace, draft }))) throw new ForgeMindError('FM_DESIGN_FIDELITY_DRAFT_TAMPERED', 'The selected Product Design draft is missing, changed, or no longer linked to its user selection. Select the proposal again.');
  const controlContract = controlContractId ? await loadControlContract({ workspace, contractId: controlContractId }) : null;
  if (!controlContract || controlContract.route !== draft.route) throw new ForgeMindError('FM_DESIGN_FIDELITY_CONTROL_REQUIRED', 'An existing control contract for the selected draft route is required before implementation.');
  const implementation = { schemaVersion: 1, id: `implementation-${selection.id.slice('selection-'.length)}`, selectionId: selection.id, draftId: draft.id, controlContractId: controlContract.id, route: draft.route, viewport: draft.viewport, allowedExtensions: ALLOWED_UI_EXTENSIONS,
    sourceEditRequired: true,
    executionSequence: ['inspect the selected immutable draft and control contract', 'identify only matching workspace UI files with an allowed extension', 'edit those UI files to implement the selected draft', 'run safe project verification', 'run the required measured Design Fidelity verification', 'keep the edit only when verification passes and the measured difference decreases'],
    requiredVerification: `design-fidelity run --draft-id ${draft.id} --control-contract ${controlContract.id} --control-observations '<observations-json>' --artifacts workspace --json`, correctionRule: 'Keep an edit only after safe project verification passes and the next measured difference decreases.' };
  await writeJsonAtomic(artifactStatePath(workspace, 'design-fidelity', 'implementation-plans', `${implementation.id}.json`), implementation);
  return { schemaVersion: 1, status: 'implementation-ready', selection, draft, controlContract, implementation, nextAction: 'Edit only the matching allowed UI files to implement the selected draft, then run the required measured verification. This command does not edit source files itself.', errors: [] };
}

export async function applySelectedProductDesignProposal(args) { return prepareSelectedProductDesignProposal(args); }

export async function loadProductDesignDraft({ workspace, draftId }) {
  try { return JSON.parse(await readFile(artifactStatePath(workspace, 'design-fidelity', 'drafts', `${draftId}.json`), 'utf8')); }
  catch (error) { if (error?.code === 'ENOENT') return null; throw error; }
}

async function validateProposalSet({ workspace, value }) {
  if (!value || !/^proposal-set-[a-f0-9]{16}$/.test(value.id) || !isSafeBrowserTarget(value.route) || !VIEWPORTS.has(value.viewport) || !Array.isArray(value.proposals) || value.proposals.length !== 3 || !['awaiting-selection', 'selected'].includes(value.status)) throw proposalTampered();
  if (value.selectedProposalId && !value.proposals.some((proposal) => proposal.id === value.selectedProposalId)) throw proposalTampered();
  const hashes = new Set();
  for (const proposal of value.proposals) {
    if (!/^proposal-[1-3]$/.test(proposal?.id) || !/^[a-f0-9]{64}$/.test(proposal?.sha256) || hashes.has(proposal.sha256) || typeof proposal.referencePath !== 'string') throw proposalTampered();
    hashes.add(proposal.sha256);
    let file;
    try { file = assertContained(workspace, path.resolve(workspace, proposal.referencePath)); } catch { throw proposalTampered(); }
    if (createHash('sha256').update(await readFile(file)).digest('hex') !== proposal.sha256) throw proposalTampered();
  }
  return value;
}

async function loadSelection({ workspace, selectionId }) { try { return JSON.parse(await readFile(artifactStatePath(workspace, 'design-fidelity', 'selections', `${selectionId}.json`), 'utf8')); } catch { return null; } }
function sameSelection(selection, set, proposal, draft) { return selection.proposalSetId === set.id && selection.proposalId === proposal.id && selection.sha256 === proposal.sha256 && draft.sourceProposal?.proposalSetId === set.id && draft.sourceProposal?.proposalId === proposal.id && draft.sourceProposal?.selectionId === selection.id; }
async function hasExpectedDraftImage({ workspace, draft }) { try { const file = assertContained(workspace, path.resolve(workspace, draft.referencePath)); return createHash('sha256').update(await readFile(file)).digest('hex') === draft.sha256; } catch { return false; } }
function digest(value) { return createHash('sha256').update(value).digest('hex'); }
function proposalTampered() { return new ForgeMindError('FM_DESIGN_FIDELITY_PROPOSAL_TAMPERED', 'A Product Design proposal artifact is incomplete or has been changed. Create a new proposal set.'); }

function invalidDraft() { return new ForgeMindError('FM_DESIGN_FIDELITY_DRAFT_INVALID', 'A user-selected local Product Design PNG and safe local/test route are required.'); }
function invalidProposals() { return new ForgeMindError('FM_DESIGN_FIDELITY_PROPOSALS_INVALID', 'Exactly three unique local Product Design PNGs and a safe local/test route are required.'); }
