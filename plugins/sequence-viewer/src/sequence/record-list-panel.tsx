import { useEffect, useMemo, useState } from "react";

import { SEQUENCE_VIEWER_LIMITS } from "../runtime-contract";
import type { SequenceRecord } from "./types";

export type SequenceRecordBrowserState = {
  expanded: boolean;
  page: number;
  query: string;
  sortBy: "label" | "length" | "molecule" | "source";
};

export const DEFAULT_SEQUENCE_RECORD_BROWSER_STATE: SequenceRecordBrowserState =
  {
    expanded: false,
    page: 0,
    query: "",
    sortBy: "source",
  };

export function normalizeSequenceRecordBrowserState(
  records: ReadonlyArray<SequenceRecord>,
  state: SequenceRecordBrowserState,
): SequenceRecordBrowserState {
  const query = state.query.trim().toLowerCase();
  const count =
    query.length === 0
      ? records.length
      : records.reduce(
          (total, { description, sourceLabel }) =>
            total +
            Number(
              `${sourceLabel} ${description ?? ""}`
                .toLowerCase()
                .includes(query),
            ),
          0,
        );
  const lastPage = Math.max(
    0,
    Math.ceil(count / SEQUENCE_VIEWER_LIMITS.ui.recordPageSize) - 1,
  );
  return {
    ...state,
    page: Math.max(0, Math.min(state.page, lastPage)),
  };
}

export function RecordListPanel({
  browserState,
  onBrowserStateChange,
  onSelectRecord,
  records,
  selectedRecordId,
  totalRecordCount = records.length,
}: {
  browserState?: SequenceRecordBrowserState;
  onBrowserStateChange?: (state: SequenceRecordBrowserState) => void;
  onSelectRecord: (recordId: string) => void;
  records: Array<SequenceRecord>;
  selectedRecordId: string;
  totalRecordCount?: number;
}): React.ReactElement | null {
  const [localBrowserState, setLocalBrowserState] = useState(
    DEFAULT_SEQUENCE_RECORD_BROWSER_STATE,
  );
  const currentBrowser = useMemo(
    () =>
      normalizeSequenceRecordBrowserState(
        records,
        browserState ?? localBrowserState,
      ),
    [browserState, localBrowserState, records],
  );
  const { expanded, page, query, sortBy: sortMode } = currentBrowser;
  const updateBrowser = (patch: Partial<SequenceRecordBrowserState>): void => {
    const next = normalizeSequenceRecordBrowserState(records, {
      ...currentBrowser,
      ...patch,
    });
    if (onBrowserStateChange == null) setLocalBrowserState(next);
    else onBrowserStateChange(next);
  };
  const [recordNumberDraft, setRecordNumberDraft] = useState("1");
  const selectedRecordIndex = Math.max(
    0,
    records.findIndex((record) => record.id === selectedRecordId),
  );
  const selectedRecord = records[selectedRecordIndex] ?? records[0];
  useEffect(() => {
    setRecordNumberDraft(String(selectedRecordIndex + 1));
  }, [selectedRecordIndex]);
  const commitRecordNumber = (): void => {
    const record = records[Number(recordNumberDraft) - 1];
    if (record != null) onSelectRecord(record.id);
    else setRecordNumberDraft(String(selectedRecordIndex + 1));
  };
  const visibleRecords = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const filteredRecords = records.filter(({ description, sourceLabel }) =>
      normalizedQuery.length === 0
        ? true
        : `${sourceLabel} ${description ?? ""}`
            .toLowerCase()
            .includes(normalizedQuery),
    );
    if (sortMode === "source") return filteredRecords;
    return [...filteredRecords].sort((leftRecord, rightRecord) => {
      switch (sortMode) {
        case "label":
          return leftRecord.sourceLabel.localeCompare(rightRecord.sourceLabel);
        case "length":
          return rightRecord.length - leftRecord.length;
        case "molecule":
          return leftRecord.molecule.localeCompare(rightRecord.molecule);
      }
    });
  }, [query, records, sortMode]);
  const pageSize = SEQUENCE_VIEWER_LIMITS.ui.recordPageSize;
  const pageCount = Math.max(1, Math.ceil(visibleRecords.length / pageSize));
  const boundedPage = Math.min(page, pageCount - 1);
  const pagedRecords = visibleRecords.slice(
    boundedPage * pageSize,
    (boundedPage + 1) * pageSize,
  );
  if (records.length <= 1) {
    return null;
  }

  return (
    <section
      aria-label="Sequence record selector"
      className="bio-sequence-recordbar rounded-lg border border-token-border bg-token-main-surface-primary px-3 py-2"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1">
          <div className="max-w-full truncate text-sm font-semibold text-token-text-primary">
            {selectedRecord?.sourceLabel}
          </div>
          <div className="text-xs tabular-nums text-token-text-secondary">
            Showing {totalRecordCount === records.length ? "" : "retained "}
            record {selectedRecordIndex + 1} of{" "}
            {records.length.toLocaleString()}
            {totalRecordCount === records.length
              ? ""
              : ` (${totalRecordCount.toLocaleString()} total summarized)`}
          </div>
        </div>
        <div className="flex items-center gap-2 text-sm font-medium text-token-text-secondary">
          <button
            aria-label="Previous sequence record"
            className="rounded px-2 py-1 hover:bg-token-main-surface-secondary disabled:opacity-40"
            disabled={selectedRecordIndex === 0}
            onClick={() =>
              onSelectRecord(
                records[Math.max(0, selectedRecordIndex - 1)]?.id ?? "",
              )
            }
            type="button"
          >
            Previous
          </button>
          <label className="flex items-center gap-2">
            <span className="sr-only">Record number</span>
            <input
              aria-label="Select sequence record"
              className="w-16 rounded-md border border-token-border bg-token-input-background px-2 py-1 text-sm tabular-nums text-token-text-primary outline-none focus:border-token-focus-border"
              max={records.length}
              min={1}
              onBlur={commitRecordNumber}
              onChange={(event) => setRecordNumberDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") commitRecordNumber();
              }}
              type="number"
              value={recordNumberDraft}
            />
          </label>
          <button
            aria-label="Next sequence record"
            className="rounded px-2 py-1 hover:bg-token-main-surface-secondary disabled:opacity-40"
            disabled={selectedRecordIndex >= records.length - 1}
            onClick={() =>
              onSelectRecord(
                records[Math.min(records.length - 1, selectedRecordIndex + 1)]
                  ?.id ?? "",
              )
            }
            type="button"
          >
            Next
          </button>
        </div>
      </div>
      <details
        className="mt-2"
        open={expanded}
        onToggle={(event) => {
          if (event.currentTarget.open !== expanded) {
            updateBrowser({ expanded: event.currentTarget.open });
          }
        }}
      >
        <summary className="cursor-pointer text-sm font-medium text-token-text-secondary">
          Browse all records
        </summary>
        <p className="mt-3 text-sm text-token-text-secondary">
          Sequence mode shows one record at a time. It starts on the first
          parsed record from the file; use the selector to inspect the others.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <input
            aria-label="Filter records"
            className="min-w-44 flex-1 rounded-md border border-token-border bg-token-main-surface-primary px-3 py-1.5 text-sm text-token-text-primary outline-none placeholder:text-token-text-tertiary"
            maxLength={500}
            onChange={(event) => {
              updateBrowser({ page: 0, query: event.target.value });
            }}
            placeholder="Filter label or description"
            value={query}
          />
          <select
            aria-label="Sort records"
            className="rounded-md border border-token-border bg-token-main-surface-primary px-3 py-1.5 text-sm text-token-text-primary outline-none"
            onChange={(event) => {
              updateBrowser({
                page: 0,
                sortBy: event.target
                  .value as SequenceRecordBrowserState["sortBy"],
              });
            }}
            value={sortMode}
          >
            <option value="source">Source order</option>
            <option value="label">Label</option>
            <option value="length">Length</option>
            <option value="molecule">Molecule</option>
          </select>
        </div>
        <div className="mt-3 overflow-auto rounded-md border border-token-border">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-token-main-surface-primary text-xs uppercase tracking-wide text-token-text-tertiary">
              <tr>
                <th className="px-3 py-2">Record</th>
                <th className="px-3 py-2">Description</th>
                <th className="px-3 py-2">Length</th>
                <th className="px-3 py-2">Molecule</th>
                <th className="px-3 py-2">Features</th>
                <th className="px-3 py-2">Quality</th>
              </tr>
            </thead>
            <tbody>
              {pagedRecords.map((record) => (
                <tr
                  aria-selected={record.id === selectedRecordId}
                  className={`cursor-pointer border-t border-token-border ${
                    record.id === selectedRecordId
                      ? "bg-cyan-500/10"
                      : "hover:bg-token-main-surface-primary"
                  }`}
                  key={record.id}
                  onClick={() => onSelectRecord(record.id)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      onSelectRecord(record.id);
                    }
                  }}
                  tabIndex={0}
                >
                  <td className="px-3 py-2 font-medium text-token-text-primary">
                    {record.sourceLabel}
                  </td>
                  <td className="max-w-64 truncate px-3 py-2 text-token-text-secondary">
                    {record.description ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-token-text-secondary">
                    {record.length.toLocaleString()}
                  </td>
                  <td className="px-3 py-2 text-token-text-secondary">
                    {record.molecule}
                  </td>
                  <td className="px-3 py-2 text-token-text-secondary">
                    {record.features.length.toLocaleString()}
                  </td>
                  <td className="px-3 py-2 text-token-text-secondary">
                    {record.quality == null ? "—" : "yes"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {pageCount <= 1 ? null : (
          <div className="mt-2 flex items-center justify-end gap-2 text-xs text-token-text-secondary">
            <button
              disabled={boundedPage === 0}
              onClick={() => updateBrowser({ page: Math.max(0, page - 1) })}
              type="button"
            >
              Previous page
            </button>
            <span>
              {boundedPage + 1}/{pageCount}
            </span>
            <button
              disabled={boundedPage >= pageCount - 1}
              onClick={() =>
                updateBrowser({ page: Math.min(pageCount - 1, page + 1) })
              }
              type="button"
            >
              Next page
            </button>
          </div>
        )}
      </details>
    </section>
  );
}
