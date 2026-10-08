import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FormattedMessage, useIntl } from "react-intl";

import type {
  MsaDocument,
  MsaRowMetrics,
  MsaRowSortDirection,
  MsaRowSortKey,
} from "./types";

const ROW_CONTROL_HEIGHT_PX = 44;
const ROW_CONTROL_OVERSCAN = 8;

type RowPanelMetrics = {
  height: number;
  scrollTop: number;
};

const EMPTY_METRICS: RowPanelMetrics = {
  height: 0,
  scrollTop: 0,
};

export function MsaRowsPanel({
  document,
  onSelectRows,
  onSortDirectionChange,
  onSortKeyChange,
  onToggleRow,
  referenceKind,
  rowMetricsById,
  selectedRowIds,
  sortDirection,
  sortKey,
}: {
  document: MsaDocument;
  onSelectRows: (rowIds: Array<string>) => void;
  onSortDirectionChange: (direction: MsaRowSortDirection) => void;
  onSortKeyChange: (key: MsaRowSortKey) => void;
  onToggleRow: (rowId: string) => void;
  referenceKind: "anchor" | "consensus" | "none";
  rowMetricsById: Record<string, MsaRowMetrics | undefined>;
  selectedRowIds: Array<string>;
  sortDirection: MsaRowSortDirection;
  sortKey: MsaRowSortKey;
}): React.ReactElement {
  const intl = useIntl();
  const [scrollContainer, setScrollContainer] = useState<HTMLDivElement | null>(
    null,
  );
  const [metrics, setMetrics] = useState<RowPanelMetrics>(EMPTY_METRICS);
  const animationFrameRef = useRef<number | null>(null);
  const documentRowIds = useMemo(
    () => new Set(document.rows.map((row) => row.id)),
    [document.rows],
  );
  const validSelectedRowIds = useMemo(() => {
    const retained = new Set<string>();
    for (const rowId of selectedRowIds) {
      if (documentRowIds.has(rowId)) {
        retained.add(rowId);
      }
    }
    return retained;
  }, [documentRowIds, selectedRowIds]);

  const updateMetrics = useCallback((node: HTMLDivElement): void => {
    setMetrics({ height: node.clientHeight, scrollTop: node.scrollTop });
  }, []);
  const setScrollContainerRef = useCallback(
    (node: HTMLDivElement | null): void => {
      setScrollContainer(node);
      if (node != null) {
        updateMetrics(node);
      }
    },
    [updateMetrics],
  );

  useEffect(() => {
    if (scrollContainer == null) {
      return;
    }
    const scheduleMetricsUpdate = (): void => {
      if (animationFrameRef.current != null) {
        return;
      }
      animationFrameRef.current = scheduleFrame(() => {
        animationFrameRef.current = null;
        updateMetrics(scrollContainer);
      });
    };
    const observer =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(scheduleMetricsUpdate);
    observer?.observe(scrollContainer);
    scrollContainer.addEventListener("scroll", scheduleMetricsUpdate, {
      passive: true,
    });
    return (): void => {
      if (animationFrameRef.current != null) {
        cancelFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      observer?.disconnect();
      scrollContainer.removeEventListener("scroll", scheduleMetricsUpdate);
    };
  }, [scrollContainer, updateMetrics]);

  const sortedRows = useMemo(() => {
    const sourceOrder = new Map(
      document.rows.map((row, index) => [row.id, index]),
    );
    return [...document.rows].sort((left, right) => {
      const leftMetric = rowMetricsById[left.id];
      const rightMetric = rowMetricsById[right.id];
      let comparison = 0;
      switch (sortKey) {
        case "coverage":
          comparison = compareNullableNumber(
            leftMetric?.coverageToReference,
            rightMetric?.coverageToReference,
          );
          break;
        case "identity":
          comparison = compareNullableNumber(
            leftMetric?.identityToReference,
            rightMetric?.identityToReference,
          );
          break;
        case "label":
          comparison = left.label.localeCompare(right.label);
          break;
        case "length":
          comparison = left.ungappedLength - right.ungappedLength;
          break;
        case "mismatches":
          comparison = compareNullableNumber(
            leftMetric?.mismatchCountToReference,
            rightMetric?.mismatchCountToReference,
          );
          break;
        case "source":
          comparison =
            (sourceOrder.get(left.id) ?? 0) - (sourceOrder.get(right.id) ?? 0);
          break;
      }
      if (comparison === 0) {
        comparison = left.label.localeCompare(right.label);
      }
      return sortDirection === "asc" ? comparison : -comparison;
    });
  }, [document.rows, rowMetricsById, sortDirection, sortKey]);

  const { end, start } = useMemo(() => {
    const viewportHeight =
      metrics.height > 0 ? metrics.height : ROW_CONTROL_HEIGHT_PX * 12;
    const visibleStart = Math.max(
      0,
      Math.floor(metrics.scrollTop / ROW_CONTROL_HEIGHT_PX),
    );
    const visibleCount = Math.max(
      1,
      Math.ceil(viewportHeight / ROW_CONTROL_HEIGHT_PX),
    );
    return {
      end: Math.min(
        sortedRows.length,
        visibleStart + visibleCount + ROW_CONTROL_OVERSCAN,
      ),
      start: Math.max(0, visibleStart - ROW_CONTROL_OVERSCAN),
    };
  }, [metrics.height, metrics.scrollTop, sortedRows.length]);

  const visibleRows = sortedRows.slice(start, end);
  const selectedRows = document.rows.filter((row) =>
    validSelectedRowIds.has(row.id),
  );
  const allSelected = validSelectedRowIds.size === document.rows.length;

  const toggleSelection = useCallback(
    (rowId: string): void => {
      const next = new Set(validSelectedRowIds);
      if (next.has(rowId)) {
        next.delete(rowId);
      } else {
        next.add(rowId);
      }
      onSelectRows([...next]);
    },
    [onSelectRows, validSelectedRowIds],
  );

  const selectAllRows = useCallback((): void => {
    onSelectRows(document.rows.map((row) => row.id));
  }, [document.rows, onSelectRows]);

  const clearSelection = useCallback((): void => {
    onSelectRows([]);
  }, [onSelectRows]);

  const hideSelectedRows = useCallback((): void => {
    for (const row of selectedRows) {
      if (!row.hidden) {
        onToggleRow(row.id);
      }
    }
  }, [onToggleRow, selectedRows]);

  const showAllRows = useCallback((): void => {
    for (const row of document.rows) {
      if (row.hidden) {
        onToggleRow(row.id);
      }
    }
  }, [document.rows, onToggleRow]);

  return (
    <aside
      aria-label={intl.formatMessage({
        id: "codex.filePreview.msa.rowVisibilityControls",
        defaultMessage: "MSA row visibility controls",
        description:
          "Accessible label for the MSA row visibility controls panel.",
      })}
      className="flex min-h-64 min-w-0 flex-col text-xs"
    >
      <div className="mb-2 shrink-0">
        <div className="flex items-center justify-between gap-2">
          <div className="font-medium text-token-text-primary">
            <FormattedMessage
              id="codex.filePreview.msa.rows"
              defaultMessage="Rows"
              description="Heading for the MSA sequence-row visibility panel."
            />
          </div>
          <span className="text-[11px] text-token-text-tertiary">
            <FormattedMessage
              id="codex.filePreview.msa.selectedRows"
              defaultMessage="{count, number} selected"
              description="Row-panel summary showing how many rows are selected."
              values={{ count: validSelectedRowIds.size }}
            />
          </span>
        </div>

        <div className="mt-2 grid grid-cols-2 gap-1">
          <PanelButton onClick={allSelected ? clearSelection : selectAllRows}>
            {allSelected ? (
              <FormattedMessage
                id="codex.filePreview.msa.clearRowSelection"
                defaultMessage="Clear selection"
                description="Button label for clearing selected MSA rows."
              />
            ) : (
              <FormattedMessage
                id="codex.filePreview.msa.selectAllRows"
                defaultMessage="Select all"
                description="Button label for selecting every MSA row."
              />
            )}
          </PanelButton>
          <PanelButton
            disabled={selectedRows.length === 0}
            onClick={hideSelectedRows}
          >
            <FormattedMessage
              id="codex.filePreview.msa.hideSelectedRows"
              defaultMessage="Hide selected"
              description="Button label for hiding currently selected MSA rows."
            />
          </PanelButton>
          <PanelButton onClick={showAllRows}>
            <FormattedMessage
              id="codex.filePreview.msa.showAllRows"
              defaultMessage="Show all"
              description="Button label for showing every MSA row."
            />
          </PanelButton>
          <PanelButton
            onClick={() =>
              onSortDirectionChange(sortDirection === "asc" ? "desc" : "asc")
            }
          >
            <FormattedMessage
              id="codex.filePreview.msa.toggleRowSortDirection"
              defaultMessage="{direction} sort"
              description="Button label that toggles the row metrics sort direction."
              values={{
                direction: sortDirection === "asc" ? "Ascending" : "Descending",
              }}
            />
          </PanelButton>
        </div>

        <label className="mt-2 flex flex-col gap-1 text-[11px] text-token-text-secondary">
          <span>
            <FormattedMessage
              id="codex.filePreview.msa.sortRowsBy"
              defaultMessage="Sort rows by"
              description="Label for the MSA row sorting control."
            />
          </span>
          <select
            className="h-7 rounded-md border border-token-border bg-token-input-background px-2 text-xs text-token-text-primary outline-none focus:border-token-focus-border"
            onChange={(event) =>
              onSortKeyChange(event.target.value as MsaRowSortKey)
            }
            value={sortKey}
          >
            <option value="source">
              {intl.formatMessage({
                id: "codex.filePreview.msa.rowSort.source",
                defaultMessage: "Source order",
                description: "MSA row sorting option for source-file order.",
              })}
            </option>
            <option value="label">
              {intl.formatMessage({
                id: "codex.filePreview.msa.rowSort.label",
                defaultMessage: "Label / accession",
                description: "MSA row sorting option for row labels.",
              })}
            </option>
            <option value="length">
              {intl.formatMessage({
                id: "codex.filePreview.msa.rowSort.length",
                defaultMessage: "Ungapped length",
                description: "MSA row sorting option for row length.",
              })}
            </option>
            <option value="identity">
              {intl.formatMessage({
                id: "codex.filePreview.msa.rowSort.identity",
                defaultMessage: "Identity to reference",
                description:
                  "MSA row sorting option for identity to the active reference.",
              })}
            </option>
            <option value="mismatches">
              {intl.formatMessage({
                id: "codex.filePreview.msa.rowSort.mismatches",
                defaultMessage: "Mismatch count",
                description:
                  "MSA row sorting option for mismatch count against the reference.",
              })}
            </option>
            <option value="coverage">
              {intl.formatMessage({
                id: "codex.filePreview.msa.rowSort.coverage",
                defaultMessage: "Coverage to reference",
                description: "MSA row sorting option for reference coverage.",
              })}
            </option>
          </select>
        </label>

        {referenceKind === "none" ? (
          <div className="bg-token-main-surface-secondary mt-2 rounded-md px-2 py-1 text-[11px] text-token-text-tertiary">
            <FormattedMessage
              id="codex.filePreview.msa.rowMetricsNeedReference"
              defaultMessage="Identity, mismatch, and coverage metrics become available after choosing a representative or anchor reference."
              description="Hint shown when reference-relative row metrics cannot yet be computed."
            />
          </div>
        ) : null}
      </div>

      <p className="mb-2 text-[11px] text-token-text-secondary">
        Select rows here to analyze, edit, or export them. Visibility controls
        change the display without deleting sequences.
      </p>
      <div
        className="max-h-96 min-h-0 flex-1 overflow-auto"
        ref={setScrollContainerRef}
      >
        <div
          className="relative"
          style={{ height: sortedRows.length * ROW_CONTROL_HEIGHT_PX }}
        >
          <div
            className="absolute inset-x-0 top-0"
            style={{
              transform: `translateY(${start * ROW_CONTROL_HEIGHT_PX}px)`,
            }}
          >
            {visibleRows.map((row) => {
              const metric = rowMetricsById[row.id];
              return (
                <div
                  className="hover:bg-token-main-surface-secondary flex h-11 items-start gap-2 rounded px-1 py-1 text-token-text-secondary"
                  key={row.id}
                >
                  <input
                    aria-label={intl.formatMessage(
                      {
                        id: "codex.filePreview.msa.selectSpecificRow",
                        defaultMessage: "Select row {label}",
                        description:
                          "Accessible label for selecting an MSA row inside the bulk row panel.",
                      },
                      { label: row.label },
                    )}
                    checked={validSelectedRowIds.has(row.id)}
                    onChange={() => toggleSelection(row.id)}
                    type="checkbox"
                  />
                  <input
                    aria-label={intl.formatMessage(
                      {
                        id: "codex.filePreview.msa.toggleSpecificRow",
                        defaultMessage: "Show row {label}",
                        description:
                          "Accessible label for toggling MSA row visibility.",
                      },
                      { label: row.label },
                    )}
                    checked={!row.hidden}
                    onChange={() => onToggleRow(row.id)}
                    type="checkbox"
                  />
                  <div className="min-w-0 flex-1">
                    <div
                      className="truncate font-medium text-token-text-primary"
                      title={row.label}
                    >
                      {row.label}
                    </div>
                    <div className="truncate text-[10px] text-token-text-tertiary">
                      {formatMetrics(metric, row.ungappedLength)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </aside>
  );
}

function PanelButton({
  children,
  disabled = false,
  onClick,
}: {
  children: React.ReactNode;
  disabled?: boolean;
  onClick: () => void;
}): React.ReactElement {
  return (
    <button
      className="h-7 rounded-md border border-token-border bg-token-main-surface-primary px-2 text-[11px] text-token-text-secondary disabled:cursor-not-allowed disabled:opacity-50"
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      {children}
    </button>
  );
}

function formatMetrics(
  metric: MsaRowMetrics | undefined,
  fallbackLength: number,
): string {
  if (metric == null) {
    return `Length ${fallbackLength}`;
  }
  const identity =
    metric.identityToReference == null
      ? "identity n/a"
      : `identity ${Math.round(metric.identityToReference * 100)}%`;
  const coverage =
    metric.coverageToReference == null
      ? "coverage n/a"
      : `coverage ${Math.round(metric.coverageToReference * 100)}%`;
  const mismatches =
    metric.mismatchCountToReference == null
      ? "mismatches n/a"
      : `${metric.mismatchCountToReference} mismatch${
          metric.mismatchCountToReference === 1 ? "" : "es"
        }`;
  return `${identity} · ${coverage} · ${mismatches} · len ${metric.ungappedLength}`;
}

function compareNullableNumber(
  left: number | null | undefined,
  right: number | null | undefined,
): number {
  if (left == null && right == null) {
    return 0;
  }
  if (left == null) {
    return 1;
  }
  if (right == null) {
    return -1;
  }
  return left - right;
}

function scheduleFrame(callback: FrameRequestCallback): number {
  if (typeof requestAnimationFrame === "function") {
    return requestAnimationFrame(callback);
  }
  return window.setTimeout(() => callback(performance.now()), 16);
}

function cancelFrame(handle: number): void {
  if (typeof cancelAnimationFrame === "function") {
    cancelAnimationFrame(handle);
    return;
  }
  window.clearTimeout(handle);
}
