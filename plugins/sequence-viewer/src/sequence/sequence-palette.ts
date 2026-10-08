import type { SequenceMoleculeKind } from "../biological-sequence-artifact-classifier";

import type { SequencePaletteId } from "./types";

export type SequencePaletteSwatch = {
  backgroundColor: string;
  label: string;
  residues: string;
  textColor?: string;
};

export type SequenceResidueStyle = {
  backgroundColor: string;
  color: string;
};

type SequenceResidueOptions = {
  molecule: SequenceMoleculeKind;
  paletteId: SequencePaletteId;
  residue: string;
};

export type SequencePalette = {
  description: string;
  id: SequencePaletteId;
  label: string;
  moleculeKinds: Array<SequenceMoleculeKind>;
  swatches: Array<SequencePaletteSwatch>;
};

const NEUTRAL_COLOR = "#f1f5f9";
const MONOCHROME_STYLE: SequenceResidueStyle = {
  backgroundColor: "transparent",
  color: "var(--bio-token-text-primary)",
};
const MUTED_NEUTRAL_STYLE: SequenceResidueStyle = {
  backgroundColor: "var(--bio-sequence-neutral-surface)",
  color: "var(--bio-sequence-neutral-foreground)",
};
const MUTED_NUCLEIC_ACID_STYLES: Record<string, SequenceResidueStyle> = {
  A: {
    backgroundColor: "var(--bio-sequence-a-surface)",
    color: "var(--bio-sequence-a-foreground)",
  },
  C: {
    backgroundColor: "var(--bio-sequence-c-surface)",
    color: "var(--bio-sequence-c-foreground)",
  },
  G: {
    backgroundColor: "var(--bio-sequence-g-surface)",
    color: "var(--bio-sequence-g-foreground)",
  },
  T: {
    backgroundColor: "var(--bio-sequence-t-surface)",
    color: "var(--bio-sequence-t-foreground)",
  },
};
const MUTED_AMINO_ACID_SWATCHES = [
  { label: "Hydrophobic", residues: "A F I L M V W", token: "hydrophobic" },
  { label: "Positive", residues: "K R", token: "positive" },
  { label: "Negative", residues: "D E", token: "negative" },
  { label: "Polar", residues: "N Q S T", token: "polar" },
  { label: "Cys", residues: "C", token: "cysteine" },
  { label: "Gly", residues: "G", token: "glycine" },
  { label: "Pro", residues: "P", token: "proline" },
  { label: "Aromatic", residues: "H Y", token: "aromatic" },
].map(({ label, residues, token }) => ({
  backgroundColor: `var(--bio-protein-${token}-surface)`,
  label,
  residues,
  textColor: `var(--bio-protein-${token}-foreground)`,
}));
const MUTED_AMINO_ACID_STYLES: Record<string, SequenceResidueStyle> =
  Object.fromEntries(
    MUTED_AMINO_ACID_SWATCHES.flatMap(({ backgroundColor, residues, textColor }) =>
      residues.split(" ").map((residue) => [
        residue,
        { backgroundColor, color: textColor },
      ]),
    ),
  );
const RASMOL_COLORS: Record<string, string> = {
  A: "#c8c8c8",
  C: "#e6e600",
  D: "#e60a0a",
  E: "#e60a0a",
  F: "#3232aa",
  G: "#ebebeb",
  H: "#8282d2",
  I: "#0f820f",
  K: "#145aff",
  L: "#0f820f",
  M: "#e6e600",
  N: "#00dcdc",
  P: "#dc9682",
  Q: "#00dcdc",
  R: "#145aff",
  S: "#fa9600",
  T: "#fa9600",
  V: "#0f820f",
  W: "#b45ab4",
  Y: "#3232aa",
};
const NCBI_NUCLEIC_ACID_COLORS: Record<string, string> = {
  A: "#ff0000",
  C: "#ffff00",
  G: "#0000ff",
  T: "#008000",
  U: "#008000",
};
const JALVIEW_NUCLEOTIDE_COLORS: Record<string, string> = {
  A: "#64f73f",
  C: "#ffb340",
  G: "#eb413c",
  T: "#3c88ee",
  U: "#3c88ee",
};
const PURINE_PYRIMIDINE_COLORS: Record<string, string> = {
  A: "#ff83fa",
  C: "#40e0d0",
  G: "#ff83fa",
  R: "#ff83fa",
  T: "#40e0d0",
  U: "#40e0d0",
  Y: "#40e0d0",
};
const NUCLEOTIDE_AMBIGUITY_COLORS: Record<string, string> = {
  A: "#f0fff0",
  B: "#8b4513",
  C: "#f0fff0",
  D: "#483d8b",
  G: "#f0fff0",
  H: "#808080",
  I: "#ffffff",
  K: "#9932cc",
  M: "#9acd32",
  N: "#2f4f4f",
  R: "#cd5c5c",
  S: "#ff8c00",
  T: "#f0fff0",
  U: "#f0fff0",
  V: "#b8860b",
  W: "#4682b4",
  X: "#4f6f6f",
  Y: "#008000",
};
const CLUSTAL_X_COLORS: Record<string, string> = {
  A: "#80a0f0",
  C: "#f08080",
  D: "#c048c0",
  E: "#c048c0",
  F: "#80a0f0",
  G: "#f09048",
  H: "#15a4a4",
  I: "#80a0f0",
  K: "#f01505",
  L: "#80a0f0",
  M: "#80a0f0",
  N: "#15c015",
  P: "#c0c000",
  Q: "#15c015",
  R: "#f01505",
  S: "#15c015",
  T: "#15c015",
  V: "#80a0f0",
  W: "#80a0f0",
  Y: "#15a4a4",
};
const ZAPPO_COLORS: Record<string, string> = {
  A: "#ffafaf",
  C: "#ffff00",
  D: "#ff0000",
  E: "#ff0000",
  F: "#ffc800",
  G: "#ff00ff",
  H: "#6464ff",
  I: "#ffafaf",
  K: "#6464ff",
  L: "#ffafaf",
  M: "#ffafaf",
  N: "#00ff00",
  P: "#ff00ff",
  Q: "#00ff00",
  R: "#6464ff",
  S: "#00ff00",
  T: "#00ff00",
  V: "#ffafaf",
  W: "#ffc800",
  Y: "#ffc800",
};
const HYDROPHOBICITY_COLORS: Record<string, string> = {
  A: "#ad0052",
  B: "#0c00f3",
  C: "#c2003d",
  D: "#0c00f3",
  E: "#0c00f3",
  F: "#cb0034",
  G: "#6a0095",
  H: "#1500ea",
  I: "#ff0000",
  K: "#0000ff",
  L: "#ea0015",
  M: "#b0004f",
  N: "#0c00f3",
  P: "#4600b9",
  Q: "#0c00f3",
  R: "#0000ff",
  S: "#5e00a1",
  T: "#61009e",
  V: "#f60009",
  W: "#5b00a4",
  X: "#680097",
  Y: "#4f00b0",
  Z: "#0c00f3",
};

const PALETTES: Record<SequencePaletteId, SequencePalette> = {
  "clustal-x": {
    description:
      "ClustalX-like amino-acid residue classes using the same canonical hues as the MSA viewer.",
    id: "clustal-x",
    label: "ClustalX",
    moleculeKinds: ["protein"],
    swatches: [
      { backgroundColor: CLUSTAL_X_COLORS.A, label: "Hydrophobic", residues: "A F I L M V W" },
      { backgroundColor: CLUSTAL_X_COLORS.K, label: "Positive", residues: "K R" },
      { backgroundColor: CLUSTAL_X_COLORS.D, label: "Negative", residues: "D E" },
      { backgroundColor: CLUSTAL_X_COLORS.N, label: "Polar", residues: "N Q S T" },
      { backgroundColor: CLUSTAL_X_COLORS.C, label: "Cys", residues: "C" },
      { backgroundColor: CLUSTAL_X_COLORS.G, label: "Gly", residues: "G" },
      { backgroundColor: CLUSTAL_X_COLORS.P, label: "Pro", residues: "P" },
      { backgroundColor: CLUSTAL_X_COLORS.H, label: "Aromatic", residues: "H Y" },
    ],
  },
  hydrophobicity: {
    description:
      "Hydrophobicity gradient from hydrophilic blue through intermediate purple to hydrophobic red.",
    id: "hydrophobicity",
    label: "Hydrophobicity",
    moleculeKinds: ["protein"],
    swatches: [
      { backgroundColor: HYDROPHOBICITY_COLORS.K, label: "Hydrophilic", residues: "K R D E N Q" },
      { backgroundColor: HYDROPHOBICITY_COLORS.G, label: "Intermediate", residues: "G P S T W Y" },
      { backgroundColor: HYDROPHOBICITY_COLORS.I, label: "Hydrophobic", residues: "I L V F A C M" },
    ],
  },
  "jalview-nucleotide": {
    description: "Jalview nucleotide base colors with T/U sharing the blue pyrimidine color.",
    id: "jalview-nucleotide",
    label: "Jalview nucleotide",
    moleculeKinds: ["dna", "nucleic-acid-ambiguous", "rna"],
    swatches: [
      { backgroundColor: JALVIEW_NUCLEOTIDE_COLORS.A, label: "A", residues: "A" },
      { backgroundColor: JALVIEW_NUCLEOTIDE_COLORS.C, label: "C", residues: "C" },
      { backgroundColor: JALVIEW_NUCLEOTIDE_COLORS.G, label: "G", residues: "G" },
      { backgroundColor: JALVIEW_NUCLEOTIDE_COLORS.T, label: "T/U", residues: "T U" },
    ],
  },
  "muted-amino-acid": {
    description:
      "Soft, theme-aware, fixed ClustalX-inspired amino-acid groups, not alignment-conservation coloring. Ambiguous and rare residues, stops and gaps remain neutral.",
    id: "muted-amino-acid",
    label: "Soft amino acid",
    moleculeKinds: ["protein"],
    swatches: [
      ...MUTED_AMINO_ACID_SWATCHES,
      {
        backgroundColor: MUTED_NEUTRAL_STYLE.backgroundColor,
        label: "X / * / -",
        residues: "Ambiguous and rare residues, stops and gaps",
        textColor: MUTED_NEUTRAL_STYLE.color,
      },
    ],
  },
  "muted-nucleic-acid": {
    description:
      "Soft, theme-aware base colors: rose A, amber C, blue G and sage T/U. Ambiguity symbols and gaps remain neutral.",
    id: "muted-nucleic-acid",
    label: "Soft nucleotide",
    moleculeKinds: ["dna", "nucleic-acid-ambiguous", "rna"],
    swatches: [
      ...["A", "C", "G", "T"].map((residue) => ({
        backgroundColor: MUTED_NUCLEIC_ACID_STYLES[residue].backgroundColor,
        label: residue === "T" ? "T/U" : residue,
        residues: residue === "T" ? "T U" : residue,
        textColor: MUTED_NUCLEIC_ACID_STYLES[residue].color,
      })),
      {
        backgroundColor: MUTED_NEUTRAL_STYLE.backgroundColor,
        label: "N / -",
        residues: "Ambiguity symbols and gaps",
        textColor: MUTED_NEUTRAL_STYLE.color,
      },
    ],
  },
  "ncbi-nucleic-acid": {
    description:
      "NCBI-style per-base residue colors with T/U sharing the pyrimidine color.",
    id: "ncbi-nucleic-acid",
    label: "NCBI nucleic acid",
    moleculeKinds: ["dna", "nucleic-acid-ambiguous", "rna"],
    swatches: [
      { backgroundColor: NCBI_NUCLEIC_ACID_COLORS.A, label: "A", residues: "A" },
      { backgroundColor: NCBI_NUCLEIC_ACID_COLORS.C, label: "C", residues: "C" },
      { backgroundColor: NCBI_NUCLEIC_ACID_COLORS.G, label: "G", residues: "G" },
      {
        backgroundColor: NCBI_NUCLEIC_ACID_COLORS.T,
        label: "T/U",
        residues: "T U",
      },
    ],
  },
  neutral: {
    description: "Theme-aware monochrome lettering without residue-specific color.",
    id: "neutral",
    label: "Monochrome",
    moleculeKinds: ["dna", "nucleic-acid-ambiguous", "protein", "rna", "unknown"],
    swatches: [
      {
        backgroundColor: MONOCHROME_STYLE.backgroundColor,
        label: "Residue",
        residues: "Any",
        textColor: MONOCHROME_STYLE.color,
      },
    ],
  },
  "nucleotide-ambiguity": {
    description:
      "IUPAC-aware nucleotide colors that make ambiguity symbols visually explicit.",
    id: "nucleotide-ambiguity",
    label: "Nucleotide ambiguity",
    moleculeKinds: ["dna", "nucleic-acid-ambiguous", "rna"],
    swatches: [
      { backgroundColor: NUCLEOTIDE_AMBIGUITY_COLORS.R, label: "R", residues: "R = A/G" },
      { backgroundColor: NUCLEOTIDE_AMBIGUITY_COLORS.Y, label: "Y", residues: "Y = C/T/U" },
      { backgroundColor: NUCLEOTIDE_AMBIGUITY_COLORS.W, label: "W", residues: "W = A/T/U" },
      { backgroundColor: NUCLEOTIDE_AMBIGUITY_COLORS.S, label: "S", residues: "S = C/G" },
      { backgroundColor: NUCLEOTIDE_AMBIGUITY_COLORS.N, label: "N", residues: "N = any" },
    ],
  },
  "purine-pyrimidine": {
    description: "Groups purines A/G/R and pyrimidines C/T/U/Y.",
    id: "purine-pyrimidine",
    label: "Purine / Pyrimidine",
    moleculeKinds: ["dna", "nucleic-acid-ambiguous", "rna"],
    swatches: [
      {
        backgroundColor: PURINE_PYRIMIDINE_COLORS.A,
        label: "Purine",
        residues: "A G R",
      },
      {
        backgroundColor: PURINE_PYRIMIDINE_COLORS.C,
        label: "Pyrimidine",
        residues: "C T U Y",
      },
    ],
  },
  rasmol: {
    description: "Traditional RasMol amino-acid residue colors.",
    id: "rasmol",
    label: "RasMol",
    moleculeKinds: ["protein"],
    swatches: [
      { backgroundColor: RASMOL_COLORS.K, label: "Basic", residues: "K R" },
      { backgroundColor: RASMOL_COLORS.D, label: "Acidic", residues: "D E" },
      { backgroundColor: RASMOL_COLORS.I, label: "Hydrophobic", residues: "I L V" },
      { backgroundColor: RASMOL_COLORS.F, label: "Aromatic", residues: "F Y" },
      { backgroundColor: RASMOL_COLORS.C, label: "Sulfur", residues: "C M" },
      { backgroundColor: RASMOL_COLORS.N, label: "Amide", residues: "N Q" },
      { backgroundColor: RASMOL_COLORS.S, label: "Hydroxyl", residues: "S T" },
      { backgroundColor: RASMOL_COLORS.G, label: "Small", residues: "A G P" },
    ],
  },
  zappo: {
    description: "Zappo physicochemical amino-acid residue groups.",
    id: "zappo",
    label: "Zappo",
    moleculeKinds: ["protein"],
    swatches: [
      { backgroundColor: ZAPPO_COLORS.A, label: "Aliphatic", residues: "A I L M V" },
      { backgroundColor: ZAPPO_COLORS.F, label: "Aromatic", residues: "F W Y" },
      { backgroundColor: ZAPPO_COLORS.N, label: "Hydrophilic", residues: "N Q S T" },
      { backgroundColor: ZAPPO_COLORS.D, label: "Negative", residues: "D E" },
      { backgroundColor: ZAPPO_COLORS.K, label: "Positive", residues: "H K R" },
      { backgroundColor: ZAPPO_COLORS.G, label: "Special", residues: "G P" },
      { backgroundColor: ZAPPO_COLORS.C, label: "Cys", residues: "C" },
    ],
  },
};
const PROTEIN_PALETTE_IDS: Array<SequencePaletteId> = [
  "muted-amino-acid",
  "neutral",
  "rasmol",
  "clustal-x",
  "zappo",
  "hydrophobicity",
];
const NUCLEIC_ACID_PALETTE_IDS: Array<SequencePaletteId> = [
  "muted-nucleic-acid",
  "neutral",
  "ncbi-nucleic-acid",
  "jalview-nucleotide",
  "purine-pyrimidine",
  "nucleotide-ambiguity",
];

export function getDefaultSequencePalette(
  molecule: SequenceMoleculeKind,
): SequencePaletteId {
  if (molecule === "protein") {
    return "muted-amino-acid";
  }
  if (
    molecule === "dna" ||
    molecule === "rna" ||
    molecule === "nucleic-acid-ambiguous"
  ) {
    return "muted-nucleic-acid";
  }
  return "neutral";
}

export function getCompatibleSequencePalettes(
  molecule: SequenceMoleculeKind,
): Array<SequencePalette> {
  if (molecule === "protein") {
    return PROTEIN_PALETTE_IDS.map((paletteId) => PALETTES[paletteId]);
  }
  if (
    molecule === "dna" ||
    molecule === "rna" ||
    molecule === "nucleic-acid-ambiguous"
  ) {
    return NUCLEIC_ACID_PALETTE_IDS.map((paletteId) => PALETTES[paletteId]);
  }
  return [PALETTES.neutral];
}

export function getSequencePalette(
  paletteId: SequencePaletteId,
): SequencePalette {
  return PALETTES[paletteId];
}

/** Theme-aware palettes must supply both colors; contrast cannot be inferred from a CSS token. */
export function getSequenceResidueStyle(
  options: SequenceResidueOptions,
): SequenceResidueStyle {
  if (options.paletteId === "neutral") {
    return MONOCHROME_STYLE;
  }
  if (options.paletteId === "muted-amino-acid" && options.molecule === "protein") {
    return (
      MUTED_AMINO_ACID_STYLES[options.residue.toUpperCase()] ?? MUTED_NEUTRAL_STYLE
    );
  }
  if (
    options.paletteId === "muted-nucleic-acid" &&
    (options.molecule === "dna" ||
      options.molecule === "rna" ||
      options.molecule === "nucleic-acid-ambiguous")
  ) {
    const residue = options.residue.toUpperCase();
    return (
      MUTED_NUCLEIC_ACID_STYLES[residue === "U" ? "T" : residue] ??
      MUTED_NEUTRAL_STYLE
    );
  }
  const backgroundColor = getLegacySequenceResidueColor(options);
  return {
    backgroundColor,
    color: getReadableResidueTextColor(backgroundColor),
  };
}

export function getSequenceResidueColor(
  options: SequenceResidueOptions,
): string {
  return getSequenceResidueStyle(options).backgroundColor;
}

function getLegacySequenceResidueColor({
  molecule,
  paletteId,
  residue,
}: SequenceResidueOptions): string {
  const normalizedResidue = residue.toUpperCase();
  if (paletteId === "rasmol" && molecule === "protein") {
    return RASMOL_COLORS[normalizedResidue] ?? NEUTRAL_COLOR;
  }
  if (paletteId === "clustal-x" && molecule === "protein") {
    return CLUSTAL_X_COLORS[normalizedResidue] ?? NEUTRAL_COLOR;
  }
  if (paletteId === "zappo" && molecule === "protein") {
    return ZAPPO_COLORS[normalizedResidue] ?? NEUTRAL_COLOR;
  }
  if (paletteId === "hydrophobicity" && molecule === "protein") {
    return HYDROPHOBICITY_COLORS[normalizedResidue] ?? NEUTRAL_COLOR;
  }
  if (paletteId === "jalview-nucleotide") {
    return JALVIEW_NUCLEOTIDE_COLORS[normalizedResidue] ?? NEUTRAL_COLOR;
  }
  if (paletteId === "nucleotide-ambiguity") {
    return NUCLEOTIDE_AMBIGUITY_COLORS[normalizedResidue] ?? NEUTRAL_COLOR;
  }
  if (paletteId === "purine-pyrimidine") {
    return PURINE_PYRIMIDINE_COLORS[normalizedResidue] ?? NEUTRAL_COLOR;
  }
  if (paletteId === "ncbi-nucleic-acid") {
    return NCBI_NUCLEIC_ACID_COLORS[normalizedResidue] ?? NEUTRAL_COLOR;
  }
  return NEUTRAL_COLOR;
}

export function getReadableResidueTextColor(backgroundColor: string): string {
  const hex = backgroundColor.replace("#", "");
  if (hex.length !== 6) {
    return "#111827";
  }
  const red = Number.parseInt(hex.slice(0, 2), 16);
  const green = Number.parseInt(hex.slice(2, 4), 16);
  const blue = Number.parseInt(hex.slice(4, 6), 16);
  const luminance = 0.2126 * red + 0.7152 * green + 0.0722 * blue;
  return luminance < 145 ? "#ffffff" : "#111827";
}
