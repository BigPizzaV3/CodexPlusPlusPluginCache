import { describe, expect, it } from "vitest";

import {
  buildSequenceLines,
  formatSequenceLineGroups,
  getSequenceLineDisplayOffsetCh,
  getSequenceLineDisplayWidthCh,
  getSequenceLineForCoordinate,
} from "./sequence-line-layout";

describe("sequence line layout", () => {
  it("builds 1-based wrapped sequence lines", () => {
    expect(buildSequenceLines({ lineWidth: 10, sequenceLength: 25 })).toEqual([
      { end: 10, index: 0, start: 1 },
      { end: 20, index: 1, start: 11 },
      { end: 25, index: 2, start: 21 },
    ]);
  });

  it("groups displayed residues every ten positions", () => {
    expect(formatSequenceLineGroups("ACGTACGTACGG")).toEqual([
      "ACGTACGTAC",
      "GG",
    ]);
  });

  it("maps coordinates back to wrapped line indexes", () => {
    expect(
      getSequenceLineForCoordinate({ coordinate: 61, lineWidth: 60 }),
    ).toBe(1);
  });

  it("keeps overlays aligned with ten-residue sequence grouping gaps", () => {
    expect(
      getSequenceLineDisplayOffsetCh({ coordinate: 1, lineStart: 1 }),
    ).toBe(0);
    expect(
      getSequenceLineDisplayOffsetCh({ coordinate: 11, lineStart: 1 }),
    ).toBe(16);
    expect(
      getSequenceLineDisplayWidthCh({ end: 12, lineStart: 1, start: 9 }),
    ).toBe(7);
    expect(
      getSequenceLineDisplayWidthCh({ end: 60, lineStart: 1, start: 1 }),
    ).toBe(95);
  });
});
