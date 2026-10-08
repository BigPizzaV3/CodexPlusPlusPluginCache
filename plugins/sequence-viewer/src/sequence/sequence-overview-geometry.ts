import { sourceRangeToDisplay, type SequenceOrientation } from "./orientation";
import type {
  SequenceFeature,
  SequenceFeatureSegment,
  SequenceRecord,
} from "./types";

export const MAX_MAP_FEATURES = 200;
export const MAX_MAP_SEGMENTS = 1_200;
export const MAX_MAP_LANES = 6;
export const MIN_MAP_FEATURE_FRACTION = 0.004;

export type MapRange = { end: number; start: number };

export type OverviewFeature = {
  feature: SequenceFeature;
  lane: number;
  segments: Array<MapRange>;
  strand: SequenceFeature["strand"];
};

export type OverviewPlan = {
  features: Array<OverviewFeature>;
  omittedForDensity: number;
  omittedForLimit: number;
  omittedSegments: number;
  remoteSegments: number;
};

/** Coordinates in the record remain source coordinates; only map geometry is oriented. */
export function createOverviewPlan(
  record: SequenceRecord,
  orientation: SequenceOrientation,
  selectedFeatureId?: string,
  circular = record.topology === "circular",
): OverviewPlan {
  const candidates = record.features.slice(0, MAX_MAP_FEATURES);
  const selected =
    selectedFeatureId == null
      ? undefined
      : record.features.find(({ id }) => id === selectedFeatureId);
  if (selected != null) {
    const index = candidates.findIndex(({ id }) => id === selected.id);
    if (index >= 0) candidates.splice(index, 1);
    else if (candidates.length === MAX_MAP_FEATURES) candidates.pop();
    candidates.unshift(selected);
  }
  const plan: OverviewPlan = {
    features: [],
    omittedForDensity: 0,
    omittedForLimit: record.features.length - candidates.length,
    omittedSegments: 0,
    remoteSegments: 0,
  };
  const lanes: Array<Array<MapRange>> = [];
  let examinedSegments = 0;
  let plannedSegments = 0;
  for (const feature of candidates) {
    const sourceSegments: Array<SequenceFeatureSegment> = feature.segments ?? [
      { start: feature.start, end: feature.end },
    ];
    const segments: Array<MapRange> = [];
    for (let index = 0; index < sourceSegments.length; index += 1) {
      if (examinedSegments >= MAX_MAP_SEGMENTS) {
        plan.omittedSegments += sourceSegments.length - index;
        break;
      }
      examinedSegments += 1;
      const segment = sourceSegments[index];
      if (segment == null) continue;
      if (segment.remoteAccession != null) {
        plan.remoteSegments += 1;
        continue;
      }
      for (const local of localMapRanges(
        segment,
        record.length,
        record.topology === "circular",
      )) {
        if (plannedSegments >= MAX_MAP_SEGMENTS) {
          plan.omittedSegments += 1;
          continue;
        }
        plannedSegments += 1;
        segments.push(sourceRangeToDisplay(local, record.length, orientation));
      }
    }
    if (segments.length === 0) continue;
    // Keep adjacent arrows and very short annotations visually separate.
    const gap = record.length * 0.008;
    const available = lanes.findIndex((lane) =>
      segments.every((segment) =>
        lane.every((occupied) => {
          const separated = (offset: number): boolean =>
            segment.end + gap < occupied.start + offset ||
            segment.start - gap > occupied.end + offset;
          return (
            separated(0) &&
            (!circular ||
              (separated(-record.length) && separated(record.length)))
          );
        }),
      ),
    );
    const lane = available >= 0 ? available : lanes.length;
    if (lane === MAX_MAP_LANES) {
      plan.omittedForDensity += 1;
      continue;
    }
    (lanes[lane] ??= []).push(...segments);
    plan.features.push({
      feature,
      lane,
      segments,
      strand:
        orientation === "forward"
          ? feature.strand
          : reverseStrand(feature.strand),
    });
  }
  return plan;
}

export function localMapRanges(
  range: MapRange,
  length: number,
  circular = false,
): Array<MapRange> {
  if (
    length < 1 ||
    !Number.isFinite(range.start) ||
    !Number.isFinite(range.end)
  )
    return [];
  if (range.start > range.end) {
    if (!circular || range.start > length || range.end < 1) return [];
    return [
      { start: Math.max(1, range.start), end: length },
      { start: 1, end: Math.min(length, range.end) },
    ];
  }
  if (range.end < 1 || range.start > length) return [];
  return [
    { start: Math.max(1, range.start), end: Math.min(length, range.end) },
  ];
}

export function coordinateFromFraction(
  fraction: number,
  length: number,
): number {
  if (length <= 1 || !Number.isFinite(length)) return 1;
  const clamped = Number.isFinite(fraction)
    ? Math.max(0, Math.min(1, fraction))
    : 0;
  return Math.max(1, Math.min(length, Math.floor(clamped * length) + 1));
}

export function coordinateFromCircularPoint(
  x: number,
  y: number,
  length: number,
): number {
  const angle = Math.atan2(y, x) + Math.PI / 2;
  return coordinateFromFraction(
    ((angle + Math.PI * 2) % (Math.PI * 2)) / (Math.PI * 2),
    length,
  );
}

export function linearFeaturePath(
  x: number,
  y: number,
  width: number,
  height: number,
  strand: SequenceFeature["strand"],
): string {
  const head = Math.min(8, width / 2);
  if (strand === "+") {
    return `M ${x} ${y} H ${x + width - head} L ${x + width} ${y + height / 2} L ${x + width - head} ${y + height} H ${x} Z`;
  }
  if (strand === "-") {
    return `M ${x + head} ${y} H ${x + width} V ${y + height} H ${x + head} L ${x} ${y + height / 2} Z`;
  }
  return `M ${x} ${y} H ${x + width} V ${y + height} H ${x} Z`;
}

export function circularFeaturePath(
  start: number,
  end: number,
  length: number,
  centerX: number,
  centerY: number,
  radius: number,
  minimumFraction = 0,
): string {
  const { from, to } = circularAngles(start, end, length, minimumFraction);
  const first = polar(centerX, centerY, radius, from);
  if (to - from >= Math.PI * 2) {
    const opposite = polar(centerX, centerY, radius, from + Math.PI);
    return `M ${first} A ${radius} ${radius} 0 1 1 ${opposite} A ${radius} ${radius} 0 1 1 ${first}`;
  }
  return `M ${first} A ${radius} ${radius} 0 ${to - from > Math.PI ? 1 : 0} 1 ${polar(centerX, centerY, radius, to)}`;
}

/** A filled annular arrow; unknown strands are deliberately not assigned a direction. */
export function circularArrowPath(
  range: MapRange,
  length: number,
  center: number,
  radius: number,
  strand: SequenceFeature["strand"],
): string {
  const { from, to } = circularAngles(
    range.start,
    range.end,
    length,
    MIN_MAP_FEATURE_FRACTION,
  );
  const inner = radius - 4;
  const outer = radius + 4;
  const head = Math.min(0.11, (to - from) / 2);
  if (strand === "+") {
    const shoulder = to - head;
    const large = shoulder - from > Math.PI ? 1 : 0;
    return `M ${polar(center, center, inner, from)} A ${inner} ${inner} 0 ${large} 1 ${polar(center, center, inner, shoulder)} L ${polar(center, center, radius, to)} L ${polar(center, center, outer, shoulder)} A ${outer} ${outer} 0 ${large} 0 ${polar(center, center, outer, from)} Z`;
  }
  if (strand === "-") {
    const shoulder = from + head;
    const large = to - shoulder > Math.PI ? 1 : 0;
    return `M ${polar(center, center, inner, to)} A ${inner} ${inner} 0 ${large} 0 ${polar(center, center, inner, shoulder)} L ${polar(center, center, radius, from)} L ${polar(center, center, outer, shoulder)} A ${outer} ${outer} 0 ${large} 1 ${polar(center, center, outer, to)} Z`;
  }
  // Two arcs per edge also represent a feature covering the entire molecule.
  const middle = (from + to) / 2;
  return `M ${polar(center, center, inner, from)} A ${inner} ${inner} 0 0 1 ${polar(center, center, inner, middle)} A ${inner} ${inner} 0 0 1 ${polar(center, center, inner, to)} L ${polar(center, center, outer, to)} A ${outer} ${outer} 0 0 0 ${polar(center, center, outer, middle)} A ${outer} ${outer} 0 0 0 ${polar(center, center, outer, from)} Z`;
}

function circularAngles(
  start: number,
  end: number,
  length: number,
  minimumFraction = 0,
): { from: number; to: number } {
  const safeLength = Math.max(1, length);
  const from = ((start - 1) / safeLength) * Math.PI * 2 - Math.PI / 2;
  const span =
    Math.min(1, Math.max(1, end - start + 1) / safeLength) * Math.PI * 2;
  const visibleSpan = Math.max(span, minimumFraction * Math.PI * 2);
  return {
    from: from + (span - visibleSpan) / 2,
    to: from + (span + visibleSpan) / 2,
  };
}

function polar(
  centerX: number,
  centerY: number,
  radius: number,
  angle: number,
): string {
  return `${(centerX + radius * Math.cos(angle)).toFixed(3)} ${(centerY + radius * Math.sin(angle)).toFixed(3)}`;
}

function reverseStrand(
  strand: SequenceFeature["strand"],
): SequenceFeature["strand"] {
  return strand === "+" ? "-" : strand === "-" ? "+" : strand;
}
