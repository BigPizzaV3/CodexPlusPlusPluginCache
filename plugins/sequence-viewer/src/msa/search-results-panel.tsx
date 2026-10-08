import clsx from "clsx";
import { useEffect, useState } from "react";
import { FormattedMessage, useIntl } from "react-intl";

import { WorkbenchDisclosure } from "../ui/workbench-disclosure";
import { getUngappedPosition } from "./coordinate-map";
import { SEQUENCE_VIEWER_LIMITS } from "../runtime-contract";
import type { MsaMotifSearchHit } from "./search";

export function MsaSearchResultsPanel({
  hits,
  isPending,
  onSelectHit,
  query,
  referenceSequence,
  selectedHitIndex,
  truncated = false,
}: {
  hits: Array<MsaMotifSearchHit>;
  isPending: boolean;
  onSelectHit: (index: number) => void;
  query: string;
  referenceSequence: string | null;
  selectedHitIndex: number;
  truncated?: boolean;
}): React.ReactElement | null {
  const intl = useIntl();
  const [page, setPage] = useState(0);
  const pageSize = SEQUENCE_VIEWER_LIMITS.ui.searchHitPageSize;
  const pageCount = Math.max(1, Math.ceil(hits.length / pageSize));
  useEffect(() => {
    setPage(Math.min(pageCount - 1, Math.floor(selectedHitIndex / pageSize)));
  }, [pageCount, selectedHitIndex]);
  const trimmedQuery = query.trim();
  if (trimmedQuery.length === 0) {
    return null;
  }
  return (
    <section className="border-b border-token-border bg-token-main-surface-primary px-3 py-2 text-xs text-token-text-secondary">
      <WorkbenchDisclosure
        defaultExpanded
        id="alignment.search-results"
        label={intl.formatMessage(
          {
            id: "codex.filePreview.msa.searchResultsSummary",
            defaultMessage: "Motif search results · {count, number} hits",
            description: "Summary label for the MSA motif search result panel.",
          },
          { count: hits.length },
        )}
        summaryClassName="cursor-interaction font-medium text-token-text-primary select-none"
      >
        <div className="mt-2">
          {truncated ? (
            <div className="mb-2 rounded-md bg-amber-500/10 px-2 py-1 text-amber-700 dark:text-amber-300">
              Results reached the bounded search limit. Refine the motif to
              inspect additional matches.
            </div>
          ) : null}
          {isPending ? (
            <div className="bg-token-main-surface-secondary rounded-md px-2 py-1 text-token-text-tertiary">
              <FormattedMessage
                id="codex.filePreview.msa.searchResultsPending"
                defaultMessage="Processing motif matches…"
                description="Pending label in the MSA motif search result panel."
              />
            </div>
          ) : hits.length === 0 ? (
            <div className="bg-token-main-surface-secondary rounded-md px-2 py-1 text-token-text-tertiary">
              <FormattedMessage
                id="codex.filePreview.msa.searchResultsEmpty"
                defaultMessage="No rows matched “{query}”."
                description="Empty-state label in the MSA motif search result panel."
                values={{ query: trimmedQuery }}
              />
            </div>
          ) : (
            <div className="max-h-44 overflow-auto rounded-md border border-token-border">
              {hits
                .slice(page * pageSize, (page + 1) * pageSize)
                .map((hit, pageIndex) => {
                  const index = page * pageSize + pageIndex;
                  return (
                    <SearchResultButton
                      hit={hit}
                      index={index}
                      isSelected={index === selectedHitIndex}
                      key={`${hit.rowId}:${hit.alignmentStartColumn}:${hit.alignmentEndColumn}:${hit.orientation}`}
                      onSelectHit={onSelectHit}
                      referenceSequence={referenceSequence}
                    />
                  );
                })}
            </div>
          )}
          {pageCount <= 1 || isPending ? null : (
            <div className="mt-2 flex items-center justify-end gap-2">
              <button
                disabled={page === 0}
                onClick={() => setPage((value) => Math.max(0, value - 1))}
                type="button"
              >
                Previous
              </button>
              <span>
                {page + 1}/{pageCount}
              </span>
              <button
                disabled={page >= pageCount - 1}
                onClick={() =>
                  setPage((value) => Math.min(pageCount - 1, value + 1))
                }
                type="button"
              >
                Next
              </button>
            </div>
          )}
        </div>
      </WorkbenchDisclosure>
    </section>
  );
}

function SearchResultButton({
  hit,
  index,
  isSelected,
  onSelectHit,
  referenceSequence,
}: {
  hit: MsaMotifSearchHit;
  index: number;
  isSelected: boolean;
  onSelectHit: (index: number) => void;
  referenceSequence: string | null;
}): React.ReactElement {
  const intl = useIntl();
  const referenceStart =
    referenceSequence == null
      ? null
      : getUngappedPosition(referenceSequence, hit.alignmentStartColumn);
  const referenceEnd =
    referenceSequence == null
      ? null
      : getUngappedPosition(referenceSequence, hit.alignmentEndColumn);
  return (
    <button
      aria-label={intl.formatMessage(
        {
          id: "codex.filePreview.msa.searchResultButton",
          defaultMessage:
            "Select motif hit {row} alignment columns {start} to {end}",
          description:
            "Accessible label for selecting one MSA motif search result.",
        },
        {
          end: hit.alignmentEndColumn + 1,
          row: hit.rowLabel,
          start: hit.alignmentStartColumn + 1,
        },
      )}
      className={clsx(
        "grid w-full cursor-interaction grid-cols-[minmax(0,1.4fr)_auto_auto_auto_auto] gap-3 border-b border-token-border px-2 py-1 text-left last:border-b-0",
        isSelected
          ? "bg-token-main-surface-secondary text-token-text-primary"
          : "hover:bg-token-main-surface-secondary",
      )}
      onClick={() => onSelectHit(index)}
      type="button"
    >
      <span className="truncate font-medium">{hit.rowLabel}</span>
      <span>
        <FormattedMessage
          id="codex.filePreview.msa.searchResultColumns"
          defaultMessage="cols {start, number}-{end, number}"
          description="Alignment-column range label for one MSA search hit."
          values={{
            end: hit.alignmentEndColumn + 1,
            start: hit.alignmentStartColumn + 1,
          }}
        />
      </span>
      <span>
        <FormattedMessage
          id="codex.filePreview.msa.searchResultUngapped"
          defaultMessage="ungapped {start, number}-{end, number}"
          description="Ungapped row-coordinate range label for one MSA search hit."
          values={{
            end: hit.ungappedEndPosition,
            start: hit.ungappedStartPosition,
          }}
        />
      </span>
      <span>{hit.orientation}</span>
      <span>
        {referenceStart == null || referenceEnd == null ? (
          <FormattedMessage
            id="codex.filePreview.msa.searchResultReferenceUnavailable"
            defaultMessage="reference —"
            description="Reference-coordinate fallback label for one MSA search hit."
          />
        ) : (
          <FormattedMessage
            id="codex.filePreview.msa.searchResultReference"
            defaultMessage="reference {start, number}-{end, number}"
            description="Active-reference coordinate range label for one MSA search hit."
            values={{
              end: referenceEnd,
              start: referenceStart,
            }}
          />
        )}
      </span>
    </button>
  );
}
