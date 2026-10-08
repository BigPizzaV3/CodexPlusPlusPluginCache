import { describe, expect, it } from "vitest";

import {
  getVisibleSequenceLineWindow,
  getVisibleSequenceWindow,
} from "./virtualization";

describe("getVisibleSequenceWindow", () => {
  it("keeps sequence rendering bounded to the visible slice plus overscan", () => {
    expect(
      getVisibleSequenceWindow({
        cellWidth: 10,
        scrollLeft: 200,
        sequenceLength: 10_000,
        viewportWidth: 100,
      }),
    ).toEqual({ end: 42, start: 8 });
  });

  it("keeps wrapped sequence rendering bounded to visible lines plus overscan", () => {
    expect(
      getVisibleSequenceLineWindow({
        lineCount: 10_000,
        lineHeight: 80,
        scrollTop: 800,
        viewportHeight: 240,
      }),
    ).toEqual({ end: 16, start: 7 });
  });
});
