import type { SequenceDocument } from "./types";

export function PerformanceBanners({
  document,
}: {
  document: SequenceDocument;
}): React.ReactElement | null {
  const selectedRecord = document.records[0];
  const inventory = document.recordInventory;
  const isLargeFastq =
    document.kind === "fastq" &&
    (document.records.length > 100 || (selectedRecord?.length ?? 0) > 5_000);
  if (!isLargeFastq && inventory?.truncated !== true) {
    return null;
  }

  if (document.kind !== "fastq") {
    const sourceLength = selectedRecord?.metadata.indexed_source_length;
    const previewLength =
      typeof sourceLength === "string" &&
      selectedRecord?.metadata.indexed_preview === "true"
        ? Number(sourceLength)
        : undefined;

    return (
      <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-token-text-primary">
        Large {document.format.toUpperCase()} optimized mode: indexed{" "}
        {(inventory?.totalCount ?? document.records.length).toLocaleString()}{" "}
        sequence records; interactive browsing retains the first{" "}
        {(
          inventory?.materializedCount ?? document.records.length
        ).toLocaleString()} within the documented memory budget.
        {previewLength == null || !Number.isSafeInteger(previewLength)
          ? null
          : ` The first record retains ${selectedRecord.length.toLocaleString()} of ${previewLength.toLocaleString()} residues.`}
      </div>
    );
  }

  const totalCount = inventory?.totalCount ?? document.records.length;
  const summaryCount = document.fastqSummary?.readCount ?? totalCount;
  const summaryScope =
    summaryCount < totalCount
      ? `the first ${summaryCount.toLocaleString()} of ${totalCount.toLocaleString()} indexed reads`
      : `all ${totalCount.toLocaleString()} parsed reads`;

  return (
    <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-token-text-primary">
      Large FASTQ optimized mode: summary statistics cover {summaryScope};
      interactive browsing retains the first{" "}
      {(
        inventory?.materializedCount ?? document.records.length
      ).toLocaleString()}
      {inventory?.truncated === true
        ? " within the documented memory budget"
        : ""}
      .
    </div>
  );
}
