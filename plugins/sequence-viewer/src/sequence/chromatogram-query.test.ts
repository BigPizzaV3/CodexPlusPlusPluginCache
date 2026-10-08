import { describe, expect, it } from "vitest";

import { SEQUENCE_VIEWER_LIMITS, utf8ByteLength } from "../runtime-contract";
import {
  makeSyntheticAbif,
  makeSyntheticScf,
  SYNTHETIC_TRACE_CHANNELS,
} from "./__fixtures__/chromatogram";
import {
  queryChromatogram,
  type ChromatogramQueryRequest,
} from "./chromatogram-query";
import { parseAbifRecord, parseScfRecord } from "./formats/chromatogram";
import type {
  SequenceChromatogram,
  SequenceDocument,
  SequenceRecord,
} from "./types";

describe("bounded chromatogram queries", () => {
  it("returns exact Phred calls and original source-coordinate midpoint spans", () => {
    const record = abifRecord();
    const original = structuredClone(record);
    const response = queryRecord(record, { start: 2, end: 4 });

    expect(response).toMatchObject({
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
      nextCursor: null,
      page: { count: 11, offset: 0, totalCount: 11 },
      result: {
        baseCalls: [
          { base: "C", coordinate: 2, peakSample: 5, quality: 32 },
          { base: "G", coordinate: 3, peakSample: 8, quality: 33 },
          { base: "T", coordinate: 4, peakSample: 11, quality: 34 },
        ],
        channelNames: ["A", "C", "G", "T"],
        downsampled: false,
        format: "abif",
        qualityEncoding: "phred",
        sampleCount: 16,
        sampleEnd: 13,
        sampleStart: 3,
        start: 2,
        end: 4,
        windowSampleCount: 11,
      },
      target: "chromatogram",
      truncated: false,
    });
    expect(response.items.map(({ sample }) => sample)).toEqual([
      3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13,
    ]);
    expect(response.result.qualitySemantics).toContain(
      "Q = -10 log10(error probability)",
    );
    expect(response.result.spanSemantics).toContain(
      "Adjacent base windows may overlap",
    );
    expect(record).toEqual(original);
  });

  it("preserves SCF candidate confidence bytes without calling them Phred scores", () => {
    const record = parseScfRecord({ bytes: makeSyntheticScf() }).record;
    const response = queryRecord(record);

    expect(response.result).toMatchObject({
      format: "scf",
      qualityEncoding: "source-confidence",
      sampleStart: 0,
      sampleEnd: 15,
    });
    expect(response.result.baseCalls[1]).toEqual({
      base: "C",
      baseConfidences: { A: 1, C: 32, G: 3, T: 4 },
      coordinate: 2,
      peakSample: 5,
      quality: 32,
    });
    expect(response.result.baseCalls[4]).toEqual({
      base: "N",
      baseConfidences: { A: 1, C: 2, G: 3, T: 4 },
      coordinate: 5,
      peakSample: 14,
      quality: null,
    });
    expect(response.result.qualitySemantics).toContain(
      "not assumed to be calibrated Phred",
    );
    expect(response.result.baseConfidenceSemantics).toContain(
      "per-candidate A/C/G/T",
    );
  });

  it("does not invent quality values or infer an unspecified encoding", () => {
    const missing = parseAbifRecord({
      bytes: makeSyntheticAbif({ quality: null }),
    }).record;
    const response = queryRecord(missing);
    expect(response.result.qualityEncoding).toBeNull();
    expect(
      response.result.baseCalls.every(({ quality }) => quality === null),
    ).toBe(true);
    expect(response.result.qualitySemantics).toContain(
      "No called-base confidence values",
    );

    const unlabelled = abifRecord();
    delete requireTrace(unlabelled).qualityEncoding;
    const unknown = queryRecord(unlabelled);
    expect(unknown.result.qualityEncoding).toBeNull();
    expect(unknown.result.baseCalls[0].quality).toBe(31);
    expect(unknown.result.qualitySemantics).toContain("unspecified encoding");
  });

  it("keeps signed signal amplitudes unchanged", () => {
    const channels = {
      ...SYNTHETIC_TRACE_CHANNELS,
      A: [-3, -1, ...SYNTHETIC_TRACE_CHANNELS.A.slice(2)],
    };
    const record = parseAbifRecord({
      bytes: makeSyntheticAbif({ channels }),
    }).record;
    expect(queryRecord(record, { end: 1, start: 1 }).items.slice(0, 3)).toEqual(
      [
        { sample: 0, A: -3, C: 0, G: 0, T: 0 },
        { sample: 1, A: -1, C: 0, G: 0, T: 0 },
        { sample: 2, A: 40, C: 0, G: 0, T: 0 },
      ],
    );
  });

  it("pages all four exact channels without gaps, duplicate samples, or downsampling", () => {
    const record = longTraceRecord();
    const trace = requireTrace(record);
    const first = queryRecord(record, { end: 5, limit: 500, start: 1 });
    const pages = [first];
    while (pages.at(-1)?.nextCursor != null && pages.length < 5) {
      pages.push(
        queryRecord(record, {
          cursor: pages.at(-1)?.nextCursor ?? undefined,
          end: 5,
          limit: 500,
          start: 1,
        }),
      );
    }
    expect(pages.map(({ page }) => page)).toEqual([
      { count: 500, offset: 0, totalCount: 1_205 },
      { count: 500, offset: 500, totalCount: 1_205 },
      { count: 205, offset: 1_000, totalCount: 1_205 },
    ]);
    expect(pages.map(({ truncated }) => truncated)).toEqual([
      true,
      true,
      false,
    ]);
    expect(pages.at(-1)?.nextCursor).toBeNull();
    const samples = pages.flatMap(({ items }) => items);
    expect(samples).toEqual(
      trace.channels.A.map((A, sample) => ({
        sample,
        A,
        C: trace.channels.C[sample],
        G: trace.channels.G[sample],
        T: trace.channels.T[sample],
      })),
    );
    expect(pages.every(({ result }) => result.downsampled === false)).toBe(
      true,
    );
    expect(pages[1].result.baseCalls).toEqual(first.result.baseCalls);
    expect(first.result).not.toHaveProperty("channels");
  });

  it("reads only the requested sample page rather than traversing the full trace", () => {
    const record = longTraceRecord();
    Object.defineProperty(requireTrace(record).channels.A, 10, {
      get: () => {
        throw new Error("Unrequested source sample was read.");
      },
    });
    const response = queryRecord(record, { end: 5, limit: 10, start: 1 });
    expect(response.page).toEqual({ count: 10, offset: 0, totalCount: 1_205 });
    expect(response.items.at(-1)?.sample).toBe(9);
  });

  it("accepts exactly 100 called bases and rejects a larger source window", () => {
    const channels = Array.from({ length: 304 }, () => 0);
    const record = parseAbifRecord({
      bytes: makeSyntheticAbif({
        channels: { A: channels, C: channels, G: channels, T: channels },
        peaks: Array.from({ length: 101 }, (_, index) => index * 3),
        quality: null,
        sequence: "A".repeat(101),
      }),
    }).record;
    expect(
      queryRecord(record, { start: 1, end: 100 }).result.baseCalls,
    ).toHaveLength(100);
    expect(() => queryRecord(record, { start: 1, end: 101 })).toThrow(
      "limited to 100 called bases",
    );
  });

  it.each([
    [0, 1],
    [1, 6],
    [4, 3],
    [1.5, 2],
    [Number.NaN, 2],
    [1, Number.POSITIVE_INFINITY],
  ])("rejects invalid source range %s-%s", (start, end) => {
    expect(() => queryRecord(abifRecord(), { start, end })).toThrow(
      "1-based inclusive integer coordinates",
    );
  });

  it.each([0, 501, 1.5, Number.NaN, Number.POSITIVE_INFINITY])(
    "rejects invalid sample limit %s",
    (limit) => {
      expect(() =>
        queryRecord(abifRecord(), { start: 1, end: 5, limit }),
      ).toThrow("between 1 and 500");
    },
  );

  it("resolves stable IDs and unique aliases, rejecting absent or ambiguous records", () => {
    const first = { ...abifRecord(), id: "first", sourceLabel: "shared.ab1" };
    const second = {
      ...abifRecord(),
      id: "second",
      sourceLabel: "shared.ab1",
      description: "Unique trace",
    };
    const query = (record?: string) =>
      queryChromatogram({
        document: traceDocument([first, second]),
        request: { end: 5, record, start: 1, target: "chromatogram" },
        selectedRecordId: second.id,
      });
    expect(query().result.recordId).toBe("second");
    expect(query("first").result.recordId).toBe("first");
    expect(query(" unique TRACE ").result.recordId).toBe("second");
    expect(() => query("absent")).toThrow("No sequence record matched absent");
    expect(() => query("shared.ab1")).toThrow("More than one record matched");
  });

  it("binds cursors to the record, base range, and source sample span", () => {
    const record = {
      ...abifRecord(),
      id: "trace|with.% unicode Ω".repeat(100),
    };
    const first = queryRecord(record, { end: 5, limit: 2, start: 1 });
    const cursor = first.nextCursor ?? "";
    expect(cursor.length).toBeLessThan(1_024);
    expect(
      queryRecord(record, { cursor, end: 5, limit: 2, start: 1 }).items[0]
        .sample,
    ).toBe(2);
    expect(() => queryRecord(record, { cursor, end: 5, start: 2 })).toThrow(
      "invalid for this record and base window",
    );
    expect(() =>
      queryRecord({ ...record, id: "another" }, { cursor, end: 5, start: 1 }),
    ).toThrow("invalid for this record and base window");
    expect(() =>
      queryRecord({ ...record }, { cursor, end: 5, start: 1 }),
    ).toThrow("invalid for this record and base window");
    expect(() =>
      queryRecord(record, { cursor: "q1.records.2", end: 5, start: 1 }),
    ).toThrow("invalid for this record and base window");
    expect(() => queryRecord(record, { cursor: "", end: 5, start: 1 })).toThrow(
      "invalid for this record and base window",
    );
    const partial = queryRecord(record, { end: 4, limit: 2, start: 1 });
    requireTrace(record).peakLocations[4] = 12;
    expect(() =>
      queryRecord(record, {
        cursor: partial.nextCursor ?? "",
        end: 4,
        start: 1,
      }),
    ).toThrow("invalid for this record and base window");
  });

  it.each(["", "-1", "01", "1.5", "16", "999", "9007199254740993"])(
    "rejects malformed or exhausted cursor offset %j",
    (offset) => {
      const record = abifRecord();
      const first = queryRecord(record, { end: 5, limit: 2, start: 1 });
      const cursor = (first.nextCursor ?? "").replace(/\|\d+$/u, `|${offset}`);
      expect(() => queryRecord(record, { cursor, end: 5, start: 1 })).toThrow(
        "invalid or out-of-range sample offset",
      );
    },
  );

  it("reports absent trace data without synthesizing a chromatogram", () => {
    const { chromatogram: _trace, ...record } = abifRecord();
    expect(() => queryRecord(record)).toThrow("has no chromatogram trace data");
  });

  it.each<[string, (trace: SequenceChromatogram) => void]>([
    [
      "empty samples",
      (trace) => {
        trace.sampleCount = 0;
      },
    ],
    [
      "mismatched channel",
      (trace) => {
        trace.channels.C.pop();
      },
    ],
    [
      "missing peaks",
      (trace) => {
        trace.peakLocations.pop();
      },
    ],
    [
      "decreasing peak",
      (trace) => {
        trace.peakLocations[2] = 1;
      },
    ],
    [
      "out-of-range peak",
      (trace) => {
        trace.peakLocations[4] = 16;
      },
    ],
    [
      "non-finite signal",
      (trace) => {
        trace.channels.A[3] = Number.NaN;
      },
    ],
    [
      "mismatched quality",
      (trace) => {
        trace.quality = [32];
      },
    ],
    [
      "invalid quality",
      (trace) => {
        trace.quality = [256, 32, 33, 34, 0];
      },
    ],
  ])("rejects malformed source data: %s", (_, mutate) => {
    const record = abifRecord();
    mutate(requireTrace(record));
    expect(() => queryRecord(record)).toThrow("Malformed chromatogram");
  });

  it("rejects candidate confidence arrays that are missing or have invalid bytes", () => {
    const record = parseScfRecord({ bytes: makeSyntheticScf() }).record;
    const confidences = requireTrace(record).baseConfidences;
    if (confidences == null)
      throw new Error("Fixture must contain candidate confidences.");
    confidences.A[1] = -1;
    expect(() => queryRecord(record)).toThrow(
      "invalid candidate confidence for base 2",
    );
    confidences.A.pop();
    expect(() => queryRecord(record)).toThrow(
      "confidence values must align with called bases",
    );
  });

  it("shrinks pages to the installed-host completion budget and advances by returned samples", () => {
    const record = { ...longTraceRecord(), id: "x".repeat(115_000) };
    const first = queryRecord(record, { end: 5, limit: 500, start: 1 });
    expect(first.page.count).toBeGreaterThan(0);
    expect(first.page.count).toBeLessThan(500);
    expect(first.nextCursor).toMatch(
      new RegExp(`\\|${first.page.count}$`, "u"),
    );
    expect(
      utf8ByteLength(JSON.stringify({ query: first })),
    ).toBeLessThanOrEqual(
      SEQUENCE_VIEWER_LIMITS.command.maxCompletionStateBytes,
    );
    const completionRequest = {
      arguments: {
        applied: true,
        commandId: "11111111-1111-4111-8111-111111111111",
        message: "Returned chromatogram from the live Sequence viewer.",
        sessionId: "22222222-2222-4222-8222-222222222222",
        state: { query: first },
      },
      name: "sequence.complete_viewer_command",
    };
    expect(
      utf8ByteLength(
        JSON.stringify({
          id: "sequence-viewer-completion",
          jsonrpc: "2.0",
          method: "tools/call",
          params: completionRequest,
        }),
      ),
    ).toBeLessThanOrEqual(
      SEQUENCE_VIEWER_LIMITS.command.maxCompletionRequestBytes,
    );
    const second = queryRecord(record, {
      cursor: first.nextCursor ?? undefined,
      end: 5,
      limit: 500,
      start: 1,
    });
    expect(second.items[0].sample).toBe(first.page.count);
    expect(second.page.offset).toBe(first.page.count);
  });

  it("rejects oversized metadata rather than returning an empty, stuck page", () => {
    const record = { ...abifRecord(), id: "x".repeat(130_000) };
    expect(() => queryRecord(record)).toThrow(
      "installed-host completion budget",
    );
  });
});

function abifRecord(): SequenceRecord {
  return parseAbifRecord({ bytes: makeSyntheticAbif() }).record;
}

function longTraceRecord(): SequenceRecord {
  const A = Array.from({ length: 1_205 }, (_, index) => index);
  return parseAbifRecord({
    bytes: makeSyntheticAbif({
      channels: {
        A,
        C: A.map((value) => value * 2),
        G: A.map((value) => 500 - value),
        T: A.map((value) => value % 11),
      },
      peaks: [2, 202, 602, 902, 1_202],
    }),
  }).record;
}

function requireTrace(record: SequenceRecord): SequenceChromatogram {
  if (record.chromatogram == null)
    throw new Error("Fixture must contain a chromatogram.");
  return record.chromatogram;
}

function queryRecord(
  record: SequenceRecord,
  request: Omit<ChromatogramQueryRequest, "target"> = {
    end: record.length,
    start: 1,
  },
) {
  return queryChromatogram({
    document: traceDocument([record]),
    request: { ...request, target: "chromatogram" },
    selectedRecordId: record.id,
  });
}

function traceDocument(records: Array<SequenceRecord>): SequenceDocument {
  return {
    classification: {
      alignment: null,
      confidence: "high",
      evidence: [
        "Synthetic chromatogram query fixture; not measured biological data.",
      ],
      kind: "chromatogram",
      molecule: "dna",
      suggestedViewer: "sequence",
    },
    format: records[0]?.chromatogram?.format ?? "abif",
    kind: "chromatogram",
    records,
    warnings: [],
  };
}
