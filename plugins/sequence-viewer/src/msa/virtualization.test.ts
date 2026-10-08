import { describe, expect, it } from "vitest";

import { getMsaViewportSlice } from "./virtualization";

describe("getMsaViewportSlice", () => {
  it("bounds mounted row and column slices independently of total alignment dimensions", () => {
    const slice = getMsaViewportSlice({
      alignedLength: 25_000,
      height: 720,
      rowCount: 10_000,
      scrollLeft: 0,
      scrollTop: 0,
      staticRowCount: 2,
      width: 1280,
    });

    expect(slice.columnEnd - slice.columnStart).toBeLessThan(80);
    expect(slice.rowEnd - slice.rowStart).toBeLessThan(60);
    expect(slice.visibleColumnEnd).toBeLessThan(60);
    expect(slice.visibleRowEnd).toBeLessThan(40);
  });

  it("moves the virtual windows with horizontal and vertical scroll positions", () => {
    const slice = getMsaViewportSlice({
      alignedLength: 1_000,
      height: 400,
      rowCount: 1_000,
      scrollLeft: 25 * 300,
      scrollTop: 20 * 220,
      staticRowCount: 3,
      width: 800,
    });

    expect(slice.visibleColumnStart).toBe(300);
    expect(slice.columnStart).toBeLessThan(slice.visibleColumnStart);
    expect(slice.visibleRowStart).toBe(217);
    expect(slice.rowStart).toBeLessThan(slice.visibleRowStart);
  });
});
