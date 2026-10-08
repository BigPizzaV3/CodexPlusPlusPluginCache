import { getScientificCigarCoverage } from "@openai/scientific-viewer-platform/sequence/scientific-evidence-coverage";

import type { SequenceTrack, TrackRead } from "./tracks";
import type { SequenceRecord } from "./types";

export function referencesMatch(left: string, right: string): boolean {
  return (
    left === right ||
    left.toLowerCase().replace(/^chr/u, "") ===
      right.toLowerCase().replace(/^chr/u, "")
  );
}

/** Exact names win; a normalized alias is usable only when unambiguous. */
export function resolveEvidenceReferenceName(
  reference: string,
  names: ReadonlyArray<string>,
): string | null {
  const uniqueNames = [...new Set(names)];
  if (uniqueNames.includes(reference)) return reference;
  const aliases = uniqueNames.filter((name) =>
    referencesMatch(name, reference),
  );
  return aliases.length === 1 ? (aliases[0] ?? null) : null;
}

export function resolveReadReferenceRecord<
  Record extends Pick<SequenceRecord, "sourceLabel">,
>(records: ReadonlyArray<Record>, reference: string): Record | null {
  const name = resolveEvidenceReferenceName(
    reference,
    records.map((record) => record.sourceLabel),
  );
  const matching =
    name == null ? [] : records.filter((record) => record.sourceLabel === name);
  return matching.length === 1 ? (matching[0] ?? null) : null;
}

export function getEvidenceReferenceUnavailableReason(
  record: Pick<SequenceRecord, "evidenceCoordinatesStale"> | null | undefined,
): string | null {
  return record?.evidenceCoordinatesStale === true
    ? "The reference sequence was edited. Imported tracks are retained in their original source coordinates, but read placement, coverage, variants and imported annotations are unavailable on this edited copy. Undo the sequence edit or reopen a matching source reference to resume; no implicit remapping was performed."
    : null;
}

export const READ_PILEUP_DETAIL_BASES = 200;
export const READ_PILEUP_MAX_DISPLAY_READS = 100;
const MAX_VISIBLE_OPERATIONS = 256;

export type ReadPileupFilters = {
  includeDuplicates: boolean;
  includeQcFailed: boolean;
  includeSecondary: boolean;
  includeSupplementary: boolean;
  includeUnknownMappingQuality: boolean;
  minimumMappingQuality: number;
  strand: "all" | "+" | "-";
};

export const DEFAULT_READ_PILEUP_FILTERS: ReadPileupFilters = {
  includeDuplicates: true,
  includeQcFailed: true,
  includeSecondary: true,
  includeSupplementary: true,
  includeUnknownMappingQuality: true,
  minimumMappingQuality: 0,
  strand: "all",
};

export type ReadPileupOptions = ReadPileupFilters & {
  showAllBases: boolean;
  showSoftClips: boolean;
  sortBy: "position" | "mapping-quality" | "strand";
};

export type ReadPileupSelection = {
  sourceReadIndex: number;
  trackId: string;
};

export type ReadPileupState = {
  options: ReadPileupOptions;
  selectedRead: ReadPileupSelection | null;
};

export const DEFAULT_READ_PILEUP_STATE: ReadPileupState = {
  options: {
    ...DEFAULT_READ_PILEUP_FILTERS,
    showAllBases: false,
    showSoftClips: true,
    sortBy: "position",
  },
  selectedRead: null,
};

type CigarOperation = {
  code: "M" | "I" | "D" | "N" | "S" | "H" | "P" | "=" | "X";
  length: number;
};

export type ReadAlignmentBlock = {
  end: number;
  operation: "M" | "=" | "X" | "D" | "N";
  start: number;
};

export type ReadAlignmentMarker = {
  /** Boundary immediately before this 1-based reference coordinate. */
  anchor: number;
  kind: "insertion" | "soft-clip";
  length: number;
  sequence: string;
};

export type ReadBaseCall = {
  base: string;
  comparison: "match" | "mismatch" | "unknown";
  coordinate: number;
  quality: number | null;
  referenceBase: string | null;
};

export type ReadAlignmentProjection = {
  bases: Array<ReadBaseCall>;
  blocks: Array<ReadAlignmentBlock>;
  hardClippedBases: number;
  markers: Array<ReadAlignmentMarker>;
  unavailableReason: string | null;
};

export type ReadPileupEntry = {
  key: string;
  read: TrackRead;
  sourceReadIndex: number;
  trackId: string;
  trackName: string;
};

export function getReadPileupEntry(
  tracks: ReadonlyArray<SequenceTrack>,
  selection: ReadPileupSelection,
): ReadPileupEntry {
  if (
    !Number.isSafeInteger(selection.sourceReadIndex) ||
    selection.sourceReadIndex < 0
  ) {
    throw new Error("Read selection requires a nonnegative source read index.");
  }
  const matchingTracks = tracks.filter(
    (candidate) => candidate.id === selection.trackId,
  );
  const track = matchingTracks.length === 1 ? matchingTracks[0] : undefined;
  const read = track?.reads?.[selection.sourceReadIndex];
  if (track == null || track.kind !== "reads" || read == null) {
    throw new Error(
      "The selected source read is not present in a loaded read track.",
    );
  }
  return {
    key: `${track.id}:${selection.sourceReadIndex}`,
    read,
    sourceReadIndex: selection.sourceReadIndex,
    trackId: track.id,
    trackName: track.name,
  };
}

export function getReadPileupEntryForRecord(
  tracks: ReadonlyArray<SequenceTrack>,
  selection: ReadPileupSelection,
  record: Pick<SequenceRecord, "sourceLabel" | "evidenceCoordinatesStale">,
  referenceRecords: ReadonlyArray<Pick<SequenceRecord, "sourceLabel">> = [
    record,
  ],
): ReadPileupEntry {
  const reason = getEvidenceReferenceUnavailableReason(record);
  if (reason != null) throw new Error(reason);
  const entry = getReadPileupEntry(tracks, selection);
  const track = tracks.find((candidate) => candidate.id === entry.trackId);
  const trackReference = resolveEvidenceReferenceName(
    record.sourceLabel,
    track?.summary.references ?? [],
  );
  const referenceRecord = resolveReadReferenceRecord(
    referenceRecords,
    entry.read.reference,
  );
  if (
    trackReference !== entry.read.reference ||
    referenceRecord?.sourceLabel !== record.sourceLabel
  ) {
    throw new Error(
      "The selected read reference is different from or ambiguous for the selected source record.",
    );
  }
  return entry;
}

export function identifyReadPileupEntries(
  tracks: ReadonlyArray<SequenceTrack>,
  reads: ReadonlyArray<TrackRead>,
): Array<ReadPileupEntry> {
  const requestedReads = new Set(reads);
  const entries = new Map<TrackRead, ReadPileupEntry>();
  for (const track of tracks) {
    for (const [sourceReadIndex, read] of (track.reads ?? []).entries()) {
      if (requestedReads.has(read))
        entries.set(read, {
          key: `${track.id}:${sourceReadIndex}`,
          read,
          sourceReadIndex,
          trackId: track.id,
          trackName: track.name,
        });
    }
  }
  return reads.flatMap((read) => {
    const entry = entries.get(read);
    return entry == null ? [] : [entry];
  });
}

export function summarizeReadBaseQuality(read: TrackRead): {
  availableCount: number;
  mean: number | null;
} {
  let sum = 0;
  let availableCount = 0;
  for (const quality of read.quality ?? []) {
    if (quality !== 255 && Number.isFinite(quality) && quality >= 0) {
      sum += quality;
      availableCount += 1;
    }
  }
  return {
    availableCount,
    mean: availableCount === 0 ? null : sum / availableCount,
  };
}

export function readPassesPileupFilters(
  read: TrackRead,
  filters: ReadPileupFilters,
): boolean {
  // SAM MAPQ 255 is unavailable, not greater confidence than MAPQ 60.
  const passesQuality =
    read.mappingQuality === 255
      ? filters.includeUnknownMappingQuality
      : read.mappingQuality >= filters.minimumMappingQuality;
  return (
    (read.flags & 0x4) === 0 &&
    passesQuality &&
    (filters.strand === "all" || filters.strand === read.strand) &&
    (filters.includeDuplicates || (read.flags & 0x400) === 0) &&
    (filters.includeQcFailed || (read.flags & 0x200) === 0) &&
    (filters.includeSecondary || (read.flags & 0x100) === 0) &&
    (filters.includeSupplementary || (read.flags & 0x800) === 0)
  );
}

/** Browser-safe validation and coverage; never infer a match span from SEQ. */
export function getReadCigarGeometry(
  read: TrackRead,
  range: { end: number; start: number },
): {
  intervals: Array<{ end1: number; start1: number }>;
  operations: Array<CigarOperation>;
} {
  const coverage = getScientificCigarCoverage({
    cigar: read.cigar,
    referenceStart1: read.position,
    windowEnd1: range.end,
    windowStart1: range.start,
  });
  if (
    read.sequence.length > 0 &&
    coverage.queryConsumedBases !== read.sequence.length
  ) {
    throw new Error("CIGAR query length does not match the stored sequence.");
  }
  if (coverage.referenceEnd1 !== read.end) {
    throw new Error("CIGAR reference extent does not match the read interval.");
  }
  const operations: Array<CigarOperation> = [];
  // The shared helper has already checked operation lengths, syntax and budgets.
  for (const match of read.cigar.matchAll(/(\d+)([MIDNSHP=X])/gu)) {
    const code = match[2];
    if (
      code === "M" ||
      code === "I" ||
      code === "D" ||
      code === "N" ||
      code === "S" ||
      code === "H" ||
      code === "P" ||
      code === "=" ||
      code === "X"
    ) {
      operations.push({ code, length: Number(match[1]) });
    }
  }
  for (const [index, operation] of operations.entries()) {
    if (
      operation.code === "H" &&
      index !== 0 &&
      index !== operations.length - 1
    ) {
      throw new Error("Hard clipping is only valid at CIGAR ends.");
    }
    if (
      operation.code === "S" &&
      index !== 0 &&
      index !== operations.length - 1 &&
      !(index === 1 && operations[0]?.code === "H") &&
      !(index === operations.length - 2 && operations.at(-1)?.code === "H")
    ) {
      throw new Error(
        "Soft clipping is only valid at CIGAR ends, inside hard clips.",
      );
    }
  }
  return { intervals: coverage.intervals, operations };
}

export function projectReadAlignment({
  read,
  referenceRecord,
  referenceSequence,
  range,
}: {
  read: TrackRead;
  referenceRecord?: Pick<SequenceRecord, "evidenceCoordinatesStale">;
  referenceSequence: string;
  range: { end: number; start: number };
}): ReadAlignmentProjection {
  const empty: ReadAlignmentProjection = {
    bases: [],
    blocks: [],
    hardClippedBases: 0,
    markers: [],
    unavailableReason: null,
  };
  const referenceUnavailableReason =
    getEvidenceReferenceUnavailableReason(referenceRecord);
  if (referenceUnavailableReason != null)
    return { ...empty, unavailableReason: referenceUnavailableReason };
  try {
    const { operations } = getReadCigarGeometry(read, range);
    const projection = { ...empty };
    let referencePosition = read.position;
    let queryIndex = 0;
    const showBases = range.end - range.start + 1 <= READ_PILEUP_DETAIL_BASES;
    for (const { code, length } of operations) {
      if (code === "H") {
        projection.hardClippedBases += length;
      } else if (code === "I" || code === "S") {
        if (
          referencePosition >= range.start &&
          referencePosition <= range.end + 1
        ) {
          projection.markers.push({
            anchor: referencePosition,
            kind: code === "I" ? "insertion" : "soft-clip",
            length,
            sequence: read.sequence.slice(
              queryIndex,
              queryIndex + Math.min(length, 80),
            ),
          });
        }
        queryIndex += length;
      } else if (code !== "P") {
        const start = Math.max(range.start, referencePosition);
        const end = Math.min(range.end, referencePosition + length - 1);
        if (start <= end) {
          projection.blocks.push({ end, operation: code, start });
          if (showBases && (code === "M" || code === "=" || code === "X")) {
            for (let coordinate = start; coordinate <= end; coordinate += 1) {
              const readIndex = queryIndex + coordinate - referencePosition;
              const referenceBase =
                referenceSequence[coordinate - 1]?.toUpperCase() ?? null;
              const storedBase = read.sequence[readIndex]?.toUpperCase();
              if (storedBase == null) continue;
              // SAM SEQ and QUAL already follow increasing reference coordinates,
              // including reverse-strand reads. Do not reverse-complement again.
              const base =
                storedBase === "=" ? (referenceBase ?? "=") : storedBase;
              const comparable =
                /^[ACGT]$/u.test(base) &&
                referenceBase != null &&
                /^[ACGT]$/u.test(referenceBase);
              const quality = read.quality?.[readIndex];
              projection.bases.push({
                base,
                comparison: comparable
                  ? base === referenceBase
                    ? "match"
                    : "mismatch"
                  : "unknown",
                coordinate,
                quality: quality != null && quality !== 255 ? quality : null,
                referenceBase,
              });
            }
          }
        }
        if (code === "M" || code === "=" || code === "X") queryIndex += length;
        referencePosition += length;
      }
      if (
        projection.blocks.length + projection.markers.length >
        MAX_VISIBLE_OPERATIONS
      ) {
        throw new Error(
          `More than ${MAX_VISIBLE_OPERATIONS} CIGAR operations in view; select a smaller region.`,
        );
      }
    }
    return projection;
  } catch (error) {
    return {
      ...empty,
      bases: [],
      blocks: [],
      markers: [],
      unavailableReason:
        error instanceof Error
          ? error.message
          : "CIGAR rendering is unavailable.",
    };
  }
}

/** Only link unambiguous, reciprocal first/last primary mates from one source. */
export function findVisibleReadMate(
  entry: ReadPileupEntry,
  entries: ReadonlyArray<ReadPileupEntry>,
): ReadPileupEntry | null {
  const { read } = entry;
  const segment = read.flags & 0xc0;
  if (
    read.id === "*" ||
    (read.flags & 0x1) === 0 ||
    (read.flags & 0x90c) !== 0 ||
    (segment !== 0x40 && segment !== 0x80) ||
    read.matePosition == null ||
    read.mateReference == null
  )
    return null;
  const mates = entries.filter((candidate) => {
    const mate = candidate.read;
    return (
      candidate.key !== entry.key &&
      candidate.trackId === entry.trackId &&
      mate.id === read.id &&
      (mate.flags & 0x1) !== 0 &&
      (mate.flags & 0x90c) === 0 &&
      (mate.flags & 0xc0) === (segment === 0x40 ? 0x80 : 0x40) &&
      mate.position === read.matePosition &&
      mate.reference === read.mateReference &&
      mate.matePosition === read.position &&
      mate.mateReference === read.reference &&
      mate.tags.RG === read.tags.RG
    );
  });
  return mates.length === 1 ? (mates[0] ?? null) : null;
}

export function mappingQualityLabel(mappingQuality: number): string {
  return mappingQuality === 255 ? "Unavailable (255)" : String(mappingQuality);
}

export function mappingQualityOpacity(mappingQuality: number): number {
  return mappingQuality === 255
    ? 0.55
    : 0.25 + Math.min(60, Math.max(0, mappingQuality)) / 80;
}

export function readFlagLabels(flags: number): Array<string> {
  const labels: Array<string> = [];
  if ((flags & 0x1) !== 0) {
    labels.push("paired");
    if ((flags & 0x2) !== 0) labels.push("proper pair");
    if ((flags & 0xc0) === 0x40) labels.push("first segment");
    if ((flags & 0xc0) === 0x80) labels.push("last segment");
    if ((flags & 0x8) !== 0) labels.push("mate unmapped");
  }
  if ((flags & 0x100) !== 0) labels.push("secondary");
  if ((flags & 0x200) !== 0) labels.push("QC failed");
  if ((flags & 0x400) !== 0) labels.push("duplicate");
  if ((flags & 0x800) !== 0) labels.push("supplementary");
  return labels;
}

export function binReadCoverage(
  coverage: ReadonlyArray<{ coordinate: number; depth: number }>,
  maxBins: number,
): Array<{ end: number; maximumDepth: number; start: number }> {
  if (!Number.isSafeInteger(maxBins) || maxBins <= 0) return [];
  const count = Math.min(coverage.length, maxBins);
  return Array.from({ length: count }, (_, index) => {
    const startIndex = Math.floor((index * coverage.length) / count);
    const endIndex = Math.floor(((index + 1) * coverage.length) / count) - 1;
    let maximumDepth = 0;
    for (let cursor = startIndex; cursor <= endIndex; cursor += 1) {
      maximumDepth = Math.max(maximumDepth, coverage[cursor]?.depth ?? 0);
    }
    return {
      end: coverage[endIndex]?.coordinate ?? 0,
      maximumDepth,
      start: coverage[startIndex]?.coordinate ?? 0,
    };
  });
}
