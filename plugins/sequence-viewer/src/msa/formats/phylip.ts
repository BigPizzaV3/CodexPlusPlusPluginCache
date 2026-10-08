import { normalizeGapSymbol } from "../residue-alphabet";
import type { MsaFormatDraft, MsaParseWarning } from "../types";

type PhylipRow = {
  fragments: Array<string>;
  id: string;
};

type PhylipCandidate = {
  consumedAllLines: boolean;
  layout: "interleaved" | "sequential";
  nameMode: "fixed" | "relaxed";
  rows: Array<PhylipRow>;
};

function parseInitialPhylipRow(
  line: string,
  fallbackId: string,
  nameMode: PhylipCandidate["nameMode"],
): PhylipRow | null {
  if (nameMode === "fixed") {
    if (line.length <= 10) return null;
    const id = line.slice(0, 10).trim() || fallbackId;
    const fragment = normalizeSequence(line.slice(10));
    return fragment.length === 0 ? null : { fragments: [fragment], id };
  }
  const fields = line.trim().split(/\s+/);
  if (fields.length < 2) return null;
  const fragment = normalizeSequence(fields.slice(1).join(""));
  return fragment.length === 0
    ? null
    : { fragments: [fragment], id: fields[0] ?? fallbackId };
}

function normalizeSequence(sequence: string): string {
  return Array.from(sequence.replaceAll(/[\d\s]/g, ""))
    .map((symbol) => normalizeGapSymbol(symbol))
    .join("");
}

export function parsePhylip(contents: string): MsaFormatDraft {
  const lines = contents
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter((line) => line.trim().length > 0);
  const header = lines[0]?.trim() ?? "";
  const [rowCountText, columnCountText] = header.split(/\s+/);
  const expectedRows = Number(rowCountText);
  const expectedColumns = Number(columnCountText);
  const warnings: Array<MsaParseWarning> = [];
  if (!Number.isInteger(expectedRows) || expectedRows <= 0) {
    warnings.push({
      code: "phylip-header-invalid",
      message: "The PHYLIP row-count header was missing or malformed.",
      severity: "error",
    });
  }
  if (!Number.isInteger(expectedColumns) || expectedColumns <= 0) {
    warnings.push({
      code: "phylip-column-count-invalid",
      message: "The PHYLIP column-count header was missing or malformed.",
      severity: "error",
    });
  }

  const validDimensions =
    Number.isInteger(expectedRows) &&
    expectedRows > 0 &&
    Number.isInteger(expectedColumns) &&
    expectedColumns > 0;
  const body = lines.slice(1);
  const candidates = validDimensions
    ? (["relaxed", "fixed"] as const).flatMap((nameMode) => [
        parseInterleavedCandidate(body, expectedRows, nameMode),
        parseSequentialCandidate(body, expectedRows, expectedColumns, nameMode),
      ])
    : [];
  const exact = candidates.find(
    (candidate) =>
      candidate != null &&
      candidate.consumedAllLines &&
      candidate.rows.length === expectedRows &&
      candidate.rows.every(
        (row) => row.fragments.join("").length === expectedColumns,
      ),
  );
  const candidate = exact ??
    candidates
      .filter((value): value is PhylipCandidate => value != null)
      .sort(
        (left, right) =>
          candidateScore(right, expectedColumns) -
          candidateScore(left, expectedColumns),
      )[0] ?? {
      consumedAllLines: body.length === 0,
      layout: "interleaved" as const,
      nameMode: "relaxed" as const,
      rows: [],
    };

  const parsedRows = candidate.rows.map((row) => ({
    alignedSequence: row.fragments.join(""),
    id: row.id,
    label: row.id,
  }));
  if (
    Number.isInteger(expectedRows) &&
    expectedRows > 0 &&
    parsedRows.length !== expectedRows
  ) {
    warnings.push({
      code: "phylip-row-count-mismatch",
      message: `PHYLIP declares ${expectedRows} rows but ${parsedRows.length} were parsed.`,
      severity: "error",
    });
  }
  if (new Set(parsedRows.map(({ id }) => id)).size !== parsedRows.length) {
    warnings.push({
      code: "phylip-duplicate-row-id",
      message: "PHYLIP sequence names must be unique within one alignment.",
      severity: "error",
    });
  }
  if (Number.isInteger(expectedColumns) && expectedColumns > 0) {
    parsedRows.forEach((row) => {
      if (row.alignedSequence.length !== expectedColumns) {
        warnings.push({
          code: "phylip-column-count-mismatch",
          message: `PHYLIP row ${row.id} has ${row.alignedSequence.length} columns; the header declares ${expectedColumns}.`,
          severity: "error",
        });
      }
    });
  }
  if (!candidate.consumedAllLines) {
    warnings.push({
      code: "phylip-extra-data",
      message: "PHYLIP contains sequence data beyond its declared dimensions.",
      severity: "error",
    });
  }

  return {
    format: "phylip",
    metadata: {
      columns:
        Number.isInteger(expectedColumns) && expectedColumns > 0
          ? String(expectedColumns)
          : "unknown",
      layout: candidate.layout,
      nameMode: candidate.nameMode,
      rows:
        Number.isInteger(expectedRows) && expectedRows > 0
          ? String(expectedRows)
          : "unknown",
    },
    rows: parsedRows,
    warnings,
  };
}

function parseInterleavedCandidate(
  body: Array<string>,
  expectedRows: number,
  nameMode: PhylipCandidate["nameMode"],
): PhylipCandidate | null {
  if (body.length < expectedRows) return null;
  const rows: Array<PhylipRow> = [];
  for (let index = 0; index < expectedRows; index += 1) {
    const row = parseInitialPhylipRow(
      body[index] ?? "",
      `sequence-${index + 1}`,
      nameMode,
    );
    if (row == null) return null;
    rows.push(row);
  }

  let continuationCursor = 0;
  for (const line of body.slice(expectedRows)) {
    const fields = line.trim().split(/\s+/);
    const labeledRow =
      fields.length >= 2 ? rows.find(({ id }) => id === fields[0]) : undefined;
    if (labeledRow != null) {
      labeledRow.fragments.push(normalizeSequence(fields.slice(1).join("")));
      continue;
    }
    const row = rows[continuationCursor % rows.length];
    continuationCursor += 1;
    row?.fragments.push(normalizeSequence(line));
  }
  return { consumedAllLines: true, layout: "interleaved", nameMode, rows };
}

function parseSequentialCandidate(
  body: Array<string>,
  expectedRows: number,
  expectedColumns: number,
  nameMode: PhylipCandidate["nameMode"],
): PhylipCandidate | null {
  const rows: Array<PhylipRow> = [];
  let cursor = 0;
  for (let rowIndex = 0; rowIndex < expectedRows; rowIndex += 1) {
    const row = parseInitialPhylipRow(
      body[cursor] ?? "",
      `sequence-${rowIndex + 1}`,
      nameMode,
    );
    if (row == null) return null;
    cursor += 1;
    while (
      row.fragments.join("").length < expectedColumns &&
      cursor < body.length
    ) {
      row.fragments.push(normalizeSequence(body[cursor] ?? ""));
      cursor += 1;
    }
    rows.push(row);
  }
  return {
    consumedAllLines: cursor === body.length,
    layout: "sequential",
    nameMode,
    rows,
  };
}

function candidateScore(
  candidate: PhylipCandidate,
  expectedColumns: number,
): number {
  const exactRows = candidate.rows.filter(
    (row) => row.fragments.join("").length === expectedColumns,
  ).length;
  return exactRows * 10 + (candidate.consumedAllLines ? 1 : 0);
}
