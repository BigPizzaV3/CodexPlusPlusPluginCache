import { describe, expect, it } from "vitest";

import {
  getCompatibleSequencePalettes,
  getDefaultSequencePalette,
  getReadableResidueTextColor,
  getSequencePalette,
  getSequenceResidueColor,
  getSequenceResidueStyle,
} from "./sequence-palette";
import type { SequencePaletteId } from "./types";

describe("sequence palettes", () => {
  it.each(["dna", "rna", "nucleic-acid-ambiguous"] as const)(
    "defaults %s to soft nucleotide colors",
    (molecule) => {
      expect(getDefaultSequencePalette(molecule)).toBe("muted-nucleic-acid");
    },
  );

  it("defaults proteins to soft amino-acid groups and unknown alphabets to monochrome", () => {
    expect(getDefaultSequencePalette("protein")).toBe("muted-amino-acid");
    expect(getDefaultSequencePalette("unknown")).toBe("neutral");
  });

  it("keeps dark nucleotide colors readable", () => {
    const guanineBlue = getSequenceResidueColor({
      molecule: "dna",
      paletteId: "ncbi-nucleic-acid",
      residue: "G",
    });
    expect(guanineBlue).toBe("#0000ff");
    expect(getReadableResidueTextColor(guanineBlue)).toBe("#ffffff");
  });

  it("exposes the canonical sequence-view palette bundle by modality", () => {
    expect(getCompatibleSequencePalettes("protein").map(({ id }) => id)).toEqual(
      ["muted-amino-acid", "neutral", "rasmol", "clustal-x", "zappo", "hydrophobicity"],
    );
    expect(getCompatibleSequencePalettes("dna").map(({ id }) => id)).toEqual([
      "muted-nucleic-acid",
      "neutral",
      "ncbi-nucleic-acid",
      "jalview-nucleotide",
      "purine-pyrimidine",
      "nucleotide-ambiguity",
    ]);
    for (const molecule of ["rna", "nucleic-acid-ambiguous"] as const) {
      expect(getCompatibleSequencePalettes(molecule)).toEqual(
        getCompatibleSequencePalettes("dna"),
      );
    }
    expect(getCompatibleSequencePalettes("unknown").map(({ id }) => id)).toEqual([
      "neutral",
    ]);
  });

  it.each(["dna", "rna", "nucleic-acid-ambiguous"] as const)(
    "pairs theme-aware surfaces and lettering for every %s base, including lowercase and U",
    (molecule) => {
      for (const residue of "ACGTUacgtu") {
        const token = residue.toLowerCase() === "u" ? "t" : residue.toLowerCase();
        const options = {
          molecule,
          paletteId: "muted-nucleic-acid" as const,
          residue,
        };
        expect(getSequenceResidueStyle(options)).toEqual({
          backgroundColor: `var(--bio-sequence-${token}-surface)`,
          color: `var(--bio-sequence-${token}-foreground)`,
        });
        expect(getSequenceResidueColor(options)).toBe(
          getSequenceResidueStyle(options).backgroundColor,
        );
      }
    },
  );

  it("does not assign specific base colors to ambiguity symbols or gaps", () => {
    for (const residue of "BDHIKMNRSVWXYbdhikmnrsvwxy-.*?") {
      expect(
        getSequenceResidueStyle({
          molecule: "nucleic-acid-ambiguous",
          paletteId: "muted-nucleic-acid",
          residue,
        }),
      ).toEqual({
        backgroundColor: "var(--bio-sequence-neutral-surface)",
        color: "var(--bio-sequence-neutral-foreground)",
      });
    }
  });

  it.each(["dna", "rna", "nucleic-acid-ambiguous", "protein", "unknown"] as const)(
    "offers theme-aware monochrome lettering for %s",
    (molecule) => {
      for (const residue of "ACDEFGHIKLMNPQRSTVWYBZJXUO*-acdefghiklmnpqrstvwybzjxuo") {
        expect(
          getSequenceResidueStyle({ molecule, paletteId: "neutral", residue }),
        ).toEqual({
          backgroundColor: "transparent",
          color: "var(--bio-token-text-primary)",
        });
      }
    },
  );

  it.each([
    { label: "Hydrophobic", residues: "AFILMVW", token: "hydrophobic" },
    { label: "Positive", residues: "KR", token: "positive" },
    { label: "Negative", residues: "DE", token: "negative" },
    { label: "Polar", residues: "NQST", token: "polar" },
    { label: "Cys", residues: "C", token: "cysteine" },
    { label: "Gly", residues: "G", token: "glycine" },
    { label: "Pro", residues: "P", token: "proline" },
    { label: "Aromatic", residues: "HY", token: "aromatic" },
  ])("pairs theme-aware colors and an explicit legend for the fixed $label protein group", ({ label, residues, token }) => {
    const expectedStyle = {
      backgroundColor: `var(--bio-protein-${token}-surface)`,
      color: `var(--bio-protein-${token}-foreground)`,
    };
    for (const residue of `${residues}${residues.toLowerCase()}`) {
      expect(
        getSequenceResidueStyle({
          molecule: "protein",
          paletteId: "muted-amino-acid",
          residue,
        }),
      ).toEqual(expectedStyle);
    }
    expect(getSequencePalette("muted-amino-acid").swatches).toContainEqual({
      backgroundColor: expectedStyle.backgroundColor,
      label,
      residues: [...residues].join(" "),
      textColor: expectedStyle.color,
    });
  });

  it("does not assign protein classes to ambiguous or rare residues, stops or gaps", () => {
    for (const residue of "BZJXUObzjxuo*-?.") {
      expect(
        getSequenceResidueStyle({
          molecule: "protein",
          paletteId: "muted-amino-acid",
          residue,
        }),
      ).toEqual({
        backgroundColor: "var(--bio-sequence-neutral-surface)",
        color: "var(--bio-sequence-neutral-foreground)",
      });
    }
    expect(getSequencePalette("muted-amino-acid").swatches.at(-1)).toMatchObject({
      backgroundColor: "var(--bio-sequence-neutral-surface)",
      textColor: "var(--bio-sequence-neutral-foreground)",
    });
  });

  it("distinguishes uracil in RNA from unclassified U in proteins", () => {
    expect(
      getSequenceResidueStyle({
        molecule: "rna",
        paletteId: "muted-nucleic-acid",
        residue: "U",
      }).backgroundColor,
    ).toBe("var(--bio-sequence-t-surface)");
    expect(
      getSequenceResidueStyle({
        molecule: "protein",
        paletteId: "muted-amino-acid",
        residue: "U",
      }).backgroundColor,
    ).toBe("var(--bio-sequence-neutral-surface)");
  });

  it("uses the same paired colors in the soft nucleotide and monochrome legends", () => {
    const softPalette = getSequencePalette("muted-nucleic-acid");
    expect(softPalette.label).toBe("Soft nucleotide");
    for (const [index, residue] of [..."ACGTN"].entries()) {
      const style = getSequenceResidueStyle({
        molecule: "dna",
        paletteId: softPalette.id,
        residue,
      });
      expect(softPalette.swatches[index]).toMatchObject({
        backgroundColor: style.backgroundColor,
        textColor: style.color,
      });
    }
    const monochrome = getSequencePalette("neutral");
    const monochromeStyle = getSequenceResidueStyle({
      molecule: "dna",
      paletteId: monochrome.id,
      residue: "A",
    });
    expect(monochrome.swatches[0]).toMatchObject({
      backgroundColor: monochromeStyle.backgroundColor,
      textColor: monochromeStyle.color,
    });
  });

  it.each<{
    colors: Record<string, string>;
    paletteId: SequencePaletteId;
  }>([
    {
      paletteId: "ncbi-nucleic-acid",
      colors: { A: "#ff0000", C: "#ffff00", G: "#0000ff", T: "#008000", U: "#008000" },
    },
    {
      paletteId: "jalview-nucleotide",
      colors: { A: "#64f73f", C: "#ffb340", G: "#eb413c", T: "#3c88ee", U: "#3c88ee" },
    },
    {
      paletteId: "purine-pyrimidine",
      colors: {
        A: "#ff83fa", C: "#40e0d0", G: "#ff83fa", R: "#ff83fa",
        T: "#40e0d0", U: "#40e0d0", Y: "#40e0d0",
      },
    },
    {
      paletteId: "nucleotide-ambiguity",
      colors: {
        A: "#f0fff0", B: "#8b4513", C: "#f0fff0", D: "#483d8b",
        G: "#f0fff0", H: "#808080", I: "#ffffff", K: "#9932cc",
        M: "#9acd32", N: "#2f4f4f", R: "#cd5c5c", S: "#ff8c00",
        T: "#f0fff0", U: "#f0fff0", V: "#b8860b", W: "#4682b4",
        X: "#4f6f6f", Y: "#008000",
      },
    },
  ])("preserves every existing $paletteId base color", ({ colors, paletteId }) => {
    for (const [symbol, backgroundColor] of Object.entries(colors)) {
      for (const residue of [symbol, symbol.toLowerCase()]) {
        expect(
          getSequenceResidueStyle({ molecule: "dna", paletteId, residue }),
        ).toEqual({
          backgroundColor,
          color: getReadableResidueTextColor(backgroundColor),
        });
      }
    }
  });

  it("does not apply nucleotide theme styles to protein residues", () => {
    expect(
      getSequenceResidueStyle({ molecule: "protein", paletteId: "muted-nucleic-acid", residue: "A" }),
    ).toEqual({ backgroundColor: "#f1f5f9", color: "#111827" });
  });

  it.each<{
    backgroundColor: string;
    paletteId: SequencePaletteId;
  }>([
    { backgroundColor: "#145aff", paletteId: "rasmol" },
    { backgroundColor: "#f01505", paletteId: "clustal-x" },
    { backgroundColor: "#6464ff", paletteId: "zappo" },
    { backgroundColor: "#0000ff", paletteId: "hydrophobicity" },
  ])("keeps legacy $paletteId available with its original color", ({ backgroundColor, paletteId }) => {
    for (const residue of "Kk") {
      expect(
        getSequenceResidueStyle({ molecule: "protein", paletteId, residue }),
      ).toEqual({
        backgroundColor,
        color: getReadableResidueTextColor(backgroundColor),
      });
    }
  });

  it("renders Jalview, ambiguity-aware nucleotide, Zappo, and hydrophobicity colors", () => {
    expect(
      getSequenceResidueColor({
        molecule: "dna",
        paletteId: "jalview-nucleotide",
        residue: "G",
      }),
    ).toBe("#eb413c");
    expect(
      getSequenceResidueColor({
        molecule: "rna",
        paletteId: "nucleotide-ambiguity",
        residue: "R",
      }),
    ).toBe("#cd5c5c");
    expect(
      getSequenceResidueColor({
        molecule: "protein",
        paletteId: "zappo",
        residue: "K",
      }),
    ).toBe("#6464ff");
    expect(
      getSequenceResidueColor({
        molecule: "protein",
        paletteId: "hydrophobicity",
        residue: "I",
      }),
    ).toBe("#ff0000");
  });
});
