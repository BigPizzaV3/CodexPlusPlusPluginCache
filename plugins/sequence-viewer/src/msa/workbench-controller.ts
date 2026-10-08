import { resolveViewerTarget } from "../target-resolution";
import type {
  SequenceViewerAnalysisRequest,
  SequenceViewerEditRequest,
} from "../viewer-operations";
import {
  addAlignmentGap,
  alignSequences,
  type AlignmentEngine,
  assignAlignmentRowGroup,
  deleteAlignmentGap,
  removeAlignmentColumns,
  removeAlignmentRows,
  removeGappyAlignmentColumns,
  reorderAlignmentRows,
  sortAlignmentRows,
} from "./alignment-editing";
import { calculatePDistance } from "./guide-tree";
import { buildGuideTree, type GuideTreeResult } from "./phylogenetic-tree";
import type { MsaDocument, MsaSequenceRow } from "./types";

export type AlignmentDocumentChange = {
  description: string;
  document: MsaDocument;
  operation: string;
};

export function runAlignmentAnalysis({
  document,
  request,
}: {
  document: MsaDocument;
  request: SequenceViewerAnalysisRequest;
}): Record<string, unknown> {
  if (request.analysis === "build-tree") {
    const rows = resolveRows(document, request.rowIds);
    const tree = buildGuideTree(rows, request.algorithm);
    return {
      analysis: request.analysis,
      tree,
      provenance: {
        algorithm: tree.algorithm,
        distance: tree.distance,
        limitations: tree.warning,
      },
    };
  }
  if (request.analysis === "distance-matrix") {
    const rows = resolveRows(document, request.rowIds);
    if (rows.length > 200) {
      throw new Error(
        "Interactive distance-matrix results are limited to 200 rows so the live model/UI payload remains bounded. Query or export a smaller row subset.",
      );
    }
    return {
      analysis: request.analysis,
      distance: "uncorrected-p-distance",
      labels: rows.map(({ id, label }) => ({ id, label })),
      matrix: rows.map((left) =>
        rows.map((right) =>
          calculatePDistance(left.alignedSequence, right.alignedSequence),
        ),
      ),
      provenance: {
        gapPolicy: "all-gap comparisons ignored by pairwise p-distance",
      },
    };
  }
  throw new Error(
    `${request.analysis} is available only while the viewer is in Sequence mode.`,
  );
}

export function applyAlignmentEditRequest({
  document,
  request,
  tree,
}: {
  document: MsaDocument;
  request: SequenceViewerEditRequest;
  tree: GuideTreeResult | null;
}): AlignmentDocumentChange | { historyOperation: "redo" | "undo" } {
  if (request.operation === "undo" || request.operation === "redo") {
    return { historyOperation: request.operation };
  }
  let result;
  switch (request.operation) {
    case "add-alignment-gap": {
      const row = resolveAlignmentRow(document, request.row);
      result = addAlignmentGap(document, row.id, request.column);
      break;
    }
    case "delete-alignment-gap": {
      const row = resolveAlignmentRow(document, request.row);
      result = deleteAlignmentGap(document, row.id, request.column);
      break;
    }
    case "assign-alignment-row-group":
      result = assignAlignmentRowGroup(
        document,
        request.rowIds.map(
          (selector) => resolveAlignmentRow(document, selector).id,
        ),
        request.group,
      );
      break;
    case "remove-alignment-columns":
      result = removeAlignmentColumns(document, request.start, request.end);
      break;
    case "remove-gappy-columns":
      result = removeGappyAlignmentColumns(
        document,
        request.minimumGapFraction,
      );
      break;
    case "remove-alignment-rows":
      result = removeAlignmentRows(
        document,
        request.rowIds.map(
          (selector) => resolveAlignmentRow(document, selector).id,
        ),
      );
      break;
    case "reorder-alignment-rows":
      result = reorderAlignmentRows(
        document,
        request.rowIds.map(
          (selector) => resolveAlignmentRow(document, selector).id,
        ),
      );
      break;
    case "sort-alignment-rows":
      if (request.mode === "tree" && tree == null) {
        throw new Error(
          "Compute a guide tree before sorting rows by tree order.",
        );
      }
      result = sortAlignmentRows(
        document,
        request.mode,
        request.referenceRowId == null
          ? undefined
          : resolveAlignmentRow(document, request.referenceRowId).id,
        tree?.rowOrder,
      );
      break;
    default:
      throw new Error(
        `${request.operation} is available only while the viewer is in Sequence mode.`,
      );
  }
  return {
    description: result.change.description,
    document: result.document,
    operation: result.change.operation,
  };
}

export function realignRows({
  algorithm,
  document,
  rowIds,
}: {
  algorithm?: AlignmentEngine;
  document: MsaDocument;
  rowIds?: Array<string>;
}): {
  document: MsaDocument;
  engine: string;
  parameters: Record<string, unknown>;
  warning: string;
} {
  const rows = resolveRows(document, rowIds);
  if (rows.length < 2)
    throw new Error("Realignment requires at least two rows.");
  const result = alignSequences(
    rows.map((row) => ({
      description: row.description,
      id: row.id,
      label: row.label,
      metadata: row.metadata,
      sequence: row.alignedSequence.replaceAll(/[-.]/gu, ""),
      sourceCoordinates: row.sourceCoordinates,
      sourceId: row.sourceId,
    })),
    undefined,
    algorithm,
  );
  const symbolCount = result.rows.length * result.alignedLength;
  const gapCount = result.rows.reduce(
    (sum, row) =>
      sum + [...row.alignedSequence].filter((symbol) => symbol === "-").length,
    0,
  );
  return {
    document: {
      ...document,
      alignedLength: result.alignedLength,
      annotations: [],
      insertions: [],
      rawSummary: {
        ...document.rawSummary,
        gapFraction: symbolCount === 0 ? 0 : gapCount / symbolCount,
        maxLabelLength: Math.max(
          ...result.rows.map(({ label }) => label.length),
        ),
        sequenceCount: result.rows.length,
        structureTrackCount: 0,
        visibleSequenceCount: result.rows.length,
      },
      rnaStructure: null,
      rows: result.rows,
      warnings: [
        ...document.warnings,
        {
          code: "realigned-copy",
          message: `${result.warning} The source alignment was not overwritten. Parsed annotation and RNA-structure tracks were removed because their columns no longer map exactly.`,
          preserved: "ignored",
          severity: "warning",
        },
      ],
    },
    engine: result.engine,
    parameters: result.parameters,
    warning: result.warning,
  };
}

export function resolveAlignmentRow(
  document: MsaDocument,
  selector: string,
): MsaSequenceRow {
  const resolution = resolveViewerTarget({
    aliases: (row) => [row.label, row.sourceId, row.description],
    id: (row) => row.id,
    selector,
    targets: document.rows,
  });
  if (resolution.status !== "resolved" || resolution.target == null) {
    throw new Error(
      resolution.status === "ambiguous"
        ? `More than one alignment row matched ${selector}: ${resolution.candidates.map(({ id }) => id).join(", ")}.`
        : `No alignment row matched ${selector}.`,
    );
  }
  return resolution.target;
}

function resolveRows(
  document: MsaDocument,
  selectors?: Array<string>,
): Array<MsaSequenceRow> {
  return selectors == null
    ? document.rows.filter(({ hidden }) => !hidden)
    : selectors.map((selector) => resolveAlignmentRow(document, selector));
}
