import { describe, expect, it } from "vitest";

import {
  buildUpgmaGuideTree,
  calculatePDistance,
  MAX_GUIDE_TREE_COLUMNS,
  MAX_GUIDE_TREE_ROWS,
} from "./guide-tree";
import type { MsaSequenceRow } from "./types";

describe("alignment guide tree", () => {
  it("calculates p-distance while ignoring all-gap columns", () => {
    expect(calculatePDistance("AC-G", "AT-G")).toBeCloseTo(1 / 3);
  });

  it("builds a deterministic UPGMA Newick tree", () => {
    const rows = [
      row("a", "AAAA"),
      row("b", "AAAT"),
      row("c", "TTTT"),
    ];
    const tree = buildUpgmaGuideTree(rows);

    expect(tree).toContain("'a':0.125");
    expect(tree).toContain("'b':0.125");
    expect(tree.endsWith(";")).toBe(true);
  });

  it("escapes Newick labels and enforces interactive calculation limits", () => {
    expect(buildUpgmaGuideTree([row("patient's-sequence", "AAAA")])).toBe(
      "'patient''s-sequence';",
    );
    expect(() =>
      buildUpgmaGuideTree(
        Array.from({ length: MAX_GUIDE_TREE_ROWS + 1 }, (_, index) =>
          row(`row-${index}`, "AAAA"),
        ),
      ),
    ).toThrow(`${MAX_GUIDE_TREE_ROWS} rows`);
    expect(() =>
      buildUpgmaGuideTree([
        row("too-wide", "A".repeat(MAX_GUIDE_TREE_COLUMNS + 1)),
      ]),
    ).toThrow("10,000 alignment columns");
  });
});

function row(label: string, alignedSequence: string): MsaSequenceRow {
  return {
    alignedSequence,
    description: undefined,
    hidden: false,
    id: label,
    label,
    metadata: {},
    ungappedLength: alignedSequence.replaceAll("-", "").length,
  };
}
