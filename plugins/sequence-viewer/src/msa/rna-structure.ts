import type {
  MsaAnnotationTrack,
  MsaRnaPair,
  MsaRnaStructureModel,
} from "./types";

const openerToCloser = new Map<string, string>([
  ["(", ")"],
  ["<", ">"],
  ["[", "]"],
  ["{", "}"],
]);

function detectNotation(
  rawStructure: string,
): MsaRnaStructureModel["notation"] {
  if (/[A-Z].*[a-z]|[a-z].*[A-Z]/.test(rawStructure)) {
    return "wuss";
  }
  if (/[<>{}[\]]/.test(rawStructure)) {
    return "extended-dot-bracket";
  }
  if (/[().]/.test(rawStructure)) {
    return "vienna-dot-bracket";
  }
  return "unknown";
}

export function parseRnaStructureTrack({
  annotations,
  source,
}: {
  annotations: Array<MsaAnnotationTrack>;
  source?: MsaRnaStructureModel["source"];
}): MsaRnaStructureModel | null {
  const structureTrack = annotations.find(
    (track) => track.kind === "rna-secondary-structure",
  );
  if (structureTrack == null) {
    return null;
  }
  const referenceTrack = annotations.find(
    (track) => track.kind === "rna-reference-columns",
  )?.values;
  const motifTracks = annotations.filter((track) =>
    ["rna-ligand", "rna-motif", "rna-structural-elements"].includes(track.kind),
  );
  const pairParse = parseRnaPairs(structureTrack.values);
  return {
    motifTracks,
    notation: detectNotation(structureTrack.values),
    pairs: pairParse.pairs,
    rawStructure: structureTrack.values,
    ...(referenceTrack == null ? {} : { referenceTrack }),
    source:
      source ??
      (structureTrack.id.startsWith("clustal")
        ? "clustal-structure-line"
        : "stockholm-ss-cons"),
    warnings: pairParse.warnings,
  };
}

export function parseRnaPairs(rawStructure: string): {
  pairs: Array<MsaRnaPair>;
  warnings: Array<string>;
} {
  const stacks = new Map<string, Array<number>>();
  const pairs: Array<MsaRnaPair> = [];
  const warnings: Array<string> = [];
  const closerToOpener = new Map(
    [...openerToCloser.entries()].map(([opener, closer]) => [closer, opener]),
  );

  Array.from(rawStructure).forEach((symbol, column) => {
    if (openerToCloser.has(symbol) || /^[A-Z]$/.test(symbol)) {
      const stack = stacks.get(symbol) ?? [];
      stack.push(column);
      stacks.set(symbol, stack);
      return;
    }
    const explicitOpener = closerToOpener.get(symbol);
    const letterOpener = /^[a-z]$/.test(symbol) ? symbol.toUpperCase() : null;
    const opener = explicitOpener ?? letterOpener;
    if (opener == null) {
      return;
    }
    const stack = stacks.get(opener);
    const leftColumn = stack?.pop();
    if (leftColumn == null) {
      warnings.push(
        `Unmatched RNA structure closer ${symbol} at ${column + 1}.`,
      );
      return;
    }
    pairs.push({
      leftColumn,
      notation: `${opener}${symbol}`,
      pseudoknotLevel: /^[A-Za-z]$/.test(opener) ? 1 : 0,
      rightColumn: column,
    });
  });

  for (const [opener, columns] of stacks) {
    if (columns.length > 0) {
      warnings.push(`Unmatched RNA structure opener ${opener}.`);
    }
  }
  return { pairs, warnings };
}
