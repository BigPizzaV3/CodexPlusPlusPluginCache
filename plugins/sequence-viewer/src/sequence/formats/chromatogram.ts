import { parseScientificScfHeader } from "@openai/scientific-viewer-platform/sequence/scientific-sequence-consequential-formats";

import { biologicalFileBasename } from "../../compressed-file-name";
import { SEQUENCE_VIEWER_LIMITS } from "../../runtime-contract";
import type {
  ChromatogramBase,
  SequenceChromatogram,
  SequenceParseWarning,
  SequenceRecord,
} from "../types";

// Independently implemented from the ABIF layout and SCF specifications:
// https://github.com/biopython/biopython/blob/master/Bio/SeqIO/AbiIO.py
// https://archive.gfjc.fiu.edu/workshops/resources/articles/ABIF_File_Format.pdf
// https://staden.sourceforge.net/manual/formats_unix_3.html (header)
// https://staden.sourceforge.net/manual/formats_unix_4.html (signal encoding)
// https://staden.sourceforge.net/manual/formats_unix_5.html (called bases)

// Trace arrays are fully decoded, so bound them independently of source bytes.
export const CHROMATOGRAM_LIMITS = Object.freeze({
  maxBaseCalls: 200_000,
  maxDirectoryEntries: 10_000,
  maxSamples: 500_000,
  maxSourceBytes: SEQUENCE_VIEWER_LIMITS.session.maxArtifactBytes,
});

const BASES = ["A", "C", "G", "T"] as const;
const textDecoder = new TextDecoder("utf-8", { fatal: true });

type ParsedChromatogram = {
  record: SequenceRecord;
  warnings: Array<SequenceParseWarning>;
};

type AbifEntry = {
  count: number;
  dataOffset: number;
  dataSize: number;
  elementSize: number;
  elementType: number;
  key: string;
};

/** ABIF 1.01: PBAS/PLOC/PCON are matched by revision, DATA9–12 by FWO_1. */
export function parseAbifRecord({
  bytes,
  fileName,
}: {
  bytes: Uint8Array;
  fileName?: string;
}): ParsedChromatogram {
  assertSourceBudget(bytes);
  requireRange(bytes, 0, 128, "ABIF header");
  if (ascii(bytes, 0, 4) !== "ABIF") throw new Error("Invalid ABIF signature.");
  const view = dataView(bytes);
  const version = view.getUint16(4, false);
  if (version !== 101) {
    throw new Error(
      "Unsupported ABIF version. This viewer decodes ABIF 1.01 only.",
    );
  }
  const root = readAbifEntry(bytes, 6, true);
  if (
    root.elementType !== 1023 ||
    root.elementSize !== 28 ||
    root.count === 0 ||
    root.count > CHROMATOGRAM_LIMITS.maxDirectoryEntries ||
    root.dataSize > CHROMATOGRAM_LIMITS.maxDirectoryEntries * 28 ||
    root.dataSize % 28 !== 0 ||
    root.dataOffset < 128
  ) {
    throw new Error("Invalid or oversized ABIF root directory.");
  }
  const entries = new Map<string, AbifEntry>();
  for (let index = 0; index < root.count; index += 1) {
    const entryOffset = root.dataOffset + index * 28;
    const entry = readAbifEntry(bytes, entryOffset);
    if (entries.has(entry.key))
      throw new Error("Duplicate ABIF directory tag.");
    if (
      entry.dataSize > 4 &&
      (entry.dataOffset < 128 ||
        overlaps(
          entry.dataOffset,
          entry.dataSize,
          root.dataOffset,
          root.dataSize,
        ))
    ) {
      throw new Error("ABIF payload overlaps the header or directory.");
    }
    entries.set(entry.key, entry);
  }
  const warnings: Array<SequenceParseWarning> = [];
  const revision = entries.has("PBAS2") && entries.has("PLOC2") ? 2 : 1;
  const basesEntry = requireEntry(entries, `PBAS${revision}`);
  const peaksEntry = requireEntry(entries, `PLOC${revision}`);
  const called = readAbifCharacters(bytes, basesEntry).toUpperCase();
  validateCalledBases(called);
  if (revision === 1) {
    warnings.push(
      warning(
        "abif-edited-calls",
        "Displaying the source's edited PBAS1/PLOC1 base calls; unedited basecaller calls were unavailable.",
      ),
    );
  } else if (entries.has("PBAS1")) {
    warnings.push(
      warning(
        "abif-basecaller-calls",
        "Displaying the unedited PBAS2/PLOC2 basecaller calls. The separate edited-call revision is not applied.",
        "info",
      ),
    );
  }
  const reverseFlag = entries.get("RevC1");
  if (reverseFlag != null && readAbifIntegers(bytes, reverseFlag)[0] !== 0) {
    throw new Error(
      "Reverse-complemented ABIF source traces are not supported; export the original-orientation trace.",
    );
  }
  const order = readAbifCharacters(bytes, requireEntry(entries, "FWO_1"));
  if (order.length !== 4 || BASES.some((base) => !order.includes(base))) {
    throw new Error(
      "ABIF FWO_1 must identify each of the four A/C/G/T trace channels exactly once.",
    );
  }
  const channels: SequenceChromatogram["channels"] = {
    A: [],
    C: [],
    G: [],
    T: [],
  };
  for (const base of BASES) {
    const entry = requireEntry(entries, `DATA${9 + order.indexOf(base)}`);
    if (
      entry.count === 0 ||
      entry.count > CHROMATOGRAM_LIMITS.maxSamples ||
      entry.elementSize !== 2 ||
      (entry.elementType !== 3 && entry.elementType !== 4)
    ) {
      throw new Error(
        "ABIF processed trace channels must be bounded 16-bit integer arrays.",
      );
    }
    channels[base] = readAbifIntegers(bytes, entry);
  }
  const sampleCount = channels.A.length;
  if (BASES.some((base) => channels[base].length !== sampleCount)) {
    throw new Error("ABIF trace channels have inconsistent sample counts.");
  }
  const peakLocations = readAbifIntegers(bytes, peaksEntry);
  validatePeakLocations(peakLocations, called.length, sampleCount);
  const qualityEntry = entries.get(`PCON${revision}`);
  let quality: Array<number> | undefined;
  if (qualityEntry != null) {
    if (
      qualityEntry.elementSize !== 1 ||
      ![1, 2].includes(qualityEntry.elementType)
    ) {
      throw new Error("ABIF PCON quality values must be bytes.");
    }
    quality = Array.from(
      bytes.subarray(
        qualityEntry.dataOffset,
        qualityEntry.dataOffset + qualityEntry.dataSize,
      ),
    );
    if (quality.length !== called.length) {
      throw new Error("ABIF base calls and quality counts do not match.");
    }
  } else {
    warnings.push(
      warning(
        "chromatogram-quality-absent",
        "The source omits called-base quality scores. No quality values have been inferred.",
      ),
    );
  }
  const decodedKeys = new Set([
    `PBAS${revision}`,
    `PLOC${revision}`,
    `PCON${revision}`,
    "FWO_1",
    "DATA9",
    "DATA10",
    "DATA11",
    "DATA12",
    "RevC1",
  ]);
  const undisplayedCount = [...entries.keys()].filter(
    (key) => !decodedKeys.has(key),
  ).length;
  if (undisplayedCount > 0) {
    warnings.push(
      warning(
        "abif-undisplayed-tags",
        `${undisplayedCount} additional ABIF directory tags are not interpreted by this trace view. Instrument settings, raw channels, audit data, and alternate analyses remain in the original file.`,
        "info",
      ),
    );
  }
  return {
    record: makeRecord(
      fileName,
      called,
      {
        channels,
        format: "abif",
        peakLocations,
        ...(quality == null
          ? {}
          : { quality, qualityEncoding: "phred" as const }),
        sampleCount,
      },
      {
        abif_version: "1.01",
        base_call_revision: String(revision),
        trace_channel_order: order,
        trace_source: "processed DATA9-DATA12",
        undisplayed_tag_count: String(undisplayedCount),
      },
    ),
    warnings,
  };
}

/** SCF 2.00 interleaved and 3.00 double-delta arrays, in big-endian source order. */
export function parseScfRecord({
  bytes,
  fileName,
}: {
  bytes: Uint8Array;
  fileName?: string;
}): ParsedChromatogram {
  assertSourceBudget(bytes);
  const header = parseScientificScfHeader({
    budget: { maxTraceSamples: CHROMATOGRAM_LIMITS.maxSamples },
    bytes,
    sourceSizeBytes: BigInt(bytes.byteLength),
  });
  if (header.version !== "2.00" && header.version !== "3.00") {
    throw new Error(
      "Unsupported SCF version. This viewer decodes SCF 2.00 and 3.00 only.",
    );
  }
  if (header.bases === 0 || header.bases > CHROMATOGRAM_LIMITS.maxBaseCalls) {
    throw new Error(
      "SCF base-call count is empty or exceeds the bounded trace limit.",
    );
  }
  const view = dataView(bytes);
  const codeSet = view.getUint32(44, false);
  if (![0, 2, 3, 4].includes(codeSet)) {
    throw new Error(
      "Unsupported SCF base code set. Export an IUPAC-coded SCF file.",
    );
  }
  const sections = [
    { offset: 0, size: 128 },
    {
      offset: Number(header.samplesOffset),
      size: header.samples * 4 * header.sampleSize,
    },
    { offset: Number(header.basesOffset), size: header.bases * 12 },
    { offset: Number(header.commentsOffset), size: header.commentsSize },
    { offset: Number(header.privateOffset), size: header.privateSize },
  ].filter(({ size }) => size > 0);
  for (const [index, section] of sections.entries()) {
    if (
      sections
        .slice(index + 1)
        .some((other) =>
          overlaps(section.offset, section.size, other.offset, other.size),
        )
    ) {
      throw new Error(
        "SCF sections overlap; the source cannot be decoded safely.",
      );
    }
  }
  const channels: SequenceChromatogram["channels"] = {
    A: [],
    C: [],
    G: [],
    T: [],
  };
  const mask = header.sampleSize === 1 ? 0xff : 0xffff;
  for (const [baseIndex, base] of BASES.entries()) {
    const samples = new Array<number>(header.samples);
    let firstDifference = 0;
    let amplitude = 0;
    for (let sample = 0; sample < header.samples; sample += 1) {
      const sampleIndex =
        header.traceEncoding === "delta-delta"
          ? baseIndex * header.samples + sample
          : sample * 4 + baseIndex;
      const offset =
        Number(header.samplesOffset) + sampleIndex * header.sampleSize;
      const stored =
        header.sampleSize === 1
          ? view.getUint8(offset)
          : view.getUint16(offset, false);
      if (header.traceEncoding === "delta-delta") {
        firstDifference = (firstDifference + stored) & mask;
        amplitude = (amplitude + firstDifference) & mask;
        samples[sample] = amplitude;
      } else {
        samples[sample] = stored;
      }
    }
    channels[base] = samples;
  }
  const baseConfidences: NonNullable<SequenceChromatogram["baseConfidences"]> =
    { A: [], C: [], G: [], T: [] };
  const called: Array<string> = [];
  const peakLocations: Array<number> = [];
  const quality: Array<number | null> = [];
  const baseOffset = Number(header.basesOffset);
  for (let index = 0; index < header.bases; index += 1) {
    const interleaved = header.traceEncoding === "interleaved";
    peakLocations.push(
      view.getUint32(baseOffset + index * (interleaved ? 12 : 4), false),
    );
    const base = String.fromCharCode(
      view.getUint8(
        baseOffset + (interleaved ? index * 12 + 8 : header.bases * 8 + index),
      ),
    ).toUpperCase();
    called.push(base === "-" ? "N" : base);
    for (const [baseIndex, candidate] of BASES.entries()) {
      const offset =
        baseOffset +
        (interleaved
          ? index * 12 + 4 + baseIndex
          : header.bases * (4 + baseIndex) + index);
      baseConfidences[candidate].push(view.getUint8(offset));
    }
    quality.push(isBase(base) ? baseConfidences[base][index] : null);
  }
  const sequence = called.join("");
  validateCalledBases(sequence);
  validatePeakLocations(peakLocations, sequence.length, header.samples);
  const warnings: Array<SequenceParseWarning> = [
    warning(
      "scf-source-confidence",
      "SCF confidence bytes are shown as recorded, not assumed to be calibrated Phred scores. All four candidate-base confidences are retained; ambiguous calls have no derived called-base quality.",
      "info",
    ),
  ];
  if (header.commentsSize > 0) {
    warnings.push(
      warning(
        "scf-comments-not-interpreted",
        "SCF source comments are not interpreted by this view and remain in the original file.",
        "info",
      ),
    );
  }
  if (header.privateSize > 0) {
    warnings.push(
      warning(
        "scf-private-data-not-interpreted",
        "SCF private data are not decoded and remain in the original file.",
      ),
    );
  }
  if (header.basesLeftClip !== 0 || header.basesRightClip !== 0) {
    warnings.push(
      warning(
        "scf-clipping-not-applied",
        "Historical SCF clipping hints are retained as metadata. This view shows the complete, untrimmed called sequence.",
        "info",
      ),
    );
  }
  if (quality.some((value) => value == null)) {
    warnings.push(
      warning(
        "scf-ambiguous-calls",
        "Ambiguous calls retain their source IUPAC symbol. SCF dash no-calls are represented as N; no confidence score is invented for either.",
        "info",
      ),
    );
  }
  return {
    record: makeRecord(
      fileName,
      sequence,
      {
        baseConfidences,
        channels,
        format: "scf",
        peakLocations,
        quality,
        qualityEncoding: "source-confidence",
        sampleCount: header.samples,
      },
      {
        scf_version: header.version,
        scf_code_set: String(codeSet),
        scf_sample_bytes: String(header.sampleSize),
        scf_left_clip: String(header.basesLeftClip),
        scf_right_clip: String(header.basesRightClip),
      },
    ),
    warnings,
  };
}

function readAbifEntry(
  bytes: Uint8Array,
  offset: number,
  isRoot = false,
): AbifEntry {
  requireRange(bytes, offset, 28, "ABIF directory entry");
  const view = dataView(bytes);
  const name = ascii(bytes, offset, 4);
  // Legal tags include punctuation, e.g. the standard S/N% signal-strength tag.
  if (!/^[\x20-\x7e]{4}$/u.test(name))
    throw new Error("Invalid ABIF directory tag name.");
  const elementSize = view.getUint16(offset + 10, false);
  const elementType = view.getUint16(offset + 8, false);
  const count = view.getUint32(offset + 12, false);
  const dataSize = view.getUint32(offset + 16, false);
  // Real instrument root directories reserve unused entry slots; ordinary tag
  // payloads must still match their declared element count exactly.
  // The ABIF specification explicitly leaves element size/count undefined for
  // unsupported and user-defined types. Their opaque payload is range-checked,
  // but only interpreted integer/character types impose an element layout.
  const interpretedType = [1, 2, 3, 4, 5].includes(elementType);
  if (
    (isRoot || interpretedType) &&
    (elementSize === 0 ||
      (isRoot
        ? dataSize < count * elementSize
        : dataSize !== count * elementSize))
  ) {
    throw new Error("ABIF directory element count and data size do not match.");
  }
  const dataOffset =
    dataSize <= 4 ? offset + 20 : view.getUint32(offset + 20, false);
  requireRange(bytes, dataOffset, dataSize, "ABIF tag payload");
  return {
    count,
    dataOffset,
    dataSize,
    elementSize,
    elementType,
    key: `${name}${view.getUint32(offset + 4, false)}`,
  };
}

function requireEntry(entries: Map<string, AbifEntry>, key: string): AbifEntry {
  const entry = entries.get(key);
  if (entry == null)
    throw new Error(
      `ABIF ${key} is missing. A called, four-channel Sanger trace is required.`,
    );
  return entry;
}

function readAbifCharacters(bytes: Uint8Array, entry: AbifEntry): string {
  if (entry.elementType !== 2 || entry.elementSize !== 1) {
    throw new Error(`Unsupported ABIF character encoding in ${entry.key}.`);
  }
  if (entry.count > CHROMATOGRAM_LIMITS.maxBaseCalls) {
    throw new Error("ABIF base-call count exceeds the bounded trace limit.");
  }
  return ascii(bytes, entry.dataOffset, entry.dataSize);
}

function readAbifIntegers(bytes: Uint8Array, entry: AbifEntry): Array<number> {
  if (
    entry.count > CHROMATOGRAM_LIMITS.maxSamples ||
    !(
      (entry.elementSize === 2 && [3, 4].includes(entry.elementType)) ||
      (entry.elementSize === 4 && entry.elementType === 5)
    )
  ) {
    throw new Error(
      `Unsupported or oversized ABIF integer array in ${entry.key}.`,
    );
  }
  const view = dataView(bytes);
  return Array.from({ length: entry.count }, (_, index) => {
    const offset = entry.dataOffset + index * entry.elementSize;
    return entry.elementType === 3
      ? view.getUint16(offset, false)
      : entry.elementType === 4
        ? view.getInt16(offset, false)
        : view.getInt32(offset, false);
  });
}

function makeRecord(
  fileName: string | undefined,
  sequence: string,
  chromatogram: SequenceChromatogram,
  metadata: SequenceRecord["metadata"],
): SequenceRecord {
  const sourceLabel = biologicalFileBasename(fileName ?? "Sanger read");
  return {
    chromatogram,
    features: [],
    id: "trace-1",
    length: sequence.length,
    metadata: {
      ...metadata,
      trace_orientation: "source",
      trace_samples: String(chromatogram.sampleCount),
    },
    molecule: "dna",
    sequence,
    sourceLabel,
    topology: "linear",
  };
}

function validateCalledBases(sequence: string): void {
  if (
    sequence.length === 0 ||
    sequence.length > CHROMATOGRAM_LIMITS.maxBaseCalls ||
    !/^[ACGTRYSWKMBDHVN]+$/u.test(sequence)
  ) {
    throw new Error(
      "The trace must contain a bounded, nonempty IUPAC DNA base-call sequence.",
    );
  }
}

function validatePeakLocations(
  peaks: Array<number>,
  bases: number,
  samples: number,
): void {
  if (
    peaks.length !== bases ||
    peaks.some(
      (peak, index) =>
        !Number.isInteger(peak) ||
        peak < 0 ||
        peak >= samples ||
        (index > 0 && peak < peaks[index - 1]),
    )
  ) {
    throw new Error(
      "Trace peak locations must match the base calls and progress within the sample array.",
    );
  }
}

function assertSourceBudget(bytes: Uint8Array): void {
  if (bytes.byteLength > CHROMATOGRAM_LIMITS.maxSourceBytes) {
    throw new Error(
      "This binary source exceeds the 8 MiB bounded trace viewer limit.",
    );
  }
}

function requireRange(
  bytes: Uint8Array,
  offset: number,
  size: number,
  label: string,
): void {
  if (
    !Number.isSafeInteger(offset) ||
    !Number.isSafeInteger(size) ||
    offset < 0 ||
    size < 0 ||
    offset > bytes.byteLength - size
  ) {
    throw new Error(`${label} is truncated or outside the source file.`);
  }
}

function overlaps(
  left: number,
  leftSize: number,
  right: number,
  rightSize: number,
): boolean {
  return left < right + rightSize && right < left + leftSize;
}

function dataView(bytes: Uint8Array): DataView {
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
}

function ascii(bytes: Uint8Array, offset: number, size: number): string {
  return textDecoder.decode(bytes.subarray(offset, offset + size));
}

function isBase(value: string): value is ChromatogramBase {
  return value === "A" || value === "C" || value === "G" || value === "T";
}

function warning(
  code: string,
  message: string,
  severity: "info" | "warning" = "warning",
): SequenceParseWarning {
  return { code, message, severity };
}
