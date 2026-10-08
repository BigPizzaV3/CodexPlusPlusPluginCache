import { SEQUENCE_VIEWER_LIMITS } from "../runtime-contract";
import { expandNucleotideSymbol } from "../nucleotide-alphabet";
import { getGeneticCode, translateGeneticCodeCodon } from "./genetic-code";
import { reverseComplement, translateFrame } from "./translation";

export type SequenceStatistics = {
  ambiguousCount: number;
  gcFraction: number | null;
  length: number;
  molecule: "nucleic-acid" | "protein";
  nFraction: number | null;
  symbolCounts: Record<string, number>;
};

export type SequenceOrf = {
  aminoAcidLength: number;
  completeStart: boolean;
  completeStop: boolean;
  end: number;
  frame: 1 | 2 | 3 | -1 | -2 | -3;
  geneticCodeId: number;
  geneticCodeName: string;
  nucleotideSequence: string;
  start: number;
  strand: "+" | "-";
  translation: string;
};

export type RestrictionEnzyme = {
  cutBottom: number;
  cutTop: number;
  id: string;
  name: string;
  recognitionSequence: string;
};

export type RestrictionSite = {
  cutBottom: number;
  cutTop: number;
  end: number;
  enzymeId: string;
  enzymeName: string;
  recognitionSequence: string;
  start: number;
  strand: "+" | "-";
  wrapsOrigin: boolean;
};

export type DigestFragment = {
  end: number;
  length: number;
  start: number;
  wrapsOrigin: boolean;
};

export type PrimerCandidate = {
  end: number;
  gcFraction: number;
  length: number;
  score: number;
  selfComplementarity: number;
  sequence: string;
  start: number;
  strand: "+" | "-";
  tmCelsius: number;
};

export type PrimerPair = {
  forward: PrimerCandidate;
  productEnd: number;
  productLength: number;
  productStart: number;
  reverse: PrimerCandidate;
  score: number;
};

export const COMMON_RESTRICTION_ENZYMES: ReadonlyArray<RestrictionEnzyme> =
  Object.freeze([
    enzyme("EcoRI", "GAATTC", 1, 5),
    enzyme("BamHI", "GGATCC", 1, 5),
    enzyme("HindIII", "AAGCTT", 1, 5),
    enzyme("NotI", "GCGGCCGC", 2, 6),
    enzyme("XhoI", "CTCGAG", 1, 5),
    enzyme("XbaI", "TCTAGA", 1, 5),
    enzyme("SpeI", "ACTAGT", 1, 5),
    enzyme("NheI", "GCTAGC", 1, 5),
    enzyme("PstI", "CTGCAG", 5, 1),
    enzyme("KpnI", "GGTACC", 5, 1),
    enzyme("SacI", "GAGCTC", 5, 1),
    enzyme("SalI", "GTCGAC", 1, 5),
    enzyme("SmaI", "CCCGGG", 3, 3),
    enzyme("ApaI", "GGGCCC", 5, 1),
    enzyme("BglII", "AGATCT", 1, 5),
    enzyme("ClaI", "ATCGAT", 2, 4),
    enzyme("DpnI", "GATC", 2, 2),
    enzyme("HaeIII", "GGCC", 2, 2),
    enzyme("MluI", "ACGCGT", 1, 5),
    enzyme("NcoI", "CCATGG", 1, 5),
    enzyme("NdeI", "CATATG", 2, 4),
    enzyme("SbfI", "CCTGCAGG", 6, 2),
    enzyme("BsaI", "GGTCTC", 7, 11),
    enzyme("BsmBI", "CGTCTC", 7, 11),
  ]);

export function calculateSequenceStatistics(
  sequence: string,
  molecule: "nucleic-acid" | "protein",
): SequenceStatistics {
  const normalized = sequence.toUpperCase().replaceAll(/\s+/gu, "");
  const symbolCounts: Record<string, number> = {};
  for (const symbol of normalized) {
    symbolCounts[symbol] = (symbolCounts[symbol] ?? 0) + 1;
  }
  if (molecule === "protein") {
    const ambiguousCount = [...normalized].filter((symbol) =>
      "BJOUXZ?".includes(symbol),
    ).length;
    return {
      ambiguousCount,
      gcFraction: null,
      length: normalized.length,
      molecule,
      nFraction: null,
      symbolCounts,
    };
  }
  const canonicalCount =
    (symbolCounts.A ?? 0) +
    (symbolCounts.C ?? 0) +
    (symbolCounts.G ?? 0) +
    (symbolCounts.T ?? 0) +
    (symbolCounts.U ?? 0);
  const ambiguousCount = Math.max(0, normalized.length - canonicalCount);
  return {
    ambiguousCount,
    gcFraction:
      normalized.length === 0
        ? 0
        : ((symbolCounts.G ?? 0) + (symbolCounts.C ?? 0)) / normalized.length,
    length: normalized.length,
    molecule,
    nFraction:
      normalized.length === 0 ? 0 : (symbolCounts.N ?? 0) / normalized.length,
    symbolCounts,
  };
}

export function findOpenReadingFrames({
  geneticCodeId = 1,
  includePartial = false,
  maxResults = SEQUENCE_VIEWER_LIMITS.analysis.maxOrfs,
  minAminoAcids = 30,
  sequence,
  strands = "both",
}: {
  geneticCodeId?: number;
  includePartial?: boolean;
  maxResults?: number;
  minAminoAcids?: number;
  sequence: string;
  strands?: "+" | "-" | "both";
}): { items: Array<SequenceOrf>; truncated: boolean } {
  const code = getGeneticCode(geneticCodeId);
  if (code == null) {
    throw new Error(`NCBI genetic code ${geneticCodeId} is not supported.`);
  }
  const normalized = normalizeDna(sequence);
  const orientedSequences = [
    ...(strands === "+" || strands === "both"
      ? [{ sequence: normalized, strand: "+" as const }]
      : []),
    ...(strands === "-" || strands === "both"
      ? [{ sequence: reverseComplement(normalized), strand: "-" as const }]
      : []),
  ];
  const items: Array<SequenceOrf> = [];
  let truncated = false;
  for (const oriented of orientedSequences) {
    for (let offset = 0; offset < 3; offset += 1) {
      const openStarts: Array<number> = [];
      for (
        let index = offset;
        index + 2 < oriented.sequence.length;
        index += 3
      ) {
        const codon = oriented.sequence.slice(index, index + 3);
        if (isUnambiguousStartCodon(codon, code.startCodons)) {
          openStarts.push(index);
        }
        if (translateGeneticCodeCodon(codon, geneticCodeId) !== "*") continue;
        for (const startIndex of openStarts) {
          const aminoAcidLength = (index - startIndex) / 3;
          if (aminoAcidLength < minAminoAcids) continue;
          items.push(
            createOrf({
              completeStart: true,
              completeStop: true,
              endIndex: index + 3,
              geneticCodeId,
              geneticCodeName: code.name,
              orientedSequence: oriented.sequence,
              originalLength: normalized.length,
              startIndex,
              strand: oriented.strand,
            }),
          );
          if (items.length >= maxResults) {
            truncated = true;
            return { items: sortOrfs(items), truncated };
          }
        }
        openStarts.length = 0;
      }
      if (includePartial) {
        for (const startIndex of openStarts) {
          const endIndex =
            oriented.sequence.length -
            ((oriented.sequence.length - startIndex) % 3);
          if ((endIndex - startIndex) / 3 < minAminoAcids) continue;
          items.push(
            createOrf({
              completeStart: true,
              completeStop: false,
              endIndex,
              geneticCodeId,
              geneticCodeName: code.name,
              orientedSequence: oriented.sequence,
              originalLength: normalized.length,
              startIndex,
              strand: oriented.strand,
            }),
          );
          if (items.length >= maxResults) {
            truncated = true;
            return { items: sortOrfs(items), truncated };
          }
        }
      }
    }
  }
  return { items: sortOrfs(items), truncated };
}

export function findRestrictionSites({
  circular = false,
  enzymes = COMMON_RESTRICTION_ENZYMES,
  maxResults = SEQUENCE_VIEWER_LIMITS.analysis.maxRestrictionSites,
  sequence,
}: {
  circular?: boolean;
  enzymes?: ReadonlyArray<RestrictionEnzyme>;
  maxResults?: number;
  sequence: string;
}): { items: Array<RestrictionSite>; truncated: boolean } {
  const normalized = normalizeDna(sequence);
  const items: Array<RestrictionSite> = [];
  const seen = new Set<string>();
  for (const enzymeDefinition of enzymes) {
    const recognitionLength = enzymeDefinition.recognitionSequence.length;
    const searchable = circular
      ? normalized + normalized.slice(0, Math.max(0, recognitionLength - 1))
      : normalized;
    for (const strand of ["+", "-"] as const) {
      const motif =
        strand === "+"
          ? enzymeDefinition.recognitionSequence
          : reverseComplement(enzymeDefinition.recognitionSequence);
      for (
        let index = 0;
        index + motif.length <= searchable.length;
        index += 1
      ) {
        if (
          index >= normalized.length ||
          !matchesIupac(searchable.slice(index, index + motif.length), motif)
        )
          continue;
        const start = index + 1;
        const endUnwrapped = index + motif.length;
        const wrapsOrigin = endUnwrapped > normalized.length;
        const end = wrapsOrigin
          ? endUnwrapped - normalized.length
          : endUnwrapped;
        const key = `${enzymeDefinition.id}:${start}:${end}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const cutBottom =
          index +
          (strand === "+"
            ? enzymeDefinition.cutBottom
            : recognitionLength - enzymeDefinition.cutTop) +
          1;
        const cutTop =
          index +
          (strand === "+"
            ? enzymeDefinition.cutTop
            : recognitionLength - enzymeDefinition.cutBottom) +
          1;
        items.push({
          cutBottom: circular
            ? wrapCoordinate(cutBottom, normalized.length)
            : cutBottom,
          cutTop: circular ? wrapCoordinate(cutTop, normalized.length) : cutTop,
          end,
          enzymeId: enzymeDefinition.id,
          enzymeName: enzymeDefinition.name,
          recognitionSequence: enzymeDefinition.recognitionSequence,
          start,
          strand,
          wrapsOrigin,
        });
        if (items.length >= maxResults) return { items, truncated: true };
      }
    }
  }
  return {
    items: items.sort(
      (left, right) =>
        left.start - right.start ||
        left.enzymeName.localeCompare(right.enzymeName),
    ),
    truncated: false,
  };
}

export function simulateDigest({
  circular,
  sequenceLength,
  sites,
}: {
  circular: boolean;
  sequenceLength: number;
  sites: ReadonlyArray<RestrictionSite>;
}): Array<DigestFragment> {
  if (sequenceLength <= 0) return [];
  const cuts = [
    ...new Set(
      sites.flatMap(({ cutTop }) => {
        if (circular) return [wrapCoordinate(cutTop, sequenceLength)];
        return cutTop >= 1 && cutTop <= sequenceLength ? [cutTop] : [];
      }),
    ),
  ].sort((left, right) => left - right);
  if (cuts.length === 0)
    return [
      {
        end: sequenceLength,
        length: sequenceLength,
        start: 1,
        wrapsOrigin: false,
      },
    ];
  if (!circular) {
    const boundaries = [1, ...cuts, sequenceLength + 1];
    return boundaries.slice(0, -1).flatMap((start, index) => {
      const next = boundaries[index + 1];
      if (next == null || next <= start) return [];
      return [
        { end: next - 1, length: next - start, start, wrapsOrigin: false },
      ];
    });
  }
  return cuts.map((start, index) => {
    const next = cuts[(index + 1) % cuts.length] ?? start;
    const length = next > start ? next - start : sequenceLength - start + next;
    return {
      end: wrapCoordinate(start + length - 1, sequenceLength),
      length,
      start,
      wrapsOrigin: next <= start,
    };
  });
}

export function designPrimerPairs({
  maxPairs = 10,
  maxPrimerLength = 25,
  maxProductLength = 1_500,
  minPrimerLength = 18,
  minProductLength = 80,
  optimumTm = 60,
  sequence,
  targetEnd,
  targetStart,
}: {
  maxPairs?: number;
  maxPrimerLength?: number;
  maxProductLength?: number;
  minPrimerLength?: number;
  minProductLength?: number;
  optimumTm?: number;
  sequence: string;
  targetEnd: number;
  targetStart: number;
}): Array<PrimerPair> {
  const normalized = normalizeDna(sequence);
  const boundedStart = Math.max(1, Math.min(targetStart, normalized.length));
  const boundedEnd = Math.max(
    boundedStart,
    Math.min(targetEnd, normalized.length),
  );
  const forwardCandidates = enumeratePrimerCandidates({
    maxPrimerLength,
    minPrimerLength,
    optimumTm,
    sequence: normalized,
    strand: "+",
    windowEnd: Math.max(minPrimerLength, boundedStart),
    windowStart: Math.max(1, boundedStart - 250),
  });
  const reverseCandidates = enumeratePrimerCandidates({
    maxPrimerLength,
    minPrimerLength,
    optimumTm,
    sequence: normalized,
    strand: "-",
    windowEnd: Math.min(normalized.length, boundedEnd + 250),
    windowStart: Math.min(normalized.length, boundedEnd),
  });
  const pairs: Array<PrimerPair> = [];
  for (const forward of forwardCandidates) {
    for (const reverse of reverseCandidates) {
      const productStart = forward.start;
      const productEnd = reverse.end;
      const productLength = productEnd - productStart + 1;
      if (productLength < minProductLength || productLength > maxProductLength)
        continue;
      pairs.push({
        forward,
        productEnd,
        productLength,
        productStart,
        reverse,
        score:
          forward.score +
          reverse.score +
          Math.abs(forward.tmCelsius - reverse.tmCelsius) * 2,
      });
      if (pairs.length >= SEQUENCE_VIEWER_LIMITS.analysis.maxPrimerCandidates)
        break;
    }
    if (pairs.length >= SEQUENCE_VIEWER_LIMITS.analysis.maxPrimerCandidates)
      break;
  }
  return pairs
    .sort((left, right) => left.score - right.score)
    .slice(0, maxPairs);
}

function enumeratePrimerCandidates({
  maxPrimerLength,
  minPrimerLength,
  optimumTm,
  sequence,
  strand,
  windowEnd,
  windowStart,
}: {
  maxPrimerLength: number;
  minPrimerLength: number;
  optimumTm: number;
  sequence: string;
  strand: "+" | "-";
  windowEnd: number;
  windowStart: number;
}): Array<PrimerCandidate> {
  const candidates: Array<PrimerCandidate> = [];
  for (let start = windowStart; start <= windowEnd; start += 1) {
    for (let length = minPrimerLength; length <= maxPrimerLength; length += 1) {
      const end = start + length - 1;
      if (end > sequence.length || end > windowEnd) continue;
      const genomic = sequence.slice(start - 1, end);
      if (!/^[ACGT]+$/u.test(genomic)) continue;
      const primerSequence =
        strand === "+" ? genomic : reverseComplement(genomic);
      const gcCount = [...primerSequence].filter(
        (symbol) => symbol === "G" || symbol === "C",
      ).length;
      const gcFraction = gcCount / primerSequence.length;
      if (gcFraction < 0.3 || gcFraction > 0.7) continue;
      const tmCelsius = 2 * (primerSequence.length - gcCount) + 4 * gcCount;
      const selfComplementarity = longestComplementaryRun(
        primerSequence,
        reverseComplement(primerSequence),
      );
      if (selfComplementarity >= 8) continue;
      const homopolymerPenalty = /([ACGT])\1{4,}/u.test(primerSequence)
        ? 10
        : 0;
      candidates.push({
        end,
        gcFraction,
        length,
        score:
          Math.abs(tmCelsius - optimumTm) +
          Math.abs(gcFraction - 0.5) * 20 +
          selfComplementarity +
          homopolymerPenalty,
        selfComplementarity,
        sequence: primerSequence,
        start,
        strand,
        tmCelsius,
      });
      if (
        candidates.length >= SEQUENCE_VIEWER_LIMITS.analysis.maxPrimerCandidates
      )
        return candidates;
    }
  }
  return candidates
    .sort((left, right) => left.score - right.score)
    .slice(0, 100);
}

function createOrf({
  completeStart,
  completeStop,
  endIndex,
  geneticCodeId,
  geneticCodeName,
  orientedSequence,
  originalLength,
  startIndex,
  strand,
}: {
  completeStart: boolean;
  completeStop: boolean;
  endIndex: number;
  geneticCodeId: number;
  geneticCodeName: string;
  orientedSequence: string;
  originalLength: number;
  startIndex: number;
  strand: "+" | "-";
}): SequenceOrf {
  const nucleotideSequence = orientedSequence.slice(startIndex, endIndex);
  const rawTranslation = translateFrame(nucleotideSequence, 0, geneticCodeId);
  const translation = rawTranslation.replace(/\*$/u, "");
  const start = strand === "+" ? startIndex + 1 : originalLength - endIndex + 1;
  const end = strand === "+" ? endIndex : originalLength - startIndex;
  const offset = startIndex % 3;
  return {
    aminoAcidLength: translation.length,
    completeStart,
    completeStop,
    end,
    frame: (strand === "+"
      ? offset + 1
      : -(offset + 1)) as SequenceOrf["frame"],
    geneticCodeId,
    geneticCodeName,
    nucleotideSequence,
    start,
    strand,
    translation,
  };
}

function sortOrfs(items: Array<SequenceOrf>): Array<SequenceOrf> {
  return items.sort(
    (left, right) =>
      right.aminoAcidLength - left.aminoAcidLength || left.start - right.start,
  );
}

function normalizeDna(sequence: string): string {
  return sequence.toUpperCase().replaceAll("U", "T").replaceAll(/\s+/gu, "");
}

function isUnambiguousStartCodon(
  codon: string,
  startCodons: ReadonlySet<string>,
): boolean {
  if (/^[ACGT]{3}$/u.test(codon)) return startCodons.has(codon);
  let candidates = [""];
  for (const symbol of codon)
    candidates = candidates.flatMap((prefix) =>
      [...expandNucleotideSymbol(symbol)].map((base) => `${prefix}${base}`),
    );
  return (
    candidates.length > 0 &&
    candidates.every((candidate) => startCodons.has(candidate))
  );
}

function matchesIupac(sequence: string, motif: string): boolean {
  return [...motif].every((symbol, index) =>
    expandNucleotideSymbol(symbol).has(sequence[index] ?? ""),
  );
}

function wrapCoordinate(coordinate: number, length: number): number {
  return length <= 0
    ? coordinate
    : ((((coordinate - 1) % length) + length) % length) + 1;
}

function longestComplementaryRun(left: string, right: string): number {
  let longest = 0;
  for (let offset = -right.length; offset <= left.length; offset += 1) {
    let run = 0;
    for (let index = 0; index < left.length; index += 1) {
      if (left[index] === right[index - offset]) {
        run += 1;
        longest = Math.max(longest, run);
      } else run = 0;
    }
  }
  return longest;
}

function enzyme(
  name: string,
  recognitionSequence: string,
  cutTop: number,
  cutBottom: number,
): RestrictionEnzyme {
  return {
    cutBottom,
    cutTop,
    id: name.toLowerCase(),
    name,
    recognitionSequence,
  };
}
