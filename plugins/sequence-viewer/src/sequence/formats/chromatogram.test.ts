import { describe, expect, it } from "vitest";

import {
  makeSyntheticAbif,
  makeSyntheticScf,
  SYNTHETIC_TRACE_CHANNELS,
} from "../__fixtures__/chromatogram";
import {
  CHROMATOGRAM_LIMITS,
  parseAbifRecord,
  parseScfRecord,
} from "./chromatogram";

describe("ABIF Sanger trace decoding", () => {
  it("decodes true processed signals in declared dye order, base calls, peak offsets, and Phred bytes", () => {
    const bytes = makeSyntheticAbif();
    const original = bytes.slice();
    const { record, warnings } = parseAbifRecord({
      bytes,
      fileName: "C:\\private\\sample.ab1",
    });
    expect(record).toMatchObject({
      id: "trace-1",
      sequence: "ACGTN",
      length: 5,
      sourceLabel: "sample.ab1",
      topology: "linear",
    });
    expect(record.chromatogram).toEqual({
      channels: SYNTHETIC_TRACE_CHANNELS,
      format: "abif",
      peakLocations: [2, 5, 8, 11, 14],
      quality: [31, 32, 33, 34, 0],
      qualityEncoding: "phred",
      sampleCount: 16,
    });
    expect(record.quality).toBeUndefined();
    expect(warnings.some(({ code }) => code === "abif-undisplayed-tags")).toBe(
      true,
    );
    expect(bytes).toEqual(original);
  });

  it("supports inline directory payloads, edited-only revisions, and signed signal baselines", () => {
    const channels = {
      ...SYNTHETIC_TRACE_CHANNELS,
      A: [-3, -1, ...SYNTHETIC_TRACE_CHANNELS.A.slice(2)],
    };
    const { record, warnings } = parseAbifRecord({
      bytes: makeSyntheticAbif({
        channels,
        editedOnly: true,
        peaks: [2, 5, 8, 11],
        quality: [41, 42, 43, 44],
        sequence: "ACGT",
      }),
    });
    expect(record.chromatogram?.channels.A.slice(0, 3)).toEqual([-3, -1, 40]);
    expect(record.chromatogram?.quality).toEqual([41, 42, 43, 44]);
    expect(record.sequence).toBe("ACGT");
    expect(warnings.map(({ code }) => code)).toContain("abif-edited-calls");
  });

  it("does not invent quality values when PCON is absent", () => {
    const parsed = parseAbifRecord({
      bytes: makeSyntheticAbif({ quality: null }),
    });
    expect(parsed.record.chromatogram?.quality).toBeUndefined();
    expect(parsed.warnings.map(({ code }) => code)).toContain(
      "chromatogram-quality-absent",
    );
  });

  it("accepts reserved unused root-directory slots present in real ABI 310 and 3730 files", () => {
    const parsed = parseAbifRecord({
      bytes: makeSyntheticAbif({ directoryPaddingEntries: 5 }),
    });
    expect(parsed.record.sequence).toBe("ACGTN");
    expect(parsed.record.chromatogram?.channels).toEqual(
      SYNTHETIC_TRACE_CHANNELS,
    );
  });

  it("bounds opaque user-defined tags by their byte size without imposing undefined element metadata", () => {
    const bytes = makeSyntheticAbif();
    const view = new DataView(bytes.buffer);
    const offset = 128 + 8 * 28; // Replace the generated S/N% metadata, not a decoded trace tag.
    bytes.set(new TextEncoder().encode("USER"), offset);
    view.setUint16(offset + 8, 1024, false);
    view.setUint16(offset + 10, 1, false);
    view.setUint32(offset + 12, 1, false);
    const parsed = parseAbifRecord({ bytes });
    expect(parsed.record.chromatogram?.channels).toEqual(
      SYNTHETIC_TRACE_CHANNELS,
    );
    expect(parsed.warnings.map(({ code }) => code)).toContain(
      "abif-undisplayed-tags",
    );
    view.setUint32(offset + 20, bytes.length - 1, false);
    expect(() => parseAbifRecord({ bytes })).toThrow(/truncated|outside/u);
  });

  it.each([
    ["unsupported version", () => makeSyntheticAbif({ version: 102 })],
    ["incorrect dye order", () => makeSyntheticAbif({ order: "AAAA" })],
    ["quality length mismatch", () => makeSyntheticAbif({ quality: [31] })],
    [
      "peak outside trace",
      () => makeSyntheticAbif({ peaks: [2, 5, 8, 11, 16] }),
    ],
    ["decreasing peaks", () => makeSyntheticAbif({ peaks: [2, 5, 4, 11, 14] })],
    ["non-DNA calls", () => makeSyntheticAbif({ sequence: "ACGTX" })],
  ])("rejects %s", (_, build) => {
    expect(() => parseAbifRecord({ bytes: build() })).toThrow();
  });

  it("rejects truncated payloads, directory count bombs, and overlapping external data", () => {
    const bytes = makeSyntheticAbif();
    expect(() =>
      parseAbifRecord({ bytes: bytes.subarray(0, bytes.length - 1) }),
    ).toThrow(/truncated|outside/u);
    const oversized = bytes.slice();
    new DataView(oversized.buffer).setUint32(18, 0xffffffff, false);
    expect(() => parseAbifRecord({ bytes: oversized })).toThrow(
      /count|directory/u,
    );
    const overlapping = bytes.slice();
    new DataView(overlapping.buffer).setUint32(128 + 28 + 20, 128, false);
    expect(() => parseAbifRecord({ bytes: overlapping })).toThrow(/overlaps/u);
  });

  it("rejects unsupported reverse-complemented source flags", () => {
    const bytes = makeSyntheticAbif();
    const view = new DataView(bytes.buffer);
    const entries = view.getUint32(18, false);
    view.setInt16(128 + (entries - 1) * 28 + 20, 1, false);
    expect(() => parseAbifRecord({ bytes })).toThrow(/original-orientation/u);
  });
});

describe("SCF Sanger trace decoding", () => {
  it.each([
    ["2.00", 1],
    ["2.00", 2],
    ["3.00", 1],
    ["3.00", 2],
  ] as const)(
    "decodes SCF %s with %i-byte samples and correctly associates confidences",
    (version, sampleSize) => {
      const bytes = makeSyntheticScf({ sampleSize, version });
      const original = bytes.slice();
      const { record } = parseScfRecord({ bytes, fileName: "sample.scf" });
      expect(record.sequence).toBe("ACGTN");
      expect(record.chromatogram?.channels).toEqual(SYNTHETIC_TRACE_CHANNELS);
      expect(record.chromatogram?.peakLocations).toEqual([2, 5, 8, 11, 14]);
      expect(record.chromatogram?.quality).toEqual([31, 32, 33, 34, null]);
      expect(record.chromatogram?.qualityEncoding).toBe("source-confidence");
      expect(record.chromatogram?.baseConfidences).toEqual({
        A: [31, 1, 1, 1, 1],
        C: [2, 32, 2, 2, 2],
        G: [3, 3, 33, 3, 3],
        T: [4, 4, 4, 34, 4],
      });
      expect(bytes).toEqual(original);
    },
  );

  it.each([1, 2] as const)(
    "reconstructs wrapped double-delta arithmetic at %i-byte precision",
    (sampleSize) => {
      const mask = sampleSize === 1 ? 255 : 65535;
      const samples = [mask, 2, mask - 1, 0, 1];
      const channels = { A: samples, C: samples, G: samples, T: samples };
      const parsed = parseScfRecord({
        bytes: makeSyntheticScf({
          channels,
          peaks: [0, 1, 2, 3, 4],
          sampleSize,
        }),
      });
      expect(parsed.record.chromatogram?.channels).toEqual(channels);
    },
  );

  it("reports preserved but uninterpreted comments, private data, and historical clipping", () => {
    const bytes = makeSyntheticScf({
      comments: "Generated test comment\n",
      privateData: Uint8Array.of(1, 2, 3),
      sequence: "ACGT-",
    });
    new DataView(bytes.buffer).setUint32(16, 1, false);
    const { record, warnings } = parseScfRecord({ bytes });
    expect(record.sequence).toBe("ACGTN");
    expect(record.metadata.scf_left_clip).toBe("1");
    expect(warnings.map(({ code }) => code)).toEqual(
      expect.arrayContaining([
        "scf-comments-not-interpreted",
        "scf-private-data-not-interpreted",
        "scf-clipping-not-applied",
        "scf-ambiguous-calls",
      ]),
    );
  });

  it("rejects truncated, overlapping, oversized, incompatible, or unmappable SCF data", () => {
    const source = makeSyntheticScf();
    expect(() =>
      parseScfRecord({ bytes: source.subarray(0, source.length - 1) }),
    ).toThrow();
    for (const [offset, value] of [
      [8, 16],
      [4, CHROMATOGRAM_LIMITS.maxSamples + 1],
      [12, 0],
      [40, 4],
      [44, 9],
    ] as const) {
      const bytes = source.slice();
      new DataView(bytes.buffer).setUint32(offset, value, false);
      expect(() => parseScfRecord({ bytes })).toThrow();
    }
    const future = source.slice();
    future.set(new TextEncoder().encode("3.01"), 36);
    expect(() => parseScfRecord({ bytes: future })).toThrow(
      /Unsupported SCF version/u,
    );
    expect(() =>
      parseScfRecord({
        bytes: makeSyntheticScf({ peaks: [2, 5, 8, 11, 100] }),
      }),
    ).toThrow(/peak/u);
  });

  it("honors Uint8Array byteOffset for embedded file buffers", () => {
    const source = makeSyntheticScf();
    const padded = new Uint8Array(source.length + 16);
    padded.set(source, 7);
    expect(
      parseScfRecord({ bytes: padded.subarray(7, 7 + source.length) }).record
        .sequence,
    ).toBe("ACGTN");
  });
});
