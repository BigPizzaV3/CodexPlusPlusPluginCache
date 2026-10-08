import { describe, expect, it } from "vitest";

import { parseSequenceDocument } from "./parser";
import {
  createOriginSpanningSelection,
  extractSelectedSequence,
  getSelectionLength,
  selectionContainsCoordinate,
  summarizeSelectedQuality,
} from "./selection";

describe("sequence selections", () => {
  it("preserves an origin-spanning circular range as two ordered segments", () => {
    const document = parseSequenceDocument({
      contents: `LOCUS       CIRCLE      12 bp    DNA     circular\nACCESSION   CIRCLE\nORIGIN\n        1 aaaaccccgggg\n//`,
      fileName: "circle.gb",
    });
    const record = document.records[0]!;
    const selection = createOriginSpanningSelection({
      end: 3,
      record,
      start: 10,
    });

    expect(selection.segments).toEqual([
      { end: 12, start: 10 },
      { end: 3, start: 1 },
    ]);
    expect(getSelectionLength(selection)).toBe(6);
    expect(extractSelectedSequence(record, selection)).toBe("GGGAAA");
    expect(selectionContainsCoordinate(selection, 11)).toBe(true);
    expect(selectionContainsCoordinate(selection, 5)).toBe(false);
  });

  it("rejects wraparound semantics for linear records or forward ranges", () => {
    const linear = parseSequenceDocument({
      contents: ">linear\nACGT\n",
      fileName: "linear.fa",
    }).records[0]!;
    expect(() =>
      createOriginSpanningSelection({ end: 1, record: linear, start: 4 }),
    ).toThrow("circular");
    expect(() =>
      createOriginSpanningSelection({
        end: 4,
        record: { ...linear, topology: "circular" },
        start: 1,
      }),
    ).toThrow("must start after it ends");
  });

  it("summarizes quality across both sides of the origin", () => {
    const record = parseSequenceDocument({
      contents: "@read\nACGTACGT\n+\n!\"#$IJKL\n",
      fileName: "read.fastq",
    }).records[0]!;
    const selection = {
      end: 2,
      recordId: record.id,
      segments: [
        { end: 8, start: 7 },
        { end: 2, start: 1 },
      ],
      start: 7,
    };
    expect(summarizeSelectedQuality(record, selection)).toEqual({
      max: 43,
      mean: 21.5,
      min: 0,
    });
  });
});
