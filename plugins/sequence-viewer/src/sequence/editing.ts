import { reverseComplementNucleotide } from "../nucleotide-alphabet";

import { createFastqSummary } from "./formats/fastq";
import type {
  FastqSummary,
  SequenceDocument,
  SequenceFeature,
  SequenceFeatureSegment,
  SequenceQuality,
  SequenceRecord,
} from "./types";

export type SequenceEditChange = {
  description: string;
  operation:
    | "delete"
    | "insert"
    | "replace"
    | "reverse-complement"
    | "rotate";
  parameters: Record<string, unknown>;
};

export type SequenceEditResult = {
  change: SequenceEditChange;
  document: SequenceDocument;
  record: SequenceRecord;
};

export function insertSequence(
  document: SequenceDocument,
  recordId: string,
  coordinate: number,
  sequence: string,
): SequenceEditResult {
  const record = requireRecord(document, recordId);
  const inserted = normalizeEditSequence(sequence, record);
  if (inserted.length === 0) throw new Error("Inserted sequence cannot be empty.");
  if (coordinate < 1 || coordinate > record.length + 1) throw new Error(`Insertion coordinate must be between 1 and ${record.length + 1}.`);
  const quality = requireEditableQuality(document, record);
  if (quality != null) {
    throw new Error(
      "Cannot insert residues into a quality-scored FASTQ read without measured quality scores for the inserted bases.",
    );
  }
  const next = updateRecord(record, {
    features: record.features.map((feature) => remapFeatureForInsertion(feature, coordinate, inserted.length)),
    sequence: `${record.sequence.slice(0, coordinate - 1)}${inserted}${record.sequence.slice(coordinate - 1)}`,
  });
  return editResult(document, record, next, {
    description: `Inserted ${inserted.length} residues before coordinate ${coordinate}.`,
    operation: "insert",
    parameters: { coordinate, insertedLength: inserted.length },
  });
}

export function deleteSequenceRange(
  document: SequenceDocument,
  recordId: string,
  start: number,
  end: number,
): SequenceEditResult {
  const record = requireRecord(document, recordId);
  const range = validateRange(record, start, end);
  if (range.start === 1 && range.end === record.length) throw new Error("A sequence edit copy must retain at least one residue.");
  const quality = requireEditableQuality(document, record);
  if (quality != null && document.recordInventory?.truncated === true) {
    throw new Error(
      "Cannot change the length of a partially materialized FASTQ collection while preserving exact aggregate quality statistics.",
    );
  }
  const nextFeatures = record.features.flatMap((feature) => {
    const mapped = remapFeatureForDeletion(feature, range.start, range.end);
    return mapped == null ? [] : [mapped];
  });
  const next = updateRecord(record, {
    features: nextFeatures,
    ...(quality == null
      ? {}
      : {
          quality: {
            ascii: `${quality.ascii.slice(0, range.start - 1)}${quality.ascii.slice(range.end)}`,
            phred: [
              ...quality.phred.slice(0, range.start - 1),
              ...quality.phred.slice(range.end),
            ],
          },
        }),
    sequence: `${record.sequence.slice(0, range.start - 1)}${record.sequence.slice(range.end)}`,
  });
  return editResult(document, record, next, {
    description: `Deleted residues ${range.start}-${range.end}.`,
    operation: "delete",
    parameters: range,
  });
}

export function replaceSequenceRange(
  document: SequenceDocument,
  recordId: string,
  start: number,
  end: number,
  sequence: string,
): SequenceEditResult {
  const record = requireRecord(document, recordId);
  const range = validateRange(record, start, end);
  const replacement = normalizeEditSequence(sequence, record);
  if (replacement.length === 0) throw new Error("Replacement sequence cannot be empty.");
  const removedLength = range.end - range.start + 1;
  const quality = requireEditableQuality(document, record);
  if (quality != null && replacement.length !== removedLength) {
    throw new Error(
      "Cannot change the length of a quality-scored FASTQ read without measured quality scores for every resulting base.",
    );
  }
  const delta = replacement.length - removedLength;
  const nextFeatures = record.features.flatMap((feature) => {
    if (feature.end < range.start) return [feature];
    if (feature.start > range.end) return [shiftFeature(feature, delta)];
    if (feature.start >= range.start && feature.end <= range.end) return [];
    throw new Error(
      `Feature ${feature.label ?? feature.id} partially overlaps the replacement. Delete or edit that annotation first so coordinates are not silently approximated.`,
    );
  });
  const next = updateRecord(record, {
    features: nextFeatures,
    ...(quality == null ? {} : { quality }),
    sequence: `${record.sequence.slice(0, range.start - 1)}${replacement}${record.sequence.slice(range.end)}`,
  });
  return editResult(document, record, next, {
    description: `Replaced residues ${range.start}-${range.end} with ${replacement.length} residues.`,
    operation: "replace",
    parameters: { ...range, replacementLength: replacement.length },
  });
}

export function reverseComplementSequenceRange(
  document: SequenceDocument,
  recordId: string,
  start: number,
  end: number,
): SequenceEditResult {
  const record = requireRecord(document, recordId);
  if (record.molecule === "protein" || record.molecule === "unknown") throw new Error("Reverse complement is available only for nucleotide sequences.");
  const range = validateRange(record, start, end);
  const quality = requireEditableQuality(document, record);
  const nextFeatures = record.features.map((feature) => {
    if (feature.end < range.start || feature.start > range.end) return feature;
    if (feature.start < range.start || feature.end > range.end) throw new Error(`Feature ${feature.label ?? feature.id} crosses the requested reverse-complement boundary.`);
    return reverseFeatureWithinRange(feature, range.start, range.end);
  });
  const next = updateRecord(record, {
    features: nextFeatures,
    ...(quality == null
      ? {}
      : {
          quality: {
            ascii: `${quality.ascii.slice(0, range.start - 1)}${[...quality.ascii.slice(range.start - 1, range.end)].reverse().join("")}${quality.ascii.slice(range.end)}`,
            phred: [
              ...quality.phred.slice(0, range.start - 1),
              ...quality.phred.slice(range.start - 1, range.end).reverse(),
              ...quality.phred.slice(range.end),
            ],
          },
        }),
    sequence: `${record.sequence.slice(0, range.start - 1)}${reverseComplementNucleotide(record.sequence.slice(range.start - 1, range.end), record.molecule === "rna" ? "rna" : "dna")}${record.sequence.slice(range.end)}`,
  });
  return editResult(document, record, next, {
    description: `Reverse-complemented residues ${range.start}-${range.end}.`,
    operation: "reverse-complement",
    parameters: range,
  });
}

export function rotateCircularSequence(
  document: SequenceDocument,
  recordId: string,
  newOrigin: number,
): SequenceEditResult {
  const record = requireRecord(document, recordId);
  if (record.topology !== "circular") throw new Error("Sequence rotation requires a record marked circular.");
  if (newOrigin < 1 || newOrigin > record.length) throw new Error(`New origin must be between 1 and ${record.length}.`);
  if (newOrigin === 1) throw new Error("The sequence already starts at coordinate 1.");
  const quality = requireEditableQuality(document, record);
  const shift = newOrigin - 1;
  const mapCoordinate = (coordinate: number) => ((coordinate - shift - 1 + record.length) % record.length) + 1;
  const features = record.features.map((feature) =>
    rotateFeature(feature, mapCoordinate, record.length),
  );
  const next = updateRecord(record, {
    features,
    ...(quality == null
      ? {}
      : {
          quality: {
            ascii: `${quality.ascii.slice(shift)}${quality.ascii.slice(0, shift)}`,
            phred: [
              ...quality.phred.slice(shift),
              ...quality.phred.slice(0, shift),
            ],
          },
        }),
    sequence: `${record.sequence.slice(shift)}${record.sequence.slice(0, shift)}`,
  });
  return editResult(document, record, next, {
    description: `Rotated the circular sequence so source coordinate ${newOrigin} is the new origin.`,
    operation: "rotate",
    parameters: { newOrigin },
  });
}

export function addSequenceFeature(
  document: SequenceDocument,
  recordId: string,
  feature: SequenceFeature,
): SequenceDocument {
  const record = requireRecord(document, recordId);
  validateFeature(record, feature);
  if (record.features.some(({ id }) => id === feature.id)) throw new Error(`Feature ID ${feature.id} already exists.`);
  return replaceRecord(
    document,
    updateRecord(record, {
      features: [...record.features, feature],
      ...(record.quality == null ? {} : { quality: record.quality }),
      sequence: record.sequence,
    }),
  );
}

export function updateSequenceFeature(
  document: SequenceDocument,
  recordId: string,
  featureId: string,
  update: Partial<Omit<SequenceFeature, "id">>,
): SequenceDocument {
  const record = requireRecord(document, recordId);
  const current = record.features.find(({ id }) => id === featureId);
  if (current == null) throw new Error(`No feature matched ${featureId}.`);
  const next = { ...current, ...update, id: current.id };
  validateFeature(record, next);
  return replaceRecord(
    document,
    updateRecord(record, {
      features: record.features.map((feature) =>
        feature.id === featureId ? next : feature,
      ),
      ...(record.quality == null ? {} : { quality: record.quality }),
      sequence: record.sequence,
    }),
  );
}

export function deleteSequenceFeature(
  document: SequenceDocument,
  recordId: string,
  featureId: string,
): SequenceDocument {
  const record = requireRecord(document, recordId);
  const features = record.features.filter(({ id }) => id !== featureId);
  if (features.length === record.features.length) throw new Error(`No feature matched ${featureId}.`);
  return replaceRecord(
    document,
    updateRecord(record, {
      features,
      ...(record.quality == null ? {} : { quality: record.quality }),
      sequence: record.sequence,
    }),
  );
}

function editResult(
  document: SequenceDocument,
  previous: SequenceRecord,
  record: SequenceRecord,
  change: SequenceEditChange,
): SequenceEditResult {
  const { chromatogram: _chromatogram, ...recordWithoutTrace } = record;
  // Coordinate transformations can leave the sequence text unchanged (for
  // example a palindrome or periodic circular sequence). Keep that provenance.
  const coordinatesChanged =
    change.operation === "rotate" ||
    change.operation === "reverse-complement" ||
    previous.sequence !== record.sequence ||
    previous.length !== record.length;
  const editedRecord = coordinatesChanged
    ? { ...recordWithoutTrace, evidenceCoordinatesStale: true }
    : recordWithoutTrace;
  const nextDocument = replaceRecord(document, editedRecord);
  return {
    change,
    document: {
      ...nextDocument,
      ...(document.fastqSummary == null
        ? {}
        : {
            fastqSummary: updateEditedFastqSummary(
              nextDocument,
              document.fastqSummary,
              previous,
              editedRecord,
            ),
          }),
      warnings: [
        ...document.warnings,
        ...(previous.chromatogram == null
          ? []
          : [
              {
                code: "source-trace-not-carried",
                message:
                  "The source chromatogram and its base-call confidence values were not carried into this edited copy. They remain available on the unmodified source read.",
                severity: "warning" as const,
              },
            ]),
        {
          code: "edited-copy",
          message: `Record ${previous.sourceLabel} is an edited in-memory copy. The source file was not overwritten.`,
          severity: "info",
        },
      ],
    },
    record: editedRecord,
  };
}

function updateRecord(
  record: SequenceRecord,
  update: Pick<SequenceRecord, "features" | "sequence"> & {
    quality?: SequenceQuality;
  },
): SequenceRecord {
  const nextRecord = {
    ...record,
    ...update,
    features: update.features.map(normalizeSequenceFeature),
    length: update.sequence.length,
  };
  const { description, quality, topology, ...required } = nextRecord;
  return {
    ...required,
    ...(description == null ? {} : { description }),
    ...(quality == null || update.quality == null ? {} : { quality }),
    ...(topology == null ? {} : { topology }),
  };
}

function updateEditedFastqSummary(
  document: SequenceDocument,
  summary: FastqSummary,
  previous: SequenceRecord,
  next: SequenceRecord,
): FastqSummary {
  if (document.recordInventory?.truncated !== true) {
    return createFastqSummary(document.records);
  }
  if (previous.length !== next.length) {
    throw new Error(
      "Cannot recalculate exact FASTQ statistics after changing a partially materialized read collection.",
    );
  }
  const countSymbols = (sequence: string, symbols: ReadonlySet<string>) =>
    [...sequence].reduce(
      (count, symbol) => count + (symbols.has(symbol) ? 1 : 0),
      0,
    );
  const gcSymbols = new Set(["G", "C"]);
  const nSymbols = new Set(["N"]);
  const gcCount =
    Math.round(summary.gcFraction * summary.totalBases) -
    countSymbols(previous.sequence, gcSymbols) +
    countSymbols(next.sequence, gcSymbols);
  const nCount =
    Math.round(summary.nFraction * summary.totalBases) -
    countSymbols(previous.sequence, nSymbols) +
    countSymbols(next.sequence, nSymbols);
  return {
    ...summary,
    gcFraction: summary.totalBases === 0 ? 0 : gcCount / summary.totalBases,
    nFraction: summary.totalBases === 0 ? 0 : nCount / summary.totalBases,
  };
}

function requireEditableQuality(
  document: SequenceDocument,
  record: SequenceRecord,
): SequenceQuality | undefined {
  if (record.quality == null) {
    if (document.format === "fastq") {
      throw new Error(
        "Cannot edit a FASTQ read whose measured base-quality scores were not retained within the inspection budget.",
      );
    }
    return undefined;
  }
  if (
    record.quality.ascii.length !== record.length ||
    record.quality.phred.length !== record.length
  ) {
    throw new Error(
      "Cannot edit a FASTQ read because its measured quality scores do not align with the source sequence.",
    );
  }
  return record.quality;
}

function normalizeSequenceFeature(feature: SequenceFeature): SequenceFeature {
  const {
    codonStart,
    geneticCodeId,
    label,
    segments,
    sourceLocation,
    translation,
    translationCoordinateMap,
    translationMappingUnavailableReason,
    translationSource,
    translationTrackReliable,
    ...required
  } = feature;
  return {
    ...required,
    ...(codonStart == null ? {} : { codonStart }),
    ...(geneticCodeId == null ? {} : { geneticCodeId }),
    ...(label == null ? {} : { label }),
    ...(segments == null
      ? {}
      : {
          segments: segments.map(
            ({ partialEnd, partialStart, remoteAccession, ...segment }) => ({
              ...segment,
              ...(partialEnd == null ? {} : { partialEnd }),
              ...(partialStart == null ? {} : { partialStart }),
              ...(remoteAccession == null ? {} : { remoteAccession }),
            }),
          ),
        }),
    ...(sourceLocation == null ? {} : { sourceLocation }),
    ...(translation == null ? {} : { translation }),
    ...(translationCoordinateMap == null ? {} : { translationCoordinateMap }),
    ...(translationMappingUnavailableReason == null
      ? {}
      : { translationMappingUnavailableReason }),
    ...(translationSource == null ? {} : { translationSource }),
    ...(translationTrackReliable == null ? {} : { translationTrackReliable }),
  };
}

function replaceRecord(
  document: SequenceDocument,
  record: SequenceRecord,
): SequenceDocument {
  return {
    ...document,
    records: document.records.map((candidate) =>
      candidate.id === record.id ? record : candidate,
    ),
  };
}

function remapFeatureForInsertion(
  feature: SequenceFeature,
  coordinate: number,
  length: number,
): SequenceFeature {
  if (feature.end < coordinate) return feature;
  if (feature.start >= coordinate) return shiftFeature(feature, length);
  return {
    ...feature,
    end: feature.end + length,
    segments: feature.segments?.map((segment) =>
      segment.end < coordinate
        ? segment
        : segment.start >= coordinate
          ? shiftSegment(segment, length)
          : { ...segment, end: segment.end + length },
    ),
    translationCoordinateMap: undefined,
    translationMappingUnavailableReason:
      "sequence was inserted inside this feature; recompute translation before using amino-acid coordinates",
    translationTrackReliable: false,
  };
}

function remapFeatureForDeletion(
  feature: SequenceFeature,
  start: number,
  end: number,
): SequenceFeature | null {
  const length = end - start + 1;
  if (feature.end < start) return feature;
  if (feature.start > end) return shiftFeature(feature, -length);
  const segments = (feature.segments ?? [
    { end: feature.end, start: feature.start },
  ]).flatMap((segment) => {
    if (segment.end < start) return [segment];
    if (segment.start > end) return [shiftSegment(segment, -length)];
    const retained: Array<SequenceFeatureSegment> = [];
    if (segment.start < start) retained.push({ ...segment, end: start - 1 });
    if (segment.end > end)
      retained.push({
        ...segment,
        end: segment.end - length,
        start,
      });
    return retained;
  });
  if (segments.length === 0) return null;
  return {
    ...feature,
    end: Math.max(...segments.map(({ end: segmentEnd }) => segmentEnd)),
    segments,
    start: Math.min(...segments.map(({ start: segmentStart }) => segmentStart)),
    translationCoordinateMap: undefined,
    translationMappingUnavailableReason:
      "sequence was deleted inside this feature; recompute translation before using amino-acid coordinates",
    translationTrackReliable: false,
  };
}

function shiftFeature(feature: SequenceFeature, delta: number): SequenceFeature {
  return {
    ...feature,
    end: feature.end + delta,
    segments: feature.segments?.map((segment) => shiftSegment(segment, delta)),
    start: feature.start + delta,
    translationCoordinateMap: feature.translationCoordinateMap?.map((entry) => ({
      ...entry,
      codonCoordinates: entry.codonCoordinates.map((coordinate) =>
        coordinate + delta,
      ) as [number, number, number],
      displayCoordinate: entry.displayCoordinate + delta,
    })),
  };
}

function shiftSegment(
  segment: SequenceFeatureSegment,
  delta: number,
): SequenceFeatureSegment {
  return { ...segment, end: segment.end + delta, start: segment.start + delta };
}

function reverseFeatureWithinRange(
  feature: SequenceFeature,
  rangeStart: number,
  rangeEnd: number,
): SequenceFeature {
  const mapCoordinate = (coordinate: number) =>
    rangeStart + (rangeEnd - coordinate);
  const segments = (feature.segments ?? [
    { end: feature.end, start: feature.start },
  ])
    .map((segment) => ({
      ...segment,
      end: mapCoordinate(segment.start),
      start: mapCoordinate(segment.end),
    }))
    .reverse();
  return {
    ...feature,
    end: Math.max(...segments.map(({ end }) => end)),
    segments,
    start: Math.min(...segments.map(({ start }) => start)),
    strand: feature.strand === "+" ? "-" : feature.strand === "-" ? "+" : feature.strand,
    translationCoordinateMap: undefined,
    translationMappingUnavailableReason:
      "feature sequence was reverse-complemented; recompute translation before using amino-acid coordinates",
    translationTrackReliable: false,
  };
}

function rotateFeature(
  feature: SequenceFeature,
  mapCoordinate: (coordinate: number) => number,
  recordLength: number,
): SequenceFeature {
  const segments = (feature.segments ?? [
    { end: feature.end, start: feature.start },
  ]).flatMap((segment) => {
    const start = mapCoordinate(segment.start);
    const end = mapCoordinate(segment.end);
    return start <= end
      ? [{ ...segment, end, start }]
      : [
          { ...segment, end: recordLength, start },
          { ...segment, end, start: 1 },
        ];
  });
  return {
    ...feature,
    end: Math.max(...segments.map(({ end }) => end)),
    segments,
    start: Math.min(...segments.map(({ start }) => start)),
    translationCoordinateMap: undefined,
    translationMappingUnavailableReason:
      "circular origin changed; recompute translation before using amino-acid coordinates",
    translationTrackReliable: false,
  };
}

function validateRange(
  record: SequenceRecord,
  start: number,
  end: number,
): { end: number; start: number } {
  const normalized = { end: Math.max(start, end), start: Math.min(start, end) };
  if (
    !Number.isSafeInteger(normalized.start) ||
    !Number.isSafeInteger(normalized.end) ||
    normalized.start < 1 ||
    normalized.end > record.length
  ) {
    throw new Error(`Range must be within ${record.sourceLabel} coordinates 1-${record.length}.`);
  }
  return normalized;
}

function validateFeature(record: SequenceRecord, feature: SequenceFeature): void {
  if (feature.start < 1 || feature.end < feature.start || feature.end > record.length)
    throw new Error(`Feature ${feature.id} lies outside ${record.sourceLabel} coordinates 1-${record.length}.`);
  for (const segment of feature.segments ?? []) {
    if (segment.start < feature.start || segment.end > feature.end || segment.end < segment.start)
      throw new Error(`Feature ${feature.id} has an invalid segment.`);
  }
}

function requireRecord(
  document: SequenceDocument,
  recordId: string,
): SequenceRecord {
  const record = document.records.find(({ id }) => id === recordId);
  if (record == null) throw new Error(`No sequence record matched ${recordId}.`);
  return record;
}

function normalizeEditSequence(
  sequence: string,
  record: SequenceRecord,
): string {
  const normalized: Array<string> = [];
  const alphabet = (() => {
    switch (record.molecule) {
      case "dna":
        return new Set("ACGTRYSWKMBDHVN");
      case "rna":
        return new Set("ACGURYSWKMBDHVN");
      case "nucleic-acid-ambiguous":
        return new Set("ACGTURYSWKMBDHVN");
      case "protein":
        return new Set("ACDEFGHIKLMNPQRSTVWYBXZJUO*");
      case "unknown":
        throw new Error(
          `Cannot safely edit ${record.sourceLabel} because its molecular alphabet is unknown.`,
        );
    }
  })();
  for (const symbol of sequence) {
    if (symbol === " ") continue;
    const upper = symbol.toUpperCase();
    if (
      !/^[A-Za-z*]$/u.test(symbol) ||
      upper.length !== 1 ||
      !alphabet.has(upper)
    ) {
      throw new Error(
        `Residue ${JSON.stringify(symbol)} is not valid for the ${record.molecule} molecular alphabet.`,
      );
    }
    normalized.push(upper);
  }
  if (
    record.molecule === "nucleic-acid-ambiguous" &&
    normalized.includes("T") &&
    normalized.includes("U")
  ) {
    throw new Error(
      "A nucleotide edit cannot mix DNA thymine and RNA uracil residues.",
    );
  }
  return normalized.join("");
}
