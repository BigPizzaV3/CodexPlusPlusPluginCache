import { z } from "zod";

import { SEQUENCE_VIEWER_LIMITS, utf8ByteLength } from "./runtime-contract";
import { isSafeWorkspaceProvenancePath } from "./viewer-operations";
import { isSafeWorkspaceBrowserChildName } from "./workspace-browser-protocol";

export const SEQUENCE_LIST_WORKSPACE_SESSIONS_TOOL_NAME =
  "sequence.list_workspace_sessions";
export const SEQUENCE_RESTORE_WORKSPACE_SESSION_TOOL_NAME =
  "sequence.restore_workspace_session";

const uuidSchema = z.string().uuid();
const sha256Schema = z.string().regex(/^[a-f0-9]{64}$/u);
const safeWorkspacePathSchema = z
  .string()
  .min(1)
  .max(4_096)
  .refine(isSafeWorkspaceProvenancePath);
const safeNameSchema = z
  .string()
  .min(1)
  .max(255)
  .refine(isSafeWorkspaceBrowserChildName);

export const sequenceWorkspaceSessionDependencySchema = z
  .object({
    format: z.string().min(1).max(100),
    kind: z.enum(["artifact", "track"]),
    name: safeNameSchema,
    required: z.boolean(),
    sha256: sha256Schema,
    size: z.number().int().nonnegative(),
    workspacePath: safeWorkspacePathSchema,
  })
  .strict();

export const sequenceWorkspaceSessionManifestSchema = z
  .object({
    createdAt: z.string().datetime({ offset: true }),
    dependencies: z
      .array(sequenceWorkspaceSessionDependencySchema)
      .max(SEQUENCE_VIEWER_LIMITS.workspace.maxSessionDependencies),
    mode: z.enum(["alignment", "sequence"]),
    payload: z
      .string()
      .min(1)
      .refine(
        (value) =>
          utf8ByteLength(value) <= SEQUENCE_VIEWER_LIMITS.session.maxSessionBytes,
        "Workspace session payload exceeds the bounded session size.",
      ),
    payloadSha256: sha256Schema,
    plugin: z
      .object({
        name: z.literal("sequence-viewer"),
        version: z.string().regex(/^\d+\.\d+\.\d+$/u),
      })
      .strict(),
    schemaVersion: z.literal(1),
    source: z
      .object({
        sha256: sha256Schema,
        size: z.number().int().nonnegative(),
        workspacePath: safeWorkspacePathSchema,
      })
      .strict(),
    version: z.literal(1),
  })
  .strict();

export const sequenceListWorkspaceSessionsInputSchema = z
  .object({ sessionId: uuidSchema })
  .strict();

const dependencyStatusSchema = z
  .object({
    kind: z.enum(["artifact", "track"]),
    name: safeNameSchema,
    required: z.boolean(),
    status: z.enum(["changed", "matched", "missing", "unverified"]),
    workspacePath: safeWorkspacePathSchema,
  })
  .strict();

const workspaceSessionCandidateSchema = z
  .object({
    candidateId: uuidSchema,
    createdAt: z.string().datetime({ offset: true }),
    dependencies: z
      .array(dependencyStatusSchema)
      .max(SEQUENCE_VIEWER_LIMITS.workspace.maxSessionDependencies),
    mode: z.enum(["alignment", "sequence"]),
    name: safeNameSchema,
    sourceStatus: z.enum(["matched", "verification-required"]),
    workspacePath: safeWorkspacePathSchema,
  })
  .strict();

export const sequenceListWorkspaceSessionsResultSchema = z
  .object({
    candidates: z
      .array(workspaceSessionCandidateSchema)
      .max(SEQUENCE_VIEWER_LIMITS.workspace.maxSessionCandidates),
    omittedCandidates: z.number().int().nonnegative(),
  })
  .strict();

export const sequenceRestoreWorkspaceSessionInputSchema = z
  .object({ candidateId: uuidSchema, sessionId: uuidSchema })
  .strict();

export const sequenceRestoreWorkspaceSessionResultSchema = z
  .object({
    dependencies: z
      .array(dependencyStatusSchema)
      .max(SEQUENCE_VIEWER_LIMITS.workspace.maxSessionDependencies),
    mode: z.enum(["alignment", "sequence"]),
    name: safeNameSchema,
    restored: z.literal(true),
    workspacePath: safeWorkspacePathSchema,
  })
  .strict();

export type SequenceWorkspaceSessionManifest = z.infer<
  typeof sequenceWorkspaceSessionManifestSchema
>;
export type SequenceListWorkspaceSessionsInput = z.infer<
  typeof sequenceListWorkspaceSessionsInputSchema
>;
export type SequenceListWorkspaceSessionsResult = z.infer<
  typeof sequenceListWorkspaceSessionsResultSchema
>;
export type SequenceRestoreWorkspaceSessionInput = z.infer<
  typeof sequenceRestoreWorkspaceSessionInputSchema
>;
export type SequenceRestoreWorkspaceSessionResult = z.infer<
  typeof sequenceRestoreWorkspaceSessionResultSchema
>;
