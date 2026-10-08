import { SEQUENCE_VIEWER_LIMITS, utf8ByteLength } from "../runtime-contract";
import {
  getReadCigarGeometry,
  referencesMatch,
  resolveEvidenceReferenceName,
  resolveReadReferenceRecord,
} from "./read-pileup";
import type { SequenceRecord } from "./types";

export type SequenceTrackFormat =
  "bam" | "bed" | "cram" | "gff3" | "gtf" | "sam" | "vcf";

export type SequenceTrackKind = "annotations" | "reads" | "variants";

export type TrackFeature = {
  attributes: Record<string, string>;
  codingSegments?: Array<TrackFeatureSegment>;
  end: number;
  id: string;
  label?: string;
  phase?: 0 | 1 | 2;
  reference: string;
  score?: number;
  segments?: Array<TrackFeatureSegment>;
  source?: string;
  start: number;
  strand: "+" | "-" | "." | "?";
  type: string;
};

export type TrackFeatureSegment = {
  end: number;
  start: number;
};

export type TrackVariant = {
  alternateAlleles: Array<string>;
  filters: Array<string>;
  format?: string;
  id: string;
  info: Record<string, string | true>;
  position: number;
  quality?: number;
  rawFilter?: string;
  rawId?: string;
  rawInfo?: string;
  rawQuality?: string;
  reference: string;
  referenceAllele: string;
  sampleValues?: Array<string>;
  samples: Record<string, string>;
};

export type VcfTrackHeader = {
  columns: Array<string>;
  metaLines: Array<string>;
  sampleNames: Array<string>;
};

export type TrackRead = {
  cigar: string;
  end: number;
  flags: number;
  id: string;
  insertSize: number;
  mappingQuality: number;
  matePosition?: number;
  mateReference?: string;
  position: number;
  quality?: Array<number>;
  reference: string;
  sequence: string;
  strand: "+" | "-";
  tags: Record<string, string | number>;
};

export type SequenceTrack = {
  format: SequenceTrackFormat;
  id: string;
  kind: SequenceTrackKind;
  mapping: {
    matchedReference: string | null;
    requestedReference: string | null;
    status: "matched" | "unmatched" | "unresolved";
    unmatchedReferences: Array<string>;
  };
  name: string;
  source: {
    contentHash?: string;
    displayName: string;
    workspacePath?: string;
  };
  summary: {
    itemCount: number;
    materializedItemCount?: number;
    references: Array<string>;
    truncated: boolean;
  };
  features?: Array<TrackFeature>;
  reads?: Array<TrackRead>;
  variants?: Array<TrackVariant>;
  vcfHeader?: VcfTrackHeader;
};

export type EvidenceWindow = {
  coverage: Array<{ coordinate: number; depth: number }>;
  coverageBudgetExceeded: boolean;
  coverageComplete: boolean;
  coverageOmittedReadCount: number;
  coverageReadCount: number;
  downsampled: boolean;
  end: number;
  filteredReadCount: number;
  reads: Array<TrackRead>;
  sampledReadCount: number;
  sourceReadCount: number;
  sourceReferenceUncertain: boolean;
  sourceTruncated: boolean;
  start: number;
  totalReadCount: number;
  variants: Array<TrackVariant>;
};

const MAX_TRACK_ITEMS = SEQUENCE_VIEWER_LIMITS.input.maxTrackItems;
const MAX_COVERAGE_CIGAR_CHARACTERS = 2_000_000;
const MAX_BED_BLOCKS = 10_000;
const MAX_VCF_HEADER_BYTES = SEQUENCE_VIEWER_LIMITS.session.maxSessionBytes / 2;
const MAX_VCF_HEADER_LINES = 4_096;
const MAX_VCF_SAMPLES = 10_000;

export function parseSequenceTrack({
  content,
  displayName,
  format,
  id,
  requestedReference,
  sourceContentHash,
  sourceItemCount,
  sourceTruncated,
  sourceWorkspacePath,
}: {
  content: string | Uint8Array;
  displayName: string;
  format: SequenceTrackFormat;
  id: string;
  requestedReference?: string;
  sourceContentHash?: string;
  sourceItemCount?: number;
  sourceTruncated?: boolean;
  sourceWorkspacePath?: string;
}): SequenceTrack {
  const parsed =
    format === "bam"
      ? {
          kind: "reads" as const,
          reads:
            typeof content === "string"
              ? parseSam(content)
              : parseUncompressedBam(content),
        }
      : format === "sam" || format === "cram"
        ? { kind: "reads" as const, reads: parseSam(requireText(content)) }
        : format === "vcf"
          ? {
              ...parseVcfDocument(requireText(content)),
              kind: "variants" as const,
            }
          : {
              features: parseAnnotationTrack(requireText(content), format),
              kind: "annotations" as const,
            };
  const items =
    parsed.kind === "annotations"
      ? parsed.features
      : parsed.kind === "variants"
        ? parsed.variants
        : parsed.reads;
  const references = [
    ...new Set(items.map((item) => item.reference).filter(Boolean)),
  ].sort();
  const exactReference =
    requestedReference == null
      ? null
      : resolveEvidenceReferenceName(requestedReference, references);
  return {
    ...parsed,
    format,
    id,
    mapping: {
      matchedReference: exactReference,
      requestedReference: requestedReference ?? null,
      status:
        requestedReference == null
          ? "unresolved"
          : exactReference == null
            ? "unmatched"
            : "matched",
      unmatchedReferences:
        exactReference == null ? references.slice(0, 100) : [],
    },
    name: displayName,
    source: {
      displayName,
      ...(sourceContentHash == null ? {} : { contentHash: sourceContentHash }),
      ...(sourceWorkspacePath == null
        ? {}
        : { workspacePath: sourceWorkspacePath }),
    },
    summary: {
      itemCount: Math.max(items.length, sourceItemCount ?? 0),
      materializedItemCount: items.length,
      references,
      truncated: sourceTruncated === true || items.length >= MAX_TRACK_ITEMS,
    },
  };
}

export function parseAnnotationTrack(
  content: string,
  format: "bed" | "gff3" | "gtf",
): Array<TrackFeature> {
  const features: Array<TrackFeature> = [];
  for (const [lineIndex, rawLine] of content.split(/\r\n|\n|\r/u).entries()) {
    const line = rawLine.trim();
    if (
      line.length === 0 ||
      line.startsWith("#") ||
      line.startsWith("track") ||
      line.startsWith("browser")
    )
      continue;
    const fields = rawLine.split("\t");
    if (format === "bed") {
      if (fields.length < 3)
        throw new Error(
          `BED line ${lineIndex + 1} has fewer than three columns.`,
        );
      const reference = fields[0]?.trim() ?? "";
      const zeroBasedStart = parseNonnegativeInteger(
        fields[1],
        `BED line ${lineIndex + 1} start`,
      );
      const end = parsePositiveInteger(
        fields[2],
        `BED line ${lineIndex + 1} end`,
      );
      if (end <= zeroBasedStart)
        throw new Error(
          `BED line ${lineIndex + 1} has an empty or reversed interval.`,
        );
      const label = fields[3]?.trim();
      const score = parseOptionalNumber(fields[4]);
      const segments = parseBedSegments({
        end,
        fields,
        lineNumber: lineIndex + 1,
        zeroBasedStart,
      });
      const codingSegments = parseBedCodingSegments({
        end,
        fields,
        lineNumber: lineIndex + 1,
        segments,
        zeroBasedStart,
      });
      const itemRgb = fields[8]?.trim();
      features.push({
        attributes:
          itemRgb == null || itemRgb === "." || itemRgb.length === 0
            ? {}
            : { item_rgb: parseBedItemRgb(itemRgb, lineIndex + 1) },
        ...(codingSegments.length === 0 ? {} : { codingSegments }),
        end,
        id: `${reference}:bed:${lineIndex + 1}`,
        ...(label == null || label.length === 0 ? {} : { label }),
        reference,
        ...(score == null ? {} : { score }),
        ...(fields.length < 12 ? {} : { segments }),
        start: zeroBasedStart + 1,
        strand: parseStrand(fields[5]),
        type: "region",
      });
    } else {
      if (fields.length < 9)
        throw new Error(
          `${format.toUpperCase()} line ${lineIndex + 1} has fewer than nine columns.`,
        );
      const reference = fields[0]?.trim() ?? "";
      const attributes =
        format === "gtf"
          ? parseGtfAttributes(fields[8] ?? "")
          : parseGffAttributes(fields[8] ?? "");
      const start = parsePositiveInteger(
        fields[3],
        `${format.toUpperCase()} line ${lineIndex + 1} start`,
      );
      const end = parsePositiveInteger(
        fields[4],
        `${format.toUpperCase()} line ${lineIndex + 1} end`,
      );
      if (end < start)
        throw new Error(
          `${format.toUpperCase()} line ${lineIndex + 1} has a reversed interval.`,
        );
      const label =
        attributes.Name ?? attributes.gene_name ?? attributes.transcript_name;
      const score = parseOptionalNumber(fields[5]);
      const source = fields[1]?.trim();
      const phase = parseFeaturePhase(fields[7], format, lineIndex + 1);
      features.push({
        attributes,
        end,
        id:
          attributes.ID ??
          attributes.gene_id ??
          attributes.transcript_id ??
          `${reference}:${format}:${lineIndex + 1}`,
        ...(label == null ? {} : { label }),
        ...(phase == null ? {} : { phase }),
        reference,
        ...(score == null ? {} : { score }),
        ...(source == null || source.length === 0 ? {} : { source }),
        start,
        strand: parseStrand(fields[6]),
        type: fields[2]?.trim() || "feature",
      });
    }
    if (features.length >= MAX_TRACK_ITEMS) break;
  }
  return features;
}

function parseBedSegments({
  end,
  fields,
  lineNumber,
  zeroBasedStart,
}: {
  end: number;
  fields: Array<string>;
  lineNumber: number;
  zeroBasedStart: number;
}): Array<TrackFeatureSegment> {
  if (fields.length < 10) {
    return [{ end, start: zeroBasedStart + 1 }];
  }
  if (fields.length < 12) {
    throw new Error(
      `BED line ${lineNumber} must include blockCount, blockSizes, and blockStarts together.`,
    );
  }
  const blockCount = parsePositiveInteger(
    fields[9],
    `BED line ${lineNumber} block count`,
  );
  if (blockCount > MAX_BED_BLOCKS) {
    throw new Error(`BED line ${lineNumber} exceeds the bounded block count.`);
  }
  const sizes = parseBedBlockList(fields[10], blockCount, lineNumber, "sizes");
  const starts = parseBedBlockList(
    fields[11],
    blockCount,
    lineNumber,
    "starts",
  );
  let previousEnd = zeroBasedStart;
  return starts.map((blockStart, index) => {
    const size = sizes[index] ?? 0;
    if (size === 0) {
      throw new Error(`BED line ${lineNumber} has an empty exon block.`);
    }
    const start = zeroBasedStart + blockStart;
    const blockEnd = start + size;
    if (start < previousEnd || blockEnd > end) {
      throw new Error(
        `BED line ${lineNumber} has overlapping or out-of-range exon blocks.`,
      );
    }
    previousEnd = blockEnd;
    return { end: blockEnd, start: start + 1 };
  });
}

function parseBedBlockList(
  value: string | undefined,
  expectedCount: number,
  lineNumber: number,
  label: "sizes" | "starts",
): Array<number> {
  const normalized = value?.endsWith(",") ? value.slice(0, -1) : value;
  const parts = normalized?.split(",") ?? [];
  if (
    parts.length !== expectedCount ||
    parts.some((part) => part.length === 0)
  ) {
    throw new Error(
      `BED line ${lineNumber} block ${label} do not match its block count.`,
    );
  }
  return parts.map((part, index) =>
    parseNonnegativeInteger(
      part,
      `BED line ${lineNumber} block ${label} ${index + 1}`,
    ),
  );
}

function parseBedCodingSegments({
  end,
  fields,
  lineNumber,
  segments,
  zeroBasedStart,
}: {
  end: number;
  fields: Array<string>;
  lineNumber: number;
  segments: Array<TrackFeatureSegment>;
  zeroBasedStart: number;
}): Array<TrackFeatureSegment> {
  if (fields.length < 7) return [];
  if (fields.length < 8) {
    throw new Error(
      `BED line ${lineNumber} must include both coding-boundary columns.`,
    );
  }
  const thickStart = parseNonnegativeInteger(
    fields[6],
    `BED line ${lineNumber} thickStart`,
  );
  const thickEnd = parseNonnegativeInteger(
    fields[7],
    `BED line ${lineNumber} thickEnd`,
  );
  if (thickStart < zeroBasedStart || thickEnd < thickStart || thickEnd > end) {
    throw new Error(
      `BED line ${lineNumber} has reversed or out-of-range coding boundaries.`,
    );
  }
  if (thickStart === thickEnd) return [];
  return segments.flatMap((segment) => {
    const start = Math.max(segment.start, thickStart + 1);
    const codingEnd = Math.min(segment.end, thickEnd);
    return start > codingEnd ? [] : [{ end: codingEnd, start }];
  });
}

function parseBedItemRgb(value: string, lineNumber: number): string {
  if (value === "0") return value;
  const components = value.split(",");
  if (
    components.length !== 3 ||
    components.some((component) => {
      const parsed = Number(component);
      return (
        !/^\d{1,3}$/u.test(component) ||
        !Number.isSafeInteger(parsed) ||
        parsed > 255
      );
    })
  ) {
    throw new Error(`BED line ${lineNumber} has an invalid RGB value.`);
  }
  return value;
}

function parseFeaturePhase(
  value: string | undefined,
  format: "gff3" | "gtf",
  lineNumber: number,
): 0 | 1 | 2 | undefined {
  if (value == null || value === ".") return undefined;
  if (value === "0" || value === "1" || value === "2") {
    return value === "0" ? 0 : value === "1" ? 1 : 2;
  }
  throw new Error(
    `${format.toUpperCase()} line ${lineNumber} has an invalid CDS phase.`,
  );
}

export function parseVcf(content: string): Array<TrackVariant> {
  return parseVcfDocument(content).variants;
}

function parseVcfDocument(content: string): {
  variants: Array<TrackVariant>;
  vcfHeader?: VcfTrackHeader;
} {
  let columns: Array<string> | undefined;
  let headerBytes = 0;
  const metaLines: Array<string> = [];
  const variants: Array<TrackVariant> = [];
  let sampleNames: Array<string> = [];
  for (const [lineIndex, rawLine] of content.split(/\r\n|\n|\r/u).entries()) {
    if (rawLine.trim().length === 0) continue;
    if (rawLine.startsWith("##")) {
      if (columns != null) {
        throw new Error(
          `VCF line ${lineIndex + 1} contains metadata after the column header.`,
        );
      }
      headerBytes = addVcfHeaderBytes(headerBytes, rawLine, lineIndex + 1);
      if (metaLines.length >= MAX_VCF_HEADER_LINES) {
        throw new Error("VCF metadata exceeds the bounded header line count.");
      }
      metaLines.push(rawLine);
      continue;
    }
    if (rawLine.startsWith("#CHROM")) {
      if (columns != null) {
        throw new Error(`VCF line ${lineIndex + 1} repeats the column header.`);
      }
      headerBytes = addVcfHeaderBytes(headerBytes, rawLine, lineIndex + 1);
      columns = rawLine.split("\t");
      if (columns.length < 8) {
        throw new Error(
          `VCF line ${lineIndex + 1} has fewer than eight header columns.`,
        );
      }
      sampleNames = columns.slice(9);
      if (sampleNames.length > MAX_VCF_SAMPLES) {
        throw new Error("VCF sample count exceeds the bounded track limit.");
      }
      if (new Set(sampleNames).size !== sampleNames.length) {
        throw new Error("VCF sample identifiers must be unique.");
      }
      continue;
    }
    if (rawLine.startsWith("#")) continue;
    const fields = rawLine.split("\t");
    if (fields.length < 8)
      throw new Error(
        `VCF line ${lineIndex + 1} has fewer than eight columns.`,
      );
    const reference = fields[0]?.trim() ?? "";
    const position = parsePositiveInteger(
      fields[1],
      `VCF line ${lineIndex + 1} position`,
    );
    const referenceAllele = fields[3]?.trim().toUpperCase() ?? "";
    if (referenceAllele.length === 0)
      throw new Error(`VCF line ${lineIndex + 1} has no reference allele.`);
    if (columns != null && fields.length !== columns.length) {
      throw new Error(
        `VCF line ${lineIndex + 1} has ${fields.length} columns; its header declares ${columns.length}.`,
      );
    }
    const quality = parseOptionalNumber(fields[5]);
    const format = fields[8];
    const sampleValues = fields.slice(9);
    variants.push({
      alternateAlleles: (fields[4] ?? "")
        .split(",")
        .filter((value) => value.length > 0 && value !== "."),
      filters:
        fields[6] === "." || fields[6] === "PASS"
          ? []
          : (fields[6] ?? "").split(";"),
      ...(format == null ? {} : { format }),
      id:
        fields[2] === "." || fields[2] == null
          ? `${reference}:${position}:${referenceAllele}`
          : fields[2],
      info: parseVcfInfo(fields[7] ?? ""),
      position,
      ...(quality == null ? {} : { quality }),
      rawFilter: fields[6] ?? ".",
      rawId: fields[2] ?? ".",
      rawInfo: fields[7] ?? ".",
      rawQuality: fields[5] ?? ".",
      reference,
      referenceAllele,
      ...(sampleNames.length === 0 ? {} : { sampleValues }),
      samples: Object.fromEntries(
        sampleNames.map((name, index) => [name, sampleValues[index] ?? "."]),
      ),
    });
    if (variants.length >= MAX_TRACK_ITEMS) break;
  }
  return {
    variants,
    ...(columns == null
      ? {}
      : { vcfHeader: { columns, metaLines, sampleNames } }),
  };
}

function addVcfHeaderBytes(
  currentBytes: number,
  line: string,
  lineNumber: number,
): number {
  const nextBytes = currentBytes + utf8ByteLength(line) + 1;
  if (nextBytes > MAX_VCF_HEADER_BYTES) {
    throw new Error(
      `VCF line ${lineNumber} exceeds the bounded metadata header size.`,
    );
  }
  return nextBytes;
}

export function parseSam(content: string): Array<TrackRead> {
  const reads: Array<TrackRead> = [];
  for (const [lineIndex, rawLine] of content.split(/\r\n|\n|\r/u).entries()) {
    if (rawLine.startsWith("@") || rawLine.trim().length === 0) continue;
    const fields = rawLine.split("\t");
    if (fields.length < 11)
      throw new Error(
        `SAM line ${lineIndex + 1} has fewer than eleven columns.`,
      );
    const flags = parseNonnegativeInteger(
      fields[1],
      `SAM line ${lineIndex + 1} flags`,
    );
    if (flags > 0xffff) {
      throw new Error(
        `SAM line ${lineIndex + 1} flags exceed the 16-bit SAM flag field.`,
      );
    }
    const reference = fields[2] ?? "*";
    if ((flags & 0x4) !== 0 || reference === "*") continue;
    const position = parsePositiveInteger(
      fields[3],
      `SAM line ${lineIndex + 1} position`,
    );
    const cigar = fields[5] ?? "*";
    validateCigar(cigar, lineIndex + 1);
    const sequence = fields[9] === "*" ? "" : (fields[9]?.toUpperCase() ?? "");
    const qualityString = fields[10] ?? "*";
    if (qualityString !== "*" && qualityString.length !== sequence.length) {
      throw new Error(
        `SAM line ${lineIndex + 1} has ${sequence.length} sequence symbols and ${qualityString.length} quality symbols.`,
      );
    }
    if (
      qualityString !== "*" &&
      [...qualityString].some(
        (symbol) => symbol.charCodeAt(0) < 33 || symbol.charCodeAt(0) > 126,
      )
    ) {
      throw new Error(
        `SAM line ${lineIndex + 1} quality must use printable Phred+33 ASCII.`,
      );
    }
    const mappingQuality = parseNonnegativeInteger(
      fields[4],
      `SAM line ${lineIndex + 1} mapping quality`,
    );
    if (mappingQuality > 255) {
      throw new Error(`SAM line ${lineIndex + 1} mapping quality exceeds 255.`);
    }
    const matePosition = parseOptionalPositiveInteger(fields[7]);
    const mateReference =
      fields[6] === "=" ? reference : fields[6] === "*" ? undefined : fields[6];
    reads.push({
      cigar,
      end: position + referenceSpan(cigar, sequence.length) - 1,
      flags,
      id: fields[0] ?? `read-${lineIndex + 1}`,
      insertSize: parseInteger(
        fields[8],
        `SAM line ${lineIndex + 1} insert size`,
      ),
      mappingQuality,
      ...(matePosition == null ? {} : { matePosition }),
      ...(mateReference == null ? {} : { mateReference }),
      position,
      ...(qualityString === "*"
        ? {}
        : {
            quality: [...qualityString].map((symbol) =>
              Math.max(0, symbol.charCodeAt(0) - 33),
            ),
          }),
      reference,
      sequence,
      strand: (flags & 0x10) !== 0 ? "-" : "+",
      tags: parseSamTags(fields.slice(11)),
    });
    if (reads.length >= MAX_TRACK_ITEMS) break;
  }
  return reads;
}

export function parseUncompressedBam(bytes: Uint8Array): Array<TrackRead> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (
    bytes.length < 12 ||
    String.fromCharCode(...bytes.slice(0, 4)) !== "BAM\u0001"
  )
    throw new Error(
      "BAM data must be BGZF-decompressed and begin with BAM\\1.",
    );
  let offset = 4;
  const headerLength = view.getInt32(offset, true);
  offset += 4 + headerLength;
  if (offset + 4 > bytes.length) throw new Error("BAM header is truncated.");
  const referenceCount = view.getInt32(offset, true);
  offset += 4;
  const references: Array<string> = [];
  for (let index = 0; index < referenceCount; index += 1) {
    if (offset + 8 > bytes.length)
      throw new Error("BAM reference dictionary is truncated.");
    const nameLength = view.getInt32(offset, true);
    offset += 4;
    const name = decodeAscii(
      bytes.slice(offset, offset + Math.max(0, nameLength - 1)),
    );
    offset += nameLength + 4;
    references.push(name);
  }
  const reads: Array<TrackRead> = [];
  while (offset + 4 <= bytes.length && reads.length < MAX_TRACK_ITEMS) {
    const blockSize = view.getInt32(offset, true);
    offset += 4;
    if (blockSize < 32 || offset + blockSize > bytes.length)
      throw new Error("BAM alignment block is truncated or invalid.");
    const blockEnd = offset + blockSize;
    const referenceId = view.getInt32(offset, true);
    const zeroBasedPosition = view.getInt32(offset + 4, true);
    const binMqNl = view.getUint32(offset + 8, true);
    const flagNc = view.getUint32(offset + 12, true);
    const sequenceLength = view.getInt32(offset + 16, true);
    const nextReferenceId = view.getInt32(offset + 20, true);
    const nextPosition = view.getInt32(offset + 24, true);
    const insertSize = view.getInt32(offset + 28, true);
    const readNameLength = binMqNl & 0xff;
    const mappingQuality = (binMqNl >>> 8) & 0xff;
    const cigarCount = flagNc & 0xffff;
    const flags = flagNc >>> 16;
    let cursor = offset + 32;
    const id = decodeAscii(
      bytes.slice(cursor, cursor + Math.max(0, readNameLength - 1)),
    );
    cursor += readNameLength;
    const cigarParts: Array<string> = [];
    for (let index = 0; index < cigarCount; index += 1) {
      const encoded = view.getUint32(cursor, true);
      cursor += 4;
      cigarParts.push(`${encoded >>> 4}${"MIDNSHP=XB"[encoded & 0xf] ?? "?"}`);
    }
    const sequenceByteCount = Math.ceil(sequenceLength / 2);
    const sequence = decodeBamSequence(
      bytes.slice(cursor, cursor + sequenceByteCount),
      sequenceLength,
    );
    cursor += sequenceByteCount;
    const rawQuality = [...bytes.slice(cursor, cursor + sequenceLength)];
    cursor += sequenceLength;
    const reference = references[referenceId] ?? `reference-${referenceId}`;
    const cigar = cigarParts.join("") || "*";
    if ((flags & 0x4) === 0 && referenceId >= 0) {
      const position = zeroBasedPosition + 1;
      reads.push({
        cigar,
        end: position + referenceSpan(cigar, sequence.length) - 1,
        flags,
        id,
        insertSize,
        mappingQuality,
        ...(nextPosition < 0 ? {} : { matePosition: nextPosition + 1 }),
        ...(nextReferenceId < 0
          ? {}
          : {
              mateReference:
                references[nextReferenceId] ?? `reference-${nextReferenceId}`,
            }),
        position,
        ...(rawQuality.every((quality) => quality === 0xff)
          ? {}
          : { quality: rawQuality }),
        reference,
        sequence,
        strand: (flags & 0x10) !== 0 ? "-" : "+",
        tags: parseBamAux(bytes.slice(cursor, blockEnd)),
      });
    }
    offset = blockEnd;
  }
  return reads;
}

export function buildEvidenceWindow({
  end,
  maxReads = 100,
  readFilter,
  reference,
  referenceRecords,
  start,
  tracks,
}: {
  end: number;
  maxReads?: number;
  readFilter?: (read: TrackRead) => boolean;
  reference: string;
  referenceRecords?: ReadonlyArray<Pick<SequenceRecord, "sourceLabel">>;
  start: number;
  tracks: Array<SequenceTrack>;
}): EvidenceWindow {
  if (!Number.isSafeInteger(start) || start < 1 || !Number.isSafeInteger(end))
    throw new Error(
      "Evidence window coordinates must be positive safe integers.",
    );
  if (end < start)
    throw new Error("Evidence window end must be at or after its start.");
  if (!Number.isSafeInteger(maxReads) || maxReads < 0)
    throw new Error("Evidence read limit must be a nonnegative safe integer.");
  const span = end - start + 1;
  if (span > 100_000)
    throw new Error(
      "Read evidence is available only for windows of 100,000 bases or fewer.",
    );
  const selectedReferenceRecord =
    referenceRecords == null
      ? null
      : resolveReadReferenceRecord(referenceRecords, reference);
  const trackReferences = tracks.map((track) => {
    const candidate = resolveEvidenceReferenceName(
      reference,
      track.summary.references,
    );
    const sourceRecord =
      referenceRecords == null || candidate == null
        ? null
        : resolveReadReferenceRecord(referenceRecords, candidate);
    const ambiguousDocumentReference =
      referenceRecords != null &&
      referenceRecords.some((record) =>
        referencesMatch(record.sourceLabel, reference),
      ) &&
      selectedReferenceRecord == null;
    const belongsToAnotherRecord =
      selectedReferenceRecord != null &&
      sourceRecord?.sourceLabel !== selectedReferenceRecord.sourceLabel;
    return {
      track,
      matchedReference:
        ambiguousDocumentReference || belongsToAnotherRecord ? null : candidate,
    };
  });
  const allReads = trackReferences
    .flatMap(({ track, matchedReference }) =>
      (track.reads ?? []).filter((read) => read.reference === matchedReference),
    )
    .filter(
      (read) =>
        (read.flags & 0x4) === 0 && read.end >= start && read.position <= end,
    );
  const filteredReads =
    readFilter == null ? allReads : allReads.filter(readFilter);
  const matchingReadTracks = trackReferences.filter(
    ({ track, matchedReference }) =>
      track.kind === "reads" &&
      (track.summary.truncated ||
        matchedReference != null ||
        track.summary.references.some((name) =>
          referencesMatch(name, reference),
        )),
  );
  const sourceReadCount = matchingReadTracks.reduce(
    (sum, { track }) => sum + track.summary.itemCount,
    0,
  );
  const sourceTruncated = matchingReadTracks.some(
    ({ track }) => track.summary.truncated,
  );
  // A missing name in a truncated sample (or an ambiguous alias) is not proof
  // that the reference is absent from the source, even when the observed depth is zero.
  const sourceReferenceUncertain = matchingReadTracks.some(
    ({ matchedReference }) => matchedReference == null,
  );
  const variants = trackReferences
    .flatMap(({ track, matchedReference }) =>
      (track.variants ?? []).filter(
        (variant) => variant.reference === matchedReference,
      ),
    )
    .filter((variant) => variant.position >= start && variant.position <= end);
  const coverage = new Int32Array(span + 1);
  let coverageReadCount = 0;
  let coverageCigarCharacters = 0;
  let coverageBudgetExceeded = false;
  for (const read of filteredReads) {
    coverageCigarCharacters += read.cigar.length;
    if (coverageCigarCharacters > MAX_COVERAGE_CIGAR_CHARACTERS) {
      coverageBudgetExceeded = true;
      continue;
    }
    try {
      const { intervals } = getReadCigarGeometry(read, { end, start });
      // Only M, = and X contribute sequenced-base coverage. D and N consume
      // reference coordinates but are not covered bases; I/S/H/P consume none.
      for (const interval of intervals) {
        coverage[interval.start1 - start] += 1;
        coverage[interval.end1 - start + 1] -= 1;
      }
      coverageReadCount += 1;
    } catch {
      // Missing, malformed or unsupported CIGARs must not become fabricated
      // POS..END coverage. Callers disclose this explicit incompleteness.
    }
  }
  let depth = 0;
  const coveragePoints = Array.from({ length: span }, (_, index) => {
    depth += coverage[index] ?? 0;
    return { coordinate: start + index, depth };
  });
  const reads = downsampleReads(filteredReads, maxReads);
  const coverageOmittedReadCount = filteredReads.length - coverageReadCount;
  return {
    coverage: coveragePoints,
    coverageBudgetExceeded,
    coverageComplete:
      !sourceTruncated &&
      !sourceReferenceUncertain &&
      coverageOmittedReadCount === 0,
    coverageOmittedReadCount,
    coverageReadCount,
    downsampled: sourceTruncated || reads.length < filteredReads.length,
    end,
    filteredReadCount: filteredReads.length,
    reads,
    sampledReadCount: reads.length,
    sourceReadCount,
    sourceReferenceUncertain,
    sourceTruncated,
    start,
    totalReadCount: allReads.length,
    variants,
  };
}

function downsampleReads(
  reads: Array<TrackRead>,
  maxReads: number,
): Array<TrackRead> {
  if (reads.length <= maxReads) return reads;
  const step = reads.length / maxReads;
  return Array.from(
    { length: maxReads },
    (_, index) => reads[Math.floor(index * step)],
  ).filter((read): read is TrackRead => read != null);
}

function parseGffAttributes(value: string): Record<string, string> {
  return Object.fromEntries(
    value.split(";").flatMap((entry) => {
      const [rawKey, ...rawValue] = entry.split("=");
      const key = rawKey?.trim();
      return key == null || key.length === 0
        ? []
        : [
            [
              decodeURIComponent(key),
              decodeURIComponent(rawValue.join("=").trim()),
            ],
          ];
    }),
  );
}

function parseGtfAttributes(value: string): Record<string, string> {
  const attributes: Record<string, string> = {};
  for (const match of value.matchAll(/([^\s;]+)\s+"([^"]*)"\s*;?/gu)) {
    if (match[1] != null) attributes[match[1]] = match[2] ?? "";
  }
  return attributes;
}

function parseVcfInfo(value: string): Record<string, string | true> {
  if (value === "." || value.length === 0) return {};
  return Object.fromEntries(
    value.split(";").map((entry) => {
      const [key, ...rest] = entry.split("=");
      return [key ?? "", rest.length === 0 ? true : rest.join("=")];
    }),
  );
}

function parseSamTags(values: Array<string>): Record<string, string | number> {
  const tags: Record<string, string | number> = {};
  for (const value of values) {
    const [tag, type, ...rawValue] = value.split(":");
    if (tag == null || type == null || !/^[A-Za-z][A-Za-z0-9]$/u.test(tag)) {
      throw new Error(`SAM optional field '${value}' has an invalid tag.`);
    }
    const joined = rawValue.join(":");
    if (!/^[AifZHB]$/u.test(type)) {
      throw new Error(
        `SAM optional field '${tag}' has unsupported type '${type}'.`,
      );
    }
    if (type === "i" || type === "f") {
      const parsed = Number(joined);
      if (
        !Number.isFinite(parsed) ||
        (type === "i" && !Number.isInteger(parsed))
      ) {
        throw new Error(
          `SAM optional field '${tag}' has an invalid numeric value.`,
        );
      }
      tags[tag] = parsed;
      continue;
    }
    tags[tag] = joined;
  }
  return tags;
}

function parseBamAux(bytes: Uint8Array): Record<string, string | number> {
  const tags: Record<string, string | number> = {};
  let offset = 0;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  while (offset + 3 <= bytes.length) {
    const tag = String.fromCharCode(bytes[offset] ?? 0, bytes[offset + 1] ?? 0);
    const type = String.fromCharCode(bytes[offset + 2] ?? 0);
    offset += 3;
    if (type === "A" || type === "c" || type === "C") {
      tags[tag] =
        type === "A"
          ? String.fromCharCode(bytes[offset] ?? 0)
          : type === "c"
            ? view.getInt8(offset)
            : view.getUint8(offset);
      offset += 1;
    } else if (type === "s" || type === "S") {
      tags[tag] =
        type === "s"
          ? view.getInt16(offset, true)
          : view.getUint16(offset, true);
      offset += 2;
    } else if (type === "i" || type === "I" || type === "f") {
      tags[tag] =
        type === "i"
          ? view.getInt32(offset, true)
          : type === "I"
            ? view.getUint32(offset, true)
            : view.getFloat32(offset, true);
      offset += 4;
    } else if (type === "Z" || type === "H") {
      const end = bytes.indexOf(0, offset);
      if (end < 0) break;
      tags[tag] = decodeAscii(bytes.slice(offset, end));
      offset = end + 1;
    } else break;
  }
  return tags;
}

function decodeBamSequence(bytes: Uint8Array, length: number): string {
  const alphabet = "=ACMGRSVTWYHKDBN";
  let sequence = "";
  for (let index = 0; index < length; index += 1) {
    const encoded = bytes[Math.floor(index / 2)] ?? 0;
    const code = index % 2 === 0 ? encoded >>> 4 : encoded & 0xf;
    sequence += alphabet[code] ?? "N";
  }
  return sequence;
}

function referenceSpan(cigar: string, fallbackLength: number): number {
  if (cigar === "*" || cigar.length === 0) return Math.max(1, fallbackLength);
  let span = 0;
  for (const match of cigar.matchAll(/(\d+)([MIDNSHP=XB])/gu)) {
    if (match[2] != null && "MDN=X".includes(match[2]))
      span += Number(match[1] ?? 0);
  }
  return Math.max(1, span);
}

function validateCigar(cigar: string, lineNumber: number): void {
  if (cigar === "*") return;
  if (!/^(?:[1-9]\d*[MIDNSHP=XB])+$/u.test(cigar)) {
    throw new Error(`SAM line ${lineNumber} has an invalid CIGAR string.`);
  }
}

function parseStrand(value: string | undefined): TrackFeature["strand"] {
  return value === "+" || value === "-" || value === "." || value === "?"
    ? value
    : ".";
}

function parsePositiveInteger(
  value: string | undefined,
  label: string,
): number {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0)
    throw new Error(`${label} must be a positive integer.`);
  return parsed;
}

function parseNonnegativeInteger(
  value: string | undefined,
  label: string,
): number {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0)
    throw new Error(`${label} must be a nonnegative integer.`);
  return parsed;
}

function parseInteger(value: string | undefined, label: string): number {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed))
    throw new Error(`${label} must be an integer.`);
  return parsed;
}

function parseOptionalPositiveInteger(
  value: string | undefined,
): number | undefined {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : undefined;
}

function parseOptionalNumber(value: string | undefined): number | undefined {
  const parsed = Number(value);
  return value == null || value === "." || !Number.isFinite(parsed)
    ? undefined
    : parsed;
}

function decodeAscii(bytes: Uint8Array): string {
  return new TextDecoder("ascii").decode(bytes);
}

function requireText(content: string | Uint8Array): string {
  if (typeof content !== "string")
    throw new Error("This track format requires UTF-8 text input.");
  return content;
}

function requireBytes(content: string | Uint8Array): Uint8Array {
  if (typeof content === "string")
    throw new Error("BAM tracks require decompressed binary input.");
  return content;
}
