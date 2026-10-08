import { readFile } from 'node:fs/promises';
import { ForgeMindError } from './errors.mjs';
import { artifactStatePath } from './artifact-store.mjs';
import { writeJsonAtomic } from './io.mjs';
import { isSafeBrowserTarget } from './xray-adapters.mjs';

const ROLES = new Set(['button', 'link', 'textbox', 'searchbox', 'checkbox', 'radio', 'combobox', 'tab', 'navigation', 'heading', 'img', 'card', 'status']);
const INTERACTIONS = new Set(['navigate', 'toggle', 'validate-empty']);
export async function saveControlContract({ workspace, contract }) { const value = validate(contract); await writeJsonAtomic(artifactStatePath(workspace, 'design-fidelity', 'control-contracts', `${value.id}.json`), value); return value; }
export async function loadControlContract({ workspace, contractId }) { try { return JSON.parse(await readFile(artifactStatePath(workspace, 'design-fidelity', 'control-contracts', `${contractId}.json`), 'utf8')); } catch (error) { if (error?.code === 'ENOENT') return null; throw error; } }
function validate(value) { const id = String(value?.id ?? ''); const route = String(value?.route ?? ''); const controls = Array.isArray(value?.controls) ? value.controls : []; if (!/^[a-z0-9-]+$/i.test(id) || !isSafeBrowserTarget(route) || !controls.length) fail(); const ids = new Set(); const normalized = controls.map((control) => { const item = { id: String(control?.id ?? ''), role: String(control?.role ?? ''), name: String(control?.name ?? ''), ...(control?.visibleText ? { visibleText: String(control.visibleText) } : {}), ...(control?.state ? { state: String(control.state) } : {}) }; if (!/^[a-z0-9-]+$/i.test(item.id) || ids.has(item.id) || !ROLES.has(item.role) || !item.name.trim()) fail(); ids.add(item.id); if (control?.safeInteraction) { const type = String(control.safeInteraction.type ?? ''); const target = String(control.safeInteraction.target ?? ''); if (!INTERACTIONS.has(type) || (type === 'navigate' && !/^\/(?!\/)(?!.*\.\.)[^?#\s]*$/.test(target))) fail(); item.safeInteraction = type === 'navigate' ? { type, target } : { type }; } return item; }); return { schemaVersion: 1, id, route, controls: normalized }; }
function fail() { throw new ForgeMindError('FM_DESIGN_FIDELITY_CONTROL_INVALID', 'Control contract contains an unsupported role, unsafe interaction, or invalid identifier.'); }
