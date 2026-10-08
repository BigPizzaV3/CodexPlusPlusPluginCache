import { normalizeGapSymbol } from "../residue-alphabet";
import type { MsaFormatDraft, MsaParseWarning } from "../types";

interface MsfBlockRow {
  id: string;
  line: number;
  sequence: string;
}

interface MsfDeclaredRow {
  id: string;
  length: number;
}

export function parseMsf(contents: string): MsaFormatDraft {
  const lines = contents.split(/\r?\n/);
  const warnings: Array<MsaParseWarning> = [];
  const expectedColumns = Number(/\bMSF:\s*(\d+)/i.exec(contents)?.[1]);
  const declaredRows = parseDeclaredRows(lines, warnings);
  const startIndex = lines.findIndex((line) => line.trim() === "//");
  if (startIndex === -1) {
    warnings.push({
      code: "msf-sequence-divider-missing",
      message: "The MSF sequence divider line (//) was not found.",
      severity: "error",
    });
  }

  const blocks = parseBlocks(
    lines.slice(startIndex === -1 ? 0 : startIndex + 1),
    startIndex === -1 ? 1 : startIndex + 2,
    warnings,
  );
  const order = unique([
    ...declaredRows.map(({ id }) => id),
    ...blocks.flatMap((block) => block.map(({ id }) => id)),
  ]);
  const dataIds = new Set(blocks.flatMap((block) => block.map(({ id }) => id)));
  const fragmentsById = new Map(order.map((id) => [id, [] as Array<string>]));

  for (const block of blocks) {
    const blockWidth = Math.max(
      0,
      ...block.map(({ sequence }) => sequence.length),
    );
    const rowsInBlock = new Map<string, MsfBlockRow>();
    for (const row of block) {
      if (rowsInBlock.has(row.id)) {
        warnings.push({
          code: "msf-duplicate-block-row",
          line: row.line,
          message: `MSF row ${row.id} appears more than once in one alignment block.`,
          severity: "error",
        });
        continue;
      }
      rowsInBlock.set(row.id, row);
    }
    for (const id of order) {
      const fragment = rowsInBlock.get(id)?.sequence ?? "";
      fragmentsById
        .get(id)
        ?.push(normalizeMsfSequence(fragment).padEnd(blockWidth, "-"));
    }
  }

  const rows = order.map((id) => ({
    alignedSequence: fragmentsById.get(id)?.join("") ?? "",
    id,
    label: id,
  }));
  const observedColumns = rows[0]?.alignedSequence.length ?? 0;
  if (!Number.isInteger(expectedColumns) || expectedColumns <= 0) {
    warnings.push({
      code: "msf-width-missing",
      message: "The MSF header does not declare a valid alignment width.",
      severity: "error",
    });
  } else if (observedColumns !== expectedColumns) {
    warnings.push({
      code: "msf-width-mismatch",
      message: `The MSF header declares ${expectedColumns} columns, but the alignment data contains ${observedColumns}. The observed alignment width was used.`,
    });
  }

  for (const declared of declaredRows) {
    const row = rows.find(({ id }) => id === declared.id);
    if (row == null || !dataIds.has(declared.id)) {
      warnings.push({
        code: "msf-declared-row-missing",
        message: `MSF declaration for ${declared.id} has no sequence data.`,
        severity: "error",
      });
      continue;
    }
    const ungappedLength = Array.from(row.alignedSequence).filter(
      (symbol) => symbol !== "-",
    ).length;
    if (
      declared.length !== row.alignedSequence.length &&
      declared.length !== ungappedLength
    ) {
      warnings.push({
        code: "msf-declared-row-mismatch",
        message: `MSF declaration for ${declared.id} says Len ${declared.length}, but its aligned and ungapped lengths are ${row.alignedSequence.length} and ${ungappedLength}.`,
      });
    }
  }

  return {
    format: "msf",
    metadata: {
      columns: String(observedColumns),
      declaredColumns:
        Number.isInteger(expectedColumns) && expectedColumns > 0
          ? String(expectedColumns)
          : "unknown",
    },
    rows,
    warnings,
  };
}

function parseDeclaredRows(
  lines: Array<string>,
  warnings: Array<MsaParseWarning>,
): Array<MsfDeclaredRow> {
  const rows: Array<MsfDeclaredRow> = [];
  const seen = new Set<string>();
  lines.forEach((line, index) => {
    const match = /^\s*Name:\s*(\S+)\s+Len:\s*(\d+)/i.exec(line);
    if (match == null) return;
    const id = match[1] ?? "";
    if (seen.has(id)) {
      warnings.push({
        code: "msf-duplicate-declaration",
        line: index + 1,
        message: `MSF row ${id} is declared more than once.`,
        severity: "error",
      });
      return;
    }
    seen.add(id);
    rows.push({ id, length: Number(match[2]) });
  });
  return rows;
}

function parseBlocks(
  lines: Array<string>,
  firstLineNumber: number,
  warnings: Array<MsaParseWarning>,
): Array<Array<MsfBlockRow>> {
  const blocks: Array<Array<MsfBlockRow>> = [];
  let block: Array<MsfBlockRow> = [];
  const flushBlock = (): void => {
    if (block.length > 0) blocks.push(block);
    block = [];
  };

  lines.forEach((line, index) => {
    const trimmed = line.trim();
    if (trimmed.length === 0) {
      flushBlock();
      return;
    }
    if (trimmed.startsWith("#") || /^\d+(?:\s+\d+)*$/.test(trimmed)) {
      return;
    }
    const fields = trimmed.split(/\s+/);
    const id = fields[0];
    const sequence = fields
      .slice(1)
      .filter((field) => /^[A-Za-z*?._~-]+$/.test(field))
      .join("");
    if (id == null || sequence.length === 0) {
      warnings.push({
        code: "msf-row-skipped",
        line: firstLineNumber + index,
        message: "Skipped a malformed MSF alignment row.",
      });
      return;
    }
    block.push({ id, line: firstLineNumber + index, sequence });
  });
  flushBlock();
  return blocks;
}

function normalizeMsfSequence(sequence: string): string {
  return Array.from(sequence)
    .map((symbol) => normalizeGapSymbol(symbol))
    .join("");
}

function unique(values: Array<string>): Array<string> {
  const seen = new Set<string>();
  return values.filter((value) => {
    if (seen.has(value)) return false;
    seen.add(value);
    return true;
  });
}
