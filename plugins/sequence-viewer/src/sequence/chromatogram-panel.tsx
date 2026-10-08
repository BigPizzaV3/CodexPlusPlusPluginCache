import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactElement,
} from "react";

import { Button } from "../ui/button";
import { selectionContainsCoordinate } from "./selection";
import type {
  ChromatogramBase,
  SequenceChromatogram,
  SequenceRecord,
  SequenceSelection,
} from "./types";

const DEFAULT_WINDOW_BASES = 40;
const MAX_WINDOW_BASES = 100;
const MIN_WINDOW_BASES = 4;
const MAX_TRACE_POINTS = 2_048;
const TRACE_HEIGHT = 152;
const TRACE_PADDING = 10;
const CHANNELS: Array<{ base: ChromatogramBase; color: string }> = [
  { base: "A", color: "#16a34a" },
  { base: "C", color: "#3b82f6" },
  { base: "G", color: "var(--bio-token-text-primary, #334155)" },
  { base: "T", color: "#ef4444" },
];

type SignalPoint = { sample: number; value: number };

export type ChromatogramViewState = {
  /** Requested call count; the readable window may be smaller on a narrow screen. */
  basesPerWindow: number;
  /** First displayed base in the original read, using 1-based coordinates. */
  firstBase: number;
};

type ChromatogramPanelProps = {
  /** The untransformed record: trace peaks use original source coordinates. */
  record: SequenceRecord;
  /** Increment when restoring a saved view, even if its window is unchanged. */
  restorationEpoch?: number;
  selection?: SequenceSelection;
  view?: ChromatogramViewState;
  onSelectRange: (start: number, end: number) => void;
  onViewChange?: (view: ChromatogramViewState) => void;
};

export function ChromatogramPanel({
  record,
  restorationEpoch,
  selection,
  view,
  onSelectRange,
  onViewChange,
}: ChromatogramPanelProps): ReactElement | null {
  if (record.chromatogram == null) return null;
  return (
    <ChromatogramReadPanel
      chromatogram={record.chromatogram}
      key={record.id}
      onSelectRange={onSelectRange}
      onViewChange={onViewChange}
      record={record}
      restorationEpoch={restorationEpoch}
      selection={selection}
      view={view}
    />
  );
}

function ChromatogramReadPanel({
  chromatogram,
  record,
  restorationEpoch,
  selection,
  view,
  onSelectRange,
  onViewChange,
}: ChromatogramPanelProps & {
  chromatogram: SequenceChromatogram;
}): ReactElement {
  const baseCount = Math.min(
    record.sequence.length,
    chromatogram.peakLocations.length,
  );
  const activeSelection =
    selection?.recordId === record.id ? selection : undefined;
  const selectedStart = activeSelection?.start;
  const selectedEnd = activeSelection?.end;
  const [localView, setLocalView] = useState<ChromatogramViewState>({
    basesPerWindow: DEFAULT_WINDOW_BASES,
    firstBase: Math.max(1, (selectedStart ?? 1) - DEFAULT_WINDOW_BASES / 2),
  });
  const currentView = view ?? localView;
  const [focusedBase, setFocusedBase] = useState(selectedStart ?? 1);
  const [plotWidth, setPlotWidth] = useState(800);
  const plotRef = useRef<HTMLDivElement>(null);
  const baseButtons = useRef(new Map<number, HTMLButtonElement>());
  const selectionAnchor = useRef<number | null>(null);
  const pendingFocus = useRef<number | null>(null);
  const emittedSelection = useRef<{ end: number; start: number } | null>(null);
  const previousInput = useRef({
    chromatogram,
    restorationEpoch,
    selectedEnd,
    selectedStart,
    viewBasesPerWindow: view?.basesPerWindow,
    viewFirstBase: view?.firstBase,
  });
  // Reserve readable space per call instead of shrinking letters to fit a read.
  const maximumVisibleBases = Math.min(
    MAX_WINDOW_BASES,
    Math.max(1, Math.floor(plotWidth / 22)),
    baseCount,
  );
  const windowCapacity = Math.min(
    currentView.basesPerWindow,
    maximumVisibleBases,
  );
  const maximumStart = Math.max(1, baseCount);
  const windowStart = Math.max(
    1,
    Math.min(currentView.firstBase, maximumStart),
  );
  const visibleBaseCount = Math.min(
    windowCapacity,
    baseCount - windowStart + 1,
  );
  const windowEnd = Math.min(baseCount, windowStart + visibleBaseCount - 1);
  const tabStopBase =
    focusedBase >= windowStart && focusedBase <= windowEnd
      ? focusedBase
      : windowStart;

  useEffect(() => {
    const plot = plotRef.current;
    if (plot == null || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry != null && entry.contentRect.width > 0) {
        setPlotWidth(entry.contentRect.width);
      }
    });
    observer.observe(plot);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const sourceChanged = previousInput.current.chromatogram !== chromatogram;
    const selectionChanged =
      previousInput.current.selectedStart !== selectedStart ||
      previousInput.current.selectedEnd !== selectedEnd;
    const explicitViewChanged =
      view != null &&
      (previousInput.current.viewFirstBase !== view.firstBase ||
        previousInput.current.viewBasesPerWindow !== view.basesPerWindow ||
        previousInput.current.restorationEpoch !== restorationEpoch);
    previousInput.current = {
      chromatogram,
      restorationEpoch,
      selectedEnd,
      selectedStart,
      viewBasesPerWindow: view?.basesPerWindow,
      viewFirstBase: view?.firstBase,
    };
    if (sourceChanged) {
      selectionAnchor.current = null;
      emittedSelection.current = null;
      if (view == null) {
        setLocalView({
          basesPerWindow: DEFAULT_WINDOW_BASES,
          firstBase: Math.max(
            1,
            (selectedStart ?? 1) - DEFAULT_WINDOW_BASES / 2,
          ),
        });
        setFocusedBase(selectedStart ?? 1);
        return;
      }
    }
    if (!selectionChanged) return;
    const fromPanel =
      emittedSelection.current != null &&
      emittedSelection.current?.start === selectedStart &&
      emittedSelection.current?.end === selectedEnd;
    emittedSelection.current = null;
    if (fromPanel) return;
    selectionAnchor.current = selectedStart ?? null;
    if (selectedStart == null) return;
    const coordinate = Math.max(1, Math.min(baseCount, selectedStart));
    setFocusedBase(coordinate);
    // An explicit view or restore may intentionally leave the selection offscreen.
    if (explicitViewChanged) return;
    if (coordinate >= windowStart && coordinate <= windowEnd) return;
    const next = {
      ...currentView,
      firstBase: Math.max(1, coordinate - Math.floor(windowCapacity / 2)),
    };
    if (view == null) setLocalView(next);
    onViewChange?.(next);
  }, [
    baseCount,
    chromatogram,
    currentView,
    onViewChange,
    restorationEpoch,
    selectedEnd,
    selectedStart,
    view,
    windowCapacity,
    windowEnd,
    windowStart,
  ]);

  useEffect(() => {
    if (pendingFocus.current == null) return;
    const button = baseButtons.current.get(pendingFocus.current);
    if (button == null) return;
    button.focus();
    pendingFocus.current = null;
  }, [focusedBase, windowEnd, windowStart]);

  const sampleStart =
    windowStart <= 1
      ? 0
      : Math.floor(
          (chromatogram.peakLocations[windowStart - 2] +
            chromatogram.peakLocations[windowStart - 1]) /
            2,
        );
  const sampleEnd =
    windowEnd >= baseCount
      ? chromatogram.sampleCount - 1
      : Math.ceil(
          (chromatogram.peakLocations[windowEnd - 1] +
            chromatogram.peakLocations[windowEnd]) /
            2,
        );
  const signal = useMemo(() => {
    const pointBudget = Math.max(
      32,
      Math.min(MAX_TRACE_POINTS, Math.round(plotWidth) * 2),
    );
    const traces = CHANNELS.map(({ base, color }) => ({
      base,
      color,
      points: sampleSignal(
        chromatogram.channels[base],
        sampleStart,
        sampleEnd,
        pointBudget,
      ),
    }));
    let minimum = 0;
    let maximum = 0;
    for (const { points } of traces) {
      for (const { value } of points) {
        minimum = Math.min(minimum, value);
        maximum = Math.max(maximum, value);
      }
    }
    return {
      downsampled: sampleEnd - sampleStart + 1 > pointBudget,
      maximum,
      minimum,
      traces,
    };
  }, [chromatogram, plotWidth, sampleEnd, sampleStart]);

  if (baseCount === 0 || chromatogram.sampleCount === 0) {
    return (
      <p className="text-sm text-token-text-secondary" role="status">
        No called bases with trace samples are available in this record.
      </p>
    );
  }

  const xForSample = (sample: number): number =>
    Math.max(
      0,
      Math.min(
        1,
        (sample - sampleStart) / Math.max(1, sampleEnd - sampleStart),
      ),
    ) *
      (plotWidth - 24) +
    12;
  const yForSignal = (value: number): number =>
    TRACE_HEIGHT -
    TRACE_PADDING -
    ((value - signal.minimum) / Math.max(1, signal.maximum - signal.minimum)) *
      (TRACE_HEIGHT - 2 * TRACE_PADDING);
  const calls = Array.from({ length: visibleBaseCount }, (_, index) => {
    const coordinate = windowStart + index;
    const base = record.sequence[coordinate - 1];
    const sample = chromatogram.peakLocations[coordinate - 1];
    return {
      base,
      color:
        CHANNELS.find((channel) => channel.base === base)?.color ??
        "var(--bio-token-text-secondary, #64748b)",
      coordinate,
      quality: chromatogram.quality?.[coordinate - 1],
      sample,
      selected:
        activeSelection != null &&
        selectionContainsCoordinate(activeSelection, coordinate),
      x: xForSample(sample),
    };
  });
  const hasQuality =
    chromatogram.quality?.some((value) => value != null) ?? false;
  const qualityLabel =
    chromatogram.qualityEncoding === "phred"
      ? "Phred quality"
      : "Source confidence";

  function selectBase(coordinate: number, extend: boolean): void {
    const anchor = extend
      ? (selectionAnchor.current ?? selectedStart ?? coordinate)
      : coordinate;
    selectionAnchor.current = anchor;
    setFocusedBase(coordinate);
    const start = Math.min(anchor, coordinate);
    const end = Math.max(anchor, coordinate);
    emittedSelection.current = { end, start };
    onSelectRange(start, end);
  }

  function changeView(next: ChromatogramViewState): void {
    if (view == null) setLocalView(next);
    onViewChange?.(next);
  }

  function setFirstBase(firstBase: number): void {
    changeView({ ...currentView, firstBase });
  }

  function setRequestedBaseCount(basesPerWindow: number): void {
    changeView({ ...currentView, basesPerWindow });
  }

  function navigateBase(
    event: KeyboardEvent<HTMLButtonElement>,
    coordinate: number,
  ): void {
    let next: number;
    switch (event.key) {
      case "ArrowLeft":
        next = coordinate - 1;
        break;
      case "ArrowRight":
        next = coordinate + 1;
        break;
      case "Home":
        next = 1;
        break;
      case "End":
        next = baseCount;
        break;
      case "PageUp":
        next = coordinate - windowCapacity;
        break;
      case "PageDown":
        next = coordinate + windowCapacity;
        break;
      default:
        return;
    }
    event.preventDefault();
    next = Math.max(1, Math.min(baseCount, next));
    if (next === coordinate) return;
    if (event.shiftKey) {
      selectionAnchor.current ??= selectedStart ?? coordinate;
      selectBase(next, true);
    }
    if (next < windowStart) setFirstBase(next);
    else if (next > windowEnd) setFirstBase(next - windowCapacity + 1);
    pendingFocus.current = next;
    setFocusedBase(next);
  }

  return (
    <section
      aria-label="Chromatogram"
      className="min-w-0 rounded-xl border border-token-border bg-token-main-surface-primary p-3"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-token-text-primary">
            Chromatogram
          </h2>
          <p className="mt-0.5 text-xs text-token-text-secondary">
            {chromatogram.format.toUpperCase()} · Original read orientation
          </p>
        </div>
        <div
          aria-label="Trace channels"
          className="flex gap-3 text-xs font-medium"
        >
          {CHANNELS.map(({ base, color }) => (
            <span className="inline-flex items-center gap-1.5" key={base}>
              <span
                aria-hidden="true"
                className="h-0.5 w-3 rounded-full"
                style={{ backgroundColor: color }}
              />
              {base}
            </span>
          ))}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <p
          className="text-xs tabular-nums text-token-text-secondary"
          aria-live="polite"
        >
          Bases {windowStart.toLocaleString()}–{windowEnd.toLocaleString()} of{" "}
          {baseCount.toLocaleString()}
        </p>
        <div className="flex flex-wrap items-center gap-1">
          <Button
            aria-label="Previous chromatogram window"
            disabled={windowStart === 1}
            onClick={() =>
              setFirstBase(Math.max(1, windowStart - windowCapacity))
            }
            type="button"
          >
            Previous
          </Button>
          <Button
            aria-label="Next chromatogram window"
            disabled={windowEnd === baseCount}
            onClick={() =>
              setFirstBase(Math.min(maximumStart, windowStart + windowCapacity))
            }
            type="button"
          >
            Next
          </Button>
          <Button
            aria-label="Zoom out chromatogram"
            className="ml-1"
            disabled={windowCapacity >= maximumVisibleBases}
            onClick={() =>
              setRequestedBaseCount(
                Math.min(MAX_WINDOW_BASES, windowCapacity * 2),
              )
            }
            type="button"
          >
            −
          </Button>
          <Button
            aria-label="Zoom in chromatogram"
            disabled={windowCapacity <= Math.min(MIN_WINDOW_BASES, baseCount)}
            onClick={() =>
              setRequestedBaseCount(
                Math.max(MIN_WINDOW_BASES, Math.floor(windowCapacity / 2)),
              )
            }
            type="button"
          >
            +
          </Button>
        </div>
      </div>

      <figure
        aria-label={`${record.sourceLabel} chromatogram, bases ${windowStart} to ${windowEnd}, four signal channels in original read orientation`}
        className="m-0 mt-3 min-w-0"
      >
        <div className="relative min-w-0 pt-[72px]" ref={plotRef}>
          <div
            aria-label="Called bases"
            className="absolute inset-x-0 top-0 h-[72px]"
          >
            {calls.map(({ base, color, coordinate, quality, selected, x }) => {
              const confidenceDetails =
                chromatogram.baseConfidences == null
                  ? ""
                  : CHANNELS.map(
                      ({ base: channel }) =>
                        `${channel} confidence ${chromatogram.baseConfidences?.[channel][coordinate - 1]}`,
                    ).join(", ");
              const label = [
                `Base ${coordinate}, ${base}`,
                quality == null ? null : `${qualityLabel} ${quality}`,
                confidenceDetails || null,
              ]
                .filter((part) => part != null)
                .join(", ");
              return (
                <button
                  aria-label={label}
                  aria-pressed={selected}
                  className={`absolute top-0 flex h-12 -translate-x-1/2 flex-col items-center justify-center rounded-md border px-1 font-mono text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500 ${selected ? "border-sky-500/50 bg-sky-500/10" : "border-transparent hover:bg-token-main-surface-secondary"}`}
                  data-coordinate={coordinate}
                  key={coordinate}
                  onClick={(event) => selectBase(coordinate, event.shiftKey)}
                  onFocus={() => setFocusedBase(coordinate)}
                  onKeyDown={(event) => navigateBase(event, coordinate)}
                  ref={(element) => {
                    if (element == null) baseButtons.current.delete(coordinate);
                    else baseButtons.current.set(coordinate, element);
                  }}
                  style={{ color, left: `${(x / plotWidth) * 100}%` }}
                  tabIndex={coordinate === tabStopBase ? 0 : -1}
                  title={label}
                  type="button"
                >
                  <span aria-hidden="true">{base}</span>
                  {hasQuality ? (
                    <span
                      aria-hidden="true"
                      className="mt-0.5 text-[10px] font-normal tabular-nums text-token-text-secondary"
                    >
                      {quality ?? "—"}
                    </span>
                  ) : null}
                  {coordinate === windowStart ||
                  coordinate === windowEnd ||
                  coordinate % 10 === 0 ? (
                    <span
                      aria-hidden="true"
                      className="absolute top-[52px] text-[10px] font-normal tabular-nums text-token-text-secondary"
                    >
                      {coordinate.toLocaleString()}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
          <svg
            aria-hidden="true"
            className="block w-full cursor-crosshair overflow-hidden"
            focusable="false"
            height={TRACE_HEIGHT}
            onClick={(event) => {
              const bounds = event.currentTarget.getBoundingClientRect();
              if (bounds.width === 0) return;
              const x =
                ((event.clientX - bounds.left) / bounds.width) * plotWidth;
              const nearest = calls.reduce((closest, call) =>
                Math.abs(call.x - x) < Math.abs(closest.x - x) ? call : closest,
              );
              selectBase(nearest.coordinate, event.shiftKey);
            }}
            preserveAspectRatio="none"
            viewBox={`0 0 ${plotWidth} ${TRACE_HEIGHT}`}
          >
            {calls
              .filter(({ selected }) => selected)
              .map(({ coordinate, sample }) => {
                const previous =
                  chromatogram.peakLocations[coordinate - 2] ?? sampleStart;
                const next =
                  chromatogram.peakLocations[coordinate] ?? sampleEnd;
                const left = xForSample((previous + sample) / 2);
                const right = xForSample((sample + next) / 2);
                return (
                  <rect
                    fill="#0ea5e9"
                    height={TRACE_HEIGHT}
                    key={coordinate}
                    opacity="0.08"
                    width={Math.max(1, right - left)}
                    x={left}
                  />
                );
              })}
            <line
              stroke="var(--bio-token-text-secondary, #64748b)"
              strokeOpacity="0.2"
              x1="0"
              x2={plotWidth}
              y1={yForSignal(0)}
              y2={yForSignal(0)}
            />
            {signal.traces.map(({ base, color, points }) => (
              <path
                d={points
                  .map(
                    ({ sample, value }, index) =>
                      `${index === 0 ? "M" : "L"}${xForSample(sample).toFixed(2)},${yForSignal(value).toFixed(2)}`,
                  )
                  .join(" ")}
                data-channel={base}
                fill="none"
                key={base}
                stroke={color}
                strokeLinejoin="round"
                strokeWidth="1.5"
                vectorEffect="non-scaling-stroke"
              />
            ))}
          </svg>
        </div>
        <figcaption className="mt-2 flex flex-wrap justify-between gap-2 text-[11px] text-token-text-secondary">
          <span>Signal intensity · auto-scaled per window</span>
          <span>
            {hasQuality
              ? `${qualityLabel} below calls`
              : "No called-base confidence provided"}
          </span>
          {signal.downsampled ? (
            <span>Trace display uses a min/max envelope</span>
          ) : null}
        </figcaption>
      </figure>

      <label className="mt-3 flex items-center gap-3 text-[11px] text-token-text-secondary">
        <span>Position</span>
        <input
          aria-label="Chromatogram window start"
          aria-valuetext={`First displayed base ${windowStart} of ${baseCount}`}
          className="min-w-0 flex-1 accent-sky-600"
          disabled={maximumStart === 1}
          max={maximumStart}
          min={1}
          onChange={(event) => setFirstBase(Number(event.target.value))}
          step={1}
          type="range"
          value={windowStart}
        />
      </label>
      <p className="mt-2 text-[11px] text-token-text-secondary">
        Select a call or peak. Shift extends a selection; arrow keys move
        between calls. Coordinates are 1-based in the original read.
      </p>
    </section>
  );
}

/** Keep each bucket's real minimum and maximum in sample order, including endpoints. */
function sampleSignal(
  values: Array<number>,
  start: number,
  end: number,
  maximumPoints: number,
): Array<SignalPoint> {
  const first = Math.max(0, start);
  const last = Math.min(values.length - 1, end);
  if (last < first) return [];
  const count = last - first + 1;
  if (count <= maximumPoints) {
    return Array.from({ length: count }, (_, index) => ({
      sample: first + index,
      value: values[first + index],
    }));
  }
  const points: Array<SignalPoint> = [{ sample: first, value: values[first] }];
  const bucketSize = Math.ceil(
    (count - 2) / Math.floor((maximumPoints - 2) / 2),
  );
  for (
    let bucketStart = first + 1;
    bucketStart < last;
    bucketStart += bucketSize
  ) {
    const bucketEnd = Math.min(last, bucketStart + bucketSize);
    let minimum = bucketStart;
    let maximum = bucketStart;
    for (let sample = bucketStart + 1; sample < bucketEnd; sample += 1) {
      if (values[sample] < values[minimum]) minimum = sample;
      if (values[sample] > values[maximum]) maximum = sample;
    }
    const earlier = Math.min(minimum, maximum);
    const later = Math.max(minimum, maximum);
    points.push({ sample: earlier, value: values[earlier] });
    if (later !== earlier) points.push({ sample: later, value: values[later] });
  }
  points.push({ sample: last, value: values[last] });
  return points;
}
