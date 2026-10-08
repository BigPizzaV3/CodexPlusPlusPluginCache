import { describe, expect, it, vi } from "vitest";

import {
  analyzeFastqQualityReport,
  FASTQ_QUALITY_REPORT_LIMITS,
  groupFastqDistribution,
  groupFastqQualityCycles,
  parseFastqAdapterSequence,
  summarizeFastqQualityReport,
} from "./fastq-quality-analysis";
import { parseSequenceDocument } from "./parser";
import type { SequenceDocument } from "./types";

describe("bounded FASTQ quality reports", () => {
  it("reuses cycle and distribution analysis while counting complete repeated reads exactly", async () => {
    const document = fixtureDocument();
    const original = structuredClone(document);

    const report = await analyzeFastqQualityReport(document);

    expect(report.scope).toMatchObject({
      analyzedBases: 22,
      analyzedReads: 4,
      isSubset: false,
      populationReads: 4,
    });
    expect(report.qc.cycles[0]).toMatchObject({
      bases: { A: 2, G: 1, N: 1 },
      quality: { count: 4, max: 40, mean: 22.5, min: 0 },
    });
    expect(report.qc.lengthDistribution).toEqual([
      { count: 1, length: 2 },
      { count: 1, length: 4 },
      { count: 2, length: 8 },
    ]);
    expect(report.qc.gcDistribution).toEqual([
      { count: 2, percent: 50 },
      { count: 1, percent: 100 },
      { count: 1, percent: null },
    ]);
    expect(report.meanReadQualityDistribution).toEqual([
      { count: 1, value: 0 },
      { count: 1, value: 20 },
      { count: 1, value: 30 },
      { count: 1, value: 40 },
    ]);
    expect(report.frequentSequences).toEqual([
      { count: 2, fraction: 0.5, sequence: "ACGTACGT" },
    ]);
    expect(report.duplicateReadCount).toBe(1);
    expect(report.uniqueSequenceCount).toBe(3);
    expect(report.qc.overrepresentedKmers).toEqual([
      { count: 2, fraction: 0.5, kmer: "ACGTACG" },
      { count: 2, fraction: 0.5, kmer: "CGTACGT" },
    ]);
    expect(report.adapterSequence).toBeNull();
    expect(report.qc.adapters).toEqual([]);
    expect(document).toEqual(original);
  });

  it("never promotes a retained-read profile to whole-file evidence", async () => {
    const original = fixtureDocument();
    const document = {
      ...original,
      recordInventory: { materializedCount: 2, totalCount: 4, truncated: true },
      records: original.records.slice(0, 2),
    };

    const report = await analyzeFastqQualityReport(document);

    expect(report.qc.complete).toBe(true);
    expect(report.scope).toMatchObject({
      analyzedReads: 2,
      isSubset: true,
      populationReads: 4,
      retainedReads: 2,
    });
  });

  it("bounds complete-read analysis by both read count and base count", async () => {
    const readLimited = makeFastq(
      Array.from(
        { length: FASTQ_QUALITY_REPORT_LIMITS.maxAnalyzedReads + 1 },
        () => ["ACGT", "IIII"],
      ),
    );
    const readReport = await analyzeFastqQualityReport(readLimited);
    expect(readReport.scope.analyzedReads).toBe(1_000);
    expect(readReport.scope.isSubset).toBe(true);

    const baseLimited = makeFastq(
      Array.from({ length: 100 }, () => ["A".repeat(1_500), "I".repeat(1_500)]),
    );
    const baseReport = await analyzeFastqQualityReport(baseLimited);
    expect(baseReport.scope).toMatchObject({
      analyzedBases: 99_000,
      analyzedReads: 66,
      isSubset: true,
      populationReads: 100,
    });
    expect(baseReport.qc.lengthDistribution).toEqual([
      { count: 66, length: 1_500 },
    ]);
  });

  it("excludes oversized and quality-less reads instead of analyzing a cut sequence", async () => {
    const longLength = FASTQ_QUALITY_REPORT_LIMITS.maxReadLength + 1;
    const original = makeFastq([
      ["A".repeat(longLength), "I".repeat(longLength)],
      ["CCCC", "IIII"],
      ["GGGG", "????"],
    ]);
    const document: SequenceDocument = {
      ...original,
      records: original.records.map((record, index) =>
        index === 1 ? { ...record, quality: undefined } : record,
      ),
    };

    const report = await analyzeFastqQualityReport(document);

    expect(report.scope).toMatchObject({
      analyzedBases: 4,
      analyzedReads: 1,
      isSubset: true,
      missingQualityReads: 1,
      oversizedReads: 1,
    });
    expect(report.qc.lengthDistribution).toEqual([{ count: 1, length: 4 }]);
    await expect(
      analyzeFastqQualityReport({
        ...document,
        records: document.records.slice(0, 2),
      }),
    ).rejects.toThrow(/No retained reads have complete qualities/);
  });

  it("rejects malformed quality length before any unbounded preprocessing", async () => {
    const original = fixtureDocument();
    const first = original.records[0]!;
    const document: SequenceDocument = {
      ...original,
      records: [
        { ...first, quality: { ascii: "I".repeat(100_001), phred: [40] } },
      ],
    };
    const charCodeAt = vi.spyOn(String.prototype, "charCodeAt");
    try {
      await expect(analyzeFastqQualityReport(document)).rejects.toThrow(
        /quality length does not match/,
      );
      expect(charCodeAt).not.toHaveBeenCalled();
    } finally {
      charCodeAt.mockRestore();
    }
  });

  it("uses all counted windows, not reads, as the k-mer fraction denominator", async () => {
    const report = await analyzeFastqQualityReport(
      makeFastq([
        ["AAAAAAAAA", "IIIIIIIII"],
        ["AAAAAAAA", "IIIIIIII"],
        ["CGTCGTCGT", "IIIIIIIII"],
      ]),
    );
    expect(report.qc.overrepresentedKmers).toEqual([
      { count: 5, fraction: 5 / 8, kmer: "AAAAAAA" },
    ]);
  });

  it("projects the same report into bounded model and chart data without full long-read sequences", async () => {
    const sequences = ["A", "C", "G", "T", "N"].flatMap((base) => [
      base.repeat(10_000),
      base.repeat(10_000),
    ]);
    const report = await analyzeFastqQualityReport(
      makeFastq(
        sequences.map((sequence) => [sequence, "I".repeat(sequence.length)]),
      ),
    );
    const summary = summarizeFastqQualityReport(report);
    const serialized = JSON.stringify(summary);
    expect(summary.cycleBins.length).toBeLessThanOrEqual(80);
    expect(summary.scope.description).toContain(
      "Analyzed 10 of 10 parsed reads",
    );
    expect(
      summary.frequentSequences.every(
        ({ sequencePreview, sequenceTruncated }) =>
          sequenceTruncated && sequencePreview.length <= 48,
      ),
    ).toBe(true);
    expect(summary.frequentSequences[0]?.sequenceLength).toBe(10_000);
    expect(serialized).not.toContain("A".repeat(100));
    expect(new TextEncoder().encode(serialized).byteLength).toBeLessThanOrEqual(
      FASTQ_QUALITY_REPORT_LIMITS.maxStructuredReportBytes,
    );
  });

  it("screens only the exact supplied forward sequence and does not infer adapters", async () => {
    const document = makeFastq([
      ["ACGTACGATT", "IIIIIIIIII"],
      ["ACGTTCGA", "IIIIIIII"],
      ["TCGTACGT", "IIIIIIII"],
      ["ACGTACG", "IIIIIII"],
    ]);
    const report = await analyzeFastqQualityReport(document, {
      adapterSequence: " acgt acga ",
    });
    expect(report.adapterSequence).toBe("ACGTACGA");
    expect(report.qc.adapters).toEqual([
      { id: "user-supplied", occurrences: 1, records: 1, sequence: "ACGTACGA" },
    ]);
  });

  it("does not collapse reverse-complement reads when counting repeated sequences", async () => {
    const report = await analyzeFastqQualityReport(
      makeFastq([
        ["AAAACCCC", "IIIIIIII"],
        ["GGGGTTTT", "IIIIIIII"],
      ]),
    );
    expect(report.duplicateReadCount).toBe(0);
    expect(report.uniqueSequenceCount).toBe(2);
  });

  it("cancels before retaining or publishing another report", async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(
      analyzeFastqQualityReport(fixtureDocument(), {
        signal: controller.signal,
      }),
    ).rejects.toMatchObject({ name: "AbortError" });
  });

  it("weights grouped cycles by observations and preserves all plotted observations", async () => {
    const report = await analyzeFastqQualityReport(
      makeFastq([
        ["A".repeat(81), "I".repeat(81)],
        ["A", "!"],
      ]),
    );
    const bins = groupFastqQualityCycles(report.qc.cycles);
    expect(bins.length).toBeLessThanOrEqual(
      FASTQ_QUALITY_REPORT_LIMITS.maxCycleBins,
    );
    expect(bins[0]).toMatchObject({
      count: 3,
      end: 2,
      maximum: 40,
      minimum: 0,
      start: 1,
    });
    expect(bins[0]!.mean).toBeCloseTo(80 / 3);
    expect(bins.reduce((sum, bin) => sum + bin.count, 0)).toBe(82);
  });

  it("keeps histogram counts and empty intervals within a fixed rendering budget", () => {
    const bins = groupFastqDistribution([
      { count: 2, value: 1 },
      { count: 3, value: 10_000 },
    ]);
    expect(bins).toHaveLength(40);
    expect(bins[0]).toEqual({ count: 2, end: 250, start: 1 });
    expect(bins.at(-1)).toEqual({ count: 3, end: 10_000, start: 9_751 });
    expect(bins.reduce((sum, bin) => sum + bin.count, 0)).toBe(5);
    expect(bins.filter(({ count }) => count === 0)).toHaveLength(38);
  });

  it("accepts only a bounded, explicitly supplied canonical adapter sequence", () => {
    expect(parseFastqAdapterSequence("  acgt acgt\n")).toBe("ACGTACGT");
    expect(parseFastqAdapterSequence("")).toBeNull();
    expect(() => parseFastqAdapterSequence("ACGTNNNN")).toThrow(
      /8–64 A\/C\/G\/T/,
    );
    expect(() => parseFastqAdapterSequence("A".repeat(65))).toThrow(
      /8–64 A\/C\/G\/T/,
    );
  });
});

function fixtureDocument(): SequenceDocument {
  return makeFastq([
    ["ACGTACGT", "IIIIIIII"],
    ["ACGTACGT", "55555555"],
    ["NNNN", "!!!!"],
    ["GG", "??"],
  ]);
}

function makeFastq(records: Array<Array<string>>): SequenceDocument {
  return parseSequenceDocument({
    contents: records
      .flatMap(([sequence, quality], index) => [
        `@synthetic-qc-test-${index + 1}`,
        sequence,
        "+",
        quality,
      ])
      .join("\n"),
    fileName: "synthetic-qc-tests.fastq",
  });
}
