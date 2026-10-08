import type { SequenceFeature, SequenceFeatureSegment } from "./types";

export type ParsedFeatureLocation = {
  end: number;
  segments: Array<SequenceFeatureSegment>;
  start: number;
  strand: SequenceFeature["strand"];
  translationTrackReliable: boolean;
  translationMappingUnavailableReason?: string;
};

export function parseFeatureLocation(
  sourceLocation: string,
): ParsedFeatureLocation | null {
  const parsed = parseLocationNode(sourceLocation.replaceAll(/\s+/g, ""), "+");
  if (parsed == null || parsed.segments.length === 0) {
    return null;
  }
  const localSegments = parsed.segments.filter(
    ({ remoteAccession }) => remoteAccession == null,
  );
  if (localSegments.length === 0) {
    return null;
  }
  const translationMappingUnavailableReason =
    getMappingUnavailableReason(parsed);
  return {
    end: Math.max(...localSegments.map(({ end }) => end)),
    segments: parsed.segments,
    start: Math.min(...localSegments.map(({ start }) => start)),
    strand: parsed.strand,
    translationTrackReliable:
      parsed.segments.every(
        (segment) =>
          segment.remoteAccession == null &&
          segment.partialStart !== true &&
          segment.partialEnd !== true,
      ) &&
      parsed.ambiguous !== true &&
      parsed.strand !== "?",
    ...(translationMappingUnavailableReason == null
      ? {}
      : { translationMappingUnavailableReason }),
  };
}

export function getLocalFeatureSegments(
  feature: SequenceFeature,
): Array<SequenceFeatureSegment> {
  return (
    feature.segments ?? [{ end: feature.end, start: feature.start }]
  ).filter(({ remoteAccession }) => remoteAccession == null);
}

export function featureContainsCoordinate(
  feature: SequenceFeature,
  coordinate: number,
): boolean {
  return getLocalFeatureSegments(feature).some(
    ({ end, start }) => start <= coordinate && end >= coordinate,
  );
}

export function featureOverlapsRange(
  feature: SequenceFeature,
  start: number,
  end: number,
): boolean {
  return getLocalFeatureSegments(feature).some(
    (segment) => segment.start <= end && segment.end >= start,
  );
}

type ParsedLocationNode = {
  ambiguous?: boolean;
  segments: Array<SequenceFeatureSegment>;
  strand: SequenceFeature["strand"];
};

function getMappingUnavailableReason(
  parsed: ParsedLocationNode,
): string | undefined {
  if (parsed.segments.some(({ remoteAccession }) => remoteAccession != null)) {
    return "remote segment";
  }
  if (
    parsed.segments.some(
      ({ partialEnd, partialStart }) =>
        partialEnd === true || partialStart === true,
    )
  ) {
    return "partial boundary";
  }
  if (parsed.strand === "?") return "mixed strand";
  if (parsed.ambiguous === true) return "ordered or between-base location";
  return undefined;
}

function parseLocationNode(
  location: string,
  strand: SequenceFeature["strand"],
): ParsedLocationNode | null {
  const operator = /^(complement|join|order)\((.*)\)$/.exec(location);
  if (operator != null) {
    const operatorName = operator[1];
    const inner = operator[2] ?? "";
    if (operatorName === "complement") {
      const child = parseLocationNode(inner, strand === "+" ? "-" : "+");
      return child == null
        ? null
        : { ...child, segments: [...child.segments].reverse() };
    }
    const children = splitTopLevel(inner, ",")
      .map((part) => parseLocationNode(part, strand))
      .filter((value): value is ParsedLocationNode => value != null);
    if (children.length === 0) {
      return null;
    }
    const strands = new Set(
      children.map(({ strand: childStrand }) => childStrand),
    );
    return {
      ambiguous:
        operatorName === "order" ||
        children.some(({ ambiguous }) => ambiguous === true),
      segments: children.flatMap(({ segments }) => segments),
      strand: strands.size === 1 ? children[0]?.strand ?? strand : "?",
    };
  }

  const simpleLocation =
    /^(?:([^:(),]+):)?([<>]?)(\d+)(?:(\.\.|\^)([<>]?)(\d+))?$/.exec(location);
  if (simpleLocation == null) {
    return null;
  }
  const first = Number(simpleLocation[3]);
  const second = Number(simpleLocation[6] ?? simpleLocation[3]);
  return {
    ambiguous: simpleLocation[4] === "^",
    segments: [
      {
        end: Math.max(first, second),
        partialEnd: simpleLocation[5] === ">",
        partialStart: simpleLocation[2] === "<",
        remoteAccession: simpleLocation[1] || undefined,
        start: Math.min(first, second),
      },
    ],
    strand,
  };
}

function splitTopLevel(value: string, separator: string): Array<string> {
  const parts: Array<string> = [];
  let depth = 0;
  let start = 0;
  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];
    if (character === "(") {
      depth += 1;
    } else if (character === ")") {
      depth = Math.max(0, depth - 1);
    } else if (character === separator && depth === 0) {
      parts.push(value.slice(start, index));
      start = index + 1;
    }
  }
  parts.push(value.slice(start));
  return parts.filter((part) => part.length > 0);
}
