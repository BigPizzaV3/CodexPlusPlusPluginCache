import { describe, expect, it } from "vitest";

import { runMsaPerformanceBenchmark } from "./performance";

describe("runMsaPerformanceBenchmark", () => {
  it("reports parse, analysis, search, and bounded virtual mount metrics", async () => {
    const report = await runMsaPerformanceBenchmark({
      contents: [">a", "AAGT", ">b", "ACGT", ">c", "A-GT"].join("\n"),
      filePath: "/tmp/bench.afa",
      motifQuery: "ACT",
    });

    expect(report.rowCount).toBe(3);
    expect(report.alignedLength).toBe(4);
    expect(report.parseMs).toBeGreaterThanOrEqual(0);
    expect(report.analysisMs).toBeGreaterThanOrEqual(0);
    expect(report.searchMs).toBeGreaterThanOrEqual(0);
    expect(report.motifHitCount).toBeGreaterThan(0);
    expect(report.mountedRowCount).toBeLessThanOrEqual(report.rowCount);
    expect(report.mountedCellCount).toBeGreaterThan(0);
  });
});
