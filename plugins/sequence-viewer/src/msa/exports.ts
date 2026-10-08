import { neutralizeSpreadsheetFormula } from "../spreadsheet-safety";
import type { MsaMotifSearchHit } from "./search";
import type { MsaSequenceRow } from "./types";

export function buildAlignedFasta(rows: Array<MsaSequenceRow>): string {
  return rows.map((row) => `>${row.label}\n${row.alignedSequence}`).join("\n");
}

export function buildReferenceFasta({
  label,
  sequence,
}: {
  label: string;
  sequence: string;
}): string {
  return `>${label}\n${sequence}`;
}

export function buildVisibleRangeText({
  endColumn,
  rows,
  startColumn,
}: {
  endColumn: number;
  rows: Array<MsaSequenceRow>;
  startColumn: number;
}): string {
  return rows
    .map(
      (row) =>
        `${escapeSpreadsheetTsvLabel(row.label)}\t${row.alignedSequence.slice(startColumn, endColumn)}`,
    )
    .join("\n");
}

export function buildSearchHitsTsv(hits: Array<MsaMotifSearchHit>): string {
  const header = [
    "row_label",
    "orientation",
    "alignment_start",
    "alignment_end",
    "ungapped_start",
    "ungapped_end",
  ].join("\t");
  const rows = hits.map((hit) =>
    [
      escapeSpreadsheetTsvLabel(hit.rowLabel),
      hit.orientation,
      hit.alignmentStartColumn + 1,
      hit.alignmentEndColumn + 1,
      hit.ungappedStartPosition,
      hit.ungappedEndPosition,
    ].join("\t"),
  );
  return [header, ...rows].join("\n");
}

function escapeSpreadsheetTsvLabel(value: string): string {
  return neutralizeSpreadsheetFormula(value).replace(/\r\n|[\r\n\t]/gu, " ");
}

export function buildVisibleRangeSvg({
  endColumn,
  rows,
  startColumn,
}: {
  endColumn: number;
  rows: Array<MsaSequenceRow>;
  startColumn: number;
}): string {
  const rowHeight = 18;
  const labelWidth = 180;
  const cellWidth = 11;
  const fontSize = 11;
  const visibleColumnCount = Math.max(0, endColumn - startColumn);
  const width = labelWidth + visibleColumnCount * cellWidth + 16;
  const height = Math.max(rowHeight, rows.length * rowHeight + 18);
  const body = rows
    .map((row, rowIndex) => {
      const y = 18 + rowIndex * rowHeight;
      const sequence = row.alignedSequence.slice(startColumn, endColumn);
      return [
        `<text x="8" y="${y}" font-family="monospace" font-size="${fontSize}">${escapeXml(row.label)}</text>`,
        `<text x="${labelWidth}" y="${y}" font-family="monospace" font-size="${fontSize}">${escapeXml(sequence)}</text>`,
      ].join("");
    })
    .join("");
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
    '<rect width="100%" height="100%" fill="white"/>',
    body,
    "</svg>",
  ].join("");
}

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}
