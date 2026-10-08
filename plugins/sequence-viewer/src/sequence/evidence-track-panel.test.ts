import { describe, expect, it } from "vitest";

import { resolveEvidenceRange } from "./evidence-track-panel";
import { parseSequenceDocument } from "./parser";

describe("evidence track rendering", () => {
  it("bounds evidence work to 100,000 source bases and ignores selections on other records", () => {
    const record = parseSequenceDocument({
      contents: `>ref\n${"A".repeat(200_000)}\n`,
      fileName: "reference.fasta",
    }).records[0];
    if (record == null) throw new Error("Expected a reference fixture.");
    expect(
      resolveEvidenceRange({ record, viewport: { start: 101, end: 200_000 } }),
    ).toEqual({ start: 101, end: 100_100 });
    expect(
      resolveEvidenceRange({
        record,
        selection: { start: 5, end: 10, recordId: "another-record" },
        viewport: { start: 101, end: 200 },
      }),
    ).toEqual({ start: 101, end: 200 });
  });
});
