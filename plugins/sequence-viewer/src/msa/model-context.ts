import { formatContextLines, type ModelContextUpdate } from "../model-context";
import { SEQUENCE_VIEWER_MODEL_CONTEXT_SCHEMA_VERSION } from "../runtime-contract";
import type { MsaDerivedAnalysis } from "./analysis";
import { ALIGNMENT_ROW_GROUP_METADATA_KEY } from "./alignment-editing";
import type { FocusedMsaCell } from "./cell-hover-overlay";
import {
  getCompatibleResiduePalettes,
  getDefaultResiduePalette,
  type MsaColorMode,
  type MsaResiduePalette,
} from "./colors";
import type { MsaColumnSummary } from "./conservation";
import {
  getUngappedPosition,
  getUngappedPositionFromProjection,
} from "./coordinate-map";
import { classifyResidue, isGapSymbol } from "./residue-alphabet";
import type { MsaMotifSearchHit } from "./search";
import type {
  MsaAnalysisScope,
  MsaColumnRange,
  MsaDocument,
  MsaMetricTrackKey,
  MsaRowSortDirection,
  MsaRowSortKey,
  MsaSearchScope,
  MsaSequenceRow,
} from "./types";
import type { MsaViewportSlice } from "./virtualization";
import type { WorkbenchArtifact, WorkbenchJob } from "../workbench-state";
import type { SequenceTrack } from "../sequence/tracks";
import type { GuideTreeResult } from "./phylogenetic-tree";

type MsaReferenceMode = "anchor" | "consensus" | "none";

export type MsaViewerModelContextInput = {
  analysis: MsaDerivedAnalysis | null;
  analysisScope: MsaAnalysisScope;
  artifacts?: Array<WorkbenchArtifact>;
  availableMetricTracks?: Array<MsaMetricTrackKey>;
  anchorRowId: string | null;
  cellWidth: number;
  colorMode: MsaColorMode;
  document: MsaDocument;
  dirty?: boolean;
  enabledMetricTracks?: Array<MsaMetricTrackKey>;
  filePath?: string;
  focusedCell: FocusedMsaCell;
  guideTreeNewick?: string | null;
  jobs?: Array<WorkbenchJob>;
  motifHits: Array<MsaMotifSearchHit>;
  motifQuery: string;
  searchPending?: boolean;
  searchTruncated?: boolean;
  referenceLabel: string;
  referenceMode: MsaReferenceMode;
  residuePalette: MsaResiduePalette | null;
  rowFilter: string;
  rowSortDirection?: MsaRowSortDirection;
  rowSortKey?: MsaRowSortKey;
  searchScope: MsaSearchScope;
  selectedColumnRange: MsaColumnRange | null;
  selectedRowIds?: Array<string>;
  selectedHit: MsaMotifSearchHit | null;
  showAnnotationTracks: boolean;
  showIdenticalAsDots: boolean;
  showRnaStructureOverlays: boolean;
  showSequenceLogoHelp?: boolean;
  slice: MsaViewportSlice;
  sourceStateKey?: string;
  tracks?: Array<SequenceTrack>;
  tree?: GuideTreeResult | null;
  visibleRows: Array<MsaSequenceRow>;
  viewerSessionId?: string;
};

export function createMsaViewerModelContext({
  analysis,
  analysisScope,
  artifacts = [],
  availableMetricTracks = [],
  anchorRowId,
  cellWidth,
  colorMode,
  document,
  dirty = false,
  enabledMetricTracks = [],
  filePath,
  focusedCell,
  guideTreeNewick,
  jobs = [],
  motifHits,
  motifQuery,
  searchPending = false,
  searchTruncated = false,
  referenceLabel,
  referenceMode,
  residuePalette,
  rowFilter,
  rowSortDirection = "asc",
  rowSortKey = "source",
  searchScope,
  selectedColumnRange,
  selectedRowIds = [],
  selectedHit,
  showAnnotationTracks,
  showIdenticalAsDots,
  showRnaStructureOverlays,
  showSequenceLogoHelp = false,
  slice,
  sourceStateKey,
  tracks = [],
  tree = null,
  visibleRows,
  viewerSessionId,
}: MsaViewerModelContextInput): ModelContextUpdate {
  const allUnhiddenRows = document.rows.filter((row) => !row.hidden);
  const hiddenRows = document.rows.filter((row) => row.hidden);
  const contextRows = (
    allUnhiddenRows.length <= MAX_CONTEXT_ROWS ? allUnhiddenRows : visibleRows
  ).slice(0, MAX_CONTEXT_ROWS);
  const projectionByRowId = new Map(
    (analysis?.projections ?? []).map((projection) => [
      projection.rowId,
      projection,
    ]),
  );
  const anchorRow =
    referenceMode === "anchor"
      ? (document.rows.find((row) => row.id === anchorRowId) ?? null)
      : null;
  const selectedColumns =
    selectedColumnRange == null
      ? []
      : Array.from(
          {
            length: Math.min(
              MAX_CONTEXT_COLUMN_DETAILS,
              selectedColumnRange.end - selectedColumnRange.start,
            ),
          },
          (_, index) =>
            serializeAlignmentColumn({
              analysis,
              column: selectedColumnRange.start + index,
              document,
              projectionByRowId,
              rows: contextRows,
            }),
        );
  const focusedCellContext =
    focusedCell == null
      ? null
      : serializeFocusedCell({
          focusedCell,
          moleculeType: document.displayInterpretation.moleculeType,
          projectionByRowId,
        });
  const selectionContext =
    selectedColumnRange == null
      ? null
      : {
          columns: selectedColumns,
          end: selectedColumnRange.end,
          length: selectedColumnRange.end - selectedColumnRange.start,
          rowScope:
            contextRows.length === allUnhiddenRows.length
              ? "all-unhidden-rows"
              : "visible-rows",
          start: selectedColumnRange.start + 1,
          truncatedColumnCount: Math.max(
            0,
            selectedColumnRange.end -
              selectedColumnRange.start -
              selectedColumns.length,
          ),
          truncatedRowCount: Math.max(
            0,
            allUnhiddenRows.length - contextRows.length,
          ),
        };
  const referenceContext =
    anchorRow == null
      ? {
          label: referenceMode === "none" ? null : referenceLabel,
          mode: referenceMode,
          rowId: null,
          coordinateIntervals: [],
        }
      : {
          label: anchorRow.label,
          mode: referenceMode,
          rowId: anchorRow.id,
          ...buildReferenceCoordinateIntervals(anchorRow),
        };
  const coordinateMapRows =
    contextRows.length <= MAX_CONTEXT_COORDINATE_ROWS
      ? contextRows
      : uniqueRows(
          [
            anchorRow,
            focusedCell?.row ?? null,
            ...selectedColumns.flatMap((column) =>
              Array.isArray(column.rows)
                ? column.rows.flatMap((row) => {
                    const rowId =
                      typeof row.rowId === "string" ? row.rowId : null;
                    return rowId == null
                      ? []
                      : [
                          contextRows.find(
                            (contextRow) => contextRow.id === rowId,
                          ) ?? null,
                        ];
                  })
                : [],
            ),
          ].filter((row): row is MsaSequenceRow => row != null),
        );
  const activeTarget =
    selectedColumnRange != null
      ? {
          endColumn: selectedColumnRange.end,
          kind: "alignment-columns",
          length: selectedColumnRange.end - selectedColumnRange.start,
          rowIds: selectedRowIds,
          startColumn: selectedColumnRange.start + 1,
        }
      : selectedRowIds.length > 0
        ? { kind: "alignment-rows", rowIds: selectedRowIds }
        : {
            kind: "alignment",
            referenceMode,
            rowCount: document.rows.length,
          };
  const focusedRowIsSelected =
    focusedCell?.row.id != null && selectedRowIds.includes(focusedCell.row.id);
  const focusDiffersFromActiveTarget =
    focusedCellContext != null &&
    (selectedColumnRange != null
      ? Number(focusedCellContext.alignmentColumn ?? 0) <
          selectedColumnRange.start + 1 ||
        Number(focusedCellContext.alignmentColumn ?? 0) >
          selectedColumnRange.end ||
        (selectedRowIds.length > 0 && !focusedRowIsSelected)
      : selectedRowIds.length > 0 && !focusedRowIsSelected);
  const rowGroups = Object.entries(
    document.rows.reduce<Record<string, number>>((groups, row) => {
      const group = row.metadata?.[ALIGNMENT_ROW_GROUP_METADATA_KEY]?.trim();
      if (group != null && group.length > 0)
        groups[group] = (groups[group] ?? 0) + 1;
      return groups;
    }, {}),
  )
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([name, rowCount]) => ({ name, rowCount }));

  return {
    structuredContent: {
      schemaVersion: SEQUENCE_VIEWER_MODEL_CONTEXT_SCHEMA_VERSION,
      activeTarget,
      analysis:
        analysis == null
          ? null
          : {
              analysisId: analysis.analysisId,
              meanConservationNormalized: analysis.meanConservationNormalized,
              meanIdentity: analysis.meanIdentity,
            },
      artifact: {
        alignedLength: document.alignedLength,
        filePath: filePath ?? null,
        format: document.format,
        moleculeType: document.displayInterpretation.moleculeType,
        rowCount: document.rows.length,
        sourceStateKey: sourceStateKey ?? null,
      },
      coordinateSystem: {
        alignmentColumns: { basis: 1, end: "inclusive" },
        rowCoordinates: { basis: 1, gaps: "excluded" },
        space: "alignment",
      },
      display: {
        analysisScope,
        availableMetricTracks,
        cellWidth,
        colorMode,
        compatibleResiduePalettes: getCompatibleResiduePalettes(
          document.displayInterpretation.moleculeType,
        ),
        defaultResiduePalette: getDefaultResiduePalette(
          document.displayInterpretation.moleculeType,
        ),
        enabledMetricTracks,
        hiddenRowCount: hiddenRows.length,
        hiddenRowIds: hiddenRows.slice(0, MAX_CONTEXT_ROWS).map(({ id }) => id),
        hiddenRowIdsTruncated: hiddenRows.length > MAX_CONTEXT_ROWS,
        referenceLabel: referenceMode === "none" ? null : referenceLabel,
        referenceMode,
        residuePalette,
        rowFilter: rowFilter.trim(),
        rowSortDirection,
        rowSortKey,
        rowSortScope: "row-manager",
        rowGroups: rowGroups.slice(0, 50),
        rowGroupsTruncated: rowGroups.length > 50,
        searchScope,
        showAnnotationTracks,
        showIdenticalAsDots,
        showRnaStructureOverlays,
        showSequenceLogoHelp,
        visibleColumnRange: {
          end: Math.max(slice.visibleColumnStart + 1, slice.visibleColumnEnd),
          start: slice.visibleColumnStart + 1,
        },
        visibleRowCount: visibleRows.length,
        visibleRowIds: visibleRows
          .slice(0, MAX_CONTEXT_ROWS)
          .map(({ id }) => id),
        visibleRowIdsTruncated: visibleRows.length > MAX_CONTEXT_ROWS,
      },
      focus: focusedCellContext,
      transientFocus: focusedCellContext,
      guideTree:
        guideTreeNewick == null && tree == null
          ? null
          : {
              method: tree?.algorithm ?? "upgma",
              newick: tree?.newick ?? guideTreeNewick,
              provenance:
                "Uncorrected alignment p-distance; all-gap columns ignored.",
              rowOrder: tree?.rowOrder ?? [],
            },
      reference: referenceContext,
      rowCoordinateMaps: coordinateMapRows
        .slice(0, MAX_CONTEXT_COORDINATE_ROWS)
        .map((row) => ({
          rowId: row.id,
          rowLabel: row.label,
          ...buildReferenceCoordinateIntervals(row),
        })),
      search: {
        hitCount: motifHits.length,
        pending: searchPending,
        query: motifQuery.trim(),
        truncated: searchTruncated,
        selectedHit:
          selectedHit == null
            ? null
            : {
                alignmentEndColumn: selectedHit.alignmentEndColumn + 1,
                alignmentStartColumn: selectedHit.alignmentStartColumn + 1,
                orientation: selectedHit.orientation,
                rowId: selectedHit.rowId,
                rowLabel: selectedHit.rowLabel,
                ungappedEndPosition: selectedHit.ungappedEndPosition,
                ungappedStartPosition: selectedHit.ungappedStartPosition,
              },
      },
      selection: selectionContext,
      selectedRows: {
        ids: selectedRowIds.slice(0, MAX_CONTEXT_ROWS),
        totalCount: selectedRowIds.length,
        truncated: selectedRowIds.length > MAX_CONTEXT_ROWS,
      },
      workbench: {
        actionHints: [
          "Use sequence.query_viewer for paginated rows, columns, metrics, tree nodes, jobs, and artifacts.",
          "Treat activeTarget as the user's primary target. Mention transientFocus separately only when both are populated and refer to different rows or columns.",
          "Use sequence.align, sequence.run_analysis, sequence.edit_copy, and sequence.export_artifact for reproducible work on this mounted session.",
        ],
        artifactCount: artifacts.length,
        artifacts: artifacts
          .slice(-10)
          .map(({ content: _content, ...artifact }) => artifact),
        capabilities: [
          "alignment-editing",
          "alignment-generation",
          "alignment-row-grouping",
          "distance-matrix",
          "editable-copy",
          "export",
          "graphical-guide-tree",
          "motif-search",
          "session-restore",
          "tree-synchronized-row-selection",
          "undo-redo",
        ],
        dirty,
        jobs: jobs.slice(-20),
        trackCount: tracks.length,
      },
      viewer: "alignment",
      viewerSessionId: viewerSessionId ?? null,
    },
    text: formatContextLines([
      "Current scientific viewer: Alignment viewer",
      `Artifact: ${filePath ?? "biological sequence alignment"} (${document.format})`,
      `Alignment: ${document.displayInterpretation.moleculeType} · ${document.rows.length.toLocaleString()} rows × ${document.alignedLength.toLocaleString()} columns`,
      `Displayed: ${visibleRows.length.toLocaleString()} visible rows; alignment columns ${formatOneBasedRange(slice.visibleColumnStart, slice.visibleColumnEnd)}`,
      `View state: row filter ${rowFilter.trim().length === 0 ? "none" : `"${rowFilter.trim()}"`}; ${hiddenRows.length.toLocaleString()} hidden rows; cell width ${cellWidth}px`,
      `Analysis scope: ${analysisScope}; search scope: ${searchScope}`,
      `Reference: ${referenceMode === "none" ? "none" : `${referenceMode} (${referenceLabel})`}`,
      anchorRow == null
        ? null
        : `Reference coordinate map: ${anchorRow.label} has ${anchorRow.ungappedLength.toLocaleString()} ungapped residues mapped to alignment columns`,
      `Color: ${colorMode}${residuePalette == null ? "" : ` / ${residuePalette}`}`,
      `Tracks: annotations ${showAnnotationTracks ? "on" : "off"}; identical-as-dots ${showIdenticalAsDots ? "on" : "off"}; RNA structure ${showRnaStructureOverlays ? "on" : "off"}`,
      availableMetricTracks.length === 0
        ? null
        : `Metric tracks: ${enabledMetricTracks.length === 0 ? "none" : enabledMetricTracks.join(", ")}; sequence-logo help ${showSequenceLogoHelp ? "open" : "closed"}`,
      `Row manager order: ${rowSortKey}, ${rowSortDirection}; matrix row order is unchanged by this control`,
      analysis == null
        ? "Analysis: pending"
        : `Analysis: mean identity ${Math.round(analysis.meanIdentity * 100)}%${analysis.meanConservationNormalized == null ? "" : `; normalized conservation ${Math.round(analysis.meanConservationNormalized * 100)}%`}`,
      selectedColumnRange == null
        ? "Selection: none"
        : `Selection: alignment columns ${formatOneBasedRange(selectedColumnRange.start, selectedColumnRange.end)} (${(selectedColumnRange.end - selectedColumnRange.start).toLocaleString()} columns)`,
      formatSelectedColumnSummary(selectionContext),
      focusedCellContext == null
        ? null
        : formatFocusedCellSummary(focusedCellContext),
      focusedCellContext == null || !focusDiffersFromActiveTarget
        ? null
        : "Transient focus differs from the active target; answer for the active target first and distinguish the focused cell only when relevant.",
      formatSearchSummary({
        motifHits,
        motifQuery,
        pending: searchPending,
        selectedHit,
        truncated: searchTruncated,
      }),
    ]),
  };
}

export function formatMsaViewerModelContext(
  input: MsaViewerModelContextInput,
): string {
  return createMsaViewerModelContext(input).text;
}

function formatOneBasedRange(start: number, endExclusive: number): string {
  return `${(start + 1).toLocaleString()}-${Math.max(start + 1, endExclusive).toLocaleString()}`;
}

function formatSearchSummary({
  motifHits,
  motifQuery,
  pending,
  selectedHit,
  truncated,
}: {
  motifHits: Array<MsaMotifSearchHit>;
  motifQuery: string;
  pending: boolean;
  selectedHit: MsaMotifSearchHit | null;
  truncated: boolean;
}): string {
  const normalizedQuery = motifQuery.trim();
  if (normalizedQuery.length === 0) {
    return "Search: none";
  }
  if (pending) return `Search: "${normalizedQuery}" · searching`;
  if (selectedHit == null) {
    return `Search: "${normalizedQuery}" · ${motifHits.length.toLocaleString()}${truncated ? "+ bounded" : ""} hit${motifHits.length === 1 ? "" : "s"}`;
  }
  return `Search: "${normalizedQuery}" · ${motifHits.length.toLocaleString()}${truncated ? "+ bounded" : ""} hit${motifHits.length === 1 ? "" : "s"} · active ${selectedHit.rowLabel} columns ${formatOneBasedRange(selectedHit.alignmentStartColumn, selectedHit.alignmentEndColumn + 1)} (${selectedHit.orientation})`;
}

const MAX_CONTEXT_COLUMN_DETAILS = 12;
const MAX_CONTEXT_COORDINATE_ROWS = 12;
const MAX_CONTEXT_ROWS = 50;
const MAX_REFERENCE_INTERVALS = 128;
const MAX_REFERENCE_SCAN_COLUMNS = 250_000;
const MAX_TEXT_COLUMN_ROWS = 12;

function serializeAlignmentColumn({
  analysis,
  column,
  document,
  projectionByRowId,
  rows,
}: {
  analysis: MsaDerivedAnalysis | null;
  column: number;
  document: MsaDocument;
  projectionByRowId: Map<string, MsaDerivedAnalysis["projections"][number]>;
  rows: Array<MsaSequenceRow>;
}): Record<string, unknown> {
  const summary = analysis?.summaries[column] ?? null;
  return {
    alignmentColumn: column + 1,
    consensusSymbol: analysis?.consensusSequence[column] ?? null,
    conservation: serializeColumnSummary(summary, rows.length),
    rows: rows.map((row) =>
      serializeColumnRow({
        column,
        document,
        projectionByRowId,
        row,
      }),
    ),
  };
}

function serializeColumnSummary(
  summary: MsaColumnSummary | null,
  rowCount: number,
): Record<string, unknown> | null {
  if (summary == null) {
    return null;
  }
  return {
    conservationModel: summary.conservationModel,
    conservationNormalized: summary.conservationNormalized,
    gapCount: Math.max(0, rowCount - summary.nongapCount),
    gapFraction: summary.gapFraction,
    identity: summary.identity,
    nongapCount: summary.nongapCount,
    nucleotideInformationContentBits: summary.nucleotideInformationContentBits,
    proteinRelativeEntropyBits: summary.proteinRelativeEntropyBits,
    symbolCounts: summary.symbolCounts,
    topSymbols: Object.entries(summary.symbolCounts)
      .sort(([, leftCount], [, rightCount]) => rightCount - leftCount)
      .slice(0, 5)
      .map(([symbol, count]) => ({ count, symbol })),
  };
}

function serializeColumnRow({
  column,
  document,
  projectionByRowId,
  row,
}: {
  column: number;
  document: MsaDocument;
  projectionByRowId: Map<string, MsaDerivedAnalysis["projections"][number]>;
  row: MsaSequenceRow;
}): Record<string, unknown> {
  const symbol = row.alignedSequence[column] ?? "-";
  return {
    residueClass: classifyResidue(
      symbol,
      document.displayInterpretation.moleculeType,
    ),
    rowId: row.id,
    rowLabel: row.label,
    symbol,
    ungappedPosition:
      getUngappedPositionFromProjection(
        projectionByRowId.get(row.id),
        column,
      ) ?? getUngappedPosition(row.alignedSequence, column),
  };
}

function serializeFocusedCell({
  focusedCell,
  moleculeType,
  projectionByRowId,
}: {
  focusedCell: NonNullable<FocusedMsaCell>;
  moleculeType: MsaDocument["displayInterpretation"]["moleculeType"];
  projectionByRowId: Map<string, MsaDerivedAnalysis["projections"][number]>;
}): Record<string, unknown> {
  return {
    alignmentColumn: focusedCell.column + 1,
    residueClass: classifyResidue(focusedCell.symbol, moleculeType),
    rowId: focusedCell.row.id,
    rowLabel: focusedCell.row.label,
    symbol: focusedCell.symbol,
    ungappedPosition:
      getUngappedPositionFromProjection(
        projectionByRowId.get(focusedCell.row.id),
        focusedCell.column,
      ) ??
      getUngappedPosition(focusedCell.row.alignedSequence, focusedCell.column),
  };
}

function buildReferenceCoordinateIntervals(
  row: MsaSequenceRow,
): Record<string, unknown> {
  const intervals: Array<{
    alignmentEndColumn: number;
    alignmentStartColumn: number;
    ungappedEndPosition: number;
    ungappedStartPosition: number;
  }> = [];
  let ungappedPosition = 0;
  const scannedColumnCount = Math.min(
    row.alignedSequence.length,
    MAX_REFERENCE_SCAN_COLUMNS,
  );
  for (let column = 0; column < scannedColumnCount; column += 1) {
    if (isGapSymbol(row.alignedSequence[column] ?? "-")) continue;
    ungappedPosition += 1;
    const previous = intervals.at(-1);
    if (
      previous != null &&
      previous.alignmentEndColumn === column &&
      previous.ungappedEndPosition === ungappedPosition - 1
    ) {
      previous.alignmentEndColumn = column + 1;
      previous.ungappedEndPosition = ungappedPosition;
    } else {
      intervals.push({
        alignmentEndColumn: column + 1,
        alignmentStartColumn: column + 1,
        ungappedEndPosition: ungappedPosition,
        ungappedStartPosition: ungappedPosition,
      });
    }
  }
  return {
    coordinateIntervals: intervals.slice(0, MAX_REFERENCE_INTERVALS),
    coordinateIntervalsTruncated:
      intervals.length > MAX_REFERENCE_INTERVALS ||
      scannedColumnCount < row.alignedSequence.length,
    scannedColumnCount,
    totalIntervalCount:
      scannedColumnCount === row.alignedSequence.length
        ? intervals.length
        : null,
    totalIntervalCountAtLeast: intervals.length,
    totalUngappedResidues: row.ungappedLength,
  };
}

function formatSelectedColumnSummary(
  selection: {
    columns: Array<Record<string, unknown>>;
    truncatedColumnCount: number;
  } | null,
): string | null {
  if (selection == null || selection.columns.length === 0) {
    return null;
  }
  const formattedColumns = selection.columns
    .map((column) => formatAlignmentColumnSummary(column))
    .join("; ");
  return `Selected column details: ${formattedColumns}${selection.truncatedColumnCount === 0 ? "" : `; +${selection.truncatedColumnCount.toLocaleString()} more columns in selection`}`;
}

function formatAlignmentColumnSummary(column: Record<string, unknown>): string {
  const alignmentColumn = Number(column.alignmentColumn ?? 0);
  const consensusSymbol =
    typeof column.consensusSymbol === "string" ? column.consensusSymbol : "?";
  const conservation = column.conservation as
    Record<string, unknown> | null | undefined;
  const rows = Array.isArray(column.rows)
    ? column.rows
        .slice(0, MAX_TEXT_COLUMN_ROWS)
        .map((row) => formatAlignmentColumnRow(row as Record<string, unknown>))
        .join(", ")
    : "";
  const rowCount = Array.isArray(column.rows) ? column.rows.length : 0;
  const hiddenRowCount = Math.max(0, rowCount - MAX_TEXT_COLUMN_ROWS);
  return [
    `col ${alignmentColumn.toLocaleString()} consensus ${consensusSymbol}`,
    conservation == null
      ? null
      : `identity ${formatPercent(conservation.identity)}; conservation ${formatPercent(conservation.conservationNormalized)}`,
    rows.length === 0
      ? null
      : `rows ${rows}${hiddenRowCount === 0 ? "" : `, +${hiddenRowCount.toLocaleString()} more`}`,
  ]
    .filter((value): value is string => value != null)
    .join("; ");
}

function formatAlignmentColumnRow(row: Record<string, unknown>): string {
  const rowLabel = typeof row.rowLabel === "string" ? row.rowLabel : "row";
  const symbol = typeof row.symbol === "string" ? row.symbol : "?";
  const ungappedPosition =
    typeof row.ungappedPosition === "number" ? row.ungappedPosition : null;
  return `${rowLabel}=${isGapSymbol(symbol) ? "gap" : symbol}${ungappedPosition == null ? "" : `@${ungappedPosition.toLocaleString()}`}`;
}

function formatPercent(value: unknown): string {
  return typeof value === "number" ? `${Math.round(value * 100)}%` : "n/a";
}

function formatFocusedCellSummary(focus: Record<string, unknown>): string {
  const rowLabel = typeof focus.rowLabel === "string" ? focus.rowLabel : "row";
  const alignmentColumn = Number(focus.alignmentColumn ?? 0);
  const symbol = typeof focus.symbol === "string" ? focus.symbol : "?";
  const ungappedPosition =
    typeof focus.ungappedPosition === "number" ? focus.ungappedPosition : null;
  return `Focus: ${rowLabel} alignment column ${alignmentColumn.toLocaleString()} ${symbol}${ungappedPosition == null ? "" : ` at ungapped position ${ungappedPosition.toLocaleString()}`}`;
}

function uniqueRows(rows: Array<MsaSequenceRow>): Array<MsaSequenceRow> {
  const rowsById = new Map<string, MsaSequenceRow>();
  for (const row of rows) {
    rowsById.set(row.id, row);
  }
  return Array.from(rowsById.values());
}
