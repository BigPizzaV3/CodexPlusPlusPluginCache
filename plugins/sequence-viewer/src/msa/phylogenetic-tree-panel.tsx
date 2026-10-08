import type { GuideTreeNode, GuideTreeResult } from "./phylogenetic-tree";

export type TreeLayoutNode = {
  id: string;
  label?: string;
  parentId: string | null;
  rowId?: string;
  x: number;
  y: number;
};

export function PhylogeneticTreePanel({
  onSelectRows,
  selectedRowIds,
  tree,
}: {
  onSelectRows: (rowIds: Array<string>) => void;
  selectedRowIds: Array<string>;
  tree: GuideTreeResult;
}): React.ReactElement {
  const layout = layoutGuideTree(tree.root);
  const width = 640;
  const height = Math.max(100, layout.leafCount * 24 + 24);
  const byId = new Map(layout.nodes.map((node) => [node.id, node]));
  const selected = new Set(selectedRowIds);
  return (
    <section aria-label="Graphical guide tree" className="rounded border border-token-border bg-token-main-surface-primary p-2">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-xs font-semibold text-token-text-primary">{tree.algorithm === "neighbor-joining" ? "Neighbor-joining" : "UPGMA"} guide tree</h3>
          <p className="text-[10px] text-token-text-secondary">Uncorrected p-distance · click a branch or leaf to select synchronized rows</p>
        </div>
        <code className="max-w-64 truncate text-[10px] text-token-text-secondary" title={tree.newick}>{tree.newick}</code>
      </div>
      <div className="max-h-72 overflow-auto">
        <svg aria-label={`${tree.algorithm} guide tree with ${layout.leafCount} leaves`} className="min-w-[36rem]" height={height} role="img" viewBox={`0 0 ${width} ${height}`} width="100%">
          {layout.nodes.map((node) => {
            if (node.parentId == null) return null;
            const parent = byId.get(node.parentId);
            if (parent == null) return null;
            return (
              <g key={`edge-${node.id}`}>
                <line stroke="currentColor" strokeOpacity="0.35" x1={parent.x} x2={parent.x} y1={parent.y} y2={node.y} />
                <line stroke="currentColor" strokeOpacity="0.65" x1={parent.x} x2={node.x} y1={node.y} y2={node.y} />
              </g>
            );
          })}
          {layout.nodes.map((node) => {
            const descendants = descendantRowIds(tree.root, node.id);
            const isSelected = descendants.length > 0 && descendants.every((id) => selected.has(id));
            return (
              <g className="cursor-pointer" key={node.id} onClick={() => onSelectRows(descendants)} role="button" tabIndex={0} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onSelectRows(descendants); } }} aria-label={node.rowId == null ? `Select ${descendants.length} descendant rows` : `Select row ${node.label ?? node.rowId}`}>
                <circle cx={node.x} cy={node.y} fill={isSelected ? "rgb(16 185 129)" : "currentColor"} opacity={isSelected ? 1 : 0.65} r={node.rowId == null ? 3.5 : 4.5} />
                {node.label == null ? null : <text fill="currentColor" fontSize="11" x={node.x + 8} y={node.y + 4}>{node.label}</text>}
              </g>
            );
          })}
        </svg>
      </div>
      <p className="mt-2 text-[10px] text-token-text-secondary">{tree.warning}</p>
    </section>
  );
}

export function layoutGuideTree(root: GuideTreeNode): {
  leafCount: number;
  nodes: Array<TreeLayoutNode>;
} {
  const raw: Array<TreeLayoutNode & { distance: number }> = [];
  let leafIndex = 0;
  function visit(node: GuideTreeNode, parentId: string | null, distance: number): number {
    const nextDistance = distance + Math.max(0, node.branchLength);
    let y: number;
    if (node.children.length === 0) {
      y = 24 + leafIndex * 24;
      leafIndex += 1;
    } else {
      const childYs = node.children.map((child) => visit(child, node.id, nextDistance));
      y = childYs.reduce((sum, value) => sum + value, 0) / Math.max(1, childYs.length);
    }
    raw.push({
      distance: nextDistance,
      id: node.id,
      label: node.label,
      parentId,
      rowId: node.rowId,
      x: 0,
      y,
    });
    return y;
  }
  visit(root, null, 0);
  const maxDistance = Math.max(0, ...raw.map(({ distance }) => distance));
  const useDepth = maxDistance === 0;
  const depthById = new Map<string, number>();
  function assignDepth(node: GuideTreeNode, depth: number): void {
    depthById.set(node.id, depth);
    node.children.forEach((child) => assignDepth(child, depth + 1));
  }
  assignDepth(root, 0);
  const maxDepth = Math.max(1, ...depthById.values());
  return {
    leafCount: leafIndex,
    nodes: raw.map(({ distance, ...node }) => ({
      ...node,
      x: 20 + (useDepth ? (depthById.get(node.id) ?? 0) / maxDepth : distance / maxDistance) * 440,
    })),
  };
}

export function descendantRowIds(root: GuideTreeNode, nodeId: string): Array<string> {
  const target = findNode(root, nodeId);
  if (target == null) return [];
  if (target.rowId != null) return [target.rowId];
  return target.children.flatMap((child) => collectRows(child));
}

function findNode(node: GuideTreeNode, nodeId: string): GuideTreeNode | null {
  if (node.id === nodeId) return node;
  for (const child of node.children) {
    const match = findNode(child, nodeId);
    if (match != null) return match;
  }
  return null;
}

function collectRows(node: GuideTreeNode): Array<string> {
  if (node.rowId != null) return [node.rowId];
  return node.children.flatMap(collectRows);
}
