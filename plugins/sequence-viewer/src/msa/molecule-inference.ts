import {
  classifyProteinResidue,
  isGapSymbol,
  isNucleotideSymbol,
  isProteinExclusiveSymbol,
  normalizeResidueSymbol,
} from "./residue-alphabet";
import type {
  MsaAnnotationTrack,
  MsaFormat,
  MsaMoleculeEvidence,
  MsaMoleculeInference,
} from "./types";

export function inferMsaMoleculeType({
  annotations,
  format,
  rows,
}: {
  annotations: Array<MsaAnnotationTrack>;
  format: MsaFormat;
  rows: Array<{ alignedSequence: string }>;
}): MsaMoleculeInference {
  const symbols = new Set<string>();
  for (const row of rows) {
    for (const symbol of row.alignedSequence) {
      const normalized = normalizeResidueSymbol(symbol);
      if (!isGapSymbol(normalized)) {
        symbols.add(normalized);
      }
    }
  }

  const evidence: Array<MsaMoleculeEvidence> = [];
  const warnings: Array<string> = [];
  const hasT = symbols.has("T");
  const hasU = symbols.has("U");
  const hasStructure = annotations.some(
    (track) => track.kind === "rna-secondary-structure",
  );
  const hasProteinExclusive = [...symbols].some(isProteinExclusiveSymbol);
  const allNucleotide = [...symbols].every(isNucleotideSymbol);
  const allProteinLike = [...symbols].every(
    (symbol) =>
      classifyProteinResidue(symbol) !== "unknown" ||
      ["A", "C", "G", "T", "U"].includes(symbol),
  );

  if (hasT) {
    evidence.push("dna-t-present");
  }
  if (hasU) {
    evidence.push("rna-u-present");
  }
  if (hasStructure) {
    evidence.push("stockholm-rna-structure-present");
  }
  if (hasProteinExclusive) {
    evidence.push("protein-exclusive-symbol-present");
  }
  if (format === "a2m" || format === "a3m") {
    evidence.push("a2m-a3m-profile-convention");
  }

  if (hasProteinExclusive) {
    return {
      confidence: "high",
      evidence,
      moleculeType: "protein",
      warnings,
    };
  }

  if (hasStructure) {
    return {
      confidence: "high",
      evidence,
      moleculeType: "rna",
      warnings,
    };
  }

  if (format === "a2m" || format === "a3m") {
    return {
      confidence: "medium",
      evidence,
      moleculeType: "protein",
      warnings,
    };
  }

  if (allNucleotide && hasT && !hasU) {
    return { confidence: "high", evidence, moleculeType: "dna", warnings };
  }

  if (allNucleotide && hasU && !hasT) {
    return { confidence: "high", evidence, moleculeType: "rna", warnings };
  }

  if (allNucleotide && hasT && hasU) {
    warnings.push("The alignment mixes T and U nucleotide symbols.");
    return {
      confidence: "medium",
      evidence: [...evidence, "ambiguous-symbol-set"],
      moleculeType: "nucleic-acid-ambiguous",
      warnings,
    };
  }

  if (allNucleotide) {
    return {
      confidence: "low",
      evidence: [...evidence, "ambiguous-symbol-set"],
      moleculeType: "nucleic-acid-ambiguous",
      warnings,
    };
  }

  if (allProteinLike) {
    return {
      confidence: "low",
      evidence: [...evidence, "ambiguous-symbol-set"],
      moleculeType: "protein",
      warnings,
    };
  }

  warnings.push("Some alignment symbols cannot be classified confidently.");
  return {
    confidence: "low",
    evidence: [...evidence, "ambiguous-symbol-set"],
    moleculeType: "unknown",
    warnings,
  };
}
