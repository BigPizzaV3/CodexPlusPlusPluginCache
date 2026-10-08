import { useState } from "react";

import { useWorkbenchFeedback } from "../ui/workbench-feedback";
import type {
  PreparedSequenceWorkspaceArtifact,
  SequenceWorkspaceArtifactPublisher,
} from "../views/workbench-persistence";
import type { SequenceWorkspaceChunkProducer } from "../views/workspace-artifact-stream";
import {
  createFastaWorkspaceProducer,
  createFastqWorkspaceProducer,
  createSelectedFastaWorkspaceProducer,
} from "../views/workspace-export-producers";
import { WorkspacePublishButton } from "../workspace-publish-button";
import {
  buildFastaExport,
  buildFastqExport,
  buildSelectedSequenceExport,
  getSequenceExportFileName,
} from "./exports";
import type {
  SequenceDocument,
  SequenceRecord,
  SequenceSelection,
} from "./types";

const actionClass =
  "rounded-lg border border-token-border bg-token-bg-primary px-3 py-1.5 text-xs font-medium text-token-text-primary hover:bg-token-bg-tertiary disabled:cursor-not-allowed disabled:opacity-50";
const MAX_MANUAL_COPY_BYTES = 128 * 1_024;

type CopyFeedback =
  | { status: "copied" }
  | { status: "manual"; value: string }
  | { status: "unavailable" };

export function ExportActions({
  document,
  publishWorkspaceArtifact,
  record,
  selection,
  sourceRevision,
}: {
  document: SequenceDocument;
  publishWorkspaceArtifact?: SequenceWorkspaceArtifactPublisher;
  record: SequenceRecord;
  selection?: SequenceSelection;
  sourceRevision: number;
}): React.ReactElement {
  const [copyFeedback, setCopyFeedback] = useState<CopyFeedback>();
  const dismissCopyFeedback = useWorkbenchFeedback({
    id: "sequence.copy-feedback",
    kind: "copy",
    label: "Copy feedback",
    onDismiss: () => setCopyFeedback(undefined),
    visible: copyFeedback != null,
  });
  const sourceGtfRecords =
    publishWorkspaceArtifact?.supportsNativeRichGeneration === true &&
    sourceRevision === 0
      ? projectSourceFeatureRecords(document)
      : undefined;

  async function copyText(value: string): Promise<void> {
    setCopyFeedback(undefined);
    if (value.length === 0) {
      return;
    }
    try {
      if (navigator.clipboard?.writeText == null) {
        throw new Error("The Clipboard API is unavailable.");
      }
      await navigator.clipboard.writeText(value);
      setCopyFeedback({ status: "copied" });
    } catch {
      if (
        value.length > MAX_MANUAL_COPY_BYTES ||
        new TextEncoder().encode(value).byteLength > MAX_MANUAL_COPY_BYTES
      ) {
        setCopyFeedback({ status: "unavailable" });
      } else if (copyWithSelection(value)) {
        setCopyFeedback({ status: "copied" });
      } else {
        setCopyFeedback({ status: "manual", value });
      }
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      <button
        className={actionClass}
        onClick={() => void copyText(buildFastaExport([record]))}
        type="button"
      >
        Copy record FASTA
      </button>
      {publishWorkspaceArtifact == null ? null : (
        <WorkspacePublishButton
          artifact={workspaceArtifact({
            createChunks: createFastaWorkspaceProducer([record]),
            format: "fasta",
            kind: "record-fasta",
            mediaType: "text/x-fasta",
            name: getSequenceExportFileName({ record, suffix: "fasta" }),
            sourceRevision,
          })}
          className={actionClass}
          label="Publish record FASTA"
          publisher={publishWorkspaceArtifact}
        />
      )}
      <button
        className={actionClass}
        onClick={() => void copyText(buildFastaExport(document.records))}
        type="button"
      >
        Copy all FASTA
      </button>
      {publishWorkspaceArtifact == null ? null : (
        <WorkspacePublishButton
          artifact={
            sourceRevision === 0 &&
            document.format === "fasta" &&
            document.recordInventory?.truncated === true
              ? serverWorkspaceArtifact({
                  format: "fasta",
                  kind: "canonical-source-fasta",
                  mediaType: "text/x-fasta",
                  name: "sequences.fasta",
                  sourceRevision,
                })
              : workspaceArtifact({
                  createChunks: createFastaWorkspaceProducer(document.records),
                  format: "fasta",
                  kind: "all-fasta",
                  mediaType: "text/x-fasta",
                  name:
                    document.records.length === 1
                      ? getSequenceExportFileName({ record, suffix: "fasta" })
                      : "sequences.fasta",
                  sourceRevision,
                })
          }
          className={actionClass}
          label="Publish all FASTA"
          publisher={publishWorkspaceArtifact}
        />
      )}
      {selection == null ? null : (
        <>
          <button
            className={actionClass}
            onClick={() =>
              void copyText(
                buildSelectedSequenceExport({ document, selection }),
              )
            }
            type="button"
          >
            Copy selected range
          </button>
          {publishWorkspaceArtifact == null ? null : (
            <WorkspacePublishButton
              artifact={workspaceArtifact({
                createChunks: createSelectedFastaWorkspaceProducer(
                  document,
                  selection,
                ),
                format: "fasta",
                kind: "selected-range-fasta",
                mediaType: "text/x-fasta",
                name: getSequenceExportFileName({
                  record,
                  selection,
                  suffix: "fasta",
                }),
                sourceRevision,
              })}
              className={actionClass}
              label="Publish selected range"
              publisher={publishWorkspaceArtifact}
            />
          )}
        </>
      )}
      {record.quality == null ? null : (
        <>
          <button
            className={actionClass}
            onClick={() => void copyText(buildFastqExport(record))}
            type="button"
          >
            Copy FASTQ record
          </button>
          {publishWorkspaceArtifact == null ? null : (
            <WorkspacePublishButton
              artifact={workspaceArtifact({
                createChunks: createFastqWorkspaceProducer(record),
                format: "fastq",
                kind: "record-fastq",
                mediaType: "text/x-fastq",
                name: getSequenceExportFileName({ record, suffix: "fastq" }),
                sourceRevision,
              })}
              className={actionClass}
              label="Publish FASTQ record"
              publisher={publishWorkspaceArtifact}
            />
          )}
        </>
      )}
      {publishWorkspaceArtifact != null &&
      sourceRevision === 0 &&
      document.format === "fastq" &&
      document.recordInventory?.truncated === true ? (
        <WorkspacePublishButton
          artifact={serverWorkspaceArtifact({
            format: "fastq",
            kind: "canonical-source-fastq",
            mediaType: "text/x-fastq",
            name: "reads.fastq",
            sourceRevision,
          })}
          className={actionClass}
          label="Publish source FASTQ"
          publisher={publishWorkspaceArtifact}
        />
      ) : null}
      {publishWorkspaceArtifact?.supportsNativeRichGeneration === true &&
      sourceRevision === 0 ? (
        <>
          {sourceGtfRecords != null ? (
            <WorkspacePublishButton
              artifact={nativeRichWorkspaceArtifact({
                format: "gtf",
                mediaType: "text/x-gtf",
                name: "annotations.gtf",
                records: sourceGtfRecords,
                sourceRevision,
              })}
              className={actionClass}
              label="Publish source GTF"
              publisher={publishWorkspaceArtifact}
            />
          ) : null}
          <WorkspacePublishButton
            artifact={nativeRichWorkspaceArtifact({
              format: "pdf",
              mediaType: "application/pdf",
              name: "sequence.pdf",
              sourceRevision,
            })}
            className={actionClass}
            label="Publish source PDF"
            publisher={publishWorkspaceArtifact}
          />
        </>
      ) : null}
      {publishWorkspaceArtifact == null ? (
        <span
          className="basis-full text-xs text-token-text-secondary"
          role="status"
        >
          Workspace export is unavailable for this viewer.
        </span>
      ) : null}
      {copyFeedback?.status === "copied" ? (
        <span
          className="basis-full text-xs text-token-text-secondary"
          role="status"
        >
          Copied to clipboard.
        </span>
      ) : null}
      {copyFeedback?.status === "manual" ? (
        <label className="grid basis-full gap-1 text-xs text-token-text-secondary">
          <span role="status">
            Clipboard access is unavailable. Select the text below and press
            Command+C or Ctrl+C to copy.
          </span>
          <textarea
            aria-label="Sequence text to copy manually"
            autoFocus
            className="max-h-32 w-full rounded border border-token-border bg-token-bg-primary p-2 font-mono text-xs text-token-text-primary"
            onFocus={(event) => event.currentTarget.select()}
            readOnly
            rows={3}
            value={copyFeedback.value}
          />
        </label>
      ) : null}
      {copyFeedback?.status === "unavailable" ? (
        <span
          className="basis-full text-xs text-token-text-secondary"
          role="alert"
        >
          This selection is too large to display for manual copying. Save it to
          your workspace instead.
        </span>
      ) : null}
      {copyFeedback == null ? null : (
        <button
          className={actionClass}
          onClick={() => dismissCopyFeedback()}
          type="button"
        >
          Dismiss copy feedback
        </button>
      )}
    </div>
  );
}

function nativeRichWorkspaceArtifact({
  format,
  mediaType,
  name,
  records,
  sourceRevision,
}: {
  format: "gtf" | "pdf";
  mediaType: "application/pdf" | "text/x-gtf";
  name: string;
  records?: NativeSourceFeatureRecords;
  sourceRevision: number;
}): PreparedSequenceWorkspaceArtifact {
  return {
    format,
    mediaType,
    name,
    provenance: {
      engine: "sequence-viewer-native-export-v1",
      parameters: { kind: `source-${format}`, scope: "all" },
      sourceRevision,
    },
    serverGeneration: {
      compression: "none",
      kind: "native-rich",
      ...(records == null ? {} : { records }),
    },
  };
}

type NativeSourceFeatureRecords = NonNullable<
  NonNullable<PreparedSequenceWorkspaceArtifact["serverGeneration"]>["records"]
>;

function projectSourceFeatureRecords(
  document: SequenceDocument,
): NativeSourceFeatureRecords | undefined {
  if (document.recordInventory?.truncated === true) {
    return undefined;
  }

  const records: NativeSourceFeatureRecords = [];
  for (const record of document.records) {
    if (!safeNativeField(record.id, 1_024)) {
      return undefined;
    }
    if (!Number.isSafeInteger(record.length) || record.length <= 0) {
      return undefined;
    }
    for (const feature of record.features) {
      if (
        !safeNativeField(feature.id, 1_024) ||
        !safeNativeField(feature.type, 256)
      ) {
        return undefined;
      }
      const metadata = projectNativeFeatureMetadata(feature);
      if (metadata == null) {
        return undefined;
      }

      const segments = feature.segments ?? [feature];
      if (segments.length === 0) {
        return undefined;
      }
      for (const segment of segments) {
        if (
          ("remoteAccession" in segment && segment.remoteAccession != null) ||
          ("partialStart" in segment && segment.partialStart === true) ||
          ("partialEnd" in segment && segment.partialEnd === true) ||
          !Number.isSafeInteger(segment.start) ||
          !Number.isSafeInteger(segment.end) ||
          segment.start <= 0 ||
          segment.end < segment.start ||
          segment.end > record.length ||
          records.length >= 4_096
        ) {
          return undefined;
        }
        records.push({
          end1: segment.end,
          id: feature.id,
          kind: feature.type,
          metadata,
          reference: record.id,
          start1: segment.start,
          strand: feature.strand === "?" ? "." : feature.strand,
        });
      }
    }
  }
  return records.length === 0 ? undefined : records;
}

function projectNativeFeatureMetadata(
  feature: SequenceRecord["features"][number],
): Record<string, string> | undefined {
  const metadata: Record<string, string> = {
    gene_id: feature.id,
    transcript_id: feature.id,
  };
  for (const [target, candidates] of [
    ["gene_id", ["gene_id", "locus_tag", "gene"]],
    ["transcript_id", ["transcript_id", "transcript"]],
    ["gene_name", ["gene_name", "gene"]],
  ] as const) {
    for (const candidate of candidates) {
      const raw = feature.qualifiers[candidate];
      if (raw == null) {
        continue;
      }
      if (Array.isArray(raw)) {
        if (raw.length !== 1 || !safeNativeField(raw[0], 1_024)) {
          return undefined;
        }
        metadata[target] = raw[0];
      } else {
        if (!safeNativeField(raw, 1_024)) {
          return undefined;
        }
        metadata[target] = raw;
      }
      break;
    }
  }
  return metadata;
}

function safeNativeField(
  value: string | undefined,
  maxLength: number,
): boolean {
  if (value == null || value.length === 0 || value.length > maxLength) {
    return false;
  }
  for (const character of value) {
    const code = character.charCodeAt(0);
    if (code <= 31 || code === 127) {
      return false;
    }
  }
  return true;
}

function serverWorkspaceArtifact({
  format,
  kind,
  mediaType,
  name,
  sourceRevision,
}: {
  format: "fasta" | "fastq";
  kind: string;
  mediaType: "text/x-fasta" | "text/x-fastq";
  name: string;
  sourceRevision: number;
}): PreparedSequenceWorkspaceArtifact {
  return {
    format,
    mediaType,
    name,
    provenance: {
      engine: "sequence-viewer-server-export-v1",
      parameters: { kind },
      sourceRevision,
    },
    serverGeneration: { compression: "auto", kind: "opened-source" },
  };
}

function workspaceArtifact({
  createChunks,
  format,
  kind,
  mediaType,
  name,
  sourceRevision,
}: Omit<
  PreparedSequenceWorkspaceArtifact,
  "content" | "provenance" | "serverGeneration"
> & {
  createChunks: SequenceWorkspaceChunkProducer;
  kind: string;
  sourceRevision: number;
}): PreparedSequenceWorkspaceArtifact {
  return {
    createChunks,
    format,
    mediaType,
    name,
    provenance: {
      engine: "sequence-viewer-browser-export-v1",
      parameters: { kind },
      sourceRevision,
    },
  };
}

function copyWithSelection(value: string): boolean {
  if (typeof document.execCommand !== "function") {
    return false;
  }

  const field = document.createElement("textarea");
  field.value = value;
  field.readOnly = true;
  field.style.position = "fixed";
  field.style.left = "-9999px";
  document.body.append(field);
  field.select();

  try {
    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    field.remove();
  }
}
