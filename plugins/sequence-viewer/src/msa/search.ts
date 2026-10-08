import { hasOnlyNucleotideSymbols } from "../nucleotide-alphabet";
import { SEQUENCE_VIEWER_LIMITS } from "../runtime-contract";

import type { MsaRowProjection } from "./analysis";
import { buildMsaRowProjections } from "./analysis";
import {
  expandNucleotideSymbol,
  expandProteinSymbol,
  reverseComplement,
} from "./residue-alphabet";
import type {
  MsaDocument,
  MsaMoleculeType,
  MsaSearchCapabilities,
} from "./types";

export type MsaMotifSearchHit = {
  alignmentEndColumn: number;
  alignmentStartColumn: number;
  orientation: "forward" | "reverse-complement";
  rowId: string;
  rowLabel: string;
  ungappedEndPosition: number;
  ungappedStartPosition: number;
};

export type MsaMotifSearchResult = {
  hits: Array<MsaMotifSearchHit>;
  truncated: boolean;
};

function symbolsOverlap(first: Set<string>, second: Set<string>): boolean {
  if (first.size === 0 || second.size === 0) {
    return false;
  }
  for (const symbol of first) {
    if (second.has(symbol)) {
      return true;
    }
  }
  return false;
}

function nucleotideMotifMatchesAt(
  target: string,
  query: string,
  offset: number,
): boolean {
  for (let index = 0; index < query.length; index += 1) {
    if (
      !symbolsOverlap(
        expandNucleotideSymbol(query[index] ?? ""),
        expandNucleotideSymbol(target[offset + index] ?? ""),
      )
    ) {
      return false;
    }
  }
  return true;
}

function proteinMotifMatchesAt(
  target: string,
  query: string,
  offset: number,
): boolean {
  for (let index = 0; index < query.length; index += 1) {
    const querySymbol = query[index] ?? "";
    const targetSymbol = target[offset + index] ?? "";
    const queryExpanded = expandProteinSymbol(querySymbol);
    const targetExpanded = expandProteinSymbol(targetSymbol);
    if (queryExpanded.size === 0 || targetExpanded.size === 0) {
      if (querySymbol.toUpperCase() !== targetSymbol.toUpperCase()) {
        return false;
      }
      continue;
    }
    if (!symbolsOverlap(queryExpanded, targetExpanded)) {
      return false;
    }
  }
  return true;
}

function getMatchPredicate(
  moleculeType: MsaMoleculeType,
): (target: string, query: string, offset: number) => boolean {
  return moleculeType === "protein"
    ? proteinMotifMatchesAt
    : nucleotideMotifMatchesAt;
}

function searchRows({
  moleculeType,
  orientation,
  projections,
  query,
  maxHits,
}: {
  moleculeType: MsaMoleculeType;
  orientation: MsaMotifSearchHit["orientation"];
  projections: Array<MsaRowProjection>;
  query: string;
  maxHits: number;
}): Array<MsaMotifSearchHit> {
  const hits: Array<MsaMotifSearchHit> = [];
  if (query.length === 0) {
    return hits;
  }
  const matchesAt = getMatchPredicate(moleculeType);
  for (const projection of projections) {
    for (
      let offset = 0;
      offset <= projection.sequence.length - query.length;
      offset += 1
    ) {
      if (!matchesAt(projection.sequence, query, offset)) {
        continue;
      }
      hits.push({
        alignmentEndColumn:
          projection.alignmentColumns[offset + query.length - 1] ?? 0,
        alignmentStartColumn: projection.alignmentColumns[offset] ?? 0,
        orientation,
        rowId: projection.rowId,
        rowLabel: projection.rowLabel,
        ungappedEndPosition: offset + query.length,
        ungappedStartPosition: offset + 1,
      });
      if (hits.length >= maxHits) return hits;
    }
  }
  return hits;
}

export function searchMsaMotif(
  document: MsaDocument,
  rawQuery: string,
): Array<MsaMotifSearchHit> {
  return searchMsaMotifFromProjections({
    moleculeType: document.displayInterpretation.moleculeType,
    projections: buildMsaRowProjections(
      document.rows.filter((candidate) => !candidate.hidden),
    ),
    rawQuery,
    searchCapabilities: document.searchCapabilities,
  });
}

export function searchMsaMotifFromProjectionsResult({
  maxHits = SEQUENCE_VIEWER_LIMITS.search.maxHits,
  moleculeType,
  projections,
  rawQuery,
  searchCapabilities,
}: {
  maxHits?: number;
  moleculeType: MsaMoleculeType;
  projections: Array<MsaRowProjection>;
  rawQuery: string;
  searchCapabilities: MsaSearchCapabilities;
}): MsaMotifSearchResult {
  const query = rawQuery.trim().replaceAll(/\s+/g, "").toUpperCase();
  if (
    !searchCapabilities.motifSearch ||
    query.length === 0 ||
    (moleculeType !== "protein" && !hasOnlyNucleotideSymbols(query))
  ) {
    return { hits: [], truncated: false };
  }
  const candidates = searchRows({
    maxHits: maxHits + 1,
    moleculeType,
    orientation: "forward",
    projections,
    query,
  });
  if (
    candidates.length <= maxHits &&
    searchCapabilities.supportsReverseComplement
  ) {
    const reverseQuery = reverseComplement(query);
    if (reverseQuery !== query) {
      candidates.push(
        ...searchRows({
          maxHits: maxHits + 1 - candidates.length,
          moleculeType,
          orientation: "reverse-complement",
          projections,
          query: reverseQuery,
        }),
      );
    }
  }
  return {
    hits: candidates.slice(0, maxHits),
    truncated: candidates.length > maxHits,
  };
}

export function searchMsaMotifFromProjections({
  moleculeType,
  projections,
  rawQuery,
  searchCapabilities,
}: {
  moleculeType: MsaMoleculeType;
  projections: Array<MsaRowProjection>;
  rawQuery: string;
  searchCapabilities: MsaSearchCapabilities;
}): Array<MsaMotifSearchHit> {
  return searchMsaMotifFromProjectionsResult({
    moleculeType,
    projections,
    rawQuery,
    searchCapabilities,
  }).hits;
}

export async function searchMsaMotifFromProjectionsAsync({
  moleculeType,
  projections,
  rawQuery,
  searchCapabilities,
  signal,
}: {
  moleculeType: MsaMoleculeType;
  projections: Array<MsaRowProjection>;
  rawQuery: string;
  searchCapabilities: MsaSearchCapabilities;
  signal?: AbortSignal;
}): Promise<Array<MsaMotifSearchHit>> {
  return (
    await searchMsaMotifFromProjectionsAsyncResult({
      moleculeType,
      projections,
      rawQuery,
      searchCapabilities,
      signal,
    })
  ).hits;
}

export async function searchMsaMotifFromProjectionsAsyncResult({
  maxHits = SEQUENCE_VIEWER_LIMITS.search.maxHits,
  moleculeType,
  projections,
  rawQuery,
  searchCapabilities,
  signal,
}: {
  maxHits?: number;
  moleculeType: MsaMoleculeType;
  projections: Array<MsaRowProjection>;
  rawQuery: string;
  searchCapabilities: MsaSearchCapabilities;
  signal?: AbortSignal;
}): Promise<MsaMotifSearchResult> {
  const query = rawQuery.trim().replaceAll(/\s+/g, "").toUpperCase();
  if (
    !searchCapabilities.motifSearch ||
    query.length === 0 ||
    (moleculeType !== "protein" && !hasOnlyNucleotideSymbols(query))
  ) {
    return { hits: [], truncated: false };
  }
  const forward = await searchProjectionRowsCooperatively({
    maxHits: maxHits + 1,
    moleculeType,
    orientation: "forward",
    projections,
    query,
    signal,
  });
  let candidates = forward;
  const reverseQuery = reverseComplement(query);
  if (
    candidates.length <= maxHits &&
    searchCapabilities.supportsReverseComplement &&
    reverseQuery !== query
  ) {
    candidates = candidates.concat(
      await searchProjectionRowsCooperatively({
        maxHits: maxHits + 1 - candidates.length,
        moleculeType,
        orientation: "reverse-complement",
        projections,
        query: reverseQuery,
        signal,
      }),
    );
  }
  return {
    hits: candidates.slice(0, maxHits),
    truncated: candidates.length > maxHits,
  };
}

async function searchProjectionRowsCooperatively({
  moleculeType,
  maxHits,
  orientation,
  projections,
  query,
  signal,
}: {
  moleculeType: MsaMoleculeType;
  maxHits: number;
  orientation: MsaMotifSearchHit["orientation"];
  projections: Array<MsaRowProjection>;
  query: string;
  signal?: AbortSignal;
}): Promise<Array<MsaMotifSearchHit>> {
  const hits: Array<MsaMotifSearchHit> = [];
  const matchesAt = getMatchPredicate(moleculeType);
  let offsetsSinceYield = 0;
  for (let rowIndex = 0; rowIndex < projections.length; rowIndex += 1) {
    if (signal?.aborted) return [];
    if (rowIndex > 0 && rowIndex % 128 === 0) {
      await yieldToMainThread();
      if (signal?.aborted) return [];
    }
    const projection = projections[rowIndex]!;
    for (
      let offset = 0;
      offset <= projection.sequence.length - query.length;
      offset += 1
    ) {
      offsetsSinceYield += 1;
      if (offsetsSinceYield >= 50_000) {
        offsetsSinceYield = 0;
        await yieldToMainThread();
        if (signal?.aborted) return [];
      }
      if (!matchesAt(projection.sequence, query, offset)) continue;
      hits.push({
        alignmentEndColumn:
          projection.alignmentColumns[offset + query.length - 1] ?? 0,
        alignmentStartColumn: projection.alignmentColumns[offset] ?? 0,
        orientation,
        rowId: projection.rowId,
        rowLabel: projection.rowLabel,
        ungappedEndPosition: offset + query.length,
        ungappedStartPosition: offset + 1,
      });
      if (hits.length >= maxHits) return hits;
    }
  }

  return signal?.aborted ? [] : hits;
}

function yieldToMainThread(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}
