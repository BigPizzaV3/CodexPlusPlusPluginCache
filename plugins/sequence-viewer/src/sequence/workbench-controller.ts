import { resolveViewerTarget } from "../target-resolution";
import { getEvidenceReferenceUnavailableReason } from "./read-pileup";
import type {
  SequenceViewerAnalysisRequest,
  SequenceViewerAnnotationRequest,
  SequenceViewerEditRequest,
} from "../viewer-operations";
import type { SequenceTrack } from "./tracks";
import {
  COMMON_RESTRICTION_ENZYMES,
  calculateSequenceStatistics,
  designPrimerPairs,
  findOpenReadingFrames,
  findRestrictionSites,
  simulateDigest,
} from "./analysis";
import {
  addSequenceFeature,
  deleteSequenceFeature,
  deleteSequenceRange,
  insertSequence,
  replaceSequenceRange,
  reverseComplementSequenceRange,
  rotateCircularSequence,
  updateSequenceFeature,
} from "./editing";
import { getGeneticCode } from "./genetic-code";
import { translateSixFrames } from "./translation";
import type {
  SequenceDocument,
  SequenceFeature,
  SequenceRecord,
  SequenceSelection,
} from "./types";

export type SequenceAnalysisResult = {
  analysis: SequenceViewerAnalysisRequest["analysis"];
  coordinateSystem: {
    basis: 1;
    end: "inclusive";
    space: "sequence";
  };
  provenance: {
    engine: string;
    geneticCodeId?: number;
    geneticCodeName?: string;
    limitations?: string;
  };
  recordId: string;
  result: Record<string, unknown>;
};

export type SequenceDocumentChange = {
  description: string;
  document: SequenceDocument;
  operation: string;
};

export function resolveSequenceRecord(
  document: SequenceDocument,
  selector: string,
): SequenceRecord {
  const resolution = resolveViewerTarget({
    aliases: (record) => [record.sourceLabel, record.description],
    id: (record) => record.id,
    selector,
    targets: document.records,
  });
  if (resolution.status !== "resolved" || resolution.target == null) {
    throw new Error(
      resolution.status === "ambiguous"
        ? `More than one sequence record matched ${selector}: ${resolution.candidates
            .map(({ id }) => id)
            .join(", ")}.`
        : `No sequence record matched ${selector}.`,
    );
  }
  return resolution.target;
}

export function inferGeneticCodeId(
  record: SequenceRecord,
  requestedGeneticCodeId?: number,
  viewerGeneticCodeId?: number,
): { id: number; name: string; source: "feature" | "request" | "viewer" } {
  if (requestedGeneticCodeId != null) {
    return requireGeneticCode(requestedGeneticCodeId, "request");
  }
  const featureCodes = [
    ...new Set(
      record.features.flatMap(({ geneticCodeId }) =>
        geneticCodeId == null ? [] : [geneticCodeId],
      ),
    ),
  ];
  if (featureCodes.length === 1 && featureCodes[0] != null) {
    return requireGeneticCode(featureCodes[0], "feature");
  }
  if (viewerGeneticCodeId != null) {
    return requireGeneticCode(viewerGeneticCodeId, "viewer");
  }
  if (featureCodes.length > 1) {
    throw new Error(
      `This record declares multiple genetic codes (${featureCodes.join(", ")}). Specify geneticCodeId explicitly.`,
    );
  }
  throw new Error(
    "No genetic code is selected. Choose a code in the viewer or specify geneticCodeId explicitly.",
  );
}

export function runSequenceAnalysis({
  document,
  request,
  selectedRecordId,
  selection,
  viewerGeneticCodeId,
}: {
  document: SequenceDocument;
  request: SequenceViewerAnalysisRequest;
  selectedRecordId: string;
  selection?: SequenceSelection;
  viewerGeneticCodeId?: number;
}): SequenceAnalysisResult {
  if (request.analysis === "quality-report") {
    throw new Error("Quality reports use the asynchronous document-wide QC job.");
  }
  if (request.analysis === "build-tree" || request.analysis === "distance-matrix") {
    throw new Error(
      `${request.analysis} is available only while the viewer is in Alignment mode.`,
    );
  }
  const record = resolveSequenceRecord(
    document,
    request.record ?? selectedRecordId,
  );
  const base = {
    analysis: request.analysis,
    coordinateSystem: {
      basis: 1 as const,
      end: "inclusive" as const,
      space: "sequence" as const,
    },
    recordId: record.id,
  };
  if (request.analysis === "statistics") {
    return {
      ...base,
      provenance: { engine: "sequence-viewer-statistics-v1" },
      result: calculateSequenceStatistics(
        record.sequence,
        record.molecule === "protein" ? "protein" : "nucleic-acid",
      ),
    };
  }
  requireNucleotideRecord(record, request.analysis);
  if (request.analysis === "translate") {
    const code = inferGeneticCodeId(
      record,
      request.geneticCodeId,
      viewerGeneticCodeId,
    );
    const range = normalizeRange(
      record,
      request.start ?? 1,
      request.end ?? record.length,
    );
    const translations = translateSixFrames(
      record.sequence.slice(range.start - 1, range.end),
      code.id,
    );
    const frames =
      request.frame == null
        ? translations
        : translations.filter(({ frame }) => frame === request.frame);
    return {
      ...base,
      provenance: {
        engine: "sequence-viewer-translation-v2",
        geneticCodeId: code.id,
        geneticCodeName: code.name,
      },
      result: {
        end: range.end,
        frames,
        geneticCodeSource: code.source,
        start: range.start,
      },
    };
  }
  if (request.analysis === "find-orfs") {
    const code = inferGeneticCodeId(
      record,
      request.geneticCodeId,
      viewerGeneticCodeId,
    );
    const orfs = findOpenReadingFrames({
      geneticCodeId: code.id,
      includePartial: request.includePartial,
      minAminoAcids: request.minAminoAcids,
      sequence: record.sequence,
      strands: request.strands,
    });
    return {
      ...base,
      provenance: {
        engine: "sequence-viewer-orf-v2",
        geneticCodeId: code.id,
        geneticCodeName: code.name,
      },
      result: {
        geneticCodeSource: code.source,
        items: orfs.items,
        truncated: orfs.truncated,
      },
    };
  }
  if (request.analysis === "restriction-analysis") {
    const requestedEnzymes =
      request.enzymes == null
        ? COMMON_RESTRICTION_ENZYMES
        : request.enzymes.map((selector) => {
            const match = COMMON_RESTRICTION_ENZYMES.find(
              ({ id, name }) =>
                id.toLowerCase() === selector.toLowerCase() ||
                name.toLowerCase() === selector.toLowerCase(),
            );
            if (match == null) {
              throw new Error(
                `Restriction enzyme ${selector} is not in the built-in catalog. Available enzymes: ${COMMON_RESTRICTION_ENZYMES.map(({ name }) => name).join(", ")}.`,
              );
            }
            return match;
          });
    const circular = request.circular ?? record.topology === "circular";
    const sites = findRestrictionSites({
      circular,
      enzymes: requestedEnzymes,
      sequence: record.sequence,
    });
    return {
      ...base,
      provenance: { engine: "sequence-viewer-restriction-v1" },
      result: {
        circular,
        fragments: simulateDigest({
          circular,
          sequenceLength: record.length,
          sites: sites.items,
        }),
        sites: sites.items,
        truncated: sites.truncated,
      },
    };
  }
  const selectedRange =
    selection?.recordId === record.id && selection.segments == null
      ? selection
      : undefined;
  const targetStart =
    request.targetStart ?? selectedRange?.start ?? Math.max(1, Math.floor(record.length / 3));
  const targetEnd =
    request.targetEnd ??
    selectedRange?.end ??
    Math.max(targetStart, Math.floor((record.length * 2) / 3));
  const range = normalizeRange(record, targetStart, targetEnd);
  return {
    ...base,
    provenance: {
      engine: "sequence-viewer-primer-explorer-v1",
      limitations:
        "Exploratory deterministic primer scoring only; verify specificity, thermodynamics, and assay conditions with a validated primer-design workflow before experimental use.",
    },
    result: {
      items: designPrimerPairs({
        maxPairs: request.maxPairs,
        maxProductLength: request.maxProductLength,
        minProductLength: request.minProductLength,
        sequence: record.sequence,
        targetEnd: range.end,
        targetStart: range.start,
      }),
      targetEnd: range.end,
      targetStart: range.start,
    },
  };
}

export function applySequenceEditRequest({
  document,
  request,
  selectedRecordId,
}: {
  document: SequenceDocument;
  request: SequenceViewerEditRequest;
  selectedRecordId: string;
}): SequenceDocumentChange | { historyOperation: "redo" | "undo" } {
  if (request.operation === "undo" || request.operation === "redo") {
    return { historyOperation: request.operation };
  }
  if (
    request.operation.startsWith("add-alignment") ||
    request.operation.startsWith("assign-alignment") ||
    request.operation.startsWith("delete-alignment") ||
    request.operation.startsWith("remove-alignment") ||
    request.operation === "reorder-alignment-rows" ||
    request.operation === "sort-alignment-rows"
  ) {
    throw new Error(
      `${request.operation} is available only while the viewer is in Alignment mode.`,
    );
  }
  const record = resolveSequenceRecord(
    document,
    "record" in request && request.record != null
      ? request.record
      : selectedRecordId,
  );
  let edit;
  switch (request.operation) {
    case "insert-sequence":
      edit = insertSequence(
        document,
        record.id,
        request.coordinate,
        request.sequence,
      );
      break;
    case "delete-sequence-range":
      edit = deleteSequenceRange(
        document,
        record.id,
        request.start,
        request.end,
      );
      break;
    case "replace-sequence-range":
      edit = replaceSequenceRange(
        document,
        record.id,
        request.start,
        request.end,
        request.sequence,
      );
      break;
    case "reverse-complement-range":
      edit = reverseComplementSequenceRange(
        document,
        record.id,
        request.start,
        request.end,
      );
      break;
    case "rotate-sequence":
      edit = rotateCircularSequence(
        document,
        record.id,
        request.newOrigin,
      );
      break;
    default:
      throw new Error(
        `${request.operation} is available only while the viewer is in Alignment mode.`,
      );
  }
  return {
    description: edit.change.description,
    document: edit.document,
    operation: edit.change.operation,
  };
}

export function applySequenceAnnotationRequest({
  document,
  request,
  selectedRecordId,
  tracks,
}: {
  document: SequenceDocument;
  request: SequenceViewerAnnotationRequest;
  selectedRecordId: string;
  tracks: Array<SequenceTrack>;
}): SequenceDocumentChange {
  const record = resolveSequenceRecord(
    document,
    request.record ?? selectedRecordId,
  );
  if (request.action === "add") {
    if (request.feature == null) throw new Error("Adding an annotation requires feature.");
    return {
      description: `Added annotation ${request.feature.label ?? request.feature.id}.`,
      document: addSequenceFeature(document, record.id, request.feature),
      operation: "add-annotation",
    };
  }
  if (request.action === "update") {
    if (request.feature == null) throw new Error("Updating an annotation requires feature.");
    return {
      description: `Updated annotation ${request.feature.label ?? request.feature.id}.`,
      document: updateSequenceFeature(
        document,
        record.id,
        request.feature.id,
        request.feature,
      ),
      operation: "update-annotation",
    };
  }
  if (request.action === "delete") {
    const featureId = request.featureId ?? request.feature?.id;
    if (featureId == null) throw new Error("Deleting an annotation requires featureId.");
    return {
      description: `Deleted annotation ${featureId}.`,
      document: deleteSequenceFeature(document, record.id, featureId),
      operation: "delete-annotation",
    };
  }
  if (request.trackId == null) throw new Error("Importing annotations requires trackId.");
  const evidenceUnavailableReason = getEvidenceReferenceUnavailableReason(record);
  if (evidenceUnavailableReason != null) throw new Error(evidenceUnavailableReason);
  const track = tracks.find(({ id }) => id === request.trackId);
  if (track == null) throw new Error(`No loaded track matched ${request.trackId}.`);
  if (track.kind !== "annotations") {
    throw new Error(`${track.name} is not an annotation track.`);
  }
  const references = new Set(
    [record.id, record.sourceLabel].map((reference) =>
      reference.toLowerCase().replace(/^chr/u, ""),
    ),
  );
  const imported = (track.features ?? []).filter(({ reference }) =>
    references.has(reference.toLowerCase().replace(/^chr/u, "")),
  );
  if (imported.length === 0) {
    throw new Error(
      `${track.name} has no features mapped to ${record.sourceLabel}. Check the track reference mapping before importing.`,
    );
  }
  let nextDocument = document;
  const existingIds = new Set(record.features.map(({ id }) => id));
  const uniqueFeatureId = (baseId: string): string => {
    let id = baseId;
    let suffix = 2;
    while (existingIds.has(id)) {
      id = `${baseId}.${suffix}`;
      suffix += 1;
    }
    existingIds.add(id);
    return id;
  };
  for (const [index, feature] of imported.entries()) {
    const id = uniqueFeatureId(feature.id || `${track.id}-${index + 1}`);
    const orderedSegments =
      feature.segments == null
        ? undefined
        : feature.strand === "-"
          ? [...feature.segments].reverse()
          : feature.segments;
    const orderedCodingSegments =
      feature.codingSegments == null
        ? undefined
        : feature.strand === "-"
          ? [...feature.codingSegments].reverse()
          : feature.codingSegments;
    const codonStart =
      feature.phase === 0
        ? 1
        : feature.phase === 1
          ? 2
          : feature.phase === 2
            ? 3
            : undefined;
    const converted: SequenceFeature = {
      ...(feature.type.toLowerCase() === "cds" && codonStart != null
        ? { codonStart }
        : {}),
      end: feature.end,
      id,
      ...(feature.label == null ? {} : { label: feature.label }),
      qualifiers: {
        ...feature.attributes,
        ...(feature.phase == null
          ? {}
          : { gtf_phase: String(feature.phase) }),
        imported_from_track: track.name,
        ...(feature.score == null ? {} : { score: String(feature.score) }),
      },
      ...(orderedSegments == null ? {} : { segments: orderedSegments }),
      start: feature.start,
      strand: feature.strand,
      type: feature.type,
    };
    nextDocument = addSequenceFeature(nextDocument, record.id, converted);
    if (
      feature.type.toLowerCase() !== "cds" &&
      orderedCodingSegments != null &&
      orderedCodingSegments.length > 0
    ) {
      const codingFeature: SequenceFeature = {
        codonStart: 1,
        end: Math.max(...orderedCodingSegments.map(({ end }) => end)),
        id: uniqueFeatureId(`${id}.CDS`),
        ...(feature.label == null
          ? {}
          : { label: `${feature.label} CDS` }),
        qualifiers: {
          ...feature.attributes,
          imported_from_track: track.name,
          parent_feature_id: id,
          transcript_id: feature.attributes.transcript_id ?? id,
        },
        segments: orderedCodingSegments,
        start: Math.min(...orderedCodingSegments.map(({ start }) => start)),
        strand: feature.strand,
        type: "CDS",
      };
      nextDocument = addSequenceFeature(nextDocument, record.id, codingFeature);
    }
  }
  return {
    description: `Imported ${imported.length} annotations from ${track.name}.`,
    document: nextDocument,
    operation: "import-annotations",
  };
}

function normalizeRange(
  record: SequenceRecord,
  requestedStart: number,
  requestedEnd: number,
): { end: number; start: number } {
  const start = Math.min(requestedStart, requestedEnd);
  const end = Math.max(requestedStart, requestedEnd);
  if (start < 1 || end > record.length) {
    throw new Error(
      `Range ${start}-${end} is outside ${record.sourceLabel} (1-${record.length}).`,
    );
  }
  return { end, start };
}

function requireGeneticCode(
  id: number,
  source: "feature" | "request" | "viewer",
): { id: number; name: string; source: "feature" | "request" | "viewer" } {
  const code = getGeneticCode(id);
  if (code == null) throw new Error(`NCBI genetic code ${id} is not supported.`);
  return { id, name: code.name, source };
}

function requireNucleotideRecord(
  record: SequenceRecord,
  analysis: string,
): void {
  if (record.molecule === "protein" || record.molecule === "unknown") {
    throw new Error(`${analysis} requires a nucleotide sequence.`);
  }
}
