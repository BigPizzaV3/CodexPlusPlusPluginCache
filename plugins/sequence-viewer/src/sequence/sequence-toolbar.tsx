import type { ReactNode } from "react";

import { WorkbenchTools } from "../ui/workbench-tools";
import type { SequenceWorkspaceArtifactPublisher } from "../views/workbench-persistence";
import { ExportActions } from "./export-actions";
import { SEQUENCE_WRAP_WIDTHS } from "./sequence-line-layout";
import { getCompatibleSequencePalettes } from "./sequence-palette";
import type {
  SequenceDocument,
  SequencePaletteId,
  SequenceRecord,
  SequenceSelection,
} from "./types";

export function SequenceToolbar({
  document,
  coordinateValue,
  displayOptions,
  featureCount,
  onClearSelection,
  onCoordinateChange,
  onCoordinateJump,
  onNextFeature,
  onNextSearchHit,
  onPaletteChange,
  onPreviousFeature,
  onPreviousSearchHit,
  publishWorkspaceArtifact,
  onQueryChange,
  onToggleFeatures,
  onToggleQuality,
  onToggleTranslation,
  onWrapWidthChange,
  paletteId,
  query,
  record,
  searchHitCount,
  selection,
  showFeatures,
  showQuality,
  showTranslation,
  sourceRevision,
  wrapWidth,
}: {
  document: SequenceDocument;
  coordinateValue: string;
  displayOptions?: ReactNode;
  featureCount: number;
  onClearSelection: () => void;
  onCoordinateChange: (value: string) => void;
  onCoordinateJump: () => void;
  onNextFeature: () => void;
  onNextSearchHit: () => void;
  onPaletteChange: (paletteId: SequencePaletteId) => void;
  onPreviousFeature: () => void;
  onPreviousSearchHit: () => void;
  publishWorkspaceArtifact?: SequenceWorkspaceArtifactPublisher;
  onQueryChange: (query: string) => void;
  onToggleFeatures: () => void;
  onToggleQuality: () => void;
  onToggleTranslation: () => void;
  onWrapWidthChange: (wrapWidth: number) => void;
  paletteId: SequencePaletteId;
  query: string;
  record: SequenceRecord;
  searchHitCount: number;
  selection?: SequenceSelection;
  showFeatures: boolean;
  showQuality: boolean;
  showTranslation: boolean;
  sourceRevision: number;
  wrapWidth: number;
}): React.ReactElement {
  const paletteOptions = getCompatibleSequencePalettes(record.molecule);
  const hasTranslation = record.features.some(
    ({ translation, type }) =>
      type.toLowerCase() === "cds" && translation != null,
  );
  return (
    <div className="bio-sequence-toolbar border-b border-token-border bg-token-main-surface-primary px-4 py-3">
      <div className="bio-sequence-toolbar-primary flex flex-wrap items-center gap-2">
        <label className="flex min-w-48 flex-1 items-center gap-2 rounded-md border border-token-border bg-token-input-background px-3 py-2 text-sm focus-within:border-token-focus-border">
          <span className="text-token-text-secondary">Find</span>
          <input
            aria-label="Search sequence"
            className="min-w-0 flex-1 bg-transparent text-token-text-primary outline-none placeholder:text-token-text-tertiary"
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Motif, primer, or sequence"
            value={query}
          />
          {query.length === 0 ? null : (
            <span className="shrink-0 text-xs tabular-nums text-token-text-secondary">
              {searchHitCount.toLocaleString()} matches
            </span>
          )}
        </label>
        <div className="flex items-center gap-1" hidden={query.length === 0}>
          <button
            className={actionClass}
            disabled={searchHitCount === 0}
            onClick={onPreviousSearchHit}
            type="button"
          >
            Prev hit
          </button>
          <button
            className={actionClass}
            disabled={searchHitCount === 0}
            onClick={onNextSearchHit}
            type="button"
          >
            Next hit
          </button>
        </div>
        <form
          className="flex items-center gap-1.5 rounded-md border border-token-border bg-token-input-background px-2 py-1.5 focus-within:border-token-focus-border"
          onSubmit={(event) => {
            event.preventDefault();
            onCoordinateJump();
          }}
        >
          <input
            aria-label="Jump to coordinate"
            className="w-24 bg-transparent text-sm tabular-nums text-token-text-primary outline-none placeholder:text-token-text-tertiary"
            inputMode="numeric"
            onChange={(event) => onCoordinateChange(event.target.value)}
            placeholder="Position"
            value={coordinateValue}
          />
          <button className={actionClass} type="submit">
            Jump
          </button>
        </form>
        {selection == null ? null : (
          <button
            className={actionClass}
            onClick={onClearSelection}
            title="Clear selection (Esc)"
            type="button"
          >
            Clear selection
          </button>
        )}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-token-text-secondary">
        <span className="font-medium uppercase">{document.format}</span>
        <span>{record.molecule}</span>
        {record.topology == null ? null : <span>{record.topology}</span>}
        <span className="tabular-nums">
          {record.length.toLocaleString()} residues
        </span>
        <span className="tabular-nums">
          {featureCount.toLocaleString()} feature{featureCount === 1 ? "" : "s"}
        </span>
      </div>
      <WorkbenchTools
        className="bio-sequence-toolbar-options"
        group="sequence-display"
        label="Sequence display and sharing"
        panels={[
          {
            id: "display",
            label: "Display",
            content: (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-4">
                  <label className="flex items-center gap-2 text-sm text-token-text-secondary">
                    Palette
                    <select
                      aria-label="Residue palette"
                      className={inputClass}
                      onChange={(event) =>
                        onPaletteChange(event.target.value as SequencePaletteId)
                      }
                      value={paletteId}
                    >
                      {paletteOptions.map(({ id, label }) => (
                        <option key={id} value={id}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex items-center gap-2 text-sm text-token-text-secondary">
                    Wrap
                    <select
                      aria-label="Sequence wrap width"
                      className={inputClass}
                      onChange={(event) =>
                        onWrapWidthChange(Number(event.target.value))
                      }
                      value={wrapWidth}
                    >
                      {SEQUENCE_WRAP_WIDTHS.map((width) => (
                        <option key={width} value={width}>
                          {width}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <ToggleChip
                    active={showFeatures}
                    disabled={featureCount === 0}
                    onClick={onToggleFeatures}
                  >
                    Features
                  </ToggleChip>
                  <ToggleChip
                    active={showTranslation}
                    disabled={!hasTranslation}
                    onClick={onToggleTranslation}
                  >
                    Translation
                  </ToggleChip>
                  <ToggleChip
                    active={showQuality}
                    disabled={record.quality == null}
                    onClick={onToggleQuality}
                  >
                    FASTQ quality
                  </ToggleChip>
                  <button
                    className={actionClass}
                    disabled={featureCount === 0}
                    onClick={onPreviousFeature}
                    type="button"
                  >
                    Prev feature
                  </button>
                  <button
                    className={actionClass}
                    disabled={featureCount === 0}
                    onClick={onNextFeature}
                    type="button"
                  >
                    Next feature
                  </button>
                </div>
                {displayOptions}
              </div>
            ),
          },
          {
            id: "copy",
            label: "Copy & share",
            content: (
              <ExportActions
                document={document}
                publishWorkspaceArtifact={publishWorkspaceArtifact}
                record={record}
                selection={selection}
                sourceRevision={sourceRevision}
              />
            ),
          },
        ]}
      />
    </div>
  );
}

function ToggleChip({
  active,
  children,
  disabled,
  onClick,
}: {
  active: boolean;
  children: ReactNode;
  disabled: boolean;
  onClick: () => void;
}): React.ReactElement {
  return (
    <button
      aria-pressed={active}
      className={`${actionClass} ${active ? "bg-token-main-surface-secondary text-token-text-primary" : ""}`}
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      {children}
    </button>
  );
}

const actionClass =
  "rounded-md px-2.5 py-1.5 text-sm font-medium text-token-text-secondary hover:bg-token-main-surface-secondary hover:text-token-text-primary focus-visible:outline-2 focus-visible:outline-token-focus-border disabled:cursor-not-allowed disabled:opacity-40";
const inputClass =
  "min-w-0 rounded-md border border-token-border bg-token-input-background px-2 py-1.5 text-sm text-token-text-primary outline-none focus:border-token-focus-border";
