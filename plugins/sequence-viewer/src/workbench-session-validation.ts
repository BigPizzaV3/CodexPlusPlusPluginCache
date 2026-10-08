import { z } from "zod";

import { SEQUENCE_VIEWER_LIMITS, utf8ByteLength } from "./runtime-contract";
import { CHROMATOGRAM_LIMITS } from "./sequence/formats/chromatogram";
import {
  sequenceInterfaceSettingsSchema,
  validateSequenceInterfaceSettingsForSource,
} from "./sequence/interface-state";
import type { SequenceTrack } from "./sequence/tracks";
import type { WorkbenchSession } from "./workbench-state";
import { isSafeWorkspaceProvenancePath } from "./viewer-operations";

const chromatogramBaseConfidenceSchema = z
  .array(z.number().int().min(0).max(255))
  .max(CHROMATOGRAM_LIMITS.maxBaseCalls);
const chromatogramSignalSchema = z
  .array(z.number().int().min(-32_768).max(65_535))
  .max(CHROMATOGRAM_LIMITS.maxSamples);
const chromatogramSchema = z
  .object({
    baseConfidences: z
      .object({
        A: chromatogramBaseConfidenceSchema,
        C: chromatogramBaseConfidenceSchema,
        G: chromatogramBaseConfidenceSchema,
        T: chromatogramBaseConfidenceSchema,
      })
      .strict()
      .optional(),
    channels: z
      .object({
        A: chromatogramSignalSchema,
        C: chromatogramSignalSchema,
        G: chromatogramSignalSchema,
        T: chromatogramSignalSchema,
      })
      .strict(),
    format: z.enum(["abif", "scf"]),
    peakLocations: z
      .array(z.number().int().nonnegative())
      .max(CHROMATOGRAM_LIMITS.maxBaseCalls),
    quality: z
      .array(z.number().int().min(0).max(255).nullable())
      .max(CHROMATOGRAM_LIMITS.maxBaseCalls)
      .optional(),
    qualityEncoding: z.enum(["phred", "source-confidence"]).optional(),
    sampleCount: z
      .number()
      .int()
      .positive()
      .max(CHROMATOGRAM_LIMITS.maxSamples),
  })
  .strict();
const uuidSchema = z.string().uuid();
const parametersSchema = z.record(z.string().max(500), z.unknown());
const jobSchema = z
  .object({
    completedAt: z.number().int().nonnegative().optional(),
    error: z.string().max(10_000).optional(),
    id: uuidSchema,
    kind: z.enum([
      "align",
      "distance-matrix",
      "guide-tree",
      "orfs",
      "primers",
      "quality-report",
      "restriction-analysis",
      "statistics",
      "translation",
    ]),
    message: z.string().max(10_000),
    parameters: parametersSchema,
    progress: z.number().min(0).max(1),
    result: parametersSchema.optional(),
    startedAt: z.number().int().nonnegative(),
    status: z.enum(["cancelled", "completed", "failed", "running"]),
  })
  .strict();
const artifactSchema = z
  .object({
    content: z.string(),
    createdAt: z.number().int().nonnegative(),
    format: z.string().min(1).max(100),
    id: uuidSchema,
    mediaType: z.string().min(1).max(200),
    name: z.string().min(1).max(255),
    provenance: z
      .object({
        engine: z.string().min(1).max(500),
        parameters: parametersSchema,
        sourceRevision: z.number().int().nonnegative(),
      })
      .strict(),
  })
  .strict()
  .superRefine(({ content, name }, context) => {
    if (
      utf8ByteLength(content) > SEQUENCE_VIEWER_LIMITS.session.maxArtifactBytes
    ) {
      context.addIssue({
        code: "custom",
        message: `Artifact ${name} exceeds the bounded artifact size.`,
      });
    }
  });
const trackFeatureSegmentSchema = z
  .object({
    end: z.number().int().positive(),
    start: z.number().int().positive(),
  })
  .strict()
  .refine(({ end, start }) => end >= start, "Track feature segment range is reversed.");
const trackFeatureSchema = z
  .object({
    attributes: z.record(z.string().max(500), z.string().max(10_000)),
    codingSegments: z
      .array(trackFeatureSegmentSchema)
      .max(10_000)
      .optional(),
    end: z.number().int().positive(),
    id: z.string().min(1).max(2_000),
    label: z.string().max(2_000).optional(),
    phase: z.union([z.literal(0), z.literal(1), z.literal(2)]).optional(),
    reference: z.string().max(2_000),
    score: z.number().finite().optional(),
    segments: z
      .array(trackFeatureSegmentSchema)
      .max(10_000)
      .optional(),
    source: z.string().max(2_000).optional(),
    start: z.number().int().positive(),
    strand: z.enum(["+", "-", ".", "?"]),
    type: z.string().min(1).max(500),
  })
  .strict()
  .refine(({ end, start }) => end >= start, "Track feature range is reversed.")
  .superRefine((feature, context) => {
    for (const [kind, segments] of [
      ["segments", feature.segments],
      ["codingSegments", feature.codingSegments],
    ] as const) {
      for (const [index, segment] of (segments ?? []).entries()) {
        if (segment.start < feature.start || segment.end > feature.end) {
          context.addIssue({
            code: "custom",
            message: "Track feature segment extends outside its feature.",
            path: [kind, index],
          });
        }
      }
    }
  });
const variantSchema = z
  .object({
    alternateAlleles: z.array(z.string().max(10_000)).max(1_000),
    filters: z.array(z.string().max(1_000)).max(1_000),
    format: z.string().max(10_000).optional(),
    id: z.string().min(1).max(2_000),
    info: z.record(
      z.string().max(500),
      z.union([z.string().max(10_000), z.literal(true)]),
    ),
    position: z.number().int().positive(),
    quality: z.number().finite().optional(),
    rawFilter: z.string().max(10_000).optional(),
    rawId: z.string().max(2_000).optional(),
    rawInfo: z.string().max(100_000).optional(),
    rawQuality: z.string().max(10_000).optional(),
    reference: z.string().max(2_000),
    referenceAllele: z.string().min(1).max(100_000),
    sampleValues: z.array(z.string().max(100_000)).max(10_000).optional(),
    samples: z.record(z.string().max(2_000), z.string().max(100_000)),
  })
  .strict();
const vcfHeaderSchema = z
  .object({
    columns: z.array(z.string().min(1).max(2_000)).min(8).max(10_009),
    metaLines: z.array(z.string().max(256 * 1_024)).max(4_096),
    sampleNames: z.array(z.string().min(1).max(2_000)).max(10_000),
  })
  .strict()
  .superRefine((header, context) => {
    if (
      utf8ByteLength([...header.metaLines, header.columns.join("\t")].join("\n")) >
      SEQUENCE_VIEWER_LIMITS.session.maxSessionBytes / 2
    ) {
      context.addIssue({
        code: "custom",
        message: "VCF metadata exceeds its bounded header budget.",
      });
    }
    if (header.metaLines.some((line) => !line.startsWith("##"))) {
      context.addIssue({
        code: "custom",
        message: "VCF metadata lines must retain their original prefix.",
        path: ["metaLines"],
      });
    }
    if (
      header.sampleNames.length !== Math.max(0, header.columns.length - 9) ||
      header.sampleNames.some((name, index) => name !== header.columns[index + 9])
    ) {
      context.addIssue({
        code: "custom",
        message: "VCF sample columns do not match their preserved header.",
        path: ["sampleNames"],
      });
    }
    if (new Set(header.sampleNames).size !== header.sampleNames.length) {
      context.addIssue({
        code: "custom",
        message: "VCF sample names must be unique.",
        path: ["sampleNames"],
      });
    }
  });
const readSchema = z
  .object({
    cigar: z.string().max(100_000),
    end: z.number().int().positive(),
    flags: z.number().int().nonnegative(),
    id: z.string().min(1).max(2_000),
    insertSize: z.number().int(),
    mappingQuality: z.number().int().min(0).max(255),
    matePosition: z.number().int().positive().optional(),
    mateReference: z.string().max(2_000).optional(),
    position: z.number().int().positive(),
    quality: z
      .array(z.number().int().min(0).max(255))
      .max(1_000_000)
      .optional(),
    reference: z.string().max(2_000),
    sequence: z.string().max(1_000_000),
    strand: z.enum(["+", "-"]),
    tags: z.record(
      z.string().max(100),
      z.union([z.string().max(100_000), z.number().finite()]),
    ),
  })
  .strict()
  .refine(
    ({ end, position }) => end >= position,
    "Track read range is reversed.",
  );
const trackSchema = z
  .object({
    features: z
      .array(trackFeatureSchema)
      .max(SEQUENCE_VIEWER_LIMITS.input.maxTrackItems)
      .optional(),
    format: z.enum(["bam", "bed", "cram", "gff3", "gtf", "sam", "vcf"]),
    id: z.string().min(1).max(2_000),
    kind: z.enum(["annotations", "reads", "variants"]),
    mapping: z
      .object({
        matchedReference: z.string().max(2_000).nullable(),
        requestedReference: z.string().max(2_000).nullable(),
        status: z.enum(["matched", "unmatched", "unresolved"]),
        unmatchedReferences: z.array(z.string().max(2_000)).max(100),
      })
      .strict(),
    name: z.string().min(1).max(2_000),
    reads: z
      .array(readSchema)
      .max(SEQUENCE_VIEWER_LIMITS.input.maxTrackItems)
      .optional(),
    source: z
      .object({
        contentHash: z.string().max(500).optional(),
        displayName: z.string().min(1).max(2_000),
        workspacePath: z
          .string()
          .max(4_096)
          .refine(isSafeWorkspaceProvenancePath)
          .optional(),
      })
      .strict(),
    summary: z
      .object({
        itemCount: z.number().int().nonnegative(),
        materializedItemCount: z.number().int().nonnegative().optional(),
        references: z.array(z.string().max(2_000)).max(100_000),
        truncated: z.boolean(),
      })
      .strict(),
    variants: z
      .array(variantSchema)
      .max(SEQUENCE_VIEWER_LIMITS.input.maxTrackItems)
      .optional(),
    vcfHeader: vcfHeaderSchema.optional(),
  })
  .strict()
  .superRefine((track, context) => {
    const items =
      track.kind === "annotations"
        ? track.features
        : track.kind === "reads"
          ? track.reads
          : track.variants;
    if (items == null) {
      context.addIssue({
        code: "custom",
        message: `Track ${track.name} has no ${track.kind} payload.`,
      });
    } else if (
      track.summary.materializedItemCount != null &&
      items.length !== track.summary.materializedItemCount
    ) {
      context.addIssue({
        code: "custom",
        message: `Track ${track.name} materialized item count is inconsistent.`,
      });
    } else if (
      track.summary.materializedItemCount == null &&
      !track.summary.truncated &&
      items.length !== track.summary.itemCount
    ) {
      context.addIssue({
        code: "custom",
        message: `Track ${track.name} item count is inconsistent.`,
      });
    } else if (
      track.summary.itemCount <
      (track.summary.materializedItemCount ?? items.length)
    ) {
      context.addIssue({
        code: "custom",
        message: `Track ${track.name} source item count is inconsistent.`,
      });
    }
    if (track.vcfHeader != null) {
      if (track.format !== "vcf" || track.kind !== "variants") {
        context.addIssue({
          code: "custom",
          message: "Only VCF variant tracks can retain VCF headers.",
          path: ["vcfHeader"],
        });
      }
      for (const [index, variant] of (track.variants ?? []).entries()) {
        const sampleNames = track.vcfHeader.sampleNames;
        if (
          Object.keys(variant.samples).length !== sampleNames.length ||
          sampleNames.some((name) => !Object.hasOwn(variant.samples, name))
        ) {
          context.addIssue({
            code: "custom",
            message: "VCF sample genotypes do not match their preserved header.",
            path: ["variants", index, "samples"],
          });
        }
        if (
          variant.sampleValues != null &&
          (variant.sampleValues.length !== sampleNames.length ||
            sampleNames.some(
              (name, sampleIndex) =>
                variant.samples[name] !== variant.sampleValues?.[sampleIndex],
            ))
        ) {
          context.addIssue({
            code: "custom",
            message: "VCF sample values do not match their preserved header.",
            path: ["variants", index, "sampleValues"],
          });
        }
      }
    }
  });
const sequenceViewSchema = z
  .object({
    geneticCodeId: z.number().int().positive(),
    interface: sequenceInterfaceSettingsSchema.optional(),
    layout: z.enum(["circular", "linear", "split"]),
    orientation: z.enum(["forward", "reverse-complement"]),
    paletteId: z.string().min(1).max(100),
    selectedFeatureId: z.string().max(2_000).nullable(),
    selectedRecordId: z.string().max(2_000),
    selection: z
      .object({
        end: z.number().int().positive(),
        recordId: z.string().max(2_000),
        segments: z
          .array(
            z
              .object({
                end: z.number().int().positive(),
                start: z.number().int().positive(),
              })
              .strict()
              .refine(({ end, start }) => end >= start),
          )
          .min(1)
          .max(1_000)
          .optional(),
        start: z.number().int().positive(),
      })
      .strict()
      .nullable(),
    showFeatures: z.boolean(),
    showQuality: z.boolean(),
    showTranslation: z.boolean(),
    synchronizedViews: z.boolean(),
    viewport: z
      .object({
        end: z.number().int().positive(),
        start: z.number().int().positive(),
      })
      .strict()
      .nullable(),
    wrapWidth: z.number().int().min(20).max(500),
  })
  .strict();
const alignmentViewSchema = z
  .object({
    analysisScope: z.string().max(100),
    cellWidth: z.number().int().min(8).max(100),
    colorMode: z.string().max(100),
    enabledMetricTracks: z
      .array(
        z.enum([
          "gap",
          "identity",
          "mismatch",
          "modality-conservation",
          "rna-structure",
          "sequence-logo",
        ]),
      )
      .max(6)
      .optional(),
    referenceMode: z.string().max(100),
    residuePalette: z.string().max(100).nullable(),
    rowFilter: z.string().max(500),
    rowSortDirection: z.enum(["asc", "desc"]).optional(),
    rowSortKey: z
      .enum(["coverage", "identity", "label", "length", "mismatches", "source"])
      .optional(),
    searchScope: z.string().max(100),
    selectedColumns: z
      .object({
        end: z.number().int().nonnegative(),
        start: z.number().int().nonnegative(),
      })
      .strict()
      .nullable(),
    selectedRows: z.array(z.string().max(2_000)).max(100_000),
    showAnnotationTracks: z.boolean(),
    showIdenticalAsDots: z.boolean(),
    showRnaStructureOverlays: z.boolean(),
    showSequenceLogoHelp: z.boolean().optional(),
  })
  .strict();
const viewSchema = z.discriminatedUnion("mode", [
  z
    .object({ mode: z.literal("sequence"), sequence: sequenceViewSchema })
    .strict(),
  z
    .object({ alignment: alignmentViewSchema, mode: z.literal("alignment") })
    .strict(),
]);
const sessionSchema = z
  .object({
    artifacts: z
      .array(artifactSchema)
      .max(SEQUENCE_VIEWER_LIMITS.session.maxArtifacts),
    createdAt: z.number().int().nonnegative(),
    dirty: z.boolean(),
    jobs: z.array(jobSchema).max(100),
    revision: z.number().int().nonnegative(),
    schemaVersion: z.literal(1),
    snapshot: z
      .object({
        alignmentDocument: z.unknown().optional(),
        sequenceDocument: z.unknown().optional(),
      })
      .strict()
      .optional(),
    source: z
      .object({
        fileName: z.string().max(2_000).nullable(),
        format: z.string().min(1).max(100),
        stateKey: z.string().min(1).max(4_096).nullable().optional(),
      })
      .strict(),
    tracks: z.array(trackSchema).max(128),
    view: viewSchema,
  })
  .strict();

export function parseAndValidateWorkbenchSession(
  value: string,
): WorkbenchSession {
  if (utf8ByteLength(value) > SEQUENCE_VIEWER_LIMITS.session.maxSessionBytes) {
    throw new Error("Workbench session exceeds the bounded session size.");
  }
  let raw: unknown;
  try {
    raw = JSON.parse(value);
  } catch {
    throw new Error(
      "This is not valid Biological Sequence Viewer session JSON.",
    );
  }
  const parsed = sessionSchema.parse(raw);
  if (parsed.view.mode === "sequence") {
    if (parsed.snapshot?.alignmentDocument != null) {
      throw new Error(
        "A Sequence-mode session cannot contain an alignment snapshot.",
      );
    }
    if (parsed.snapshot?.sequenceDocument != null) {
      validateSequenceDocument(parsed.snapshot.sequenceDocument);
      validateSequenceViewState(
        parsed.view.sequence,
        parsed.snapshot.sequenceDocument,
        parsed.tracks,
      );
    } else if (parsed.view.sequence.interface != null) {
      validateSequenceInterfaceSettingsForSource({
        settings: parsed.view.sequence.interface,
        tracks: parsed.tracks,
      });
    }
  } else {
    if (parsed.snapshot?.sequenceDocument != null) {
      throw new Error(
        "An Alignment-mode session cannot contain a sequence snapshot.",
      );
    }
    if (parsed.snapshot?.alignmentDocument != null) {
      validateAlignmentDocument(parsed.snapshot.alignmentDocument);
      validateAlignmentViewState(
        parsed.view.alignment,
        parsed.snapshot.alignmentDocument,
      );
    }
  }
  return parsed as WorkbenchSession;
}

function validateSequenceViewState(
  view: z.infer<typeof sequenceViewSchema>,
  snapshot: unknown,
  tracks: ReadonlyArray<SequenceTrack>,
): void {
  const document = requireObject(snapshot, "sequence snapshot");
  const records = requireArray(document.records, "sequence records").map(
    (record) => requireObject(record, "sequence record"),
  );
  const selectedRecord = records.find(({ id }) => id === view.selectedRecordId);
  if (selectedRecord == null) {
    throw new Error("Sequence session selected record is not in its snapshot.");
  }
  const length = requireInteger(
    selectedRecord.length,
    "sequence record length",
  );
  if (view.interface != null) {
    validateSequenceInterfaceSettingsForSource({
      record: {
        evidenceCoordinatesStale:
          selectedRecord.evidenceCoordinatesStale === true,
        length,
        sourceLabel: requireString(
          selectedRecord.sourceLabel,
          "sequence source label",
        ),
      },
      records: records.map((record) => ({
        sourceLabel: requireString(record.sourceLabel, "sequence source label"),
      })),
      settings: view.interface,
      tracks,
    });
  }
  if (
    view.viewport != null &&
    (view.viewport.start > view.viewport.end || view.viewport.end > length)
  ) {
    throw new Error(
      "Sequence session viewport is outside its selected record.",
    );
  }
  if (view.selectedFeatureId != null) {
    const features = requireArray(selectedRecord.features, "sequence features");
    if (
      !features.some(
        (feature) =>
          requireObject(feature, "sequence feature").id ===
          view.selectedFeatureId,
      )
    ) {
      throw new Error(
        "Sequence session selected feature is not in its record.",
      );
    }
  }
  const selection = view.selection;
  if (selection == null) return;
  if (selection.recordId !== view.selectedRecordId) {
    throw new Error(
      "Sequence session selection belongs to a different record.",
    );
  }
  if (selection.start > length || selection.end > length) {
    throw new Error(
      "Sequence session selection is outside its selected record.",
    );
  }
  if (selection.segments == null) {
    if (selection.start > selection.end) {
      throw new Error("Linear sequence session selection is reversed.");
    }
    return;
  }
  const first = selection.segments[0];
  const last = selection.segments.at(-1);
  if (
    first == null ||
    last == null ||
    first.start !== selection.start ||
    last.end !== selection.end ||
    selection.segments.some((segment) => segment.end > length)
  ) {
    throw new Error(
      "Sequence session selection segments are inconsistent with their source coordinates.",
    );
  }
  const ordered = [...selection.segments].sort(
    (left, right) => left.start - right.start,
  );
  for (let index = 1; index < ordered.length; index += 1) {
    if (ordered[index]!.start <= ordered[index - 1]!.end) {
      throw new Error("Sequence session selection segments overlap.");
    }
  }
}

function validateAlignmentViewState(
  view: z.infer<typeof alignmentViewSchema>,
  snapshot: unknown,
): void {
  const document = requireObject(snapshot, "alignment snapshot");
  const rows = requireArray(document.rows, "alignment rows").map((row) =>
    requireObject(row, "alignment row"),
  );
  const rowIds = new Set(rows.map(({ id }) => id));
  if (view.selectedRows.some((rowId) => !rowIds.has(rowId))) {
    throw new Error("Alignment session selected rows are not in its snapshot.");
  }
  const alignedLength = requireInteger(
    document.alignedLength,
    "alignment length",
  );
  if (
    view.selectedColumns != null &&
    (view.selectedColumns.start >= view.selectedColumns.end ||
      view.selectedColumns.end > alignedLength)
  ) {
    throw new Error(
      "Alignment session selected columns are outside its snapshot.",
    );
  }
}

function validateSequenceDocument(value: unknown): void {
  const document = requireObject(value, "sequence snapshot");
  assertExactKeys(
    document,
    [
      "classification",
      "fastqSummary",
      "fileName",
      "format",
      "kind",
      "recordInventory",
      "records",
      "warnings",
    ],
    "sequence snapshot",
  );
  const records = requireArray(document.records, "sequence records");
  if (records.length > SEQUENCE_VIEWER_LIMITS.input.maxSequenceRecords) {
    throw new Error("Sequence snapshot has too many records.");
  }
  let totalResidues = 0;
  for (const rawRecord of records) {
    const record = requireObject(rawRecord, "sequence record");
    if (
      record.evidenceCoordinatesStale !== undefined &&
      typeof record.evidenceCoordinatesStale !== "boolean"
    ) {
      throw new Error(
        "Sequence evidence-coordinate stale status must be boolean when present.",
      );
    }
    const sequence = requireString(record.sequence, "sequence record sequence");
    const length = requireInteger(record.length, "sequence record length");
    if (sequence.length !== length) {
      throw new Error("Sequence snapshot record length is inconsistent.");
    }
    totalResidues += length;
    const features = requireArray(record.features, "sequence features");
    for (const rawFeature of features) {
      const feature = requireObject(rawFeature, "sequence feature");
      const start = requireInteger(feature.start, "feature start");
      const end = requireInteger(feature.end, "feature end");
      if (start < 1 || end < start || end > length) {
        throw new Error("Sequence snapshot feature coordinates are invalid.");
      }
    }
    if (record.quality != null) {
      const quality = requireObject(record.quality, "sequence quality");
      if (
        requireString(quality.ascii, "quality ASCII").length !== length ||
        requireArray(quality.phred, "quality scores").length !== length
      ) {
        throw new Error("Sequence snapshot quality length is inconsistent.");
      }
    }
    if (record.chromatogram !== undefined) {
      validateSequenceChromatogram(record.chromatogram, sequence);
    }
  }
  if (totalResidues > SEQUENCE_VIEWER_LIMITS.input.maxTotalResidues) {
    throw new Error("Sequence snapshot exceeds the residue budget.");
  }
}

function validateSequenceChromatogram(value: unknown, sequence: string): void {
  const chromatogram = chromatogramSchema.parse(value);
  if (
    sequence.length === 0 ||
    sequence.length > CHROMATOGRAM_LIMITS.maxBaseCalls ||
    chromatogram.peakLocations.length !== sequence.length
  ) {
    throw new Error(
      "Chromatogram base-call count is inconsistent with its sequence.",
    );
  }
  for (const channel of Object.values(chromatogram.channels)) {
    if (channel.length !== chromatogram.sampleCount) {
      throw new Error(
        "Chromatogram signal channel length is inconsistent with its sample count.",
      );
    }
    if (chromatogram.format === "scf" && channel.some((sample) => sample < 0)) {
      throw new Error(
        "SCF chromatogram signal must contain unsigned sample values.",
      );
    }
  }
  let previousPeak = -1;
  for (const peak of chromatogram.peakLocations) {
    if (peak < previousPeak || peak >= chromatogram.sampleCount) {
      throw new Error(
        "Chromatogram peaks must be ordered zero-based sample coordinates within the signal.",
      );
    }
    previousPeak = peak;
  }
  if (chromatogram.baseConfidences != null) {
    if (chromatogram.format !== "scf") {
      throw new Error(
        "Per-base source confidence channels are supported only for SCF chromatograms.",
      );
    }
    if (
      Object.values(chromatogram.baseConfidences).some(
        (confidence) => confidence.length !== sequence.length,
      )
    ) {
      throw new Error(
        "Chromatogram confidence channel length is inconsistent with its sequence.",
      );
    }
  }
  if (chromatogram.quality == null) {
    if (chromatogram.qualityEncoding != null) {
      throw new Error(
        "Chromatogram quality encoding requires source quality values.",
      );
    }
    return;
  }
  if (chromatogram.quality.length !== sequence.length) {
    throw new Error(
      "Chromatogram source quality length is inconsistent with its sequence.",
    );
  }
  const expectedEncoding =
    chromatogram.format === "abif" ? "phred" : "source-confidence";
  if (chromatogram.qualityEncoding !== expectedEncoding) {
    throw new Error(
      "Chromatogram quality encoding does not match its source format.",
    );
  }
  for (const [index, quality] of chromatogram.quality.entries()) {
    const base = sequence[index];
    const isCanonicalBase =
      base === "A" || base === "C" || base === "G" || base === "T";
    if (chromatogram.format === "abif") {
      if (quality == null) {
        throw new Error("ABIF Phred quality values cannot be null.");
      }
    } else if (
      (quality == null && isCanonicalBase) ||
      (quality != null && !isCanonicalBase) ||
      (isCanonicalBase &&
        chromatogram.baseConfidences != null &&
        quality !== chromatogram.baseConfidences[base][index])
    ) {
      throw new Error(
        "SCF called-base confidence does not match its source base call.",
      );
    }
  }
}

function validateAlignmentDocument(value: unknown): void {
  const document = requireObject(value, "alignment snapshot");
  const rows = requireArray(document.rows, "alignment rows");
  const alignedLength = requireInteger(
    document.alignedLength,
    "alignment length",
  );
  if (
    rows.length > SEQUENCE_VIEWER_LIMITS.input.maxMsaRows ||
    rows.length * alignedLength > SEQUENCE_VIEWER_LIMITS.input.maxMsaCells
  ) {
    throw new Error("Alignment snapshot exceeds the matrix budget.");
  }
  for (const rawRow of rows) {
    const row = requireObject(rawRow, "alignment row");
    if (
      requireString(row.alignedSequence, "aligned sequence").length !==
      alignedLength
    ) {
      throw new Error("Alignment snapshot contains unequal row widths.");
    }
  }
  for (const rawTrack of requireArray(
    document.annotations,
    "alignment annotations",
  )) {
    const track = requireObject(rawTrack, "alignment annotation");
    if (
      requireString(track.values, "alignment annotation values").length !==
      alignedLength
    ) {
      throw new Error("Alignment snapshot annotation width is inconsistent.");
    }
  }
}

function requireObject(value: unknown, label: string): Record<string, unknown> {
  if (value == null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`);
  }
  return value as Record<string, unknown>;
}

function requireArray(value: unknown, label: string): Array<unknown> {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array.`);
  return value;
}

function requireString(value: unknown, label: string): string {
  if (typeof value !== "string") throw new Error(`${label} must be text.`);
  return value;
}

function requireInteger(value: unknown, label: string): number {
  if (!Number.isInteger(value) || (value as number) < 0) {
    throw new Error(`${label} must be a nonnegative integer.`);
  }
  return value as number;
}

function assertExactKeys(
  value: Record<string, unknown>,
  allowed: Array<string>,
  label: string,
): void {
  const allowedSet = new Set(allowed);
  const unexpected = Object.keys(value).filter((key) => !allowedSet.has(key));
  if (unexpected.length > 0) {
    throw new Error(
      `${label} contains unsupported fields: ${unexpected.join(", ")}.`,
    );
  }
}
