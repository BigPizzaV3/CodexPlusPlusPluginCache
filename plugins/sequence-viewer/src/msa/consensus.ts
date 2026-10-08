import { expandNucleotideSymbol, isGapSymbol } from "./residue-alphabet";
import type { MsaMoleculeType, MsaSequenceRow } from "./types";

const nucleotideConsensusByKey = new Map<string, string>([
  ["A", "A"],
  ["AC", "M"],
  ["ACG", "V"],
  ["ACGT", "N"],
  ["AG", "R"],
  ["AGT", "D"],
  ["AT", "W"],
  ["C", "C"],
  ["CG", "S"],
  ["CGT", "B"],
  ["CT", "Y"],
  ["G", "G"],
  ["GT", "K"],
  ["T", "T"],
]);

function normalizedBaseForConsensus(
  base: string,
  moleculeType: MsaMoleculeType,
): string {
  if (moleculeType === "rna" && base === "T") {
    return "U";
  }
  return base;
}

function getExpandedConsensusBases(
  symbol: string,
  moleculeType: MsaMoleculeType,
): Array<string> {
  return [...expandNucleotideSymbol(symbol)].map((base) =>
    normalizedBaseForConsensus(base, moleculeType),
  );
}

function getIupacSymbol(
  bases: Set<string>,
  moleculeType: MsaMoleculeType,
): string {
  const canonical = [...bases]
    .map((base) => (base === "U" ? "T" : base))
    .sort()
    .join("");
  const symbol = nucleotideConsensusByKey.get(canonical) ?? "N";
  return moleculeType === "rna" && symbol === "T" ? "U" : symbol;
}

export function computeNucleotideConsensus(
  rows: Array<MsaSequenceRow>,
  moleculeType: MsaMoleculeType,
  threshold = 0.7,
): string {
  const length = rows[0]?.alignedSequence.length ?? 0;
  let consensus = "";
  for (let column = 0; column < length; column += 1) {
    const observed = new Map<string, number>();
    let totalWeight = 0;
    for (const row of rows) {
      const symbol = row.alignedSequence[column] ?? "-";
      if (isGapSymbol(symbol)) {
        continue;
      }
      const expanded = getExpandedConsensusBases(symbol, moleculeType);
      if (expanded.length === 0) {
        continue;
      }
      const weight = 1 / expanded.length;
      for (const base of expanded) {
        observed.set(base, (observed.get(base) ?? 0) + weight);
      }
      totalWeight += 1;
    }
    if (observed.size === 0 || totalWeight === 0) {
      consensus += "-";
      continue;
    }
    const fractions = [...observed.entries()]
      .map(([base, value]) => [base, value / totalWeight] as const)
      .sort(
        ([baseA, valueA], [baseB, valueB]) =>
          valueB - valueA || baseA.localeCompare(baseB),
      );
    const supportedBases = new Set<string>();
    let cumulative = 0;
    for (const [base, fraction] of fractions) {
      supportedBases.add(base);
      cumulative += fraction;
      if (cumulative >= threshold) {
        break;
      }
    }
    consensus += getIupacSymbol(supportedBases, moleculeType);
  }
  return consensus;
}

export function computeProteinRepresentative(
  rows: Array<MsaSequenceRow>,
): string {
  const length = rows[0]?.alignedSequence.length ?? 0;
  let representative = "";
  for (let column = 0; column < length; column += 1) {
    const counts = new Map<string, number>();
    for (const row of rows) {
      const symbol = row.alignedSequence[column]?.toUpperCase() ?? "-";
      if (isGapSymbol(symbol)) {
        continue;
      }
      counts.set(symbol, (counts.get(symbol) ?? 0) + 1);
    }
    const [best] = [...counts.entries()].sort(
      ([symbolA, countA], [symbolB, countB]) =>
        countB - countA || symbolA.localeCompare(symbolB),
    );
    representative += best?.[0] ?? "-";
  }
  return representative;
}
