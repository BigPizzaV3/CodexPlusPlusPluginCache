import { SEQUENCE_VIEWER_LIMITS, utf8ByteLength } from "../runtime-contract";
import { resolveViewerTarget } from "../target-resolution";
import type {
  ChromatogramBase,
  SequenceChromatogram,
  SequenceDocument,
  SequenceRecord,
} from "./types";

const CHANNEL_NAMES = ["A", "C", "G", "T"] as const;
const MAX_BASES = 100;
const MAX_SAMPLES = 500;
const recordCursorIds = new WeakMap<SequenceRecord, number>();
let nextRecordCursorId = 1;

export type ChromatogramQueryRequest = {
  cursor?: string;
  end: number;
  limit?: number;
  record?: string;
  start: number;
  target: "chromatogram";
};

export type ChromatogramQuerySample = Record<ChromatogramBase, number> & {
  sample: number;
};

export type ChromatogramQueryBaseCall = {
  base: string;
  baseConfidences?: Record<ChromatogramBase, number>;
  coordinate: number;
  peakSample: number;
  quality: number | null;
};

/** Same page envelope as ViewerQueryResult, with explicitly typed trace data. */
export type ChromatogramQueryResult = {
  coordinateSystem: {
    basis: 1;
    end: "inclusive";
    orientation: "original-forward";
    referenceRecordId: string;
    sampleBasis: 0;
    sampleEnd: "inclusive";
    sampleSpace: "trace-sample";
    space: "sequence";
    strand: "+";
  };
  items: Array<ChromatogramQuerySample>;
  nextCursor: string | null;
  page: { count: number; offset: number; totalCount: number };
  result: {
    baseCalls: Array<ChromatogramQueryBaseCall>;
    baseConfidenceSemantics?: string;
    channelNames: ReadonlyArray<ChromatogramBase>;
    downsampled: false;
    end: number;
    format: SequenceChromatogram["format"];
    qualityEncoding: "phred" | "source-confidence" | null;
    qualitySemantics: string;
    recordId: string;
    sampleCount: number;
    sampleEnd: number;
    sampleStart: number;
    signalSemantics: string;
    spanSemantics: string;
    start: number;
    windowSampleCount: number;
  };
  target: "chromatogram";
  truncated: boolean;
};

/** Query the original record, never a reverse-complemented display copy. */
export function queryChromatogram({
  document,
  request,
  selectedRecordId,
}: {
  document: SequenceDocument;
  request: ChromatogramQueryRequest;
  selectedRecordId: string;
}): ChromatogramQueryResult {
  const record = resolveRecord(document, request.record ?? selectedRecordId);
  const { start, end } = request;
  if (
    !Number.isSafeInteger(start) ||
    !Number.isSafeInteger(end) ||
    start < 1 ||
    end < start ||
    end > record.length
  ) {
    throw new Error(
      `Chromatogram range must use increasing, 1-based inclusive integer coordinates within 1-${record.length}.`,
    );
  }
  if (end - start + 1 > MAX_BASES) {
    throw new Error(
      "Chromatogram queries are limited to 100 called bases. Request a smaller base window.",
    );
  }
  const limit = request.limit ?? 100;
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > MAX_SAMPLES) {
    throw new Error(
      "Chromatogram sample limit must be an integer between 1 and 500.",
    );
  }
  const trace = record.chromatogram;
  if (trace == null) {
    throw new Error(`${record.sourceLabel} has no chromatogram trace data.`);
  }
  validateTraceShape(record, trace);
  validateWindowPeaks(trace, start, end);

  // Match the plotted interval: include the rounded neighboring midpoints.
  // Adjacent base windows may overlap; pages within one window never do.
  const sampleStart =
    start === 1
      ? 0
      : Math.floor(
          (trace.peakLocations[start - 2] + trace.peakLocations[start - 1]) / 2,
        );
  const sampleEnd =
    end === record.length
      ? trace.sampleCount - 1
      : Math.ceil(
          (trace.peakLocations[end - 1] + trace.peakLocations[end]) / 2,
        );
  const totalCount = sampleEnd - sampleStart + 1;
  const cursorPrefix =
    [
      "q1.chromatogram",
      cursorRecordId(record),
      start,
      end,
      sampleStart,
      sampleEnd,
    ].join("|") + "|";
  const offset = decodeCursor(request.cursor, cursorPrefix, totalCount);
  const items: Array<ChromatogramQuerySample> = [];
  const count = Math.min(limit, totalCount - offset);
  for (let index = 0; index < count; index += 1) {
    const sample = sampleStart + offset + index;
    const values = channelValues(trace.channels, sample);
    if (CHANNEL_NAMES.some((base) => !Number.isFinite(values[base]))) {
      throw new Error(
        `Malformed chromatogram: non-finite or missing signal at sample ${sample}.`,
      );
    }
    items.push({ sample, ...values });
  }
  const result: ChromatogramQueryResult["result"] = {
    baseCalls: readBaseCalls(record, trace, start, end),
    ...(trace.baseConfidences == null
      ? {}
      : {
          baseConfidenceSemantics:
            "Original per-candidate A/C/G/T source confidence bytes, not assumed to be calibrated Phred scores.",
        }),
    channelNames: CHANNEL_NAMES,
    downsampled: false,
    end,
    format: trace.format,
    qualityEncoding:
      trace.quality == null ? null : (trace.qualityEncoding ?? null),
    qualitySemantics: qualitySemantics(trace),
    recordId: record.id,
    sampleCount: trace.sampleCount,
    sampleEnd,
    sampleStart,
    signalSemantics:
      "Exact source signal amplitudes, including negative baselines; no normalization or downsampling.",
    spanSemantics:
      "Zero-based inclusive samples from floor(previous/current peak midpoint) to ceil(current/next peak midpoint), or trace edges. Adjacent base windows may overlap.",
    start,
    windowSampleCount: totalCount,
  };
  const createPage = (pageCount: number): ChromatogramQueryResult => {
    const nextOffset = offset + pageCount;
    return {
      coordinateSystem: {
        basis: 1,
        end: "inclusive",
        orientation: "original-forward",
        referenceRecordId: record.id,
        sampleBasis: 0,
        sampleEnd: "inclusive",
        sampleSpace: "trace-sample",
        space: "sequence",
        strand: "+",
      },
      items: items.slice(0, pageCount),
      nextCursor:
        nextOffset < totalCount ? `${cursorPrefix}${nextOffset}` : null,
      page: { count: pageCount, offset, totalCount },
      result,
      target: "chromatogram",
      truncated: nextOffset < totalCount,
    };
  };
  const budget = Math.min(
    SEQUENCE_VIEWER_LIMITS.analysis.maxResultBytes,
    // complete_viewer_command returns the result inside state: { query }.
    SEQUENCE_VIEWER_LIMITS.command.maxCompletionStateBytes -
      utf8ByteLength('{"query":}'),
  );
  const requestedPage = createPage(items.length);
  if (utf8ByteLength(JSON.stringify(requestedPage)) <= budget) {
    return requestedPage;
  }
  let low = 0;
  let high = items.length - 1;
  while (low < high) {
    const candidateCount = Math.ceil((low + high) / 2);
    if (utf8ByteLength(JSON.stringify(createPage(candidateCount))) <= budget) {
      low = candidateCount;
    } else {
      high = candidateCount - 1;
    }
  }
  if (low === 0) {
    throw new Error(
      "The next chromatogram page exceeds the bounded installed-host completion budget. Request a smaller base window.",
    );
  }
  return createPage(low);
}

function resolveRecord(
  document: SequenceDocument,
  selector: string,
): SequenceRecord {
  const resolution = resolveViewerTarget({
    aliases: (record) => [record.sourceLabel, record.description],
    id: (record) => record.id,
    selector,
    targets: document.records,
  });
  if (resolution.status === "resolved") return resolution.target;
  throw new Error(
    resolution.status === "ambiguous"
      ? `More than one record matched ${selector}. Use a stable record ID.`
      : `No sequence record matched ${selector}.`,
  );
}

function validateTraceShape(
  record: SequenceRecord,
  trace: SequenceChromatogram,
): void {
  if (
    record.length !== record.sequence.length ||
    !Number.isSafeInteger(trace.sampleCount) ||
    trace.sampleCount < 1 ||
    !Array.isArray(trace.peakLocations) ||
    trace.peakLocations.length !== record.length ||
    (trace.format !== "abif" && trace.format !== "scf")
  ) {
    throw new Error(
      "Malformed chromatogram: called bases, peaks, format, or sample count are inconsistent.",
    );
  }
  for (const base of CHANNEL_NAMES) {
    if (
      !Array.isArray(trace.channels?.[base]) ||
      trace.channels[base].length !== trace.sampleCount
    ) {
      throw new Error(
        `Malformed chromatogram: channel ${base} must contain exactly ${trace.sampleCount} samples.`,
      );
    }
    if (
      trace.baseConfidences != null &&
      (!Array.isArray(trace.baseConfidences[base]) ||
        trace.baseConfidences[base].length !== record.length)
    ) {
      throw new Error(
        `Malformed chromatogram: ${base} confidence values must align with called bases.`,
      );
    }
  }
  if (
    trace.quality != null &&
    (!Array.isArray(trace.quality) || trace.quality.length !== record.length)
  ) {
    throw new Error(
      "Malformed chromatogram: quality values must align with called bases.",
    );
  }
  if (
    trace.qualityEncoding != null &&
    trace.qualityEncoding !== "phred" &&
    trace.qualityEncoding !== "source-confidence"
  ) {
    throw new Error("Malformed chromatogram: unknown quality encoding.");
  }
}

function validateWindowPeaks(
  trace: SequenceChromatogram,
  start: number,
  end: number,
): void {
  // Validate only the bounded window and its two neighbors, not the whole trace.
  const first = Math.max(0, start - 2);
  const last = Math.min(trace.peakLocations.length - 1, end);
  for (let index = first; index <= last; index += 1) {
    const peak = trace.peakLocations[index];
    if (
      !Number.isSafeInteger(peak) ||
      peak < 0 ||
      peak >= trace.sampleCount ||
      (index > first && peak < trace.peakLocations[index - 1])
    ) {
      throw new Error(
        `Malformed chromatogram: invalid or decreasing peak for base ${index + 1}.`,
      );
    }
  }
}

function readBaseCalls(
  record: SequenceRecord,
  trace: SequenceChromatogram,
  start: number,
  end: number,
): Array<ChromatogramQueryBaseCall> {
  const calls: Array<ChromatogramQueryBaseCall> = [];
  for (let coordinate = start; coordinate <= end; coordinate += 1) {
    const index = coordinate - 1;
    const quality = trace.quality == null ? null : trace.quality[index];
    if (quality !== null && !isConfidenceByte(quality)) {
      throw new Error(
        `Malformed chromatogram: invalid quality for base ${coordinate}.`,
      );
    }
    const baseConfidences =
      trace.baseConfidences == null
        ? undefined
        : channelValues(trace.baseConfidences, index);
    if (
      baseConfidences != null &&
      CHANNEL_NAMES.some((base) => !isConfidenceByte(baseConfidences[base]))
    ) {
      throw new Error(
        `Malformed chromatogram: invalid candidate confidence for base ${coordinate}.`,
      );
    }
    calls.push({
      base: record.sequence[index],
      ...(baseConfidences == null ? {} : { baseConfidences }),
      coordinate,
      peakSample: trace.peakLocations[index],
      quality,
    });
  }
  return calls;
}

function channelValues(
  channels: Record<ChromatogramBase, Array<number>>,
  index: number,
): Record<ChromatogramBase, number> {
  return {
    A: channels.A[index],
    C: channels.C[index],
    G: channels.G[index],
    T: channels.T[index],
  };
}

function isConfidenceByte(value: number): boolean {
  return Number.isInteger(value) && value >= 0 && value <= 255;
}

function qualitySemantics(trace: SequenceChromatogram): string {
  if (trace.quality == null)
    return "No called-base confidence values were provided by the source; quality is null.";
  if (trace.qualityEncoding === "phred")
    return "Original Phred quality scores: Q = -10 log10(error probability). Null means no source value for that call.";
  if (trace.qualityEncoding === "source-confidence")
    return "Original called-base source confidence bytes, not assumed to be calibrated Phred scores. Null means no source value for that call.";
  return "Original source confidence values with unspecified encoding; no Phred or error-probability interpretation is assumed.";
}

function decodeCursor(
  cursor: string | undefined,
  prefix: string,
  totalCount: number,
): number {
  if (cursor == null) return 0;
  if (!cursor.startsWith(prefix)) {
    throw new Error(
      "Chromatogram cursor is invalid for this record and base window.",
    );
  }
  const suffix = cursor.slice(prefix.length);
  const offset = Number(suffix);
  if (
    !/^(0|[1-9]\d*)$/u.test(suffix) ||
    !Number.isSafeInteger(offset) ||
    offset >= totalCount
  ) {
    throw new Error(
      "Chromatogram cursor contains an invalid or out-of-range sample offset.",
    );
  }
  return offset;
}

function cursorRecordId(record: SequenceRecord): number {
  // Scope to the mounted record instance without embedding long source IDs.
  // Rematerializing a record invalidates its old cursors; the WeakMap does not
  // keep closed or replaced source records alive.
  const existing = recordCursorIds.get(record);
  if (existing != null) return existing;
  const id = nextRecordCursorId++;
  recordCursorIds.set(record, id);
  return id;
}
