import { z } from "zod";

import { SEQUENCE_VIEWER_SCHEMA_VERSION } from "./runtime-contract";
import { queuedSequenceViewerCommandSchema } from "./viewer-commands";

export const sequenceViewerFileSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1)
      .refine(isSafeFileName, "file.name must be a basename."),
    resourceUri: z.string().trim().min(1),
  })
  .strict();

export const sequenceViewerToolInputSchema = z
  .object({ file: sequenceViewerFileSchema })
  .strict();

export const sequenceViewerChatToolInputSchema = z
  .object({
    path: z.string().trim().min(1),
    presentation: z.enum(["full", "inline"]).optional(),
  })
  .strict();

export const sequencePublicExampleIdSchema = z.enum([
  "ena-drr037765-first-500",
  "ncbi-nc-001416-1",
  "rfam-rf00360-15-1",
  "uniprot-human-ras-sv1",
]);

// Shared wire shape for pending app input. The server additionally validates
// platform-specific absolute paths and authenticates the selected MCP root.
export const sequenceViewerPublicExampleToolInputSchema = z
  .object({
    exampleId: sequencePublicExampleIdSchema.describe(
      "Exact versioned public example identifier from the Sequence Viewer starter catalog.",
    ),
    workspaceRoot: z
      .string()
      .trim()
      .min(1)
      .max(32_768)
      .optional()
      .describe(
        "Exact independently authenticated MCP workspace root to select. Omit when the host exposes exactly one active root. This path does not grant workspace access.",
      ),
  })
  .strict();

export const sequenceViewerChatFileInputSchema = z
  .object({
    primaryFile: z
      .object({
        name: z
          .string()
          .trim()
          .min(1)
          .refine(isSafeFileName, "primaryFile.name must be a basename."),
        uri: z.string().trim().min(1),
      })
      .strict(),
  })
  .strict();

export const sequenceViewerToolResultMetadataSchema = z
  .object({ "openai/viewerFile": sequenceViewerChatFileInputSchema })
  .passthrough();

export const sequenceViewerSessionSchema = z
  .object({
    revision: z.number().int().nonnegative(),
    schemaVersion: z
      .literal(SEQUENCE_VIEWER_SCHEMA_VERSION)
      .default(SEQUENCE_VIEWER_SCHEMA_VERSION),
    sessionId: z.string().uuid(),
  })
  .strict();

export const sequenceViewerToolResultSessionSchema = z
  .object({
    schemaVersion: z
      .literal(SEQUENCE_VIEWER_SCHEMA_VERSION)
      .default(SEQUENCE_VIEWER_SCHEMA_VERSION),
    viewerCommandRevision: z.number().int().nonnegative(),
    viewerSessionId: z.string().uuid(),
  })
  .passthrough();

export const sequenceViewerWaitForCommandInputSchema = z
  .object({
    afterRevision: z.number().int().nonnegative(),
    sessionId: z.string().uuid(),
    timeoutMs: z.number().int().min(1_000).max(25_000).default(25_000),
  })
  .strict();

export const sequenceViewerWaitResultSchema = z
  .object({ command: queuedSequenceViewerCommandSchema.nullable() })
  .strict();

export const sequenceViewerCompleteCommandInputSchema = z
  .object({
    applied: z.boolean(),
    commandId: z.string().uuid(),
    message: z.string().min(1).max(2_000),
    sessionId: z.string().uuid(),
    state: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();

export type SequenceViewerToolInput = z.infer<
  typeof sequenceViewerToolInputSchema
>;
export type SequenceViewerChatFileInput = z.infer<
  typeof sequenceViewerChatFileInputSchema
>;

function isSafeFileName(fileName: string): boolean {
  return !fileName.includes("/") && !fileName.includes("\\");
}
