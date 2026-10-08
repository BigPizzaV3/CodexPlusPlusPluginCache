import { computeMsaDerivedAnalysis } from "./analysis";
import { parseMsa } from "./parser";
import { searchMsaMotifFromProjectionsAsync } from "./search";
import type { MsaDocument } from "./types";
import { getMsaViewportSlice, type MsaViewportSlice } from "./virtualization";

type MsaPreviewMilestone =
  | "analysis-ready"
  | "load-start"
  | "parsed"
  | "shell-mounted"
  | "usable-grid";

type MsaBenchmarkReport = {
  alignedLength: number;
  analysisMs: number;
  motifHitCount: number;
  mountedCellCount: number;
  mountedRowCount: number;
  parseMs: number;
  rowCount: number;
  searchMs: number;
  timeToFirstUsableGridMs: number | null;
  timeToFirstViewerShellMs: number | null;
};

const MARK_PREFIX = "codex.msa-preview";

export function markMsaPreviewMilestone(milestone: MsaPreviewMilestone): void {
  if (
    typeof performance === "undefined" ||
    typeof performance.mark !== "function"
  ) {
    return;
  }
  performance.mark(`${MARK_PREFIX}.${milestone}`);
}

function readMsaPreviewMilestones(): Pick<
  MsaBenchmarkReport,
  "timeToFirstUsableGridMs" | "timeToFirstViewerShellMs"
> {
  const loadStart = getLatestMark("load-start");
  const shell = getLatestMark("shell-mounted");
  const grid = getLatestMark("usable-grid");
  return {
    timeToFirstUsableGridMs:
      loadStart == null || grid == null ? null : Math.max(0, grid - loadStart),
    timeToFirstViewerShellMs:
      loadStart == null || shell == null
        ? null
        : Math.max(0, shell - loadStart),
  };
}

export async function runMsaPerformanceBenchmark({
  contents,
  filePath,
  motifQuery = "",
}: {
  contents: string;
  filePath?: string;
  motifQuery?: string;
}): Promise<MsaBenchmarkReport> {
  const parseStartedAt = now();
  const parseResult = parseMsa(contents, filePath);
  const parseMs = now() - parseStartedAt;
  if (parseResult.status !== "success") {
    throw new Error(parseResult.message);
  }
  const document = parseResult.document;
  const analysisStartedAt = now();
  const analysis = computeMsaDerivedAnalysis({
    analysisId: "benchmark",
    analysisRowIds: document.rows
      .filter((row) => !row.hidden)
      .map((row) => row.id),
    document,
  });
  const analysisMs = now() - analysisStartedAt;
  const searchStartedAt = now();
  const hits =
    motifQuery.trim().length === 0
      ? []
      : await searchMsaMotifFromProjectionsAsync({
          moleculeType: document.displayInterpretation.moleculeType,
          projections: analysis.projections,
          rawQuery: motifQuery,
          searchCapabilities: document.searchCapabilities,
        });
  const searchMs = now() - searchStartedAt;
  const slice = getBenchmarkSlice(document);
  const mountedRowCount = Math.max(0, slice.rowEnd - slice.rowStart);
  const mountedCellCount =
    mountedRowCount * Math.max(0, slice.columnEnd - slice.columnStart);
  return {
    alignedLength: document.alignedLength,
    analysisMs,
    motifHitCount: hits.length,
    mountedCellCount,
    mountedRowCount,
    parseMs,
    rowCount: document.rows.length,
    searchMs,
    ...readMsaPreviewMilestones(),
  };
}

function getBenchmarkSlice(document: MsaDocument): MsaViewportSlice {
  return getMsaViewportSlice({
    alignedLength: document.alignedLength,
    height: 720,
    rowCount: document.rows.filter((row) => !row.hidden).length,
    scrollLeft: 0,
    scrollTop: 0,
    staticRowCount: 2 + document.annotations.length,
    width: 1280,
  });
}

function getLatestMark(milestone: MsaPreviewMilestone): number | null {
  if (
    typeof performance === "undefined" ||
    typeof performance.getEntriesByName !== "function"
  ) {
    return null;
  }
  const marks = performance.getEntriesByName(`${MARK_PREFIX}.${milestone}`);
  const latest = marks.at(-1);
  return latest?.startTime ?? null;
}

function now(): number {
  return typeof performance === "undefined" ? Date.now() : performance.now();
}
