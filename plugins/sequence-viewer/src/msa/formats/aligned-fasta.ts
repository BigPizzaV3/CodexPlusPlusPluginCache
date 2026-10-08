import type { MsaFormatDraft } from "../types";
import { parseFastaRecords } from "./fasta-records";

export function parseAlignedFasta(contents: string): MsaFormatDraft {
  const { records, warnings } = parseFastaRecords(contents);
  return {
    format: "aligned-fasta",
    rows: records.map((record) => ({
      alignedSequence: record.sequence,
      ...(record.description == null
        ? {}
        : { description: record.description }),
      id: record.id,
      label: record.label,
    })),
    warnings,
  };
}
