import { describe, expect, it } from "vitest";

import {
  binReadCoverage,
  DEFAULT_READ_PILEUP_FILTERS,
  findVisibleReadMate,
  getReadCigarGeometry,
  mappingQualityLabel,
  mappingQualityOpacity,
  projectReadAlignment,
  readPassesPileupFilters,
  type ReadPileupEntry,
} from "./read-pileup";
import { parseSam, type TrackRead } from "./tracks";

const REFERENCE = "AGCATGTTAGATAAGATAGCTGTGCTAGTAGGCAGTCAGCGCCAT";

function samRead(line: string): TrackRead {
  const read = parseSam(line)[0];
  if (read == null) throw new Error("Expected a mapped fixture read.");
  return read;
}

function project(read: TrackRead, start = 1, end = 45) {
  return projectReadAlignment({
    read,
    referenceSequence: REFERENCE,
    range: { end, start },
  });
}

describe("browser-safe read pileup", () => {
  // Exact alignment records from SAM v1.6 section 1.1:
  // https://samtools.github.io/hts-specs/SAMv1.pdf
  it("projects the official insertion/deletion example without advancing the reference for I", () => {
    const read = samRead(
      "r001\t99\tref\t7\t30\t8M2I4M1D3M\t=\t37\t39\tTTAGATAAAGGATACTG\t*",
    );
    const projection = project(read);
    expect(projection.unavailableReason).toBeNull();
    expect(projection.blocks).toEqual([
      { start: 7, end: 14, operation: "M" },
      { start: 15, end: 18, operation: "M" },
      { start: 19, end: 19, operation: "D" },
      { start: 20, end: 22, operation: "M" },
    ]);
    expect(projection.markers).toEqual([
      { anchor: 15, kind: "insertion", length: 2, sequence: "AG" },
    ]);
    expect(projection.bases.find((base) => base.coordinate === 15)?.base).toBe(
      "G",
    );
    expect(projection.bases.some((base) => base.coordinate === 19)).toBe(false);
  });

  it("keeps official RNA-style reference skips separate from aligned blocks and deletions", () => {
    const read = samRead(
      "r004\t0\tref\t16\t30\t6M14N5M\t*\t0\t0\tATAGCTTCAGC\t*",
    );
    expect(project(read).blocks).toEqual([
      { start: 16, end: 21, operation: "M" },
      { start: 22, end: 35, operation: "N" },
      { start: 36, end: 40, operation: "M" },
    ]);
    expect(
      getReadCigarGeometry(read, { start: 20, end: 38 }).intervals,
    ).toEqual([
      { start1: 20, end1: 21 },
      { start1: 36, end1: 38 },
    ]);
    expect(project(read, 25, 30).bases).toEqual([]);
  });

  it("places soft clipping at a boundary and does not let padding consume query bases", () => {
    const read = samRead(
      "r002\t0\tref\t9\t30\t3S6M1P1I4M\t*\t0\t0\tAAAAGATAAGGATA\t*",
    );
    const projection = project(read);
    expect(projection.markers).toEqual([
      { anchor: 9, kind: "soft-clip", length: 3, sequence: "AAA" },
      { anchor: 15, kind: "insertion", length: 1, sequence: "G" },
    ]);
    expect(projection.bases[0]).toMatchObject({ base: "A", coordinate: 9 });
    expect(projection.bases).toHaveLength(10);
  });

  it("does not reverse-complement SAM reverse-strand SEQ or reverse its QUAL again", () => {
    const read = samRead("reverse\t16\tref\t1\t60\t4M\t*\t0\t0\tAGCT\t!+5I");
    const projection = projectReadAlignment({
      read,
      referenceSequence: "AGCA",
      range: { start: 1, end: 4 },
    });
    expect(
      projection.bases.map(({ base, quality }) => [base, quality]),
    ).toEqual([
      ["A", 0],
      ["G", 10],
      ["C", 20],
      ["T", 40],
    ]);
    expect(
      projection.bases.filter((base) => base.comparison === "mismatch"),
    ).toEqual([
      {
        base: "T",
        comparison: "mismatch",
        coordinate: 4,
        quality: 40,
        referenceBase: "A",
      },
    ]);
  });

  it("uses the loaded reference for =/X, without calling ambiguous or unavailable bases mismatches", () => {
    const read = samRead("mixed\t0\tref\t1\t60\t2=1X2M\t*\t0\t0\t=AGNC\t*");
    const projection = projectReadAlignment({
      read,
      referenceSequence: "AACNN",
      range: { start: 1, end: 5 },
    });
    expect(
      projection.bases.map(({ base, comparison }) => [base, comparison]),
    ).toEqual([
      ["A", "match"],
      ["A", "match"],
      ["G", "mismatch"],
      ["N", "unknown"],
      ["C", "unknown"],
    ]);
    expect(projection.bases.every((base) => base.quality === null)).toBe(true);
  });

  it("supports missing SEQ without fabricating bases, and reports hard clips without inventing their sequence", () => {
    const missing = samRead("missing\t0\tref\t1\t60\t4M\t*\t0\t0\t*\t*");
    expect(project(missing)).toMatchObject({
      bases: [],
      blocks: [{ start: 1, end: 4, operation: "M" }],
      unavailableReason: null,
    });
    const clipped = samRead(
      "clipped\t0\tref\t1\t60\t2H2S4M1S3H\t*\t0\t0\tTTAGCAT\tIIIIIII",
    );
    expect(project(clipped)).toMatchObject({
      hardClippedBases: 5,
      markers: [
        { anchor: 1, kind: "soft-clip", length: 2, sequence: "TT" },
        { anchor: 5, kind: "soft-clip", length: 1, sequence: "T" },
      ],
      unavailableReason: null,
    });
  });

  it.each([
    "*",
    "0M",
    "3M1B",
    "9007199254740992M",
    "3Mgarbage",
    "2M1S1M",
    "1M1H3M",
  ])(
    "does not render an approximate span for unavailable or malformed CIGAR %s",
    (cigar) => {
      const read = {
        ...samRead("read\t0\tref\t1\t60\t4M\t*\t0\t0\tAGCA\tIIII"),
        cigar,
      };
      expect(project(read)).toMatchObject({
        bases: [],
        blocks: [],
        markers: [],
        unavailableReason: expect.any(String),
      });
    },
  );

  it("rejects a SEQ/CIGAR length discrepancy and bounds detail in wide windows", () => {
    const read = samRead("read\t0\tref\t1\t60\t4M\t*\t0\t0\tAGCA\tIIII");
    expect(project({ ...read, sequence: "AAA" }).unavailableReason).toMatch(
      /query length/,
    );
    expect(project(read, 1, 1_000)).toMatchObject({
      bases: [],
      blocks: [{ start: 1, end: 4, operation: "M" }],
      unavailableReason: null,
    });
    const complex = samRead(
      `complex\t0\tref\t1\t60\t${"1M1D".repeat(150)}\t*\t0\t0\t${"A".repeat(150)}\t*`,
    );
    expect(project(complex, 1, 300)).toMatchObject({
      blocks: [],
      unavailableReason: expect.stringMatching(/256 CIGAR operations/),
    });
    expect(project(complex, 1, 20).unavailableReason).toBeNull();
  });
});

describe("read filters and metadata", () => {
  const read = samRead("read\t0\tref\t1\t60\t4M\t*\t0\t0\tAGCA\tIIII");

  it("treats MAPQ 255 as explicitly unavailable, not as a high-confidence score", () => {
    const unknown = { ...read, mappingQuality: 255 };
    const filters = {
      ...DEFAULT_READ_PILEUP_FILTERS,
      minimumMappingQuality: 30,
      includeUnknownMappingQuality: false,
    };
    expect(readPassesPileupFilters(read, filters)).toBe(true);
    expect(
      readPassesPileupFilters({ ...read, mappingQuality: 20 }, filters),
    ).toBe(false);
    expect(readPassesPileupFilters(unknown, filters)).toBe(false);
    expect(
      readPassesPileupFilters(unknown, {
        ...filters,
        includeUnknownMappingQuality: true,
      }),
    ).toBe(true);
    expect(mappingQualityLabel(255)).toBe("Unavailable (255)");
    expect(mappingQualityOpacity(255)).toBeLessThan(mappingQualityOpacity(60));
  });

  it("filters strands and SAM flags without dropping unrelated reads", () => {
    expect(
      readPassesPileupFilters(read, {
        ...DEFAULT_READ_PILEUP_FILTERS,
        strand: "-",
      }),
    ).toBe(false);
    for (const [flag, key] of [
      [0x400, "includeDuplicates"],
      [0x200, "includeQcFailed"],
      [0x100, "includeSecondary"],
      [0x800, "includeSupplementary"],
    ] as const) {
      expect(
        readPassesPileupFilters(
          { ...read, flags: flag },
          { ...DEFAULT_READ_PILEUP_FILTERS, [key]: false },
        ),
      ).toBe(false);
      expect(
        readPassesPileupFilters(read, {
          ...DEFAULT_READ_PILEUP_FILTERS,
          [key]: false,
        }),
      ).toBe(true);
    }
  });

  it("links reciprocal primary mates only within the same source and read group", () => {
    const first: ReadPileupEntry = {
      key: "a:0",
      trackId: "a",
      sourceReadIndex: 0,
      trackName: "reads.sam",
      read: samRead(
        "r001\t99\tref\t7\t30\t8M2I4M1D3M\t=\t37\t39\tTTAGATAAAGGATACTG\t*",
      ),
    };
    const second: ReadPileupEntry = {
      key: "a:1",
      trackId: "a",
      sourceReadIndex: 1,
      trackName: "reads.sam",
      read: samRead(
        "r001\t147\tref\t37\t30\t9M\t=\t7\t-39\tCAGCGGCAT\t*\tNM:i:1",
      ),
    };
    expect(findVisibleReadMate(first, [first, second])).toBe(second);
    expect(
      findVisibleReadMate(first, [first, { ...second, trackId: "b" }]),
    ).toBeNull();
    expect(
      findVisibleReadMate(first, [
        first,
        { ...second, read: { ...second.read, matePosition: 9 } },
      ]),
    ).toBeNull();
    expect(
      findVisibleReadMate(first, [
        first,
        {
          ...second,
          read: { ...second.read, flags: second.read.flags | 0x800 },
        },
      ]),
    ).toBeNull();
    expect(
      findVisibleReadMate(first, [
        first,
        { ...second, read: { ...second.read, tags: { RG: "other" } } },
      ]),
    ).toBeNull();
    expect(
      findVisibleReadMate(first, [first, second, { ...second, key: "a:2" }]),
    ).toBeNull();
  });
});

describe("coverage display bins", () => {
  it("keeps a one-base peak and all source coordinates when reducing the plot", () => {
    const coverage = Array.from({ length: 1_003 }, (_, index) => ({
      coordinate: 101 + index,
      depth: index === 7 ? 50 : 0,
    }));
    const bins = binReadCoverage(coverage, 100);
    expect(bins).toHaveLength(100);
    expect(bins[0]).toEqual({ start: 101, end: 110, maximumDepth: 50 });
    expect(bins.at(-1)?.end).toBe(1_103);
    expect(bins.reduce((sum, bin) => sum + bin.end - bin.start + 1, 0)).toBe(
      coverage.length,
    );
    expect(binReadCoverage([], 10)).toEqual([]);
    expect(binReadCoverage(coverage, 0)).toEqual([]);
  });
});
