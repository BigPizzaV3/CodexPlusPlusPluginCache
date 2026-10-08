import clsx from "clsx";
import type { WheelEventHandler } from "react";
import { FormattedMessage, useIntl } from "react-intl";

import type { MsaDerivedAnalysis } from "./analysis";
import type { MsaColumnSummary } from "./conservation";
import type { MsaDocument, MsaMetricTrackKey, MsaMoleculeType } from "./types";
import {
  MSA_ROW_LABEL_WIDTH_PX,
  type MsaViewportSlice,
} from "./virtualization";

const SEQUENCE_LOGO_HEIGHT_PX = 48;
const MIN_VISIBLE_LOGO_LABEL_HEIGHT_PX = 8;

type TrackKey = MsaMetricTrackKey;

export function getAvailableMsaMetricTracks({
  moleculeType,
  referenceAvailable,
  rnaStructureAvailable,
}: {
  moleculeType: MsaMoleculeType;
  referenceAvailable: boolean;
  rnaStructureAvailable: boolean;
}): Array<MsaMetricTrackKey> {
  const supportsConservation =
    moleculeType === "protein" ||
    moleculeType === "dna" ||
    moleculeType === "rna" ||
    moleculeType === "nucleic-acid-ambiguous";
  return [
    "identity",
    "gap",
    ...(supportsConservation ? ["modality-conservation" as const] : []),
    ...(referenceAvailable ? ["mismatch" as const] : []),
    ...(rnaStructureAvailable ? ["rna-structure" as const] : []),
    "sequence-logo",
  ];
}

export function getDefaultMsaMetricTracks(
  document: MsaDocument,
): Array<MsaMetricTrackKey> {
  return getAvailableMsaMetricTracks({
    moleculeType: document.displayInterpretation.moleculeType,
    referenceAvailable: false,
    rnaStructureAvailable: document.rnaStructure != null,
  }).filter((track) => track !== "sequence-logo");
}

export function MsaMetricTrackControls({
  document,
  enabledTracks,
  onEnabledTracksChange,
  onSequenceLogoHelpChange,
  referenceSequence,
  showSequenceLogoHelp,
}: {
  document: MsaDocument;
  enabledTracks: Array<MsaMetricTrackKey>;
  onEnabledTracksChange: (tracks: Array<MsaMetricTrackKey>) => void;
  onSequenceLogoHelpChange: (open: boolean) => void;
  referenceSequence: string | null;
  showSequenceLogoHelp: boolean;
}): React.ReactElement {
  const intl = useIntl();
  const availableTracks = getAvailableMsaMetricTracks({
    moleculeType: document.displayInterpretation.moleculeType,
    referenceAvailable: referenceSequence != null,
    rnaStructureAvailable: document.rnaStructure != null,
  });
  const enabledTrackSet = new Set(enabledTracks);
  return (
    <section
      aria-label="Quantitative track display"
      className="mt-4 space-y-3 border-t border-token-border pt-3 text-xs text-token-text-secondary"
    >
      <h3 className="font-medium text-token-text-primary">
        Quantitative tracks
      </h3>
      <div className="grid gap-2">
        {availableTracks.map((track) => (
          <label className="flex items-center gap-1" key={track}>
            <input
              checked={enabledTrackSet.has(track)}
              onChange={(event) =>
                onEnabledTracksChange(
                  event.target.checked
                    ? [...enabledTracks, track]
                    : enabledTracks.filter((value) => value !== track),
                )
              }
              type="checkbox"
            />
            {formatTrackLabel(intl, track, document)}
            {track === "sequence-logo" ? (
              <span className="rounded border border-token-border px-1 text-[10px] text-token-text-tertiary">
                <FormattedMessage
                  id="codex.filePreview.msa.track.sequenceLogoOptional"
                  defaultMessage="optional"
                  description="Small badge marking the compact sequence-logo track as an optional advanced view."
                />
              </span>
            ) : null}
          </label>
        ))}
      </div>
      {enabledTrackSet.has("sequence-logo") ? (
        <SequenceLogoHelp
          onOpenChange={onSequenceLogoHelpChange}
          open={showSequenceLogoHelp}
        />
      ) : null}
    </section>
  );
}

export function MsaMetricTracks({
  analysis,
  cellWidth,
  columns,
  document,
  enabledTracks,
  onHorizontalWheel,
  referenceSequence,
  slice,
}: {
  analysis: MsaDerivedAnalysis | null;
  cellWidth: number;
  columns: Array<number>;
  document: MsaDocument;
  enabledTracks: Array<MsaMetricTrackKey>;
  onHorizontalWheel: WheelEventHandler<HTMLElement>;
  referenceSequence: string | null;
  slice: MsaViewportSlice;
}): React.ReactElement {
  const intl = useIntl();
  const availableTracks = getAvailableMsaMetricTracks({
    moleculeType: document.displayInterpretation.moleculeType,
    referenceAvailable: referenceSequence != null,
    rnaStructureAvailable: document.rnaStructure != null,
  });
  const enabledTrackSet = new Set(enabledTracks);

  const visibleTracks = availableTracks.filter((track) =>
    enabledTrackSet.has(track),
  );

  return (
    <section
      aria-label={intl.formatMessage({
        id: "codex.filePreview.msa.metricTracks",
        defaultMessage: "MSA metric tracks",
        description:
          "Accessible label for the quantitative histogram track stack in the MSA viewer.",
      })}
      className="overflow-hidden border-b border-token-border bg-token-main-surface-primary px-3 py-2 text-xs text-token-text-secondary"
      onWheel={onHorizontalWheel}
    >
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="font-medium text-token-text-primary">
          <FormattedMessage
            id="codex.filePreview.msa.metricTracks"
            defaultMessage="Tracks"
            description="Heading for the MSA quantitative track stack."
          />
        </span>
      </div>

      <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-token-text-tertiary">
        <span>
          <FormattedMessage
            id="codex.filePreview.msa.metricTracksVisibleColumns"
            defaultMessage="Tracks show the currently displayed alignment columns {start, number}-{end, number}."
            description="Helper text explaining which MSA alignment columns are represented in the quantitative track panel."
            values={{
              end: slice.visibleColumnEnd,
              start: slice.visibleColumnStart + 1,
            }}
          />
        </span>
      </div>

      {analysis == null ? (
        <div className="bg-token-main-surface-secondary rounded-md px-2 py-1 text-[11px] text-token-text-tertiary">
          <FormattedMessage
            id="codex.filePreview.msa.metricTracksPending"
            defaultMessage="Computing quantitative column tracks…"
            description="Placeholder shown while MSA quantitative tracks are still being computed."
          />
        </div>
      ) : visibleTracks.length === 0 ? (
        <div className="bg-token-main-surface-secondary rounded-md px-2 py-1 text-[11px] text-token-text-tertiary">
          <FormattedMessage
            id="codex.filePreview.msa.metricTracksHidden"
            defaultMessage="All analytical tracks are currently hidden."
            description="Placeholder shown when every MSA quantitative track has been disabled."
          />
        </div>
      ) : (
        <div className="space-y-1">
          <TrackColumnRuler cellWidth={cellWidth} columns={columns} />
          {visibleTracks.map((track) => (
            <MetricTrackRow
              analysis={analysis}
              cellWidth={cellWidth}
              columns={columns}
              document={document}
              key={track}
              track={track}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function MetricTrackRow({
  analysis,
  cellWidth,
  columns,
  document,
  track,
}: {
  analysis: MsaDerivedAnalysis;
  cellWidth: number;
  columns: Array<number>;
  document: MsaDocument;
  track: TrackKey;
}): React.ReactElement {
  const intl = useIntl();
  const isLogo = track === "sequence-logo";
  return (
    <div className="flex items-stretch">
      <div
        className="sticky left-0 z-10 shrink-0 bg-token-main-surface-primary pr-2 text-right text-[11px] text-token-text-secondary"
        style={{ width: MSA_ROW_LABEL_WIDTH_PX }}
      >
        {formatTrackLabel(intl, track, document)}
      </div>
      {columns.map((column) => (
        <TrackCell
          analysis={analysis}
          column={column}
          document={document}
          isLogo={isLogo}
          key={`${track}:${column}`}
          style={{ width: cellWidth }}
          track={track}
        />
      ))}
    </div>
  );
}

function TrackColumnRuler({
  cellWidth,
  columns,
}: {
  cellWidth: number;
  columns: Array<number>;
}): React.ReactElement {
  const intl = useIntl();
  return (
    <div className="flex items-stretch">
      <div
        className="sticky left-0 z-10 shrink-0 bg-token-main-surface-primary pr-2 text-right text-[11px] text-token-text-secondary"
        style={{ width: MSA_ROW_LABEL_WIDTH_PX }}
      >
        <FormattedMessage
          id="codex.filePreview.msa.trackColumns"
          defaultMessage="Alignment cols"
          description="Label for the coordinate ruler shown above MSA quantitative tracks."
        />
      </div>
      {columns.map((column, index) => {
        const shouldLabel =
          index === 0 ||
          index === columns.length - 1 ||
          (column + 1) % 10 === 0;
        const shouldMajorTick = (column + 1) % 10 === 0;
        return (
          <span
            className="relative inline-flex h-5 shrink-0 items-start justify-center text-[9px] text-token-text-tertiary"
            key={column}
            style={{ width: cellWidth }}
            title={intl.formatMessage(
              {
                id: "codex.filePreview.msa.trackColumnCoordinate",
                defaultMessage: "Alignment column {column, number}",
                description:
                  "Accessible label for one quantitative-track coordinate cell in the MSA viewer.",
              },
              { column: column + 1 },
            )}
          >
            <span
              aria-hidden="true"
              className={clsx(
                "absolute bottom-0 left-1/2 -translate-x-1/2 border-l border-token-border",
                shouldMajorTick ? "h-2" : "h-1",
              )}
            />
            {shouldLabel ? (
              <span className="absolute top-0">{column + 1}</span>
            ) : null}
          </span>
        );
      })}
    </div>
  );
}

function SequenceLogoHelp({
  onOpenChange,
  open,
}: {
  onOpenChange: (open: boolean) => void;
  open: boolean;
}): React.ReactElement {
  return (
    <details
      className="rounded border border-token-border px-2 py-1"
      onToggle={(event) => onOpenChange(event.currentTarget.open)}
      open={open}
    >
      <summary className="cursor-interaction font-medium text-token-text-secondary select-none">
        <FormattedMessage
          id="codex.filePreview.msa.metricTracksSequenceLogoHelpSummary"
          defaultMessage="What does Sequence logo show?"
          description="Expandable help summary for the compact MSA sequence-logo track."
        />
      </summary>
      <div className="mt-1 max-w-2xl space-y-1 text-[11px] text-token-text-tertiary">
        <p>
          <FormattedMessage
            id="codex.filePreview.msa.metricTracksSequenceLogoHelpMeaning"
            defaultMessage="Each stack summarizes the residue or base mixture at one alignment column."
            description="Sequence-logo help text explaining what one per-column stack represents."
          />
        </p>
        <p>
          <FormattedMessage
            id="codex.filePreview.msa.metricTracksSequenceLogoHelpHeights"
            defaultMessage="Tall single-letter stacks indicate a highly informative column; mixed letters indicate compositional variation."
            description="Sequence-logo help text explaining tall versus mixed logo stacks."
          />
        </p>
        <p>
          <FormattedMessage
            id="codex.filePreview.msa.metricTracksSequenceLogoHelpContribution"
            defaultMessage="Total stack height reflects information content, while each letter’s height reflects that symbol’s contribution."
            description="Sequence-logo help text explaining total height and letter-height semantics."
          />
        </p>
      </div>
    </details>
  );
}

function TrackCell({
  analysis,
  column,
  document,
  isLogo,
  style,
  track,
}: {
  analysis: MsaDerivedAnalysis;
  column: number;
  document: MsaDocument;
  isLogo: boolean;
  style: React.CSSProperties;
  track: TrackKey;
}): React.ReactElement {
  const summary = analysis.summaries[column];
  if (isLogo) {
    return (
      <span
        aria-hidden="true"
        className="bg-token-main-surface-secondary relative inline-flex h-12 shrink-0 items-end justify-center overflow-hidden border border-token-border/60"
        style={style}
      >
        <SequenceLogoColumn document={document} summary={summary} />
      </span>
    );
  }
  const layers = getTrackLayers({
    analysis,
    column,
    summary,
    track,
  });
  return (
    <span
      aria-hidden="true"
      className="bg-token-main-surface-secondary relative inline-flex h-5 shrink-0 items-end overflow-hidden border border-token-border/60"
      style={style}
    >
      {layers.map((layer) => (
        <span
          className={clsx("absolute inset-x-0 bottom-0", layer.className)}
          key={`${track}:${column}:${layer.className}`}
          style={{
            height: `${Math.max(0, Math.min(1, layer.fraction)) * 100}%`,
          }}
        />
      ))}
    </span>
  );
}

function SequenceLogoColumn({
  document,
  summary,
}: {
  document: MsaDocument;
  summary: MsaColumnSummary | undefined;
}): React.ReactElement | null {
  if (summary == null) {
    return null;
  }
  const entries = Object.entries(summary.weightedSymbolFractions)
    .filter(([, fraction]) => fraction > 0)
    .sort((left, right) => left[1] - right[1]);
  if (entries.length === 0) {
    return null;
  }
  const maxBits =
    document.displayInterpretation.moleculeType === "protein"
      ? Math.log2(20)
      : 2;
  const entropy = entries.reduce(
    (total, [, fraction]) => total - fraction * Math.log2(fraction),
    0,
  );
  const informationScale =
    maxBits === 0 ? 0 : Math.max(0, maxBits - entropy) / maxBits;
  return (
    <span className="absolute inset-x-0 bottom-0 flex h-full flex-col-reverse">
      {entries.map(([symbol, fraction]) => {
        const heightFraction = fraction * informationScale;
        const showSymbol =
          heightFraction * SEQUENCE_LOGO_HEIGHT_PX >=
          MIN_VISIBLE_LOGO_LABEL_HEIGHT_PX;
        return (
          <span
            className="flex min-h-0 items-center justify-center overflow-hidden text-[9px] leading-none font-semibold text-token-text-primary"
            key={symbol}
            style={{ height: `${heightFraction * 100}%` }}
          >
            {showSymbol ? symbol : null}
          </span>
        );
      })}
    </span>
  );
}

function getTrackLayers({
  analysis,
  column,
  summary,
  track,
}: {
  analysis: MsaDerivedAnalysis;
  column: number;
  summary: MsaColumnSummary | undefined;
  track: TrackKey;
}): Array<{ className: string; fraction: number }> {
  switch (track) {
    case "gap":
      return [
        {
          className: "bg-red-400/80",
          fraction: summary?.gapFraction ?? 0,
        },
      ];
    case "identity":
      return [
        {
          className: "bg-blue-500/80",
          fraction: summary?.identity ?? 0,
        },
      ];
    case "mismatch":
      return [
        {
          className: "bg-orange-400/80",
          fraction: analysis.mismatchDensityByColumn[column] ?? 0,
        },
      ];
    case "modality-conservation":
      return [
        {
          className: "bg-emerald-500/80",
          fraction: summary?.conservationNormalized ?? 0,
        },
      ];
    case "rna-structure": {
      const structure = analysis.rnaStructureConsensusByColumn[String(column)];
      if (structure == null) {
        return [];
      }
      return [
        {
          className: "bg-red-400/65",
          fraction: structure.invalidFraction,
        },
        {
          className: "bg-purple-500/80",
          fraction: structure.validPairFraction,
        },
      ];
    }
    case "sequence-logo":
      return [];
  }
}

function formatTrackLabel(
  intl: ReturnType<typeof useIntl>,
  track: TrackKey,
  document: MsaDocument,
): string {
  switch (track) {
    case "gap":
      return intl.formatMessage({
        id: "codex.filePreview.msa.track.gaps",
        defaultMessage: "Gap occupancy",
        description: "MSA quantitative track label for gap occupancy.",
      });
    case "identity":
      return intl.formatMessage({
        id: "codex.filePreview.msa.track.identity",
        defaultMessage: "Identity histogram",
        description: "MSA quantitative track label for per-column identity.",
      });
    case "mismatch":
      return intl.formatMessage({
        id: "codex.filePreview.msa.track.mismatches",
        defaultMessage: "Mismatch density",
        description: "MSA quantitative track label for mismatch density.",
      });
    case "modality-conservation":
      return document.displayInterpretation.moleculeType === "protein"
        ? intl.formatMessage({
            id: "codex.filePreview.msa.track.proteinConservation",
            defaultMessage: "Protein conservation",
            description:
              "MSA quantitative track label for protein relative-entropy conservation.",
          })
        : intl.formatMessage({
            id: "codex.filePreview.msa.track.nucleotideConservation",
            defaultMessage: "Nucleotide conservation",
            description:
              "MSA quantitative track label for nucleotide information-content conservation.",
          });
    case "rna-structure":
      return intl.formatMessage({
        id: "codex.filePreview.msa.track.rnaStructureConsensus",
        defaultMessage: "RNA structure consensus",
        description:
          "MSA quantitative track label for RNA paired-column structure consensus.",
      });
    case "sequence-logo":
      return intl.formatMessage({
        id: "codex.filePreview.msa.track.sequenceLogo",
        defaultMessage: "Sequence logo (mix + information)",
        description: "MSA quantitative track label for sequence logos.",
      });
  }
}
