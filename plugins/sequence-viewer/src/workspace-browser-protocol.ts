import { z } from "zod";

import { SEQUENCE_VIEWER_LIMITS } from "./runtime-contract";
import { sequenceViewerExportInputSchema } from "./viewer-operations";

export const SEQUENCE_LIST_WORKSPACE_DIRECTORY_TOOL_NAME =
  "sequence.list_workspace_export_directory";
export const SEQUENCE_CREATE_WORKSPACE_DIRECTORY_TOOL_NAME =
  "sequence.create_workspace_export_directory";

const sessionIdSchema = z.string().uuid();
const windowsReservedName = /^(?:AUX|CON|NUL|PRN|COM[1-9]|LPT[1-9])$/u;
export function isSafeWorkspaceBrowserChildName(value: string): boolean {
  const windowsBase = value.split(".")[0]?.toUpperCase() ?? "";
  return (
    value.length > 0 &&
    value !== "." &&
    value !== ".." &&
    !value.endsWith(".") &&
    !value.endsWith(" ") &&
    !/[\\/:\0\r\n]/u.test(value) &&
    !windowsReservedName.test(windowsBase) &&
    new TextEncoder().encode(value).byteLength <= 255
  );
}
const workspaceDirectorySchema = z
  .string()
  .trim()
  .min(1)
  .max(4_096)
  .refine(
    (value) =>
      !value.startsWith("/") &&
      !value.includes("\\") &&
      !/[\0\r\n]/u.test(value) &&
      !/^[A-Za-z]:/u.test(value) &&
      !/^[A-Za-z][A-Za-z0-9+.-]*:/u.test(value) &&
      (value === "." ||
        value
          .split("/")
          .every(
            (segment) =>
              segment === ".." || isSafeWorkspaceBrowserChildName(segment),
          )),
    "directory must be relative to the opened source directory.",
  );
const childNameSchema = z
  .string()
  .min(1)
  .max(255)
  .refine(
    isSafeWorkspaceBrowserChildName,
    "name must be one safe child segment.",
  );

const candidateSchema = z
  .object({
    format: sequenceViewerExportInputSchema.shape.format,
    name: childNameSchema,
  })
  .strict();

export const sequenceListWorkspaceDirectoryInputSchema = z
  .object({
    candidate: candidateSchema.optional(),
    cursor: z.string().trim().min(1).max(1_024).optional(),
    directory: workspaceDirectorySchema.default("."),
    limit: z
      .number()
      .int()
      .min(1)
      .max(SEQUENCE_VIEWER_LIMITS.workspace.maxDirectoryPageSize)
      .default(50),
    sessionId: sessionIdSchema,
  })
  .strict();

const safeWorkspacePathSchema = z
  .string()
  .min(1)
  .max(4_096)
  .refine(
    (value) =>
      !value.startsWith("/") &&
      !value.includes("\\") &&
      !value.includes(":") &&
      !/[\0\r\n]/u.test(value) &&
      !/^[A-Za-z]:/u.test(value),
    "workspace path must be relative.",
  );

export const sequenceWorkspaceDirectoryCandidateSchema = z
  .object({
    exactAvailable: z.boolean(),
    exactWorkspacePath: safeWorkspacePathSchema,
    name: childNameSchema,
    nextVersionName: childNameSchema.optional(),
    nextVersionWorkspacePath: safeWorkspacePathSchema.optional(),
  })
  .strict();

export const sequenceListWorkspaceDirectoryResultSchema = z
  .object({
    candidate: sequenceWorkspaceDirectoryCandidateSchema.optional(),
    directory: z
      .object({
        breadcrumbs: z
          .array(
            z
              .object({
                label: childNameSchema.or(z.literal("Workspace")),
                relativePath: workspaceDirectorySchema,
                workspacePath: safeWorkspacePathSchema,
              })
              .strict(),
          )
          .max(256),
        parentRelativePath: workspaceDirectorySchema.optional(),
        relativePath: workspaceDirectorySchema,
        sourceDirectoryWorkspacePath: safeWorkspacePathSchema,
        workspacePath: safeWorkspacePathSchema,
      })
      .strict(),
    entries: z
      .array(
        z
          .object({
            kind: z.enum(["directory", "file"]),
            name: childNameSchema,
            relativePath: workspaceDirectorySchema,
            size: z.number().int().nonnegative().optional(),
          })
          .strict(),
      )
      .max(SEQUENCE_VIEWER_LIMITS.workspace.maxDirectoryPageSize),
    nextCursor: z.string().min(1).max(1_024).optional(),
    omittedEntries: z.number().int().nonnegative(),
  })
  .strict();

export const sequenceCreateWorkspaceDirectoryInputSchema = z
  .object({
    name: childNameSchema,
    parentDirectory: workspaceDirectorySchema.default("."),
    sessionId: sessionIdSchema,
  })
  .strict();

export const sequenceCreateWorkspaceDirectoryResultSchema = z
  .object({
    name: childNameSchema,
    relativePath: workspaceDirectorySchema,
    workspacePath: safeWorkspacePathSchema,
  })
  .strict();

export type SequenceListWorkspaceDirectoryInput = z.infer<
  typeof sequenceListWorkspaceDirectoryInputSchema
>;
export type SequenceListWorkspaceDirectoryResult = z.infer<
  typeof sequenceListWorkspaceDirectoryResultSchema
>;
export type SequenceCreateWorkspaceDirectoryInput = z.infer<
  typeof sequenceCreateWorkspaceDirectoryInputSchema
>;
export type SequenceCreateWorkspaceDirectoryResult = z.infer<
  typeof sequenceCreateWorkspaceDirectoryResultSchema
>;
