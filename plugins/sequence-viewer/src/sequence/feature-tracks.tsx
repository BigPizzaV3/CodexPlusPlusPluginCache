import {
  getSequenceLineDisplayOffsetCh,
  getSequenceLineDisplayWidthCh,
} from "./sequence-line-layout";
import { getLocalFeatureSegments } from "./feature-location";
import type { SequenceFeature, SequenceFeatureLane } from "./types";

const FEATURE_LANE_HEIGHT_PX = 22;
const FEATURE_TRACK_VERTICAL_PADDING_PX = 4;

export function FeatureTracks({
  features,
  lineEnd,
  lineStart,
  selectedFeatureId,
  onSelectFeature,
}: {
  features: Array<SequenceFeature>;
  lineEnd: number;
  lineStart: number;
  onSelectFeature: (feature: SequenceFeature) => void;
  selectedFeatureId?: string;
}): React.ReactElement | null {
  const featureLanes = getVisibleFeatureLanes({ features, lineEnd, lineStart });
  if (featureLanes.length === 0) {
    return null;
  }
  const laneCount = Math.max(
    ...featureLanes.map(({ laneIndex }) => laneIndex + 1),
  );

  return (
    <div className="bio-sequence-track-row">
      <span className="bio-sequence-track-label">Features</span>
      <div
        aria-label="Sequence feature tracks"
        className="relative"
        style={{ height: `${getFeatureTrackHeight(laneCount)}px` }}
      >
        {featureLanes.map(({ end, feature, laneIndex, start }) => {
          const left = getSequenceLineDisplayOffsetCh({
            coordinate: start,
            lineStart,
          });
          const width = getSequenceLineDisplayWidthCh({
            end,
            lineStart,
            start,
          });
          const label = getFeatureDisplayLabel(feature);
          return (
            <button
              aria-label={
                getLocalFeatureSegments(feature).length > 1
                  ? `Select ${feature.type} feature ${label} segment ${start}-${end}`
                  : `Select ${feature.type} feature ${label}`
              }
              aria-pressed={feature.id === selectedFeatureId}
              className="bio-sequence-feature absolute overflow-hidden rounded px-2"
              data-feature-lane={laneIndex}
              data-feature-strand={feature.strand}
              key={`${feature.id}-${start}-${end}`}
              onClick={() => onSelectFeature(feature)}
              style={{
                clipPath: getFeatureClipPath(feature.strand),
                height: `${FEATURE_LANE_HEIGHT_PX - 4}px`,
                left: `${left}ch`,
                top: `${FEATURE_TRACK_VERTICAL_PADDING_PX + laneIndex * FEATURE_LANE_HEIGHT_PX}px`,
                width: `${width}ch`,
              }}
              title={`${label} · ${feature.start}–${feature.end} · ${feature.strand}`}
              type="button"
            >
              <span className="truncate text-[10px] font-medium">{label}</span>
            </button>
          );
        })}
      </div>
      <span />
    </div>
  );
}

export function getFeatureDisplayLabel(feature: SequenceFeature): string {
  return feature.label ?? feature.type ?? feature.id;
}

export function getFeatureTrackHeight(laneCount: number): number {
  return laneCount <= 0
    ? 0
    : FEATURE_TRACK_VERTICAL_PADDING_PX * 2 +
        laneCount * FEATURE_LANE_HEIGHT_PX;
}

export function getMaxFeatureLaneCount(
  features: Array<SequenceFeature>,
): number {
  return getFeatureLaneCount(features);
}

export function getVisibleFeatureLanes({
  features,
  lineEnd,
  lineStart,
}: {
  features: Array<SequenceFeature>;
  lineEnd: number;
  lineStart: number;
}): Array<SequenceFeatureLane> {
  const featureLaneById = new Map(
    assignFeatureLanes(
      features.map((feature) => ({
        end: feature.end,
        feature,
        start: feature.start,
      })),
    ).map(({ feature, laneIndex }) => [feature.id, laneIndex]),
  );
  return features.flatMap((feature) =>
    getLocalFeatureSegments(feature).flatMap((segment) =>
      segment.start <= lineEnd && segment.end >= lineStart
        ? [
            {
              end: Math.min(lineEnd, segment.end),
              feature,
              laneIndex: featureLaneById.get(feature.id) ?? 0,
              start: Math.max(lineStart, segment.start),
            },
          ]
        : [],
    ),
  );
}

function getFeatureLaneCount(features: Array<SequenceFeature>): number {
  const lanes = assignFeatureLanes(
    features.map((feature) => ({
      end: feature.end,
      feature,
      start: feature.start,
    })),
  );
  return lanes.length === 0
    ? 0
    : Math.max(...lanes.map(({ laneIndex }) => laneIndex + 1));
}

function assignFeatureLanes(
  features: Array<{ end: number; feature: SequenceFeature; start: number }>,
): Array<SequenceFeatureLane> {
  const laneEndCoordinates: Array<number> = [];
  return [...features]
    .sort(
      (leftFeature, rightFeature) =>
        leftFeature.start - rightFeature.start ||
        leftFeature.end - rightFeature.end ||
        leftFeature.feature.id.localeCompare(rightFeature.feature.id),
    )
    .map(({ end, feature, start }) => {
      const availableLaneIndex = laneEndCoordinates.findIndex(
        (laneEnd) => start > laneEnd,
      );
      const laneIndex =
        availableLaneIndex === -1
          ? laneEndCoordinates.length
          : availableLaneIndex;
      laneEndCoordinates[laneIndex] = end;
      return { end, feature, laneIndex, start };
    });
}

function getFeatureClipPath(
  strand: SequenceFeature["strand"],
): string | undefined {
  switch (strand) {
    case "+":
      return "polygon(0 0, calc(100% - 0.6rem) 0, 100% 50%, calc(100% - 0.6rem) 100%, 0 100%)";
    case "-":
      return "polygon(0.6rem 0, 100% 0, 100% 100%, 0.6rem 100%, 0 50%)";
    case ".":
    case "?":
      return undefined;
  }
}
