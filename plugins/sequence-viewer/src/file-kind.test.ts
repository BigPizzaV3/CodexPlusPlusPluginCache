import { describe, expect, it } from "vitest";

import { isSupportedBiologicalSequenceFileName } from "./file-kind";

describe("platform-independent biological sequence file entrypoints", () => {
  it.each([
    "/Users/researcher/sequence.data/reads.fastq.gz",
    "C:\\Research Data\\reads.fastq.bgz",
    "\\\\lab-server\\sequencing\\genome.FASTA.BGZF",
    "C:/Research Data/alignment.aln-fasta.bgzip",
    "project/genome.FNA",
    "C:\\Research Data\\sample.AB1",
    "traces/sample.abi.gz",
    "traces/sample.scf",
    "constructs/plasmid.dna",
  ])("recognizes the actual source path %s", (source) => {
    expect(isSupportedBiologicalSequenceFileName(source)).toBe(true);
  });

  it("does not interpret a dotted directory as a sequence extension", () => {
    expect(
      isSupportedBiologicalSequenceFileName("C:\\sequence.fasta\\no-extension"),
    ).toBe(false);
    expect(
      isSupportedBiologicalSequenceFileName(
        "/Users/sequence.fasta/no-extension",
      ),
    ).toBe(false);
  });
});
