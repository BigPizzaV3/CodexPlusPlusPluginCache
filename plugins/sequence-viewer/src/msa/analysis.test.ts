import { describe, expect, it } from "vitest";

import {
  buildMsaRowProjections,
  buildOverviewBuckets,
  computeMsaDerivedAnalysis,
} from "./analysis";
import {
  computeNucleotideConsensus,
  computeProteinRepresentative,
} from "./consensus";
import {
  computeColumnSummaries,
  getMeanIdentity,
  getMeanNormalizedConservation,
} from "./conservation";
import { parseMsa } from "./parser";
import {
  searchMsaMotif,
  searchMsaMotifFromProjections,
  searchMsaMotifFromProjectionsAsyncResult,
  searchMsaMotifFromProjectionsResult,
} from "./search";
import type { MsaDocument } from "./types";
import type { MsaColumnSummary } from "./conservation";

function expectDocument(contents: string, path: string): MsaDocument {
  const result = parseMsa(contents, path);
  expect(result.status).toBe("success");
  if (result.status !== "success") {
    throw new Error(result.message);
  }
  return result.document;
}

describe("computeMsaDerivedAnalysis", () => {
  it("matches the exact synchronous DNA consensus, summaries, overview, and search semantics", () => {
    const document = expectDocument(
      [">a", "AAGT", ">b", "ACGT", ">c", "A-GT"].join("\n"),
      "/tmp/dna.afa",
    );
    const analysisRowIds = document.rows.map((row) => row.id);
    const analysis = computeMsaDerivedAnalysis({
      analysisId: "dna-analysis",
      analysisRowIds,
      document,
    });
    const summaries = computeColumnSummaries(
      document.rows,
      document.displayInterpretation.moleculeType,
    );

    expect(analysis.consensusSequence).toBe(
      computeNucleotideConsensus(document.rows, "dna"),
    );
    expect(analysis.summaries).toEqual(summaries);
    expect(analysis.meanIdentity).toBe(getMeanIdentity(summaries));
    expect(analysis.meanConservationNormalized).toBe(
      getMeanNormalizedConservation(summaries),
    );
    expect(analysis.overviewBuckets).toEqual(
      buildOverviewBuckets(summaries, document.alignedLength),
    );
    expect(
      searchMsaMotifFromProjections({
        moleculeType: document.displayInterpretation.moleculeType,
        projections: analysis.projections,
        rawQuery: "ACT",
        searchCapabilities: document.searchCapabilities,
      }),
    ).toEqual(searchMsaMotif(document, "ACT"));
  });

  it("matches protein representative semantics and indexes A3M insertions by row/column", () => {
    const document = expectDocument(
      [">query", "AC-DE", ">hit", "ACaa-DE"].join("\n"),
      "/tmp/protein.a3m",
    );
    const analysis = computeMsaDerivedAnalysis({
      analysisId: "protein-analysis",
      analysisRowIds: document.rows.map((row) => row.id),
      document,
    });

    expect(analysis.consensusSequence).toBe(
      computeProteinRepresentative(document.rows),
    );
    expect(analysis.insertionByRowColumn.hit?.["1"]).toMatchObject({
      residues: "aa",
    });
  });

  it("aggregates every overview column and preserves narrow gap and identity spikes", () => {
    const base: MsaColumnSummary = {
      conservationModel: null,
      conservationNormalized: null,
      gapFraction: 0,
      identity: 1,
      nongapCount: 2,
      nucleotideInformationContentBits: null,
      proteinRelativeEntropyBits: null,
      symbolCounts: {},
      weightedSupport: 2,
      weightedSymbolFractions: {},
    };
    const summaries = Array.from({ length: 160 }, () => ({ ...base }));
    summaries[1] = { ...base, gapFraction: 1, identity: 0 };

    const buckets = buildOverviewBuckets(summaries, summaries.length);

    expect(buckets).toHaveLength(80);
    expect(buckets[0]).toMatchObject({
      gapFraction: 1,
      identity: 0,
      meanGapFraction: 0.5,
      meanIdentity: 0.5,
    });
  });

  it("bounds synchronous and cooperative motif search with explicit truncation", async () => {
    const document = expectDocument(">many\nAAAAAA", "/tmp/many.afa");
    const input = {
      maxHits: 2,
      moleculeType: document.displayInterpretation.moleculeType,
      projections: buildMsaRowProjections(document.rows),
      rawQuery: "A",
      searchCapabilities: document.searchCapabilities,
    };

    expect(searchMsaMotifFromProjectionsResult(input)).toMatchObject({
      hits: expect.any(Array),
      truncated: true,
    });
    expect(searchMsaMotifFromProjectionsResult(input).hits).toHaveLength(2);
    await expect(
      searchMsaMotifFromProjectionsAsyncResult(input),
    ).resolves.toMatchObject({ hits: expect.any(Array), truncated: true });
  });

  it("rejects invalid nucleotide motifs before reverse-complement expansion", async () => {
    const document = expectDocument(">dna\nAAAAAA", "/tmp/invalid-query.afa");
    const input = {
      moleculeType: document.displayInterpretation.moleculeType,
      projections: buildMsaRowProjections(document.rows),
      rawQuery: "Z*",
      searchCapabilities: document.searchCapabilities,
    };

    expect(searchMsaMotifFromProjectionsResult(input)).toEqual({
      hits: [],
      truncated: false,
    });
    await expect(
      searchMsaMotifFromProjectionsAsyncResult(input),
    ).resolves.toEqual({ hits: [], truncated: false });
  });

  it("yields during a single very wide row instead of blocking until the row ends", async () => {
    const document = expectDocument(
      `>wide\n${"A".repeat(60_000)}`,
      "/tmp/wide.afa",
    );
    let timerRan = false;
    setTimeout(() => {
      timerRan = true;
    }, 0);

    await searchMsaMotifFromProjectionsAsyncResult({
      moleculeType: document.displayInterpretation.moleculeType,
      projections: buildMsaRowProjections(document.rows),
      rawQuery: "TTTT",
      searchCapabilities: {
        ...document.searchCapabilities,
        supportsReverseComplement: false,
      },
    });

    expect(timerRan).toBe(true);
  });

  it("indexes RNA pairing lookups and recomputes conservation against visible row ids", () => {
    const document = expectDocument(
      [
        "# STOCKHOLM 1.0",
        "rna1 AC-G",
        "rna2 AU-G",
        "#=GC SS_cons <<>>",
        "//",
      ].join("\n"),
      "/tmp/rna.sto",
    );
    const analysisRowIds = [document.rows[0]!.id];
    const analysis = computeMsaDerivedAnalysis({
      analysisId: "rna-analysis",
      analysisRowIds,
      document,
    });

    expect(analysis.pairByColumn["0"]).toBeDefined();
    expect(analysis.pairByColumn["3"]).toBeDefined();
    expect(analysis.summaries).toEqual(
      computeColumnSummaries(
        [document.rows[0]!],
        document.displayInterpretation.moleculeType,
      ),
    );
    expect(analysis.rnaStructureConsensusByColumn["0"]).toBeDefined();
  });

  it("keeps an explicitly empty displayed-row scope empty", () => {
    const document = expectDocument(
      [">a", "ACGT", ">b", "ACGT"].join("\n"),
      "/tmp/empty-scope.afa",
    );
    const analysis = computeMsaDerivedAnalysis({
      analysisId: "empty-analysis",
      analysisRowIds: [],
      document,
    });

    expect(analysis.consensusSequence).toBe("");
    expect(analysis.summaries).toEqual([]);
    expect(analysis.meanIdentity).toBe(0);
  });
});
