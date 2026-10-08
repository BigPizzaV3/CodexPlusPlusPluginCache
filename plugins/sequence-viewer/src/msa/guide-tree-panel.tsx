import { WorkbenchDisclosure } from "../ui/workbench-disclosure";
import {
  MAX_GUIDE_TREE_COLUMNS,
  MAX_GUIDE_TREE_ROWS,
  buildUpgmaGuideTree,
} from "./guide-tree";
import type { MsaSequenceRow } from "./types";

export function MsaGuideTreePanel({
  newick,
  onCompute,
  rows,
}: {
  newick: string | null;
  onCompute: (newick: string) => void;
  rows: Array<MsaSequenceRow>;
}): React.ReactElement {
  const alignedLength = rows[0]?.alignedSequence.length ?? 0;
  const unavailableReason =
    rows.length > MAX_GUIDE_TREE_ROWS
      ? `Interactive guide trees support up to ${MAX_GUIDE_TREE_ROWS} rows.`
      : alignedLength > MAX_GUIDE_TREE_COLUMNS
        ? `Interactive guide trees support up to ${MAX_GUIDE_TREE_COLUMNS.toLocaleString()} columns.`
        : null;
  return (
    <WorkbenchDisclosure
      className="border-b border-token-border px-3 py-2"
      id="alignment.guide-tree"
      label="Exploratory guide tree"
      summaryClassName="cursor-pointer text-xs font-medium text-token-text-primary"
    >
      <div className="mt-2 space-y-2 text-xs text-token-text-secondary">
        <p>
          UPGMA on uncorrected alignment p-distance, ignoring all-gap columns.
          Use a dedicated phylogenetics workflow for publication-grade
          inference.
        </p>
        {unavailableReason == null ? (
          <button
            className="rounded border border-token-border px-2 py-1 font-medium text-token-text-primary hover:bg-token-main-surface-secondary"
            onClick={() => onCompute(buildUpgmaGuideTree(rows))}
            type="button"
          >
            {newick == null ? "Compute guide tree" : "Recompute guide tree"}
          </button>
        ) : (
          <p>{unavailableReason}</p>
        )}
        {newick == null ? null : (
          <code className="block max-h-32 overflow-auto rounded bg-token-main-surface-secondary p-2 font-mono break-all text-token-text-primary">
            {newick}
          </code>
        )}
      </div>
    </WorkbenchDisclosure>
  );
}
