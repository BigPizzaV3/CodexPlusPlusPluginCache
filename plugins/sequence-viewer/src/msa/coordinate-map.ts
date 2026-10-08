import { isGapSymbol } from "./residue-alphabet";

export type UngappedProjection = {
  alignmentColumns: Array<number>;
  sequence: string;
};

export function buildUngappedProjection(
  alignedSequence: string,
): UngappedProjection {
  const alignmentColumns: Array<number> = [];
  let sequence = "";
  Array.from(alignedSequence).forEach((symbol, column) => {
    if (isGapSymbol(symbol)) {
      return;
    }
    sequence += symbol;
    alignmentColumns.push(column);
  });
  return { alignmentColumns, sequence };
}

export function getUngappedPosition(
  alignedSequence: string,
  alignmentColumn: number,
): number | null {
  if (alignmentColumn < 0 || alignmentColumn >= alignedSequence.length) {
    return null;
  }
  if (isGapSymbol(alignedSequence[alignmentColumn] ?? "-")) {
    return null;
  }
  let position = 0;
  for (let column = 0; column <= alignmentColumn; column += 1) {
    if (!isGapSymbol(alignedSequence[column] ?? "-")) {
      position += 1;
    }
  }
  return position === 0 ? null : position;
}

export function getUngappedPositionFromProjection(
  projection: UngappedProjection | undefined,
  alignmentColumn: number,
): number | null {
  if (projection == null || alignmentColumn < 0) {
    return null;
  }
  const columns = projection.alignmentColumns;
  let left = 0;
  let right = columns.length - 1;
  while (left <= right) {
    const middle = Math.floor((left + right) / 2);
    const projectedColumn = columns[middle] ?? -1;
    if (projectedColumn === alignmentColumn) {
      return middle + 1;
    }
    if (projectedColumn < alignmentColumn) {
      left = middle + 1;
    } else {
      right = middle - 1;
    }
  }
  return null;
}

export function getAlignmentColumnForUngappedPosition(
  alignedSequence: string,
  ungappedPosition: number,
): number | null {
  if (ungappedPosition <= 0) {
    return null;
  }
  let position = 0;
  for (let column = 0; column < alignedSequence.length; column += 1) {
    if (isGapSymbol(alignedSequence[column] ?? "-")) {
      continue;
    }
    position += 1;
    if (position === ungappedPosition) {
      return column;
    }
  }
  return null;
}
