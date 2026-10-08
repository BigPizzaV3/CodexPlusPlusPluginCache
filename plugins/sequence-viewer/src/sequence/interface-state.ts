import { z } from "zod";

import { SEQUENCE_VIEWER_LIMITS } from "../runtime-contract";
import {
  createFastqQualityViewState,
  FASTQ_QUALITY_REPORT_LIMITS,
  FASTQ_QUALITY_TABLE_IDS,
} from "./fastq-quality-analysis";
import {
  DEFAULT_READ_PILEUP_STATE,
  getReadPileupEntry,
  getReadPileupEntryForRecord,
} from "./read-pileup";
import type { SequenceTrack } from "./tracks";
import type { SequenceRecord } from "./types";

const nonnegativeSafeInteger = z.number().int().nonnegative().safe();
const browserQuery = z.string().max(500);
const qualityTableIds = z
  .array(z.enum(FASTQ_QUALITY_TABLE_IDS))
  .max(FASTQ_QUALITY_TABLE_IDS.length)
  .refine(
    (ids) => new Set(ids).size === ids.length,
    "Expanded quality tables must be unique.",
  );

/** Presentation settings only; computed reports and source arrays are not state. */
export const sequenceInterfaceSettingsSchema = z
  .object({
    annotationIndex: z
      .object({
        expanded: z.boolean(),
        page: nonnegativeSafeInteger,
        query: browserQuery,
      })
      .strict(),
    chromatogram: z
      .object({
        basesPerWindow: z.number().int().min(1).max(100),
        firstBase: z
          .number()
          .int()
          .positive()
          .max(SEQUENCE_VIEWER_LIMITS.input.maxTotalResidues),
      })
      .strict(),
    originRangeExpanded: z.boolean(),
    quality: z
      .object({
        adapterSequence: z
          .string()
          .min(8)
          .max(FASTQ_QUALITY_REPORT_LIMITS.maxAdapterBases)
          .regex(/^[ACGT]+$/u)
          .nullable(),
        view: z
          .object({
            distributionsExpanded: z.boolean(),
            expandedTables: qualityTableIds,
            methodsExpanded: z.boolean(),
          })
          .strict(),
      })
      .strict(),
    readPileup: z
      .object({
        options: z
          .object({
            includeDuplicates: z.boolean(),
            includeQcFailed: z.boolean(),
            includeSecondary: z.boolean(),
            includeSupplementary: z.boolean(),
            includeUnknownMappingQuality: z.boolean(),
            minimumMappingQuality: z.number().int().min(0).max(255),
            showAllBases: z.boolean(),
            showSoftClips: z.boolean(),
            sortBy: z.enum(["position", "mapping-quality", "strand"]),
            strand: z.enum(["all", "+", "-"]),
          })
          .strict(),
        selectedRead: z
          .object({
            sourceReadIndex: nonnegativeSafeInteger,
            trackId: z.string().min(1).max(2_000),
          })
          .strict()
          .nullable(),
      })
      .strict(),
    recordBrowser: z
      .object({
        expanded: z.boolean(),
        page: nonnegativeSafeInteger,
        query: browserQuery,
        sortBy: z.enum(["source", "label", "length", "molecule"]),
      })
      .strict(),
  })
  .strict();

export type SequenceInterfaceSettings = z.infer<
  typeof sequenceInterfaceSettingsSchema
>;

export function createSequenceInterfaceSettings(): SequenceInterfaceSettings {
  return {
    annotationIndex: { expanded: false, page: 0, query: "" },
    chromatogram: { basesPerWindow: 40, firstBase: 1 },
    originRangeExpanded: false,
    quality: { adapterSequence: null, view: createFastqQualityViewState() },
    readPileup: {
      options: { ...DEFAULT_READ_PILEUP_STATE.options },
      selectedRead: null,
    },
    recordBrowser: { expanded: false, page: 0, query: "", sortBy: "source" },
  };
}

/** Check exact retained-read identity even when a source-relative session has no snapshot. */
export function validateSequenceInterfaceSettingsForSource({
  record,
  records,
  settings,
  tracks,
}: {
  record?: Pick<
    SequenceRecord,
    "evidenceCoordinatesStale" | "length" | "sourceLabel"
  >;
  records?: ReadonlyArray<Pick<SequenceRecord, "sourceLabel">>;
  settings: SequenceInterfaceSettings;
  tracks: ReadonlyArray<SequenceTrack>;
}): void {
  if (
    record != null &&
    settings.chromatogram.firstBase > Math.max(1, record.length)
  ) {
    throw new Error(
      "The saved chromatogram window is outside its selected source record.",
    );
  }
  const selectedRead = settings.readPileup.selectedRead;
  if (selectedRead == null) return;
  try {
    if (record == null) getReadPileupEntry(tracks, selectedRead);
    else getReadPileupEntryForRecord(tracks, selectedRead, record, records);
  } catch (error) {
    throw new Error(
      `The saved read selection cannot be restored. ${
        error instanceof Error
          ? error.message
          : "The source identity is invalid."
      }`,
    );
  }
}
