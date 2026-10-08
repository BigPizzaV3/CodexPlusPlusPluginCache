export function clampSequenceCoordinate(
  coordinate: number,
  sequenceLength: number,
): number {
  if (!Number.isFinite(coordinate) || sequenceLength <= 0) {
    return 1;
  }
  return Math.max(1, Math.min(sequenceLength, Math.trunc(coordinate)));
}

export function normalizeSelectionRange(
  start: number,
  end: number,
): {
  end: number;
  start: number;
} {
  return start <= end ? { end, start } : { end: start, start: end };
}
