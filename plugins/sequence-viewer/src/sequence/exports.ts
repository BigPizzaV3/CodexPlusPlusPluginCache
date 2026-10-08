import type {
  SequenceDocument,
  SequenceRecord,
  SequenceSelection,
} from "./types";
import { extractSelectedSequence } from "./selection";

export function buildFastaExport(records: Array<SequenceRecord>): string {
  return records
    .map(
      (record) =>
        `>${record.sourceLabel}${record.description == null ? "" : ` ${record.description}`}\n${wrapSequence(record.sequence)}`,
    )
    .join("\n");
}

export function buildSelectedSequenceExport({
  document,
  selection,
}: {
  document: SequenceDocument;
  selection: SequenceSelection;
}): string {
  const record = document.records.find(({ id }) => id === selection.recordId);
  if (record == null) {
    throw new Error("Selected sequence record could not be found.");
  }
  const sequence = extractSelectedSequence(record, selection);
  const range =
    selection.segments == null
      ? `${selection.start}-${selection.end}`
      : selection.segments
          .map(({ end, start }) => `${start}-${end}`)
          .join(",");
  return `>${record.sourceLabel}:${range}\n${wrapSequence(sequence)}`;
}

export function buildFastqExport(record: SequenceRecord): string {
  if (record.quality == null) {
    throw new Error("Selected record does not include FASTQ quality.");
  }
  return `@${record.sourceLabel}\n${record.sequence}\n+\n${record.quality.ascii}`;
}

export function getSequenceExportFileName({
  record,
  selection,
  suffix,
}: {
  record: SequenceRecord;
  selection?: SequenceSelection;
  suffix: "fasta" | "fastq";
}): string {
  const recordFileStem = sanitizeFileName(record.sourceLabel) || "sequence";
  const rangeSuffix =
    selection == null
      ? ""
      : `-${selection.start}-${selection.end}${selection.segments == null ? "" : "-origin-spanning"}`;
  return `${recordFileStem}${rangeSuffix}.${suffix}`;
}

function wrapSequence(sequence: string, width = 80): string {
  const lines: Array<string> = [];
  for (let start = 0; start < sequence.length; start += width) {
    lines.push(sequence.slice(start, start + width));
  }
  return lines.join("\n");
}

function sanitizeFileName(value: string): string {
  return value.replaceAll(/[^A-Za-z0-9._-]+/g, "-").replaceAll(/^-+|-+$/g, "");
}
