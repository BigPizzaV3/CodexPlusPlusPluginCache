import { getSequenceResidueStyle } from "../sequence/sequence-palette";

import type { MsaColumnSummary } from "./conservation";
import { classifyResidue, isGapSymbol } from "./residue-alphabet";
import type { MsaDocument, MsaMoleculeType } from "./types";

export type MsaColorMode =
  | "coding-impact"
  | "difference"
  | "identity"
  | "nucleotide-substitution"
  | "protein-conservation"
  | "protein-similarity"
  | "residue";
export type MsaProteinPalette =
  "clustal-x" | "hydrophobicity" | "muted-amino-acid" | "rasmol" | "zappo";
export type MsaNucleicAcidPalette =
  | "jalview-nucleotide"
  | "muted-nucleic-acid"
  | "ncbi-nucleic-acid"
  | "nucleotide-ambiguity"
  | "purine-pyrimidine";
export type MsaResiduePalette =
  MsaNucleicAcidPalette | MsaProteinPalette | "neutral";

const PROTEIN_RESIDUE_PALETTES: Array<MsaResiduePalette> = [
  "muted-amino-acid",
  "neutral",
  "rasmol",
  "clustal-x",
  "zappo",
  "hydrophobicity",
];

const NUCLEIC_ACID_RESIDUE_PALETTES: Array<MsaResiduePalette> = [
  "muted-nucleic-acid",
  "neutral",
  "ncbi-nucleic-acid",
  "jalview-nucleotide",
  "purine-pyrimidine",
  "nucleotide-ambiguity",
];

export const DIFFERENCE_MATCH_COLOR = "#f8fafc";
export const DIFFERENCE_MISMATCH_COLOR = "#ffd6a8";
export const CODING_SYNONYMOUS_COLOR = "#bfdbfe";
export const CODING_NONSYNONYMOUS_COLOR = "#fecaca";
export const NUCLEOTIDE_TRANSITION_COLOR = "#fde68a";
export const NUCLEOTIDE_TRANSVERSION_COLOR = "#ddd6fe";
const UNKNOWN_RESIDUE_COLOR = "#f1f3f5";
export const DARK_PALETTE_TEXT_COLOR = "#ffffff";
export const LIGHT_PALETTE_TEXT_COLOR = "#111827";

const identityLowColor = "#eff6ff";
const identityHighColor = "#60a5fa";
const proteinConservationLowColor = "#dbeafe";
const proteinConservationHighColor = "#fca5a5";
const proteinSimilarityLowColor = "#f97316";
const proteinSimilarityNeutralColor = DIFFERENCE_MATCH_COLOR;
const proteinSimilarityHighColor = "#2563eb";

const rasMolColors: Record<string, string> = {
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

const zappoColors = {
  aliphaticHydrophobic: "#ffafaf",
  aromatic: "#ffc800",
  conformationallySpecial: "#ff00ff",
  cysteine: "#ffff00",
  hydrophilic: "#00ff00",
  negative: "#ff0000",
  positive: "#6464ff",
};

const clustalColors = {
  aromatic: "#15a4a4",
  cysteine: "#f08080",
  glycine: "#f09048",
  hydrophobic: "#80a0f0",
  negative: "#c048c0",
  polar: "#15c015",
  positive: "#f01505",
  proline: "#c0c000",
};

const hydrophobicityColors: Record<string, string> = {
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

const ncbiNucleotideColors: Record<string, string> = {
  A: "#ff0000",
  C: "#ffff00",
  G: "#0000ff",
  T: "#008000",
  U: "#008000",
};

const jalviewNucleotideColors: Record<string, string> = {
  A: "#64f73f",
  C: "#ffb340",
  G: "#eb413c",
  T: "#3c88ee",
  U: "#3c88ee",
};

const purinePyrimidineColors: Record<string, string> = {
  A: "#ff83fa",
  C: "#40e0d0",
  G: "#ff83fa",
  R: "#ff83fa",
  T: "#40e0d0",
  U: "#40e0d0",
  Y: "#40e0d0",
};

const nucleotideAmbiguityColors: Record<string, string> = {
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

const rasMolFallbackColor = "#bea06e";

export function getDefaultColorMode(
  moleculeType: MsaMoleculeType,
): MsaColorMode {
  return moleculeType === "dna" ||
    moleculeType === "rna" ||
    moleculeType === "nucleic-acid-ambiguous"
    ? "difference"
    : "residue";
}

export function getDefaultResiduePalette(
  moleculeType: MsaMoleculeType,
): MsaResiduePalette | null {
  if (moleculeType === "protein") {
    return "muted-amino-acid";
  }
  if (
    moleculeType === "dna" ||
    moleculeType === "rna" ||
    moleculeType === "nucleic-acid-ambiguous"
  ) {
    return "muted-nucleic-acid";
  }
  return "neutral";
}

export function getCompatibleResiduePalettes(
  moleculeType: MsaMoleculeType,
): Array<MsaResiduePalette> {
  if (moleculeType === "protein") {
    return PROTEIN_RESIDUE_PALETTES;
  }
  if (
    moleculeType === "dna" ||
    moleculeType === "rna" ||
    moleculeType === "nucleic-acid-ambiguous"
  ) {
    return NUCLEIC_ACID_RESIDUE_PALETTES;
  }
  return ["neutral"];
}

export function isThemeAwareMsaPalette(
  palette: MsaResiduePalette | null,
): palette is "muted-amino-acid" | "muted-nucleic-acid" | "neutral" {
  return (
    palette === "muted-amino-acid" ||
    palette === "muted-nucleic-acid" ||
    palette === "neutral"
  );
}

export function isResiduePaletteCompatible(
  moleculeType: MsaMoleculeType,
  palette: MsaResiduePalette | null,
): palette is MsaResiduePalette {
  return (
    palette != null &&
    getCompatibleResiduePalettes(moleculeType).includes(palette)
  );
}

function getIdentityColor(identity: number): string {
  return interpolateHex(identityLowColor, identityHighColor, identity);
}

function getProteinConservationColor(
  conservationNormalized: number | null,
): string {
  return interpolateHex(
    proteinConservationLowColor,
    proteinConservationHighColor,
    conservationNormalized ?? 0,
  );
}

function getProteinSimilarityColor(score: number | null): string {
  if (score == null) {
    return proteinSimilarityNeutralColor;
  }
  if (score <= 0) {
    return interpolateHex(
      proteinSimilarityLowColor,
      proteinSimilarityNeutralColor,
      (score + 4) / 4,
    );
  }
  return interpolateHex(
    proteinSimilarityNeutralColor,
    proteinSimilarityHighColor,
    score / 11,
  );
}

function getCountFraction(
  summary: MsaColumnSummary,
  symbols: ReadonlyArray<string>,
): number {
  if (summary.nongapCount === 0) {
    return 0;
  }
  const count = symbols.reduce(
    (total, symbol) => total + (summary.symbolCounts[symbol] ?? 0),
    0,
  );
  return count / summary.nongapCount;
}

function matchesClustalRule({
  summary,
  threshold,
  symbols,
}: {
  summary: MsaColumnSummary;
  threshold: number;
  symbols: ReadonlyArray<string>;
}): boolean {
  return getCountFraction(summary, symbols) > threshold;
}

function getClustalXColor(symbol: string, summary: MsaColumnSummary): string {
  const normalized = symbol.toUpperCase();
  const hydrophobicGroup = [
    "W",
    "L",
    "V",
    "I",
    "M",
    "A",
    "F",
    "C",
    "Y",
    "H",
    "P",
  ];
  const aromaticConsensus = [
    "W",
    "Y",
    "A",
    "C",
    "P",
    "Q",
    "F",
    "H",
    "I",
    "L",
    "M",
    "V",
  ];

  if (
    normalized === "C" &&
    matchesClustalRule({ summary, symbols: ["C"], threshold: 0.85 })
  ) {
    return clustalColors.cysteine;
  }
  if (normalized === "G") {
    return clustalColors.glycine;
  }
  if (normalized === "P") {
    return clustalColors.proline;
  }
  if (
    ["H", "Y"].includes(normalized) &&
    (matchesClustalRule({
      summary,
      symbols: hydrophobicGroup,
      threshold: 0.6,
    }) ||
      matchesClustalRule({
        summary,
        symbols: aromaticConsensus,
        threshold: 0.85,
      }))
  ) {
    return clustalColors.aromatic;
  }
  if (
    ["K", "R"].includes(normalized) &&
    (matchesClustalRule({ summary, symbols: ["K", "R"], threshold: 0.6 }) ||
      matchesClustalRule({
        summary,
        symbols: ["K", "R", "Q"],
        threshold: 0.85,
      }))
  ) {
    return clustalColors.positive;
  }
  if (
    normalized === "E" &&
    (matchesClustalRule({ summary, symbols: ["K", "R"], threshold: 0.6 }) ||
      matchesClustalRule({ summary, symbols: ["Q", "E"], threshold: 0.5 }) ||
      matchesClustalRule({ summary, symbols: ["E", "D"], threshold: 0.5 }) ||
      matchesClustalRule({
        summary,
        symbols: ["E", "Q", "D"],
        threshold: 0.85,
      }))
  ) {
    return clustalColors.negative;
  }
  if (
    normalized === "D" &&
    (matchesClustalRule({ summary, symbols: ["K", "R"], threshold: 0.6 }) ||
      matchesClustalRule({
        summary,
        symbols: ["D", "E", "N"],
        threshold: 0.85,
      }) ||
      matchesClustalRule({ summary, symbols: ["E", "D"], threshold: 0.5 }))
  ) {
    return clustalColors.negative;
  }
  if (
    normalized === "N" &&
    (matchesClustalRule({ summary, symbols: ["N"], threshold: 0.5 }) ||
      matchesClustalRule({ summary, symbols: ["N", "D"], threshold: 0.85 }))
  ) {
    return clustalColors.polar;
  }
  if (
    normalized === "Q" &&
    (matchesClustalRule({ summary, symbols: ["K", "R"], threshold: 0.6 }) ||
      matchesClustalRule({ summary, symbols: ["Q", "E"], threshold: 0.5 }) ||
      matchesClustalRule({
        summary,
        symbols: ["Q", "T", "K", "R"],
        threshold: 0.85,
      }))
  ) {
    return clustalColors.polar;
  }
  if (
    ["S", "T"].includes(normalized) &&
    (matchesClustalRule({
      summary,
      symbols: hydrophobicGroup,
      threshold: 0.6,
    }) ||
      matchesClustalRule({ summary, symbols: ["T", "S"], threshold: 0.5 }) ||
      matchesClustalRule({ summary, symbols: ["S", "T"], threshold: 0.85 }))
  ) {
    return clustalColors.polar;
  }
  if (
    ["A", "C", "I", "L", "M", "F", "W", "V"].includes(normalized) &&
    matchesClustalRule({
      summary,
      symbols: hydrophobicGroup,
      threshold: 0.6,
    })
  ) {
    return clustalColors.hydrophobic;
  }
  return "transparent";
}

function getZappoColor(symbol: string): string {
  const normalized = symbol.toUpperCase();
  if (["I", "L", "V", "A", "M"].includes(normalized)) {
    return zappoColors.aliphaticHydrophobic;
  }
  if (["F", "W", "Y"].includes(normalized)) {
    return zappoColors.aromatic;
  }
  if (["K", "R", "H"].includes(normalized)) {
    return zappoColors.positive;
  }
  if (["D", "E"].includes(normalized)) {
    return zappoColors.negative;
  }
  if (["S", "T", "N", "Q"].includes(normalized)) {
    return zappoColors.hydrophilic;
  }
  if (["P", "G"].includes(normalized)) {
    return zappoColors.conformationallySpecial;
  }
  if (normalized === "C") {
    return zappoColors.cysteine;
  }
  return UNKNOWN_RESIDUE_COLOR;
}

function getResidueModeColor({
  columnSummary,
  moleculeType,
  palette,
  symbol,
}: {
  columnSummary: MsaColumnSummary;
  moleculeType: MsaMoleculeType;
  palette: MsaResiduePalette | null;
  symbol: string;
}): string {
  if (isThemeAwareMsaPalette(palette)) {
    if (!isResiduePaletteCompatible(moleculeType, palette)) {
      return UNKNOWN_RESIDUE_COLOR;
    }
    return getSequenceResidueStyle({
      molecule: moleculeType === "mixed" ? "unknown" : moleculeType,
      paletteId: palette,
      residue: symbol,
    }).backgroundColor;
  }
  if (isGapSymbol(symbol)) {
    return "transparent";
  }

  const normalized = symbol.toUpperCase();
  if (moleculeType === "protein") {
    switch (palette) {
      case "rasmol":
        return rasMolColors[normalized] ?? rasMolFallbackColor;
      case "clustal-x":
        return getClustalXColor(normalized, columnSummary);
      case "zappo":
        return getZappoColor(normalized);
      case "hydrophobicity":
        return hydrophobicityColors[normalized] ?? UNKNOWN_RESIDUE_COLOR;
      case "ncbi-nucleic-acid":
      case "jalview-nucleotide":
      case "purine-pyrimidine":
      case "nucleotide-ambiguity":
      case null:
        return UNKNOWN_RESIDUE_COLOR;
    }
  }

  if (
    moleculeType === "dna" ||
    moleculeType === "rna" ||
    moleculeType === "nucleic-acid-ambiguous"
  ) {
    switch (palette) {
      case "ncbi-nucleic-acid":
        return ncbiNucleotideColors[normalized] ?? UNKNOWN_RESIDUE_COLOR;
      case "jalview-nucleotide":
        return jalviewNucleotideColors[normalized] ?? UNKNOWN_RESIDUE_COLOR;
      case "purine-pyrimidine":
        return purinePyrimidineColors[normalized] ?? UNKNOWN_RESIDUE_COLOR;
      case "nucleotide-ambiguity":
        return nucleotideAmbiguityColors[normalized] ?? UNKNOWN_RESIDUE_COLOR;
      case "rasmol":
      case "clustal-x":
      case "zappo":
      case "hydrophobicity":
      case null:
        return UNKNOWN_RESIDUE_COLOR;
    }
  }

  const residueClass = classifyResidue(symbol, moleculeType);
  return residueClass === "unknown" ? UNKNOWN_RESIDUE_COLOR : "#e8eef8";
}

export function getMsaCellBackground({
  columnSummary,
  document,
  mode,
  palette,
  referenceSymbol,
  symbol,
}: {
  columnSummary: MsaColumnSummary;
  document: MsaDocument;
  mode: MsaColorMode;
  palette: MsaResiduePalette | null;
  referenceSymbol?: string;
  symbol: string;
}): string {
  if (mode === "identity") {
    return getIdentityColor(columnSummary.identity);
  }
  if (mode === "protein-conservation") {
    return getProteinConservationColor(columnSummary.conservationNormalized);
  }
  if (mode === "protein-similarity") {
    return getProteinSimilarityColor(
      getProteinSimilarityScore({
        columnSummary,
        referenceSymbol,
        symbol,
      }),
    );
  }
  if (mode === "nucleotide-substitution") {
    return getNucleotideSubstitutionColor({ referenceSymbol, symbol });
  }
  if (mode === "coding-impact") {
    return isGapSymbol(symbol) ? "transparent" : DIFFERENCE_MATCH_COLOR;
  }
  if (mode === "difference") {
    if (referenceSymbol == null) {
      return isGapSymbol(symbol) ? "transparent" : DIFFERENCE_MATCH_COLOR;
    }
    if (symbol.toUpperCase() !== referenceSymbol.toUpperCase()) {
      return DIFFERENCE_MISMATCH_COLOR;
    }
    return isGapSymbol(symbol) ? "transparent" : DIFFERENCE_MATCH_COLOR;
  }
  return getResidueModeColor({
    columnSummary,
    moleculeType: document.displayInterpretation.moleculeType,
    palette,
    symbol,
  });
}

export function getNucleotideSubstitutionColor({
  referenceSymbol,
  symbol,
}: {
  referenceSymbol?: string;
  symbol: string;
}): string {
  if (referenceSymbol == null) {
    return isGapSymbol(symbol) ? "transparent" : DIFFERENCE_MATCH_COLOR;
  }
  const reference = normalizeNucleotideBase(referenceSymbol);
  const candidate = normalizeNucleotideBase(symbol);
  if (candidate === reference) {
    return isGapSymbol(symbol) ? "transparent" : DIFFERENCE_MATCH_COLOR;
  }
  if (
    !["A", "C", "G", "T"].includes(reference) ||
    !["A", "C", "G", "T"].includes(candidate)
  ) {
    return DIFFERENCE_MISMATCH_COLOR;
  }
  const transition =
    (reference === "A" && candidate === "G") ||
    (reference === "G" && candidate === "A") ||
    (reference === "C" && candidate === "T") ||
    (reference === "T" && candidate === "C");
  return transition
    ? NUCLEOTIDE_TRANSITION_COLOR
    : NUCLEOTIDE_TRANSVERSION_COLOR;
}

function normalizeNucleotideBase(symbol: string): string {
  const normalized = symbol.toUpperCase();
  return normalized === "U" ? "T" : normalized;
}

export function getMsaCellTextColor({
  backgroundColor,
  mode,
  moleculeType,
  palette,
  symbol,
}: {
  backgroundColor: string;
  mode: MsaColorMode;
  moleculeType: MsaMoleculeType;
  palette: MsaResiduePalette | null;
  symbol: string;
}): string | undefined {
  if (
    mode === "residue" &&
    isThemeAwareMsaPalette(palette) &&
    isResiduePaletteCompatible(moleculeType, palette)
  ) {
    return getSequenceResidueStyle({
      molecule: moleculeType === "mixed" ? "unknown" : moleculeType,
      paletteId: palette,
      residue: symbol,
    }).color;
  }
  return getReadableMsaCellTextColor(backgroundColor);
}

export function getReadableMsaCellTextColor(
  backgroundColor: string,
): string | undefined {
  const backgroundRgb = parseOpaqueHexColor(backgroundColor);
  if (backgroundRgb == null) {
    return undefined;
  }
  const backgroundLuminance = getRelativeLuminance(backgroundRgb);
  const darkTextLuminance = getRelativeLuminance([17, 24, 39]);
  const lightTextLuminance = 1;
  const darkTextContrast = getContrastRatio(
    backgroundLuminance,
    darkTextLuminance,
  );
  const lightTextContrast = getContrastRatio(
    backgroundLuminance,
    lightTextLuminance,
  );
  return lightTextContrast > darkTextContrast
    ? DARK_PALETTE_TEXT_COLOR
    : LIGHT_PALETTE_TEXT_COLOR;
}

export function getLegendSwatchColor({
  palette,
  symbol,
}: {
  palette: MsaResiduePalette;
  symbol: string;
}): string {
  const summary: MsaColumnSummary = {
    conservationModel: null,
    conservationNormalized: null,
    gapFraction: 0,
    identity: 1,
    nongapCount: 1,
    nucleotideInformationContentBits: null,
    proteinRelativeEntropyBits: null,
    symbolCounts: { [symbol.toUpperCase()]: 1 },
    weightedSupport: 1,
    weightedSymbolFractions: { [symbol.toUpperCase()]: 1 },
  };
  return getResidueModeColor({
    columnSummary: summary,
    moleculeType: PROTEIN_RESIDUE_PALETTES.includes(palette)
      ? "protein"
      : "dna",
    palette,
    symbol,
  });
}

function parseOpaqueHexColor(
  backgroundColor: string,
): [number, number, number] | null {
  const match = /^#([\da-f]{6})$/i.exec(backgroundColor.trim());
  if (match == null) {
    return null;
  }
  const hex = match[1]!;
  return [
    Number.parseInt(hex.slice(0, 2), 16),
    Number.parseInt(hex.slice(2, 4), 16),
    Number.parseInt(hex.slice(4, 6), 16),
  ];
}

function getRelativeLuminance([red, green, blue]: [
  number,
  number,
  number,
]): number {
  const normalizedRed = getLinearizedColorChannel(red);
  const normalizedGreen = getLinearizedColorChannel(green);
  const normalizedBlue = getLinearizedColorChannel(blue);
  return (
    0.2126 * normalizedRed + 0.7152 * normalizedGreen + 0.0722 * normalizedBlue
  );
}

function getLinearizedColorChannel(channel: number): number {
  const normalized = channel / 255;
  return normalized <= 0.04045
    ? normalized / 12.92
    : ((normalized + 0.055) / 1.055) ** 2.4;
}

function getContrastRatio(first: number, second: number): number {
  const lighter = Math.max(first, second);
  const darker = Math.min(first, second);
  return (lighter + 0.05) / (darker + 0.05);
}

function interpolateHex(from: string, to: string, rawFraction: number): string {
  const fraction = Math.max(0, Math.min(1, rawFraction));
  const fromRgb = parseOpaqueHexColor(from);
  const toRgb = parseOpaqueHexColor(to);
  if (fromRgb == null || toRgb == null) {
    return from;
  }
  return `#${fromRgb
    .map((channel, index) =>
      Math.round(channel + ((toRgb[index] ?? channel) - channel) * fraction)
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;
}

const BLOSUM62_MATRIX = parseBlosumMatrix(`
   A  R  N  D  C  Q  E  G  H  I  L  K  M  F  P  S  T  W  Y  V  B  J  Z  X  *
A  4 -1 -2 -2  0 -1 -1  0 -2 -1 -1 -1 -1 -2 -1  1  0 -3 -2  0 -2 -1 -1 -1 -4
R -1  5  0 -2 -3  1  0 -2  0 -3 -2  2 -1 -3 -2 -1 -1 -3 -2 -3 -1 -2  0 -1 -4
N -2  0  6  1 -3  0  0  0  1 -3 -3  0 -2 -3 -2  1  0 -4 -2 -3  4 -3  0 -1 -4
D -2 -2  1  6 -3  0  2 -1 -1 -3 -4 -1 -3 -3 -1  0 -1 -4 -3 -3  4 -3  1 -1 -4
C  0 -3 -3 -3  9 -3 -4 -3 -3 -1 -1 -3 -1 -2 -3 -1 -1 -2 -2 -1 -3 -1 -3 -1 -4
Q -1  1  0  0 -3  5  2 -2  0 -3 -2  1  0 -3 -1  0 -1 -2 -1 -2  0 -2  4 -1 -4
E -1  0  0  2 -4  2  5 -2  0 -3 -3  1 -2 -3 -1  0 -1 -3 -2 -2  1 -3  4 -1 -4
G  0 -2  0 -1 -3 -2 -2  6 -2 -4 -4 -2 -3 -3 -2  0 -2 -2 -3 -3 -1 -4 -2 -1 -4
H -2  0  1 -1 -3  0  0 -2  8 -3 -3 -1 -2 -1 -2 -1 -2 -2  2 -3  0 -3  0 -1 -4
I -1 -3 -3 -3 -1 -3 -3 -4 -3  4  2 -3  1  0 -3 -2 -1 -3 -1  3 -3  3 -3 -1 -4
L -1 -2 -3 -4 -1 -2 -3 -4 -3  2  4 -2  2  0 -3 -2 -1 -2 -1  1 -4  3 -3 -1 -4
K -1  2  0 -1 -3  1  1 -2 -1 -3 -2  5 -1 -3 -1  0 -1 -3 -2 -2  0 -3  1 -1 -4
M -1 -1 -2 -3 -1  0 -2 -3 -2  1  2 -1  5  0 -2 -1 -1 -1 -1  1 -3  2 -1 -1 -4
F -2 -3 -3 -3 -2 -3 -3 -3 -1  0  0 -3  0  6 -4 -2 -2  1  3 -1 -3  0 -3 -1 -4
P -1 -2 -2 -1 -3 -1 -1 -2 -2 -3 -3 -1 -2 -4  7 -1 -1 -4 -3 -2 -2 -3 -1 -1 -4
S  1 -1  1  0 -1  0  0  0 -1 -2 -2  0 -1 -2 -1  4  1 -3 -2 -2  0 -2  0 -1 -4
T  0 -1  0 -1 -1 -1 -1 -2 -2 -1 -1 -1 -1 -2 -1  1  5 -2 -2  0 -1 -1 -1 -1 -4
W -3 -3 -4 -4 -2 -2 -3 -2 -2 -3 -2 -3 -1  1 -4 -3 -2 11  2 -3 -4 -2 -2 -1 -4
Y -2 -2 -2 -3 -2 -1 -2 -3  2 -1 -1 -2 -1  3 -3 -2 -2  2  7 -1 -3 -1 -2 -1 -4
V  0 -3 -3 -3 -1 -2 -2 -3 -3  3  1 -2  1 -1 -2 -2  0 -3 -1  4 -3  2 -2 -1 -4
B -2 -1  4  4 -3  0  1 -1  0 -3 -4  0 -3 -3 -2  0 -1 -4 -3 -3  4 -3  0 -1 -4
J -1 -2 -3 -3 -1 -2 -3 -4 -3  3  3 -3  2  0 -3 -2 -1 -2 -1  2 -3  3 -3 -1 -4
Z -1  0  0  1 -3  4  4 -2  0 -3 -3  1 -1 -3 -1  0 -1 -2 -2 -2  0 -3  4 -1 -4
X -1 -1 -1 -1 -1 -1 -1 -1 -1 -1 -1 -1 -1 -1 -1 -1 -1 -1 -1 -1 -1 -1 -1 -1 -4
* -4 -4 -4 -4 -4 -4 -4 -4 -4 -4 -4 -4 -4 -4 -4 -4 -4 -4 -4 -4 -4 -4 -4 -4  1
`);

function parseBlosumMatrix(matrix: string): Map<string, number> {
  const lines = matrix
    .trim()
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  const header = lines[0]?.split(/\s+/) ?? [];
  const scores = new Map<string, number>();
  for (const line of lines.slice(1)) {
    const [row, ...values] = line.split(/\s+/);
    if (row == null) {
      continue;
    }
    header.forEach((column, index) => {
      const score = Number(values[index]);
      if (Number.isFinite(score)) {
        scores.set(`${row}:${column}`, score);
      }
    });
  }
  return scores;
}

function getProteinSimilarityScore({
  columnSummary,
  referenceSymbol,
  symbol,
}: {
  columnSummary: MsaColumnSummary;
  referenceSymbol?: string;
  symbol: string;
}): number | null {
  if (isGapSymbol(symbol)) {
    return null;
  }
  if (referenceSymbol != null) {
    return getBlosum62Score(symbol, referenceSymbol);
  }
  let weightedScore = 0;
  let support = 0;
  for (const [candidate, fraction] of Object.entries(
    columnSummary.weightedSymbolFractions,
  )) {
    const score = getBlosum62Score(symbol, candidate);
    if (score == null) {
      continue;
    }
    weightedScore += score * fraction;
    support += fraction;
  }
  return support === 0 ? null : weightedScore / support;
}

function getBlosum62Score(first: string, second: string): number | null {
  const normalizedFirst = first.toUpperCase();
  const normalizedSecond = second.toUpperCase();
  return (
    BLOSUM62_MATRIX.get(`${normalizedFirst}:${normalizedSecond}`) ??
    BLOSUM62_MATRIX.get(`${normalizedSecond}:${normalizedFirst}`) ??
    null
  );
}

export function getHydrophobicityGradient(): string {
  return `linear-gradient(90deg, ${hydrophobicityColors.I}, ${
    hydrophobicityColors.G
  }, ${hydrophobicityColors.R})`;
}

export function getIdentityGradient(): string {
  return `linear-gradient(90deg, ${identityLowColor}, ${identityHighColor})`;
}

export function getProteinConservationGradient(): string {
  return `linear-gradient(90deg, ${proteinConservationLowColor}, ${proteinConservationHighColor})`;
}

export function getProteinSimilarityGradient(): string {
  return `linear-gradient(90deg, ${proteinSimilarityLowColor} 0%, ${proteinSimilarityNeutralColor} 27%, ${proteinSimilarityHighColor} 100%)`;
}
