import type { SequenceLine } from "./types";

export const SEQUENCE_WRAP_WIDTHS = [40, 50, 60, 80] as const;
export const SEQUENCE_GROUP_SIZE = 10;
export const SEQUENCE_GROUP_GAP_CH = 1;
export const SEQUENCE_RESIDUE_WIDTH_CH = 1.5;

export function buildSequenceLines({
  lineWidth,
  sequenceLength,
}: {
  lineWidth: number;
  sequenceLength: number;
}): Array<SequenceLine> {
  if (lineWidth <= 0 || sequenceLength <= 0) {
    return [];
  }
  return Array.from(
    { length: Math.ceil(sequenceLength / lineWidth) },
    (_, index) => {
      const start = index * lineWidth + 1;
      return {
        end: Math.min(sequenceLength, start + lineWidth - 1),
        index,
        start,
      };
    },
  );
}

export function getVisibleSequenceLineWindow({
  lineCount,
  lineHeight,
  overscanLines = 3,
  scrollTop,
  viewportHeight,
}: {
  lineCount: number;
  lineHeight: number;
  overscanLines?: number;
  scrollTop: number;
  viewportHeight: number;
}): { end: number; start: number } {
  const firstVisible = Math.floor(scrollTop / lineHeight);
  const visibleLineCount = Math.max(1, Math.ceil(viewportHeight / lineHeight));
  return {
    end: Math.min(lineCount, firstVisible + visibleLineCount + overscanLines),
    start: Math.max(0, firstVisible - overscanLines),
  };
}

export function getSequenceLineForCoordinate({
  coordinate,
  lineWidth,
}: {
  coordinate: number;
  lineWidth: number;
}): number {
  return Math.max(0, Math.floor((coordinate - 1) / lineWidth));
}

export function formatSequenceLineGroups(sequence: string): Array<string> {
  return sequence.match(new RegExp(`.{1,${SEQUENCE_GROUP_SIZE}}`, "g")) ?? [];
}

export function getSequenceLineDisplayOffsetCh({
  coordinate,
  lineStart,
}: {
  coordinate: number;
  lineStart: number;
}): number {
  const visibleIndex = Math.max(0, coordinate - lineStart);
  return (
    visibleIndex * SEQUENCE_RESIDUE_WIDTH_CH +
    Math.floor(visibleIndex / SEQUENCE_GROUP_SIZE) * SEQUENCE_GROUP_GAP_CH
  );
}

export function getSequenceLineDisplayWidthCh({
  end,
  lineStart,
  start,
}: {
  end: number;
  lineStart: number;
  start: number;
}): number {
  return (
    getSequenceLineDisplayOffsetCh({ coordinate: end, lineStart }) -
    getSequenceLineDisplayOffsetCh({ coordinate: start, lineStart }) +
    SEQUENCE_RESIDUE_WIDTH_CH
  );
}
