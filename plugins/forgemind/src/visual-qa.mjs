import { createHash } from 'node:crypto';
import { mkdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';

import { ForgeMindError } from './errors.mjs';
import { writeJsonAtomic } from './io.mjs';
import { assertContained, resolveWorkspace } from './paths.mjs';

export async function recordVisualEvidence({ workspace, input, label, viewport = 'unspecified', now = new Date() }) {
  if (!input || !label) throw new ForgeMindError('FM_VISUAL_INVALID', 'Visual evidence requires input and label.');
  const root = await resolveWorkspace(workspace);
  const absolute = path.resolve(input);
  const info = await stat(absolute);
  if (!info.isFile()) throw new ForgeMindError('FM_VISUAL_INVALID', `Visual evidence is not a file: ${absolute}`);
  const digest = createHash('sha256').update(await readFile(absolute)).digest('hex');
  const record = { schemaVersion: 1, id: `vis_${digest.slice(0, 24)}`, recordedAt: now.toISOString(), label: String(label), viewport: String(viewport), file: path.basename(absolute), bytes: info.size, sha256: digest };
  await writeJsonAtomic(assertContained(root, path.join(root, '.codex-orchestrator', 'visual-qa', `${record.id}.json`)), record);
  return { schemaVersion: 1, status: 'recorded', evidence: record, errors: [] };
}

export async function compareVisualEvidence({ workspace, baseline, candidate, label = 'visual comparison', now = new Date() }) {
  if (!baseline || !candidate) throw new ForgeMindError('FM_VISUAL_INVALID', 'Visual comparison requires baseline and candidate files.');
  const root = await resolveWorkspace(workspace);
  const baselineBytes = await readFile(path.resolve(baseline));
  const candidateBytes = await readFile(path.resolve(candidate));
  const baselineSha256 = createHash('sha256').update(baselineBytes).digest('hex');
  const candidateSha256 = createHash('sha256').update(candidateBytes).digest('hex');
  const result = { schemaVersion: 1, id: `cmp_${createHash('sha256').update(`${baselineSha256}|${candidateSha256}|${label}`).digest('hex').slice(0, 24)}`, comparedAt: now.toISOString(), label: String(label), method: 'byte-identity', baseline: { file: path.basename(baseline), sha256: baselineSha256, bytes: baselineBytes.length }, candidate: { file: path.basename(candidate), sha256: candidateSha256, bytes: candidateBytes.length }, status: baselineSha256 === candidateSha256 ? 'identical' : 'different' };
  await writeJsonAtomic(assertContained(root, path.join(root, '.codex-orchestrator', 'visual-qa', `${result.id}.json`)), result);
  return { schemaVersion: 1, status: result.status, comparison: result, errors: [] };
}

export async function captureBrowserScreenshot({ workspace, url, output, label, viewport = '1280x720', browserFactory }) {
  if (!url || !output || !label) throw new ForgeMindError('FM_VISUAL_INVALID', 'Browser capture requires url, output, and label.');
  const root = await resolveWorkspace(workspace);
  const target = assertContained(root, path.resolve(root, output));
  const [width, height] = String(viewport).split('x').map(Number);
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 320 || height < 240) throw new ForgeMindError('FM_VISUAL_INVALID', 'Viewport must be WIDTHxHEIGHT with a minimum of 320x240.');
  let chromium;
  try { chromium = browserFactory ?? (await import('playwright')).chromium; }
  catch { throw new ForgeMindError('FM_VISUAL_BROWSER_UNAVAILABLE', 'Browser capture needs the optional Playwright runtime. Install it in the workspace, then retry.', { remediation: 'npm install --save-dev playwright' }); }
  await mkdir(path.dirname(target), { recursive: true });
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width, height } });
    await page.goto(String(url), { waitUntil: 'networkidle' });
    await page.screenshot({ path: target, fullPage: true });
  } finally { await browser.close(); }
  return recordVisualEvidence({ workspace: root, input: target, label, viewport });
}
