import type { MsaSequenceRow } from "./types";

export const MAX_GUIDE_TREE_ROWS = 100;
export const MAX_GUIDE_TREE_COLUMNS = 10_000;

type Cluster = {
  height: number;
  id: string;
  newick: string;
  size: number;
};

export function buildUpgmaGuideTree(rows: Array<MsaSequenceRow>): string {
  if (rows.length === 0) {
    throw new Error("At least one alignment row is required.");
  }
  if (rows.length > MAX_GUIDE_TREE_ROWS) {
    throw new Error(
      `Guide-tree calculation is limited to ${MAX_GUIDE_TREE_ROWS} rows in the interactive viewer.`,
    );
  }
  const alignedLength = rows[0]?.alignedSequence.length ?? 0;
  if (alignedLength > MAX_GUIDE_TREE_COLUMNS) {
    throw new Error(
      `Guide-tree calculation is limited to ${MAX_GUIDE_TREE_COLUMNS.toLocaleString()} alignment columns in the interactive viewer.`,
    );
  }
  if (rows.length === 1) {
    return `${formatNewickLabel(rows[0]?.label ?? "sequence")};`;
  }

  const clusters = new Map<string, Cluster>();
  const distances = new Map<string, number>();
  rows.forEach((row, index) => {
    const id = `row-${index}`;
    clusters.set(id, {
      height: 0,
      id,
      newick: formatNewickLabel(row.label),
      size: 1,
    });
  });
  for (let leftIndex = 0; leftIndex < rows.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < rows.length; rightIndex += 1) {
      distances.set(
        distanceKey(`row-${leftIndex}`, `row-${rightIndex}`),
        calculatePDistance(
          rows[leftIndex]?.alignedSequence ?? "",
          rows[rightIndex]?.alignedSequence ?? "",
        ),
      );
    }
  }

  let mergeIndex = 0;
  while (clusters.size > 1) {
    const pair = findClosestPair(clusters, distances);
    if (pair == null) {
      throw new Error("The guide tree could not be completed.");
    }
    const left = clusters.get(pair.leftId);
    const right = clusters.get(pair.rightId);
    if (left == null || right == null) {
      throw new Error("The guide tree cluster state was inconsistent.");
    }
    const height = pair.distance / 2;
    const mergedId = `cluster-${mergeIndex}`;
    mergeIndex += 1;
    const merged: Cluster = {
      height,
      id: mergedId,
      newick: `(${left.newick}:${formatBranchLength(height - left.height)},${right.newick}:${formatBranchLength(height - right.height)})`,
      size: left.size + right.size,
    };
    const otherClusters = [...clusters.values()].filter(
      ({ id }) => id !== left.id && id !== right.id,
    );
    for (const other of otherClusters) {
      const leftDistance =
        distances.get(distanceKey(left.id, other.id)) ?? pair.distance;
      const rightDistance =
        distances.get(distanceKey(right.id, other.id)) ?? pair.distance;
      distances.set(
        distanceKey(merged.id, other.id),
        (leftDistance * left.size + rightDistance * right.size) /
          merged.size,
      );
    }
    clusters.delete(left.id);
    clusters.delete(right.id);
    clusters.set(merged.id, merged);
  }
  return `${[...clusters.values()][0]?.newick ?? ""};`;
}

export function calculatePDistance(left: string, right: string): number {
  const length = Math.max(left.length, right.length);
  let compared = 0;
  let differences = 0;
  for (let index = 0; index < length; index += 1) {
    const leftSymbol = left[index] ?? "-";
    const rightSymbol = right[index] ?? "-";
    if (isGap(leftSymbol) && isGap(rightSymbol)) {
      continue;
    }
    compared += 1;
    if (leftSymbol.toUpperCase() !== rightSymbol.toUpperCase()) {
      differences += 1;
    }
  }
  return compared === 0 ? 0 : differences / compared;
}

function findClosestPair(
  clusters: Map<string, Cluster>,
  distances: Map<string, number>,
): { distance: number; leftId: string; rightId: string } | null {
  const values = [...clusters.values()].sort((left, right) =>
    left.id.localeCompare(right.id),
  );
  let closest: { distance: number; leftId: string; rightId: string } | null =
    null;
  for (let leftIndex = 0; leftIndex < values.length; leftIndex += 1) {
    for (
      let rightIndex = leftIndex + 1;
      rightIndex < values.length;
      rightIndex += 1
    ) {
      const left = values[leftIndex];
      const right = values[rightIndex];
      if (left == null || right == null) {
        continue;
      }
      const distance = distances.get(distanceKey(left.id, right.id));
      if (distance == null) {
        continue;
      }
      if (closest == null || distance < closest.distance) {
        closest = { distance, leftId: left.id, rightId: right.id };
      }
    }
  }
  return closest;
}

function distanceKey(leftId: string, rightId: string): string {
  return [leftId, rightId].sort().join("::");
}

function formatNewickLabel(label: string): string {
  return `'${label.replaceAll("'", "''")}'`;
}

function formatBranchLength(value: number): string {
  return Math.max(0, value).toFixed(6).replace(/0+$/u, "").replace(/\.$/u, "");
}

function isGap(symbol: string): boolean {
  return symbol === "-" || symbol === ".";
}
