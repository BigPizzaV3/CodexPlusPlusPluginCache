import { useMemo, useState, type KeyboardEvent, type MouseEvent } from "react";

import {
  sourceCoordinateToDisplay,
  sourceRangeToDisplay,
  type SequenceOrientation,
} from "./orientation";
import { getSelectionSegments } from "./selection";
import {
  circularArrowPath,
  circularFeaturePath,
  coordinateFromCircularPoint,
  coordinateFromFraction,
  createOverviewPlan,
  linearFeaturePath,
  localMapRanges,
  MAX_MAP_FEATURES,
  MAX_MAP_SEGMENTS,
  MIN_MAP_FEATURE_FRACTION,
  type MapRange,
  type OverviewFeature,
} from "./sequence-overview-geometry";
import type {
  SequenceFeature,
  SequenceFeatureSegment,
  SequenceRecord,
  SequenceSelection,
} from "./types";

export {
  circularFeaturePath,
  coordinateFromFraction,
} from "./sequence-overview-geometry";

const MAP_WIDTH = 1_000;
const MAP_INSET = 24;
const CIRCULAR_SIZE = 400;
const MAX_MAP_LABELS = 12;
export const SEQUENCE_ANNOTATION_PAGE_SIZE = 30;
const ANNOTATION_QUERY_LIMIT = 500;

export type SequenceAnnotationIndexState = {
  query: string;
  page: number;
  expanded: boolean;
};

export function normalizeSequenceAnnotationIndexState(
  record: SequenceRecord,
  state: SequenceAnnotationIndexState,
): SequenceAnnotationIndexState {
  const query = state.query.slice(0, ANNOTATION_QUERY_LIMIT);
  const lastPage = Math.max(
    0,
    Math.ceil(
      annotationIndexMatches(record, query).length /
        SEQUENCE_ANNOTATION_PAGE_SIZE,
    ) - 1,
  );
  const requestedPage = Number.isFinite(state.page)
    ? Math.floor(state.page)
    : 0;
  return {
    ...state,
    query,
    page: Math.max(0, Math.min(requestedPage, lastPage)),
  };
}

type AnnotationIndexControl = SequenceAnnotationIndexState & {
  onChange: (patch: Partial<SequenceAnnotationIndexState>) => void;
};

type SequenceOverviewProps = {
  annotationIndex?: AnnotationIndexControl;
  layout: "circular" | "linear" | "split";
  onJump: (coordinate: number) => void;
  onSelectRange: (start: number, end: number, wraparound: boolean) => void;
  onSelectFeature: (featureId: string) => void;
  orientation: SequenceOrientation;
  originRangeExpanded?: boolean;
  onOriginRangeExpandedChange?: (expanded: boolean) => void;
  record: SequenceRecord;
  selectedFeatureId?: string;
  selection?: SequenceSelection;
  synchronizedViews: boolean;
  viewport: MapRange | null;
};

export function SequenceOverview({
  annotationIndex,
  layout,
  onJump,
  onSelectRange,
  onSelectFeature,
  orientation,
  originRangeExpanded,
  onOriginRangeExpandedChange,
  record,
  selectedFeatureId,
  selection,
  synchronizedViews,
  viewport,
}: SequenceOverviewProps): React.ReactElement {
  const plan = useMemo(
    () =>
      createOverviewPlan(
        record,
        orientation,
        selectedFeatureId,
        layout !== "linear",
      ),
    [record, orientation, selectedFeatureId, layout],
  );
  const sourceSelection =
    selection?.recordId === record.id ? getSelectionSegments(selection) : [];
  const selectionRanges = sourceSelection
    .slice(0, MAX_MAP_SEGMENTS)
    .flatMap((range) =>
      localMapRanges(range, record.length, record.topology === "circular").map(
        (local) => sourceRangeToDisplay(local, record.length, orientation),
      ),
    );
  const viewportRange =
    viewport == null
      ? null
      : sourceRangeToDisplay(viewport, record.length, orientation);
  const mapProps: MapProps = {
    features: plan.features,
    navigationCoordinate: sourceCoordinateToDisplay(
      selection?.recordId === record.id
        ? selection.start
        : (viewport?.start ?? 1),
      record.length,
      orientation,
    ),
    onJump,
    onSelectFeature,
    orientation,
    record,
    selectedFeatureId,
    selectionRanges,
    viewport: viewportRange,
  };
  const bounded =
    plan.omittedForDensity > 0 ||
    plan.omittedForLimit > 0 ||
    plan.omittedSegments > 0;
  const isNarrow = ({ start, end }: MapRange): boolean =>
    (end - start + 1) / record.length < MIN_MAP_FEATURE_FRACTION;
  const minimumWidthMarkers =
    plan.features.some(({ segments }) => segments.some(isNarrow)) ||
    selectionRanges.some(isNarrow) ||
    (viewportRange != null && isNarrow(viewportRange));
  return (
    <section
      aria-label="Sequence overview and navigation"
      className="overflow-hidden rounded-xl border border-token-border bg-token-main-surface-primary"
      data-testid="sequence-overview"
    >
      <div className="flex flex-wrap items-start justify-between gap-2 border-b border-token-border px-4 py-3">
        <div>
          <h2 className="text-xs font-semibold text-token-text-primary">
            Sequence map
          </h2>
          <p className="mt-1 text-[11px] text-token-text-secondary">
            {record.length.toLocaleString()} {sequenceUnit(record)} ·{" "}
            {record.topology === "circular"
              ? "Circular"
              : record.topology === "linear"
                ? "Linear"
                : "Topology unspecified"}
            {orientation === "reverse-complement"
              ? " · Reverse complement"
              : ""}
          </p>
        </div>
        <span className="text-[10px] text-token-text-tertiary">
          Source coordinates · 1-based, inclusive
          {synchronizedViews ? " · Linked to sequence" : ""}
        </span>
      </div>

      <div className="p-4">
        {layout === "split" ? <LinearMap {...mapProps} /> : null}
        <div
          className={
            layout === "split"
              ? "mt-4 grid gap-4 border-t border-token-border pt-4 md:grid-cols-[minmax(14rem,1fr)_minmax(14rem,1fr)]"
              : layout === "circular"
                ? "grid gap-4 md:grid-cols-[minmax(14rem,1fr)_minmax(14rem,1fr)]"
                : "space-y-3"
          }
        >
          {layout === "linear" ? (
            <LinearMap {...mapProps} />
          ) : (
            <CircularMap {...mapProps} />
          )}
          {record.features.length === 0 ? (
            <p className="self-center text-xs text-token-text-tertiary">
              No annotations are loaded.
            </p>
          ) : (
            <FeatureNavigator
              compact={layout === "linear"}
              control={annotationIndex}
              key={record.id}
              mapFeatures={plan.features}
              onSelectFeature={onSelectFeature}
              record={record}
              selectedFeatureId={selectedFeatureId}
            />
          )}
        </div>

        {bounded ||
        minimumWidthMarkers ||
        plan.remoteSegments > 0 ||
        sourceSelection.length > MAX_MAP_SEGMENTS ? (
          <p
            className="mt-3 border-t border-token-border pt-3 text-[11px] leading-relaxed text-token-text-secondary"
            data-testid="sequence-map-limits"
          >
            {bounded ? (
              <>
                Map shows {plan.features.length.toLocaleString()} of{" "}
                {record.features.length.toLocaleString()} annotations.{" "}
              </>
            ) : null}
            {plan.omittedForLimit > 0 ? (
              <>The overview is limited to {MAX_MAP_FEATURES} annotations. </>
            ) : null}
            {plan.omittedForDensity > 0 ? (
              <>
                Overlapping annotations that do not fit on separate lanes remain
                in the annotation index.{" "}
              </>
            ) : null}
            {plan.omittedSegments > 0 ? (
              <>
                The segment limit omits {plan.omittedSegments.toLocaleString()}{" "}
                additional intervals from this overview.{" "}
              </>
            ) : null}
            {plan.remoteSegments > 0 ? (
              <>Remote-accession intervals are not drawn on this molecule. </>
            ) : null}
            {sourceSelection.length > MAX_MAP_SEGMENTS ? (
              <>
                Only the first {MAX_MAP_SEGMENTS.toLocaleString()} selection
                intervals are highlighted.{" "}
              </>
            ) : null}
            {minimumWidthMarkers ? (
              <>
                Very short intervals use a minimum display width; source
                coordinates remain exact.{" "}
              </>
            ) : null}
            {bounded ? (
              <>
                Select any annotation in the index to prioritize it on the map.
              </>
            ) : null}
          </p>
        ) : null}
        {record.topology === "circular" ? (
          <OriginSelection
            expanded={originRangeExpanded}
            key={record.id}
            length={record.length}
            onSelectRange={onSelectRange}
            onExpandedChange={onOriginRangeExpandedChange}
          />
        ) : null}
      </div>
    </section>
  );
}

type MapProps = {
  features: Array<OverviewFeature>;
  navigationCoordinate: number;
  onJump: (coordinate: number) => void;
  onSelectFeature: (featureId: string) => void;
  orientation: SequenceOrientation;
  record: SequenceRecord;
  selectedFeatureId?: string;
  selectionRanges: Array<MapRange>;
  viewport: MapRange | null;
};

function LinearMap({
  features,
  navigationCoordinate,
  onJump,
  onSelectFeature,
  orientation,
  record,
  selectedFeatureId,
  selectionRanges,
  viewport,
}: MapProps): React.ReactElement {
  const lanes = Math.max(1, ...features.map(({ lane }) => lane + 1));
  const height = 42 + lanes * 20;
  const axisY = height - 9;
  return (
    <div className="min-w-0" data-testid="linear-sequence-map">
      <div className="mb-2 flex items-center justify-between gap-2 text-[10px] text-token-text-tertiary">
        <span>Linear map</span>
        <span>Click a feature to inspect · click the ruler to navigate</span>
      </div>
      <svg
        aria-label={`Linear map of ${record.sourceLabel}`}
        className="w-full cursor-crosshair overflow-visible text-token-text-secondary"
        onClick={(event) => {
          const bounds = event.currentTarget.getBoundingClientRect();
          const x =
            bounds.width <= 0
              ? 0
              : ((event.clientX - bounds.left) / bounds.width) * MAP_WIDTH;
          const display = coordinateFromFraction(
            (x - MAP_INSET) / (MAP_WIDTH - MAP_INSET * 2),
            record.length,
          );
          onJump(
            sourceCoordinateToDisplay(display, record.length, orientation),
          );
        }}
        preserveAspectRatio="none"
        role="group"
        style={{ height }}
        viewBox={`0 0 ${MAP_WIDTH} ${height}`}
      >
        <title>{`Linear map of ${record.sourceLabel}`}</title>
        <rect fill="transparent" height={height} width={MAP_WIDTH} />
        {selectionRanges.map((range, index) => (
          <rect
            className="pointer-events-none"
            data-selection-range={`${range.start}-${range.end}`}
            fill="rgb(20 184 166 / 0.12)"
            height={axisY + 7}
            key={`selection-${index}`}
            rx="3"
            stroke="rgb(13 148 136 / 0.5)"
            strokeWidth="1"
            width={rangeWidth(range, record.length)}
            x={scaleCoordinate(range.start, record.length)}
            y="1"
          />
        ))}
        {viewport == null ? null : (
          <rect
            className="pointer-events-none"
            fill="none"
            height={axisY + 7}
            rx="3"
            stroke="currentColor"
            strokeDasharray="4 4"
            strokeOpacity="0.45"
            width={rangeWidth(viewport, record.length)}
            x={scaleCoordinate(viewport.start, record.length)}
            y="1"
          >
            <title>Active sequence range</title>
          </rect>
        )}
        <line
          stroke="currentColor"
          strokeOpacity="0.3"
          x1={MAP_INSET}
          x2={MAP_WIDTH - MAP_INSET}
          y1={axisY}
          y2={axisY}
        />
        {rulerCoordinates(record.length).map((coordinate) => {
          const x = scaleCoordinate(coordinate, record.length);
          return (
            <g key={coordinate}>
              <line
                stroke="currentColor"
                strokeOpacity="0.35"
                x1={x}
                x2={x}
                y1={axisY}
                y2={axisY + 5}
              />
            </g>
          );
        })}
        {features.map((item) => (
          <FeatureGlyph
            feature={item.feature}
            key={item.feature.id}
            onSelectFeature={onSelectFeature}
            selected={item.feature.id === selectedFeatureId}
          >
            {item.segments.map((segment, index) => (
              <path
                d={linearFeaturePath(
                  scaleCoordinate(segment.start, record.length),
                  12 + item.lane * 20,
                  rangeWidth(segment, record.length),
                  11,
                  item.strand,
                )}
                data-feature-segment={`${segment.start}-${segment.end}`}
                fill={featureColor(item.feature.type)}
                key={index}
                stroke={
                  item.feature.id === selectedFeatureId
                    ? "currentColor"
                    : "none"
                }
                strokeWidth="2"
                vectorEffect="non-scaling-stroke"
              />
            ))}
          </FeatureGlyph>
        ))}
      </svg>
      <div className="relative h-4 font-mono text-[10px] text-token-text-tertiary">
        {rulerCoordinates(record.length).map((coordinate) => (
          <span
            className="absolute whitespace-nowrap"
            key={coordinate}
            style={{
              left: `${(scaleCoordinate(coordinate, record.length) / MAP_WIDTH) * 100}%`,
              transform: `translateX(${coordinate === 1 ? 0 : coordinate === record.length ? -100 : -50}%)`,
            }}
            title={sourceCoordinateToDisplay(
              coordinate,
              record.length,
              orientation,
            ).toLocaleString()}
          >
            {formatRulerCoordinate(
              sourceCoordinateToDisplay(coordinate, record.length, orientation),
            )}
          </span>
        ))}
      </div>
      <MapKeyboardNavigation
        length={record.length}
        onJump={onJump}
        orientation={orientation}
        position={navigationCoordinate}
      />
    </div>
  );
}

function CircularMap({
  features,
  navigationCoordinate,
  onJump,
  onSelectFeature,
  orientation,
  record,
  selectedFeatureId,
  selectionRanges,
  viewport,
}: MapProps): React.ReactElement {
  const center = CIRCULAR_SIZE / 2;
  return (
    <div className="min-w-0" data-testid="circular-sequence-map">
      <div className="flex items-center justify-between gap-2 text-[10px] text-token-text-tertiary">
        <span>Circular map</span>
        {record.topology !== "circular" ? (
          <span>Display only · topology unchanged</span>
        ) : null}
      </div>
      <svg
        aria-label={`Circular map of ${record.sourceLabel}`}
        className="mx-auto block w-full max-w-[21rem] cursor-crosshair text-token-text-secondary"
        onClick={(event) => {
          const bounds = event.currentTarget.getBoundingClientRect();
          const x = event.clientX - bounds.left - bounds.width / 2;
          const y = event.clientY - bounds.top - bounds.height / 2;
          if (Math.hypot(x, y) < bounds.width * 0.18) return;
          const display = coordinateFromCircularPoint(x, y, record.length);
          onJump(
            sourceCoordinateToDisplay(display, record.length, orientation),
          );
        }}
        role="group"
        viewBox={`0 0 ${CIRCULAR_SIZE} ${CIRCULAR_SIZE}`}
      >
        <title>{`Circular map of ${record.sourceLabel}`}</title>
        <circle
          cx={center}
          cy={center}
          fill="none"
          r="92"
          stroke="currentColor"
          strokeOpacity="0.2"
        />
        <circle
          cx={center}
          cy={center}
          fill="none"
          r="160"
          stroke="currentColor"
          strokeOpacity="0.1"
        />
        {viewport == null ? null : (
          <path
            d={circularFeaturePath(
              viewport.start,
              viewport.end,
              record.length,
              center,
              center,
              86,
              MIN_MAP_FEATURE_FRACTION,
            )}
            fill="none"
            stroke="currentColor"
            strokeDasharray="3 3"
            strokeOpacity="0.55"
            strokeWidth="3"
          >
            <title>Active sequence range</title>
          </path>
        )}
        {selectionRanges.map((segment, index) => (
          <path
            className="pointer-events-none"
            d={circularFeaturePath(
              segment.start,
              segment.end,
              record.length,
              center,
              center,
              80,
              MIN_MAP_FEATURE_FRACTION,
            )}
            data-selection-range={`${segment.start}-${segment.end}`}
            fill="none"
            key={index}
            stroke="rgb(13 148 136)"
            strokeWidth="4"
          />
        ))}
        {[0, 0.25, 0.5, 0.75].map((fraction) => {
          const angle = fraction * Math.PI * 2 - Math.PI / 2;
          return (
            <g key={fraction}>
              <line
                stroke="currentColor"
                strokeOpacity="0.35"
                x1={center + 158 * Math.cos(angle)}
                x2={center + 164 * Math.cos(angle)}
                y1={center + 158 * Math.sin(angle)}
                y2={center + 164 * Math.sin(angle)}
              />
              <text
                dominantBaseline="middle"
                fill="currentColor"
                fontSize="11"
                textAnchor="middle"
                x={center + 174 * Math.cos(angle)}
                y={center + 174 * Math.sin(angle)}
              >
                {formatRulerCoordinate(
                  sourceCoordinateToDisplay(
                    coordinateFromFraction(fraction, record.length),
                    record.length,
                    orientation,
                  ),
                )}
                <title>
                  {sourceCoordinateToDisplay(
                    coordinateFromFraction(fraction, record.length),
                    record.length,
                    orientation,
                  ).toLocaleString()}
                </title>
              </text>
            </g>
          );
        })}
        {features.map((item) => (
          <FeatureGlyph
            feature={item.feature}
            key={item.feature.id}
            onSelectFeature={onSelectFeature}
            selected={item.feature.id === selectedFeatureId}
          >
            {item.segments.map((segment, index) => (
              <path
                d={circularArrowPath(
                  segment,
                  record.length,
                  center,
                  100 + item.lane * 10,
                  item.strand,
                )}
                data-feature-segment={`${segment.start}-${segment.end}`}
                fill={featureColor(item.feature.type)}
                key={index}
                stroke={
                  item.feature.id === selectedFeatureId
                    ? "currentColor"
                    : "none"
                }
                strokeWidth="1.5"
              />
            ))}
          </FeatureGlyph>
        ))}
        <text
          fill="currentColor"
          fontSize="15"
          fontWeight="600"
          textAnchor="middle"
          x={center}
          y={center - 3}
        >
          {record.sourceLabel.length > 19
            ? `${record.sourceLabel.slice(0, 18)}…`
            : record.sourceLabel}
          <title>{record.sourceLabel}</title>
        </text>
        <text
          fill="currentColor"
          fontSize="13"
          opacity="0.65"
          textAnchor="middle"
          x={center}
          y={center + 17}
        >
          {record.length.toLocaleString()} {sequenceUnit(record)}
        </text>
      </svg>
      <MapKeyboardNavigation
        length={record.length}
        onJump={onJump}
        orientation={orientation}
        position={navigationCoordinate}
      />
    </div>
  );
}

function FeatureGlyph({
  children,
  feature,
  onSelectFeature,
  selected,
}: {
  children: React.ReactNode;
  feature: SequenceFeature;
  onSelectFeature: (id: string) => void;
  selected: boolean;
}): React.ReactElement {
  return (
    <g
      aria-label={`Select ${featureLabel(feature)}`}
      aria-pressed={selected}
      className="cursor-pointer outline-none [&:focus-visible>path]:stroke-token-text-primary [&:focus-visible>path]:stroke-[3] [&:hover>path]:brightness-110"
      data-feature-id={feature.id}
      data-selected={selected ? "true" : undefined}
      onClick={(event: MouseEvent<SVGGElement>) => {
        event.stopPropagation();
        onSelectFeature(feature.id);
      }}
      onKeyDown={(event: KeyboardEvent<SVGGElement>) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        event.stopPropagation();
        onSelectFeature(feature.id);
      }}
      role="button"
      tabIndex={0}
    >
      <title>
        {featureLabel(feature)}
        {feature.sourceLocation == null
          ? ""
          : ` · ${feature.sourceLocation.slice(0, 512)}${feature.sourceLocation.length > 512 ? "…" : ""}`}
      </title>
      {children}
    </g>
  );
}

function FeatureNavigator({
  compact,
  control,
  mapFeatures,
  onSelectFeature,
  record,
  selectedFeatureId,
}: {
  compact: boolean;
  control?: AnnotationIndexControl;
  mapFeatures: ReadonlyArray<OverviewFeature>;
  onSelectFeature: (id: string) => void;
  record: SequenceRecord;
  selectedFeatureId?: string;
}): React.ReactElement {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const [expanded, setExpanded] = useState<boolean>();
  const state = control ?? { query, page, expanded: expanded ?? !compact };
  const update = (patch: Partial<SequenceAnnotationIndexState>): void => {
    if (control != null) {
      control.onChange(patch);
      return;
    }
    if (patch.query != null) setQuery(patch.query);
    if (patch.page != null) setPage(patch.page);
    if (patch.expanded != null) setExpanded(patch.expanded);
  };
  const matches = useMemo(
    () => annotationIndexMatches(record, state.query),
    [state.query, record.features],
  );
  const pageCount = Math.max(
    1,
    Math.ceil(matches.length / SEQUENCE_ANNOTATION_PAGE_SIZE),
  );
  const currentPage = Math.max(0, Math.min(state.page, pageCount - 1));
  const start = currentPage * SEQUENCE_ANNOTATION_PAGE_SIZE;
  return (
    <div className="min-w-0 self-start">
      <details
        open={state.expanded}
        onToggle={(event) => {
          if (event.currentTarget.open !== state.expanded)
            update({ expanded: event.currentTarget.open });
        }}
      >
        <summary className="cursor-pointer text-xs font-medium text-token-text-primary">
          Annotation index{" "}
          <span className="ml-1 font-normal text-token-text-tertiary">
            {record.features.length.toLocaleString()}
          </span>
        </summary>
        <div className="mt-3">
          <input
            aria-label="Find annotation in map index"
            className="w-full rounded-md border border-token-border bg-token-input-background px-2.5 py-1.5 text-xs text-token-text-primary outline-none focus:border-token-focus-border"
            maxLength={ANNOTATION_QUERY_LIMIT}
            onChange={(event) => {
              update({ query: event.target.value, page: 0 });
            }}
            placeholder="Find an annotation…"
            type="search"
            value={state.query}
          />
          <div
            aria-label="Map annotation index"
            className="mt-2 max-h-56 overflow-auto"
            role="list"
          >
            {matches
              .slice(start, start + SEQUENCE_ANNOTATION_PAGE_SIZE)
              .map((feature) => (
                <div key={feature.id} role="listitem">
                  <button
                    aria-label={featureLabel(feature)}
                    aria-pressed={selectedFeatureId === feature.id}
                    className={`flex w-full items-start gap-2 rounded-md px-2 py-2 text-left text-xs outline-none hover:bg-token-main-surface-secondary focus-visible:ring-2 focus-visible:ring-token-focus-border ${selectedFeatureId === feature.id ? "bg-token-main-surface-secondary ring-1 ring-inset ring-token-border" : ""}`}
                    onClick={() => onSelectFeature(feature.id)}
                    title={feature.sourceLocation?.slice(0, 512)}
                    type="button"
                  >
                    <span
                      aria-hidden="true"
                      className="mt-1 h-2 w-2 shrink-0 rounded-sm"
                      style={{ backgroundColor: featureColor(feature.type) }}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium text-token-text-primary">
                        {feature.label ?? feature.type}
                      </span>
                      <span className="mt-0.5 block truncate font-mono text-[10px] text-token-text-tertiary">
                        {formatFeatureCoordinates(feature)} · {feature.strand}
                      </span>
                    </span>
                    <span className="shrink-0 text-[10px] text-token-text-tertiary">
                      {feature.type}
                    </span>
                  </button>
                </div>
              ))}
            {matches.length === 0 ? (
              <p className="py-4 text-xs text-token-text-tertiary">
                No matching annotations.
              </p>
            ) : null}
          </div>
          <div className="mt-2 flex items-center justify-between gap-2 border-t border-token-border pt-2 text-[10px] text-token-text-tertiary">
            <span aria-live="polite">
              {matches.length === 0
                ? "0"
                : `${start + 1}–${Math.min(start + SEQUENCE_ANNOTATION_PAGE_SIZE, matches.length)}`}{" "}
              of {matches.length.toLocaleString()}
              {state.query.trim() === "" ? " annotations" : " matches"}
            </span>
            {pageCount > 1 ? (
              <span className="flex gap-1">
                <button
                  aria-label="Previous annotation page"
                  className={pageButtonClass}
                  disabled={currentPage === 0}
                  onClick={() => update({ page: currentPage - 1 })}
                  type="button"
                >
                  Previous
                </button>
                <button
                  aria-label="Next annotation page"
                  className={pageButtonClass}
                  disabled={currentPage === pageCount - 1}
                  onClick={() => update({ page: currentPage + 1 })}
                  type="button"
                >
                  Next
                </button>
              </span>
            ) : null}
          </div>
        </div>
      </details>
      {!state.expanded && mapFeatures.length > 0 ? (
        <CompactMapFeatureLabels
          compact={compact}
          features={mapFeatures}
          onBrowseIndex={() => update({ expanded: true })}
          onSelectFeature={onSelectFeature}
          selectedFeatureId={selectedFeatureId}
          totalAnnotations={record.features.length}
        />
      ) : null}
    </div>
  );
}

function CompactMapFeatureLabels({
  compact,
  features,
  onBrowseIndex,
  onSelectFeature,
  selectedFeatureId,
  totalAnnotations,
}: {
  compact: boolean;
  features: ReadonlyArray<OverviewFeature>;
  onBrowseIndex: () => void;
  onSelectFeature: (id: string) => void;
  selectedFeatureId?: string;
  totalAnnotations: number;
}): React.ReactElement {
  const labels = features.slice(0, MAX_MAP_LABELS);
  return (
    <div className="mt-3">
      <ul
        aria-label="Visible map annotation labels"
        className={
          compact ? "grid gap-1 sm:grid-cols-2 lg:grid-cols-3" : "space-y-1"
        }
      >
        {labels.map(({ feature }) => (
          <li key={feature.id}>
            <button
              aria-label={`Inspect ${featureLabel(feature)} from map labels`}
              aria-pressed={feature.id === selectedFeatureId}
              className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs outline-none hover:bg-token-main-surface-secondary focus-visible:ring-2 focus-visible:ring-token-focus-border ${feature.id === selectedFeatureId ? "bg-token-main-surface-secondary ring-1 ring-inset ring-token-border" : ""}`}
              onClick={() => onSelectFeature(feature.id)}
              title={featureLabel(feature)}
              type="button"
            >
              <span
                aria-hidden="true"
                className="h-2 w-2 shrink-0 rounded-sm"
                style={{ backgroundColor: featureColor(feature.type) }}
              />
              <span className="min-w-0 flex-1 truncate font-medium text-token-text-primary">
                {feature.label ?? feature.type}
              </span>
              <span className="shrink-0 text-[10px] text-token-text-tertiary">
                {feature.type} · {feature.strand}
              </span>
            </button>
          </li>
        ))}
      </ul>
      {totalAnnotations > labels.length ? (
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-token-border pt-2 text-[10px] text-token-text-tertiary">
          <span>
            {labels.length} of {features.length.toLocaleString()} mapped
            annotations
          </span>
          <button
            className={pageButtonClass}
            onClick={onBrowseIndex}
            type="button"
          >
            Browse all {totalAnnotations.toLocaleString()} annotations
          </button>
        </div>
      ) : null}
    </div>
  );
}

function OriginSelection({
  expanded,
  length,
  onExpandedChange,
  onSelectRange,
}: {
  expanded?: boolean;
  length: number;
  onExpandedChange?: (expanded: boolean) => void;
  onSelectRange: SequenceOverviewProps["onSelectRange"];
}): React.ReactElement {
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [error, setError] = useState<string>();
  const [localExpanded, setLocalExpanded] = useState(false);
  return (
    <details
      className="mt-3 border-t border-token-border pt-3"
      open={expanded ?? localExpanded}
      onToggle={(event) => {
        if (event.currentTarget.open === (expanded ?? localExpanded)) return;
        if (onExpandedChange != null)
          onExpandedChange(event.currentTarget.open);
        else setLocalExpanded(event.currentTarget.open);
      }}
    >
      <summary className="cursor-pointer text-[11px] text-token-text-secondary">
        Select across the origin
      </summary>
      <form
        className="mt-2 flex flex-wrap items-center gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          const first = Number(start);
          const last = Number(end);
          if (
            !Number.isInteger(first) ||
            !Number.isInteger(last) ||
            first <= last ||
            last < 1 ||
            first > length
          ) {
            setError(
              `Use source coordinates from 1–${length.toLocaleString()}, with start greater than end.`,
            );
            return;
          }
          setError(undefined);
          onSelectRange(first, last, true);
        }}
      >
        <input
          aria-label="Origin-spanning selection start"
          className={coordinateInputClass}
          max={length}
          min="1"
          onChange={(event) => setStart(event.target.value)}
          placeholder="Start"
          required
          step="1"
          type="number"
          value={start}
        />
        <span className="text-[11px] text-token-text-tertiary">
          through origin to
        </span>
        <input
          aria-label="Origin-spanning selection end"
          className={coordinateInputClass}
          max={length}
          min="1"
          onChange={(event) => setEnd(event.target.value)}
          placeholder="End"
          required
          step="1"
          type="number"
          value={end}
        />
        <button className={pageButtonClass} type="submit">
          Select range
        </button>
        {error == null ? null : (
          <p
            className="w-full text-[11px] text-token-text-secondary"
            role="alert"
          >
            {error}
          </p>
        )}
      </form>
    </details>
  );
}

/** Every map has a keyboard route to the same source-coordinate jump callback. */
function MapKeyboardNavigation({
  length,
  onJump,
  orientation,
  position,
}: {
  length: number;
  onJump: (coordinate: number) => void;
  orientation: SequenceOrientation;
  position: number;
}): React.ReactElement {
  return (
    <input
      aria-label="Navigate map by coordinate"
      aria-valuetext={`Source coordinate ${sourceCoordinateToDisplay(Math.min(position, Math.max(1, length)), length, orientation).toLocaleString()}`}
      className="sr-only focus:not-sr-only focus:mt-2 focus:block focus:w-full"
      max={Math.max(1, length)}
      min="1"
      onChange={(event) => {
        const value = Number(event.target.value);
        onJump(sourceCoordinateToDisplay(value, length, orientation));
      }}
      step="1"
      type="range"
      value={Math.min(position, Math.max(1, length))}
    />
  );
}

const coordinateInputClass =
  "w-24 rounded-md border border-token-border bg-token-input-background px-2 py-1.5 text-xs text-token-text-primary outline-none focus:border-token-focus-border";
const pageButtonClass =
  "rounded-md border border-token-border px-2 py-1 text-[11px] text-token-text-secondary outline-none hover:bg-token-main-surface-secondary focus-visible:ring-2 focus-visible:ring-token-focus-border disabled:cursor-default disabled:opacity-40";

function annotationIndexMatches(
  record: SequenceRecord,
  query: string,
): Array<SequenceFeature> {
  const normalized = query
    .slice(0, ANNOTATION_QUERY_LIMIT)
    .trim()
    .toLowerCase();
  return normalized === ""
    ? record.features
    : record.features.filter((feature) =>
        `${feature.label ?? ""} ${feature.type}`
          .toLowerCase()
          .includes(normalized),
      );
}

function scaleCoordinate(coordinate: number, length: number): number {
  return (
    MAP_INSET +
    ((coordinate - 1) / Math.max(1, length)) * (MAP_WIDTH - MAP_INSET * 2)
  );
}

function rangeWidth(range: MapRange, length: number): number {
  return Math.max(
    4,
    ((range.end - range.start + 1) / Math.max(1, length)) *
      (MAP_WIDTH - MAP_INSET * 2),
  );
}

function rulerCoordinates(length: number): Array<number> {
  if (length < 2) return [1];
  return [
    ...new Set([
      1,
      ...[0.25, 0.5, 0.75].map((fraction) =>
        coordinateFromFraction(fraction, length),
      ),
      length,
    ]),
  ];
}

function formatFeatureCoordinates(feature: SequenceFeature): string {
  const segments: Array<SequenceFeatureSegment> = feature.segments ?? [
    { start: feature.start, end: feature.end },
  ];
  const ranges = segments
    .slice(0, 3)
    .map(
      (segment) =>
        `${segment.remoteAccession == null ? "" : `${segment.remoteAccession}:`}${segment.partialStart ? "<" : ""}${segment.start.toLocaleString()}–${segment.partialEnd ? ">" : ""}${segment.end.toLocaleString()}`,
    );
  return `${ranges.join(", ")}${segments.length > 3 ? ` +${(segments.length - 3).toLocaleString()} intervals` : ""}`;
}

function formatRulerCoordinate(coordinate: number): string {
  return coordinate < 100_000
    ? coordinate.toLocaleString()
    : coordinate.toLocaleString(undefined, {
        notation: "compact",
        maximumFractionDigits: 1,
      });
}

function featureLabel(feature: SequenceFeature): string {
  return `${feature.label ?? feature.type} · ${feature.type} · ${formatFeatureCoordinates(feature)} · ${feature.strand} strand`;
}

function sequenceUnit(record: SequenceRecord): string {
  return record.molecule === "protein"
    ? "aa"
    : record.molecule === "dna"
      ? "bp"
      : record.molecule === "rna"
        ? "nt"
        : "residues";
}

function featureColor(type: string): string {
  const normalized = type.toLowerCase();
  if (normalized === "cds") return "rgb(59 130 196)";
  if (normalized.includes("gene")) return "rgb(128 111 185)";
  if (normalized.includes("promoter")) return "rgb(196 145 51)";
  if (normalized.includes("repeat")) return "rgb(187 105 144)";
  if (normalized.includes("terminator")) return "rgb(191 116 83)";
  return "rgb(53 153 140)";
}
