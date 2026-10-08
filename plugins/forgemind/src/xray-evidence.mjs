import { copyFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

import { artifactStatePath } from './artifact-store.mjs';
import { pngDifferencePercent } from './xray-image-diff.mjs';

export async function compareVisualEvidence({ workspace, flowId, screenshot, thresholdPercent = 0, baseline = false }) {
  const current = path.resolve(workspace, screenshot);
  const target = artifactStatePath(workspace, 'xray', 'visual', 'baseline', `${flowId}.png`);
  if (baseline) { await mkdir(path.dirname(target), { recursive: true }); await copyFile(current, target); return { evidence: [relative(workspace, target)], finding: null, gap: null, differencePercent: 0 }; }
  let differencePercent;
  try { differencePercent = await pngDifferencePercent(target, current); }
  catch (error) {
    const missing = error?.code === 'ENOENT';
    return { evidence: [screenshot], finding: null, gap: { code: missing ? 'FM_XRAY_VISUAL_BASELINE_MISSING' : 'FM_XRAY_VISUAL_COMPARISON_UNAVAILABLE', message: missing ? `No approved visual baseline exists for ${flowId}.` : `Visual comparison for ${flowId} requires compatible PNG screenshots.`, nextAction: missing ? 'Run xray baseline after reviewing the local UI state.' : 'Capture non-interlaced 8-bit RGB or RGBA PNG screenshots and rerun Xray.' } };
  }
  const evidence = [relative(workspace, target), screenshot];
  return differencePercent > thresholdPercent ? { evidence, differencePercent, gap: null, finding: { id: `finding-visual-${flowId}`, severity: 'medium', surfaces: ['web-gui'], componentIds: ['gui-usability', 'accessibility-visual'], title: `Visual regression: ${flowId}`, expected: `Change no more than ${thresholdPercent}% of pixels.`, actual: `${differencePercent.toFixed(2)}% of pixels differ from the approved baseline.`, evidence } } : { evidence, differencePercent, finding: null, gap: null };
}

export function performanceFinding(receipt, budgetMs) {
  if (!Number.isFinite(receipt?.durationMs)) return budgetMs === undefined ? null : { code: 'FM_XRAY_PERFORMANCE_TIMING_UNAVAILABLE', message: `No timing evidence is available for ${receipt?.id ?? 'the check'}.` };
  if (budgetMs === undefined || receipt.durationMs <= budgetMs) return null;
  return { id: `finding-performance-${receipt.id}`, severity: 'medium', surfaces: receipt.surfaceIds ?? [], componentIds: receipt.componentIds ?? [], title: `Performance budget exceeded: ${receipt.id}`, expected: `Complete within ${budgetMs}ms.`, actual: `Completed in ${receipt.durationMs}ms.`, evidence: receipt.evidence ?? [] };
}

function relative(workspace, target) { return path.relative(workspace, target).replaceAll('\\', '/'); }
