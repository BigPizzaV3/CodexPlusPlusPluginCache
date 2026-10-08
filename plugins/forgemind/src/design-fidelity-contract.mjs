import { createHash } from 'node:crypto';
import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';

import { assertContained, resolveWorkspace } from './paths.mjs';
import { isSafeBrowserTarget } from './xray-adapters.mjs';

const VIEWPORTS = new Set(['desktop', 'mobile']);

export async function loadDesignContracts({ workspace, references, route, viewport = 'desktop', thresholdPercent = 1, maxIterations = 3 }) {
  const root = await resolveWorkspace(workspace); const gaps = [];
  if (!VIEWPORTS.has(viewport) || !isSafeBrowserTarget(route) || !Number.isFinite(Number(thresholdPercent)) || Number(thresholdPercent) < 0 || Number(thresholdPercent) > 100 || !Number.isInteger(Number(maxIterations)) || Number(maxIterations) < 1) {
    return { contracts: [], gaps: [invalid('Route, viewport, threshold, or iteration limit is invalid.')] };
  }
  const files = [];
  for (const raw of String(references ?? '').split(',').map((value) => value.trim()).filter(Boolean)) {
    if (/^[a-z][a-z0-9+.-]*:/i.test(raw)) { gaps.push(invalid(`Reference must be a local PNG path: ${raw}`)); continue; }
    let target;
    try { target = assertContained(root, path.resolve(root, raw)); } catch { gaps.push(invalid(`Reference escapes workspace: ${raw}`)); continue; }
    try { const info = await stat(target); if (info.isDirectory()) files.push(...await pngFiles(root, target)); else if (/\.png$/i.test(target)) files.push(target); else gaps.push(invalid(`Reference is not a PNG: ${raw}`)); }
    catch { gaps.push(invalid(`Reference does not exist: ${raw}`)); }
  }
  const unique = [...new Set(files)].sort((a, b) => a.localeCompare(b));
  const contracts = await Promise.all(unique.map(async (file) => ({
    id: `design-${createHash('sha256').update(path.relative(root, file)).digest('hex').slice(0, 12)}`,
    referencePath: path.relative(root, file).replaceAll('\\', '/'), referenceDigest: createHash('sha256').update(await readFile(file)).digest('hex'),
    route: String(route), viewport, thresholdPercent: Number(thresholdPercent), maxIterations: Number(maxIterations),
  })));
  if (!contracts.length && !gaps.length) gaps.push(invalid('At least one local PNG reference is required.'));
  return { contracts, gaps };
}

async function pngFiles(root, directory) { const entries = await readdir(directory, { withFileTypes: true }); const found = []; for (const entry of entries) { const target = assertContained(root, path.join(directory, entry.name)); if (entry.isDirectory()) found.push(...await pngFiles(root, target)); else if (entry.isFile() && /\.png$/i.test(entry.name)) found.push(target); } return found; }
function invalid(message) { return { code: 'FM_DESIGN_FIDELITY_REFERENCE_INVALID', message, nextAction: 'Provide local workspace PNG references and a safe local/test route.' }; }
