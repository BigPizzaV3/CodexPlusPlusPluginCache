import { describe, expect, it } from "vitest";

import { parseMsa } from "./parser";
import {
  applyAlignmentEditRequest,
  realignRows,
  runAlignmentAnalysis,
} from "./workbench-controller";

describe("alignment workbench controller", () => {
  it("builds graphical-tree data and a symmetric distance matrix", () => {
    const document = fixture();
    const treeResult = runAlignmentAnalysis({
      document,
      request: { algorithm: "neighbor-joining", analysis: "build-tree" },
    });
    expect(treeResult.tree).toMatchObject({
      algorithm: "neighbor-joining",
      distance: "uncorrected-p-distance",
    });

    const distances = runAlignmentAnalysis({
      document,
      request: { analysis: "distance-matrix" },
    });
    expect(distances.matrix).toEqual([
      [0, expect.any(Number), expect.any(Number)],
      [expect.any(Number), 0, expect.any(Number)],
      [expect.any(Number), expect.any(Number), 0],
    ]);
  });

  it("applies alignment edits without mutating the source document", () => {
    const document = fixture();
    const result = applyAlignmentEditRequest({
      document,
      request: {
        end: 4,
        operation: "remove-alignment-columns",
        start: 3,
      },
      tree: null,
    });
    expect("document" in result && result.document.alignedLength).toBe(6);
    expect(document.alignedLength).toBe(8);
  });

  it("realigns a selected derived copy and invalidates stale tracks", () => {
    const document = fixture();
    const result = realignRows({
      document,
      rowIds: document.rows.slice(0, 2).map(({ id }) => id),
    });
    expect(result.document.rows).toHaveLength(2);
    expect(result.document.annotations).toEqual([]);
    expect(result.document.warnings.at(-1)?.code).toBe("realigned-copy");
    expect(document.rows).toHaveLength(3);
  });

  it("requires a tree before tree-order sorting", () => {
    expect(() =>
      applyAlignmentEditRequest({
        document: fixture(),
        request: { mode: "tree", operation: "sort-alignment-rows" },
        tree: null,
      }),
    ).toThrow("guide tree");
  });

  it("groups exact rows and preserves their metadata through realignment", () => {
    const document = fixture();
    const selected = document.rows.slice(0, 2).map(({ id }) => id);
    const grouped = applyAlignmentEditRequest({
      document,
      request: {
        group: "responders",
        operation: "assign-alignment-row-group",
        rowIds: selected,
      },
      tree: null,
    });
    if (!("document" in grouped)) throw new Error("Expected a document edit.");
    const realigned = realignRows({ document: grouped.document, rowIds: selected });
    expect(
      realigned.document.rows.map(
        ({ metadata }) => metadata?.sequenceViewerGroup,
      ),
    ).toEqual(["responders", "responders"]);
  });
});

function fixture() {
  const parsed = parseMsa(
    ">alpha\nACGTACGT\n>beta\nACG-ACGT\n>gamma\nATGTAC-T\n",
    "workbench.aln.fasta",
  );
  if (parsed.status !== "success") throw new Error(parsed.message);
  return parsed.document;
}
