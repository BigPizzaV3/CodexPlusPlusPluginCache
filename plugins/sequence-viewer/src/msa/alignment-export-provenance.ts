import type { GuideTreeResult } from "./phylogenetic-tree";

export function createAlignmentExportParameters({
  format,
  scope,
  tree,
}: {
  format:
    | "a3m"
    | "aligned-fasta"
    | "clustal"
    | "json"
    | "newick"
    | "pdf"
    | "stockholm"
    | "svg"
    | "tsv";
  scope: "all" | "selection" | "visible";
  tree: GuideTreeResult | null;
}): Record<string, unknown> {
  return {
    scope,
    ...(format === "newick" && tree != null
      ? {
          tree: {
            algorithm: tree.algorithm,
            distanceModel: tree.distance,
            engine: "sequence-viewer-guide-tree-v1",
            rowOrder: [...tree.rowOrder],
            rowSetKey: tree.rowSetKey,
            warning: tree.warning,
          },
        }
      : {}),
  };
}
