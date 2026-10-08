const STANDARD_AMINO_ACIDS = [
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
] as const;

const EXPANSION_BY_SYMBOL: Readonly<Record<string, ReadonlySet<string>>> =
  Object.freeze({
    ...Object.fromEntries(
      [...STANDARD_AMINO_ACIDS, "O", "U"].map((symbol) => [
        symbol,
        new Set([symbol]),
      ]),
    ),
    B: new Set(["D", "N"]),
    J: new Set(["I", "L"]),
    X: new Set(STANDARD_AMINO_ACIDS),
    Z: new Set(["E", "Q"]),
  });

const EMPTY_EXPANSION: ReadonlySet<string> = new Set();

export function expandAminoAcidSymbol(symbol: string): ReadonlySet<string> {
  return EXPANSION_BY_SYMBOL[symbol.toUpperCase()] ?? EMPTY_EXPANSION;
}

export function aminoAcidSymbolsMatch(left: string, right: string): boolean {
  const leftExpansion = expandAminoAcidSymbol(left);
  const rightExpansion = expandAminoAcidSymbol(right);
  if (leftExpansion.size === 0 || rightExpansion.size === 0) {
    return left.toUpperCase() === right.toUpperCase();
  }
  for (const residue of leftExpansion) {
    if (rightExpansion.has(residue)) return true;
  }
  return false;
}
