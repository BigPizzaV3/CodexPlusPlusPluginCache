export type MsaViewportSlice = {
  columnEnd: number;
  columnStart: number;
  rowEnd: number;
  rowStart: number;
  visibleColumnCount: number;
  visibleColumnEnd: number;
  visibleColumnStart: number;
  visibleRowEnd: number;
  visibleRowStart: number;
};

export const MSA_CELL_WIDTH_PX = 25;
export const MSA_ROW_HEIGHT_PX = 20;
export const MSA_ROW_LABEL_WIDTH_PX = 176;

const DEFAULT_VIEWPORT_WIDTH = MSA_CELL_WIDTH_PX * 84;
const DEFAULT_VIEWPORT_HEIGHT = MSA_ROW_HEIGHT_PX * 28;

export function getMsaViewportSlice({
  alignedLength,
  cellWidth = MSA_CELL_WIDTH_PX,
  columnOverscan = 8,
  height,
  rowCount,
  rowOverscan = 8,
  scrollLeft,
  scrollTop,
  staticRowCount,
  width,
}: {
  alignedLength: number;
  cellWidth?: number;
  columnOverscan?: number;
  height: number;
  rowCount: number;
  rowOverscan?: number;
  scrollLeft: number;
  scrollTop: number;
  staticRowCount: number;
  width: number;
}): MsaViewportSlice {
  const resolvedWidth = width > 0 ? width : DEFAULT_VIEWPORT_WIDTH;
  const resolvedHeight = height > 0 ? height : DEFAULT_VIEWPORT_HEIGHT;
  const visibleColumnStart = Math.max(
    0,
    Math.min(alignedLength, Math.floor(scrollLeft / cellWidth)),
  );
  const visibleColumnCount = Math.max(1, Math.ceil(resolvedWidth / cellWidth));
  const visibleColumnEnd = Math.min(
    alignedLength,
    visibleColumnStart + visibleColumnCount,
  );
  const bodyScrollTop = Math.max(
    0,
    scrollTop - staticRowCount * MSA_ROW_HEIGHT_PX,
  );
  const visibleRowStart = Math.max(
    0,
    Math.min(rowCount, Math.floor(bodyScrollTop / MSA_ROW_HEIGHT_PX)),
  );
  const visibleRowCount = Math.max(
    1,
    Math.ceil(resolvedHeight / MSA_ROW_HEIGHT_PX),
  );
  const visibleRowEnd = Math.min(rowCount, visibleRowStart + visibleRowCount);
  return {
    columnEnd: Math.min(alignedLength, visibleColumnEnd + columnOverscan),
    columnStart: Math.max(0, visibleColumnStart - columnOverscan),
    rowEnd: Math.min(rowCount, visibleRowEnd + rowOverscan),
    rowStart: Math.max(0, visibleRowStart - rowOverscan),
    visibleColumnCount,
    visibleColumnEnd,
    visibleColumnStart,
    visibleRowEnd,
    visibleRowStart,
  };
}
