import { describe, expect, it } from "vitest";

import { createAlignmentExportParameters } from "./alignment-export-provenance";
import { buildGuideTree } from "./phylogenetic-tree";

describe("alignment export provenance", () => {
  it("records the algorithm, distance model, row identity, and warning for Newick", () => {
    const tree = buildGuideTree(
      [row("P01116", "AAAA"), row("P01111", "AAAT"), row("P01112", "AATT")],
      "neighbor-joining",
    );

    expect(
      createAlignmentExportParameters({
        format: "newick",
        scope: "all",
        tree,
      }),
    ).toEqual({
      scope: "all",
      tree: {
        algorithm: "neighbor-joining",
        distanceModel: "uncorrected-p-distance",
        engine: "sequence-viewer-guide-tree-v1",
        rowOrder: tree.rowOrder,
        rowSetKey: "P01116\u001fP01111\u001fP01112",
        warning: expect.stringContaining("Exploratory guide tree only"),
      },
    });
  });

  it("does not claim tree provenance for non-tree exports", () => {
    expect(
      createAlignmentExportParameters({
        format: "aligned-fasta",
        scope: "visible",
        tree: null,
      }),
    ).toEqual({ scope: "visible" });
  });
});

function row(id: string, alignedSequence: string) {
  return {
    alignedSequence,
    id,
    label: id,
    sourceId: id,
    ungappedLength: alignedSequence.length,
  };
}
