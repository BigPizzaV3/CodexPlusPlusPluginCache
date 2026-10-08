import { useEffect, useMemo, useRef, useState } from "react";

import { getSequenceResidueStyle } from "./colors";
import { normalizeSelectionRange } from "./coordinate-map";
import {
  FeatureTracks,
  getFeatureTrackHeight,
  getMaxFeatureLaneCount,
} from "./feature-tracks";
import {
  formatSequenceLineGroups,
  getSequenceLineForCoordinate,
  getSequenceLineDisplayWidthCh,
  getVisibleSequenceLineWindow,
  SEQUENCE_GROUP_GAP_CH,
  SEQUENCE_RESIDUE_WIDTH_CH,
} from "./sequence-line-layout";
import {
  getMaxTranslationTracksPerLine,
  TranslationTrack,
} from "./translation-track";
import type {
  SequenceFeature,
  SequencePaletteId,
  SequenceRecord,
  SequenceSelection,
} from "./types";
import { selectionContainsCoordinate } from "./selection";

const BASE_LINE_HEIGHT = 56;
const TRANSLATION_TRACK_HEIGHT = 24;
const QUALITY_TRACK_HEIGHT = 36;

export function SequenceRenderer({
  focusCoordinate,
  lineWidth,
  onHoverCoordinate,
  onFocusCoordinate,
  onSelectFeature,
  onSelectionChange,
  paletteId,
  record,
  searchHitRanges,
  selectedFeatureId,
  selection,
  showFeatures,
  showQuality,
  showTranslation,
}: {
  focusCoordinate?: number;
  lineWidth: number;
  onHoverCoordinate: (coordinate: number | null) => void;
  onFocusCoordinate: (coordinate: number) => void;
  onSelectFeature: (feature: SequenceFeature) => void;
  onSelectionChange: (selection: SequenceSelection) => void;
  paletteId: SequencePaletteId;
  record: SequenceRecord;
  searchHitRanges: Array<{ end: number; start: number }>;
  selectedFeatureId?: string;
  selection?: SequenceSelection;
  showFeatures: boolean;
  showQuality: boolean;
  showTranslation: boolean;
}): React.ReactElement {
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const [dragStart, setDragStart] = useState<number | null>(null);
  const [activeCoordinate, setActiveCoordinate] = useState(
    focusCoordinate ?? 1,
  );
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(520);
  const lineCount = Math.ceil(record.sequence.length / lineWidth);
  const translatedFeatures = useMemo(
    () =>
      record.features.filter(
        ({ translation, translationTrackReliable, type }) =>
          type.toLowerCase() === "cds" &&
          translation != null &&
          translationTrackReliable !== false,
      ),
    [record.features],
  );
  const translationTrackCount = useMemo(
    () =>
      showTranslation
        ? getMaxTranslationTracksPerLine({
            features: translatedFeatures,
            lineWidth,
            sequenceLength: record.length,
          })
        : 0,
    [lineWidth, record.length, showTranslation, translatedFeatures],
  );
  const featureTrackHeight =
    showFeatures && record.features.length > 0
      ? getFeatureTrackHeight(getMaxFeatureLaneCount(record.features))
      : 0;
  const lineHeight =
    BASE_LINE_HEIGHT +
    featureTrackHeight +
    TRANSLATION_TRACK_HEIGHT * translationTrackCount +
    (showQuality && record.quality != null ? QUALITY_TRACK_HEIGHT : 0);
  const visibleWindow = useMemo(
    () =>
      getVisibleSequenceLineWindow({
        lineCount,
        lineHeight,
        scrollTop,
        viewportHeight,
      }),
    [lineCount, lineHeight, scrollTop, viewportHeight],
  );
  const visibleLines = useMemo(
    () =>
      Array.from(
        { length: visibleWindow.end - visibleWindow.start },
        (_, offset) => {
          const lineIndex = visibleWindow.start + offset;
          return {
            end: Math.min(record.sequence.length, (lineIndex + 1) * lineWidth),
            start: lineIndex * lineWidth + 1,
          };
        },
      ),
    [lineWidth, record.sequence.length, visibleWindow.end, visibleWindow.start],
  );
  const firstVisibleCoordinate = visibleLines[0]?.start ?? 1;
  const lastVisibleCoordinate = visibleLines.at(-1)?.end ?? record.length;
  const tabStopCoordinate =
    activeCoordinate >= firstVisibleCoordinate &&
    activeCoordinate <= lastVisibleCoordinate
      ? activeCoordinate
      : firstVisibleCoordinate;

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (scroller == null || typeof ResizeObserver === "undefined") {
      return;
    }
    const resizeObserver = new ResizeObserver(([entry]) => {
      const height = entry?.contentRect.height;
      if (height != null && height > 0) {
        setViewportHeight(height);
      }
    });
    resizeObserver.observe(scroller);
    return () => resizeObserver.disconnect();
  }, []);

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (scroller == null || focusCoordinate == null) {
      return;
    }
    const lineIndex = getSequenceLineForCoordinate({
      coordinate: focusCoordinate,
      lineWidth,
    });
    scroller.scrollTop = Math.max(0, lineIndex * lineHeight - lineHeight);
  }, [focusCoordinate, lineHeight, lineWidth]);

  useEffect(() => {
    if (focusCoordinate != null) setActiveCoordinate(focusCoordinate);
  }, [focusCoordinate]);

  const moveKeyboardFocus = (coordinate: number): void => {
    const next = Math.max(1, Math.min(record.length, coordinate));
    setActiveCoordinate(next);
    onFocusCoordinate(next);
    const lineIndex = getSequenceLineForCoordinate({
      coordinate: next,
      lineWidth,
    });
    const nextScrollTop = Math.max(0, lineIndex * lineHeight - lineHeight);
    if (scrollerRef.current != null) {
      scrollerRef.current.scrollTop = nextScrollTop;
      setScrollTop(nextScrollTop);
    }
    window.setTimeout(() => {
      scrollerRef.current
        ?.querySelector<HTMLElement>(`[data-sequence-coordinate="${next}"]`)
        ?.focus();
    }, 0);
  };

  return (
    <section className="overflow-hidden rounded-lg border border-token-border bg-token-main-surface-primary">
      <div className="flex items-center justify-between gap-3 border-b border-token-border px-3 py-2">
        <div>
          <div className="text-xs font-medium tracking-wide text-token-text-tertiary uppercase">
            Sequence
          </div>
          <div className="mt-0.5 text-xs text-token-text-secondary">
            Wrapped at {lineWidth} residues per line ·{" "}
            {lineCount.toLocaleString()} line
            {lineCount === 1 ? "" : "s"}
          </div>
          <div className="mt-0.5 text-[10px] text-token-text-tertiary">
            Arrow, Home/End, and Page keys navigate; hold Shift to select a
            range.
          </div>
        </div>
        <div className="text-xs text-token-text-tertiary">
          visible lines {visibleWindow.start + 1}–{visibleWindow.end}
        </div>
      </div>
      <div
        aria-label="Wrapped sequence view"
        aria-colcount={lineWidth}
        aria-rowcount={lineCount}
        className="bio-sequence-scroller max-h-[64vh] overflow-auto bg-token-main-surface-primary p-3"
        onMouseLeave={() => onHoverCoordinate(null)}
        onMouseUp={() => setDragStart(null)}
        onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
        ref={scrollerRef}
        role="grid"
      >
        <div
          className="relative"
          style={{
            minHeight: `${Math.max(1, lineCount) * lineHeight}px`,
            minWidth: `calc(${getSequenceLineDisplayWidthCh({ end: Math.min(lineWidth, record.length), lineStart: 1, start: 1 })}ch + 8rem)`,
          }}
        >
          <div
            className="absolute inset-x-0"
            style={{ top: `${visibleWindow.start * lineHeight}px` }}
          >
            {visibleLines.map((line) => {
              const lineSequence = record.sequence.slice(
                line.start - 1,
                line.end,
              );
              return (
                <SequenceLineRow
                  key={`${record.id}-${line.start}`}
                  lineEnd={line.end}
                  lineHeight={lineHeight}
                  lineSequence={lineSequence}
                  lineStart={line.start}
                  activeCoordinate={tabStopCoordinate}
                  lineWidth={lineWidth}
                  moveKeyboardFocus={moveKeyboardFocus}
                  onFocusCoordinate={onFocusCoordinate}
                  onHoverCoordinate={onHoverCoordinate}
                  onSelectFeature={onSelectFeature}
                  onSelectionChange={onSelectionChange}
                  paletteId={paletteId}
                  record={record}
                  searchHitRanges={searchHitRanges}
                  selectedFeatureId={selectedFeatureId}
                  selection={selection}
                  setDragStart={setDragStart}
                  showFeatures={showFeatures}
                  showQuality={showQuality}
                  showTranslation={showTranslation}
                  translatedFeatures={translatedFeatures}
                  dragStart={dragStart}
                />
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

function SequenceLineRow({
  activeCoordinate,
  dragStart,
  lineEnd,
  lineHeight,
  lineSequence,
  lineStart,
  lineWidth,
  moveKeyboardFocus,
  onFocusCoordinate,
  onHoverCoordinate,
  onSelectFeature,
  onSelectionChange,
  paletteId,
  record,
  searchHitRanges,
  selectedFeatureId,
  selection,
  setDragStart,
  showFeatures,
  showQuality,
  showTranslation,
  translatedFeatures,
}: {
  activeCoordinate: number;
  dragStart: number | null;
  lineEnd: number;
  lineHeight: number;
  lineSequence: string;
  lineStart: number;
  lineWidth: number;
  moveKeyboardFocus: (coordinate: number) => void;
  onFocusCoordinate: (coordinate: number) => void;
  onHoverCoordinate: (coordinate: number | null) => void;
  onSelectFeature: (feature: SequenceFeature) => void;
  onSelectionChange: (selection: SequenceSelection) => void;
  paletteId: SequencePaletteId;
  record: SequenceRecord;
  searchHitRanges: Array<{ end: number; start: number }>;
  selectedFeatureId?: string;
  selection?: SequenceSelection;
  setDragStart: (coordinate: number | null) => void;
  showFeatures: boolean;
  showQuality: boolean;
  showTranslation: boolean;
  translatedFeatures: Array<SequenceFeature>;
}): React.ReactElement {
  return (
    <div className="bio-sequence-line" style={{ height: lineHeight }}>
      {showFeatures ? (
        <FeatureTracks
          features={record.features}
          lineEnd={lineEnd}
          lineStart={lineStart}
          onSelectFeature={onSelectFeature}
          selectedFeatureId={selectedFeatureId}
        />
      ) : null}
      <div
        aria-rowindex={Math.floor((lineStart - 1) / lineWidth) + 1}
        className="bio-sequence-track-row"
        role="row"
      >
        <span className="bio-sequence-coordinate bio-sequence-coordinate-start">
          {lineStart}
        </span>
        <div className="flex items-center text-token-text-primary">
          {formatSequenceLineGroups(lineSequence).map((group, groupIndex) => (
            <span
              className="inline-flex items-center"
              data-sequence-group={groupIndex + 1}
              key={`${lineStart}-${groupIndex}`}
              style={{
                marginLeft: groupIndex === 0 ? 0 : `${SEQUENCE_GROUP_GAP_CH}ch`,
              }}
            >
              {[...group].map((residue, groupResidueIndex) => {
                const visibleIndex = groupIndex * 10 + groupResidueIndex;
                const coordinate = lineStart + visibleIndex;
                const residueStyle = getSequenceResidueStyle({
                  molecule: record.molecule,
                  paletteId,
                  residue,
                });
                const isSelected =
                  selection != null &&
                  selection.recordId === record.id &&
                  selectionContainsCoordinate(selection, coordinate);
                const isSearchHit = searchHitRanges.some(
                  ({ end, start }) => coordinate >= start && coordinate <= end,
                );
                return (
                  <button
                    aria-label={`${record.sourceLabel} position ${coordinate} ${residue}`}
                    aria-colindex={visibleIndex + 1}
                    aria-selected={isSelected}
                    className="bio-sequence-residue"
                    key={`${coordinate}-${residue}`}
                    data-sequence-coordinate={coordinate}
                    data-search-hit={isSearchHit || undefined}
                    onFocus={() => {
                      onFocusCoordinate(coordinate);
                      onHoverCoordinate(coordinate);
                    }}
                    onKeyDown={(event) => {
                      let next: number | null = null;
                      if (event.key === "ArrowLeft") next = coordinate - 1;
                      else if (event.key === "ArrowRight")
                        next = coordinate + 1;
                      else if (event.key === "ArrowUp")
                        next = coordinate - lineWidth;
                      else if (event.key === "ArrowDown")
                        next = coordinate + lineWidth;
                      else if (event.key === "Home") next = lineStart;
                      else if (event.key === "End") next = lineEnd;
                      else if (event.key === "PageUp")
                        next = coordinate - lineWidth * 10;
                      else if (event.key === "PageDown")
                        next = coordinate + lineWidth * 10;
                      if (next != null) {
                        event.preventDefault();
                        const normalizedNext = Math.max(
                          1,
                          Math.min(record.length, next),
                        );
                        if (event.shiftKey) {
                          const anchor = dragStart ?? coordinate;
                          const range = normalizeSelectionRange(
                            anchor,
                            normalizedNext,
                          );
                          setDragStart(anchor);
                          onSelectionChange({ ...range, recordId: record.id });
                        } else {
                          setDragStart(null);
                        }
                        moveKeyboardFocus(normalizedNext);
                      }
                    }}
                    onMouseDown={() => setDragStart(coordinate)}
                    onMouseEnter={() => {
                      onHoverCoordinate(coordinate);
                      if (dragStart == null) {
                        return;
                      }
                      const range = normalizeSelectionRange(
                        dragStart,
                        coordinate,
                      );
                      onSelectionChange({ ...range, recordId: record.id });
                    }}
                    onMouseUp={() => {
                      if (dragStart == null) {
                        return;
                      }
                      const range = normalizeSelectionRange(
                        dragStart,
                        coordinate,
                      );
                      onSelectionChange({ ...range, recordId: record.id });
                      setDragStart(null);
                    }}
                    style={{
                      ...residueStyle,
                      width: `${SEQUENCE_RESIDUE_WIDTH_CH}ch`,
                    }}
                    title={`${record.sourceLabel} ${coordinate}: ${residue}`}
                    role="gridcell"
                    tabIndex={coordinate === activeCoordinate ? 0 : -1}
                    type="button"
                  >
                    {residue}
                  </button>
                );
              })}
            </span>
          ))}
        </div>
        <span className="bio-sequence-coordinate">{lineEnd}</span>
      </div>
      {showTranslation
        ? translatedFeatures.map((feature) => (
            <TranslationTrack
              feature={feature}
              key={feature.id}
              lineEnd={lineEnd}
              lineStart={lineStart}
              paletteId={paletteId}
            />
          ))
        : null}
      {showQuality && record.quality != null ? (
        <div className="bio-sequence-track-row bio-sequence-quality-row">
          <span className="bio-sequence-track-label">Q</span>
          <div className="flex h-7 items-end">
            {formatSequenceLineGroups(lineSequence).map((group, groupIndex) => (
              <span
                className="inline-flex h-7 items-end"
                data-quality-group={groupIndex + 1}
                key={`${lineStart}-quality-${groupIndex}`}
                style={{
                  marginLeft:
                    groupIndex === 0 ? 0 : `${SEQUENCE_GROUP_GAP_CH}ch`,
                }}
              >
                {record.quality?.phred
                  .slice(
                    lineStart - 1 + groupIndex * 10,
                    lineStart - 1 + groupIndex * 10 + group.length,
                  )
                  .map((score, groupResidueIndex) => {
                    const coordinate =
                      lineStart + groupIndex * 10 + groupResidueIndex;
                    return (
                      <span
                        aria-label={`Base ${coordinate} quality ${score}`}
                        className="bio-sequence-quality-bar"
                        key={`${coordinate}-${score}`}
                        style={{
                          height: `${Math.max(3, Math.min(28, score))}px`,
                          width: `${SEQUENCE_RESIDUE_WIDTH_CH}ch`,
                        }}
                        title={`Base ${coordinate}: Q${score}`}
                      />
                    );
                  })}
              </span>
            ))}
          </div>
          <span />
        </div>
      ) : null}
    </div>
  );
}
