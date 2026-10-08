import { z } from "zod";

import { SEQUENCE_VIEWER_LIMITS, utf8ByteLength } from "./runtime-contract";
import type { SequenceDocument } from "./sequence/types";

export const INDEXED_SEQUENCE_ENVELOPE_PREFIX =
  "OPENAI_SEQUENCE_VIEWER_INDEXED_V1\n";

const classificationSchema = z
  .object({
    alignment: z.unknown().nullable(),
    confidence: z.enum(["high", "low", "medium"]),
    evidence: z.array(z.string().max(2_000)).max(100),
    kind: z.enum([
      "annotated-sequence",
      "chromatogram",
      "fastq",
      "multiple-sequence-alignment",
      "sequence-collection",
      "single-sequence",
      "unknown",
    ]),
    molecule: z.enum([
      "dna",
      "nucleic-acid-ambiguous",
      "protein",
      "rna",
      "unknown",
    ]),
    suggestedViewer: z.enum(["msa", "raw", "sequence"]),
  })
  .strict();
const qualitySchema = z
  .object({
    ascii: z.string(),
    phred: z.array(z.number().int().min(0).max(93)),
  })
  .strict();
const recordSchema = z
  .object({
    description: z.string().max(10_000).optional(),
    features: z.array(z.never()).max(0),
    id: z.string().min(1).max(2_000),
    length: z.number().int().nonnegative(),
    metadata: z.record(z.string(), z.union([z.string(), z.array(z.string())])),
    molecule: z.enum([
      "dna",
      "nucleic-acid-ambiguous",
      "protein",
      "rna",
      "unknown",
    ]),
    quality: qualitySchema.optional(),
    sequence: z.string(),
    sourceLabel: z.string().min(1).max(2_000),
    topology: z.enum(["circular", "linear", "unknown"]).optional(),
  })
  .strict();
const warningSchema = z
  .object({
    code: z.string().min(1).max(200),
    column: z.number().int().positive().optional(),
    line: z.number().int().positive().optional(),
    message: z.string().min(1).max(10_000),
    severity: z.enum(["error", "info", "warning"]),
  })
  .strict();
const fastqSummarySchema = z
  .object({
    gcFraction: z.number().min(0).max(1),
    meanQuality: z.number().nonnegative(),
    meanReadLength: z.number().nonnegative(),
    nFraction: z.number().min(0).max(1),
    q20Fraction: z.number().min(0).max(1),
    q30Fraction: z.number().min(0).max(1),
    qualityEncoding: z.literal("phred+33-assumed"),
    readCount: z.number().int().nonnegative(),
    readLengthMax: z.number().int().nonnegative(),
    readLengthMin: z.number().int().nonnegative(),
    totalBases: z.number().int().nonnegative(),
  })
  .strict();
const indexedDocumentSchema = z
  .object({
    classification: classificationSchema,
    fastqSummary: fastqSummarySchema.optional(),
    fileName: z.string().max(2_000).optional(),
    format: z.enum(["fasta", "fastq"]),
    kind: z.enum(["fastq", "sequence-collection", "single-sequence"]),
    recordInventory: z
      .object({
        materializedCount: z.number().int().nonnegative(),
        totalCount: z.number().int().nonnegative(),
        truncated: z.boolean(),
      })
      .strict(),
    records: z
      .array(recordSchema)
      .max(SEQUENCE_VIEWER_LIMITS.input.maxSequenceRecords),
    warnings: z.array(warningSchema).max(1_000),
  })
  .strict();
const envelopeSchema = z
  .object({
    document: indexedDocumentSchema,
    index: z
      .object({
        complete: z.literal(true),
        compressed: z.boolean(),
        decodedBytes: z.number().int().nonnegative(),
        indexedRecordCount: z.number().int().nonnegative(),
        materializedBases: z.number().int().nonnegative(),
        materializedRecordCount: z.number().int().nonnegative(),
        sourceBytes: z.number().int().nonnegative(),
        sourceVersion: z.string().min(1).max(256),
      })
      .strict(),
    schemaVersion: z.literal(1),
  })
  .strict();

export type IndexedSequenceEnvelope = {
  document: SequenceDocument;
  index: z.infer<typeof envelopeSchema>["index"];
  schemaVersion: 1;
};

export function serializeIndexedSequenceEnvelope(
  envelope: IndexedSequenceEnvelope,
): string {
  const text = `${INDEXED_SEQUENCE_ENVELOPE_PREFIX}${JSON.stringify(envelope)}`;
  if (utf8ByteLength(text) > SEQUENCE_VIEWER_LIMITS.input.maxTextBytes) {
    throw new Error(
      "The indexed sequence preview exceeds the viewer transfer budget. Reduce the materialized cache size.",
    );
  }
  return text;
}

export function parseIndexedSequenceEnvelope(
  value: string,
): IndexedSequenceEnvelope | null {
  if (!value.startsWith(INDEXED_SEQUENCE_ENVELOPE_PREFIX)) return null;
  const parsed = envelopeSchema.parse(
    JSON.parse(value.slice(INDEXED_SEQUENCE_ENVELOPE_PREFIX.length)),
  );
  let materializedBases = 0;
  for (const record of parsed.document.records) {
    if (record.sequence.length !== record.length) {
      throw new Error(
        `Indexed record ${record.id} has inconsistent sequence length metadata.`,
      );
    }
    if (
      record.quality != null &&
      (record.quality.ascii.length !== record.length ||
        record.quality.phred.length !== record.length)
    ) {
      throw new Error(
        `Indexed FASTQ record ${record.id} has inconsistent quality length metadata.`,
      );
    }
    materializedBases += record.length;
  }
  if (
    materializedBases !== parsed.index.materializedBases ||
    parsed.document.records.length !== parsed.index.materializedRecordCount ||
    parsed.document.recordInventory.materializedCount !==
      parsed.document.records.length
  ) {
    throw new Error("Indexed sequence cache metadata is inconsistent.");
  }
  return parsed as IndexedSequenceEnvelope;
}

export function buildIndexedPreviewContents(
  document: SequenceDocument,
): string {
  if (document.format === "fastq") {
    return document.records
      .map(
        (record) =>
          `@${record.sourceLabel}${record.description == null ? "" : ` ${record.description}`}\n${record.sequence}\n+\n${record.quality?.ascii ?? "I".repeat(record.length)}`,
      )
      .join("\n");
  }
  return document.records
    .map(
      (record) =>
        `>${record.sourceLabel}${record.description == null ? "" : ` ${record.description}`}\n${record.sequence}`,
    )
    .join("\n");
}
