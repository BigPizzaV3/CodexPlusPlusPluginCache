import {
  expandNucleotideSymbol,
  expandProteinSymbol,
  isGapSymbol,
} from "./residue-alphabet";
import type {
  MsaConservationModel,
  MsaMetricProvenance,
  MsaMoleculeType,
  MsaSequenceRow,
} from "./types";

const CANONICAL_PROTEIN_RESIDUES = [
  "A",
  "R",
  "N",
  "D",
  "C",
  "Q",
  "E",
  "G",
  "H",
  "I",
  "L",
  "K",
  "M",
  "F",
  "P",
  "S",
  "T",
  "W",
  "Y",
  "V",
] as const;

const CANONICAL_DNA_BASES = ["A", "C", "G", "T"] as const;
const CANONICAL_RNA_BASES = ["A", "C", "G", "U"] as const;

/**
 * Robinson-Robinson amino-acid background probabilities as surfaced by
 * NCBI BLAST's standard residue-frequency tables.
 */
const PROTEIN_BACKGROUND_FREQUENCIES: Record<string, number> = {
  A: 0.07805,
  C: 0.01925,
  D: 0.05364,
  E: 0.06295,
  F: 0.03856,
  G: 0.07377,
  H: 0.02199,
  I: 0.05142,
  K: 0.05744,
  L: 0.09019,
  M: 0.02243,
  N: 0.04487,
  P: 0.05203,
  Q: 0.04264,
  R: 0.05129,
  S: 0.0712,
  T: 0.05841,
  V: 0.06441,
  W: 0.0133,
  Y: 0.03216,
};

const MAX_PROTEIN_RELATIVE_ENTROPY_BITS = Math.max(
  ...Object.values(PROTEIN_BACKGROUND_FREQUENCIES).map(
    (frequency) => -Math.log2(frequency),
  ),
);
const MAX_NUCLEOTIDE_INFORMATION_BITS = 2;

export type MsaColumnSummary = {
  conservationModel: MsaConservationModel | null;
  conservationNormalized: number | null;
  gapFraction: number;
  identity: number;
  nongapCount: number;
  nucleotideInformationContentBits: number | null;
  proteinRelativeEntropyBits: number | null;
  symbolCounts: Record<string, number>;
  weightedSupport: number;
  weightedSymbolFractions: Record<string, number>;
};

export function getConservationProvenance(
  moleculeType: MsaMoleculeType,
): MsaMetricProvenance | null {
  if (moleculeType === "protein") {
    return {
      algorithm: "Weighted KL divergence of column amino-acid frequencies",
      ambiguityPolicy:
        "Protein ambiguity symbols contribute fractionally to their supported canonical residues where possible.",
      backgroundModel:
        "Robinson-Robinson amino-acid background probabilities from NCBI BLAST tables.",
      gapPolicy:
        "Gaps are excluded from the conservation distribution and surfaced separately as gap occupancy.",
      kind: "protein-relative-entropy",
      modality: moleculeType,
      weightingPolicy: "henikoff",
    };
  }
  if (
    moleculeType === "dna" ||
    moleculeType === "rna" ||
    moleculeType === "nucleic-acid-ambiguous"
  ) {
    return {
      algorithm:
        "Weighted information content (maximum two bits minus Shannon entropy)",
      ambiguityPolicy:
        "IUPAC ambiguity symbols contribute fractionally to supported canonical bases.",
      gapPolicy:
        "Gaps are excluded from the residue/base distribution and surfaced separately as gap occupancy.",
      kind: "nucleotide-information-content",
      modality: moleculeType,
      weightingPolicy: "henikoff",
    };
  }
  return null;
}

export function computeColumnSummaries(
  rows: Array<MsaSequenceRow>,
  moleculeType: MsaMoleculeType = "unknown",
): Array<MsaColumnSummary> {
  const alignedLength = rows[0]?.alignedSequence.length ?? 0;
  const weights = computeHenikoffWeights(rows, moleculeType);
  return Array.from({ length: alignedLength }, (_, column) => {
    const counts = new Map<string, number>();
    const weightedCounts = new Map<string, number>();
    let gapCount = 0;
    let weightedSupport = 0;
    for (const row of rows) {
      const symbol = row.alignedSequence[column]?.toUpperCase() ?? "-";
      if (isGapSymbol(symbol)) {
        gapCount += 1;
        continue;
      }
      counts.set(symbol, (counts.get(symbol) ?? 0) + 1);
      const expansion = getExpandedCanonicalSymbols(symbol, moleculeType);
      if (expansion.length === 0) {
        continue;
      }
      const rowWeight = weights[row.id] ?? 0;
      const contribution = rowWeight / expansion.length;
      for (const residue of expansion) {
        weightedCounts.set(
          residue,
          (weightedCounts.get(residue) ?? 0) + contribution,
        );
      }
      weightedSupport += rowWeight;
    }

    const nongapCount = rows.length - gapCount;
    const maxCount = Math.max(0, ...counts.values());
    const weightedSymbolFractions =
      weightedSupport === 0
        ? {}
        : Object.fromEntries(
            [...weightedCounts.entries()].map(([symbol, value]) => [
              symbol,
              value / weightedSupport,
            ]),
          );
    const conservation = computeConservationMetrics({
      moleculeType,
      weightedSymbolFractions,
    });

    return {
      conservationModel: conservation.model,
      conservationNormalized: conservation.normalized,
      gapFraction: rows.length === 0 ? 0 : gapCount / rows.length,
      identity: nongapCount === 0 ? 0 : maxCount / nongapCount,
      nongapCount,
      nucleotideInformationContentBits: conservation.nucleotideBits,
      proteinRelativeEntropyBits: conservation.proteinBits,
      symbolCounts: Object.fromEntries(counts),
      weightedSupport,
      weightedSymbolFractions,
    };
  });
}

export function getMeanIdentity(summaries: Array<MsaColumnSummary>): number {
  if (summaries.length === 0) {
    return 0;
  }
  return (
    summaries.reduce((total, summary) => total + summary.identity, 0) /
    summaries.length
  );
}

export function getMeanNormalizedConservation(
  summaries: Array<MsaColumnSummary>,
): number | null {
  const scores = summaries
    .map((summary) => summary.conservationNormalized)
    .filter((score): score is number => score != null);
  if (scores.length === 0) {
    return null;
  }
  return scores.reduce((total, score) => total + score, 0) / scores.length;
}

export function computeHenikoffWeights(
  rows: Array<MsaSequenceRow>,
  moleculeType: MsaMoleculeType,
): Record<string, number> {
  if (rows.length === 0) {
    return {};
  }
  const rawWeights = Object.fromEntries(
    rows.map((row) => [row.id, 0]),
  ) as Record<string, number>;
  const alignedLength = rows[0]?.alignedSequence.length ?? 0;

  for (let column = 0; column < alignedLength; column += 1) {
    const symbolByRow = new Map<string, string>();
    const counts = new Map<string, number>();
    for (const row of rows) {
      const symbol = row.alignedSequence[column]?.toUpperCase() ?? "-";
      const canonical = getSingleCanonicalSymbol(symbol, moleculeType);
      if (canonical == null) {
        continue;
      }
      symbolByRow.set(row.id, canonical);
      counts.set(canonical, (counts.get(canonical) ?? 0) + 1);
    }
    const residueTypeCount = counts.size;
    if (residueTypeCount === 0) {
      continue;
    }
    for (const [rowId, canonical] of symbolByRow) {
      const residueCount = counts.get(canonical) ?? 0;
      if (residueCount === 0) {
        continue;
      }
      rawWeights[rowId] =
        (rawWeights[rowId] ?? 0) + 1 / (residueTypeCount * residueCount);
    }
  }

  const total = Object.values(rawWeights).reduce(
    (sum, weight) => sum + weight,
    0,
  );
  if (total === 0) {
    const uniform = 1 / rows.length;
    return Object.fromEntries(rows.map((row) => [row.id, uniform]));
  }
  return Object.fromEntries(
    rows.map((row) => [row.id, (rawWeights[row.id] ?? 0) / total]),
  );
}

function computeConservationMetrics({
  moleculeType,
  weightedSymbolFractions,
}: {
  moleculeType: MsaMoleculeType;
  weightedSymbolFractions: Record<string, number>;
}): {
  model: MsaConservationModel | null;
  normalized: number | null;
  nucleotideBits: number | null;
  proteinBits: number | null;
} {
  if (moleculeType === "protein") {
    const proteinBits = computeProteinRelativeEntropyBits(
      weightedSymbolFractions,
    );
    return {
      model: "protein-relative-entropy",
      normalized:
        proteinBits == null
          ? null
          : clamp01(proteinBits / MAX_PROTEIN_RELATIVE_ENTROPY_BITS),
      nucleotideBits: null,
      proteinBits,
    };
  }
  if (
    moleculeType === "dna" ||
    moleculeType === "rna" ||
    moleculeType === "nucleic-acid-ambiguous"
  ) {
    const nucleotideBits = computeNucleotideInformationContentBits(
      weightedSymbolFractions,
    );
    return {
      model:
        moleculeType === "rna"
          ? "rna-information-content"
          : "dna-information-content",
      normalized:
        nucleotideBits == null
          ? null
          : clamp01(nucleotideBits / MAX_NUCLEOTIDE_INFORMATION_BITS),
      nucleotideBits,
      proteinBits: null,
    };
  }
  return {
    model: null,
    normalized: null,
    nucleotideBits: null,
    proteinBits: null,
  };
}

function computeProteinRelativeEntropyBits(
  weightedSymbolFractions: Record<string, number>,
): number | null {
  let score = 0;
  let support = 0;
  for (const residue of CANONICAL_PROTEIN_RESIDUES) {
    const fraction = weightedSymbolFractions[residue] ?? 0;
    if (fraction <= 0) {
      continue;
    }
    const background = PROTEIN_BACKGROUND_FREQUENCIES[residue];
    if (background == null || background <= 0) {
      continue;
    }
    support += fraction;
    score += fraction * Math.log2(fraction / background);
  }
  return support === 0 ? null : score;
}

function computeNucleotideInformationContentBits(
  weightedSymbolFractions: Record<string, number>,
): number | null {
  const fractions = Object.values(weightedSymbolFractions).filter(
    (fraction) => fraction > 0,
  );
  if (fractions.length === 0) {
    return null;
  }
  const entropy = fractions.reduce(
    (total, fraction) => total - fraction * Math.log2(fraction),
    0,
  );
  return Math.max(0, MAX_NUCLEOTIDE_INFORMATION_BITS - entropy);
}

function getExpandedCanonicalSymbols(
  symbol: string,
  moleculeType: MsaMoleculeType,
): Array<string> {
  if (moleculeType === "protein") {
    return [...expandProteinSymbol(symbol)].filter((residue) =>
      CANONICAL_PROTEIN_RESIDUES.includes(
        residue as (typeof CANONICAL_PROTEIN_RESIDUES)[number],
      ),
    );
  }
  if (
    moleculeType === "dna" ||
    moleculeType === "rna" ||
    moleculeType === "nucleic-acid-ambiguous"
  ) {
    const alphabet: ReadonlyArray<string> =
      moleculeType === "rna" ? CANONICAL_RNA_BASES : CANONICAL_DNA_BASES;
    return [...expandNucleotideSymbol(symbol)]
      .map((base) => normalizeNucleotideBase(base, moleculeType))
      .filter((base, index, bases) => {
        return alphabet.includes(base) && bases.indexOf(base) === index;
      });
  }
  return [];
}

function getSingleCanonicalSymbol(
  symbol: string,
  moleculeType: MsaMoleculeType,
): string | null {
  const expansion = getExpandedCanonicalSymbols(symbol, moleculeType);
  return expansion.length === 1 ? expansion[0]! : null;
}

function normalizeNucleotideBase(
  base: string,
  moleculeType: MsaMoleculeType,
): string {
  if (moleculeType === "rna") {
    return base === "T" ? "U" : base;
  }
  return base === "U" ? "T" : base;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}
