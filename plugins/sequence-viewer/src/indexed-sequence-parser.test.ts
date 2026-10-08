import { describe, expect, it, vi } from "vitest";

import {
  buildIndexedPreviewContents,
  parseIndexedSequenceEnvelope,
  serializeIndexedSequenceEnvelope,
} from "./indexed-sequence-envelope";
import { parseIndexedSequenceLines } from "./indexed-sequence-parser";

// Public Biopython c9489604d1d9607602ca9199a3852c1219ed330f,
// Tests/Quality/error_diff_ids.fastq; intentionally malformed negative control.
// SHA-256: fb28be12cda772adc2ca0d29c7b1159b439472ad8383406b2be512249bda347e.
const publicMismatchedFastq = [
  "@SLXA-B3_649_FC8437_R1_1_1_610_79",
  "GATGTGCAATACCTTTGTAGAGGAA",
  "+SLXA-B3_649_FC8437_R1_1_1_610_79",
  "YYYYYYYYYYYYYYYYYYWYWYYSU",
  "@SLXA-B3_649_FC8437_R1_1_1_397_389",
  "GGTTTGAGAAAGAGAAATGAGATAA",
  "+SLXA-B3_649_FC8437_R1_1_1_397_389",
  "YYYYYYYYYWYYYYWWYYYWYWYWW",
  "@SLXA-B3_649_FC8437_R1_1_1_850_123",
  "GAGGGTGTTGATCATGATGATGGCG",
  "+SLXA-B3_649_FC8437_R1_1_1_850_124",
  "YYYYYYYYYYYYYWYYWYYSYYYSY",
  "@SLXA-B3_649_FC8437_R1_1_1_362_549",
  "GGAAACAAAGTTTTTCTCAACATAG",
  "+SLXA-B3_649_FC8437_R1_1_1_362_549",
  "YYYYYYYYYYYYYYYYYYWWWWYWY",
  "@SLXA-B3_649_FC8437_R1_1_1_183_714",
  "GTATTATTTAATGGCATACACTCAA",
  "+SLXA-B3_649_FC8437_R1_1_1_183_714",
  "YYYYYYYYYYWYYYYWYWWUWWWQQ",
  "",
].join("\n");

// Public Biopython c9489604d1d9607602ca9199a3852c1219ed330f,
// Tests/Quality/example.fastq.
// SHA-256: 10bc5b39327a363b0019193c9823bc424a6d5706197688fdbdd45023a1481a0c.
const publicValidFastq = [
  "@EAS54_6_R1_2_1_413_324",
  "CCCTTCTTGTCTTCAGCGTTTCTCC",
  "+",
  ";;3;;;;;;;;;;;;7;;;;;;;88",
  "@EAS54_6_R1_2_1_540_792",
  "TTGGCAGGCCAAGGCCGATGGATCA",
  "+",
  ";;;;;;;;;;;7;;;;;-;;;3;83",
  "@EAS54_6_R1_2_1_443_348",
  "GTTGCTTCTGGCGTGGGTGGGGGGG",
  "+",
  ";;;;;;;;;;;9;7;;.7;393333",
  "",
].join("\n");

describe("streaming indexed sequence parser", () => {
  it("indexes FASTA incrementally with a bounded materialized cache", async () => {
    const progress = vi.fn();
    const envelope = await parseIndexedSequenceLines({
      compressed: true,
      fileName: "large.fasta.gz",
      format: "fasta",
      lines: asyncLines([">a first", "ACGT", ">b", "TTTT"]),
      onProgress: progress,
      sourceBytes: 42,
    });

    expect(envelope.index).toMatchObject({
      complete: true,
      compressed: true,
      indexedRecordCount: 2,
      materializedBases: 8,
      materializedRecordCount: 2,
      sourceBytes: 42,
      sourceVersion: "size-42",
    });
    expect(envelope.document.recordInventory).toEqual({
      materializedCount: 2,
      totalCount: 2,
      truncated: false,
    });
    expect(progress).toHaveBeenCalledWith(
      expect.objectContaining({ recordCount: 2 }),
    );

    const serialized = serializeIndexedSequenceEnvelope(envelope);
    const parsed = parseIndexedSequenceEnvelope(serialized);
    expect(parsed?.document.records.map(({ id }) => id)).toEqual(["a", "b"]);
    expect(buildIndexedPreviewContents(parsed!.document)).toContain(
      ">a first\nACGT",
    );
  });

  it("excludes genuine RF00360 secondary structure from streamed RNA residues", async () => {
    // R2DT a1ca674f245e4dc13838e346b8e03295c2130d0c,
    // data/rfam/RF00360/RF00360-traveler.fasta.
    const rna =
      "NNUNGCRGUGAYGACUYGGNRANAUUCAAGCUCAACAGACCRNANYRYAGNNYUUUYUYNNNNNNNNYYNRNNGGAUYGNUUUGNNNRNNNNGAUNNYYCCGCUGANCYGAGCNRNN";
    const structure =
      "((((((.........................................................................................................))))))";
    const envelope = await parseIndexedSequenceLines({
      compressed: true,
      fileName: "RF00360-traveler.fasta.gz",
      format: "fasta",
      lines: asyncLines([">RF00360", rna, structure]),
      sourceBytes: 245,
    });

    expect(envelope.document.records[0]).toMatchObject({
      length: 117,
      molecule: "rna",
      sequence: rna,
      sourceLabel: "RF00360",
    });
    expect(envelope.document.classification.molecule).toBe("rna");
    expect(envelope.index).toMatchObject({
      decodedBytes: 245,
      indexedRecordCount: 1,
      materializedBases: 117,
    });
  });

  it("keeps gap-only FASTA rows while rejecting structure-only empty records", async () => {
    const aligned = await parseIndexedSequenceLines({
      compressed: false,
      fileName: "gaps.fasta",
      format: "fasta",
      lines: asyncLines([">gaps", "..--", ">rna", "ACGU"]),
      sourceBytes: 23,
    });

    expect(aligned.document.records.map(({ sequence }) => sequence)).toEqual([
      "..--",
      "ACGU",
    ]);

    await expect(
      parseIndexedSequenceLines({
        compressed: false,
        fileName: "structure-only.fasta",
        format: "fasta",
        lines: asyncLines([">empty", "((..))", ">valid", "ACGU"]),
        sourceBytes: 28,
      }),
    ).rejects.toThrow("does not contain a sequence");
  });

  it("does not treat structural punctuation in FASTQ quality as FASTA annotation", async () => {
    const envelope = await parseIndexedSequenceLines({
      compressed: false,
      fileName: "quality.fastq",
      format: "fastq",
      lines: asyncLines(["@read", "ACGU", "+", "(())"]),
      sourceBytes: 18,
    });

    expect(envelope.document.records[0]?.quality?.ascii).toBe("(())");
    expect(envelope.document.fastqSummary?.readCount).toBe(1);
  });

  it("rejects the public Biopython FASTQ whose third repeated identifier differs", async () => {
    await expect(
      parseIndexedSequenceLines({
        compressed: true,
        fileName: "error_diff_ids.fastq.gz",
        format: "fastq",
        lines: asyncLines(publicMismatchedFastq.trimEnd().split("\n")),
        sourceBytes: publicMismatchedFastq.length,
      }),
    ).rejects.toThrow(
      "FASTQ + label 'SLXA-B3_649_FC8437_R1_1_1_850_124' does not match header 'SLXA-B3_649_FC8437_R1_1_1_850_123'",
    );
  });

  it("rejects a mismatched repeated FASTQ title before consuming its quality", async () => {
    async function* mismatchedLines() {
      yield "@read first title";
      yield "ACGT";
      yield "+read second title";
      throw new Error("quality must not be consumed after a mismatched title");
    }

    await expect(
      parseIndexedSequenceLines({
        compressed: false,
        fileName: "different-title.fastq",
        format: "fastq",
        lines: mismatchedLines(),
        sourceBytes: 48,
      }),
    ).rejects.toThrow(
      "FASTQ + label 'read second title' does not match header 'read first title'",
    );
  });

  it("preserves valid public Biopython FASTQ bare separators and punctuation qualities", async () => {
    const envelope = await parseIndexedSequenceLines({
      compressed: true,
      fileName: "example.fastq.gz",
      format: "fastq",
      lines: asyncLines(publicValidFastq.trimEnd().split("\n")),
      sourceBytes: publicValidFastq.length,
    });

    expect(envelope.document.fastqSummary?.readCount).toBe(3);
    expect(
      envelope.document.records.map(({ quality }) => quality?.ascii),
    ).toEqual([
      ";;3;;;;;;;;;;;;7;;;;;;;88",
      ";;;;;;;;;;;7;;;;;-;;;3;83",
      ";;;;;;;;;;;9;7;;.7;393333",
    ]);
  });

  it("matches repeated FASTQ full titles while ignoring trailing whitespace", async () => {
    const envelope = await parseIndexedSequenceLines({
      compressed: false,
      fileName: "titled.fastq",
      format: "fastq",
      lines: asyncLines([
        "@read sample description  ",
        "AC",
        "GT",
        "+read sample description\t",
        "()",
        "[]",
        "@bare",
        "AC",
        "+ \t",
        "{}",
        "@  leading title  ",
        "AC",
        "+  leading title\t",
        "<>",
      ]),
      sourceBytes: 80,
    });

    expect(
      envelope.document.records.map(({ quality }) => quality?.ascii),
    ).toEqual(["()[]", "{}", "<>"]);
  });

  it("rejects repeated FASTQ titles with additional leading whitespace", async () => {
    await expect(
      parseIndexedSequenceLines({
        compressed: false,
        fileName: "different-leading-space.fastq",
        format: "fastq",
        lines: asyncLines(["@read title", "ACGT", "+ read title", "IIII"]),
        sourceBytes: 36,
      }),
    ).rejects.toThrow(
      "FASTQ + label ' read title' does not match header 'read title'",
    );
  });

  it("streams multiline FASTQ while summarizing all reads and retaining quality", async () => {
    const envelope = await parseIndexedSequenceLines({
      compressed: false,
      fileName: "reads.fastq",
      format: "fastq",
      lines: asyncLines([
        "@read1 sample",
        "AC",
        "GT",
        "+",
        "II",
        "II",
        "@read2",
        "NNNN",
        "+",
        "!!!!",
      ]),
      sourceBytes: 64,
    });

    expect(envelope.document.fastqSummary).toMatchObject({
      readCount: 2,
      totalBases: 8,
    });
    expect(envelope.document.records[0]?.quality?.phred).toEqual([
      40, 40, 40, 40,
    ]);
    expect(buildIndexedPreviewContents(envelope.document)).toContain(
      "@read2\nNNNN\n+\n!!!!",
    );
  });

  it("preserves a host-provided source identity in the indexed envelope", async () => {
    const envelope = await parseIndexedSequenceLines({
      compressed: false,
      fileName: "identity.fasta",
      format: "fasta",
      lines: asyncLines([">record", "ACGT"]),
      sourceBytes: 13,
      sourceVersion: "sha256:source-v2",
    });

    expect(envelope.index.sourceVersion).toBe("sha256:source-v2");
  });

  it("rejects fatal streaming diagnostics instead of mounting partial data", async () => {
    await expect(
      parseIndexedSequenceLines({
        compressed: false,
        fileName: "broken.fastq",
        format: "fastq",
        lines: asyncLines(["@read", "ACGT", "+", "II"]),
        sourceBytes: 18,
      }),
    ).rejects.toThrow("quality characters");
    await expect(
      parseIndexedSequenceLines({
        compressed: false,
        fileName: "broken.fasta",
        format: "fasta",
        lines: asyncLines(["ACGT"]),
        sourceBytes: 5,
      }),
    ).rejects.toThrow("before the first header");
  });

  it("honors cancellation between streamed lines", async () => {
    const controller = new AbortController();
    async function* cancellingLines() {
      yield ">a";
      controller.abort();
      yield "ACGT";
    }
    await expect(
      parseIndexedSequenceLines({
        compressed: false,
        fileName: "cancel.fasta",
        format: "fasta",
        lines: cancellingLines(),
        signal: controller.signal,
        sourceBytes: 10,
      }),
    ).rejects.toThrow("cancelled");
  });

  it("enforces a decoded byte budget inside the streaming parser", async () => {
    await expect(
      parseIndexedSequenceLines({
        compressed: true,
        fileName: "expanded.fasta.gz",
        format: "fasta",
        lines: asyncLines([">expanded", "A".repeat(128)]),
        maxDecodedBytes: 32,
        sourceBytes: 24,
      }),
    ).rejects.toThrow("32-byte decoded input budget");
  });

  it("rejects tampered envelope cache metadata", async () => {
    const envelope = await parseIndexedSequenceLines({
      compressed: false,
      fileName: "demo.fasta",
      format: "fasta",
      lines: asyncLines([">a", "ACGT"]),
      sourceBytes: 8,
    });
    const serialized = serializeIndexedSequenceEnvelope(envelope).replace(
      '"materializedBases":4',
      '"materializedBases":9',
    );
    expect(() => parseIndexedSequenceEnvelope(serialized)).toThrow(
      "metadata is inconsistent",
    );
  });

  it("keeps a generated one-million-read FASTQ bounded while summarizing every read", async () => {
    const readCount = 1_000_000;
    const startedAt = performance.now();
    async function* generatedFastq() {
      for (let index = 0; index < readCount; index += 1) {
        yield `@read-${index + 1}`;
        yield "ACGT";
        yield "+";
        yield "IIII";
      }
    }
    const envelope = await parseIndexedSequenceLines({
      compressed: true,
      fileName: "generated.fastq.gz",
      format: "fastq",
      lines: generatedFastq(),
      sourceBytes: 24_000_000,
    });
    const elapsedMs = performance.now() - startedAt;

    expect(envelope.document.fastqSummary).toMatchObject({
      readCount,
      totalBases: readCount * 4,
    });
    expect(envelope.document.records.length).toBeLessThan(readCount);
    expect(envelope.document.records.length).toBeLessThanOrEqual(5_000);
    expect(envelope.index.materializedBases).toBeLessThanOrEqual(1_000_000);
    expect(elapsedMs).toBeLessThan(30_000);
    expect(envelope.document.recordInventory).toMatchObject({
      totalCount: readCount,
      truncated: true,
    });
    expect(serializeIndexedSequenceEnvelope(envelope).length).toBeLessThan(
      4 * 1_024 * 1_024,
    );
  }, 60_000);
});

async function* asyncLines(lines: Array<string>) {
  for (const line of lines) yield line;
}
