import { featureOverlapsRange } from "./feature-location";
import type {
  SequenceFeature,
  SequenceRecord,
  SequenceSelection,
} from "./types";

export type SequenceSelectionSegment = { end: number; start: number };

export function createOriginSpanningSelection({
  end,
  record,
  start,
}: {
  end: number;
  record: SequenceRecord;
  start: number;
}): SequenceSelection {
  if (record.topology !== "circular") {
    throw new Error("Origin-spanning selections require a circular record.");
  }
  if (start < 1 || start > record.length || end < 1 || end > record.length) {
    throw new Error(`Selection endpoints must be within 1-${record.length}.`);
  }
  if (start <= end) {
    throw new Error(
      "An origin-spanning selection must start after it ends. Use a linear selection for this range.",
    );
  }
  return {
    end,
    recordId: record.id,
    segments: [
      { end: record.length, start },
      { end, start: 1 },
    ],
    start,
  };
}

export function getSelectionSegments(
  selection: SequenceSelection,
): Array<SequenceSelectionSegment> {
  return selection.segments ?? [
    {
      end: Math.max(selection.start, selection.end),
      start: Math.min(selection.start, selection.end),
    },
  ];
}

export function getSelectionLength(selection: SequenceSelection): number {
  return getSelectionSegments(selection).reduce(
    (sum, segment) => sum + segment.end - segment.start + 1,
    0,
  );
}

export function extractSelectedSequence(
  record: SequenceRecord,
  selection: SequenceSelection,
  maxLength = Number.POSITIVE_INFINITY,
): string {
  let remaining = maxLength;
  const chunks: Array<string> = [];
  for (const segment of getSelectionSegments(selection)) {
    if (remaining <= 0) break;
    const chunk = record.sequence.slice(
      segment.start - 1,
      Math.min(segment.end, segment.start - 1 + remaining),
    );
    chunks.push(chunk);
    remaining -= chunk.length;
  }
  return chunks.join("");
}

export function selectionContainsCoordinate(
  selection: SequenceSelection,
  coordinate: number,
): boolean {
  return getSelectionSegments(selection).some(
    ({ end, start }) => coordinate >= start && coordinate <= end,
  );
}

export function selectionOverlapsFeature(
  selection: SequenceSelection,
  feature: SequenceFeature,
): boolean {
  return getSelectionSegments(selection).some(({ end, start }) =>
    featureOverlapsRange(feature, start, end),
  );
}

export function summarizeSelectedQuality(
  record: SequenceRecord,
  selection: SequenceSelection,
): { max: number; mean: number; min: number } | null {
  if (record.quality == null) return null;
  let count = 0;
  let max = Number.NEGATIVE_INFINITY;
  let min = Number.POSITIVE_INFINITY;
  let total = 0;
  for (const { end, start } of getSelectionSegments(selection)) {
    for (let index = start - 1; index < end; index += 1) {
      const value = record.quality.phred[index];
      if (value == null) continue;
      count += 1;
      max = Math.max(max, value);
      min = Math.min(min, value);
      total += value;
    }
  }
  return count === 0 ? null : { max, mean: total / count, min };
}
