import { describe, expect, it } from "vitest";

import { computeMsaDerivedAnalysis } from "./analysis";
import { computeNucleotideConsensus } from "./consensus";
import { computeColumnSummaries, computeHenikoffWeights } from "./conservation";
import { parseMsa } from "./parser";
import type { MsaDocument } from "./types";

function expectDocument(contents: string, path: string): MsaDocument {
  const parsed = parseMsa(contents, path);
  expect(parsed.status).toBe("success");
  if (parsed.status !== "success") {
    throw new Error(parsed.message);
  }
  return parsed.document;
}

describe("scientifically rigorous MSA metrics", () => {
  it("keeps modal identity separate from gap occupancy", () => {
    const document = expectDocument(
      [">a", "A-", ">b", "AG", ">c", "CG"].join("\n"),
      "/tmp/identity.afa",
    );
    const summaries = computeColumnSummaries(document.rows, "dna");
    expect(summaries[0]?.identity).toBeCloseTo(2 / 3, 12);
    expect(summaries[0]?.gapFraction).toBe(0);
    expect(summaries[1]?.identity).toBe(1);
    expect(summaries[1]?.gapFraction).toBeCloseTo(1 / 3, 12);
  });

  it("emits thresholded nucleotide consensus symbols instead of winner-take-all bases", () => {
    const thresholdAmbiguous = expectDocument(
      [">a1", "A", ">a2", "A", ">a3", "A", ">g1", "G", ">g2", "G"].join("\n"),
      "/tmp/threshold.afa",
    );
    const thresholdCanonical = expectDocument(
      [">a1", "A", ">a2", "A", ">a3", "A", ">a4", "A", ">g1", "G"].join("\n"),
      "/tmp/canonical.afa",
    );
    expect(
      computeNucleotideConsensus(thresholdAmbiguous.rows, "dna", 0.7),
    ).toBe("R");
    expect(
      computeNucleotideConsensus(thresholdCanonical.rows, "dna", 0.7),
    ).toBe("A");
  });

  it("uses Henikoff column weights and relative entropy for protein conservation", () => {
    const document = expectDocument(
      [">a1", "A", ">a2", "A", ">c1", "C"].join("\n"),
      "/tmp/protein.a3m",
    );
    expect(computeHenikoffWeights(document.rows, "protein")).toEqual({
      a1: 0.25,
      a2: 0.25,
      c1: 0.5,
    });

    const invariant = expectDocument(
      [">a1", "A", ">a2", "A"].join("\n"),
      "/tmp/invariant.a3m",
    );
    const summary = computeColumnSummaries(invariant.rows, "protein")[0];
    expect(summary?.weightedSymbolFractions).toEqual({ A: 1 });
    expect(summary?.proteinRelativeEntropyBits).toBeCloseTo(
      3.6794575575715407,
      12,
    );
    expect(summary?.conservationModel).toBe("protein-relative-entropy");
  });

  it("computes ambiguity-aware DNA and RNA information content", () => {
    const invariantDna = expectDocument([">a", "A"].join("\n"), "/tmp/a.afa");
    const flatDna = expectDocument(
      [">a", "A", ">c", "C", ">g", "G", ">t", "T"].join("\n"),
      "/tmp/flat.afa",
    );
    const ambiguousDna = expectDocument([">r", "R"].join("\n"), "/tmp/r.afa");
    const invariantRna = expectDocument([">u", "U"].join("\n"), "/tmp/u.afa");

    expect(
      computeColumnSummaries(invariantDna.rows, "dna")[0]
        ?.nucleotideInformationContentBits,
    ).toBeCloseTo(2, 12);
    expect(
      computeColumnSummaries(flatDna.rows, "dna")[0]
        ?.nucleotideInformationContentBits,
    ).toBeCloseTo(0, 12);
    expect(
      computeColumnSummaries(ambiguousDna.rows, "dna")[0]
        ?.nucleotideInformationContentBits,
    ).toBeCloseTo(1, 12);
    expect(
      computeColumnSummaries(invariantRna.rows, "rna")[0]
        ?.weightedSymbolFractions,
    ).toEqual({ U: 1 });
  });

  it("computes RNA structure consensus with gap-inclusive denominators", () => {
    const document = expectDocument(
      [
        "# STOCKHOLM 1.0",
        "rna1 AU",
        "rna2 GU",
        "rna3 A-",
        "#=GC SS_cons <>",
        "//",
      ].join("\n"),
      "/tmp/rna.sto",
    );
    const analysis = computeMsaDerivedAnalysis({
      analysisId: "rna",
      analysisRowIds: document.rows.map((row) => row.id),
      document,
    });
    const pair = analysis.rnaStructureConsensusByColumn["0"];
    expect(pair?.watsonCrickFraction).toBeCloseTo(1 / 3, 12);
    expect(pair?.wobbleFraction).toBeCloseTo(1 / 3, 12);
    expect(pair?.gapFraction).toBeCloseTo(1 / 3, 12);
    expect(pair?.validPairFraction).toBeCloseTo(2 / 3, 12);
  });
});
