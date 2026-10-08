import { z } from "zod";

import { SEQUENCE_VIEWER_LIMITS } from "./runtime-contract";

export const SEQUENCE_PLUGIN_SCIENTIFIC_SOURCE_META_KEY =
  "openai/scientific-viewer/plugin-source";

export const SEQUENCE_DESCRIBE_SCIENTIFIC_SOURCE_TOOL_NAME =
  "sequence.describe_scientific_source";
export const SEQUENCE_READ_SCIENTIFIC_RANGE_TOOL_NAME =
  "sequence.read_scientific_range";
export const SEQUENCE_LIST_SCIENTIFIC_RECORDS_TOOL_NAME =
  "sequence.list_scientific_records";
export const SEQUENCE_READ_SCIENTIFIC_WINDOW_TOOL_NAME =
  "sequence.read_scientific_window";
export const SEQUENCE_SAVE_SCIENTIFIC_CHECKPOINT_TOOL_NAME =
  "sequence.save_scientific_checkpoint";
export const SEQUENCE_RESTORE_SCIENTIFIC_CHECKPOINT_TOOL_NAME =
  "sequence.restore_scientific_checkpoint";
export const SEQUENCE_RESTORE_CHAT_VIEWER_SESSION_TOOL_NAME =
  "sequence.restore_chat_viewer_session";

const safeDecimal = z.string().regex(/^(0|[1-9]\d*)$/u);

export const sequenceRestoreChatViewerSessionInputSchema = z
  .object({
    resourceUri: z.string().min(1).max(256),
    sessionId: z.string().uuid(),
  })
  .strict();

export const sequenceScientificSourceSchema = z
  .object({
    family: z.literal("sequence"),
    fileName: z.string().min(1).max(1_024),
    format: z.enum(["fasta", "fastq", "unsupported"]),
    protocolVersion: z.literal(1),
    sessionId: z.string().uuid(),
    sizeBytesDecimal: safeDecimal,
    sourceId: z.string().uuid(),
    sourceRevision: z.string().min(1).max(256),
  })
  .strict();

export type SequenceScientificSource = z.infer<
  typeof sequenceScientificSourceSchema
>;

export const sequenceScientificSourceRequestSchema = z
  .object({
    sessionId: z.string().uuid(),
    sourceId: z.string().uuid(),
    sourceRevision: z.string().min(1).max(256),
  })
  .strict();

export const sequenceScientificRangeRequestSchema =
  sequenceScientificSourceRequestSchema.extend({
    length: z
      .number()
      .int()
      .positive()
      .max(SEQUENCE_VIEWER_LIMITS.persistence.maxChunkBytes),
    offsetDecimal: safeDecimal,
  });

export const sequenceScientificRecordRequestSchema =
  sequenceScientificSourceRequestSchema.extend({
    cursor: z
      .string()
      .max(64)
      .regex(/^(0|[1-9]\d*)(?::(0|[1-9]\d*))?$/u)
      .optional(),
    limit: z.number().int().min(1).max(256),
  });

export const sequenceScientificWindowRequestSchema =
  sequenceScientificSourceRequestSchema.extend({
    end1Decimal: safeDecimal,
    includeQuality: z.boolean().optional(),
    recordNumber: z.number().int().positive(),
    start1Decimal: safeDecimal,
  });

export const sequenceScientificCheckpointRequestSchema =
  sequenceScientificSourceRequestSchema.extend({
    checkpointBase64: z
      .string()
      .max(Math.ceil(SEQUENCE_VIEWER_LIMITS.persistence.maxChunkBytes / 3) * 4),
    lastAcknowledgedRevision: z.number().int().nonnegative(),
  });
