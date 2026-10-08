import { z } from "zod";

import { SEQUENCE_VIEWER_LIMITS, utf8ByteLength } from "./runtime-contract";
import {
  isSafeWorkbenchFileName,
  isSafeWorkspaceExportRelativePath,
  sequencePersistenceDestinationSchema,
  sequenceViewerExportInputSchema,
  sequenceWorkspacePersistenceDestinationSchema,
} from "./viewer-operations";

export const SEQUENCE_PERSIST_WORKBENCH_PAYLOAD_TOOL_NAME =
  "sequence.persist_workbench_payload";
export const SEQUENCE_BEGIN_WORKBENCH_PAYLOAD_UPLOAD_TOOL_NAME =
  "sequence.begin_workbench_payload_upload";
export const SEQUENCE_APPEND_WORKBENCH_PAYLOAD_CHUNK_TOOL_NAME =
  "sequence.append_workbench_payload_chunk";
export const SEQUENCE_FINISH_WORKBENCH_PAYLOAD_UPLOAD_TOOL_NAME =
  "sequence.finish_workbench_payload_upload";
export const SEQUENCE_ABORT_WORKBENCH_PAYLOAD_UPLOAD_TOOL_NAME =
  "sequence.abort_workbench_payload_upload";
export const SEQUENCE_PREPARE_WORKSPACE_EXPORT_TOOL_NAME =
  "sequence.prepare_workspace_export";
export const SEQUENCE_GENERATE_WORKSPACE_EXPORT_TOOL_NAME =
  "sequence.generate_workspace_export";

const uuidSchema = z.string().uuid();
const sha256Schema = z
  .string()
  .regex(
    /^[a-f0-9]{64}$/u,
    "sha256 must be a lowercase hexadecimal SHA-256 digest.",
  );
const safeNameSchema = z
  .string()
  .trim()
  .min(1)
  .max(255)
  .refine(isSafeWorkbenchFileName, "name must be a basename.");
const workspaceLocatorSchema = z
  .string()
  .trim()
  .min(1)
  .max(4_096)
  .refine(
    (value) =>
      isSafeWorkspaceExportRelativePath(value) &&
      !/^\.\.(?:\/|$)/u.test(value),
    "workspace locator must stay relative to the workspace root.",
  );
const compactProvenanceSchema = z
  .object({
    engine: z.string().trim().min(1).max(500),
    parameters: z.record(z.string().max(500), z.unknown()),
    sourceRevision: z.number().int().nonnegative(),
  })
  .strict()
  .refine(
    (value) => utf8ByteLength(JSON.stringify(value)) <= 32 * 1_024,
    "provenance must fit the compact completion budget.",
  );

const persistenceIdentityShape = {
  callerId: uuidSchema,
  commandId: uuidSchema,
  sessionId: uuidSchema,
  uploadId: uuidSchema,
};

const persistenceDeclarationShape = {
  ...persistenceIdentityShape,
  byteLength: z
    .number()
    .int()
    .nonnegative()
    .max(Number.MAX_SAFE_INTEGER),
  destination: sequencePersistenceDestinationSchema.default({ kind: "private" }),
  format: sequenceViewerExportInputSchema.shape.format.optional(),
  kind: z.enum(["artifact", "session"]),
  mediaType: z.string().trim().min(1).max(200).optional(),
  name: safeNameSchema,
  provenance: compactProvenanceSchema.optional(),
  sha256: sha256Schema,
};

export const sequencePrepareWorkspaceExportInputSchema = z
  .object({
    byteLength: persistenceDeclarationShape.byteLength,
    destination: sequenceWorkspacePersistenceDestinationSchema,
    format: sequenceViewerExportInputSchema.shape.format.optional(),
    kind: z.literal("session").optional(),
    mediaType: z.string().trim().min(1).max(200).optional(),
    name: safeNameSchema,
    provenance: compactProvenanceSchema.optional(),
    sessionId: uuidSchema,
    sha256: sha256Schema,
  })
  .strict()
  .superRefine((value, context) => {
    if (value.kind === "session") {
      if (value.byteLength === 0) {
        context.addIssue({
          code: "custom",
          message: "Workspace session payloads cannot be empty.",
          path: ["byteLength"],
        });
      }
      if (value.byteLength > SEQUENCE_VIEWER_LIMITS.session.maxSessionBytes) {
        context.addIssue({
          code: "custom",
          message: "Workspace session payload exceeds the bounded session size.",
          path: ["byteLength"],
        });
      }
      if (
        value.format != null ||
        value.mediaType != null ||
        value.provenance != null
      ) {
        context.addIssue({
          code: "custom",
          message: "Workspace session preparation accepts only session fields.",
        });
      }
      return;
    }
    if (
      value.format == null ||
      value.mediaType == null ||
      value.provenance == null
    ) {
      context.addIssue({
        code: "custom",
        message: "Workspace artifact preparation requires export metadata.",
      });
    }
  });

export const sequencePrepareWorkspaceExportResultSchema = z
  .object({
    commandId: uuidSchema,
    destination: z
      .object({ base: z.literal("opened-source"), kind: z.literal("workspace") })
      .strict(),
    maxWorkspaceArtifactBytes: z
      .number()
      .int()
      .positive()
      .default(SEQUENCE_VIEWER_LIMITS.workspace.maxArtifactBytes),
  })
  .strict();

export const sequenceWorkbenchPayloadDeclarationSchema = z
  .object(persistenceDeclarationShape)
  .strict()
  .superRefine((value, context) => {
    if (value.kind === "artifact") {
      if (value.format == null) {
        context.addIssue({
          code: "custom",
          message: "Artifact uploads require format.",
          path: ["format"],
        });
      }
      if (value.mediaType == null) {
        context.addIssue({
          code: "custom",
          message: "Artifact uploads require mediaType.",
          path: ["mediaType"],
        });
      }
      if (
        value.destination.kind === "workspace" &&
        value.provenance == null
      ) {
        context.addIssue({
          code: "custom",
          message: "Workspace artifact uploads require provenance.",
          path: ["provenance"],
        });
      }
      if (
        value.destination.kind === "private" &&
        value.byteLength > SEQUENCE_VIEWER_LIMITS.session.maxArtifactBytes
      ) {
        context.addIssue({
          code: "custom",
          message: "Private artifact upload exceeds the bounded artifact size.",
          path: ["byteLength"],
        });
      }
      return;
    }
    if (value.byteLength > SEQUENCE_VIEWER_LIMITS.session.maxSessionBytes) {
      context.addIssue({
        code: "custom",
        message: "Session upload exceeds the bounded session size.",
        path: ["byteLength"],
      });
    }
    if (value.byteLength === 0) {
      context.addIssue({
        code: "custom",
        message: "Session uploads cannot be empty.",
        path: ["byteLength"],
      });
    }
    if (
      value.format != null ||
      value.mediaType != null ||
      value.provenance != null
    ) {
      context.addIssue({
        code: "custom",
        message: "Session uploads cannot declare artifact format fields.",
      });
    }
  });

export const sequenceBeginWorkbenchPayloadUploadInputSchema =
  sequenceWorkbenchPayloadDeclarationSchema;

export const sequencePersistWorkbenchPayloadInputSchema = z
  .object({
    ...persistenceDeclarationShape,
    dataBase64: z
      .string()
      .max(
        Math.ceil(
          (SEQUENCE_VIEWER_LIMITS.persistence.maxOneShotBytes * 4) / 3,
        ) + 4,
      ),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.kind === "artifact") {
      if (value.format == null) {
        context.addIssue({
          code: "custom",
          message: "Artifact uploads require format.",
          path: ["format"],
        });
      }
      if (value.mediaType == null) {
        context.addIssue({
          code: "custom",
          message: "Artifact uploads require mediaType.",
          path: ["mediaType"],
        });
      }
      if (
        value.destination.kind === "workspace" &&
        value.provenance == null
      ) {
        context.addIssue({
          code: "custom",
          message: "Workspace artifact uploads require provenance.",
          path: ["provenance"],
        });
      }
      if (
        value.destination.kind === "private" &&
        value.byteLength > SEQUENCE_VIEWER_LIMITS.session.maxArtifactBytes
      ) {
        context.addIssue({
          code: "custom",
          message: "Private artifact upload exceeds the bounded artifact size.",
          path: ["byteLength"],
        });
      }
    } else {
      if (value.byteLength > SEQUENCE_VIEWER_LIMITS.session.maxSessionBytes) {
        context.addIssue({
          code: "custom",
          message: "Session upload exceeds the bounded session size.",
          path: ["byteLength"],
        });
      }
      if (value.byteLength === 0) {
        context.addIssue({
          code: "custom",
          message: "Session uploads cannot be empty.",
          path: ["byteLength"],
        });
      }
      if (
        value.format != null ||
        value.mediaType != null ||
        value.provenance != null
      ) {
        context.addIssue({
          code: "custom",
          message: "Session uploads cannot declare artifact format fields.",
        });
      }
    }
    if (value.byteLength > SEQUENCE_VIEWER_LIMITS.persistence.maxOneShotBytes) {
      context.addIssue({
        code: "custom",
        message: "Payload exceeds the proxy-safe one-shot threshold.",
        path: ["byteLength"],
      });
    }
  });

export const sequenceAppendWorkbenchPayloadChunkInputSchema = z
  .object({
    ...persistenceIdentityShape,
    dataBase64: z
      .string()
      .min(1)
      .max(
        Math.ceil((SEQUENCE_VIEWER_LIMITS.persistence.maxChunkBytes * 4) / 3) +
          4,
      ),
    offset: z.number().int().nonnegative(),
  })
  .strict();

export const sequenceFinishWorkbenchPayloadUploadInputSchema = z
  .object(persistenceIdentityShape)
  .strict();
export const sequenceAbortWorkbenchPayloadUploadInputSchema =
  sequenceFinishWorkbenchPayloadUploadInputSchema;

export const sequenceWorkbenchPayloadUploadProgressSchema = z
  .object({
    maxChunkBytes: z.number().int().positive(),
    maxWorkspaceArtifactBytes: z
      .number()
      .int()
      .positive()
      .default(SEQUENCE_VIEWER_LIMITS.workspace.maxArtifactBytes),
    receivedBytes: z.number().int().nonnegative(),
    uploadId: uuidSchema,
  })
  .strict();

export const sequenceGenerateWorkspaceExportInputSchema = z
  .object({
    callerId: uuidSchema,
    commandId: uuidSchema,
    destination: sequenceWorkspacePersistenceDestinationSchema,
    format: z.enum(["aligned-fasta", "fasta", "fastq"]),
    mediaType: z.literal("text/x-fasta").or(z.literal("text/x-fastq")),
    name: safeNameSchema,
    operationId: uuidSchema,
    provenance: compactProvenanceSchema,
    sessionId: uuidSchema,
    source: z
      .object({
        compression: z.enum(["auto", "gzip", "none"]).default("auto"),
        kind: z.literal("opened-source"),
      })
      .strict(),
  })
  .strict()
  .superRefine((value, context) => {
    const expected = value.format === "fastq" ? "text/x-fastq" : "text/x-fasta";
    if (value.mediaType !== expected) {
      context.addIssue({
        code: "custom",
        message: `The ${value.format} server export media type is invalid.`,
        path: ["mediaType"],
      });
    }
  });

export const sequenceWorkspacePublicationMetricsSchema = z
  .object({
    acceptedBytes: z.number().int().nonnegative(),
    chunkCount: z.number().int().nonnegative(),
    committedBytes: z.number().int().nonnegative(),
    elapsedMs: z
      .object({
        publish: z.number().int().nonnegative(),
        receive: z.number().int().nonnegative(),
        total: z.number().int().nonnegative(),
        validate: z.number().int().nonnegative(),
      })
      .strict(),
    mode: z.enum(["browser-streamed", "server-generated"]),
    peakRetainedBytes: z.number().int().nonnegative(),
    producedBytes: z.number().int().nonnegative(),
    retryCount: z.number().int().nonnegative(),
  })
  .strict();

export const sequencePersistedArtifactMetadataSchema = z
  .object({
    createdAt: z.number().int().nonnegative(),
    format: sequenceViewerExportInputSchema.shape.format,
    id: uuidSchema,
    mediaType: z.string().trim().min(1).max(200),
    name: safeNameSchema,
    resourceUri: z
      .string()
      .regex(
        /^viewer-artifact:\/\/sequence-viewer\/generated\/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u,
      ),
    sha256: sha256Schema,
    size: z.number().int().nonnegative(),
    version: z.literal(1),
  })
  .strict();

export const sequenceWorkspacePersistedArtifactMetadataSchema = z
  .object({
    destination: z
      .object({
        base: z.literal("opened-source"),
        kind: z.literal("workspace"),
      })
      .strict(),
    format: sequenceViewerExportInputSchema.shape.format,
    mediaType: z.string().trim().min(1).max(200),
    metrics: sequenceWorkspacePublicationMetricsSchema.optional(),
    name: safeNameSchema,
    outputWorkspacePath: workspaceLocatorSchema,
    provenanceWorkspacePath: workspaceLocatorSchema,
    sha256: sha256Schema,
    size: z.number().int().nonnegative(),
    version: z.literal(1),
  })
  .strict();

export const sequenceSavedSessionMetadataSchema = z
  .object({
    name: safeNameSchema,
    savedSessionId: uuidSchema,
    sha256: sha256Schema,
    size: z.number().int().nonnegative(),
  })
  .strict();

export const sequenceWorkspaceSavedSessionMetadataSchema = z
  .object({
    destination: z
      .object({
        base: z.literal("opened-source"),
        kind: z.literal("workspace"),
      })
      .strict(),
    name: safeNameSchema,
    outputWorkspacePath: workspaceLocatorSchema,
    payloadSha256: sha256Schema,
    payloadSize: z
      .number()
      .int()
      .positive()
      .max(SEQUENCE_VIEWER_LIMITS.session.maxSessionBytes),
    provenanceWorkspacePath: workspaceLocatorSchema,
    sha256: sha256Schema,
    size: z
      .number()
      .int()
      .positive()
      .max(SEQUENCE_VIEWER_LIMITS.workspace.maxSessionManifestBytes),
    version: z.literal(1),
  })
  .strict();

export const sequenceArtifactMetadataSchema = z.union([
  sequencePersistedArtifactMetadataSchema,
  sequenceWorkspacePersistedArtifactMetadataSchema,
]);

export const sequenceArtifactPersistenceResultSchema = z.union([
  sequencePersistedArtifactMetadataSchema.extend({
    kind: z.literal("artifact"),
  }),
  sequenceWorkspacePersistedArtifactMetadataSchema.extend({
    kind: z.literal("artifact"),
  }),
]);

export const sequenceWorkbenchPersistenceResultSchema = z.union([
  sequenceArtifactPersistenceResultSchema,
  sequenceSavedSessionMetadataSchema.extend({ kind: z.literal("session") }),
  sequenceWorkspaceSavedSessionMetadataSchema.extend({
    kind: z.literal("session"),
  }),
]);

export const sequenceAbortWorkbenchPayloadUploadResultSchema = z
  .object({
    aborted: z.boolean(),
    result: sequenceWorkbenchPersistenceResultSchema.optional(),
    uploadId: uuidSchema,
  })
  .strict();

export type SequenceWorkbenchPayloadDeclaration = z.infer<
  typeof sequenceWorkbenchPayloadDeclarationSchema
>;
export type SequenceWorkspacePublicationMetrics = z.infer<
  typeof sequenceWorkspacePublicationMetricsSchema
>;
export type SequenceGenerateWorkspaceExportInput = z.infer<
  typeof sequenceGenerateWorkspaceExportInputSchema
>;
export type SequenceWorkbenchPersistenceResult = z.infer<
  typeof sequenceWorkbenchPersistenceResultSchema
>;
