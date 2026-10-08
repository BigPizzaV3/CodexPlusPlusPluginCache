import { FormattedMessage } from "react-intl";

import type { MsaDerivedAnalysis } from "./analysis";
import type { FocusedMsaCell } from "./cell-hover-overlay";
import { getUngappedPosition } from "./coordinate-map";
import type { MsaDocument } from "./types";

export function MsaPinnedInspector({
  analysis,
  cell,
  document,
  onClear,
  referenceSequence,
}: {
  analysis: MsaDerivedAnalysis | null;
  cell: FocusedMsaCell;
  document: MsaDocument;
  onClear: () => void;
  referenceSequence: string | null;
}): React.ReactElement | null {
  if (cell == null) {
    return null;
  }
  const summary = analysis?.summaries[cell.column];
  const referenceSymbol = referenceSequence?.[cell.column];
  const rowInsertion =
    analysis?.insertionByRowColumn[cell.row.id]?.[String(cell.column)];
  const pair = analysis?.pairByColumn[String(cell.column)];
  const partner =
    pair == null
      ? null
      : pair.leftColumn === cell.column
        ? pair.rightColumn
        : pair.leftColumn;
  const rnaConsensus =
    analysis?.rnaStructureConsensusByColumn[String(cell.column)];
  const ungappedPosition = getUngappedPosition(
    cell.row.alignedSequence,
    cell.column,
  );

  return (
    <section className="border-t border-token-border bg-token-main-surface-primary px-3 py-2 text-xs text-token-text-secondary">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium text-token-text-primary">
          <FormattedMessage
            id="codex.filePreview.msa.pinnedInspector"
            defaultMessage="Pinned cell inspector"
            description="Heading for the MSA pinned cell inspector."
          />
        </span>
        <button
          className="cursor-interaction rounded-md border border-token-border px-2 py-0.5 text-[11px]"
          onClick={onClear}
          type="button"
        >
          <FormattedMessage
            id="codex.filePreview.msa.clearPinnedInspector"
            defaultMessage="Clear"
            description="Button label for clearing the MSA pinned cell inspector."
          />
        </button>
      </div>
      <div className="mt-2 grid gap-x-5 gap-y-1 md:grid-cols-2 xl:grid-cols-4">
        <InspectorValue
          label={
            <FormattedMessage
              id="codex.filePreview.msa.inspector.row"
              defaultMessage="Row"
              description="Pinned MSA inspector label for the selected row."
            />
          }
          value={cell.row.label}
        />
        <InspectorValue
          label={
            <FormattedMessage
              id="codex.filePreview.msa.inspector.column"
              defaultMessage="Alignment column"
              description="Pinned MSA inspector label for the alignment column."
            />
          }
          value={String(cell.column + 1)}
        />
        <InspectorValue
          label={
            <FormattedMessage
              id="codex.filePreview.msa.inspector.symbol"
              defaultMessage="Symbol"
              description="Pinned MSA inspector label for the selected residue/base symbol."
            />
          }
          value={cell.symbol}
        />
        <InspectorValue
          label={
            <FormattedMessage
              id="codex.filePreview.msa.inspector.ungapped"
              defaultMessage="Ungapped position"
              description="Pinned MSA inspector label for the ungapped row coordinate."
            />
          }
          value={ungappedPosition == null ? "—" : String(ungappedPosition)}
        />
        <InspectorValue
          label={
            <FormattedMessage
              id="codex.filePreview.msa.inspector.reference"
              defaultMessage="Reference"
              description="Pinned MSA inspector label for the active reference symbol."
            />
          }
          value={referenceSymbol ?? "—"}
        />
        <InspectorValue
          label={
            <FormattedMessage
              id="codex.filePreview.msa.inspector.matchClass"
              defaultMessage="Match class"
              description="Pinned MSA inspector label for reference match status."
            />
          }
          value={
            referenceSymbol == null
              ? "n/a"
              : referenceSymbol.toUpperCase() === cell.symbol.toUpperCase()
                ? "match"
                : "difference"
          }
        />
        <InspectorValue
          label={
            <FormattedMessage
              id="codex.filePreview.msa.inspector.identity"
              defaultMessage="Column identity"
              description="Pinned MSA inspector label for per-column identity."
            />
          }
          value={
            summary == null ? "—" : `${Math.round(summary.identity * 100)}%`
          }
        />
        <InspectorValue
          label={
            <FormattedMessage
              id="codex.filePreview.msa.inspector.gaps"
              defaultMessage="Gap occupancy"
              description="Pinned MSA inspector label for per-column gap occupancy."
            />
          }
          value={
            summary == null ? "—" : `${Math.round(summary.gapFraction * 100)}%`
          }
        />
        <InspectorValue
          label={
            <FormattedMessage
              id="codex.filePreview.msa.inspector.conservation"
              defaultMessage="Conservation score"
              description="Pinned MSA inspector label for the modality-specific conservation score."
            />
          }
          value={
            summary?.conservationNormalized == null
              ? "—"
              : `${Math.round(summary.conservationNormalized * 100)}% normalized`
          }
        />
        <InspectorValue
          label={
            <FormattedMessage
              id="codex.filePreview.msa.inspector.insertion"
              defaultMessage="Insertion after cell"
              description="Pinned MSA inspector label for A2M/A3M insertion residues."
            />
          }
          value={rowInsertion?.residues ?? "—"}
        />
        <InspectorValue
          label={
            <FormattedMessage
              id="codex.filePreview.msa.inspector.rnaPair"
              defaultMessage="RNA pair partner"
              description="Pinned MSA inspector label for the paired RNA alignment column."
            />
          }
          value={partner == null ? "—" : String(partner + 1)}
        />
        <InspectorValue
          label={
            <FormattedMessage
              id="codex.filePreview.msa.inspector.rnaConsensus"
              defaultMessage="RNA pair consensus"
              description="Pinned MSA inspector label for the paired-column structural consensus."
            />
          }
          value={
            rnaConsensus == null
              ? "—"
              : `${Math.round(rnaConsensus.validPairFraction * 100)}% valid pairs`
          }
        />
        {cell.row.duplicateSourceLabelCount == null ? null : (
          <InspectorValue
            label={
              <FormattedMessage
                id="codex.filePreview.msa.inspector.duplicateLabel"
                defaultMessage="Duplicate source label"
                description="Pinned MSA inspector label for duplicate source-label metadata."
              />
            }
            value={`${cell.row.duplicateSourceLabelIndex ?? 1}/${cell.row.duplicateSourceLabelCount}`}
          />
        )}
        <InspectorValue
          label={
            <FormattedMessage
              id="codex.filePreview.msa.inspector.metricProvenance"
              defaultMessage="Metric provenance"
              description="Pinned MSA inspector label for conservation metric provenance."
            />
          }
          value={
            analysis?.metricProvenance.conservation?.algorithm ??
            "No conservation model"
          }
        />
        <InspectorValue
          label={
            <FormattedMessage
              id="codex.filePreview.msa.inspector.modality"
              defaultMessage="Interpretation"
              description="Pinned MSA inspector label for current molecule interpretation."
            />
          }
          value={document.displayInterpretation.moleculeType}
        />
        {cell.row.metadata == null ? null : (
          <InspectorValue
            label={
              <FormattedMessage
                id="codex.filePreview.msa.inspector.rowMetadata"
                defaultMessage="Row metadata"
                description="Pinned MSA inspector label for parsed row-level source metadata."
              />
            }
            value={Object.entries(cell.row.metadata)
              .map(([key, value]) => `${key}=${value}`)
              .join(" · ")}
          />
        )}
      </div>
    </section>
  );
}

function InspectorValue({
  label,
  value,
}: {
  label: React.ReactNode;
  value: string;
}): React.ReactElement {
  return (
    <div className="min-w-0">
      <div className="text-[11px] text-token-text-tertiary">{label}</div>
      <div
        className="truncate font-medium text-token-text-primary"
        title={value}
      >
        {value}
      </div>
    </div>
  );
}
