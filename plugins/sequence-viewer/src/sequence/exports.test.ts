import { describe, expect, it } from "vitest";

import {
  buildFastaExport,
  buildFastqExport,
  buildSelectedSequenceExport,
  getSequenceExportFileName,
} from "./exports";
import type { SequenceDocument, SequenceRecord } from "./types";

const RECORD: SequenceRecord = {
  features: [],
  id: "demo",
  length: 8,
  metadata: {},
  molecule: "dna",
  quality: { ascii: "IIIIIIII", phred: Array(8).fill(40) },
  sequence: "ACGTACGT",
  sourceLabel: "demo",
  topology: "linear",
};

const DOCUMENT: SequenceDocument = {
  classification: {
    alignment: null,
    confidence: "high",
    evidence: [],
    kind: "single-sequence",
    molecule: "dna",
    suggestedViewer: "sequence",
  },
  format: "fasta",
  kind: "single-sequence",
  records: [RECORD],
  warnings: [],
};

describe("sequence exports", () => {
  it("builds FASTA, selected-range FASTA, and FASTQ payloads", () => {
    expect(buildFastaExport([RECORD])).toBe(">demo\nACGTACGT");
    expect(
      buildSelectedSequenceExport({
        document: DOCUMENT,
        selection: { end: 4, recordId: "demo", start: 2 },
      }),
    ).toBe(">demo:2-4\nCGT");
    expect(buildFastqExport(RECORD)).toBe("@demo\nACGTACGT\n+\nIIIIIIII");
  });

  it("creates safe export file names for records and selected ranges", () => {
    expect(getSequenceExportFileName({ record: RECORD, suffix: "fasta" })).toBe(
      "demo.fasta",
    );
    expect(
      getSequenceExportFileName({
        record: RECORD,
        selection: { end: 4, recordId: RECORD.id, start: 2 },
        suffix: "fasta",
      }),
    ).toBe("demo-2-4.fasta");
  });
});
