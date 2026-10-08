import { describe, expect, it } from "vitest";

import {
  buildGuideTree,
  collectLeafRowIds,
  findTreeNode,
} from "./phylogenetic-tree";
import type { MsaSequenceRow } from "./types";

const rows: Array<MsaSequenceRow> = [
  row("a", "alpha", "AAAA"),
  row("b", "beta", "AAAT"),
  row("c", "gamma", "TTTT"),
  row("d", "delta", "TTTA"),
];

describe("graphical guide-tree model", () => {
  it.each(["neighbor-joining", "upgma"] as const)(
    "builds deterministic %s trees with synchronized row order",
    (algorithm) => {
      const tree = buildGuideTree(rows, algorithm);

      expect(tree.algorithm).toBe(algorithm);
      expect(tree.newick.endsWith(";")).toBe(true);
      expect(tree.rowOrder).toEqual(collectLeafRowIds(tree.root));
      expect(new Set(tree.rowOrder)).toEqual(new Set(["a", "b", "c", "d"]));
      expect(tree.warning).toContain("Exploratory");
    },
  );

  it("clusters the closest pairs in the deterministic UPGMA topology", () => {
    const tree = buildGuideTree(rows, "upgma");
    expect(tree.newick).toMatch(/\('alpha':0\.125,'beta':0\.125\)/u);
    expect(tree.newick).toMatch(/\('delta':0\.125,'gamma':0\.125\)|\('gamma':0\.125,'delta':0\.125\)/u);
  });

  it("resolves leaves by node ID, row ID, or source label", () => {
    const tree = buildGuideTree(rows);
    expect(findTreeNode(tree.root, "b")?.label).toBe("beta");
    expect(findTreeNode(tree.root, "gamma")?.rowId).toBe("c");
    expect(findTreeNode(tree.root, "missing")).toBeNull();
  });
});

function row(id: string, label: string, alignedSequence: string): MsaSequenceRow {
  return {
    alignedSequence,
    id,
    label,
    ungappedLength: alignedSequence.replaceAll(/[-.]/gu, "").length,
  };
}
