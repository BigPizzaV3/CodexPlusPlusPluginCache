import { useEffect, useState } from "react";

import { SEQUENCE_VIEWER_LIMITS } from "../runtime-contract";
import type { SequenceSearchHit } from "./types";

export function SearchPanel({
  hits,
  onSelectHit,
  searching = false,
  truncated = false,
}: {
  hits: Array<SequenceSearchHit>;
  onSelectHit: (hit: SequenceSearchHit) => void;
  searching?: boolean;
  truncated?: boolean;
}): React.ReactElement | null {
  const [page, setPage] = useState(0);
  const pageSize = SEQUENCE_VIEWER_LIMITS.ui.searchHitPageSize;
  const pageCount = Math.max(1, Math.ceil(hits.length / pageSize));
  useEffect(() => setPage(0), [hits]);
  if (hits.length === 0 && !searching && !truncated) {
    return null;
  }
  const visibleHits = hits.slice(page * pageSize, (page + 1) * pageSize);

  return (
    <div className="rounded-xl border border-token-border bg-token-bg-secondary/70 p-3">
      <div className="mb-2 flex items-center justify-between gap-3 text-xs font-semibold uppercase tracking-wide text-token-text-tertiary">
        <span>
          {searching
            ? "Searching sequence…"
            : `Search hits (${hits.length.toLocaleString()}${truncated ? "+" : ""})`}
        </span>
        {pageCount <= 1 ? null : (
          <span className="flex items-center gap-2 normal-case tracking-normal">
            <button
              disabled={page === 0}
              onClick={() => setPage((value) => Math.max(0, value - 1))}
              type="button"
            >
              Previous
            </button>
            {page + 1}/{pageCount}
            <button
              disabled={page >= pageCount - 1}
              onClick={() =>
                setPage((value) => Math.min(pageCount - 1, value + 1))
              }
              type="button"
            >
              Next
            </button>
          </span>
        )}
      </div>
      {truncated ? (
        <p className="mb-2 text-xs text-amber-700 dark:text-amber-300">
          Results reached the bounded search limit. Refine the query to inspect
          additional matches.
        </p>
      ) : null}
      {!searching && hits.length === 0 ? (
        <p className="text-xs text-token-text-secondary">No matches found.</p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {visibleHits.map((hit) => (
          <button
            className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-xs text-token-text-primary hover:bg-cyan-500/20"
            key={`${hit.recordId}-${hit.start}-${hit.orientation}`}
            onClick={() => onSelectHit(hit)}
            type="button"
          >
            {hit.start}–{hit.end} · {hit.orientation}
          </button>
        ))}
      </div>
    </div>
  );
}
