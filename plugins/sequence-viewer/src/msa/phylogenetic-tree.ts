import {
  MAX_GUIDE_TREE_COLUMNS,
  MAX_GUIDE_TREE_ROWS,
  calculatePDistance,
} from "./guide-tree";
import type { MsaSequenceRow } from "./types";

export type GuideTreeAlgorithm = "neighbor-joining" | "upgma";

export type GuideTreeNode = {
  branchLength: number;
  children: Array<GuideTreeNode>;
  id: string;
  label?: string;
  rowId?: string;
};

export type GuideTreeResult = {
  algorithm: GuideTreeAlgorithm;
  distance: "uncorrected-p-distance";
  newick: string;
  root: GuideTreeNode;
  rowOrder: Array<string>;
  rowSetKey: string;
  warning: string;
};

type TreeCluster = {
  height: number;
  id: string;
  node: GuideTreeNode;
  size: number;
};

export function buildGuideTree(
  rows: Array<MsaSequenceRow>,
  algorithm: GuideTreeAlgorithm = "neighbor-joining",
): GuideTreeResult {
  assertTreeBudget(rows);
  const root =
    algorithm === "neighbor-joining"
      ? buildNeighborJoiningTree(rows)
      : buildUpgmaTree(rows);
  return {
    algorithm,
    distance: "uncorrected-p-distance",
    newick: `${serializeNode(root, true)};`,
    root,
    rowOrder: collectLeafRowIds(root),
    rowSetKey: rows.map(({ id }) => id).join("\u001f"),
    warning:
      "Exploratory guide tree only. Use a dedicated phylogenetics workflow with an explicit substitution model and support assessment for publication-grade inference.",
  };
}

export function collectLeafRowIds(node: GuideTreeNode): Array<string> {
  if (node.rowId != null) return [node.rowId];
  return node.children.flatMap(collectLeafRowIds);
}

export function findTreeNode(
  root: GuideTreeNode,
  id: string,
): GuideTreeNode | null {
  if (root.id === id || root.rowId === id || root.label === id) return root;
  for (const child of root.children) {
    const match = findTreeNode(child, id);
    if (match != null) return match;
  }
  return null;
}

export function isGuideTreeResult(value: unknown): value is GuideTreeResult {
  if (value == null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const candidate = value as Partial<GuideTreeResult>;
  if (
    (candidate.algorithm !== "neighbor-joining" &&
      candidate.algorithm !== "upgma") ||
    candidate.distance !== "uncorrected-p-distance" ||
    typeof candidate.newick !== "string" ||
    candidate.newick.length > 1_000_000 ||
    !Array.isArray(candidate.rowOrder) ||
    candidate.rowOrder.length > MAX_GUIDE_TREE_ROWS ||
    !candidate.rowOrder.every((id) => typeof id === "string") ||
    typeof candidate.rowSetKey !== "string" ||
    typeof candidate.warning !== "string"
  ) {
    return false;
  }
  let remaining = MAX_GUIDE_TREE_ROWS * 2;
  const visit = (node: unknown): boolean => {
    if (
      remaining <= 0 ||
      node == null ||
      typeof node !== "object" ||
      Array.isArray(node)
    ) {
      return false;
    }
    remaining -= 1;
    const item = node as Partial<GuideTreeNode>;
    return (
      typeof item.id === "string" &&
      item.id.length <= 2_000 &&
      typeof item.branchLength === "number" &&
      Number.isFinite(item.branchLength) &&
      item.branchLength >= 0 &&
      (item.label == null ||
        (typeof item.label === "string" && item.label.length <= 2_000)) &&
      (item.rowId == null ||
        (typeof item.rowId === "string" && item.rowId.length <= 2_000)) &&
      Array.isArray(item.children) &&
      item.children.length <= MAX_GUIDE_TREE_ROWS &&
      item.children.every(visit)
    );
  };
  return visit(candidate.root);
}

function buildUpgmaTree(rows: Array<MsaSequenceRow>): GuideTreeNode {
  const clusters = new Map<string, TreeCluster>();
  const distances = initialDistances(rows);
  rows.forEach((row, index) => {
    const id = `leaf-${index}`;
    clusters.set(id, {
      height: 0,
      id,
      node: leaf(row, id),
      size: 1,
    });
  });
  let mergeIndex = 0;
  while (clusters.size > 1) {
    const pair = closestPair([...clusters.keys()], distances);
    if (pair == null) throw new Error("The guide tree could not be completed.");
    const left = clusters.get(pair.leftId);
    const right = clusters.get(pair.rightId);
    if (left == null || right == null) throw new Error("The guide-tree cluster state was inconsistent.");
    const height = pair.distance / 2;
    const id = `upgma-${mergeIndex}`;
    mergeIndex += 1;
    const merged: TreeCluster = {
      height,
      id,
      node: {
        branchLength: 0,
        children: [
          { ...left.node, branchLength: Math.max(0, height - left.height) },
          { ...right.node, branchLength: Math.max(0, height - right.height) },
        ],
        id,
      },
      size: left.size + right.size,
    };
    for (const other of clusters.values()) {
      if (other.id === left.id || other.id === right.id) continue;
      const leftDistance = getDistance(distances, left.id, other.id);
      const rightDistance = getDistance(distances, right.id, other.id);
      setDistance(
        distances,
        merged.id,
        other.id,
        (leftDistance * left.size + rightDistance * right.size) / merged.size,
      );
    }
    clusters.delete(left.id);
    clusters.delete(right.id);
    clusters.set(merged.id, merged);
  }
  return [...clusters.values()][0]?.node ?? leaf(rows[0] as MsaSequenceRow, "leaf-0");
}

function buildNeighborJoiningTree(rows: Array<MsaSequenceRow>): GuideTreeNode {
  if (rows.length === 1) return leaf(rows[0] as MsaSequenceRow, "leaf-0");
  const nodes = new Map<string, GuideTreeNode>();
  const distances = initialDistances(rows);
  rows.forEach((row, index) => nodes.set(`leaf-${index}`, leaf(row, `leaf-${index}`)));
  let mergeIndex = 0;
  while (nodes.size > 2) {
    const ids = [...nodes.keys()].sort();
    const totals = new Map(
      ids.map((id) => [
        id,
        ids.reduce(
          (sum, otherId) =>
            id === otherId ? sum : sum + getDistance(distances, id, otherId),
          0,
        ),
      ]),
    );
    let selected: { leftId: string; rightId: string; q: number } | null = null;
    for (let leftIndex = 0; leftIndex < ids.length; leftIndex += 1) {
      for (let rightIndex = leftIndex + 1; rightIndex < ids.length; rightIndex += 1) {
        const leftId = ids[leftIndex];
        const rightId = ids[rightIndex];
        if (leftId == null || rightId == null) continue;
        const q =
          (ids.length - 2) * getDistance(distances, leftId, rightId) -
          (totals.get(leftId) ?? 0) -
          (totals.get(rightId) ?? 0);
        if (selected == null || q < selected.q) selected = { leftId, q, rightId };
      }
    }
    if (selected == null) throw new Error("The neighbor-joining tree could not be completed.");
    const distance = getDistance(distances, selected.leftId, selected.rightId);
    const denominator = 2 * (ids.length - 2);
    const leftLength = Math.max(
      0,
      distance / 2 +
        ((totals.get(selected.leftId) ?? 0) -
          (totals.get(selected.rightId) ?? 0)) /
          denominator,
    );
    const rightLength = Math.max(0, distance - leftLength);
    const left = nodes.get(selected.leftId);
    const right = nodes.get(selected.rightId);
    if (left == null || right == null) throw new Error("The neighbor-joining node state was inconsistent.");
    const mergedId = `nj-${mergeIndex}`;
    mergeIndex += 1;
    const merged: GuideTreeNode = {
      branchLength: 0,
      children: [
        { ...left, branchLength: leftLength },
        { ...right, branchLength: rightLength },
      ],
      id: mergedId,
    };
    for (const otherId of ids) {
      if (otherId === selected.leftId || otherId === selected.rightId) continue;
      setDistance(
        distances,
        mergedId,
        otherId,
        Math.max(
          0,
          (getDistance(distances, selected.leftId, otherId) +
            getDistance(distances, selected.rightId, otherId) -
            distance) /
            2,
        ),
      );
    }
    nodes.delete(selected.leftId);
    nodes.delete(selected.rightId);
    nodes.set(mergedId, merged);
  }
  const [leftId, rightId] = [...nodes.keys()].sort();
  const left = leftId == null ? null : nodes.get(leftId);
  const right = rightId == null ? null : nodes.get(rightId);
  if (left == null || right == null || leftId == null || rightId == null) throw new Error("The neighbor-joining root could not be completed.");
  const distance = getDistance(distances, leftId, rightId);
  return {
    branchLength: 0,
    children: [
      { ...left, branchLength: Math.max(0, distance / 2) },
      { ...right, branchLength: Math.max(0, distance / 2) },
    ],
    id: "nj-root",
  };
}

function initialDistances(rows: Array<MsaSequenceRow>): Map<string, number> {
  const distances = new Map<string, number>();
  for (let leftIndex = 0; leftIndex < rows.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < rows.length; rightIndex += 1) {
      setDistance(
        distances,
        `leaf-${leftIndex}`,
        `leaf-${rightIndex}`,
        calculatePDistance(
          rows[leftIndex]?.alignedSequence ?? "",
          rows[rightIndex]?.alignedSequence ?? "",
        ),
      );
    }
  }
  return distances;
}

function closestPair(ids: Array<string>, distances: Map<string, number>) {
  let selected: { distance: number; leftId: string; rightId: string } | null = null;
  const sorted = [...ids].sort();
  for (let leftIndex = 0; leftIndex < sorted.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < sorted.length; rightIndex += 1) {
      const leftId = sorted[leftIndex];
      const rightId = sorted[rightIndex];
      if (leftId == null || rightId == null) continue;
      const distance = getDistance(distances, leftId, rightId);
      if (selected == null || distance < selected.distance) selected = { distance, leftId, rightId };
    }
  }
  return selected;
}

function distanceKey(leftId: string, rightId: string): string {
  return [leftId, rightId].sort().join("::");
}

function getDistance(distances: Map<string, number>, leftId: string, rightId: string): number {
  if (leftId === rightId) return 0;
  const value = distances.get(distanceKey(leftId, rightId));
  if (value == null) throw new Error(`Missing guide-tree distance for ${leftId} and ${rightId}.`);
  return value;
}

function setDistance(distances: Map<string, number>, leftId: string, rightId: string, value: number): void {
  distances.set(distanceKey(leftId, rightId), value);
}

function leaf(row: MsaSequenceRow, id: string): GuideTreeNode {
  return { branchLength: 0, children: [], id, label: row.label, rowId: row.id };
}

function serializeNode(node: GuideTreeNode, root: boolean): string {
  const body =
    node.children.length === 0
      ? formatNewickLabel(node.label ?? node.rowId ?? node.id)
      : `(${node.children.map((child) => serializeNode(child, false)).join(",")})`;
  return root ? body : `${body}:${formatBranchLength(node.branchLength)}`;
}

function formatNewickLabel(label: string): string {
  return `'${label.replaceAll("'", "''")}'`;
}

function formatBranchLength(value: number): string {
  return Math.max(0, value).toFixed(6).replace(/0+$/u, "").replace(/\.$/u, "") || "0";
}

function assertTreeBudget(rows: Array<MsaSequenceRow>): void {
  if (rows.length === 0) throw new Error("At least one alignment row is required.");
  if (rows.length > MAX_GUIDE_TREE_ROWS) throw new Error(`Guide-tree calculation is limited to ${MAX_GUIDE_TREE_ROWS} rows in the interactive viewer.`);
  const alignedLength = rows[0]?.alignedSequence.length ?? 0;
  if (alignedLength > MAX_GUIDE_TREE_COLUMNS) throw new Error(`Guide-tree calculation is limited to ${MAX_GUIDE_TREE_COLUMNS.toLocaleString()} alignment columns in the interactive viewer.`);
}
