export type SequenceViewportWindow = {
  end: number;
  start: number;
};

export { getVisibleSequenceLineWindow } from "./sequence-line-layout";

export function getVisibleSequenceWindow({
  cellWidth,
  overscanColumns = 12,
  scrollLeft,
  sequenceLength,
  viewportWidth,
}: {
  cellWidth: number;
  overscanColumns?: number;
  scrollLeft: number;
  sequenceLength: number;
  viewportWidth: number;
}): SequenceViewportWindow {
  const firstVisible = Math.floor(scrollLeft / cellWidth);
  const visibleColumnCount = Math.max(1, Math.ceil(viewportWidth / cellWidth));
  return {
    end: Math.min(
      sequenceLength,
      firstVisible + visibleColumnCount + overscanColumns,
    ),
    start: Math.max(0, firstVisible - overscanColumns),
  };
}
