import { describe, expect, it } from "vitest";

import { getSequenceResidueStyle } from "../sequence/sequence-palette";

import {
  DARK_PALETTE_TEXT_COLOR,
  DIFFERENCE_MATCH_COLOR,
  DIFFERENCE_MISMATCH_COLOR,
  LIGHT_PALETTE_TEXT_COLOR,
  NUCLEOTIDE_TRANSITION_COLOR,
  NUCLEOTIDE_TRANSVERSION_COLOR,
  getCompatibleResiduePalettes,
  getDefaultColorMode,
  getDefaultResiduePalette,
  getMsaCellBackground,
  getMsaCellTextColor,
  getNucleotideSubstitutionColor,
  getProteinSimilarityGradient,
  getReadableMsaCellTextColor,
  isResiduePaletteCompatible,
} from "./colors";
import { computeColumnSummaries } from "./conservation";
import { parseMsa } from "./parser";
import type { MsaDocument } from "./types";

function parseDocument(contents: string, path: string): MsaDocument {
  const parsed = parseMsa(contents, path);
  if (parsed.status !== "success") {
    throw new Error(parsed.message);
  }
  return parsed.document;
}

describe("MSA color palettes", () => {
  it("chooses soft defaults by modality without changing analytical color modes", () => {
    expect(getDefaultColorMode("protein")).toBe("residue");
    expect(getDefaultColorMode("dna")).toBe("difference");
    expect(getDefaultColorMode("rna")).toBe("difference");
    expect(getDefaultResiduePalette("protein")).toBe("muted-amino-acid");
    expect(getDefaultResiduePalette("dna")).toBe("muted-nucleic-acid");
    expect(getDefaultResiduePalette("rna")).toBe("muted-nucleic-acid");
    expect(getDefaultResiduePalette("unknown")).toBe("neutral");
    expect(getDefaultResiduePalette("mixed")).toBe("neutral");
  });

  it("exposes the expected modality-specific palette bundles", () => {
    expect(getCompatibleResiduePalettes("protein")).toEqual([
      "muted-amino-acid",
      "neutral",
      "rasmol",
      "clustal-x",
      "zappo",
      "hydrophobicity",
    ]);
    expect(getCompatibleResiduePalettes("rna")).toEqual([
      "muted-nucleic-acid",
      "neutral",
      "ncbi-nucleic-acid",
      "jalview-nucleotide",
      "purine-pyrimidine",
      "nucleotide-ambiguity",
    ]);
    expect(getCompatibleResiduePalettes("unknown")).toEqual(["neutral"]);
    expect(isResiduePaletteCompatible("protein", "muted-nucleic-acid")).toBe(
      false,
    );
    expect(isResiduePaletteCompatible("rna", "muted-amino-acid")).toBe(false);
  });

  it.each([
    ["dna", "muted-nucleic-acid", "ACGTNR-."] as const,
    ["rna", "muted-nucleic-acid", "ACGUNR-."] as const,
    ["nucleic-acid-ambiguous", "muted-nucleic-acid", "ACGTUNR-."] as const,
    ["protein", "muted-amino-acid", "AFILMVWKR DENQSTCGPHYBZJXUO*-."] as const,
    ["protein", "neutral", "AKU-."] as const,
    ["dna", "neutral", "ACGTN-."] as const,
    ["mixed", "neutral", "AKU-."] as const,
    ["unknown", "neutral", "AKU-."] as const,
  ])(
    "uses the shared foreground/background pairs for %s / %s",
    (moleculeType, palette, symbols) => {
      const parsed = parseDocument(">row\nACGT", "/tmp/palette.afa");
      const document = {
        ...parsed,
        displayInterpretation: {
          ...parsed.displayInterpretation,
          moleculeType,
        },
      };
      const columnSummary = computeColumnSummaries(
        document.rows,
        moleculeType,
      )[0]!;
      for (const symbol of symbols.replaceAll(" ", "")) {
        const backgroundColor = getMsaCellBackground({
          columnSummary,
          document,
          mode: "residue",
          palette,
          symbol,
        });
        const color = getMsaCellTextColor({
          backgroundColor,
          mode: "residue",
          moleculeType,
          palette,
          symbol,
        });
        expect({ backgroundColor, color }).toEqual(
          getSequenceResidueStyle({
            molecule: moleculeType === "mixed" ? "unknown" : moleculeType,
            paletteId: palette,
            residue: symbol,
          }),
        );
      }
    },
  );

  it.each([
    "difference",
    "identity",
    "protein-conservation",
    "protein-similarity",
    "nucleotide-substitution",
    "coding-impact",
  ] as const)(
    "preserves %s analytical colors independently of a soft palette",
    (mode) => {
      const document = parseDocument(">ref\nAA\n>mut\nAG", "/tmp/analysis.afa");
      const columnSummary = computeColumnSummaries(
        document.rows,
        document.displayInterpretation.moleculeType,
      )[1]!;
      const options = {
        columnSummary,
        document,
        mode,
        referenceSymbol: "A",
        symbol: "G",
      };
      const backgroundColor = getMsaCellBackground({
        ...options,
        palette: "muted-nucleic-acid",
      });
      expect(backgroundColor).toBe(
        getMsaCellBackground({ ...options, palette: "ncbi-nucleic-acid" }),
      );
      expect(
        getMsaCellTextColor({
          backgroundColor,
          mode,
          moleculeType: "dna",
          palette: "muted-nucleic-acid",
          symbol: "G",
        }),
      ).toBe(getReadableMsaCellTextColor(backgroundColor));
    },
  );

  it("renders protein palettes from canonical mappings", () => {
    const document = parseDocument(
      [">a", "KR", ">b", "KR"].join("\n"),
      "/tmp/family.a3m",
    );
    const summaries = computeColumnSummaries(
      document.rows,
      document.displayInterpretation.moleculeType,
    );

    expect(
      getMsaCellBackground({
        columnSummary: summaries[0]!,
        document,
        mode: "residue",
        palette: "rasmol",
        symbol: "K",
      }),
    ).toBe("#145aff");
    expect(
      getMsaCellBackground({
        columnSummary: summaries[0]!,
        document,
        mode: "residue",
        palette: "clustal-x",
        symbol: "K",
      }),
    ).toBe("#f01505");
    expect(
      getMsaCellBackground({
        columnSummary: summaries[0]!,
        document,
        mode: "residue",
        palette: "zappo",
        symbol: "K",
      }),
    ).toBe("#6464ff");
    expect(
      getMsaCellBackground({
        columnSummary: summaries[0]!,
        document,
        mode: "residue",
        palette: "hydrophobicity",
        symbol: "R",
      }),
    ).toBe("#0000ff");
  });

  it("renders nucleic-acid palettes including RNA uracil and IUPAC ambiguity symbols", () => {
    const document = parseDocument(
      [">rna", "AUR"].join("\n"),
      "/tmp/rna.aln-fasta",
    );
    const summaries = computeColumnSummaries(
      document.rows,
      document.displayInterpretation.moleculeType,
    );

    expect(
      getMsaCellBackground({
        columnSummary: summaries[1]!,
        document,
        mode: "residue",
        palette: "ncbi-nucleic-acid",
        symbol: "U",
      }),
    ).toBe("#008000");
    expect(
      getMsaCellBackground({
        columnSummary: summaries[2]!,
        document,
        mode: "residue",
        palette: "purine-pyrimidine",
        symbol: "R",
      }),
    ).toBe("#ff83fa");
    expect(
      getMsaCellBackground({
        columnSummary: summaries[2]!,
        document,
        mode: "residue",
        palette: "nucleotide-ambiguity",
        symbol: "R",
      }),
    ).toBe("#cd5c5c");
  });

  it("selects a readable text color without muting canonical dark residue backgrounds", () => {
    expect(getReadableMsaCellTextColor("#0000ff")).toBe(
      DARK_PALETTE_TEXT_COLOR,
    );
    expect(getReadableMsaCellTextColor("#008000")).toBe(
      DARK_PALETTE_TEXT_COLOR,
    );
    expect(getReadableMsaCellTextColor("#ffff00")).toBe(
      LIGHT_PALETTE_TEXT_COLOR,
    );
    expect(getReadableMsaCellTextColor("transparent")).toBeUndefined();
  });

  it("keeps differences palette-independent and neutral for matches", () => {
    const document = parseDocument(
      [">ref", "AA", ">mut", "AG"].join("\n"),
      "/tmp/dna.aln-fasta",
    );
    const summaries = computeColumnSummaries(
      document.rows,
      document.displayInterpretation.moleculeType,
    );

    expect(
      getMsaCellBackground({
        columnSummary: summaries[0]!,
        document,
        mode: "difference",
        palette: "ncbi-nucleic-acid",
        referenceSymbol: "A",
        symbol: "A",
      }),
    ).toBe(DIFFERENCE_MATCH_COLOR);
    expect(
      getMsaCellBackground({
        columnSummary: summaries[1]!,
        document,
        mode: "difference",
        palette: "nucleotide-ambiguity",
        referenceSymbol: "A",
        symbol: "G",
      }),
    ).toBe(DIFFERENCE_MISMATCH_COLOR);
    expect(
      getMsaCellBackground({
        columnSummary: summaries[1]!,
        document,
        mode: "difference",
        palette: "nucleotide-ambiguity",
        symbol: "G",
      }),
    ).toBe(DIFFERENCE_MATCH_COLOR);
  });

  it("distinguishes nucleotide transition and transversion substitutions from a reference", () => {
    expect(
      getNucleotideSubstitutionColor({
        referenceSymbol: "A",
        symbol: "G",
      }),
    ).toBe(NUCLEOTIDE_TRANSITION_COLOR);
    expect(
      getNucleotideSubstitutionColor({
        referenceSymbol: "A",
        symbol: "C",
      }),
    ).toBe(NUCLEOTIDE_TRANSVERSION_COLOR);
    expect(
      getNucleotideSubstitutionColor({
        referenceSymbol: "U",
        symbol: "C",
      }),
    ).toBe(NUCLEOTIDE_TRANSITION_COLOR);
  });

  it("uses a perceptually distinct negative-neutral-positive protein similarity scale", () => {
    const document = parseDocument(
      [">ref", "WCA", ">mut", "DCA"].join("\n"),
      "/tmp/protein.a3m",
    );
    const summaries = computeColumnSummaries(
      document.rows,
      document.displayInterpretation.moleculeType,
    );

    expect(
      getMsaCellBackground({
        columnSummary: summaries[0]!,
        document,
        mode: "protein-similarity",
        palette: "rasmol",
        referenceSymbol: "W",
        symbol: "D",
      }),
    ).toBe("#f97316");
    expect(
      getMsaCellBackground({
        columnSummary: summaries[1]!,
        document,
        mode: "protein-similarity",
        palette: "rasmol",
        referenceSymbol: "C",
        symbol: "A",
      }),
    ).toBe(DIFFERENCE_MATCH_COLOR);
    expect(
      getMsaCellBackground({
        columnSummary: summaries[0]!,
        document,
        mode: "protein-similarity",
        palette: "rasmol",
        referenceSymbol: "W",
        symbol: "W",
      }),
    ).toBe("#2563eb");
    expect(getProteinSimilarityGradient()).toContain(
      `${DIFFERENCE_MATCH_COLOR} 27%`,
    );
  });
});
