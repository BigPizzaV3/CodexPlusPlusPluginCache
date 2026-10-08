import { isGapSymbol } from "./residue-alphabet";
import type { MsaCdsContext, MsaDocument, MsaSequenceRow } from "./types";

const standardCodonTable = new Map<string, string>([
  ["ATA", "I"],
  ["ATC", "I"],
  ["ATT", "I"],
  ["ATG", "M"],
  ["ACA", "T"],
  ["ACC", "T"],
  ["ACG", "T"],
  ["ACT", "T"],
  ["AAC", "N"],
  ["AAT", "N"],
  ["AAA", "K"],
  ["AAG", "K"],
  ["AGC", "S"],
  ["AGT", "S"],
  ["AGA", "R"],
  ["AGG", "R"],
  ["CTA", "L"],
  ["CTC", "L"],
  ["CTG", "L"],
  ["CTT", "L"],
  ["CCA", "P"],
  ["CCC", "P"],
  ["CCG", "P"],
  ["CCT", "P"],
  ["CAC", "H"],
  ["CAT", "H"],
  ["CAA", "Q"],
  ["CAG", "Q"],
  ["CGA", "R"],
  ["CGC", "R"],
  ["CGG", "R"],
  ["CGT", "R"],
  ["GTA", "V"],
  ["GTC", "V"],
  ["GTG", "V"],
  ["GTT", "V"],
  ["GCA", "A"],
  ["GCC", "A"],
  ["GCG", "A"],
  ["GCT", "A"],
  ["GAC", "D"],
  ["GAT", "D"],
  ["GAA", "E"],
  ["GAG", "E"],
  ["GGA", "G"],
  ["GGC", "G"],
  ["GGG", "G"],
  ["GGT", "G"],
  ["TCA", "S"],
  ["TCC", "S"],
  ["TCG", "S"],
  ["TCT", "S"],
  ["TTC", "F"],
  ["TTT", "F"],
  ["TTA", "L"],
  ["TTG", "L"],
  ["TAC", "Y"],
  ["TAT", "Y"],
  ["TAA", "*"],
  ["TAG", "*"],
  ["TGC", "C"],
  ["TGT", "C"],
  ["TGA", "*"],
  ["TGG", "W"],
]);

export function translateStandardCodon(codon: string): string | null {
  const normalized = codon.toUpperCase().replaceAll("U", "T");
  return /^[ACGT]{3}$/.test(normalized)
    ? (standardCodonTable.get(normalized) ?? null)
    : null;
}

function hasUnambiguousUngappedTriplets(row: MsaSequenceRow): boolean {
  if (row.alignedSequence.length % 3 !== 0) {
    return false;
  }
  for (let column = 0; column < row.alignedSequence.length; column += 3) {
    const codon = row.alignedSequence.slice(column, column + 3);
    if (
      Array.from(codon).some(isGapSymbol) ||
      translateStandardCodon(codon) == null
    ) {
      return false;
    }
  }
  return true;
}

export function inferCdsContext({
  alignedLength,
  moleculeType,
  rows,
}: {
  alignedLength: number;
  moleculeType: MsaDocument["molecule"]["moleculeType"];
  rows: Array<MsaSequenceRow>;
}): MsaCdsContext {
  if (moleculeType !== "dna") {
    return {
      applicability: "not-eligible",
      reasonNotEligible: "CDS mode currently requires a DNA alignment.",
    };
  }
  if (alignedLength === 0 || alignedLength % 3 !== 0) {
    return {
      applicability: "not-eligible",
      reasonNotEligible:
        "Alignment length is not divisible by three for codon grouping.",
    };
  }
  if (!rows.every(hasUnambiguousUngappedTriplets)) {
    return {
      applicability: "unknown",
      reasonNotEligible:
        "Some rows contain gaps or ambiguous codons that prevent confident default CDS interpretation.",
    };
  }
  return {
    applicability: "eligible",
    frameStartColumn: 0,
    geneticCodeId: 1,
    translationMode: "standard-default",
  };
}

export function isNonsynonymousCodonDifference({
  anchorCodon,
  candidateCodon,
}: {
  anchorCodon: string;
  candidateCodon: string;
}): boolean | null {
  const anchorResidue = translateStandardCodon(anchorCodon);
  const candidateResidue = translateStandardCodon(candidateCodon);
  if (anchorResidue == null || candidateResidue == null) {
    return null;
  }
  return anchorResidue !== candidateResidue;
}
