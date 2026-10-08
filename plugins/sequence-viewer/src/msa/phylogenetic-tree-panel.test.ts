import { describe, expect, it } from "vitest";

import { buildGuideTree } from "./phylogenetic-tree";
import { descendantRowIds, layoutGuideTree } from "./phylogenetic-tree-panel";

describe("graphical guide-tree layout", () => {
  const tree = buildGuideTree([
    row("a", "AAAA"),
    row("b", "AAAT"),
    row("c", "TTTT"),
  ]);

  it("lays out every node with finite synchronized coordinates", () => {
    const layout = layoutGuideTree(tree.root);
    expect(layout.leafCount).toBe(3);
    expect(layout.nodes.every(({ x, y }) => Number.isFinite(x) && Number.isFinite(y))).toBe(true);
    expect(new Set(layout.nodes.filter(({ rowId }) => rowId != null).map(({ y }) => y)).size).toBe(3);
  });

  it("selects the descendant row IDs of internal branches", () => {
    expect(descendantRowIds(tree.root, tree.root.id).sort()).toEqual(["a", "b", "c"]);
    expect(descendantRowIds(tree.root, "missing")).toEqual([]);
  });
});

function row(id: string, alignedSequence: string) {
  return { alignedSequence, id, label: id, ungappedLength: alignedSequence.length };
}
