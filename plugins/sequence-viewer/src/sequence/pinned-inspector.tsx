import { WorkbenchDisclosure } from "../ui/workbench-disclosure";
import { getLocalFeatureSegments } from "./feature-location";
import { getSelectedFeatureTranslation } from "./translation-track";
import { translateSixFrames } from "./translation";
import type {
  SequenceFeature,
  SequenceRecord,
  SequenceSelection,
} from "./types";
import {
  extractSelectedSequence,
  getSelectionLength,
  getSelectionSegments,
  summarizeSelectedQuality,
  selectionOverlapsFeature,
} from "./selection";

export function PinnedInspector({
  feature,
  hoverCoordinate,
  onClearSelection,
  record,
  selection,
}: {
  feature?: SequenceFeature;
  hoverCoordinate?: number;
  onClearSelection: () => void;
  record: SequenceRecord;
  selection?: SequenceSelection;
}): React.ReactElement {
  const selectionLength = selection == null ? 0 : getSelectionLength(selection);
  const selectedSequence =
    selection == null
      ? null
      : extractSelectedSequence(record, selection, 3_000);
  const overlappingFeatures =
    selection == null
      ? []
      : record.features.filter((candidate) =>
          selectionOverlapsFeature(selection, candidate),
        );
  const translatedSelections = overlappingFeatures.flatMap(
    (overlappingFeature) => {
      return selection == null
        ? []
        : getSelectionSegments(selection).flatMap((segment) => {
            const translatedSelection = getSelectedFeatureTranslation({
              feature: overlappingFeature,
              selectionEnd: segment.end,
              selectionStart: segment.start,
            });
            return translatedSelection == null
              ? []
              : [
                  {
                    feature: overlappingFeature,
                    segmentKey: `${segment.start}-${segment.end}`,
                    ...translatedSelection,
                  },
                ];
          });
    },
  );
  const hoveredResidue =
    hoverCoordinate == null
      ? null
      : (record.sequence[hoverCoordinate - 1] ?? null);
  const hoveredQuality =
    hoverCoordinate == null
      ? null
      : (record.quality?.phred[hoverCoordinate - 1] ?? null);
  const selectedQuality =
    selection == null || record.quality == null
      ? null
      : summarizeSelectedQuality(record, selection);
  const selectedTranslations =
    selectedSequence == null ||
    record.molecule === "protein" ||
    record.molecule === "unknown"
      ? []
      : translateSixFrames(selectedSequence).map((translation) => ({
          ...translation,
          aminoAcids:
            translation.aminoAcids.length <= 180
              ? translation.aminoAcids
              : `${translation.aminoAcids.slice(0, 180)}…`,
        }));
  return (
    <section
      aria-label="Sequence inspector"
      className="bio-sequence-inspector min-w-0"
    >
      <div className="space-y-4 text-sm leading-relaxed text-token-text-primary">
        <section>
          <div className="font-semibold">{record.sourceLabel}</div>
          <div className="text-token-text-secondary">
            {record.length.toLocaleString()} residues · {record.molecule}
          </div>
        </section>
        {hoverCoordinate == null || hoveredResidue == null ? null : (
          <section className="border-t border-token-border pt-3">
            <div className="text-xs font-medium text-token-text-secondary">
              Hover / focus
            </div>
            <div className="mt-1 font-mono text-token-text-primary">
              {hoverCoordinate.toLocaleString()} · {hoveredResidue}
              {hoveredQuality == null ? "" : ` · Q${hoveredQuality}`}
            </div>
          </section>
        )}
        {selection == null ? (
          <p className="text-token-text-secondary">
            Drag across the sequence to pin a coordinate range.
          </p>
        ) : (
          <section className="border-t border-token-border pt-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="font-semibold">
                  {getSelectionSegments(selection)
                    .map(
                      ({ end, start }) =>
                        `${start.toLocaleString()}–${end.toLocaleString()}`,
                    )
                    .join(" + ")}
                </div>
                <div className="mt-1 text-xs text-token-text-secondary">
                  {selectionLength.toLocaleString()} residues
                </div>
              </div>
              <button
                className="hover:bg-token-main-surface-secondary rounded border border-token-border px-2 py-0.5 text-xs font-medium text-token-text-secondary"
                onClick={onClearSelection}
                title="Clear selection (Esc)"
                type="button"
              >
                Clear
              </button>
            </div>
            <code className="mt-2 block max-h-32 overflow-auto rounded-md bg-token-main-surface-secondary p-2 font-mono break-all text-token-text-primary">
              {selectedSequence}
            </code>
            {selectionLength > (selectedSequence?.length ?? 0) ? (
              <div className="mt-1 text-xs text-token-text-tertiary">
                Showing the first{" "}
                {(selectedSequence?.length ?? 0).toLocaleString()} residues of
                this selection.
              </div>
            ) : null}
            {selectedQuality == null ? null : (
              <div className="mt-2 text-xs text-token-text-secondary">
                FASTQ quality Q{selectedQuality.min}–Q{selectedQuality.max} ·
                mean Q{selectedQuality.mean.toFixed(1)} across selected residues
              </div>
            )}
            {selectedTranslations.length === 0 ? null : (
              <WorkbenchDisclosure
                className="mt-3 space-y-1"
                id="sequence.inspector-six-frame"
                label="Six-frame translation"
                summaryClassName="cursor-pointer text-sm font-medium text-token-text-primary"
              >
                {selectedTranslations.map(({ aminoAcids, frame }) => (
                  <div
                    className="grid grid-cols-[2rem_1fr] gap-2 text-xs text-token-text-secondary"
                    key={frame}
                  >
                    <span>{frame > 0 ? `+${frame}` : frame}</span>
                    <code className="font-mono break-all">
                      {aminoAcids || "—"}
                    </code>
                  </div>
                ))}
              </WorkbenchDisclosure>
            )}
            {overlappingFeatures.length === 0 ? null : (
              <div className="mt-3 space-y-1">
                <div className="text-xs font-semibold tracking-wide text-token-text-tertiary uppercase">
                  Overlapping features
                </div>
                {overlappingFeatures.map((overlappingFeature) => (
                  <div
                    className="text-xs text-token-text-secondary"
                    key={overlappingFeature.id}
                  >
                    {overlappingFeature.label ?? overlappingFeature.type} ·{" "}
                    {overlappingFeature.start}–{overlappingFeature.end}
                  </div>
                ))}
              </div>
            )}
            {translatedSelections.length === 0 ? null : (
              <div className="mt-3 space-y-1">
                <div className="text-xs font-semibold tracking-wide text-token-text-tertiary uppercase">
                  CDS translation overlap
                </div>
                {translatedSelections.map(
                  ({
                    aminoAcidEnd,
                    aminoAcidStart,
                    feature: translatedFeature,
                    segmentKey,
                    translation,
                  }) => (
                    <div
                      className="text-xs text-token-text-secondary"
                      key={`${translatedFeature.id}:${segmentKey}`}
                    >
                      {translatedFeature.label ?? translatedFeature.type} · aa{" "}
                      {aminoAcidStart}–{aminoAcidEnd} ·{" "}
                      <code className="font-mono">{translation}</code>
                    </div>
                  ),
                )}
              </div>
            )}
          </section>
        )}
        {feature == null ? null : (
          <section className="border-t border-token-border pt-3">
            <div className="font-semibold">{feature.label ?? feature.type}</div>
            <div className="text-token-text-secondary">
              {feature.type} · {feature.start}–{feature.end} · {feature.strand}
            </div>
            {feature.sourceLocation == null ? null : (
              <div className="mt-1 font-mono text-xs break-all text-token-text-tertiary">
                {feature.sourceLocation}
              </div>
            )}
            {getLocalFeatureSegments(feature).length <= 1 ? null : (
              <div className="mt-1 text-xs text-token-text-secondary">
                Segments:{" "}
                {getLocalFeatureSegments(feature)
                  .map(({ end, start }) => `${start}–${end}`)
                  .join(", ")}
              </div>
            )}
            {feature.translation == null ? null : (
              <>
                <code className="mt-2 block max-h-40 overflow-auto rounded-md bg-token-main-surface-secondary p-2 font-mono break-all text-token-text-primary">
                  {feature.translation}
                </code>
                {feature.translationTrackReliable === false ? (
                  <p className="mt-2 text-xs text-token-text-secondary">
                    Codon-aligned track withheld because the source location is
                    compound or ambiguous; the source-provided translation
                    remains inspectable here.
                  </p>
                ) : null}
              </>
            )}
            {Object.keys(feature.qualifiers).length === 0 ? null : (
              <dl className="mt-3 grid gap-1 text-xs">
                {Object.entries(feature.qualifiers).map(([key, value]) => (
                  <div className="grid grid-cols-[5rem_1fr] gap-2" key={key}>
                    <dt className="text-token-text-tertiary">{key}</dt>
                    <dd className="break-words text-token-text-secondary">
                      {Array.isArray(value) ? value.join("; ") : value}
                    </dd>
                  </div>
                ))}
              </dl>
            )}
          </section>
        )}
      </div>
    </section>
  );
}
