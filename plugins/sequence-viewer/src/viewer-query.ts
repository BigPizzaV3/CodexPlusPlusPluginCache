import { utf8ByteLength, SEQUENCE_VIEWER_LIMITS } from "./runtime-contract";
import { resolveViewerTarget } from "./target-resolution";
import type { MsaDerivedAnalysis } from "./msa/analysis";
import { findTreeNode, type GuideTreeResult } from "./msa/phylogenetic-tree";
import type { MsaDocument } from "./msa/types";
import type { MsaMotifSearchHit } from "./msa/search";
import { buildEvidenceWindow } from "./sequence/tracks";
import { queryChromatogram } from "./sequence/chromatogram-query";
import {
  DEFAULT_READ_PILEUP_STATE,
  findVisibleReadMate,
  getEvidenceReferenceUnavailableReason,
  getReadPileupEntry,
  identifyReadPileupEntries,
  projectReadAlignment,
  READ_PILEUP_DETAIL_BASES,
  READ_PILEUP_MAX_DISPLAY_READS,
  readFlagLabels,
  readPassesPileupFilters,
  referencesMatch,
  resolveReadReferenceRecord,
  summarizeReadBaseQuality,
  type ReadPileupState,
} from "./sequence/read-pileup";
import type {
  SequenceDocument,
  SequenceFeature,
  SequenceRecord,
  SequenceSearchHit,
} from "./sequence/types";
import type { WorkbenchArtifact, WorkbenchJob } from "./workbench-state";
import type { EvidenceWindow, SequenceTrack } from "./sequence/tracks";
import type { SequenceViewerQueryRequest } from "./viewer-operations";

export type ViewerQueryResult = {
  coordinateSystem?: Record<string, unknown>;
  items?: Array<unknown>;
  nextCursor?: string | null;
  page?: { count: number; offset: number; totalCount: number };
  result?: Record<string, unknown>;
  target: SequenceViewerQueryRequest["target"];
  truncated?: boolean;
};

export function querySequenceViewer({
  artifacts,
  document,
  hits,
  jobs,
  readPileupRange,
  readPileupState = DEFAULT_READ_PILEUP_STATE,
  request,
  selectedRecordId,
  tracks,
}: {
  artifacts: Array<WorkbenchArtifact>;
  document: SequenceDocument;
  hits: Array<SequenceSearchHit>;
  jobs: Array<WorkbenchJob>;
  readPileupRange?: { end: number; start: number };
  readPileupState?: ReadPileupState;
  request: SequenceViewerQueryRequest;
  selectedRecordId: string;
  tracks: Array<SequenceTrack>;
}): ViewerQueryResult {
  if (
    request.target === "reads" ||
    request.target === "coverage" ||
    request.target === "variants"
  ) {
    const reason = evidenceQueryUnavailableReason(document, request.reference);
    if (reason != null)
      return boundedQueryResult({
        items: [],
        result: {
          available: false,
          coverageComplete: false,
          coordinateMapping: "unavailable",
          originalSourceTracksRetained: true,
          unavailableReason: reason,
        },
        target: request.target,
      });
  }
  switch (request.target) {
    case "chromatogram":
      return queryChromatogram({ document, request, selectedRecordId });
    case "read-pileup-state":
      return boundedQueryResult({
        result: {
          ...readPileupState,
          detailWindowLimit: READ_PILEUP_DETAIL_BASES,
          displayReadLimit: READ_PILEUP_MAX_DISPLAY_READS,
          evidenceCoordinatesStale:
            document.records.find((record) => record.id === selectedRecordId)
              ?.evidenceCoordinatesStale === true,
          unavailableReason: getEvidenceReferenceUnavailableReason(
            document.records.find((record) => record.id === selectedRecordId),
          ),
          range: readPileupRange ?? null,
          reference:
            document.records.find((record) => record.id === selectedRecordId)
              ?.sourceLabel ?? null,
        },
        target: request.target,
      });
    case "read-detail":
      return queryReadDetail({
        document,
        readPileupRange,
        readPileupState,
        request,
        selectedRecordId,
        tracks,
      });
    case "sequence-ui-state":
    case "quality-report":
    case "workbench-panels":
    case "workbench-disclosures":
    case "workbench-feedback":
      throw new Error(
        `${request.target} requires the mounted Sequence workbench state.`,
      );
    case "records":
      return pagedResult(request, document.records.map(serializeRecord));
    case "features": {
      const record = resolveSequenceRecord(
        document,
        request.record ?? selectedRecordId,
      );
      const features =
        request.query == null
          ? record.features
          : record.features.filter((feature) =>
              featureMatchesQuery(feature, request.query ?? ""),
            );
      return pagedResult(request, features.map(serializeFeature), {
        coordinateSystem: sequenceCoordinates(record),
      });
    }
    case "sequence-range": {
      const record = resolveSequenceRecord(
        document,
        request.record ?? selectedRecordId,
      );
      const range = validateRange(record.length, request.start, request.end);
      if (range.end - range.start + 1 > 100_000) {
        throw new Error(
          "Sequence-range queries are limited to 100,000 residues. Request smaller coordinate windows.",
        );
      }
      return boundedQueryResult({
        coordinateSystem: sequenceCoordinates(record),
        result: {
          end: range.end,
          length: range.end - range.start + 1,
          recordId: record.id,
          sequence: record.sequence.slice(range.start - 1, range.end),
          start: range.start,
        },
        target: request.target,
      });
    }
    case "quality": {
      const record = resolveSequenceRecord(
        document,
        request.record ?? selectedRecordId,
      );
      if (record.quality == null) {
        throw new Error(`${record.sourceLabel} has no FASTQ quality values.`);
      }
      const range = validateRange(record.length, request.start, request.end);
      if (range.end - range.start + 1 > 100_000) {
        throw new Error(
          "Quality queries are limited to 100,000 residues. Request smaller coordinate windows.",
        );
      }
      const values = record.quality.phred.slice(range.start - 1, range.end);
      return boundedQueryResult({
        coordinateSystem: sequenceCoordinates(record),
        result: {
          end: range.end,
          max: Math.max(...values),
          mean:
            values.reduce((sum, value) => sum + value, 0) /
            Math.max(1, values.length),
          min: Math.min(...values),
          recordId: record.id,
          start: range.start,
          values,
        },
        target: request.target,
      });
    }
    case "metrics": {
      const summary = document.fastqSummary;
      if (summary == null) {
        throw new Error(
          "Aggregate Sequence metrics are available for mounted FASTQ artifacts. Query records, features, or a sequence range for this artifact instead.",
        );
      }
      return pagedResult(request, [
        {
          ...summary,
          gcPercent: summary.gcFraction * 100,
          q20Percent: summary.q20Fraction * 100,
          q30Percent: summary.q30Fraction * 100,
          type: "fastq-summary",
        },
      ]);
    }
    case "search-hits":
      return pagedResult(request, hits);
    case "annotations":
      return pagedResult(
        request,
        tracks.flatMap(({ features = [], id, name }) =>
          features.map((feature) => ({
            ...feature,
            coordinateSpace: "original-source-reference",
            unavailableReason: evidenceQueryUnavailableReason(
              document,
              feature.reference,
            ),
            trackId: id,
            trackName: name,
          })),
        ),
      );
    case "tracks":
      return pagedResult(request, tracks.map(summarizeTrack), {
        result: {
          coordinateSpace: "original-source-reference",
          staleReferenceCount: document.records.filter(
            (record) => record.evidenceCoordinatesStale === true,
          ).length,
        },
      });
    case "jobs":
      return pagedResult(request, jobs);
    case "artifacts":
      return pagedResult(
        request,
        artifacts.map(({ content: _content, ...artifact }) => artifact),
      );
    case "variants": {
      const window = buildEvidenceWindow({
        end: request.end,
        reference: request.reference,
        referenceRecords: document.records,
        start: request.start,
        tracks,
      });
      return pagedResult(request, window.variants.map(summarizeVariant));
    }
    case "coverage": {
      const window = buildEvidenceWindow({
        end: request.end,
        readFilter: (read) =>
          readPassesPileupFilters(read, readPileupState.options),
        reference: request.reference,
        referenceRecords: document.records,
        start: request.start,
        tracks,
      });
      return pagedResult(request, window.coverage, {
        result: coverageQueryMetadata(window),
      });
    }
    case "reads": {
      const window = buildEvidenceWindow({
        end: request.end,
        maxReads: 10_000,
        readFilter: (read) =>
          readPassesPileupFilters(read, readPileupState.options),
        reference: request.reference,
        referenceRecords: document.records,
        start: request.start,
        tracks,
      });
      return pagedResult(
        request,
        identifyReadPileupEntries(tracks, window.reads).map((entry) => ({
          ...entry.read,
          sourceReadIndex: entry.sourceReadIndex,
          trackId: entry.trackId,
          trackName: entry.trackName,
        })),
        {
          result: {
            downsampled: window.downsampled,
            filteredReadCount: window.filteredReadCount,
            sampledReadCount: window.sampledReadCount,
            sourceReadCount: window.sourceReadCount,
            sourceTruncated: window.sourceTruncated,
            totalReadCount: window.totalReadCount,
          },
        },
      );
    }
    case "columns":
    case "rows":
    case "tree-nodes":
      throw new Error(
        `${request.target} is available only while the viewer is in Alignment mode.`,
      );
  }
}

function coverageQueryMetadata(window: EvidenceWindow) {
  return {
    coverageBasis: "CIGAR M, =, X aligned bases; D/N excluded",
    coverageScope: "filtered-loaded-reads-before-display-sampling",
    coverageBudgetExceeded: window.coverageBudgetExceeded,
    coverageComplete: window.coverageComplete,
    coverageOmittedReadCount: window.coverageOmittedReadCount,
    coverageReadCount: window.coverageReadCount,
    filteredReadCount: window.filteredReadCount,
    sourceReadCount: window.sourceReadCount,
    sourceReferenceUncertain: window.sourceReferenceUncertain,
    sourceTruncated: window.sourceTruncated,
    totalReadCount: window.totalReadCount,
  };
}

function evidenceQueryUnavailableReason(
  document: SequenceDocument,
  reference: string,
): string | null {
  const record =
    resolveReadReferenceRecord(document.records, reference) ??
    document.records.find((candidate) => candidate.id === reference);
  if (
    record == null &&
    document.records.some((candidate) =>
      referencesMatch(candidate.sourceLabel, reference),
    )
  ) {
    return "The reference name is ambiguous in the loaded sequence records. Original-source tracks are retained, but no mapped evidence projection is available for this alias.";
  }
  return getEvidenceReferenceUnavailableReason(record);
}

function queryReadDetail({
  document,
  readPileupRange,
  readPileupState,
  request,
  selectedRecordId,
  tracks,
}: {
  document: SequenceDocument;
  readPileupRange?: { end: number; start: number };
  readPileupState: ReadPileupState;
  request: Extract<SequenceViewerQueryRequest, { target: "read-detail" }>;
  selectedRecordId: string;
  tracks: Array<SequenceTrack>;
}): ViewerQueryResult {
  const entry = getReadPileupEntry(tracks, request);
  const { read } = entry;
  const start = request.start ?? readPileupRange?.start ?? read.position;
  const end =
    request.end ??
    (request.start == null ? readPileupRange?.end : undefined) ??
    Math.min(read.end, start + READ_PILEUP_DETAIL_BASES - 1);
  if (
    !Number.isSafeInteger(start) ||
    !Number.isSafeInteger(end) ||
    start < 1 ||
    end < start ||
    end - start + 1 > 100_000
  ) {
    throw new Error(
      "Read-detail windows require ordered positive coordinates spanning at most 100,000 bases.",
    );
  }
  const range = { end, start };
  const referenceRecord = resolveReadReferenceRecord(
    document.records,
    read.reference,
  );
  const referenceUnavailableReason = evidenceQueryUnavailableReason(
    document,
    read.reference,
  );
  const projection = projectReadAlignment({
    range,
    read,
    referenceRecord: referenceRecord ?? undefined,
    referenceSequence: referenceRecord?.sequence ?? "",
  });
  if (referenceUnavailableReason != null) {
    projection.blocks = [];
    projection.bases = [];
    projection.markers = [];
    projection.unavailableReason = referenceUnavailableReason;
  }
  const displayedRecord = document.records.find(
    (record) => record.id === selectedRecordId,
  );
  const displaySampleKnown = readPileupRange != null && displayedRecord != null;
  const window =
    displaySampleKnown &&
    getEvidenceReferenceUnavailableReason(displayedRecord) == null
      ? buildEvidenceWindow({
          end: readPileupRange.end,
          start: readPileupRange.start,
          maxReads: READ_PILEUP_MAX_DISPLAY_READS,
          readFilter: (candidate) =>
            readPassesPileupFilters(candidate, readPileupState.options),
          reference: displayedRecord.sourceLabel,
          referenceRecords: document.records,
          tracks,
        })
      : null;
  const displayedEntries = identifyReadPileupEntries(
    tracks,
    window?.reads ?? [],
  );
  const mate = findVisibleReadMate(entry, displayedEntries);
  const tags = Object.entries(read.tags);
  const events = [
    ...projection.blocks.map((block) => ({
      coordinate: block.start,
      type: "alignment-block",
      ...block,
    })),
    ...projection.markers.map((marker) => ({
      coordinate: marker.anchor,
      type: "boundary-marker",
      ...marker,
    })),
    ...projection.bases.map((base) => ({ type: "base-call", ...base })),
  ].sort((left, right) => left.coordinate - right.coordinate);
  return pagedResult(request, events, {
    coordinateSystem: {
      basis: 1,
      end: "inclusive",
      orientation:
        "SAM reference orientation; SEQ and QUAL are not reversed again",
      reference: read.reference,
      space: "reference-sequence",
    },
    result: {
      baseCallsOmitted:
        referenceUnavailableReason != null ||
        end - start + 1 > READ_PILEUP_DETAIL_BASES,
      evidenceCoordinatesStale:
        referenceRecord?.evidenceCoordinatesStale === true,
      baseQuality: summarizeReadBaseQuality(read),
      cigar: read.cigar.slice(0, 4_096),
      cigarTruncated: read.cigar.length > 4_096,
      end: read.end,
      flags: read.flags,
      flagLabels: readFlagLabels(read.flags),
      hardClippedBases: projection.hardClippedBases,
      id: read.id,
      inDisplayedSample: displaySampleKnown
        ? displayedEntries.some((candidate) => candidate.key === entry.key)
        : null,
      displayedReferenceRecordId: displayedRecord?.id ?? null,
      displayedRange: readPileupRange ?? null,
      insertSize: read.insertSize,
      mappingQuality: read.mappingQuality === 255 ? null : read.mappingQuality,
      mappingQualityRaw: read.mappingQuality,
      mate:
        mate == null
          ? null
          : { sourceReadIndex: mate.sourceReadIndex, trackId: mate.trackId },
      matePosition: read.matePosition ?? null,
      mateReference: read.mateReference ?? null,
      position: read.position,
      projectionUnavailableReason: projection.unavailableReason,
      originalSourceCoordinatesRetained: true,
      referenceRecordId: referenceRecord?.id ?? null,
      sequence: read.sequence.slice(0, 500),
      sequenceLength: read.sequence.length,
      sequenceTruncated: read.sequence.length > 500,
      sourceReadIndex: entry.sourceReadIndex,
      sourceReadIndexBasis: 0,
      sourceReadIndexSpace: "materialized-track-read",
      sourceTruncated:
        tracks.find((track) => track.id === entry.trackId)?.summary.truncated ??
        false,
      strand: read.strand,
      tags: Object.fromEntries(
        tags
          .slice(0, 20)
          .map(([key, value]) => [
            key,
            typeof value === "string" ? value.slice(0, 200) : value,
          ]),
      ),
      tagsTruncated:
        tags.length > 20 ||
        tags.some(
          ([, value]) => typeof value === "string" && value.length > 200,
        ),
      trackId: entry.trackId,
      trackName: entry.trackName,
      window: range,
      windowPartial: start > read.position || end < read.end,
    },
  });
}

export function queryAlignmentViewer({
  analysis,
  artifacts,
  document,
  hits,
  jobs,
  request,
  tracks,
  tree,
}: {
  analysis: MsaDerivedAnalysis | null;
  artifacts: Array<WorkbenchArtifact>;
  document: MsaDocument;
  hits: Array<MsaMotifSearchHit>;
  jobs: Array<WorkbenchJob>;
  request: SequenceViewerQueryRequest;
  tracks: Array<SequenceTrack>;
  tree: GuideTreeResult | null;
}): ViewerQueryResult {
  switch (request.target) {
    case "rows":
      return pagedResult(
        request,
        document.rows.map(({ alignedSequence, ...row }) => ({
          ...row,
          alignedSequence:
            alignedSequence.length <= 2_048
              ? alignedSequence
              : `${alignedSequence.slice(0, 2_047)}…`,
          sequenceTruncated: alignedSequence.length > 2_048,
        })),
      );
    case "columns": {
      const range = validateRange(
        document.alignedLength,
        request.start,
        request.end,
      );
      if (range.end - range.start + 1 > 500) {
        throw new Error(
          "Alignment-column queries are limited to 500 columns. Request smaller coordinate windows.",
        );
      }
      const selectedRows =
        request.row == null
          ? document.rows
          : [resolveAlignmentRow(document, request.row)];
      return boundedQueryResult({
        coordinateSystem: alignmentCoordinates(document),
        items: Array.from(
          { length: range.end - range.start + 1 },
          (_, offset) => {
            const column = range.start + offset;
            const summary = analysis?.summaries[column - 1];
            return {
              column,
              conservation:
                analysis?.summaries[column - 1]?.conservationNormalized ?? null,
              consensus: analysis?.consensusSequence[column - 1] ?? null,
              gapFraction: summary?.gapFraction ?? null,
              identity: summary?.identity ?? null,
              rows: selectedRows.map((row) => ({
                rowId: row.id,
                rowLabel: row.label,
                symbol: row.alignedSequence[column - 1] ?? null,
              })),
            };
          },
        ),
        target: request.target,
      });
    }
    case "metrics": {
      if (analysis == null) {
        return pagedResult(request, []);
      }
      const items = analysis.summaries.map((summary, index) => ({
        column: index + 1,
        conservation: summary.conservationNormalized,
        consensus: analysis.consensusSequence[index] ?? null,
        gapFraction: summary.gapFraction,
        identity: summary.identity,
      }));
      return pagedResult(request, items);
    }
    case "search-hits":
      return pagedResult(request, hits);
    case "annotations":
      return pagedResult(request, document.annotations);
    case "tree-nodes": {
      if (tree == null) return pagedResult(request, []);
      return pagedResult(request, flattenTree(tree.root));
    }
    case "tracks":
      return pagedResult(request, tracks.map(summarizeTrack));
    case "jobs":
      return pagedResult(request, jobs);
    case "artifacts":
      return pagedResult(
        request,
        artifacts.map(({ content: _content, ...artifact }) => artifact),
      );
    case "records":
    case "features":
    case "read-detail":
    case "read-pileup-state":
    case "sequence-ui-state":
    case "quality-report":
    case "chromatogram":
    case "sequence-range":
    case "quality":
    case "workbench-panels":
    case "workbench-disclosures":
    case "workbench-feedback":
      throw new Error(
        `${request.target} is available only while the viewer is in Sequence mode.`,
      );
    case "variants":
    case "coverage":
    case "reads": {
      const window = buildEvidenceWindow({
        end: request.end,
        maxReads: 10_000,
        reference: request.reference,
        start: request.start,
        tracks,
      });
      return pagedResult(
        request,
        request.target === "variants"
          ? window.variants.map(summarizeVariant)
          : request.target === "coverage"
            ? window.coverage
            : identifyReadPileupEntries(tracks, window.reads).map((entry) => ({
                ...entry.read,
                sourceReadIndex: entry.sourceReadIndex,
                trackId: entry.trackId,
                trackName: entry.trackName,
              })),
        request.target === "reads"
          ? {
              result: {
                downsampled: window.downsampled,
                sampledReadCount: window.sampledReadCount,
                sourceReadCount: window.sourceReadCount,
                sourceTruncated: window.sourceTruncated,
                totalReadCount: window.totalReadCount,
              },
            }
          : request.target === "coverage"
            ? { result: coverageQueryMetadata(window) }
            : undefined,
      );
    }
  }
}

export function resolveTreeNode(tree: GuideTreeResult, selector: string) {
  const node = findTreeNode(tree.root, selector);
  if (node == null) throw new Error(`No guide-tree node matched ${selector}.`);
  return node;
}

function summarizeTrack(track: SequenceTrack) {
  return {
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
  };
}

function summarizeVariant(
  variant: NonNullable<SequenceTrack["variants"]>[number],
) {
  return {
    alternateAlleles: variant.alternateAlleles,
    filters: variant.filters,
    id: variant.id,
    infoCount: Object.keys(variant.info).length,
    position: variant.position,
    ...(variant.quality == null ? {} : { quality: variant.quality }),
    reference: variant.reference,
    referenceAllele: variant.referenceAllele,
    sampleCount: Object.keys(variant.samples).length,
  };
}

function pagedResult(
  request: Extract<
    SequenceViewerQueryRequest,
    { cursor?: string; limit: number }
  >,
  items: Array<unknown>,
  additionalResult?: Pick<ViewerQueryResult, "coordinateSystem" | "result">,
): ViewerQueryResult {
  const offset = decodeCursor(request.target, request.cursor);
  const requestedCount = Math.min(request.limit, items.length - offset);
  let low = 0;
  let high = Math.max(0, requestedCount);
  while (low < high) {
    const count = Math.ceil((low + high) / 2);
    if (
      queryResultBytes(
        pageResult(request.target, items, offset, count, additionalResult),
      ) <= queryResultBudget()
    ) {
      low = count;
    } else {
      high = count - 1;
    }
  }
  if (requestedCount > 0 && low === 0) {
    throw new Error(
      `The next ${request.target} item exceeds the bounded installed-host completion budget. Narrow the query or coordinate window.`,
    );
  }
  return boundedQueryResult(
    pageResult(request.target, items, offset, low, additionalResult),
  );
}

function boundedQueryResult<T extends ViewerQueryResult>(result: T): T {
  const bytes = queryResultBytes(result);
  const budget = queryResultBudget();
  if (bytes > budget) {
    throw new Error(
      `Query result is ${bytes.toLocaleString()} bytes and exceeds the ${budget.toLocaleString()}-byte installed-host completion budget. Request a smaller page or coordinate window.`,
    );
  }
  return result;
}

function pageResult(
  target: SequenceViewerQueryRequest["target"],
  items: Array<unknown>,
  offset: number,
  count: number,
  additionalResult?: Pick<ViewerQueryResult, "coordinateSystem" | "result">,
): ViewerQueryResult {
  const page = items.slice(offset, offset + count);
  const nextOffset = offset + page.length;
  return {
    ...additionalResult,
    items: page,
    nextCursor:
      nextOffset < items.length ? encodeCursor(target, nextOffset) : null,
    page: { count: page.length, offset, totalCount: items.length },
    target,
    truncated: nextOffset < items.length,
  };
}

function queryResultBytes(result: ViewerQueryResult): number {
  return utf8ByteLength(JSON.stringify(result));
}

function queryResultBudget(): number {
  return Math.min(
    SEQUENCE_VIEWER_LIMITS.analysis.maxResultBytes,
    SEQUENCE_VIEWER_LIMITS.command.maxCompletionStateBytes -
      utf8ByteLength('{"query":}'),
  );
}

function serializeRecord(record: SequenceRecord) {
  return {
    description: record.description ?? null,
    evidenceCoordinatesStale: record.evidenceCoordinatesStale === true,
    featureCount: record.features.length,
    id: record.id,
    length: record.length,
    molecule: record.molecule,
    sourceLabel: record.sourceLabel,
    topology: record.topology ?? null,
  };
}

function featureMatchesQuery(feature: SequenceFeature, query: string): boolean {
  const normalized = query.toLocaleLowerCase("en-US");
  return [
    feature.id,
    feature.label,
    feature.sourceLocation,
    feature.type,
    ...Object.entries(feature.qualifiers).flatMap(([name, value]) => [
      name,
      ...(Array.isArray(value) ? value : [value]),
    ]),
  ].some((value) => value?.toLocaleLowerCase("en-US").includes(normalized));
}

function serializeFeature(feature: SequenceFeature) {
  return {
    ...feature,
    coordinateSystem: {
      basis: 1,
      end: "inclusive",
      space: "sequence",
      strand: feature.strand,
    },
  };
}

function resolveSequenceRecord(
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
        ? `More than one record matched ${selector}: ${resolution.candidates.map(({ id }) => id).join(", ")}.`
        : `No sequence record matched ${selector}.`,
    );
  }
  return resolution.target;
}

function resolveAlignmentRow(document: MsaDocument, selector: string) {
  const resolution = resolveViewerTarget({
    aliases: (row) => [row.label, row.sourceId],
    id: (row) => row.id,
    selector,
    targets: document.rows,
  });
  if (resolution.status !== "resolved" || resolution.target == null) {
    throw new Error(
      resolution.status === "ambiguous"
        ? `More than one alignment row matched ${selector}: ${resolution.candidates.map(({ id }) => id).join(", ")}.`
        : `No alignment row matched ${selector}.`,
    );
  }
  return resolution.target;
}

function validateRange(length: number, start: number, end: number) {
  const range = { end: Math.max(start, end), start: Math.min(start, end) };
  if (range.start < 1 || range.end > length) {
    throw new Error(`Requested range must be within 1-${length}.`);
  }
  return range;
}

function sequenceCoordinates(record: SequenceRecord) {
  return {
    basis: 1,
    end: "inclusive",
    referenceRecordId: record.id,
    space: "sequence",
    strand: "+",
  };
}

function alignmentCoordinates(document: MsaDocument) {
  return {
    basis: 1,
    end: "inclusive",
    referenceRowId: null,
    space: "alignment-column",
    width: document.alignedLength,
  };
}

function encodeCursor(target: string, offset: number): string {
  return `q1.${target}.${offset}`;
}

function decodeCursor(target: string, cursor: string | undefined): number {
  if (cursor == null) return 0;
  const match = /^q1\.([a-z-]+)\.(\d+)$/u.exec(cursor);
  if (match == null || match[1] !== target) {
    throw new Error("Query cursor is invalid for this target.");
  }
  const offset = Number(match[2]);
  if (!Number.isSafeInteger(offset) || offset < 0) {
    throw new Error("Query cursor contains an invalid offset.");
  }
  return offset;
}

function flattenTree(root: GuideTreeResult["root"]): Array<unknown> {
  const queue = [{ node: root, parentId: null as string | null }];
  const items: Array<unknown> = [];
  while (queue.length > 0) {
    const current = queue.shift();
    if (current == null) continue;
    items.push({
      branchLength: current.node.branchLength,
      childIds: current.node.children.map(({ id }) => id),
      id: current.node.id,
      label: current.node.label ?? null,
      parentId: current.parentId,
      rowId: current.node.rowId ?? null,
    });
    queue.push(
      ...current.node.children.map((node) => ({
        node,
        parentId: current.node.id,
      })),
    );
  }
  return items;
}
