import { describe, expect, it } from "vitest";

import {
  biologicalFileBasename,
  isGzipCompressedBiologicalFileName,
  stripBiologicalCompressionSuffix,
} from "./compressed-file-name";

describe("platform-independent biological file names", () => {
  it.each([
    ["/Users/researcher/data/reads.fastq.gz", "reads.fastq.gz", "reads.fastq"],
    ["C:\\Research Data\\reads.fastq.bgz", "reads.fastq.bgz", "reads.fastq"],
    [
      "\\\\lab-server\\sequencing\\reads.FASTQ.BGZF",
      "reads.FASTQ.BGZF",
      "reads.FASTQ",
    ],
    [
      "C:/Research Data/alignment.fasta.bgzip",
      "alignment.fasta.bgzip",
      "alignment.fasta",
    ],
  ])("recognizes the genuine compressed source %s", (source, basename, raw) => {
    expect(biologicalFileBasename(source)).toBe(basename);
    expect(isGzipCompressedBiologicalFileName(basename)).toBe(true);
    expect(stripBiologicalCompressionSuffix(basename)).toBe(raw);
  });

  it("leaves uncompressed and unrelated extensions unchanged", () => {
    for (const name of ["reads.fastq", "records.fasta", "archive.gzip.txt"]) {
      expect(isGzipCompressedBiologicalFileName(name)).toBe(false);
      expect(stripBiologicalCompressionSuffix(name)).toBe(name);
    }
  });
});
