export const HISTORICAL_VIEWER_FILE_ERROR_CODE =
  "SEQUENCE_VIEWER_FILE_EXPIRED";

export function createHistoricalViewerFileError(message: string): Error {
  return new Error(`${HISTORICAL_VIEWER_FILE_ERROR_CODE}: ${message}`);
}

export function getHistoricalViewerFileErrorMessage(
  message: string,
): string | null {
  const markerIndex = message.indexOf(HISTORICAL_VIEWER_FILE_ERROR_CODE);
  if (markerIndex === -1) {
    return null;
  }
  const detail = message
    .slice(markerIndex + HISTORICAL_VIEWER_FILE_ERROR_CODE.length)
    .replace(/^\s*:\s*/, "")
    .trim();
  return (
    detail ||
    "This historical viewer link has expired. Reopen the file from chat."
  );
}
