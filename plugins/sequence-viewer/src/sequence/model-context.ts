import {
  formatContextLines,
  truncateContextText,
  type ModelContextUpdate,
} from "../model-context";
import { getSelectedFeatureTranslation } from "./translation-track";
import { translateSixFrames } from "./translation";
import { featureContainsCoordinate } from "./feature-location";
import { getEvidenceReferenceUnavailableReason } from "./read-pileup";
import type {
  SequenceDocument,
  SequenceFeature,
  SequencePaletteId,
  SequenceRecord,
  SequenceSearchHit,
  SequenceSelection,
} from "./types";
import type { WorkbenchArtifact, WorkbenchJob } from "../workbench-state";
import type { SequenceTrack } from "./tracks";
import { SEQUENCE_VIEWER_MODEL_CONTEXT_SCHEMA_VERSION } from "../runtime-contract";
import {
  extractSelectedSequence,
  getSelectionLength,
  getSelectionSegments,
  summarizeSelectedQuality,
  selectionContainsCoordinate,
  selectionOverlapsFeature,
} from "./selection";

export type SequenceViewerModelContextInput = {
  activeSearchHitIndex: number;
  artifacts?: Array<WorkbenchArtifact>;
  dirty?: boolean;
  document: SequenceDocument;
  focusCoordinate?: number;
  geneticCodeId?: number;
  hits: Array<SequenceSearchHit>;
  jobs?: Array<WorkbenchJob>;
  layout?: "circular" | "linear" | "split";
  orientation?: "forward" | "reverse-complement";
  paletteId: SequencePaletteId;
  query: string;
  record: SequenceRecord;
  selectedFeature?: SequenceFeature;
  selection?: SequenceSelection;
  sourceStateKey?: string;
  showFeatures: boolean;
  showQuality: boolean;
  searchPending?: boolean;
  searchTruncated?: boolean;
  showTranslation: boolean;
  synchronizedViews?: boolean;
  tracks?: Array<SequenceTrack>;
  viewport?: { end: number; start: number } | null;
  viewerSessionId?: string;
  wrapWidth: number;
};

export function createSequenceViewerModelContext({
  activeSearchHitIndex,
  artifacts = [],
  dirty = false,
  document,
  focusCoordinate,
  geneticCodeId = 1,
  hits,
  jobs = [],
  layout = "linear",
  orientation = "forward",
  paletteId,
  query,
  record,
  selectedFeature,
  selection,
  sourceStateKey,
  showFeatures,
  showQuality,
  searchPending = false,
  searchTruncated = false,
  showTranslation,
  synchronizedViews = true,
  tracks = [],
  viewport = null,
  viewerSessionId,
  wrapWidth,
}: SequenceViewerModelContextInput): ModelContextUpdate {
  const activeSearchHit = hits[activeSearchHitIndex] ?? null;
  const selectedSequence =
    selection == null
      ? null
      : extractSelectedSequence(
          record,
          selection,
          MAX_CONTEXT_SELECTED_SEQUENCE_LENGTH,
        );
  const focusedCoordinate = focusCoordinate ?? null;
  const selectedRecordIndex = document.records.findIndex(
    ({ id }) => id === record.id,
  );
  const totalRecordCount =
    document.recordInventory?.totalCount ?? document.records.length;
  const selectionContext =
    selection == null
      ? null
      : serializeSelectionContext({
          geneticCodeId,
          record,
          selection,
          selectedSequence: selectedSequence ?? "",
        });
  const focusContext =
    focusedCoordinate == null
      ? null
      : serializeCoordinateContext(record, focusedCoordinate);
  const activeTarget =
    selectionContext != null
      ? { kind: "sequence-range", ...selectionContext }
      : selectedFeature != null
        ? { kind: "feature", ...serializeFeature(selectedFeature) }
        : {
            id: record.id,
            kind: "record",
            label: record.sourceLabel,
            length: record.length,
          };
  const focusDiffersFromActiveTarget =
    focusContext != null &&
    (selection == null ||
      focusedCoordinate == null ||
      !selectionContainsCoordinate(selection, focusedCoordinate));

  return {
    structuredContent: {
      schemaVersion: SEQUENCE_VIEWER_MODEL_CONTEXT_SCHEMA_VERSION,
      activeTarget,
      artifact: {
        classification: {
          confidence: document.classification.confidence,
          kind: document.classification.kind,
          molecule: document.classification.molecule,
          suggestedViewer: document.classification.suggestedViewer,
        },
        fileName: document.fileName ?? null,
        format: document.format,
        fastqSummary: document.fastqSummary ?? null,
        kind: document.kind,
        warningCount: document.warnings.length,
        sourceStateKey: sourceStateKey ?? null,
      },
      coordinateSystem: {
        basis: 1,
        end: "inclusive",
        orientation,
        space: "sequence",
      },
      display: {
        paletteId,
        showFeatures,
        showQuality,
        showTranslation,
        wrapWidth,
        geneticCodeId,
        layout,
        orientation,
        synchronizedViews,
        viewport,
      },
      displayedRecord: {
        description: record.description ?? null,
        evidenceCoordinatesStale: record.evidenceCoordinatesStale === true,
        evidenceUnavailableReason:
          getEvidenceReferenceUnavailableReason(record),
        id: record.id,
        index: Math.max(0, selectedRecordIndex),
        length: record.length,
        metadata: serializeMetadata(record.metadata),
        molecule: record.molecule,
        materializedRecordCount: document.records.length,
        recordCount: totalRecordCount,
        sequence:
          record.sequence.length <= MAX_CONTEXT_RECORD_SEQUENCE_LENGTH
            ? record.sequence
            : truncateContextText(
                record.sequence,
                MAX_CONTEXT_RECORD_SEQUENCE_LENGTH,
              ),
        sequenceTruncated:
          record.sequence.length > MAX_CONTEXT_RECORD_SEQUENCE_LENGTH,
        sourceLabel: record.sourceLabel,
        topology: record.topology ?? null,
      },
      features: {
        items: record.features
          .slice(0, MAX_CONTEXT_FEATURES)
          .map(serializeFeature),
        totalCount: record.features.length,
        truncated: record.features.length > MAX_CONTEXT_FEATURES,
      },
      focus: focusContext,
      transientFocus: focusContext,
      pinnedFeature:
        selectedFeature == null ? null : serializeFeature(selectedFeature),
      search: {
        activeHit:
          activeSearchHit == null
            ? null
            : {
                end: activeSearchHit.end,
                orientation: activeSearchHit.orientation,
                recordId: activeSearchHit.recordId,
                start: activeSearchHit.start,
              },
        hitCount: hits.length,
        pending: searchPending,
        query: query.trim(),
        truncated: searchTruncated,
      },
      sequenceRecords: {
        items: document.records
          .slice(0, MAX_CONTEXT_RECORDS)
          .map((candidate) => ({
            description: candidate.description ?? null,
            id: candidate.id,
            length: candidate.length,
            molecule: candidate.molecule,
            sourceLabel: candidate.sourceLabel,
          })),
        materializedCount: document.records.length,
        totalCount: totalRecordCount,
        truncated:
          totalRecordCount > document.records.length ||
          document.records.length > MAX_CONTEXT_RECORDS,
      },
      selection: selectionContext,
      workbench: {
        actionHints: [
          "Use sequence.query_viewer for FASTQ summary metrics and paginated records, features, ranges, tracks, jobs, or artifacts.",
          "Treat activeTarget as the user's primary target. Mention transientFocus separately only when both are populated and refer to different coordinates.",
          "Use sequence.run_analysis, sequence.edit_copy, sequence.manage_annotations, sequence.align, or sequence.export_artifact for reproducible operations on this mounted session.",
        ],
        artifacts: artifacts
          .slice(-10)
          .map(({ content: _content, ...artifact }) => artifact),
        artifactCount: artifacts.length,
        capabilities: [
          "analysis",
          "annotation-editing",
          "circular-map",
          "editable-copy",
          "evidence-tracks",
          "export",
          "genetic-code-aware-translation",
          "overview-navigation",
          "primer-and-digest-exploration",
          "session-restore",
        ],
        dirty,
        jobs: jobs.slice(-20),
        trackCount: tracks.length,
        tracks: tracks.slice(0, 20).map((track) => ({
          featureCount: track.features?.length ?? 0,
          format: track.format,
          id: track.id,
          kind: track.kind,
          mapping: track.mapping,
          name: track.name,
          readCount: track.reads?.length ?? 0,
          source: track.source,
          summary: track.summary,
          variantCount: track.variants?.length ?? 0,
        })),
      },
      viewer: "sequence",
      viewerSessionId: viewerSessionId ?? null,
    },
    text: formatContextLines([
      "Current scientific viewer: Sequence viewer",
      `Artifact: ${document.fileName ?? "biological sequence"} (${document.format})`,
      `Displayed record: ${record.sourceLabel} (${record.molecule}), ${record.length.toLocaleString()} residues`,
      totalRecordCount > 1
        ? `Record browser: showing ${totalRecordCount === document.records.length ? "" : "retained "}record ${Math.max(0, selectedRecordIndex) + 1} of ${document.records.length}${totalRecordCount === document.records.length ? "" : ` (${totalRecordCount.toLocaleString()} total records summarized)`}`
        : null,
      record.features.length === 0
        ? "Features: none"
        : `Features: ${record.features.length.toLocaleString()} available; exact feature IDs are in structured model context`,
      `Display: palette ${paletteId}; wrap ${wrapWidth}; features ${showFeatures ? "on" : "off"}; translation ${showTranslation ? "on" : "off"}; quality ${showQuality ? "on" : "off"}`,
      focusContext == null ? null : formatFocusSummary(focusContext),
      focusContext == null || !focusDiffersFromActiveTarget
        ? null
        : "Transient focus differs from the active target; answer for the active target first and distinguish the focused coordinate only when relevant.",
      selection == null
        ? "Selection: none"
        : `Selection: residues ${getSelectionSegments(selection)
            .map(
              ({ end, start }) =>
                `${start.toLocaleString()}-${end.toLocaleString()}`,
            )
            .join(
              " + ",
            )} (${getSelectionLength(selection).toLocaleString()} residues${selection.segments == null ? "" : isOriginSpanningSelection(record, selection) ? ", origin-spanning" : ", discontinuous"}); sequence ${truncateContextText(selectedSequence ?? "")}`,
      selectionContext == null
        ? null
        : formatSelectionDetails(selectionContext),
      selectedFeature == null
        ? null
        : `Pinned feature: ${selectedFeature.label ?? selectedFeature.type} (${selectedFeature.type}) ${selectedFeature.start.toLocaleString()}-${selectedFeature.end.toLocaleString()}`,
      formatSearchSummary({
        activeSearchHit,
        hits,
        pending: searchPending,
        query,
        truncated: searchTruncated,
      }),
    ]),
  };
}

export function formatSequenceViewerModelContext(
  input: SequenceViewerModelContextInput,
): string {
  return createSequenceViewerModelContext(input).text;
}

const MAX_CONTEXT_SELECTION_RESIDUES = 50;
const MAX_CONTEXT_RECORD_SEQUENCE_LENGTH = 1024;
const MAX_CONTEXT_SELECTED_SEQUENCE_LENGTH = 2_048;
const MAX_CONTEXT_FEATURES = 50;
const MAX_CONTEXT_FEATURE_VALUE_LENGTH = 512;
const MAX_CONTEXT_RECORDS = 50;

function serializeSelectionContext({
  geneticCodeId,
  record,
  selection,
  selectedSequence,
}: {
  geneticCodeId: number;
  record: SequenceRecord;
  selection: SequenceSelection;
  selectedSequence: string;
}): Record<string, unknown> {
  const allOverlappingFeatures = getOverlappingFeatures(record, selection);
  const overlappingFeatures = allOverlappingFeatures.slice(
    0,
    MAX_CONTEXT_FEATURES,
  );
  const residues = Array.from(
    selectionCoordinates(selection, MAX_CONTEXT_SELECTION_RESIDUES),
    (coordinate) => serializeCoordinateContext(record, coordinate),
  );
  const selectionLength = getSelectionLength(selection);
  return {
    discontinuous: getSelectionSegments(selection).length > 1,
    end: selection.end,
    featureCount: allOverlappingFeatures.length,
    featuresTruncated:
      allOverlappingFeatures.length > overlappingFeatures.length,
    length: selectionLength,
    overlappingFeatures: overlappingFeatures.map(serializeFeature),
    quality:
      record.quality == null
        ? null
        : summarizeSelectedQuality(record, selection),
    recordId: selection.recordId,
    residues,
    sequence: selectedSequence,
    segments: getSelectionSegments(selection),
    sequenceTruncated: selectionLength > selectedSequence.length,
    sixFrameTranslations:
      record.molecule === "protein" || record.molecule === "unknown"
        ? []
        : translateSixFrames(selectedSequence, geneticCodeId).map(
            ({ aminoAcids, frame }) => ({
              aminoAcids: truncateContextText(aminoAcids, 256),
              frame,
              geneticCodeId,
            }),
          ),
    start: selection.start,
    translatedSelections: overlappingFeatures.flatMap((feature) =>
      getSelectionSegments(selection).flatMap((segment) => {
        const translatedSelection = getSelectedFeatureTranslation({
          feature,
          selectionEnd: segment.end,
          selectionStart: segment.start,
        });
        return translatedSelection == null
          ? []
          : [
              {
                ...translatedSelection,
                translation: truncateContextText(
                  translatedSelection.translation,
                  MAX_CONTEXT_FEATURE_VALUE_LENGTH,
                ),
                feature: serializeFeature(feature),
                segment,
              },
            ];
      }),
    ),
    truncatedResidueCount: Math.max(0, selectionLength - residues.length),
    wraparound: isOriginSpanningSelection(record, selection),
  };
}

function isOriginSpanningSelection(
  record: SequenceRecord,
  selection: SequenceSelection,
): boolean {
  const [first, second] = selection.segments ?? [];
  return (
    record.topology === "circular" &&
    selection.segments?.length === 2 &&
    first != null &&
    second != null &&
    first.start === selection.start &&
    first.end === record.length &&
    second.start === 1 &&
    second.end === selection.end &&
    first.start > second.end
  );
}

function serializeCoordinateContext(
  record: SequenceRecord,
  coordinate: number,
): Record<string, unknown> {
  const overlappingFeatures = record.features.filter((feature) =>
    featureContainsCoordinate(feature, coordinate),
  );
  return {
    coordinate,
    overlappingFeatures: overlappingFeatures.map(serializeFeature),
    quality: record.quality?.phred[coordinate - 1] ?? null,
    symbol: record.sequence[coordinate - 1] ?? null,
  };
}

function serializeFeature(feature: SequenceFeature): Record<string, unknown> {
  return {
    end: feature.end,
    codonStart: feature.codonStart ?? null,
    geneticCodeId: feature.geneticCodeId ?? null,
    id: feature.id,
    label: feature.label ?? null,
    qualifiers: serializeMetadata(feature.qualifiers),
    segments: feature.segments ?? null,
    sourceLocation: feature.sourceLocation ?? null,
    start: feature.start,
    strand: feature.strand,
    translation:
      feature.translation == null
        ? null
        : truncateContextText(
            feature.translation,
            MAX_CONTEXT_FEATURE_VALUE_LENGTH,
          ),
    translationTrackReliable: feature.translationTrackReliable ?? null,
    translationMapping:
      feature.translationCoordinateMap == null
        ? {
            status: "unavailable",
            reason:
              feature.translationMappingUnavailableReason ??
              "no exact codon coordinate map",
          }
        : {
            aminoAcidCount: feature.translationCoordinateMap.length,
            status: "exact",
          },
    translationSource: feature.translationSource ?? null,
    type: feature.type,
  };
}

function getOverlappingFeatures(
  record: SequenceRecord,
  selection: SequenceSelection,
): Array<SequenceFeature> {
  return record.features.filter((feature) =>
    selectionOverlapsFeature(selection, feature),
  );
}

function selectionCoordinates(
  selection: SequenceSelection,
  limit: number,
): Array<number> {
  const coordinates: Array<number> = [];
  for (const { end, start } of getSelectionSegments(selection)) {
    for (
      let coordinate = start;
      coordinate <= end && coordinates.length < limit;
      coordinate += 1
    ) {
      coordinates.push(coordinate);
    }
    if (coordinates.length >= limit) break;
  }
  return coordinates;
}

function serializeMetadata(
  metadata: Record<string, string | Array<string>>,
): Record<string, string | Array<string>> {
  return Object.fromEntries(
    Object.entries(metadata)
      .slice(0, MAX_CONTEXT_FEATURES)
      .map(([key, value]) => [
        key,
        Array.isArray(value)
          ? value
              .slice(0, 20)
              .map((item) =>
                truncateContextText(item, MAX_CONTEXT_FEATURE_VALUE_LENGTH),
              )
          : truncateContextText(value, MAX_CONTEXT_FEATURE_VALUE_LENGTH),
      ]),
  );
}

function formatFocusSummary(focus: Record<string, unknown>): string {
  const coordinate = Number(focus.coordinate ?? 0);
  const symbol = typeof focus.symbol === "string" ? focus.symbol : "?";
  const quality = typeof focus.quality === "number" ? focus.quality : null;
  return `Focus: residue ${coordinate.toLocaleString()} ${symbol}${quality == null ? "" : `; quality Q${quality.toLocaleString()}`}`;
}

function formatSelectionDetails(
  selection: Record<string, unknown>,
): string | null {
  const details = [
    formatQualitySummary(selection.quality as Record<string, unknown> | null),
    formatFeatureSummary(
      "Selection overlaps",
      selection.overlappingFeatures as Array<Record<string, unknown>>,
    ),
    formatTranslationSummary(
      selection.translatedSelections as Array<Record<string, unknown>>,
    ),
  ].filter((value): value is string => value != null);
  return details.length === 0 ? null : details.join("; ");
}

function formatQualitySummary(
  quality: Record<string, unknown> | null,
): string | null {
  if (quality == null) {
    return null;
  }
  return `Selection quality: Q${Number(quality.min).toLocaleString()}-Q${Number(quality.max).toLocaleString()} (mean ${Math.round(Number(quality.mean)).toLocaleString()})`;
}

function formatFeatureSummary(
  label: string,
  features: Array<Record<string, unknown>>,
): string | null {
  if (features.length === 0) {
    return null;
  }
  return `${label}: ${truncateContextText(features.map(formatFeatureLabel).join("; "), 180)}`;
}

function formatTranslationSummary(
  translatedSelections: Array<Record<string, unknown>>,
): string | null {
  if (translatedSelections.length === 0) {
    return null;
  }
  return `Selection translation overlap: ${truncateContextText(
    translatedSelections
      .map((selection) => {
        const feature = selection.feature as Record<string, unknown>;
        return `${formatFeatureLabel(feature)} aa ${Number(selection.aminoAcidStart).toLocaleString()}-${Number(selection.aminoAcidEnd).toLocaleString()} ${String(selection.translation ?? "")}`;
      })
      .join("; "),
    180,
  )}`;
}

function formatFeatureLabel(feature: Record<string, unknown>): string {
  return `${String(feature.label ?? feature.type ?? "feature")} (${String(feature.type ?? "feature")}) ${Number(feature.start).toLocaleString()}-${Number(feature.end).toLocaleString()}`;
}

function formatSearchSummary({
  activeSearchHit,
  hits,
  pending,
  query,
  truncated,
}: {
  activeSearchHit: SequenceSearchHit | null;
  hits: Array<SequenceSearchHit>;
  pending: boolean;
  query: string;
  truncated: boolean;
}): string {
  const normalizedQuery = query.trim();
  if (normalizedQuery.length === 0) {
    return "Search: none";
  }
  if (pending) return `Search: "${normalizedQuery}" · searching`;
  if (activeSearchHit == null) {
    return `Search: "${normalizedQuery}" · ${hits.length.toLocaleString()}${truncated ? "+ bounded" : ""} hit${hits.length === 1 ? "" : "s"}`;
  }
  return `Search: "${normalizedQuery}" · ${hits.length.toLocaleString()}${truncated ? "+ bounded" : ""} hit${hits.length === 1 ? "" : "s"} · active ${activeSearchHit.orientation} hit at residues ${activeSearchHit.start.toLocaleString()}-${activeSearchHit.end.toLocaleString()}`;
}
