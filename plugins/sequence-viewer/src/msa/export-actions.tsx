import { useState } from "react";
import { FormattedMessage } from "react-intl";

import { useWorkbenchFeedback } from "../ui/workbench-feedback";
import type {
  PreparedSequenceWorkspaceArtifact,
  SequenceWorkspaceArtifactPublisher,
} from "../views/workbench-persistence";
import type { SequenceWorkspaceChunkProducer } from "../views/workspace-artifact-stream";
import {
  createAlignedFastaWorkspaceProducer,
  createReferenceFastaWorkspaceProducer,
  createSearchHitsTsvWorkspaceProducer,
  createVisibleRangeSvgWorkspaceProducer,
} from "../views/workspace-export-producers";
import { WorkspacePublishButton } from "../workspace-publish-button";
import { buildAlignedFasta, buildVisibleRangeText } from "./exports";
import type { MsaMotifSearchHit } from "./search";
import type { MsaColumnRange, MsaSequenceRow } from "./types";

const publishActionClass =
  "cursor-interaction rounded-md border border-token-border px-2 py-1 text-[11px] disabled:cursor-not-allowed disabled:opacity-50";
const MAX_MANUAL_COPY_BYTES = 128 * 1_024;

type CopyFeedback =
  | { status: "copied" }
  | { status: "manual"; value: string }
  | { status: "unavailable" };

export function MsaExportActions({
  hits,
  publishWorkspaceArtifact,
  referenceLabel,
  referenceSequence,
  rows,
  serverSourceAlignedFasta = false,
  selectedColumnRange,
  sourceRevision,
  visibleColumnEnd,
  visibleColumnStart,
}: {
  hits: Array<MsaMotifSearchHit>;
  publishWorkspaceArtifact?: SequenceWorkspaceArtifactPublisher;
  referenceLabel: string;
  referenceSequence: string | null;
  rows: Array<MsaSequenceRow>;
  serverSourceAlignedFasta?: boolean;
  selectedColumnRange: MsaColumnRange | null;
  sourceRevision: number;
  visibleColumnEnd: number;
  visibleColumnStart: number;
}): React.ReactElement {
  const [copyFeedback, setCopyFeedback] = useState<CopyFeedback>();
  const dismissCopyFeedback = useWorkbenchFeedback({
    id: "alignment.copy-feedback",
    kind: "copy",
    label: "Alignment copy feedback",
    message:
      copyFeedback?.status === "manual"
        ? "Clipboard access is unavailable; selectable alignment text is ready for manual copying."
        : copyFeedback?.status === "unavailable"
          ? "This selection is too large for manual copying. Save it to the workspace instead."
          : copyFeedback?.status === "copied"
            ? "Copied to clipboard."
            : undefined,
    onDismiss: () => setCopyFeedback(undefined),
    visible: copyFeedback != null,
  });

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
    <section className="flex flex-wrap items-center gap-2 border-b border-token-border bg-token-main-surface-primary px-3 py-2 text-xs text-token-text-secondary">
      <span className="font-medium text-token-text-primary">
        <FormattedMessage
          id="codex.filePreview.msa.exports"
          defaultMessage="Copy / export"
          description="Heading for copy and export actions in the MSA viewer."
        />
      </span>
      <ExportButton
        onClick={() =>
          void copyText(
            buildVisibleRangeText({
              endColumn: visibleColumnEnd,
              rows,
              startColumn: visibleColumnStart,
            }),
          )
        }
      >
        <FormattedMessage
          id="codex.filePreview.msa.copyVisibleRange"
          defaultMessage="Copy visible range"
          description="Button label for copying the currently visible MSA rectangle."
        />
      </ExportButton>
      {selectedColumnRange == null ? null : (
        <>
          <ExportButton
            onClick={() =>
              void copyText(
                buildVisibleRangeText({
                  endColumn: selectedColumnRange.end,
                  rows,
                  startColumn: selectedColumnRange.start,
                }),
              )
            }
          >
            <FormattedMessage
              id="codex.filePreview.msa.copySelectedRange"
              defaultMessage="Copy selected range"
              description="Button label for copying the currently selected MSA rectangle."
            />
          </ExportButton>
          {publishWorkspaceArtifact == null ? null : (
            <WorkspacePublishButton
              artifact={workspaceArtifact({
                createChunks: createVisibleRangeSvgWorkspaceProducer({
                  endColumn: selectedColumnRange.end,
                  rows,
                  startColumn: selectedColumnRange.start,
                }),
                format: "svg",
                kind: "selected-range-svg",
                mediaType: "image/svg+xml",
                name: "msa-selected-range.svg",
                sourceRevision,
              })}
              className={publishActionClass}
              label="Publish selected SVG"
              publisher={publishWorkspaceArtifact}
            />
          )}
        </>
      )}
      <ExportButton onClick={() => void copyText(buildAlignedFasta(rows))}>
        <FormattedMessage
          id="codex.filePreview.msa.copyVisibleRowsFasta"
          defaultMessage="Copy visible rows FASTA"
          description="Button label for copying visible MSA rows as aligned FASTA."
        />
      </ExportButton>
      {publishWorkspaceArtifact == null ? null : (
        <WorkspacePublishButton
          artifact={workspaceArtifact({
            createChunks: createAlignedFastaWorkspaceProducer(rows),
            format: "aligned-fasta",
            kind: "visible-rows-fasta",
            mediaType: "text/x-fasta",
            name: "msa-visible-rows.afa",
            sourceRevision,
          })}
          className={publishActionClass}
          label="Publish visible FASTA"
          publisher={publishWorkspaceArtifact}
        />
      )}
      {publishWorkspaceArtifact == null || !serverSourceAlignedFasta ? null : (
        <WorkspacePublishButton
          artifact={{
            format: "aligned-fasta",
            mediaType: "text/x-fasta",
            name: "alignment.afa",
            provenance: {
              engine: "sequence-viewer-alignment-server-export-v1",
              parameters: { kind: "canonical-source-alignment" },
              sourceRevision,
            },
            serverGeneration: {
              compression: "auto",
              kind: "opened-source",
            },
          }}
          className={publishActionClass}
          label="Publish source alignment"
          publisher={publishWorkspaceArtifact}
        />
      )}
      {publishWorkspaceArtifact?.supportsNativeRichGeneration !== true ||
      sourceRevision !== 0
        ? null
        : (
            [
              ["a3m", "text/x-a3m", "alignment.a3m", "A3M"],
              ["clustal", "text/x-clustal", "alignment.aln", "CLUSTAL"],
              ["stockholm", "text/x-stockholm", "alignment.sto", "Stockholm"],
              ["pdf", "application/pdf", "alignment.pdf", "PDF"],
            ] as const
          ).map(([format, mediaType, name, label]) => (
            <WorkspacePublishButton
              artifact={{
                format,
                mediaType,
                name,
                provenance: {
                  engine: "sequence-viewer-alignment-native-export-v1",
                  parameters: { kind: `source-${format}`, scope: "all" },
                  sourceRevision,
                },
                serverGeneration: {
                  compression: "none",
                  kind: "native-rich",
                },
              }}
              className={publishActionClass}
              key={format}
              label={`Publish source ${label}`}
              publisher={publishWorkspaceArtifact}
            />
          ))}
      {publishWorkspaceArtifact == null || referenceSequence == null ? null : (
        <WorkspacePublishButton
          artifact={workspaceArtifact({
            createChunks: createReferenceFastaWorkspaceProducer({
              label: referenceLabel,
              sequence: referenceSequence,
            }),
            format: "aligned-fasta",
            kind: "reference-row-fasta",
            mediaType: "text/x-fasta",
            name: "msa-reference.afa",
            sourceRevision,
          })}
          className={publishActionClass}
          label="Publish reference row"
          publisher={publishWorkspaceArtifact}
        />
      )}
      {publishWorkspaceArtifact == null || hits.length === 0 ? null : (
        <WorkspacePublishButton
          artifact={workspaceArtifact({
            createChunks: createSearchHitsTsvWorkspaceProducer(hits),
            format: "tsv",
            kind: "search-hits-tsv",
            mediaType: "text/tab-separated-values",
            name: "msa-search-hits.tsv",
            sourceRevision,
          })}
          className={publishActionClass}
          label="Publish hit TSV"
          publisher={publishWorkspaceArtifact}
        />
      )}
      {publishWorkspaceArtifact == null ? null : (
        <WorkspacePublishButton
          artifact={workspaceArtifact({
            createChunks: createVisibleRangeSvgWorkspaceProducer({
              endColumn: visibleColumnEnd,
              rows,
              startColumn: visibleColumnStart,
            }),
            format: "svg",
            kind: "visible-range-svg",
            mediaType: "image/svg+xml",
            name: "msa-visible-range.svg",
            sourceRevision,
          })}
          className={publishActionClass}
          label="Publish range SVG"
          publisher={publishWorkspaceArtifact}
        />
      )}
      {publishWorkspaceArtifact == null ? (
        <span className="basis-full" role="status">
          Workspace export is unavailable for this viewer.
        </span>
      ) : null}
      {copyFeedback?.status === "copied" ? (
        <span className="basis-full" role="status">
          Copied to clipboard.
        </span>
      ) : null}
      {copyFeedback?.status === "manual" ? (
        <label className="grid basis-full gap-1">
          <span role="status">
            Clipboard access is unavailable. Select the text below and press
            Command+C or Ctrl+C to copy.
          </span>
          <textarea
            aria-label="Alignment text to copy manually"
            autoFocus
            className="max-h-32 w-full rounded border border-token-border bg-token-main-surface-primary p-2 font-mono text-xs text-token-text-primary"
            onFocus={(event) => event.currentTarget.select()}
            readOnly
            rows={3}
            value={copyFeedback.value}
          />
        </label>
      ) : null}
      {copyFeedback?.status === "unavailable" ? (
        <span className="basis-full" role="alert">
          This selection is too large to display for manual copying. Save it to
          your workspace instead.
        </span>
      ) : null}
      {copyFeedback == null ? null : (
        <ExportButton onClick={dismissCopyFeedback}>
          Dismiss copy feedback
        </ExportButton>
      )}
    </section>
  );
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
      engine: "sequence-viewer-alignment-browser-export-v1",
      parameters: { kind },
      sourceRevision,
    },
  };
}

function ExportButton({
  children,
  disabled = false,
  onClick,
}: {
  children: React.ReactNode;
  disabled?: boolean;
  onClick: () => void;
}): React.ReactElement {
  return (
    <button
      className="cursor-interaction rounded-md border border-token-border px-2 py-1 text-[11px] disabled:cursor-not-allowed disabled:opacity-50"
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      {children}
    </button>
  );
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
