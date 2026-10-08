import { useState, type PointerEvent, type WheelEventHandler } from "react";
import { FormattedMessage, useIntl } from "react-intl";

import type { MsaOverviewBucket } from "./analysis";
import type { MsaColumnRange } from "./types";

export function MsaOverviewStrip({
  alignedLength,
  isPending,
  onSelectedColumnRangeChange,
  onHorizontalWheel,
  onWindowStartChange,
  overviewBuckets,
  selectedColumnRange,
  visibleColumns,
  windowStart,
}: {
  alignedLength: number;
  isPending: boolean;
  onSelectedColumnRangeChange: (range: MsaColumnRange | null) => void;
  onHorizontalWheel: WheelEventHandler<HTMLElement>;
  onWindowStartChange: (value: number) => void;
  overviewBuckets: Array<MsaOverviewBucket>;
  selectedColumnRange: MsaColumnRange | null;
  visibleColumns: number;
  windowStart: number;
}): React.ReactElement {
  const intl = useIntl();
  const [dragAnchorColumn, setDragAnchorColumn] = useState<number | null>(null);
  const bucketCount = Math.max(1, Math.min(80, alignedLength));
  const buckets =
    overviewBuckets.length > 0
      ? overviewBuckets
      : Array.from({ length: bucketCount }, () => ({
          gapFraction: 0,
          identity: 0,
          meanGapFraction: 0,
          meanIdentity: 0,
        }));
  const viewportLeft =
    alignedLength === 0
      ? 0
      : Math.min(100, (windowStart / alignedLength) * 100);
  const viewportWidth =
    alignedLength === 0
      ? 100
      : Math.max(2, Math.min(100, (visibleColumns / alignedLength) * 100));
  const selectedLeft =
    selectedColumnRange == null || alignedLength === 0
      ? 0
      : (selectedColumnRange.start / alignedLength) * 100;
  const selectedWidth =
    selectedColumnRange == null || alignedLength === 0
      ? 0
      : Math.max(
          0.5,
          ((selectedColumnRange.end - selectedColumnRange.start) /
            alignedLength) *
            100,
        );

  function getColumnFromPointer(event: PointerEvent<HTMLDivElement>): number {
    const bounds = event.currentTarget.getBoundingClientRect();
    const position =
      bounds.width <= 0
        ? 0
        : Math.min(
            1,
            Math.max(0, (event.clientX - bounds.left) / bounds.width),
          );
    return Math.min(
      Math.max(0, alignedLength - 1),
      Math.max(0, Math.floor(position * Math.max(1, alignedLength))),
    );
  }

  function buildColumnRange(anchor: number, column: number): MsaColumnRange {
    return {
      end: Math.min(alignedLength, Math.max(anchor, column) + 1),
      start: Math.max(0, Math.min(anchor, column)),
    };
  }

  function beginRangeSelection(event: PointerEvent<HTMLDivElement>): void {
    if (alignedLength <= 0 || isPending) {
      return;
    }
    const column = getColumnFromPointer(event);
    setDragAnchorColumn(column);
    onSelectedColumnRangeChange(buildColumnRange(column, column));
  }

  function extendRangeSelection(event: PointerEvent<HTMLDivElement>): void {
    if (dragAnchorColumn == null || alignedLength <= 0 || isPending) {
      return;
    }
    onSelectedColumnRangeChange(
      buildColumnRange(dragAnchorColumn, getColumnFromPointer(event)),
    );
  }

  function endRangeSelection(): void {
    setDragAnchorColumn(null);
  }

  return (
    <div
      className="relative border-b border-token-border px-3 py-2"
      onWheel={onHorizontalWheel}
    >
      <div
        aria-label={intl.formatMessage({
          id: "codex.filePreview.msa.overviewStrip",
          defaultMessage: "MSA overview strip",
          description:
            "Accessible label for the identity and gap overview strip in the MSA viewer.",
        })}
        className="bg-token-main-surface-secondary relative flex h-4 overflow-hidden rounded"
        onPointerCancel={endRangeSelection}
        onPointerDown={beginRangeSelection}
        onPointerMove={extendRangeSelection}
        onPointerUp={endRangeSelection}
      >
        {buckets.map((bucket, index) => (
          <button
            aria-label={intl.formatMessage(
              {
                id: "codex.filePreview.msa.overviewBucket",
                defaultMessage: "Jump near MSA overview bucket {bucket}",
                description:
                  "Accessible label for an overview-strip bucket that moves the MSA viewport.",
              },
              { bucket: index + 1 },
            )}
            className="h-full min-w-0 flex-1 border-0"
            disabled={isPending}
            key={`${bucket.identity}-${bucket.gapFraction}-${index}`}
            onClick={() =>
              onWindowStartChange(
                Math.max(
                  0,
                  Math.min(
                    Math.max(0, alignedLength - visibleColumns),
                    Math.floor(
                      (index / Math.max(bucketCount, 1)) * alignedLength,
                    ),
                  ),
                ),
              )
            }
            style={{
              background: isPending
                ? "rgb(148 163 184 / 0.18)"
                : `linear-gradient(180deg, rgb(37 99 235 / ${bucket.identity}), rgb(239 68 68 / ${bucket.gapFraction}))`,
            }}
            type="button"
          />
        ))}
        <span
          className="pointer-events-none absolute inset-y-0 border-2 border-token-text-primary bg-white/20"
          style={{ left: `${viewportLeft}%`, width: `${viewportWidth}%` }}
        />
        {selectedColumnRange == null ? null : (
          <span
            className="pointer-events-none absolute inset-y-0 border border-sky-400 bg-sky-400/25"
            style={{
              left: `${selectedLeft}%`,
              width: `${selectedWidth}%`,
            }}
          />
        )}
      </div>
      <input
        aria-label={intl.formatMessage({
          id: "codex.filePreview.msa.overviewWindowSlider",
          defaultMessage: "Move MSA overview window",
          description:
            "Accessible label for dragging the horizontal MSA viewport across the overview strip.",
        })}
        className="mt-2 w-full cursor-interaction"
        disabled={isPending || alignedLength <= visibleColumns}
        max={Math.max(0, alignedLength - visibleColumns)}
        min={0}
        onChange={(event) => onWindowStartChange(Number(event.target.value))}
        type="range"
        value={Math.min(
          Math.max(0, alignedLength - visibleColumns),
          Math.max(0, windowStart),
        )}
      />
      {isPending ? (
        <div className="mt-1 text-[11px] text-token-text-secondary">
          <FormattedMessage
            id="codex.filePreview.msa.overviewPending"
            defaultMessage="Computing overview metrics…"
            description="Pending state text beneath the MSA overview strip while metrics are still being computed."
          />
        </div>
      ) : null}
    </div>
  );
}
