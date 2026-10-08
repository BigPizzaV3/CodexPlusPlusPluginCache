export type NucleotideAlphabet = "dna" | "rna";

const DNA_COMPLEMENT_BY_SYMBOL: Readonly<Record<string, string>> =
  Object.freeze({
    A: "T",
    B: "V",
    C: "G",
    D: "H",
    G: "C",
    H: "D",
    K: "M",
    M: "K",
    N: "N",
    R: "Y",
    S: "S",
    T: "A",
    U: "A",
    V: "B",
    W: "W",
    Y: "R",
  });

const NUCLEOTIDE_EXPANSION_BY_SYMBOL: Readonly<
  Record<string, ReadonlySet<string>>
> = Object.freeze({
  A: new Set(["A"]),
  B: new Set(["C", "G", "T"]),
  C: new Set(["C"]),
  D: new Set(["A", "G", "T"]),
  G: new Set(["G"]),
  H: new Set(["A", "C", "T"]),
  K: new Set(["G", "T"]),
  M: new Set(["A", "C"]),
  N: new Set(["A", "C", "G", "T"]),
  R: new Set(["A", "G"]),
  S: new Set(["C", "G"]),
  T: new Set(["T"]),
  U: new Set(["T"]),
  V: new Set(["A", "C", "G"]),
  W: new Set(["A", "T"]),
  Y: new Set(["C", "T"]),
});

const EMPTY_EXPANSION: ReadonlySet<string> = new Set();

export function normalizeNucleotideSequence(sequence: string): string {
  return sequence.replaceAll(/\s+/g, "").toUpperCase();
}

export function isNucleotideSymbol(symbol: string): boolean {
  return NUCLEOTIDE_EXPANSION_BY_SYMBOL[symbol.toUpperCase()] != null;
}

export function hasOnlyNucleotideSymbols(sequence: string): boolean {
  return Array.from(normalizeNucleotideSequence(sequence)).every((symbol) =>
    isNucleotideSymbol(symbol),
  );
}

export function expandNucleotideSymbol(symbol: string): ReadonlySet<string> {
  return (
    NUCLEOTIDE_EXPANSION_BY_SYMBOL[symbol.toUpperCase()] ?? EMPTY_EXPANSION
  );
}

export function nucleotideSymbolsMatch(left: string, right: string): boolean {
  const leftExpansion = expandNucleotideSymbol(left);
  const rightExpansion = expandNucleotideSymbol(right);
  if (leftExpansion.size === 0 || rightExpansion.size === 0) return false;
  for (const base of leftExpansion) {
    if (rightExpansion.has(base)) return true;
  }
  return false;
}

export function complementNucleotideSymbol(
  symbol: string,
  alphabet: NucleotideAlphabet = "dna",
): string {
  const complement = DNA_COMPLEMENT_BY_SYMBOL[symbol.toUpperCase()];
  if (complement == null) return "N";
  return alphabet === "rna" && complement === "T" ? "U" : complement;
}

export function reverseComplementNucleotide(
  sequence: string,
  alphabet: NucleotideAlphabet = "dna",
): string {
  return Array.from(normalizeNucleotideSequence(sequence))
    .reverse()
    .map((symbol) => complementNucleotideSymbol(symbol, alphabet))
    .join("");
}
