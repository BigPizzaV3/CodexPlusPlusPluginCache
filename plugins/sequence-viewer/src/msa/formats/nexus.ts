import { normalizeGapSymbol } from "../residue-alphabet";
import type { MsaFormatDraft, MsaParseWarning } from "../types";

function cleanNexusLine(line: string): string {
  return line.trim();
}

export function parseNexus(contents: string): MsaFormatDraft {
  const warnings: Array<MsaParseWarning> = [];
  const strippedComments = stripNexusComments(contents);
  const lines = strippedComments.contents.split(/\r?\n/);
  if (strippedComments.unterminated) {
    warnings.push({
      code: "nexus-comment-unterminated",
      message: "A NEXUS comment was not closed before the end of the file.",
      severity: "error",
    });
  }
  const flattenedDirectives = lines.map(cleanNexusLine).join(" ");
  const dimensions =
    /\bdimensions\b([^;]*);/i.exec(flattenedDirectives)?.[1] ?? "";
  const expectedRows = Number(/\bntax\s*=\s*(\d+)/i.exec(dimensions)?.[1]);
  const expectedColumns = Number(/\bnchar\s*=\s*(\d+)/i.exec(dimensions)?.[1]);
  const formatBody = /\bformat\b([^;]*);/i.exec(flattenedDirectives)?.[1] ?? "";
  const gapToken = formatBody.match(/\bgap\s*=\s*(\S)/i)?.[1] ?? "-";
  const missingToken = formatBody.match(/\bmissing\s*=\s*(\S)/i)?.[1] ?? "?";
  const matchToken = formatBody.match(/\bmatchchar\s*=\s*(\S)/i)?.[1];
  const interleaved = /\binterleave(?:d)?\s*=\s*(?:yes|true)\b/i.test(
    formatBody,
  );
  const matrixStart = lines.findIndex((line) =>
    /\bmatrix\b/i.test(cleanNexusLine(line)),
  );
  if (matrixStart === -1) {
    return {
      format: "nexus",
      rows: [],
      warnings: [
        ...warnings,
        {
          code: "nexus-matrix-missing",
          message: "The NEXUS MATRIX block was not found.",
          severity: "error",
        },
      ],
    };
  }

  const rowsById = new Map<string, Array<string>>();
  const order: Array<string> = [];
  let continuationCursor = 0;
  let reachedTerminator = false;
  const matrixMarker = /\bmatrix\b/i.exec(lines[matrixStart] ?? "");
  const matrixLines = [
    (lines[matrixStart] ?? "").slice(
      (matrixMarker?.index ?? 0) + (matrixMarker?.[0].length ?? 0),
    ),
    ...lines.slice(matrixStart + 1),
  ];
  for (let index = 0; index < matrixLines.length; index += 1) {
    let line = cleanNexusLine(matrixLines[index] ?? "");
    if (line.length === 0) continue;
    const terminatorIndex = findNexusTerminator(line);
    if (terminatorIndex !== -1) {
      reachedTerminator = true;
      line = line.slice(0, terminatorIndex).trim();
      if (line.length === 0) break;
    }
    const matrixRow = parseNexusMatrixRow(line);
    if (matrixRow == null) {
      if (interleaved && order.length > 0 && /^\S+$/.test(line)) {
        const id = order[continuationCursor % order.length];
        continuationCursor += 1;
        if (id != null) {
          rowsById
            .get(id)
            ?.push(
              normalizeNexusSequence(line, gapToken, missingToken, matchToken),
            );
        }
      } else {
        warnings.push({
          code: "nexus-row-skipped",
          line: matrixStart + index + 1,
          message: "Skipped a malformed NEXUS MATRIX row.",
          preserved: "ignored",
          severity: "error",
        });
      }
    } else {
      const id = matrixRow.id;
      const sequence = normalizeNexusSequence(
        matrixRow.sequence,
        gapToken,
        missingToken,
        matchToken,
      );
      if (!rowsById.has(id)) {
        order.push(id);
        rowsById.set(id, []);
      }
      rowsById.get(id)?.push(sequence);
    }
    if (reachedTerminator) break;
  }
  if (!reachedTerminator) {
    warnings.push({
      code: "nexus-matrix-terminator-missing",
      message: "The NEXUS MATRIX block did not end with a semicolon.",
      severity: "error",
    });
  }

  let rows = order.map((id) => ({
    alignedSequence: rowsById.get(id)?.join("") ?? "",
    id,
    label: id,
  }));
  if (matchToken != null && rows.length > 0) {
    const reference = rows[0]?.alignedSequence ?? "";
    rows = rows.map((row, rowIndex) => ({
      ...row,
      alignedSequence: Array.from(row.alignedSequence)
        .map((symbol, columnIndex) => {
          if (symbol !== matchToken) return symbol;
          if (rowIndex === 0) {
            warnings.push({
              code: "nexus-reference-matchchar",
              message:
                "The first NEXUS row cannot use MATCHCHAR because no reference residue exists.",
              severity: "error",
            });
            return "?";
          }
          return reference[columnIndex] ?? "?";
        })
        .join(""),
    }));
  }
  if (
    Number.isInteger(expectedRows) &&
    expectedRows > 0 &&
    rows.length !== expectedRows
  ) {
    warnings.push({
      code: "nexus-ntax-mismatch",
      message: `NEXUS declares NTAX=${expectedRows}, but ${rows.length} rows were parsed.`,
      severity: "error",
    });
  }
  if (Number.isInteger(expectedColumns) && expectedColumns > 0) {
    for (const row of rows) {
      if (row.alignedSequence.length !== expectedColumns) {
        warnings.push({
          code: "nexus-nchar-mismatch",
          message: `NEXUS row ${row.id} has ${row.alignedSequence.length} columns; NCHAR=${expectedColumns}.`,
          severity: "error",
        });
      }
    }
  }

  return {
    format: "nexus",
    metadata: {
      gap: gapToken,
      interleaved: String(interleaved),
      matchchar: matchToken ?? "none",
      missing: missingToken,
    },
    rows,
    warnings,
  };
}

function findNexusTerminator(line: string): number {
  let quote: "'" | '"' | null = null;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index] ?? "";
    if (quote != null) {
      if (character === quote && line[index + 1] === quote) {
        index += 1;
      } else if (character === quote) {
        quote = null;
      }
      continue;
    }
    if (character === "'" || character === '"') {
      quote = character;
    } else if (character === ";") {
      return index;
    }
  }
  return -1;
}

function parseNexusMatrixRow(
  line: string,
): { id: string; sequence: string } | null {
  const quote = line[0] === "'" || line[0] === '"' ? line[0] : null;
  if (quote == null) {
    const separator = line.search(/\s/);
    if (separator <= 0) return null;
    const id = line.slice(0, separator).replaceAll("_", " ");
    const sequence = line.slice(separator).trim();
    return sequence.length === 0 ? null : { id, sequence };
  }

  let id = "";
  let index = 1;
  let closed = false;
  while (index < line.length) {
    const character = line[index] ?? "";
    if (character === quote && line[index + 1] === quote) {
      id += quote;
      index += 2;
      continue;
    }
    if (character === quote) {
      closed = true;
      index += 1;
      break;
    }
    id += character;
    index += 1;
  }
  if (!closed || !/\s/.test(line[index] ?? "")) return null;
  const sequence = line.slice(index).trim();
  return sequence.length === 0 ? null : { id, sequence };
}

function normalizeNexusSequence(
  sequence: string,
  gapToken: string,
  missingToken: string,
  matchToken?: string,
): string {
  return Array.from(sequence.replaceAll(/\s+/g, ""))
    .map((symbol) => {
      if (matchToken != null && symbol === matchToken) return symbol;
      if (symbol === gapToken) return "-";
      if (symbol === missingToken) return "?";
      return normalizeGapSymbol(symbol);
    })
    .join("");
}

function stripNexusComments(contents: string): {
  contents: string;
  unterminated: boolean;
} {
  let depth = 0;
  let result = "";
  let quote: "'" | '"' | null = null;
  for (let index = 0; index < contents.length; index += 1) {
    const character = contents[index] ?? "";
    if (depth === 0 && quote != null) {
      result += character;
      if (character === quote && contents[index + 1] === quote) {
        result += contents[index + 1];
        index += 1;
      } else if (character === quote) {
        quote = null;
      }
      continue;
    }
    if (depth === 0 && (character === "'" || character === '"')) {
      quote = character;
      result += character;
      continue;
    }
    if (character === "[") {
      depth += 1;
      result += " ";
    } else if (character === "]" && depth > 0) {
      depth -= 1;
      result += " ";
    } else if (depth > 0) {
      result += character === "\n" ? "\n" : " ";
    } else {
      result += character;
    }
  }
  return { contents: result, unterminated: depth > 0 };
}
