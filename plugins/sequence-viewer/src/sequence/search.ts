import type { SequenceMoleculeKind } from "../biological-sequence-artifact-classifier";
import { aminoAcidSymbolsMatch } from "../amino-acid-alphabet";
import {
  hasOnlyNucleotideSymbols,
  normalizeNucleotideSequence,
  nucleotideSymbolsMatch,
  reverseComplementNucleotide,
} from "../nucleotide-alphabet";
import { SEQUENCE_VIEWER_LIMITS } from "../runtime-contract";

import type {
  SequenceRecord,
  SequenceSearchHit,
  SequenceSearchResult,
} from "./types";

type SearchComparisonBudget = {
  comparisons: number;
  exhausted: boolean;
  maxComparisons: number;
};

export function searchSequenceRecords({
  includeReverseComplement,
  maxComparisons = SEQUENCE_VIEWER_LIMITS.search.maxComparisons,
  maxHits = SEQUENCE_VIEWER_LIMITS.search.maxHits,
  molecule,
  query,
  records,
}: {
  includeReverseComplement: boolean;
  maxComparisons?: number;
  maxHits?: number;
  molecule: SequenceMoleculeKind;
  query: string;
  records: Array<SequenceRecord>;
}): SequenceSearchResult {
  const normalizedQuery = normalizeSequence(query);
  const nucleicAcid =
    molecule === "dna" ||
    molecule === "rna" ||
    molecule === "nucleic-acid-ambiguous";
  if (
    normalizedQuery.length === 0 ||
    maxHits < 1 ||
    (nucleicAcid && !hasOnlyNucleotideSymbols(normalizedQuery))
  ) {
    return { hits: [], truncated: false };
  }
  const queries = createCandidateQueries({
    includeReverseComplement,
    molecule,
    normalizedQuery,
    nucleicAcid,
  });

  const hits: Array<SequenceSearchHit> = [];
  const seen = new Set<string>();
  const budget: SearchComparisonBudget = {
    comparisons: 0,
    exhausted: false,
    maxComparisons,
  };
  for (const { orientation, sequence: candidateQuery } of queries) {
    for (const record of records) {
      for (const hit of findHits(
        record,
        candidateQuery,
        orientation,
        molecule,
        budget,
      )) {
        const key = `${hit.recordId}:${hit.start}:${hit.end}`;
        if (seen.has(key)) continue;
        seen.add(key);
        if (hits.length === maxHits) {
          return { hits, truncated: true };
        }
        hits.push(hit);
      }
      if (budget.exhausted) return { hits, truncated: true };
    }
  }
  return { hits, truncated: false };
}

export async function searchSequenceRecordsAsync({
  includeReverseComplement,
  maxComparisons = SEQUENCE_VIEWER_LIMITS.search.maxComparisons,
  maxHits = SEQUENCE_VIEWER_LIMITS.search.maxHits,
  molecule,
  query,
  records,
  signal,
}: {
  includeReverseComplement: boolean;
  maxComparisons?: number;
  maxHits?: number;
  molecule: SequenceMoleculeKind;
  query: string;
  records: Array<SequenceRecord>;
  signal?: AbortSignal;
}): Promise<SequenceSearchResult> {
  const normalizedQuery = normalizeSequence(query);
  const nucleicAcid =
    molecule === "dna" ||
    molecule === "rna" ||
    molecule === "nucleic-acid-ambiguous";
  if (
    normalizedQuery.length === 0 ||
    maxHits < 1 ||
    (nucleicAcid && !hasOnlyNucleotideSymbols(normalizedQuery))
  ) {
    return { hits: [], truncated: false };
  }
  const queries = createCandidateQueries({
    includeReverseComplement,
    molecule,
    normalizedQuery,
    nucleicAcid,
  });
  const hits: Array<SequenceSearchHit> = [];
  const seen = new Set<string>();
  const budget: SearchComparisonBudget = {
    comparisons: 0,
    exhausted: false,
    maxComparisons,
  };
  let comparisonsAtLastYield = 0;

  for (const { orientation, sequence: candidateQuery } of queries) {
    for (const record of records) {
      const sequence = normalizeSequence(record.sequence);
      if (candidateQuery.length > sequence.length) continue;
      for (
        let offset = 0;
        offset <= sequence.length - candidateQuery.length;
        offset += 1
      ) {
        throwIfAborted(signal);
        const match = matchesAt({
          budget,
          molecule,
          offset,
          query: candidateQuery,
          sequence,
        });
        if (budget.exhausted) {
          return { hits, truncated: true };
        }
        if (budget.comparisons - comparisonsAtLastYield >= 50_000) {
          comparisonsAtLastYield = budget.comparisons;
          await yieldToMainThread();
          throwIfAborted(signal);
        }
        if (!match) continue;
        const hit = {
          end: offset + candidateQuery.length,
          orientation,
          recordId: record.id,
          start: offset + 1,
        } satisfies SequenceSearchHit;
        const key = `${hit.recordId}:${hit.start}:${hit.end}`;
        if (seen.has(key)) continue;
        seen.add(key);
        if (hits.length === maxHits) {
          return { hits, truncated: true };
        }
        hits.push(hit);
      }
    }
  }
  return { hits, truncated: false };
}

export function reverseComplement(sequence: string): string {
  return reverseComplementNucleotide(sequence);
}

function* findHits(
  record: SequenceRecord,
  query: string,
  orientation: SequenceSearchHit["orientation"],
  molecule: SequenceMoleculeKind,
  budget: SearchComparisonBudget,
): Generator<SequenceSearchHit> {
  const sequence = normalizeSequence(record.sequence);
  if (query.length > sequence.length) return;
  for (let offset = 0; offset <= sequence.length - query.length; offset += 1) {
    const matches = matchesAt({
      budget,
      molecule,
      offset,
      query,
      sequence,
    });
    if (budget.exhausted) return;
    if (matches) {
      yield {
        end: offset + query.length,
        orientation,
        recordId: record.id,
        start: offset + 1,
      };
    }
  }
}

function matchesAt({
  budget,
  molecule,
  offset,
  query,
  sequence,
}: {
  budget: SearchComparisonBudget;
  molecule: SequenceMoleculeKind;
  offset: number;
  query: string;
  sequence: string;
}): boolean {
  for (let queryOffset = 0; queryOffset < query.length; queryOffset += 1) {
    budget.comparisons += 1;
    if (budget.comparisons > budget.maxComparisons) {
      budget.exhausted = true;
      return false;
    }
    const left = sequence[offset + queryOffset] ?? "";
    const right = query[queryOffset] ?? "";
    const symbolsMatch =
      molecule === "dna" ||
      molecule === "rna" ||
      molecule === "nucleic-acid-ambiguous"
        ? nucleotideSymbolsMatch(left, right)
        : molecule === "protein"
          ? aminoAcidSymbolsMatch(left, right)
          : left === right;
    if (!symbolsMatch) return false;
  }
  return true;
}

function createCandidateQueries({
  includeReverseComplement,
  molecule,
  normalizedQuery,
  nucleicAcid,
}: {
  includeReverseComplement: boolean;
  molecule: SequenceMoleculeKind;
  normalizedQuery: string;
  nucleicAcid: boolean;
}): Array<{
  orientation: SequenceSearchHit["orientation"];
  sequence: string;
}> {
  const queries: Array<{
    orientation: SequenceSearchHit["orientation"];
    sequence: string;
  }> = [{ orientation: "forward", sequence: normalizedQuery }];
  if (includeReverseComplement && nucleicAcid) {
    const reverse = reverseComplementNucleotide(
      normalizedQuery,
      molecule === "rna" ? "rna" : "dna",
    );
    if (reverse !== normalizedQuery) {
      queries.push({ orientation: "reverse-complement", sequence: reverse });
    }
  }
  return queries;
}

function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted !== true) return;
  const error = new Error("Sequence search was cancelled.");
  error.name = "AbortError";
  throw error;
}

function yieldToMainThread(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function normalizeSequence(sequence: string): string {
  return normalizeNucleotideSequence(sequence);
}
