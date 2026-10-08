import clsx from "clsx";
import { memo, useMemo, type KeyboardEvent } from "react";
import { FormattedMessage, useIntl } from "react-intl";

import { getSequenceResidueStyle } from "../sequence/sequence-palette";

import type { MsaDerivedAnalysis, MsaRowProjection } from "./analysis";
import { ALIGNMENT_ROW_GROUP_METADATA_KEY } from "./alignment-editing";
import type { FocusedMsaCell, MsaHoverCellDetails } from "./cell-hover-overlay";
import {
  isNonsynonymousCodonDifference,
  translateStandardCodon,
} from "./codon";
import {
  CODING_NONSYNONYMOUS_COLOR,
  CODING_SYNONYMOUS_COLOR,
  DIFFERENCE_MATCH_COLOR,
  DIFFERENCE_MISMATCH_COLOR,
  getMsaCellBackground,
  getMsaCellTextColor,
  isThemeAwareMsaPalette,
  type MsaColorMode,
  type MsaResiduePalette,
} from "./colors";
import type { MsaColumnSummary } from "./conservation";
import {
  getUngappedPosition,
  getUngappedPositionFromProjection,
} from "./coordinate-map";
import { buildHoverCellDetails } from "./hover-details";
import { isGapSymbol } from "./residue-alphabet";
import type { MsaMotifSearchHit } from "./search";
import type {
  MsaAnnotationTrack,
  MsaColumnRange,
  MsaDocument,
  MsaInsertionRun,
  MsaSequenceRow,
} from "./types";
import {
  MSA_ROW_HEIGHT_PX,
  MSA_ROW_LABEL_WIDTH_PX,
  type MsaViewportSlice,
} from "./virtualization";

const MATCH_PLACEHOLDER = "·";
const EMPTY_ANNOTATION_VALUE = " ";

function makeRovingTabStop(target: HTMLElement): void {
  const grid = target.closest('[role="grid"]');
  grid
    ?.querySelectorAll<HTMLElement>('[data-msa-cell="true"]')
    .forEach((cell) => {
      cell.tabIndex = cell === target ? 0 : -1;
    });
}

function moveGridFocus(
  event: KeyboardEvent<HTMLElement>,
  alignedLength: number,
): number | null {
  const row = Number(event.currentTarget.dataset.msaRowIndex);
  const column = Number(event.currentTarget.dataset.msaColumn);
  if (!Number.isInteger(row) || !Number.isInteger(column)) return null;
  let nextRow = row;
  let nextColumn = column;
  if (event.key === "ArrowLeft") nextColumn -= 1;
  else if (event.key === "ArrowRight") nextColumn += 1;
  else if (event.key === "ArrowUp") nextRow -= 1;
  else if (event.key === "ArrowDown") nextRow += 1;
  else if (event.key === "Home") nextColumn = 0;
  else if (event.key === "End") nextColumn = Math.max(0, alignedLength - 1);
  else if (event.key === "PageUp") nextRow -= 10;
  else if (event.key === "PageDown") nextRow += 10;
  else return null;
  const target = event.currentTarget
    .closest('[role="grid"]')
    ?.querySelector<HTMLElement>(
      `[data-msa-row-index="${Math.max(0, nextRow)}"][data-msa-column="${Math.max(0, Math.min(alignedLength - 1, nextColumn))}"]`,
    );
  if (target == null) return null;
  target.focus();
  return nextColumn;
}

type HitRange = {
  end: number;
  selected: boolean;
  start: number;
};

export const MsaMatrixRenderer = memo(function MsaMatrixRenderer({
  analysis,
  cellWidth,
  colorMode,
  columns,
  document,
  motifHits,
  onFocusedCellChange,
  onHoverCellDetailsChange,
  onKeyboardRangeSelection,
  onPinnedCellChange,
  onRangeSelectionExtend,
  onRangeSelectionStart,
  referenceSequence,
  residuePalette,
  rows,
  selectedColumnRange,
  selectedHit,
  showAnnotationTracks,
  showIdenticalAsDots,
  showRnaStructureOverlays,
  slice,
  summaries,
  totalVisibleRows,
}: {
  analysis: MsaDerivedAnalysis | null;
  cellWidth: number;
  colorMode: MsaColorMode;
  columns: Array<number>;
  document: MsaDocument;
  motifHits: Array<MsaMotifSearchHit>;
  onFocusedCellChange: (cell: FocusedMsaCell) => void;
  onHoverCellDetailsChange: (details: MsaHoverCellDetails) => void;
  onKeyboardRangeSelection: (
    anchorColumn: number,
    nextColumn: number,
    extend: boolean,
  ) => void;
  onPinnedCellChange: (cell: FocusedMsaCell) => void;
  onRangeSelectionExtend: (column: number) => void;
  onRangeSelectionStart: (column: number) => void;
  referenceSequence: string | null;
  residuePalette: MsaResiduePalette | null;
  rows: Array<MsaSequenceRow>;
  selectedColumnRange: MsaColumnRange | null;
  selectedHit: MsaMotifSearchHit | null;
  showAnnotationTracks: boolean;
  showIdenticalAsDots: boolean;
  showRnaStructureOverlays: boolean;
  slice: MsaViewportSlice;
  summaries: Array<MsaColumnSummary>;
  totalVisibleRows: number;
}): React.ReactElement {
  const intl = useIntl();
  const referenceLabel = intl.formatMessage({
    id: "codex.filePreview.msa.referenceRow",
    defaultMessage: "Reference",
    description: "Row label for the rendered MSA reference sequence.",
  });
  const projectionByRowId = useMemo(
    () =>
      new Map(
        (analysis?.projections ?? []).map((projection) => [
          projection.rowId,
          projection,
        ]),
      ),
    [analysis?.projections],
  );
  const hitRangesByRow = useMemo(
    () => indexHitRanges(motifHits, selectedHit),
    [motifHits, selectedHit],
  );
  const insertionByRowColumn = useMemo(
    () =>
      analysis?.insertionByRowColumn ?? indexInsertions(document.insertions),
    [analysis?.insertionByRowColumn, document.insertions],
  );
  const topSpacerHeight = slice.rowStart * MSA_ROW_HEIGHT_PX;
  const bottomSpacerHeight =
    Math.max(0, totalVisibleRows - slice.rowEnd) * MSA_ROW_HEIGHT_PX;
  return (
    <div
      aria-label={intl.formatMessage({
        id: "codex.filePreview.msa.viewerAria",
        defaultMessage: "Interactive multiple sequence alignment viewer",
        description:
          "Accessible label for the interactive MSA alignment matrix.",
      })}
      aria-colcount={document.alignedLength}
      aria-rowcount={totalVisibleRows + (referenceSequence == null ? 0 : 1)}
      className="p-3 font-mono text-[11px] leading-5"
      role="grid"
      style={{
        minWidth:
          MSA_ROW_LABEL_WIDTH_PX +
          Math.max(1, document.alignedLength) * cellWidth,
      }}
    >
      <MsaColumnHeader
        cellWidth={cellWidth}
        columns={columns}
        document={document}
        onRangeSelectionExtend={onRangeSelectionExtend}
        onRangeSelectionStart={onRangeSelectionStart}
        selectedColumnRange={selectedColumnRange}
        slice={slice}
      />
      {referenceSequence == null ? null : (
        <MsaGridRow
          analysis={analysis}
          cellWidth={cellWidth}
          colorMode={colorMode}
          columns={columns}
          document={document}
          hitRanges={[]}
          isFirstRenderedRow={false}
          label={referenceLabel}
          insertionByColumn={undefined}
          onFocusedCellChange={onFocusedCellChange}
          onHoverCellDetailsChange={onHoverCellDetailsChange}
          onKeyboardRangeSelection={onKeyboardRangeSelection}
          onPinnedCellChange={onPinnedCellChange}
          onRangeSelectionExtend={onRangeSelectionExtend}
          onRangeSelectionStart={onRangeSelectionStart}
          projection={undefined}
          referenceSequence={referenceSequence}
          residuePalette={residuePalette}
          row={null}
          rowIndex={0}
          selectedColumnRange={selectedColumnRange}
          showIdenticalAsDots={false}
          showRnaStructureOverlays={showRnaStructureOverlays}
          slice={slice}
          summaries={summaries}
          values={referenceSequence}
        />
      )}
      {showAnnotationTracks ? (
        <MsaAnnotationRows
          alignedLength={document.alignedLength}
          cellWidth={cellWidth}
          columns={columns}
          slice={slice}
          tracks={document.annotations}
        />
      ) : null}
      {document.cdsContext.applicability === "eligible" ? (
        <>
          <MsaCodonFrameRow
            alignedLength={document.alignedLength}
            cellWidth={cellWidth}
            columns={columns}
            slice={slice}
          />
          <MsaTranslationRow
            alignedLength={document.alignedLength}
            cellWidth={cellWidth}
            columns={columns}
            residuePalette={residuePalette}
            sequence={
              referenceSequence ?? document.rows[0]?.alignedSequence ?? ""
            }
            slice={slice}
          />
        </>
      ) : null}
      {topSpacerHeight > 0 ? (
        <div aria-hidden="true" style={{ height: topSpacerHeight }} />
      ) : null}
      {rows.map((row, renderedRowIndex) => (
        <MsaGridRow
          analysis={analysis}
          cellWidth={cellWidth}
          colorMode={colorMode}
          columns={columns}
          document={document}
          hitRanges={hitRangesByRow.get(row.id) ?? []}
          isFirstRenderedRow={renderedRowIndex === 0}
          insertionByColumn={insertionByRowColumn[row.id]}
          key={row.id}
          label={formatRowLabel(row)}
          onFocusedCellChange={onFocusedCellChange}
          onHoverCellDetailsChange={onHoverCellDetailsChange}
          onKeyboardRangeSelection={onKeyboardRangeSelection}
          onPinnedCellChange={onPinnedCellChange}
          onRangeSelectionExtend={onRangeSelectionExtend}
          onRangeSelectionStart={onRangeSelectionStart}
          projection={projectionByRowId.get(row.id)}
          referenceSequence={referenceSequence}
          residuePalette={residuePalette}
          row={row}
          rowIndex={
            slice.rowStart +
            renderedRowIndex +
            (referenceSequence == null ? 0 : 1)
          }
          selectedColumnRange={selectedColumnRange}
          showIdenticalAsDots={showIdenticalAsDots}
          showRnaStructureOverlays={showRnaStructureOverlays}
          slice={slice}
          summaries={summaries}
          values={row.alignedSequence}
        />
      ))}
      {bottomSpacerHeight > 0 ? (
        <div aria-hidden="true" style={{ height: bottomSpacerHeight }} />
      ) : null}
    </div>
  );
});

function formatRowLabel(row: MsaSequenceRow): string {
  const group = row.metadata?.[ALIGNMENT_ROW_GROUP_METADATA_KEY]?.trim();
  return group == null || group.length === 0
    ? row.label
    : `${group} · ${row.label}`;
}

function MsaColumnHeader({
  cellWidth,
  columns,
  document,
  onRangeSelectionExtend,
  onRangeSelectionStart,
  selectedColumnRange,
  slice,
}: {
  cellWidth: number;
  columns: Array<number>;
  document: MsaDocument;
  onRangeSelectionExtend: (column: number) => void;
  onRangeSelectionStart: (column: number) => void;
  selectedColumnRange: MsaColumnRange | null;
  slice: MsaViewportSlice;
}): React.ReactElement {
  const intl = useIntl();
  return (
    <div
      className="sticky top-0 z-20 flex bg-token-main-surface-primary pb-1"
      role="row"
    >
      <div
        className="sticky left-0 z-30 shrink-0 bg-token-main-surface-primary pr-2 text-right text-token-text-tertiary"
        role="columnheader"
        style={{ width: MSA_ROW_LABEL_WIDTH_PX }}
      >
        <FormattedMessage
          id="codex.filePreview.msa.columnHeader"
          defaultMessage="Column"
          description="Header label for MSA alignment columns."
        />
      </div>
      <HorizontalSpacer width={slice.columnStart * cellWidth} />
      {columns.map((column) => (
        <button
          aria-colindex={column + 1}
          aria-label={intl.formatMessage(
            {
              id: "codex.filePreview.msa.selectColumnRange",
              defaultMessage:
                "Start or extend an MSA column selection at column {column}",
              description:
                "Accessible label for a draggable MSA column ruler cell.",
            },
            { column: column + 1 },
          )}
          className={clsx(
            "inline-flex shrink-0 cursor-col-resize justify-center text-token-text-tertiary",
            isColumnWithinRange(selectedColumnRange, column) &&
              "bg-sky-400/20 text-token-text-primary",
          )}
          key={column}
          onPointerDown={() => onRangeSelectionStart(column)}
          onPointerEnter={() => onRangeSelectionExtend(column)}
          role="columnheader"
          style={{ width: cellWidth }}
          type="button"
        >
          {(column + 1) % 10 === 0 ? column + 1 : MATCH_PLACEHOLDER}
        </button>
      ))}
      <HorizontalSpacer
        width={
          Math.max(0, document.alignedLength - slice.columnEnd) * cellWidth
        }
      />
    </div>
  );
}

function MsaAnnotationRows({
  alignedLength,
  cellWidth,
  columns,
  slice,
  tracks,
}: {
  alignedLength: number;
  cellWidth: number;
  columns: Array<number>;
  slice: MsaViewportSlice;
  tracks: Array<MsaAnnotationTrack>;
}): React.ReactElement | null {
  if (tracks.length === 0) {
    return null;
  }
  return (
    <>
      {tracks.map((track) => (
        <div className="flex text-token-text-tertiary" key={track.id}>
          <div
            className="sticky left-0 z-10 shrink-0 truncate bg-token-main-surface-primary pr-2 text-right"
            style={{ width: MSA_ROW_LABEL_WIDTH_PX }}
            title={track.label}
          >
            {track.label}
          </div>
          <HorizontalSpacer width={slice.columnStart * cellWidth} />
          {columns.map((column) => (
            <span
              className={clsx(
                "inline-flex shrink-0 justify-center",
                track.kind === "rna-secondary-structure" &&
                  "font-semibold text-purple-700",
              )}
              key={`${track.id}:${column}`}
              style={{ width: cellWidth }}
            >
              {track.values[column] ?? EMPTY_ANNOTATION_VALUE}
            </span>
          ))}
          <HorizontalSpacer
            width={Math.max(0, alignedLength - slice.columnEnd) * cellWidth}
          />
        </div>
      ))}
    </>
  );
}

function MsaCodonFrameRow({
  alignedLength,
  cellWidth,
  columns,
  slice,
}: {
  alignedLength: number;
  cellWidth: number;
  columns: Array<number>;
  slice: MsaViewportSlice;
}): React.ReactElement {
  return (
    <div className="flex text-emerald-700">
      <div
        className="sticky left-0 z-10 shrink-0 bg-token-main-surface-primary pr-2 text-right"
        style={{ width: MSA_ROW_LABEL_WIDTH_PX }}
      >
        <FormattedMessage
          id="codex.filePreview.msa.codonFrame"
          defaultMessage="Codon frame"
          description="Label for the codon-reading-frame helper row in eligible nucleotide MSAs."
        />
      </div>
      <HorizontalSpacer width={slice.columnStart * cellWidth} />
      {columns.map((column) => (
        <span
          className="inline-flex shrink-0 justify-center"
          key={column}
          style={{ width: cellWidth }}
        >
          {String((column % 3) + 1)}
        </span>
      ))}
      <HorizontalSpacer
        width={Math.max(0, alignedLength - slice.columnEnd) * cellWidth}
      />
    </div>
  );
}

function MsaTranslationRow({
  alignedLength,
  cellWidth,
  columns,
  residuePalette,
  sequence,
  slice,
}: {
  alignedLength: number;
  cellWidth: number;
  columns: Array<number>;
  residuePalette: MsaResiduePalette | null;
  sequence: string;
  slice: MsaViewportSlice;
}): React.ReactElement {
  const intl = useIntl();
  const useThemePalette = isThemeAwareMsaPalette(residuePalette);
  return (
    <div
      className={clsx(
        "flex",
        useThemePalette ? "text-token-text-secondary" : "text-sky-700",
      )}
      title={
        useThemePalette && residuePalette !== "neutral"
          ? intl.formatMessage({
              id: "codex.filePreview.msa.translationPaletteDescription",
              defaultMessage:
                "Translation colors show amino-acid groups, not substitution impact or conservation.",
              description:
                "Clarifies the residue-class colors used by the translation helper row.",
            })
          : undefined
      }
    >
      <div
        className="sticky left-0 z-10 shrink-0 bg-token-main-surface-primary pr-2 text-right"
        style={{ width: MSA_ROW_LABEL_WIDTH_PX }}
      >
        <FormattedMessage
          id="codex.filePreview.msa.translationTrack"
          defaultMessage="AA translation"
          description="Label for the amino-acid translation track in eligible coding DNA MSAs."
        />
      </div>
      <HorizontalSpacer width={slice.columnStart * cellWidth} />
      {columns.map((column) => {
        const codonStart = column - (column % 3);
        const residue =
          column % 3 === 1
            ? (translateStandardCodon(
                sequence.slice(codonStart, codonStart + 3),
              ) ?? "·")
            : " ";
        return (
          <span
            className="inline-flex shrink-0 justify-center font-semibold"
            key={column}
            style={{
              ...(useThemePalette && residue.trim() !== ""
                ? getSequenceResidueStyle({
                    molecule: "protein",
                    paletteId:
                      residuePalette === "neutral"
                        ? "neutral"
                        : "muted-amino-acid",
                    residue,
                  })
                : {}),
              width: cellWidth,
            }}
          >
            {residue}
          </span>
        );
      })}
      <HorizontalSpacer
        width={Math.max(0, alignedLength - slice.columnEnd) * cellWidth}
      />
    </div>
  );
}

const MsaGridRow = memo(function MsaGridRow({
  analysis,
  cellWidth,
  colorMode,
  columns,
  document,
  hitRanges,
  isFirstRenderedRow,
  insertionByColumn,
  label,
  onFocusedCellChange,
  onHoverCellDetailsChange,
  onKeyboardRangeSelection,
  onPinnedCellChange,
  onRangeSelectionExtend,
  onRangeSelectionStart,
  projection,
  referenceSequence,
  residuePalette,
  row,
  rowIndex,
  selectedColumnRange,
  showIdenticalAsDots,
  showRnaStructureOverlays,
  slice,
  summaries,
  values,
}: {
  analysis: MsaDerivedAnalysis | null;
  cellWidth: number;
  colorMode: MsaColorMode;
  columns: Array<number>;
  document: MsaDocument;
  hitRanges: Array<HitRange>;
  isFirstRenderedRow: boolean;
  insertionByColumn: Record<string, MsaInsertionRun | undefined> | undefined;
  label: string;
  onFocusedCellChange: (cell: FocusedMsaCell) => void;
  onHoverCellDetailsChange: (details: MsaHoverCellDetails) => void;
  onKeyboardRangeSelection: (
    anchorColumn: number,
    nextColumn: number,
    extend: boolean,
  ) => void;
  onPinnedCellChange: (cell: FocusedMsaCell) => void;
  onRangeSelectionExtend: (column: number) => void;
  onRangeSelectionStart: (column: number) => void;
  projection: MsaRowProjection | undefined;
  referenceSequence: string | null;
  residuePalette: MsaResiduePalette | null;
  row: MsaSequenceRow | null;
  rowIndex: number | undefined;
  selectedColumnRange: MsaColumnRange | null;
  showIdenticalAsDots: boolean;
  showRnaStructureOverlays: boolean;
  slice: MsaViewportSlice;
  summaries: Array<MsaColumnSummary>;
  values: string;
}): React.ReactElement {
  const intl = useIntl();
  return (
    <div
      aria-rowindex={rowIndex == null ? undefined : rowIndex + 1}
      className="group flex"
      role="row"
    >
      <div
        className="sticky left-0 z-10 shrink-0 truncate bg-token-main-surface-primary pr-2 text-right text-token-text-secondary"
        style={{ width: MSA_ROW_LABEL_WIDTH_PX }}
        title={label}
      >
        {label}
      </div>
      <HorizontalSpacer width={slice.columnStart * cellWidth} />
      {columns.map((column) => {
        const symbol = values[column] ?? "-";
        const referenceSymbol = referenceSequence?.[column];
        const isReferenceMatch =
          showIdenticalAsDots &&
          referenceSymbol != null &&
          symbol.toUpperCase() === referenceSymbol.toUpperCase();
        const hitState = getHitState(hitRanges, column);
        const insertion = insertionByColumn?.[String(column)];
        const rnaPair = analysis?.pairByColumn[String(column)];
        const isSelectedColumn = isColumnWithinRange(
          selectedColumnRange,
          column,
        );
        const backgroundColor =
          colorMode === "coding-impact"
            ? getCodingImpactBackground({
                column,
                referenceSequence,
                rowSequence: values,
                symbol,
              })
            : getMatrixCellBackground({
                colorMode,
                column,
                document,
                referenceSymbol,
                residuePalette,
                summaries,
                symbol,
              });
        const textColor = getMsaCellTextColor({
          backgroundColor,
          mode: colorMode,
          moleculeType: document.displayInterpretation.moleculeType,
          palette: residuePalette,
          symbol,
        });
        return (
          <button
            aria-label={intl.formatMessage(
              {
                id: "codex.filePreview.msa.cellAria",
                defaultMessage: "{label} column {column} {symbol}",
                description:
                  "Accessible label for one interactive MSA matrix cell.",
              },
              {
                column: column + 1,
                label,
                symbol,
              },
            )}
            aria-colindex={column + 1}
            aria-selected={isSelectedColumn}
            className={clsx(
              "relative inline-flex h-5 shrink-0 items-center justify-center border border-transparent text-token-text-primary",
              "focus-visible:z-10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-token-text-primary",
              showRnaStructureOverlays && getRnaPairBorderClass(rnaPair),
              isSelectedColumn && "outline outline-1 outline-sky-400",
              hitState.any && "ring-1 ring-amber-300",
              hitState.selected && "z-[1] ring-2 ring-orange-500",
            )}
            key={`${label}:${column}`}
            data-msa-cell="true"
            data-msa-column={column}
            data-msa-row-index={rowIndex}
            onBlur={() => onHoverCellDetailsChange(null)}
            onClick={() => {
              if (row != null) {
                onPinnedCellChange({ column, row, symbol });
              }
            }}
            onFocus={(event) => {
              makeRovingTabStop(event.currentTarget);
              publishActiveCellDetails({
                analysis,
                column,
                document,
                insertion,
                onFocusedCellChange,
                onHoverCellDetailsChange,
                publishFocus: true,
                projection,
                referenceSymbol,
                row,
                showRnaStructureOverlays,
                symbol,
                target: event.currentTarget,
              });
            }}
            onKeyDown={(event) => {
              const nextColumn = moveGridFocus(event, document.alignedLength);
              if (nextColumn == null) return;
              event.preventDefault();
              onKeyboardRangeSelection(column, nextColumn, event.shiftKey);
            }}
            onMouseEnter={(event) =>
              publishActiveCellDetails({
                analysis,
                column,
                document,
                insertion,
                onFocusedCellChange,
                onHoverCellDetailsChange,
                publishFocus: false,
                projection,
                referenceSymbol,
                row,
                showRnaStructureOverlays,
                symbol,
                target: event.currentTarget,
              })
            }
            onMouseLeave={() => onHoverCellDetailsChange(null)}
            onPointerDown={() => onRangeSelectionStart(column)}
            onPointerEnter={() => onRangeSelectionExtend(column)}
            style={{
              backgroundColor,
              ...(textColor == null ? {} : { color: textColor }),
              width: cellWidth,
            }}
            type="button"
            role="gridcell"
            tabIndex={
              row != null && isFirstRenderedRow && column === columns[0]
                ? 0
                : -1
            }
          >
            {isReferenceMatch ? MATCH_PLACEHOLDER : symbol}
            {insertion == null ? null : (
              <sup className="pointer-events-none absolute top-0 right-0 z-[2] translate-x-1/2 -translate-y-1/2 rounded-full bg-purple-600 px-1 text-[7px] leading-3 text-white shadow-sm">
                <FormattedMessage
                  id="codex.filePreview.msa.insertionBadge"
                  defaultMessage="+{count, number}"
                  description="Badge that reports how many insertion residues are hidden after an MSA alignment column."
                  values={{ count: insertion.residues.length }}
                />
              </sup>
            )}
          </button>
        );
      })}
      <HorizontalSpacer
        width={
          Math.max(0, document.alignedLength - slice.columnEnd) * cellWidth
        }
      />
    </div>
  );
});

function HorizontalSpacer({
  width,
}: {
  width: number;
}): React.ReactElement | null {
  if (width <= 0) {
    return null;
  }
  return <span aria-hidden="true" className="shrink-0" style={{ width }} />;
}

function isColumnWithinRange(
  range: MsaColumnRange | null,
  column: number,
): boolean {
  return range != null && column >= range.start && column < range.end;
}

function getRnaPairBorderClass(
  pair: MsaDerivedAnalysis["pairByColumn"][string],
): string | false {
  if (pair == null) {
    return false;
  }
  if ((pair.pseudoknotLevel ?? 0) > 0) {
    return "border-fuchsia-400";
  }
  if (pair.pairClass === "wobble") {
    return "border-cyan-300";
  }
  return "border-purple-300";
}

function getMatrixCellBackground({
  colorMode,
  column,
  document,
  referenceSymbol,
  residuePalette,
  summaries,
  symbol,
}: {
  colorMode: MsaColorMode;
  column: number;
  document: MsaDocument;
  referenceSymbol?: string;
  residuePalette: MsaResiduePalette | null;
  summaries: Array<MsaColumnSummary>;
  symbol: string;
}): string {
  if (
    (colorMode === "identity" || colorMode === "protein-conservation") &&
    summaries.length === 0
  ) {
    return isGapSymbol(symbol) ? "transparent" : DIFFERENCE_MATCH_COLOR;
  }
  return getMsaCellBackground({
    columnSummary: summaries[column] ?? {
      conservationModel: null,
      conservationNormalized: null,
      gapFraction: 0,
      identity: 0,
      nucleotideInformationContentBits: null,
      nongapCount: 0,
      proteinRelativeEntropyBits: null,
      symbolCounts: {},
      weightedSupport: 0,
      weightedSymbolFractions: {},
    },
    document,
    mode: colorMode,
    palette: residuePalette,
    ...(referenceSymbol == null ? {} : { referenceSymbol }),
    symbol,
  });
}

function getCodingImpactBackground({
  column,
  referenceSequence,
  rowSequence,
  symbol,
}: {
  column: number;
  referenceSequence: string | null;
  rowSequence: string;
  symbol: string;
}): string {
  if (referenceSequence == null) {
    return isGapSymbol(symbol) ? "transparent" : DIFFERENCE_MATCH_COLOR;
  }
  const codonStart = column - (column % 3);
  const anchorCodon = referenceSequence.slice(codonStart, codonStart + 3);
  const candidateCodon = rowSequence.slice(codonStart, codonStart + 3);
  if (candidateCodon.toUpperCase() === anchorCodon.toUpperCase()) {
    return isGapSymbol(symbol) ? "transparent" : DIFFERENCE_MATCH_COLOR;
  }
  const nonsynonymous = isNonsynonymousCodonDifference({
    anchorCodon,
    candidateCodon,
  });
  if (nonsynonymous == null) {
    return DIFFERENCE_MISMATCH_COLOR;
  }
  return nonsynonymous ? CODING_NONSYNONYMOUS_COLOR : CODING_SYNONYMOUS_COLOR;
}

function publishActiveCellDetails({
  analysis,
  column,
  document,
  insertion,
  onFocusedCellChange,
  onHoverCellDetailsChange,
  publishFocus,
  projection,
  referenceSymbol,
  row,
  showRnaStructureOverlays,
  symbol,
  target,
}: {
  analysis: MsaDerivedAnalysis | null;
  column: number;
  document: MsaDocument;
  insertion: MsaInsertionRun | undefined;
  onFocusedCellChange: (cell: FocusedMsaCell) => void;
  onHoverCellDetailsChange: (details: MsaHoverCellDetails) => void;
  publishFocus: boolean;
  projection: MsaRowProjection | undefined;
  referenceSymbol?: string;
  row: MsaSequenceRow | null;
  showRnaStructureOverlays: boolean;
  symbol: string;
  target: HTMLElement;
}): void {
  if (row == null) {
    return;
  }
  if (publishFocus) onFocusedCellChange({ column, row, symbol });
  onHoverCellDetailsChange(
    buildHoverCellDetails(
      formatCellTitle({
        analysis,
        column,
        document,
        insertionResidues: insertion?.residues,
        projection,
        referenceSymbol,
        row,
        showRnaStructureOverlays,
        symbol,
      }),
      target,
    ),
  );
}

function formatCellTitle({
  analysis,
  column,
  document,
  insertionResidues,
  projection,
  referenceSymbol,
  row,
  showRnaStructureOverlays,
  symbol,
}: {
  analysis: MsaDerivedAnalysis | null;
  column: number;
  document: MsaDocument;
  insertionResidues?: string;
  projection: MsaRowProjection | undefined;
  referenceSymbol?: string;
  row: MsaSequenceRow;
  showRnaStructureOverlays: boolean;
  symbol: string;
}): string {
  const parts = [row.label, `Column ${column + 1}`, `Symbol ${symbol}`];
  const ungapped =
    getUngappedPositionFromProjection(projection, column) ??
    getUngappedPosition(row.alignedSequence, column);
  if (ungapped != null) {
    parts.push(`Ungapped position ${ungapped}`);
  }
  if (referenceSymbol != null) {
    parts.push(`Reference ${referenceSymbol}`);
  }
  if (insertionResidues != null) {
    parts.push(`Insertion ${insertionResidues}`);
  }
  if (showRnaStructureOverlays) {
    const pair = analysis?.pairByColumn[String(column)];
    if (pair != null) {
      const partner =
        pair.leftColumn === column ? pair.rightColumn : pair.leftColumn;
      parts.push(`RNA pair partner column ${partner + 1}`);
    } else if (document.rnaStructure != null && analysis == null) {
      parts.push("RNA pair details computing");
    }
  }
  return parts.join(" · ");
}

function indexInsertions(
  insertions: Array<MsaInsertionRun>,
): Record<string, Record<string, MsaInsertionRun | undefined> | undefined> {
  const byRow: Record<
    string,
    Record<string, MsaInsertionRun | undefined> | undefined
  > = {};
  for (const insertion of insertions) {
    const rowInsertions = byRow[insertion.rowId] ?? {};
    rowInsertions[String(insertion.afterAlignmentColumn)] = insertion;
    byRow[insertion.rowId] = rowInsertions;
  }
  return byRow;
}

function indexHitRanges(
  hits: Array<MsaMotifSearchHit>,
  selectedHit: MsaMotifSearchHit | null,
): Map<string, Array<HitRange>> {
  const ranges = new Map<string, Array<HitRange>>();
  for (const hit of hits) {
    const rowRanges = ranges.get(hit.rowId) ?? [];
    rowRanges.push({
      end: hit.alignmentEndColumn,
      selected:
        selectedHit != null &&
        selectedHit.rowId === hit.rowId &&
        selectedHit.alignmentStartColumn === hit.alignmentStartColumn &&
        selectedHit.alignmentEndColumn === hit.alignmentEndColumn &&
        selectedHit.orientation === hit.orientation,
      start: hit.alignmentStartColumn,
    });
    ranges.set(hit.rowId, rowRanges);
  }
  for (const rowRanges of ranges.values()) {
    rowRanges.sort((left, right) => left.start - right.start);
  }
  return ranges;
}

function getHitState(
  ranges: Array<HitRange>,
  column: number,
): { any: boolean; selected: boolean } {
  for (const range of ranges) {
    if (range.start > column) {
      break;
    }
    if (column <= range.end) {
      return { any: true, selected: range.selected };
    }
  }
  return { any: false, selected: false };
}
