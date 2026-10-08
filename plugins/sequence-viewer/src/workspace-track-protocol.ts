import { z } from "zod";

import { SEQUENCE_VIEWER_LIMITS } from "./runtime-contract";
import { isSafeWorkspaceBrowserChildName } from "./workspace-browser-protocol";

export const SEQUENCE_LIST_WORKSPACE_TRACK_DIRECTORY_TOOL_NAME =
  "sequence.list_workspace_track_directory";
export const SEQUENCE_RESOLVE_WORKSPACE_TRACK_BUNDLE_TOOL_NAME =
  "sequence.resolve_workspace_track_bundle";
export const SEQUENCE_LOAD_WORKSPACE_TRACK_TOOL_NAME =
  "sequence.load_workspace_track";

export const sequenceWorkspaceTrackFormatSchema = z.enum([
  "bai",
  "bam",
  "bed",
  "crai",
  "cram",
  "csi",
  "fasta",
  "gff3",
  "gtf",
  "sam",
  "vcf",
]);
export const sequenceWorkspaceTrackRoleSchema = z.enum([
  "annotation",
  "index",
  "reads",
  "reference",
  "variant",
]);

const sessionIdSchema = z.string().uuid();
const candidateIdSchema = z.string().uuid();
const safeChildNameSchema = z
  .string()
  .min(1)
  .max(255)
  .refine(
    isSafeWorkspaceBrowserChildName,
    "label must be one safe workspace child name.",
  );
const workspacePathSchema = z
  .string()
  .min(1)
  .max(4_096)
  .refine(
    (value) =>
      value === "." ||
      (!value.startsWith("/") &&
        !value.includes("\\") &&
        !value.includes(":") &&
        !/[\0\r\n]/u.test(value) &&
        !value
          .split("/")
          .some((segment) =>
            segment === ".." ? true : !isSafeWorkspaceBrowserChildName(segment),
          )),
    "workspace path must stay relative to the active root.",
  );

export const sequenceListWorkspaceTrackDirectoryInputSchema = z
  .object({
    cursor: z.string().trim().min(1).max(1_024).optional(),
    directoryCandidateId: candidateIdSchema.optional(),
    limit: z
      .number()
      .int()
      .min(1)
      .max(SEQUENCE_VIEWER_LIMITS.workspace.maxDirectoryPageSize)
      .default(50),
    sessionId: sessionIdSchema,
  })
  .strict();

const bundleStatusSchema = z.enum([
  "ambiguous",
  "missing",
  "not-required",
  "ready",
]);

const directoryEntrySchema = z
  .object({
    candidateId: candidateIdSchema,
    kind: z.literal("directory"),
    label: safeChildNameSchema,
    workspacePath: workspacePathSchema,
  })
  .strict();

export const sequenceWorkspaceTrackCandidateSchema = z
  .object({
    candidateId: candidateIdSchema,
    format: sequenceWorkspaceTrackFormatSchema,
    kind: z.literal("file"),
    label: safeChildNameSchema,
    role: sequenceWorkspaceTrackRoleSchema,
    size: z.number().int().nonnegative(),
    workspacePath: workspacePathSchema,
  })
  .strict();

const fileEntrySchema = sequenceWorkspaceTrackCandidateSchema.extend({
  bundle: z
    .object({
      indexMatches: z.number().int().nonnegative(),
      indexStatus: bundleStatusSchema,
      referenceMatches: z.number().int().nonnegative(),
      referenceStatus: bundleStatusSchema,
    })
    .strict()
    .optional(),
});

const breadcrumbSchema = z
  .object({
    candidateId: candidateIdSchema,
    label: safeChildNameSchema.or(z.literal("Workspace")),
    workspacePath: workspacePathSchema,
  })
  .strict();

export const sequenceListWorkspaceTrackDirectoryResultSchema = z
  .object({
    breadcrumbs: z.array(breadcrumbSchema).max(256),
    directory: breadcrumbSchema,
    entries: z
      .array(z.union([directoryEntrySchema, fileEntrySchema]))
      .max(SEQUENCE_VIEWER_LIMITS.workspace.maxDirectoryPageSize),
    nextCursor: z.string().min(1).max(1_024).optional(),
    omittedEntries: z.number().int().nonnegative(),
  })
  .strict();

export const sequenceResolveWorkspaceTrackBundleInputSchema = z
  .object({
    indexCandidateId: candidateIdSchema.optional(),
    primaryCandidateId: candidateIdSchema,
    referenceCandidateId: candidateIdSchema.optional(),
    sessionId: sessionIdSchema,
  })
  .strict();

const bundleRequirementSchema = z
  .object({
    candidates: z
      .array(sequenceWorkspaceTrackCandidateSchema)
      .max(SEQUENCE_VIEWER_LIMITS.workspace.maxBundleCandidates),
    message: z.string().min(1).max(1_000),
    omittedCandidates: z.number().int().nonnegative(),
    role: z.enum(["index", "reference"]),
    selectedCandidate: sequenceWorkspaceTrackCandidateSchema.optional(),
    status: z.enum(["ambiguous", "missing", "selected"]),
  })
  .strict();

export const sequenceResolveWorkspaceTrackBundleResultSchema = z
  .object({
    bundleId: z.string().uuid().optional(),
    primary: sequenceWorkspaceTrackCandidateSchema,
    ready: z.boolean(),
    requirements: z.array(bundleRequirementSchema).max(2),
  })
  .strict()
  .superRefine(({ bundleId, ready }, context) => {
    if (ready !== (bundleId != null)) {
      context.addIssue({
        code: "custom",
        message: "ready bundle results require exactly one bundleId.",
      });
    }
  });

export const sequenceLoadWorkspaceTrackInputSchema = z
  .object({
    bundleId: z.string().uuid(),
    end: z.number().int().positive().optional(),
    reference: z.string().trim().min(1).max(500).optional(),
    sessionId: sessionIdSchema,
    start: z.number().int().positive().optional(),
  })
  .strict()
  .superRefine(({ end, start }, context) => {
    if ((start == null) !== (end == null)) {
      context.addIssue({
        code: "custom",
        message: "Indexed track windows require both start and end.",
      });
      return;
    }
    if (start != null && end != null) {
      if (end < start) {
        context.addIssue({
          code: "custom",
          message: "Indexed track window end must be at or after start.",
        });
      } else if (end - start + 1 > 100_000) {
        context.addIssue({
          code: "custom",
          message: "Indexed track windows are limited to 100,000 bases.",
        });
      }
    }
  });

export const sequenceLoadWorkspaceTrackResultSchema = z
  .object({
    format: z.enum(["bam", "bed", "cram", "gff3", "gtf", "sam", "vcf"]),
    itemCount: z.number().int().nonnegative(),
    kind: z.enum(["annotations", "reads", "variants"]),
    loaded: z.literal(true),
    mappingStatus: z.enum(["matched", "unmatched", "unresolved"]),
    name: safeChildNameSchema,
    sha256: z.string().regex(/^[a-f0-9]{64}$/u),
    sourceTruncated: z.boolean(),
    sourceWorkspacePath: workspacePathSchema,
  })
  .strict();

export type SequenceWorkspaceTrackFormat = z.infer<
  typeof sequenceWorkspaceTrackFormatSchema
>;
export type SequenceWorkspaceTrackRole = z.infer<
  typeof sequenceWorkspaceTrackRoleSchema
>;
export type SequenceWorkspaceTrackCandidate = z.infer<
  typeof sequenceWorkspaceTrackCandidateSchema
>;
export type SequenceListWorkspaceTrackDirectoryInput = z.infer<
  typeof sequenceListWorkspaceTrackDirectoryInputSchema
>;
export type SequenceListWorkspaceTrackDirectoryResult = z.infer<
  typeof sequenceListWorkspaceTrackDirectoryResultSchema
>;
export type SequenceResolveWorkspaceTrackBundleInput = z.infer<
  typeof sequenceResolveWorkspaceTrackBundleInputSchema
>;
export type SequenceResolveWorkspaceTrackBundleResult = z.infer<
  typeof sequenceResolveWorkspaceTrackBundleResultSchema
>;
export type SequenceLoadWorkspaceTrackInput = z.infer<
  typeof sequenceLoadWorkspaceTrackInputSchema
>;
export type SequenceLoadWorkspaceTrackResult = z.infer<
  typeof sequenceLoadWorkspaceTrackResultSchema
>;
