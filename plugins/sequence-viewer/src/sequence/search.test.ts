import { describe, expect, it } from "vitest";

import { searchSequenceRecords, searchSequenceRecordsAsync } from "./search";
import type { SequenceRecord } from "./types";

const DNA_RECORD: SequenceRecord = {
  features: [],
  id: "dna",
  length: 8,
  metadata: {},
  molecule: "dna",
  sequence: "ACGTACGT",
  sourceLabel: "dna",
  topology: "linear",
};

describe("searchSequenceRecords", () => {
  it("finds forward and reverse-complement DNA hits", () => {
    expect(
      searchSequenceRecords({
        includeReverseComplement: true,
        molecule: "dna",
        query: "ACG",
        records: [DNA_RECORD],
      }).hits,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ orientation: "forward", start: 1 }),
        expect.objectContaining({ orientation: "reverse-complement" }),
      ]),
    );
  });

  it("matches IUPAC ambiguity symbols and deduplicates palindromic queries", () => {
    const result = searchSequenceRecords({
      includeReverseComplement: true,
      molecule: "dna",
      query: "RY",
      records: [{ ...DNA_RECORD, sequence: "ACGT" }],
    });

    expect(result.hits).toEqual([
      expect.objectContaining({ orientation: "forward", start: 1 }),
      expect.objectContaining({ orientation: "forward", start: 3 }),
    ]);
  });

  it("uses RNA complements and reports bounded truncation", () => {
    const result = searchSequenceRecords({
      includeReverseComplement: true,
      maxHits: 2,
      molecule: "rna",
      query: "AUG",
      records: [
        {
          ...DNA_RECORD,
          molecule: "rna",
          sequence: "AUGCAUGCAUGC",
        },
      ],
    });

    expect(result).toMatchObject({ truncated: true });
    expect(result.hits).toHaveLength(2);
  });

  it("rejects invalid nucleotide queries before reverse-complement expansion", async () => {
    const input = {
      includeReverseComplement: true,
      molecule: "dna" as const,
      query: "Z*",
      records: [{ ...DNA_RECORD, sequence: "AAAAAA" }],
    };

    expect(searchSequenceRecords(input)).toEqual({
      hits: [],
      truncated: false,
    });
    await expect(searchSequenceRecordsAsync(input)).resolves.toEqual({
      hits: [],
      truncated: false,
    });
  });

  it("stops scanning repetitive records as soon as the hit budget is proven truncated", () => {
    const result = searchSequenceRecords({
      includeReverseComplement: false,
      maxHits: 3,
      molecule: "dna",
      query: "A",
      records: [
        { ...DNA_RECORD, length: 1_000_000, sequence: "A".repeat(1_000_000) },
      ],
    });

    expect(result).toMatchObject({ truncated: true });
    expect(result.hits.map(({ start }) => start)).toEqual([1, 2, 3]);
  });

  it("matches standard protein ambiguity symbols including X as any residue", () => {
    const result = searchSequenceRecords({
      includeReverseComplement: false,
      molecule: "protein",
      query: "XJZB",
      records: [
        {
          ...DNA_RECORD,
          length: 4,
          molecule: "protein",
          sequence: "ALED",
          sourceLabel: "protein",
        },
      ],
    });

    expect(result.hits).toEqual([
      expect.objectContaining({ orientation: "forward", start: 1 }),
    ]);
  });

  it("reports comparison-budget truncation in synchronous and cooperative search", async () => {
    const input = {
      includeReverseComplement: false,
      maxComparisons: 3,
      molecule: "dna" as const,
      query: "TT",
      records: [{ ...DNA_RECORD, sequence: "AAAAAA" }],
    };

    expect(searchSequenceRecords(input)).toEqual({
      hits: [],
      truncated: true,
    });
    await expect(searchSequenceRecordsAsync(input)).resolves.toEqual({
      hits: [],
      truncated: true,
    });
  });

  it("yields while searching one very long sequence record", async () => {
    let timerRan = false;
    setTimeout(() => {
      timerRan = true;
    }, 0);

    await searchSequenceRecordsAsync({
      includeReverseComplement: false,
      molecule: "dna",
      query: "T",
      records: [
        {
          ...DNA_RECORD,
          length: 60_000,
          sequence: "A".repeat(60_000),
        },
      ],
    });

    expect(timerRan).toBe(true);
  });
});
