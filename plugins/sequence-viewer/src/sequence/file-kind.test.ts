import { describe, expect, it } from "vitest";

import { getSequenceFormatHint } from "./file-kind";

describe("platform-independent Sequence file format detection", () => {
  it.each([
    ["/Users/researcher/data/reads.fastq.gz", "fastq"],
    ["C:\\Research Data\\reads.FASTQ.BGZ", "fastq"],
    ["\\\\lab-server\\sequencing\\genome.fasta.bgzf", "fasta"],
    ["C:/Research Data/genome.fna.bgzip", "fna"],
    ["relative/alignment.aln-fasta", "aln-fasta"],
    ["traces/sample.ab1.gz", "ab1"],
    ["constructs/plasmid.DNA", "dna"],
  ])("infers the actual source format for %s", (source, format) => {
    expect(getSequenceFormatHint(source)).toBe(format);
  });

  it("does not infer a format from a Windows or macOS directory", () => {
    expect(getSequenceFormatHint("C:\\reads.fastq\\no-extension")).toBeNull();
    expect(getSequenceFormatHint("/tmp/reads.fastq/no-extension")).toBeNull();
    expect(getSequenceFormatHint()).toBeNull();
  });
});
