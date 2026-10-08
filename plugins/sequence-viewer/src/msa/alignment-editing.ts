import { SEQUENCE_VIEWER_LIMITS } from "../runtime-contract";
import { calculatePDistance } from "./guide-tree";
import type {
  MsaAnnotationTrack,
  MsaDocument,
  MsaInsertionRun,
  MsaSequenceRow,
} from "./types";

export type AlignmentEngine = "builtin-center-star" | "builtin-pairwise";

export type AlignmentInputSequence = {
  description?: string;
  id: string;
  label: string;
  metadata?: Record<string, string>;
  sequence: string;
  sourceCoordinates?: MsaSequenceRow["sourceCoordinates"];
  sourceId?: string;
};

export const ALIGNMENT_ROW_GROUP_METADATA_KEY = "sequenceViewerGroup";

export type AlignmentResult = {
  alignedLength: number;
  engine: AlignmentEngine;
  parameters: {
    gapPenalty: number;
    matchScore: number;
    mismatchScore: number;
  };
  rows: Array<MsaSequenceRow>;
  warning: string;
};

export type AlignmentChangeSet = {
  description: string;
  operation:
    | "add-gap"
    | "delete-gap"
    | "group-rows"
    | "remove-columns"
    | "remove-gappy-columns"
    | "remove-rows"
    | "reorder-rows";
  parameters: Record<string, unknown>;
};

const DEFAULT_SCORES = Object.freeze({
  gapPenalty: -2,
  matchScore: 2,
  mismatchScore: -1,
});

export function alignSequences(
  input: Array<AlignmentInputSequence>,
  scores = DEFAULT_SCORES,
  requestedEngine?: AlignmentEngine,
): AlignmentResult {
  if (input.length < 2)
    throw new Error("Alignment requires at least two sequences.");
  const normalized = input.map((item) => ({
    ...item,
    sequence: item.sequence.toUpperCase().replaceAll(/[-.\s]/gu, ""),
  }));
  if (normalized.some(({ sequence }) => sequence.length === 0))
    throw new Error("Alignment input sequences cannot be empty.");
  const engine =
    requestedEngine ??
    (normalized.length === 2 ? "builtin-pairwise" : "builtin-center-star");
  if (engine === "builtin-pairwise" && normalized.length !== 2) {
    throw new Error(
      "Built-in pairwise alignment requires exactly two sequences.",
    );
  }
  if (engine === "builtin-pairwise") {
    const pair = needlemanWunsch(
      normalized[0]?.sequence ?? "",
      normalized[1]?.sequence ?? "",
      scores,
    );
    return resultFromAlignedSequences(
      normalized,
      [pair.left, pair.right],
      "builtin-pairwise",
      scores,
    );
  }
  const centerIndex = normalized.reduce(
    (selected, current, index, values) =>
      current.sequence.length > (values[selected]?.sequence.length ?? 0)
        ? index
        : selected,
    0,
  );
  const center = normalized[centerIndex];
  if (center == null)
    throw new Error("Alignment center sequence was unavailable.");
  const dynamicProgrammingCells = normalized.reduce(
    (total, candidate, index) =>
      index === centerIndex
        ? total
        : total +
          (center.sequence.length + 1) * (candidate.sequence.length + 1),
    0,
  );
  if (
    dynamicProgrammingCells >
    SEQUENCE_VIEWER_LIMITS.analysis.maxAlignmentDynamicProgrammingCells
  ) {
    throw new Error(
      `Center-star alignment is limited to ${SEQUENCE_VIEWER_LIMITS.analysis.maxAlignmentDynamicProgrammingCells.toLocaleString("en-US")} total dynamic-programming cells. Select fewer or shorter sequences.`,
    );
  }
  let masterCenter = center.sequence;
  const alignedByIndex = new Map<number, string>([[centerIndex, masterCenter]]);
  for (let index = 0; index < normalized.length; index += 1) {
    if (index === centerIndex) continue;
    const candidate = normalized[index];
    if (candidate == null) continue;
    const pair = needlemanWunsch(center.sequence, candidate.sequence, scores);
    const merged = mergeCenterAlignments({
      existing: alignedByIndex,
      masterCenter,
      pairCenter: pair.left,
      pairSequence: pair.right,
    });
    masterCenter = merged.masterCenter;
    alignedByIndex.clear();
    for (const [rowIndex, aligned] of merged.existing)
      alignedByIndex.set(rowIndex, aligned);
    alignedByIndex.set(index, merged.pairSequence);
    alignedByIndex.set(centerIndex, masterCenter);
    assertAlignmentCellBudget(normalized.length, masterCenter.length);
  }
  return resultFromAlignedSequences(
    normalized,
    normalized.map(
      (_, index) =>
        alignedByIndex.get(index) ?? "-".repeat(masterCenter.length),
    ),
    engine,
    scores,
  );
}

export function needlemanWunsch(
  left: string,
  right: string,
  {
    gapPenalty = DEFAULT_SCORES.gapPenalty,
    matchScore = DEFAULT_SCORES.matchScore,
    mismatchScore = DEFAULT_SCORES.mismatchScore,
  }: Partial<typeof DEFAULT_SCORES> = {},
): { left: string; right: string; score: number } {
  const rowCount = left.length + 1;
  const columnCount = right.length + 1;
  if (rowCount * columnCount > 4_000_000)
    throw new Error(
      "Pairwise alignment is limited to 4,000,000 dynamic-programming cells.",
    );
  const scores = new Int32Array(rowCount * columnCount);
  const trace = new Uint8Array(rowCount * columnCount);
  for (let row = 1; row < rowCount; row += 1) {
    scores[row * columnCount] = row * gapPenalty;
    trace[row * columnCount] = 1;
  }
  for (let column = 1; column < columnCount; column += 1) {
    scores[column] = column * gapPenalty;
    trace[column] = 2;
  }
  for (let row = 1; row < rowCount; row += 1) {
    for (let column = 1; column < columnCount; column += 1) {
      const diagonal =
        scores[(row - 1) * columnCount + column - 1] +
        (left[row - 1]?.toUpperCase() === right[column - 1]?.toUpperCase()
          ? matchScore
          : mismatchScore);
      const up = scores[(row - 1) * columnCount + column] + gapPenalty;
      const across = scores[row * columnCount + column - 1] + gapPenalty;
      const best = Math.max(diagonal, up, across);
      const index = row * columnCount + column;
      scores[index] = best;
      trace[index] = best === diagonal ? 0 : best === up ? 1 : 2;
    }
  }
  const alignedLeft: Array<string> = [];
  const alignedRight: Array<string> = [];
  let row = left.length;
  let column = right.length;
  while (row > 0 || column > 0) {
    const direction = trace[row * columnCount + column];
    if (row > 0 && column > 0 && direction === 0) {
      alignedLeft.push(left[row - 1] ?? "-");
      alignedRight.push(right[column - 1] ?? "-");
      row -= 1;
      column -= 1;
    } else if (row > 0 && (column === 0 || direction === 1)) {
      alignedLeft.push(left[row - 1] ?? "-");
      alignedRight.push("-");
      row -= 1;
    } else {
      alignedLeft.push("-");
      alignedRight.push(right[column - 1] ?? "-");
      column -= 1;
    }
  }
  return {
    left: alignedLeft.reverse().join(""),
    right: alignedRight.reverse().join(""),
    score: scores[left.length * columnCount + right.length] ?? 0,
  };
}

export function removeAlignmentColumns(
  document: MsaDocument,
  start: number,
  end: number,
): { change: AlignmentChangeSet; document: MsaDocument } {
  const normalizedStart = Math.max(1, Math.min(start, end));
  const normalizedEnd = Math.min(document.alignedLength, Math.max(start, end));
  if (normalizedStart > normalizedEnd)
    throw new Error("The requested alignment-column range is empty.");
  const startIndex = normalizedStart - 1;
  const endIndex = normalizedEnd;
  const removedCount = endIndex - startIndex;
  const rows = document.rows.map((row) =>
    updateRow(row, removeSlice(row.alignedSequence, startIndex, endIndex)),
  );
  const annotations = document.annotations.map((track) => ({
    ...track,
    values: removeSlice(track.values, startIndex, endIndex),
  }));
  const insertions = remapInsertions(document.insertions, startIndex, endIndex);
  return {
    change: {
      description: `Removed alignment columns ${normalizedStart}-${normalizedEnd}.`,
      operation: "remove-columns",
      parameters: { end: normalizedEnd, start: normalizedStart },
    },
    document: rebuildDocument(
      document,
      rows,
      annotations,
      insertions,
      document.alignedLength - removedCount,
    ),
  };
}

export function removeGappyAlignmentColumns(
  document: MsaDocument,
  minimumGapFraction: number,
): { change: AlignmentChangeSet; document: MsaDocument } {
  if (minimumGapFraction < 0 || minimumGapFraction > 1)
    throw new Error("Gap fraction must be between 0 and 1.");
  const keep = Array.from({ length: document.alignedLength }, (_, column) => {
    const gaps = document.rows.filter(({ alignedSequence }) =>
      isGap(alignedSequence[column] ?? "-"),
    ).length;
    return (
      document.rows.length === 0 ||
      gaps === 0 ||
      gaps / document.rows.length < minimumGapFraction
    );
  });
  const filterColumns = (value: string) =>
    [...value].filter((_, index) => keep[index]).join("");
  const rows = document.rows.map((row) =>
    updateRow(row, filterColumns(row.alignedSequence)),
  );
  const annotations = document.annotations.map((track) => ({
    ...track,
    values: filterColumns(track.values),
  }));
  const columnMap = new Map<number, number>();
  let nextColumn = 0;
  keep.forEach((retained, index) => {
    if (retained) {
      columnMap.set(index, nextColumn);
      nextColumn += 1;
    }
  });
  const insertions = document.insertions.flatMap((insertion) => {
    const mapped = columnMap.get(insertion.afterAlignmentColumn);
    return mapped == null
      ? []
      : [{ ...insertion, afterAlignmentColumn: mapped }];
  });
  const removedCount = keep.filter((value) => !value).length;
  return {
    change: {
      description: `Removed ${removedCount} columns with gap fraction at or above ${minimumGapFraction}.`,
      operation: "remove-gappy-columns",
      parameters: { minimumGapFraction, removedCount },
    },
    document: rebuildDocument(
      document,
      rows,
      annotations,
      insertions,
      nextColumn,
    ),
  };
}

export function addAlignmentGap(
  document: MsaDocument,
  rowId: string,
  column: number,
): { change: AlignmentChangeSet; document: MsaDocument } {
  const row = requireRow(document.rows, rowId);
  const columnIndex = Math.max(0, Math.min(document.alignedLength, column - 1));
  const rows = document.rows.map((candidate) =>
    candidate.id === row.id
      ? updateRow(
          candidate,
          `${candidate.alignedSequence.slice(0, columnIndex)}-${candidate.alignedSequence.slice(columnIndex)}`,
        )
      : updateRow(candidate, `${candidate.alignedSequence}-`),
  );
  const annotations = document.annotations.map((track) => ({
    ...track,
    values: `${track.values} `,
  }));
  return {
    change: {
      description: `Inserted a gap in ${row.label} before column ${columnIndex + 1}.`,
      operation: "add-gap",
      parameters: { column: columnIndex + 1, rowId: row.id },
    },
    document: rebuildDocument(
      document,
      rows,
      annotations,
      document.insertions,
      document.alignedLength + 1,
    ),
  };
}

export function deleteAlignmentGap(
  document: MsaDocument,
  rowId: string,
  column: number,
): { change: AlignmentChangeSet; document: MsaDocument } {
  const row = requireRow(document.rows, rowId);
  const columnIndex = column - 1;
  if (
    columnIndex < 0 ||
    columnIndex >= document.alignedLength ||
    !isGap(row.alignedSequence[columnIndex] ?? "")
  )
    throw new Error(`${row.label} does not have a gap at column ${column}.`);
  const rows = document.rows.map((candidate) =>
    candidate.id === row.id
      ? updateRow(
          candidate,
          `${candidate.alignedSequence.slice(0, columnIndex)}${candidate.alignedSequence.slice(columnIndex + 1)}-`,
        )
      : candidate,
  );
  return {
    change: {
      description: `Deleted the gap in ${row.label} at column ${column}.`,
      operation: "delete-gap",
      parameters: { column, rowId: row.id },
    },
    document: rebuildDocument(
      document,
      rows,
      document.annotations,
      document.insertions,
      document.alignedLength,
    ),
  };
}

export function removeAlignmentRows(
  document: MsaDocument,
  rowIds: Array<string>,
): { change: AlignmentChangeSet; document: MsaDocument } {
  const selected = new Set(rowIds);
  const rows = document.rows.filter(({ id }) => !selected.has(id));
  if (rows.length === 0)
    throw new Error("An alignment copy must retain at least one row.");
  const removed = document.rows.length - rows.length;
  if (removed === 0)
    throw new Error("No alignment rows matched the requested IDs.");
  return {
    change: {
      description: `Removed ${removed} alignment row${removed === 1 ? "" : "s"}.`,
      operation: "remove-rows",
      parameters: { rowIds: [...selected] },
    },
    document: rebuildDocument(
      document,
      rows,
      document.annotations,
      document.insertions.filter(({ rowId }) => !selected.has(rowId)),
      document.alignedLength,
    ),
  };
}

export function assignAlignmentRowGroup(
  document: MsaDocument,
  rowIds: Array<string>,
  group: string | null,
): { change: AlignmentChangeSet; document: MsaDocument } {
  const selected = new Set(rowIds);
  const unknown = [...selected].filter(
    (id) => !document.rows.some((row) => row.id === id),
  );
  if (unknown.length > 0) {
    throw new Error(`Unknown alignment row ${unknown[0]}.`);
  }
  const normalizedGroup = group?.trim() || null;
  const rows = document.rows.map((row) => {
    if (!selected.has(row.id)) return row;
    const metadata = { ...(row.metadata ?? {}) };
    if (normalizedGroup == null) {
      delete metadata[ALIGNMENT_ROW_GROUP_METADATA_KEY];
    } else {
      metadata[ALIGNMENT_ROW_GROUP_METADATA_KEY] = normalizedGroup;
    }
    return {
      ...row,
      metadata: Object.keys(metadata).length === 0 ? undefined : metadata,
    };
  });
  return {
    change: {
      description:
        normalizedGroup == null
          ? `Cleared the row group for ${selected.size} alignment row${selected.size === 1 ? "" : "s"}.`
          : `Assigned ${selected.size} alignment row${selected.size === 1 ? "" : "s"} to group ${normalizedGroup}.`,
      operation: "group-rows",
      parameters: { group: normalizedGroup, rowIds: [...selected] },
    },
    document: rebuildDocument(
      document,
      rows,
      document.annotations,
      document.insertions,
      document.alignedLength,
    ),
  };
}

export function reorderAlignmentRows(
  document: MsaDocument,
  rowIds: Array<string>,
): { change: AlignmentChangeSet; document: MsaDocument } {
  if (
    new Set(rowIds).size !== document.rows.length ||
    rowIds.length !== document.rows.length
  )
    throw new Error("Row order must contain every alignment row exactly once.");
  const byId = new Map(document.rows.map((row) => [row.id, row]));
  const rows = rowIds.map((id) => {
    const row = byId.get(id);
    if (row == null) throw new Error(`Unknown alignment row ${id}.`);
    return row;
  });
  return {
    change: {
      description: "Reordered alignment rows.",
      operation: "reorder-rows",
      parameters: { rowIds },
    },
    document: rebuildDocument(
      document,
      rows,
      document.annotations,
      document.insertions,
      document.alignedLength,
    ),
  };
}

export function sortAlignmentRows(
  document: MsaDocument,
  mode: "group" | "identity-to-reference" | "label" | "tree",
  referenceRowId?: string,
  treeOrder: Array<string> = [],
): { change: AlignmentChangeSet; document: MsaDocument } {
  let rowIds: Array<string>;
  if (mode === "tree") {
    const rank = new Map(treeOrder.map((id, index) => [id, index]));
    rowIds = [...document.rows]
      .sort(
        (left, right) =>
          (rank.get(left.id) ?? Number.MAX_SAFE_INTEGER) -
            (rank.get(right.id) ?? Number.MAX_SAFE_INTEGER) ||
          left.label.localeCompare(right.label),
      )
      .map(({ id }) => id);
  } else if (mode === "identity-to-reference") {
    const reference = requireRow(
      document.rows,
      referenceRowId ?? document.rows[0]?.id ?? "",
    );
    rowIds = [...document.rows]
      .sort(
        (left, right) =>
          calculatePDistance(left.alignedSequence, reference.alignedSequence) -
            calculatePDistance(
              right.alignedSequence,
              reference.alignedSequence,
            ) || left.label.localeCompare(right.label),
      )
      .map(({ id }) => id);
  } else if (mode === "group") {
    rowIds = [...document.rows]
      .sort((left, right) => {
        const leftGroup =
          left.metadata?.[ALIGNMENT_ROW_GROUP_METADATA_KEY] ?? "";
        const rightGroup =
          right.metadata?.[ALIGNMENT_ROW_GROUP_METADATA_KEY] ?? "";
        return (
          leftGroup.localeCompare(rightGroup) ||
          left.label.localeCompare(right.label)
        );
      })
      .map(({ id }) => id);
  } else {
    rowIds = [...document.rows]
      .sort((left, right) => left.label.localeCompare(right.label))
      .map(({ id }) => id);
  }
  return reorderAlignmentRows(document, rowIds);
}

export function exportAlignedFasta(rows: Array<MsaSequenceRow>): string {
  return `${rows.map((row) => `>${row.label}${row.description == null ? "" : ` ${row.description}`}\n${row.alignedSequence}`).join("\n")}\n`;
}

function mergeCenterAlignments({
  existing,
  masterCenter,
  pairCenter,
  pairSequence,
}: {
  existing: Map<number, string>;
  masterCenter: string;
  pairCenter: string;
  pairSequence: string;
}): {
  existing: Map<number, string>;
  masterCenter: string;
  pairSequence: string;
} {
  const nextExisting = new Map<number, Array<string>>(
    [...existing.keys()].map((key) => [key, []]),
  );
  const nextCenter: Array<string> = [];
  const nextPair: Array<string> = [];
  let masterIndex = 0;
  let pairIndex = 0;
  while (masterIndex < masterCenter.length || pairIndex < pairCenter.length) {
    const masterSymbol = masterCenter[masterIndex];
    const pairSymbol = pairCenter[pairIndex];
    const consumeMaster =
      masterIndex < masterCenter.length &&
      (pairIndex >= pairCenter.length ||
        pairSymbol !== "-" ||
        masterSymbol === "-");
    const consumePair =
      pairIndex < pairCenter.length &&
      (masterIndex >= masterCenter.length ||
        masterSymbol !== "-" ||
        pairSymbol === "-");
    const superSymbol = consumeMaster ? masterSymbol ?? "-" : pairSymbol ?? "-";
    nextCenter.push(superSymbol);
    for (const [key, aligned] of existing) {
      nextExisting
        .get(key)
        ?.push(consumeMaster ? aligned[masterIndex] ?? "-" : "-");
    }
    nextPair.push(consumePair ? pairSequence[pairIndex] ?? "-" : "-");
    if (consumeMaster) masterIndex += 1;
    if (consumePair) pairIndex += 1;
  }
  return {
    existing: new Map(
      [...nextExisting].map(([key, value]) => [key, value.join("")]),
    ),
    masterCenter: nextCenter.join(""),
    pairSequence: nextPair.join(""),
  };
}

function resultFromAlignedSequences(
  input: Array<AlignmentInputSequence>,
  aligned: Array<string>,
  engine: AlignmentEngine,
  parameters: typeof DEFAULT_SCORES,
): AlignmentResult {
  const alignedLength = aligned[0]?.length ?? 0;
  assertAlignmentCellBudget(aligned.length, alignedLength);
  if (aligned.some((sequence) => sequence.length !== alignedLength))
    throw new Error("Alignment engine produced unequal row widths.");
  return {
    alignedLength,
    engine,
    parameters,
    rows: input.map((item, index) =>
      updateRow(
        {
          alignedSequence: aligned[index] ?? "",
          description: item.description,
          id: item.id,
          label: item.label,
          metadata: item.metadata,
          sourceCoordinates: item.sourceCoordinates,
          sourceId: item.sourceId,
          ungappedLength: item.sequence.length,
        },
        aligned[index] ?? "",
      ),
    ),
    warning:
      "Built-in pairwise and center-star alignment is intended for fast exploratory comparison. Use MAFFT, Clustal Omega, or another validated external engine for publication-grade MSA generation.",
  };
}

function rebuildDocument(
  document: MsaDocument,
  rows: Array<MsaSequenceRow>,
  annotations: Array<MsaAnnotationTrack>,
  insertions: Array<MsaInsertionRun>,
  alignedLength: number,
): MsaDocument {
  assertAlignmentCellBudget(rows.length, alignedLength);
  const symbolCount = rows.length * alignedLength;
  const gapCount = rows.reduce(
    (count, row) => count + [...row.alignedSequence].filter(isGap).length,
    0,
  );
  return {
    ...document,
    alignedLength,
    annotations,
    insertions,
    rawSummary: {
      ...document.rawSummary,
      gapFraction: symbolCount === 0 ? 0 : gapCount / symbolCount,
      maxLabelLength: Math.max(0, ...rows.map(({ label }) => label.length)),
      sequenceCount: rows.length,
      visibleSequenceCount: rows.filter(({ hidden }) => !hidden).length,
    },
    rnaStructure: null,
    rows,
    warnings: [
      ...document.warnings,
      {
        code: "edited-copy",
        message:
          "This in-memory alignment is an edited copy; source bytes were not overwritten. RNA pairing overlays were invalidated by the edit.",
        preserved: "preserved",
        severity: "info",
      },
    ],
  };
}

function remapInsertions(
  insertions: Array<MsaInsertionRun>,
  startIndex: number,
  endIndex: number,
): Array<MsaInsertionRun> {
  const removed = endIndex - startIndex;
  return insertions.flatMap((insertion) => {
    if (
      insertion.afterAlignmentColumn >= startIndex &&
      insertion.afterAlignmentColumn < endIndex
    )
      return [];
    return [
      {
        ...insertion,
        afterAlignmentColumn:
          insertion.afterAlignmentColumn >= endIndex
            ? insertion.afterAlignmentColumn - removed
            : insertion.afterAlignmentColumn,
      },
    ];
  });
}

function removeSlice(
  value: string,
  startIndex: number,
  endIndex: number,
): string {
  return `${value.slice(0, startIndex)}${value.slice(endIndex)}`;
}

function updateRow(
  row: MsaSequenceRow,
  alignedSequence: string,
): MsaSequenceRow {
  return {
    ...row,
    alignedSequence,
    ungappedLength: alignedSequence.replaceAll(/[-.]/gu, "").length,
  };
}

function requireRow(
  rows: Array<MsaSequenceRow>,
  rowId: string,
): MsaSequenceRow {
  const row = rows.find(({ id }) => id === rowId);
  if (row == null) throw new Error(`No alignment row matched ${rowId}.`);
  return row;
}

function assertAlignmentCellBudget(
  rowCount: number,
  alignedLength: number,
): void {
  if (rowCount * alignedLength > SEQUENCE_VIEWER_LIMITS.input.maxMsaCells)
    throw new Error(
      `The resulting alignment would exceed the ${SEQUENCE_VIEWER_LIMITS.input.maxMsaCells.toLocaleString()}-cell viewer budget.`,
    );
}

function isGap(symbol: string): boolean {
  return symbol === "-" || symbol === ".";
}
