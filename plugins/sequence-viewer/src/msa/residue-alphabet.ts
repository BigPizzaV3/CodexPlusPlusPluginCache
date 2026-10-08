import type { MsaMoleculeType, MsaResidueClass } from "./types";
import {
  complementNucleotideSymbol as complementSharedNucleotideSymbol,
  expandNucleotideSymbol as expandSharedNucleotideSymbol,
  isNucleotideSymbol as isSharedNucleotideSymbol,
  reverseComplementNucleotide,
} from "../nucleotide-alphabet";
import { expandAminoAcidSymbol } from "../amino-acid-alphabet";

const dnaBases = new Set(["A", "C", "G", "T"]);
const rnaBases = new Set(["A", "C", "G", "U"]);
const ambiguousNucleotides = new Set([
  "B",
  "D",
  "H",
  "K",
  "M",
  "N",
  "R",
  "S",
  "V",
  "W",
  "Y",
]);
const standardAminoAcids = new Set([
  "A",
  "C",
  "D",
  "E",
  "F",
  "G",
  "H",
  "I",
  "K",
  "L",
  "M",
  "N",
  "P",
  "Q",
  "R",
  "S",
  "T",
  "V",
  "W",
  "Y",
]);
const ambiguousAminoAcids = new Set(["B", "J", "X", "Z"]);
const specialAminoAcids = new Set(["O", "U"]);
const gapSymbols = new Set(["-", ".", "_", "~"]);

export function normalizeResidueSymbol(symbol: string): string {
  return symbol.toUpperCase();
}

export function isGapSymbol(symbol: string): boolean {
  return gapSymbols.has(symbol);
}

export function normalizeGapSymbol(symbol: string): string {
  return isGapSymbol(symbol) ? "-" : symbol;
}

export function classifyResidue(
  symbol: string,
  moleculeType: MsaMoleculeType = "unknown",
): MsaResidueClass {
  if (symbol.length === 0) {
    return "unknown";
  }
  if (symbol === symbol.toLowerCase() && /[a-z]/.test(symbol)) {
    return "insertion";
  }

  const normalized = normalizeResidueSymbol(symbol);
  if (isGapSymbol(normalized)) {
    return "gap";
  }
  if (normalized === "*") {
    return "termination";
  }

  if (moleculeType === "dna") {
    if (dnaBases.has(normalized)) {
      return "canonical-dna-base";
    }
    return ambiguousNucleotides.has(normalized)
      ? "ambiguous-nucleotide"
      : "unknown";
  }

  if (moleculeType === "rna") {
    if (rnaBases.has(normalized)) {
      return "canonical-rna-base";
    }
    return ambiguousNucleotides.has(normalized) || normalized === "T"
      ? "ambiguous-nucleotide"
      : "unknown";
  }

  if (moleculeType === "protein") {
    return classifyProteinResidue(normalized);
  }

  if (dnaBases.has(normalized)) {
    return "canonical-dna-base";
  }
  if (normalized === "U") {
    return "canonical-rna-base";
  }
  if (ambiguousNucleotides.has(normalized)) {
    return "ambiguous-nucleotide";
  }
  return classifyProteinResidue(normalized);
}

export function classifyProteinResidue(normalized: string): MsaResidueClass {
  if (standardAminoAcids.has(normalized)) {
    return "standard-amino-acid";
  }
  if (ambiguousAminoAcids.has(normalized)) {
    return "ambiguous-amino-acid";
  }
  if (specialAminoAcids.has(normalized)) {
    return "special-amino-acid";
  }
  return "unknown";
}

export function isNucleotideSymbol(symbol: string): boolean {
  return isSharedNucleotideSymbol(symbol);
}

export function isProteinExclusiveSymbol(symbol: string): boolean {
  const normalized = normalizeResidueSymbol(symbol);
  return (
    ambiguousAminoAcids.has(normalized) ||
    normalized === "O" ||
    normalized === "*" ||
    ["E", "F", "I", "L", "P", "Q"].includes(normalized)
  );
}

export function expandNucleotideSymbol(symbol: string): Set<string> {
  const expansion = expandSharedNucleotideSymbol(symbol);
  return new Set(
    normalizeResidueSymbol(symbol) === "U" ? [...expansion, "U"] : expansion,
  );
}

export function expandProteinSymbol(symbol: string): Set<string> {
  return new Set(expandAminoAcidSymbol(symbol));
}

export function complementNucleotideSymbol(symbol: string): string {
  return complementSharedNucleotideSymbol(symbol);
}

export function reverseComplement(sequence: string): string {
  return reverseComplementNucleotide(sequence);
}

export function countUngappedResidues(sequence: string): number {
  let count = 0;
  for (const symbol of sequence) {
    if (!isGapSymbol(symbol)) {
      count += 1;
    }
  }
  return count;
}
