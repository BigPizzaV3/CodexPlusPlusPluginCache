import { normalizeGapSymbol } from "../residue-alphabet";
import type { MsaFormat, MsaFormatDraft, MsaInsertionRun } from "../types";
import { parseFastaRecords } from "./fasta-records";

export function parseA2mA3m(
  contents: string,
  format: Extract<MsaFormat, "a2m" | "a3m">,
): MsaFormatDraft {
  const { records, warnings } = parseFastaRecords(contents, {
    preserveGapSymbols: true,
  });
  const insertions: Array<MsaInsertionRun> = [];

  if (format === "a2m") {
    return parseA2m(records, warnings, insertions);
  }

  const rows = records.map((record, sourceRowIndex) => {
    let alignmentColumn = -1;
    let scaffold = "";
    let activeInsertion = "";
    const flushInsertion = (): void => {
      if (activeInsertion.length === 0) {
        return;
      }
      insertions.push({
        afterAlignmentColumn: alignmentColumn,
        residues: activeInsertion,
        rowId: record.id,
        sourceRowIndex,
        sourceKind: "a2m-a3m-lowercase",
      });
      activeInsertion = "";
    };

    for (const rawSymbol of record.sequence) {
      if (rawSymbol === ".") {
        throw new Error(
          `A3M row ${record.id} contains a period. A3M omits insertion-gap columns; use lowercase residues for insertions or open this file as A2M.`,
        );
      }
      if (/[a-z]/.test(rawSymbol)) {
        activeInsertion += rawSymbol;
        continue;
      }
      flushInsertion();
      scaffold += normalizeGapSymbol(rawSymbol);
      alignmentColumn += 1;
    }
    flushInsertion();

    return {
      alignedSequence: scaffold,
      ...(record.description == null
        ? {}
        : { description: record.description }),
      id: record.id,
      label: record.label,
    };
  });

  return { format, insertions, rows, warnings };
}

type FastaRecord = ReturnType<typeof parseFastaRecords>["records"][number];

function parseA2m(
  records: Array<FastaRecord>,
  warnings: MsaFormatDraft["warnings"],
  insertions: Array<MsaInsertionRun>,
): MsaFormatDraft {
  const rawWidth = records[0]?.sequence.length ?? 0;
  const widthMismatch = records.find(
    ({ sequence }) => sequence.length !== rawWidth,
  );
  if (widthMismatch != null) {
    throw new Error(
      `A2M row ${widthMismatch.id} has width ${widthMismatch.sequence.length}, but aligned A2M rows must all have raw width ${rawWidth}.`,
    );
  }

  const insertionColumns = Array.from({ length: rawWidth }, (_, column) => {
    const symbols = records.map(({ sequence }) => sequence[column] ?? "");
    const hasInsertionSymbol = symbols.some(
      (symbol) => symbol === "." || /[a-z]/.test(symbol),
    );
    const hasMatchSymbol = symbols.some(
      (symbol) => symbol !== "." && !/[a-z]/.test(symbol),
    );
    if (hasInsertionSymbol && hasMatchSymbol) {
      throw new Error(
        `A2M column ${column + 1} mixes insertion symbols (lowercase residues or periods) with match symbols (uppercase residues or dashes).`,
      );
    }
    return hasInsertionSymbol;
  });

  const rows = records.map((record, sourceRowIndex) => {
    let alignmentColumn = -1;
    let scaffold = "";
    let activeInsertion = "";
    const flushInsertion = (): void => {
      if (activeInsertion.length === 0) return;
      insertions.push({
        afterAlignmentColumn: alignmentColumn,
        residues: activeInsertion,
        rowId: record.id,
        sourceRowIndex,
        sourceKind: "a2m-a3m-lowercase",
      });
      activeInsertion = "";
    };

    for (let column = 0; column < rawWidth; column += 1) {
      const rawSymbol = record.sequence[column] ?? "";
      if (insertionColumns[column]) {
        if (rawSymbol !== ".") activeInsertion += rawSymbol;
        continue;
      }
      flushInsertion();
      scaffold += normalizeGapSymbol(rawSymbol);
      alignmentColumn += 1;
    }
    flushInsertion();

    return {
      alignedSequence: scaffold,
      ...(record.description == null
        ? {}
        : { description: record.description }),
      id: record.id,
      label: record.label,
    };
  });

  return { format: "a2m", insertions, rows, warnings };
}
