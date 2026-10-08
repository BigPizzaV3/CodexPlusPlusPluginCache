import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify } from "node:util";
import { gunzip as gunzipCallback } from "node:zlib";

import {
  registerAppResource,
  registerAppTool,
  RESOURCE_MIME_TYPE,
} from "@modelcontextprotocol/ext-apps/server";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

import {
  createChatFileResourceStore,
  readWorkspaceFileBytes,
  type ChatViewerFileInput,
  type RootsRequestExtra,
} from "./chat-file-resource";
import { isGzipCompressedBiologicalFileName } from "./compressed-file-name";
import {
  BIOLOGICAL_SEQUENCE_FILE_ENTRYPOINTS,
  isSupportedBiologicalSequenceFileName,
} from "./file-kind";
import {
  SEQUENCE_SCIENTIFIC_RECOVERY_META_KEY,
  sequenceScientificRecoveryMetadataSchema,
  type SequenceScientificRecoveryMetadata,
} from "./persistent/recovery-adapter";
import {
  sequenceViewerCompleteCommandInputSchema,
  sequenceViewerFileSchema,
  sequenceViewerWaitForCommandInputSchema,
} from "./protocol";
import {
  SEQUENCE_ACQUIRE_PUBLIC_EXAMPLE_TOOL_NAME,
  SequencePublicExampleAcquisitionStore,
  sequenceAcquirePublicExampleInputSchema,
  throwIfPublicExampleAcquisitionAborted,
  type SequencePublicExampleAcquirer,
  type SequencePublicExampleProvenanceSummary,
} from "./public-example-acquisition";
import { SequenceViewerCommandStore } from "./server-command-store";
import { createServerWorkbenchStore } from "./server-workbench-store";
import { SequenceWorkbenchUploadStore } from "./server-workbench-upload";
import { decodeCramWindowToSam } from "./cram-decoder";
import { decodeBamWindowToSam } from "./bam-decoder";
import {
  SEQUENCE_VIEWER_LIMITS,
  SEQUENCE_VIEWER_SCHEMA_VERSION,
} from "./runtime-contract";
import { SequencePluginScientificPlatform } from "./scientific-platform";
import {
  SEQUENCE_DESCRIBE_SCIENTIFIC_SOURCE_TOOL_NAME,
  SEQUENCE_LIST_SCIENTIFIC_RECORDS_TOOL_NAME,
  SEQUENCE_PLUGIN_SCIENTIFIC_SOURCE_META_KEY,
  SEQUENCE_READ_SCIENTIFIC_RANGE_TOOL_NAME,
  SEQUENCE_READ_SCIENTIFIC_WINDOW_TOOL_NAME,
  SEQUENCE_RESTORE_CHAT_VIEWER_SESSION_TOOL_NAME,
  SEQUENCE_RESTORE_SCIENTIFIC_CHECKPOINT_TOOL_NAME,
  SEQUENCE_SAVE_SCIENTIFIC_CHECKPOINT_TOOL_NAME,
  sequenceScientificCheckpointRequestSchema,
  sequenceScientificRangeRequestSchema,
  sequenceScientificRecordRequestSchema,
  sequenceRestoreChatViewerSessionInputSchema,
  sequenceScientificSourceRequestSchema,
  sequenceScientificWindowRequestSchema,
} from "./scientific-platform-protocol";
import { SEQUENCE_VIEWER_VERSION } from "./version";
import {
  SEQUENCE_VIEWER_COMPLETE_COMMAND_TOOL_NAME,
  SEQUENCE_VIEWER_CONTROL_TOOL_NAME,
  SEQUENCE_VIEWER_REGISTER_SESSION_TOOL_NAME,
  SEQUENCE_VIEWER_WAIT_FOR_COMMAND_TOOL_NAME,
  sequenceViewerControlInputSchema,
  sequenceViewerControlToolInputSchema,
  type SequenceViewerControlCommand,
  type SequenceViewerCommand,
} from "./viewer-commands";
import {
  SEQUENCE_VIEWER_ALIGN_TOOL_NAME,
  SEQUENCE_VIEWER_ANALYSIS_TOOL_NAME,
  SEQUENCE_VIEWER_ANNOTATIONS_TOOL_NAME,
  SEQUENCE_VIEWER_CANCEL_JOB_TOOL_NAME,
  SEQUENCE_VIEWER_EDIT_TOOL_NAME,
  SEQUENCE_VIEWER_EXPORT_TOOL_NAME,
  SEQUENCE_VIEWER_LOAD_TRACK_TOOL_NAME,
  SEQUENCE_VIEWER_QUERY_TOOL_NAME,
  SEQUENCE_VIEWER_RESTORE_SESSION_TOOL_NAME,
  SEQUENCE_VIEWER_SAVE_SESSION_TOOL_NAME,
  sequenceViewerAlignInputSchema,
  sequenceViewerAnalysisInputSchema,
  sequenceViewerAnalysisRequestSchema,
  sequenceViewerAnnotationsInputSchema,
  sequenceViewerCancelJobInputSchema,
  sequenceViewerEditInputSchema,
  sequenceViewerEditRequestSchema,
  sequenceViewerExportInputSchema,
  sequenceViewerLoadTrackInputSchema,
  sequenceViewerQueryInputSchema,
  sequenceViewerQueryRequestSchema,
  sequenceViewerRestoreSessionInputSchema,
  sequenceViewerSaveSessionInputSchema,
} from "./viewer-operations";
import {
  SEQUENCE_ABORT_WORKBENCH_PAYLOAD_UPLOAD_TOOL_NAME,
  SEQUENCE_APPEND_WORKBENCH_PAYLOAD_CHUNK_TOOL_NAME,
  SEQUENCE_BEGIN_WORKBENCH_PAYLOAD_UPLOAD_TOOL_NAME,
  SEQUENCE_FINISH_WORKBENCH_PAYLOAD_UPLOAD_TOOL_NAME,
  SEQUENCE_GENERATE_WORKSPACE_EXPORT_TOOL_NAME,
  SEQUENCE_PERSIST_WORKBENCH_PAYLOAD_TOOL_NAME,
  SEQUENCE_PREPARE_WORKSPACE_EXPORT_TOOL_NAME,
  sequenceAbortWorkbenchPayloadUploadInputSchema,
  sequenceAppendWorkbenchPayloadChunkInputSchema,
  sequenceBeginWorkbenchPayloadUploadInputSchema,
  sequenceFinishWorkbenchPayloadUploadInputSchema,
  sequenceGenerateWorkspaceExportInputSchema,
  sequenceArtifactMetadataSchema,
  sequencePersistWorkbenchPayloadInputSchema,
  sequencePrepareWorkspaceExportInputSchema,
  sequenceSavedSessionMetadataSchema,
  type SequenceWorkbenchPayloadDeclaration,
} from "./workbench-persistence-protocol";
import { SequenceWorkspaceExportAuthorizationStore } from "./workspace-export-authorization";
import {
  SequenceWorkspaceExportPublisher,
  safeSequenceWorkspacePublicationError,
} from "./workspace-export-publisher";
import {
  SEQUENCE_CREATE_WORKSPACE_DIRECTORY_TOOL_NAME,
  SEQUENCE_LIST_WORKSPACE_DIRECTORY_TOOL_NAME,
  sequenceCreateWorkspaceDirectoryInputSchema,
  sequenceListWorkspaceDirectoryInputSchema,
} from "./workspace-browser-protocol";
import {
  safeSequenceWorkspaceSessionError,
  SequenceWorkspaceSessionManager,
} from "./workspace-session-manager";
import {
  SEQUENCE_LIST_WORKSPACE_SESSIONS_TOOL_NAME,
  SEQUENCE_RESTORE_WORKSPACE_SESSION_TOOL_NAME,
  sequenceListWorkspaceSessionsInputSchema,
  sequenceRestoreWorkspaceSessionInputSchema,
  sequenceRestoreWorkspaceSessionResultSchema,
} from "./workspace-session-protocol";
import { parseAndValidateWorkbenchSession } from "./workbench-session-validation";
import {
  safeSequenceWorkspaceTrackError,
  SequenceWorkspaceTrackBrowser,
  type ResolvedSequenceWorkspaceTrackBundle,
} from "./workspace-track-browser";
import {
  SEQUENCE_LIST_WORKSPACE_TRACK_DIRECTORY_TOOL_NAME,
  SEQUENCE_LOAD_WORKSPACE_TRACK_TOOL_NAME,
  SEQUENCE_RESOLVE_WORKSPACE_TRACK_BUNDLE_TOOL_NAME,
  sequenceListWorkspaceTrackDirectoryInputSchema,
  sequenceLoadWorkspaceTrackInputSchema,
  sequenceLoadWorkspaceTrackResultSchema,
  sequenceResolveWorkspaceTrackBundleInputSchema,
} from "./workspace-track-protocol";

const gunzip = promisify(gunzipCallback);

export const SEQUENCE_VIEWER_RESOURCE_URI = "ui://sequence-viewer/viewer";
export const SEQUENCE_VIEWER_TOOL_NAME = "sequence.open";
export const SEQUENCE_VIEWER_CHAT_TOOL_NAME = "sequence.open_from_chat";
export const SEQUENCE_VIEWER_CHAT_FILE_META_KEY = "openai/viewerFile";
export const SEQUENCE_VIEWER_CHAT_FILE_RESOURCE_URI =
  "viewer-file://sequence-viewer/opened";

export const sequenceOpenToolInputSchema = z
  .object({
    file: sequenceViewerFileSchema.optional(),
  })
  .strict();

export const sequenceOpenFromChatToolInputSchema = z.object({
  path: z
    .string()
    .trim()
    .min(1)
    .refine(isSafeWorkspacePath, "path must be a local filesystem path.")
    .describe(
      "Exact absolute path to the sequence or alignment file. A workspace-relative path works only when the MCP host exposes active roots.",
    ),
  presentation: z
    .enum(["full", "inline"])
    .optional()
    .describe(
      "Initial viewer chrome: full shows its toolbar; inline hides it until the top edge is hovered or focused. Defaults to full.",
    ),
});

export type SequenceOpenToolInput = {
  file: z.infer<typeof sequenceViewerFileSchema>;
};
export type SequenceOpenFromChatToolInput = z.infer<
  typeof sequenceOpenFromChatToolInputSchema
>;

const trustedFileViewerMetadataSchema = z
  .object({
    "openai/resource": z
      .object({
        path: z.string().min(1).max(32_768),
      })
      .passthrough(),
  })
  .passthrough();

const loadedTrackSummarySchema = z
  .object({
    kind: z.enum(["annotations", "reads", "variants"]),
    mapping: z
      .object({ status: z.enum(["matched", "unmatched", "unresolved"]) })
      .passthrough(),
    summary: z
      .object({
        itemCount: z.number().int().nonnegative(),
        truncated: z.boolean(),
      })
      .passthrough(),
  })
  .passthrough();

const modelVisibleLoadedTrackSchema = z
  .object({
    features: z.array(z.unknown()).optional(),
    kind: z.enum(["annotations", "reads", "variants"]),
    mapping: z
      .object({
        matchedReference: z.string().nullable(),
        requestedReference: z.string().nullable(),
        status: z.enum(["matched", "unmatched", "unresolved"]),
        unmatchedReferences: z.array(z.string()),
      })
      .strip(),
    reads: z.array(z.unknown()).optional(),
    summary: z
      .object({
        itemCount: z.number().int().nonnegative(),
        materializedItemCount: z.number().int().nonnegative().optional(),
        references: z.array(z.string()),
        truncated: z.boolean(),
      })
      .strip(),
    variants: z.array(z.unknown()).optional(),
    vcfHeader: z
      .object({ sampleNames: z.array(z.string()) })
      .strip()
      .optional(),
  })
  .strip();

type SequencePublicExampleLifecycleHooks = {
  afterAcquisition?: () => Promise<void> | void;
  afterBinding?: (sessionId: string) => Promise<void> | void;
  afterHandleOpen?: (sessionId: string) => Promise<void> | void;
};

export function createSequenceViewerServer({
  publicExampleAcquirer: providedPublicExampleAcquirer,
  publicExampleLifecycleHooks = {},
  recoveryBroker,
  stateDirectory,
  workbenchUploadStore: providedWorkbenchUploadStore,
  workspacePublisher: providedWorkspacePublisher,
}: {
  publicExampleAcquirer?: SequencePublicExampleAcquirer;
  publicExampleLifecycleHooks?: SequencePublicExampleLifecycleHooks;
  recoveryBroker?: {
    issueRecoveryMetadata: (input: {
      extra: RootsRequestExtra;
      family: "sequence";
      logicalSessionId: string;
      resourceUri: typeof SEQUENCE_VIEWER_RESOURCE_URI;
      viewerFile: ChatViewerFileInput;
    }) => Promise<SequenceScientificRecoveryMetadata>;
  };
  stateDirectory?: string;
  workbenchUploadStore?: SequenceWorkbenchUploadStore;
  workspacePublisher?: SequenceWorkspaceExportPublisher;
} = {}): McpServer {
  const server = new McpServer({
    name: "biological-sequence-viewer",
    version: SEQUENCE_VIEWER_VERSION,
  });
  const commandStore = new SequenceViewerCommandStore();
  const restoringViewerSessions = new Map<string, Promise<void>>();
  const chatFileResourceStore = createChatFileResourceStore({
    isSupportedFileName: isSupportedBiologicalSequenceFileName,
    maxRangedFileBytes: 8 * 1_024 * 1_024 * 1_024,
    resourceUriPrefix: SEQUENCE_VIEWER_CHAT_FILE_RESOURCE_URI,
    stateDirectory,
    viewerName: "biological sequence viewer",
  });
  chatFileResourceStore.register(server);
  const scientificPlatform = new SequencePluginScientificPlatform({
    stateDirectory,
  });
  const workbenchStore = createServerWorkbenchStore({ stateDirectory });
  workbenchStore.register(server);
  const workspacePublisher =
    providedWorkspacePublisher ?? new SequenceWorkspaceExportPublisher();
  const workspaceTrackBrowser = new SequenceWorkspaceTrackBrowser(
    workspacePublisher,
  );
  const workspaceSessionManager = new SequenceWorkspaceSessionManager(
    workspacePublisher,
  );
  const workspaceExportAuthorizations =
    new SequenceWorkspaceExportAuthorizationStore();
  const workbenchUploadStore =
    providedWorkbenchUploadStore ??
    new SequenceWorkbenchUploadStore(workbenchStore, { workspacePublisher });
  const publicExampleAcquirer =
    providedPublicExampleAcquirer ??
    new SequencePublicExampleAcquisitionStore();
  const previousOnClose = server.server.onclose;
  server.server.onclose = () => {
    try {
      previousOnClose?.();
    } finally {
      void workbenchUploadStore.dispose().catch(() => undefined);
    }
  };

  registerAppResource(
    server,
    "viewer",
    SEQUENCE_VIEWER_RESOURCE_URI,
    { mimeType: RESOURCE_MIME_TYPE },
    async () => {
      const resource = await loadSequenceViewerResource();
      return {
        contents: [
          {
            mimeType: RESOURCE_MIME_TYPE,
            text: resource.html,
            uri: SEQUENCE_VIEWER_RESOURCE_URI,
            _meta: {
              ui: {
                csp: createSequenceViewerCsp(),
              },
            },
          },
        ],
      };
    },
  );

  registerAppTool(
    server,
    SEQUENCE_DESCRIBE_SCIENTIFIC_SOURCE_TOOL_NAME,
    {
      title: "Describe authorized biological Sequence source",
      description:
        "App-only. Describe an opaque workspace-root-bound Sequence source without exposing filesystem paths or source bytes.",
      inputSchema: sequenceScientificSourceRequestSchema.shape,
      annotations: {
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
        readOnlyHint: true,
      },
      _meta: { ui: { visibility: ["app"] } },
    },
    async (input) => {
      commandStore.assertSessionActive(input.sessionId);
      return {
        content: [],
        structuredContent: scientificPlatform.describe(input),
      };
    },
  );

  registerAppTool(
    server,
    SEQUENCE_READ_SCIENTIFIC_RANGE_TOOL_NAME,
    {
      title: "Read bounded biological Sequence source range",
      description:
        "App-only. Read a source-revision-bound range through the plugin-owned scientific file service using unsigned decimal offsets and bounded transfers.",
      inputSchema: sequenceScientificRangeRequestSchema.shape,
      annotations: {
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
        readOnlyHint: true,
      },
      _meta: { ui: { visibility: ["app"] } },
    },
    async (input, extra) => {
      commandStore.assertSessionActive(input.sessionId);
      return {
        content: [],
        structuredContent: await scientificPlatform.readRange({
          ...input,
          signal: extra.signal,
        }),
      };
    },
  );

  registerAppTool(
    server,
    SEQUENCE_LIST_SCIENTIFIC_RECORDS_TOOL_NAME,
    {
      title: "List bounded biological Sequence records",
      description:
        "App-only. Page exact Sequence records from the plugin-owned source index without materializing the source or exposing local paths.",
      inputSchema: sequenceScientificRecordRequestSchema.shape,
      annotations: {
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
        readOnlyHint: true,
      },
      _meta: { ui: { visibility: ["app"] } },
    },
    async (input, extra) => {
      commandStore.assertSessionActive(input.sessionId);
      return {
        content: [],
        structuredContent: await scientificPlatform.listRecords({
          ...input,
          signal: extra.signal,
        }),
      };
    },
  );

  registerAppTool(
    server,
    SEQUENCE_READ_SCIENTIFIC_WINDOW_TOOL_NAME,
    {
      title: "Read bounded biological Sequence residue window",
      description:
        "App-only. Read exact sequence and optional FASTQ quality windows from a revision-bound plugin-owned paged source.",
      inputSchema: sequenceScientificWindowRequestSchema.shape,
      annotations: {
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
        readOnlyHint: true,
      },
      _meta: { ui: { visibility: ["app"] } },
    },
    async (input, extra) => {
      commandStore.assertSessionActive(input.sessionId);
      return {
        content: [],
        structuredContent: await scientificPlatform.readWindow({
          ...input,
          signal: extra.signal,
        }),
      };
    },
  );

  registerAppTool(
    server,
    SEQUENCE_SAVE_SCIENTIFIC_CHECKPOINT_TOOL_NAME,
    {
      title: "Save bounded biological Sequence viewer checkpoint",
      description:
        "App-only. Persist one compact source-revision-bound viewer checkpoint in owner-only plugin state.",
      inputSchema: sequenceScientificCheckpointRequestSchema.shape,
      annotations: {
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
        readOnlyHint: false,
      },
      _meta: { ui: { visibility: ["app"] } },
    },
    async (input) => {
      commandStore.assertSessionActive(input.sessionId);
      return {
        content: [],
        structuredContent: await scientificPlatform.saveCheckpoint(input),
      };
    },
  );

  registerAppTool(
    server,
    SEQUENCE_RESTORE_SCIENTIFIC_CHECKPOINT_TOOL_NAME,
    {
      title: "Restore bounded biological Sequence viewer checkpoint",
      description:
        "App-only. Restore an owner-only plugin checkpoint after verifying its existing session, family, opaque source, and source revision.",
      inputSchema: sequenceScientificSourceRequestSchema.shape,
      annotations: {
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
        readOnlyHint: true,
      },
      _meta: { ui: { visibility: ["app"] } },
    },
    async (input) => {
      commandStore.assertSessionActive(input.sessionId);
      return {
        content: [],
        structuredContent: await scientificPlatform.restoreCheckpoint(input),
      };
    },
  );

  registerAppTool(
    server,
    SEQUENCE_RESTORE_CHAT_VIEWER_SESSION_TOOL_NAME,
    {
      title: "Restore Biological Sequence Viewer Chat Session",
      description:
        "App-only. Restore the original biological viewer session only when its owner-private signed file capability authenticates the same session and unchanged active workspace source.",
      inputSchema: sequenceRestoreChatViewerSessionInputSchema.shape,
      annotations: {
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
        readOnlyHint: false,
      },
      _meta: { ui: { visibility: ["app"] } },
    },
    async (input, extra) => {
      const parsed = sequenceRestoreChatViewerSessionInputSchema.parse(input);
      const predecessor = restoringViewerSessions.get(parsed.sessionId);
      let release!: () => void;
      const operation = new Promise<void>((resolve) => {
        release = resolve;
      });
      restoringViewerSessions.set(parsed.sessionId, operation);
      await predecessor?.catch(() => undefined);
      let createdSession = false;
      try {
        extra.signal?.throwIfAborted();
        // A model-visible session UUID is not authority: the hidden URI must
        // resolve to the exact same UUID in an owner-private HMAC-signed record.
        const source = await chatFileResourceStore.resolveResource(
          parsed.resourceUri,
          parsed.sessionId,
          extra,
        );
        extra.signal?.throwIfAborted();
        let scientificSource;
        if (source.workspaceBacked) {
          if (source.workspaceRoot == null) {
            throw new Error(
              "The saved biological viewer source has no authenticated workspace root.",
            );
          }
          scientificSource = await scientificPlatform.describeOpenedSource({
            sessionId: parsed.sessionId,
            signal: extra.signal,
            sourcePath: source.sourcePath,
            workspaceRoot: source.workspaceRoot,
          });
          if (scientificSource == null) {
            scientificSource = await scientificPlatform.bindOpenedSource({
              expectedWorkspaceRoot: source.workspaceRoot,
              extra,
              sessionId: parsed.sessionId,
              sourcePath: source.sourcePath,
            });
          }
          if (scientificSource == null) {
            throw new Error(
              "The saved biological viewer source is no longer authorized in the active workspace.",
            );
          }
          if (source.rangeOnly && scientificSource.format === "unsupported") {
            throw new Error(
              "This large workspace source requires an authorized, bounded Sequence viewer session.",
            );
          }
        } else if (source.rangeOnly) {
          throw new Error(
            "This large workspace source requires an authorized, bounded Sequence viewer session.",
          );
        }
        const checkpoint =
          scientificSource == null
            ? { hasCheckpoint: false as const }
            : await scientificPlatform.restoreCheckpoint({
                sessionId: parsed.sessionId,
                sourceId: scientificSource.sourceId,
                sourceRevision: scientificSource.sourceRevision,
              });
        const restored = commandStore.restoreSession(
          parsed.sessionId,
          checkpoint.hasCheckpoint ? checkpoint.lastAcknowledgedRevision : 0,
        );
        createdSession = restored.created;
        if (source.workspaceBacked) {
          if (restored.created) {
            const bound = await workspacePublisher
              .bindSession(parsed.sessionId, source.sourcePath, extra)
              .catch(() => false);
            if (!bound) {
              throw new Error(
                "The saved biological viewer source is no longer authorized in the active workspace.",
              );
            }
          }
          const binding = await workspacePublisher.getActiveSourceBinding(
            parsed.sessionId,
            extra,
          );
          if (
            binding.rootPath !== source.workspaceRoot ||
            binding.sourcePath !== source.sourcePath
          ) {
            throw new Error(
              "The saved biological viewer source is outside its original active workspace.",
            );
          }
        }
        extra.signal?.throwIfAborted();
        const { created: _created, ...session } = restored;
        return {
          content: [],
          structuredContent: session,
          ...(scientificSource == null
            ? {}
            : {
                _meta: {
                  [SEQUENCE_PLUGIN_SCIENTIFIC_SOURCE_META_KEY]: scientificSource,
                },
              }),
        };
      } catch (error) {
        if (createdSession) {
          workspacePublisher.clearSession(parsed.sessionId);
          commandStore.closeSession(parsed.sessionId);
        }
        throw error;
      } finally {
        release();
        if (restoringViewerSessions.get(parsed.sessionId) === operation) {
          restoringViewerSessions.delete(parsed.sessionId);
        }
      }
    },
  );

  registerAppTool(
    server,
    SEQUENCE_VIEWER_TOOL_NAME,
    {
      title: "Biological Sequence & Alignment Viewer",
      description:
        "Open biological sequence artifacts, including FASTA, GenBank, EMBL, FASTQ, bounded Sanger ABIF/SCF chromatograms, supported SnapGene DNA revisions, and multiple sequence alignments, in a rich source-safe analysis and editing workbench. SnapGene support is limited to explicitly verified format revisions; unsupported revisions are rejected.",
      inputSchema: sequenceOpenToolInputSchema.shape,
      annotations: {
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
        readOnlyHint: true,
      },
      _meta: {
        ui: { resourceUri: SEQUENCE_VIEWER_RESOURCE_URI, visibility: ["app"] },
        "openai/ui": {
          entrypoints: BIOLOGICAL_SEQUENCE_FILE_ENTRYPOINTS.map(
            ({ extensions }) => ({
              extensions: [...extensions],
              type: "file" as const,
            }),
          ),
        },
      },
    },
    async (input, extra) => {
      const directInput = resolveSequenceOpenToolInput(input);
      const trustedPath = parseTrustedFileViewerMetadata(extra);
      if (trustedPath == null || !path.isAbsolute(trustedPath)) {
        return createSequenceOpenToolResult(directInput);
      }
      let allocatedSession:
        | ReturnType<SequenceViewerCommandStore["registerSession"]>
        | undefined;
      let indexedFile;
      try {
        indexedFile = await chatFileResourceStore.openIndexedWorkspaceFile(
          trustedPath,
          extra,
          undefined,
          isGzipCompressedBiologicalFileName(path.basename(trustedPath))
            ? undefined
            : () => {
                allocatedSession = commandStore.registerSession();
                return allocatedSession.sessionId;
              },
        );
      } catch (error) {
        if (allocatedSession != null) {
          commandStore.closeSession(allocatedSession.sessionId);
        }
        throw error;
      }
      if (indexedFile == null) {
        return createSequenceOpenToolResult(directInput);
      }
      const openedInput = {
        file: {
          name: indexedFile.viewerFile.primaryFile.name,
          resourceUri: indexedFile.viewerFile.primaryFile.uri,
        },
      };
      if (!indexedFile.rangeOnly && allocatedSession == null) {
        return createSequenceOpenToolResult(openedInput);
      }
      if (
        allocatedSession == null ||
        indexedFile.sessionId !== allocatedSession.sessionId
      ) {
        await indexedFile.discard?.().catch(() => undefined);
        if (allocatedSession != null) {
          commandStore.closeSession(allocatedSession.sessionId);
        }
        throw new Error("The large biological viewer session was not securely bound.");
      }
      const session = allocatedSession;
      try {
        const scientificSource = await scientificPlatform.bindOpenedSource({
          extra,
          sessionId: session.sessionId,
          sourcePath: indexedFile.sourcePath,
        });
        if (scientificSource == null || scientificSource.format === "unsupported") {
          throw new Error(
            "This large workspace source requires an authorized, bounded Sequence viewer session.",
          );
        }
        const bound = await workspacePublisher
          .bindSession(session.sessionId, indexedFile.sourcePath, extra)
          .catch(() => false);
        if (!bound) {
          throw new Error(
            "The biological viewer source is no longer authorized in the active workspace.",
          );
        }
        return {
          content: [],
          structuredContent: {
            ...openedInput,
            schemaVersion: SEQUENCE_VIEWER_SCHEMA_VERSION,
            sessionReady: true,
            viewerCommandRevision: session.revision,
            viewerReady: false,
            viewerSessionId: session.sessionId,
          },
          _meta: {
            [SEQUENCE_PLUGIN_SCIENTIFIC_SOURCE_META_KEY]: scientificSource,
            [SEQUENCE_VIEWER_CHAT_FILE_META_KEY]: indexedFile.viewerFile,
          },
        };
      } catch (error) {
        await indexedFile.discard?.().catch(() => undefined);
        workspacePublisher.clearSession(session.sessionId);
        commandStore.closeSession(session.sessionId);
        throw error;
      }
    },
  );

  registerAppTool(
    server,
    SEQUENCE_VIEWER_CONTROL_TOOL_NAME,
    {
      title: "Control Biological Sequence & Alignment Viewer",
      description:
        "Control the active Biological Sequence & Alignment Viewer. Always pass sessionId and action, never viewerSessionId or command. Sequence actions: clear_sequence_selection, focus_sequence_coordinate, navigate_sequence_search_hit, navigate_sequence_feature, search_sequence, select_sequence_feature, select_sequence_range, set_sequence_record, set_sequence_record_browser, set_sequence_annotation_index, and set_sequence_view_options. select_sequence_range supports wraparound=true for a circular start-through-origin-to-end range. set_sequence_view_options controls palette, wrap, features/quality/translation, genetic code, linear/circular/split layout, orientation, origin-range controls, and view synchronization. select_sequence_feature accepts an exact feature ID or a unique case-insensitive biological type, label, or qualifier value; ambiguous matches return exact candidate IDs. Quality controls: set_quality_view_options controls report distributions, methods, and the exact expandedTables IDs. Read controls: set_read_pileup_options shares UI filters and display options (MAPQ255 is unknown, so a strict threshold also sets includeUnknownMappingQuality:false); select_read uses exact trackId plus zero-based sourceReadIndex, and clear_read_selection clears it. Trace controls: set_chromatogram_view_options sets firstBase and basesPerWindow (1–100 source bases). Alignment actions: clear_alignment_selection, compute_alignment_guide_tree, filter_alignment_rows, focus_alignment_cell, focus_alignment_reference_coordinate, navigate_alignment_search_hit, reset_alignment_view, search_alignment, select_alignment_columns, select_alignment_rows, set_alignment_reference, set_alignment_row_visibility, set_alignment_view_options, and show_all_alignment_rows. set_alignment_view_options also controls enabledMetricTracks, sequence-logo help, and row-manager sorting; row-manager sorting does not reorder the matrix. focus_alignment_cell uses singular row; set_alignment_row_visibility always requires the rows array, even for one row. select_alignment_rows accepts an empty rows list to clear the selection. Feedback control: dismiss_workbench_feedback takes a registered feedbackId from query target workbench-feedback and dismisses only copy feedback or session errors, never approvals or source-write confirmation. Shared actions: set_display_mode, set_mode, set_toolbar_visibility, and set_workbench_panel. set_workbench_disclosure uses an exact disclosureId from query target workbench-disclosures and expanded:true or false, revealing parent sections when expanded. set_workbench_panel takes group (sequence-tools, sequence-display, or alignment-tools) and panel (an available ID, or null to close); query workbench-panels to discover current choices. Panel/mode changes cannot hide pending user approvals or copy feedback and return applied:false if blocked. set_toolbar_visibility requires visible:true or visible:false and changes toolbar chrome without moving the viewer between chat and the side pane. Call this tool directly from the conversation that contains the mounted viewer; do not delegate live-viewer control to a subagent and do not use browser or DevTools automation. Biological coordinates are 1-based; browser pages and sourceReadIndex are zero-based.",
      inputSchema: sequenceViewerControlToolInputSchema.strict(),
      annotations: {
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
        readOnlyHint: true,
      },
      _meta: { ui: { visibility: ["model"] } },
    },
    async (input) => {
      const parsedInput = sequenceViewerControlInputSchema.parse(input);
      const command = createSequenceViewerCommand(parsedInput);
      const result = await commandStore.enqueue(parsedInput.sessionId, command);
      return {
        content: [{ type: "text", text: result.message }],
        structuredContent: result,
      };
    },
  );

  registerAppTool(
    server,
    SEQUENCE_VIEWER_QUERY_TOOL_NAME,
    {
      title: "Query Biological Sequence Viewer",
      description:
        "Query the active viewer's records, features, coordinate ranges, quality, FASTQ summary metrics, alignment rows or columns, conservation metrics, search hits, tracks, tree nodes, jobs, artifacts, variants, coverage, or reads. Also query workbench-panels (mounted choices/open/blocked state), workbench-disclosures (up to 100 registered nested sections per page), workbench-feedback (registered copy or session-error dismissal choices, not user approvals), sequence-ui-state, read-pileup-state, quality-report (latest applied bounded QC report), read-detail (exact trackId plus zero-based sourceReadIndex), and chromatogram (start/end of at most 100 source bases, exact A/C/G/T samples paged at up to 500 per response with peak/base-call/quality semantics). Trace queries never return an entire binary blob or imply unverified Phred quality. Read and coverage queries use the same active read filters as the UI and disclose loaded-window completeness. Feature pages may be filtered by an exact biological identifier or annotation fragment with query. Use this whenever live model context is truncated; page limits are at most 500, cursors are target/window-specific, and coordinates are validated.",
      inputSchema: sequenceViewerQueryInputSchema.shape,
      annotations: {
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
        readOnlyHint: true,
      },
      _meta: { ui: { visibility: ["model"] } },
    },
    async (input) => {
      const parsed = sequenceViewerQueryInputSchema.parse(input);
      const { sessionId, ...candidate } = parsed;
      const request = sequenceViewerQueryRequestSchema.parse(candidate);
      const completion = await commandStore.enqueue(sessionId, {
        action: "query_viewer",
        request,
      });
      return operationToolResult(completion, completion.state?.query);
    },
  );

  registerAppTool(
    server,
    SEQUENCE_VIEWER_ANALYSIS_TOOL_NAME,
    {
      title: "Analyze Biological Sequence or Alignment",
      description:
        "Run a deterministic viewer analysis using the current live artifact: statistics, genetic-code-aware translation, ORFs, restriction sites and digest, primer candidates, distance matrix, exploratory NJ/UPGMA tree, or quality-report. quality-report analyzes the document's bounded retained FASTQ subset and optionally screens an explicit adapterSequence of 8–64 A/C/G/T bases; do not pass record for document-level QC. Its coverage, sampling bounds, source assumptions, and adapter evidence are reported separately from whole-file totals. Analyses are bounded, provenance-bearing jobs and never overwrite the source.",
      inputSchema: sequenceViewerAnalysisInputSchema.shape,
      annotations: {
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
        readOnlyHint: true,
      },
      _meta: { ui: { visibility: ["model"] } },
    },
    async (input) => {
      const parsed = sequenceViewerAnalysisInputSchema.parse(input);
      const { sessionId, ...candidate } = parsed;
      const request = sequenceViewerAnalysisRequestSchema.parse(candidate);
      const completion = await commandStore.enqueue(sessionId, {
        action: "run_analysis",
        jobId: randomUUID(),
        request,
      });
      return operationToolResult(completion, completion.state?.job);
    },
  );

  registerAppTool(
    server,
    SEQUENCE_VIEWER_ALIGN_TOOL_NAME,
    {
      title: "Align Sequences in the Viewer",
      description:
        "Create a new exploratory pairwise or center-star alignment from exact sequence record IDs or alignment row IDs in the mounted viewer. The operation is cancellable, source-safe, and produces a derived alignment artifact with engine provenance.",
      inputSchema: sequenceViewerAlignInputSchema.shape,
      annotations: {
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
        readOnlyHint: false,
      },
      _meta: { ui: { visibility: ["model"] } },
    },
    async (input) => {
      const { algorithm, sessionId, recordIds, rowIds } =
        sequenceViewerAlignInputSchema.parse(input);
      const completion = await commandStore.enqueue(sessionId, {
        action: "align_sequences",
        algorithm,
        jobId: randomUUID(),
        recordIds,
        rowIds,
      });
      return operationToolResult(completion, completion.state?.job);
    },
  );

  registerAppTool(
    server,
    SEQUENCE_VIEWER_EDIT_TOOL_NAME,
    {
      title: "Edit a Biological Sequence or Alignment Copy",
      description:
        "Apply typed insert, delete, replace, reverse-complement, circular rotation, gap, trim, row grouping, sort, undo, or redo operations to an in-memory copy in the mounted viewer. Source files are never overwritten; export the derived copy explicitly when ready.",
      inputSchema: sequenceViewerEditInputSchema.shape,
      annotations: {
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
        readOnlyHint: false,
      },
      _meta: { ui: { visibility: ["model"] } },
    },
    async (input) => {
      const parsed = sequenceViewerEditInputSchema.parse(input);
      const { sessionId, ...candidate } = parsed;
      const request = sequenceViewerEditRequestSchema.parse(candidate);
      const completion = await commandStore.enqueue(sessionId, {
        action: "edit_copy",
        request,
      });
      return operationToolResult(completion, completion.state);
    },
  );

  registerAppTool(
    server,
    SEQUENCE_VIEWER_ANNOTATIONS_TOOL_NAME,
    {
      title: "Manage Viewer Annotations",
      description:
        "Add, update, delete, or import annotations on the active in-memory sequence copy. Coordinates are 1-based inclusive and imports retain track provenance; the original file is not modified.",
      inputSchema: sequenceViewerAnnotationsInputSchema.shape,
      annotations: {
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
        readOnlyHint: false,
      },
      _meta: { ui: { visibility: ["model"] } },
    },
    async (input) => {
      const parsed = sequenceViewerAnnotationsInputSchema.parse(input);
      const { sessionId, ...request } = parsed;
      const completion = await commandStore.enqueue(sessionId, {
        action: "manage_annotations",
        request,
      });
      return operationToolResult(completion, completion.state);
    },
  );

  registerAppTool(
    server,
    SEQUENCE_VIEWER_LOAD_TRACK_TOOL_NAME,
    {
      title: "Load an Annotation or Evidence Track",
      description:
        "Attach a local GFF3, GTF, BED, VCF, SAM, BAM, or CRAM annotation/evidence track to the mounted viewer with explicit reference mapping diagnostics. BAM uses a BAI/CSI index (default path+.bai). CRAM uses a CRAI index (default path+.crai) and usually a matching reference FASTA. Pass an exact contig when ambiguous and a bounded 1-based inclusive regional window. Read views disclose downsampling.",
      inputSchema: sequenceViewerLoadTrackInputSchema.shape,
      annotations: {
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
        readOnlyHint: true,
      },
      _meta: { ui: { visibility: ["model"] } },
    },
    async (input, extra) => {
      const parsed = sequenceViewerLoadTrackInputSchema.parse(input);
      const { bytes, name } = await readWorkspaceFileBytes({
        extra,
        filePath: parsed.path,
        isSupportedFileName: (fileName) =>
          isSupportedTrackFileName(fileName, parsed.format),
        maxFileBytes: 100 * 1_024 * 1_024,
        viewerName: "biological sequence viewer track loader",
      });
      let index:
        | { bytes: Uint8Array; format: "bai" | "crai" | "csi"; name: string }
        | undefined;
      let referenceFile: { bytes: Uint8Array; name: string } | undefined;
      if (parsed.format === "bam") {
        const loadedIndex = await readWorkspaceFileBytes({
          extra,
          filePath: parsed.indexPath ?? `${parsed.path}.bai`,
          isSupportedFileName: (fileName) => /\.(?:bai|csi)$/iu.test(fileName),
          maxFileBytes: 64 * 1_024 * 1_024,
          viewerName: "biological sequence viewer BAM index loader",
        });
        index = {
          ...loadedIndex,
          format: loadedIndex.name.toLowerCase().endsWith(".csi")
            ? "csi"
            : "bai",
        };
      } else if (parsed.format === "cram") {
        const loadedIndex = await readWorkspaceFileBytes({
          extra,
          filePath: parsed.indexPath ?? `${parsed.path}.crai`,
          isSupportedFileName: (fileName) =>
            fileName.toLowerCase().endsWith(".crai"),
          maxFileBytes: 16 * 1_024 * 1_024,
          viewerName: "biological sequence viewer CRAM index loader",
        });
        index = { ...loadedIndex, format: "crai" };
        referenceFile =
          parsed.referencePath == null
            ? undefined
            : await readWorkspaceFileBytes({
                extra,
                filePath: parsed.referencePath,
                isSupportedFileName: isSupportedReferenceFileName,
                maxFileBytes: 100 * 1_024 * 1_024,
                viewerName: "biological sequence viewer CRAM reference loader",
              });
      }
      const prepared = await prepareTrackCommandContent({
        end: parsed.end,
        format: parsed.format,
        index,
        primary: { bytes, name },
        reference: parsed.reference,
        referenceFile,
        signal: extra.signal,
        start: parsed.start,
      });
      const trackId = randomUUID();
      const completion = await commandStore.enqueue(parsed.sessionId, {
        action: "load_track",
        content: prepared.content,
        displayName: name,
        encoding: "utf8",
        format: parsed.format,
        reference: prepared.resolvedReference,
        sourceItemCount: prepared.sourceItemCount,
        sourceTruncated: prepared.sourceTruncated,
        trackId,
      });
      const modelVisibleCompletion = {
        applied: completion.applied,
        message: completion.message,
      };
      if (!completion.applied)
        return operationToolResult(modelVisibleCompletion);
      return operationToolResult(
        modelVisibleCompletion,
        modelVisibleLoadedTrackSummary(completion.state?.track, {
          format: parsed.format,
          name,
          trackId,
        }),
      );
    },
  );

  registerAppTool(
    server,
    SEQUENCE_VIEWER_EXPORT_TOOL_NAME,
    {
      title: "Export Viewer Artifact",
      description:
        "Persist the active full, visible, or selected biological data, annotations, table, figure, tree, or JSON copy as a bounded derived artifact. Private persistence is the default. A source-relative workspace destination is create-new only, requires trusted host source context inside an active root, and returns compact relative metadata; it never overwrites the source.",
      inputSchema: sequenceViewerExportInputSchema.shape,
      annotations: {
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
        readOnlyHint: false,
      },
      _meta: { ui: { visibility: ["model"] } },
    },
    async (input) => {
      const parsed = sequenceViewerExportInputSchema.parse(input);
      const completion = await commandStore.enqueue(
        parsed.sessionId,
        {
          action: "export_artifact",
          destination: parsed.destination,
          format: parsed.format,
          name: parsed.name,
          scope: parsed.scope,
        },
        SEQUENCE_VIEWER_LIMITS.persistence.commandTimeoutMs,
      );
      if (!completion.applied) return operationToolResult(completion);
      const persisted = sequenceArtifactMetadataSchema.parse(
        completion.state?.artifact,
      );
      return operationToolResult(completion, {
        ...persisted,
        provenance: completion.state?.provenance ?? null,
      });
    },
  );

  registerAppTool(
    server,
    SEQUENCE_VIEWER_SAVE_SESSION_TOOL_NAME,
    {
      title: "Save Biological Sequence Viewer Session",
      description:
        "Save the mounted viewer's mode, view state, selection, tracks, analyses, edit-copy state, and derived-artifact lineage as a bounded versioned session.",
      inputSchema: sequenceViewerSaveSessionInputSchema.shape,
      annotations: {
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
        readOnlyHint: false,
      },
      _meta: { ui: { visibility: ["model"] } },
    },
    async (input) => {
      const parsed = sequenceViewerSaveSessionInputSchema.parse(input);
      const completion = await commandStore.enqueue(
        parsed.sessionId,
        {
          action: "save_session",
          name: parsed.name ?? "sequence-viewer.session.json",
        },
        SEQUENCE_VIEWER_LIMITS.persistence.commandTimeoutMs,
      );
      if (!completion.applied) return operationToolResult(completion);
      const saved = sequenceSavedSessionMetadataSchema.parse(
        completion.state?.session,
      );
      return operationToolResult(completion, {
        savedSessionId: saved.savedSessionId,
        name: saved.name,
        sha256: saved.sha256,
        size: saved.size,
      });
    },
  );

  registerAppTool(
    server,
    SEQUENCE_VIEWER_RESTORE_SESSION_TOOL_NAME,
    {
      title: "Restore Biological Sequence Viewer Session",
      description:
        "Restore a compatible saved workbench session into the currently mounted viewer. Source identity remains authoritative; missing resources or incompatible versions are reported rather than guessed.",
      inputSchema: sequenceViewerRestoreSessionInputSchema.shape,
      annotations: {
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
        readOnlyHint: false,
      },
      _meta: { ui: { visibility: ["model"] } },
    },
    async (input) => {
      const parsed = sequenceViewerRestoreSessionInputSchema.parse(input);
      const session = await workbenchStore.readSession(parsed.savedSessionId);
      const mode = parseAndValidateWorkbenchSession(session).view.mode;
      const completion = await commandStore.enqueue(parsed.sessionId, {
        action: "restore_session",
        mode,
        session,
      });
      return operationToolResult(completion, completion.state);
    },
  );

  registerAppTool(
    server,
    SEQUENCE_VIEWER_CANCEL_JOB_TOOL_NAME,
    {
      title: "Cancel Biological Sequence Viewer Job",
      description:
        "Cancel an active viewer analysis or alignment job by exact job ID. Completed or unknown jobs are left unchanged and reported explicitly.",
      inputSchema: sequenceViewerCancelJobInputSchema.shape,
      annotations: {
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
        readOnlyHint: false,
      },
      _meta: { ui: { visibility: ["model"] } },
    },
    async (input) => {
      const parsed = sequenceViewerCancelJobInputSchema.parse(input);
      const completion = await commandStore.enqueue(parsed.sessionId, {
        action: "cancel_job",
        jobId: parsed.jobId,
      });
      return operationToolResult(completion, completion.state);
    },
  );

  registerAppTool(
    server,
    SEQUENCE_VIEWER_REGISTER_SESSION_TOOL_NAME,
    {
      title: "Register Biological Sequence Viewer Session",
      description: "App-only. Register a mounted biological sequence viewer.",
      inputSchema: {},
      annotations: {
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
        readOnlyHint: false,
      },
      _meta: { ui: { visibility: ["app"] } },
    },
    async (_input, extra) => {
      const session = commandStore.registerSession();
      const trustedPath = parseTrustedFileViewerMetadata(extra);
      let scientificSource;
      if (trustedPath != null) {
        await workspacePublisher
          .bindSession(session.sessionId, trustedPath, extra)
          .catch(() => false);
        if (path.isAbsolute(trustedPath)) {
          scientificSource = await scientificPlatform.bindOpenedSource({
            extra,
            sessionId: session.sessionId,
            sourcePath: trustedPath,
          });
        }
      } else {
        workspacePublisher.clearSession(session.sessionId);
      }
      return {
        content: [],
        structuredContent: session,
        ...(scientificSource == null
          ? {}
          : {
              _meta: {
                [SEQUENCE_PLUGIN_SCIENTIFIC_SOURCE_META_KEY]: scientificSource,
              },
            }),
      };
    },
  );

  registerAppTool(
    server,
    SEQUENCE_VIEWER_WAIT_FOR_COMMAND_TOOL_NAME,
    {
      title: "Wait For Biological Sequence Viewer Command",
      description:
        "App-only. Long-poll for the next command addressed to this mounted viewer.",
      inputSchema: sequenceViewerWaitForCommandInputSchema.shape,
      annotations: {
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
        readOnlyHint: true,
      },
      _meta: { ui: { visibility: ["app"] } },
    },
    async (input) => {
      const parsedInput = sequenceViewerWaitForCommandInputSchema.parse(input);
      const command = await commandStore.waitForCommand(
        parsedInput.sessionId,
        parsedInput.afterRevision,
        parsedInput.timeoutMs,
      );
      return {
        content: [],
        structuredContent: { command },
      };
    },
  );

  registerAppTool(
    server,
    SEQUENCE_VIEWER_COMPLETE_COMMAND_TOOL_NAME,
    {
      title: "Complete Biological Sequence Viewer Command",
      description:
        "App-only. Acknowledge that the mounted viewer applied a command.",
      inputSchema: sequenceViewerCompleteCommandInputSchema.shape,
      annotations: {
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
        readOnlyHint: false,
      },
      _meta: { ui: { visibility: ["app"] } },
    },
    async (input) => {
      const parsedInput = sequenceViewerCompleteCommandInputSchema.parse(input);
      const completion = commandStore.complete(
        parsedInput.sessionId,
        parsedInput.commandId,
        {
          applied: parsedInput.applied,
          message: parsedInput.message,
          state: parsedInput.state,
        },
      );
      return {
        content: [],
        structuredContent: {
          completed: completion !== "late",
          duplicate: completion === "duplicate",
          late: completion === "late",
        },
      };
    },
  );

  registerAppTool(
    server,
    SEQUENCE_LIST_WORKSPACE_TRACK_DIRECTORY_TOOL_NAME,
    {
      title: "List Biological Sequence Workspace Tracks",
      description:
        "App-only. List one bounded source-bound workspace directory using opaque candidate IDs and safe relative labels.",
      inputSchema: sequenceListWorkspaceTrackDirectoryInputSchema.shape,
      annotations: {
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
        readOnlyHint: true,
      },
      _meta: { ui: { visibility: ["app"] } },
    },
    async (input, extra) => {
      const parsed =
        sequenceListWorkspaceTrackDirectoryInputSchema.parse(input);
      commandStore.assertSessionActive(parsed.sessionId);
      try {
        return {
          content: [],
          structuredContent: await workspaceTrackBrowser.listDirectory(
            parsed,
            extra,
          ),
        };
      } catch (error) {
        throw safeSequenceWorkspaceTrackError(error);
      }
    },
  );

  registerAppTool(
    server,
    SEQUENCE_RESOLVE_WORKSPACE_TRACK_BUNDLE_TOOL_NAME,
    {
      title: "Resolve Biological Sequence Workspace Track Bundle",
      description:
        "App-only. Resolve one selected evidence file and explicit or unambiguous index/reference companions into an expiring opaque bundle.",
      inputSchema: sequenceResolveWorkspaceTrackBundleInputSchema.shape,
      annotations: {
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
        readOnlyHint: true,
      },
      _meta: { ui: { visibility: ["app"] } },
    },
    async (input, extra) => {
      const parsed =
        sequenceResolveWorkspaceTrackBundleInputSchema.parse(input);
      commandStore.assertSessionActive(parsed.sessionId);
      try {
        return {
          content: [],
          structuredContent: await workspaceTrackBrowser.resolveBundle(
            parsed,
            extra,
          ),
        };
      } catch (error) {
        throw safeSequenceWorkspaceTrackError(error);
      }
    },
  );

  registerAppTool(
    server,
    SEQUENCE_LOAD_WORKSPACE_TRACK_TOOL_NAME,
    {
      title: "Load Biological Sequence Workspace Track Bundle",
      description:
        "App-only. Revalidate and load a confirmed source-bound workspace track bundle through the viewer's existing bounded track command pipeline.",
      inputSchema: sequenceLoadWorkspaceTrackInputSchema.shape,
      annotations: {
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
        readOnlyHint: false,
      },
      _meta: { ui: { visibility: ["app"] } },
    },
    async (input, extra) => {
      const parsed = sequenceLoadWorkspaceTrackInputSchema.parse(input);
      commandStore.assertSessionActive(parsed.sessionId);
      try {
        const bundle = await workspaceTrackBrowser.readBundle(
          parsed.bundleId,
          parsed.sessionId,
          extra.signal,
          extra,
        );
        if (
          (bundle.format === "bam" || bundle.format === "cram") &&
          (parsed.reference == null ||
            parsed.start == null ||
            parsed.end == null)
        ) {
          throw new Error(
            "Workspace BAM and CRAM tracks require an explicit contig and bounded start/end window.",
          );
        }
        const prepared = await prepareTrackCommandContent({
          end: parsed.end,
          format: bundle.format,
          index: bundle.index,
          primary: bundle.primary,
          reference: parsed.reference,
          referenceFile: bundle.reference,
          signal: extra.signal,
          start: parsed.start,
        });
        const completion = await commandStore.enqueue(parsed.sessionId, {
          action: "load_track",
          content: prepared.content,
          displayName: bundle.primary.name,
          encoding: "utf8",
          format: bundle.format,
          reference: prepared.resolvedReference,
          sourceContentHash: bundle.primary.sha256,
          sourceItemCount: prepared.sourceItemCount,
          sourceTruncated: prepared.sourceTruncated,
          sourceWorkspacePath: bundle.primary.workspacePath,
          trackId: randomUUID(),
        });
        if (!completion.applied) throw new Error(completion.message);
        const track = loadedTrackSummarySchema.parse(completion.state?.track);
        return {
          content: [],
          structuredContent: sequenceLoadWorkspaceTrackResultSchema.parse({
            format: bundle.format,
            itemCount: track.summary.itemCount,
            kind: track.kind,
            loaded: true,
            mappingStatus: track.mapping.status,
            name: bundle.primary.name,
            sha256: bundle.primary.sha256,
            sourceTruncated: track.summary.truncated,
            sourceWorkspacePath: bundle.primary.workspacePath,
          }),
        };
      } catch (error) {
        throw safeSequenceWorkspaceTrackError(error);
      }
    },
  );

  registerAppTool(
    server,
    SEQUENCE_LIST_WORKSPACE_SESSIONS_TOOL_NAME,
    {
      title: "Discover Biological Sequence Workspace Sessions",
      description:
        "App-only. Discover a bounded set of compatible durable sessions adjacent to the trusted opened source.",
      inputSchema: sequenceListWorkspaceSessionsInputSchema.shape,
      annotations: {
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
        readOnlyHint: true,
      },
      _meta: { ui: { visibility: ["app"] } },
    },
    async (input, extra) => {
      const parsed = sequenceListWorkspaceSessionsInputSchema.parse(input);
      commandStore.assertSessionActive(parsed.sessionId);
      try {
        return {
          content: [],
          structuredContent: await workspaceSessionManager.list(parsed, extra),
        };
      } catch (error) {
        throw safeSequenceWorkspaceSessionError(error);
      }
    },
  );

  registerAppTool(
    server,
    SEQUENCE_RESTORE_WORKSPACE_SESSION_TOOL_NAME,
    {
      title: "Restore Biological Sequence Workspace Session",
      description:
        "App-only. Revalidate an explicitly confirmed durable workspace session and restore it through the existing viewer command path.",
      inputSchema: sequenceRestoreWorkspaceSessionInputSchema.shape,
      annotations: {
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
        readOnlyHint: false,
      },
      _meta: { ui: { visibility: ["app"] } },
    },
    async (input, extra) => {
      const parsed = sequenceRestoreWorkspaceSessionInputSchema.parse(input);
      commandStore.assertSessionActive(parsed.sessionId);
      try {
        const resolved = await workspaceSessionManager.resolve(
          parsed.candidateId,
          parsed.sessionId,
          extra.signal,
          extra,
        );
        const completion = await commandStore.enqueue(parsed.sessionId, {
          action: "restore_session",
          mode: resolved.mode,
          session: resolved.payload,
        });
        if (!completion.applied) throw new Error(completion.message);
        return {
          content: [],
          structuredContent: sequenceRestoreWorkspaceSessionResultSchema.parse({
            dependencies: resolved.dependencies,
            mode: resolved.mode,
            name: resolved.name,
            restored: true,
            workspacePath: resolved.workspacePath,
          }),
        };
      } catch (error) {
        throw safeSequenceWorkspaceSessionError(error);
      }
    },
  );

  registerAppTool(
    server,
    SEQUENCE_LIST_WORKSPACE_DIRECTORY_TOOL_NAME,
    {
      title: "List Biological Sequence Workspace Export Directory",
      description:
        "App-only. List one bounded source-relative workspace directory and inspect a create-new export name without exposing host paths.",
      inputSchema: sequenceListWorkspaceDirectoryInputSchema.shape,
      annotations: {
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
        readOnlyHint: true,
      },
      _meta: { ui: { visibility: ["app"] } },
    },
    async (input, extra) => {
      const parsed = sequenceListWorkspaceDirectoryInputSchema.parse(input);
      commandStore.assertSessionActive(parsed.sessionId);
      try {
        return {
          content: [],
          structuredContent: await workspacePublisher.listDirectory(
            parsed,
            extra,
          ),
        };
      } catch (error) {
        throw safeSequenceWorkspacePublicationError(error);
      }
    },
  );

  registerAppTool(
    server,
    SEQUENCE_CREATE_WORKSPACE_DIRECTORY_TOOL_NAME,
    {
      title: "Create Biological Sequence Workspace Export Directory",
      description:
        "App-only. Exclusively create one validated child directory inside the source-bound workspace root.",
      inputSchema: sequenceCreateWorkspaceDirectoryInputSchema.shape,
      annotations: {
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
        readOnlyHint: false,
      },
      _meta: { ui: { visibility: ["app"] } },
    },
    async (input, extra) => {
      const parsed = sequenceCreateWorkspaceDirectoryInputSchema.parse(input);
      commandStore.assertSessionActive(parsed.sessionId);
      try {
        return {
          content: [],
          structuredContent: await workspacePublisher.createDirectory(
            parsed,
            extra,
          ),
        };
      } catch (error) {
        throw safeSequenceWorkspacePublicationError(error);
      }
    },
  );

  registerAppTool(
    server,
    SEQUENCE_PREPARE_WORKSPACE_EXPORT_TOOL_NAME,
    {
      title: "Prepare Biological Sequence Workspace Export",
      description:
        "App-only. Validate a source-bound create-new workspace destination before reusing the bounded workbench upload transport.",
      inputSchema: sequencePrepareWorkspaceExportInputSchema.shape,
      annotations: {
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
        readOnlyHint: false,
      },
      _meta: { ui: { visibility: ["app"] } },
    },
    async (input, extra) => {
      const parsed = sequencePrepareWorkspaceExportInputSchema.parse(input);
      commandStore.assertSessionActive(parsed.sessionId);
      let bindingId: string;
      try {
        bindingId = await workspacePublisher.preflight(parsed, extra);
      } catch (error) {
        throw safeSequenceWorkspacePublicationError(error);
      }
      return {
        content: [],
        structuredContent: {
          commandId: workspaceExportAuthorizations.create(parsed, bindingId),
          destination: { base: "opened-source", kind: "workspace" },
          maxWorkspaceArtifactBytes:
            workbenchUploadStore.workspaceArtifactLimit,
        },
      };
    },
  );

  registerAppTool(
    server,
    SEQUENCE_GENERATE_WORKSPACE_EXPORT_TOOL_NAME,
    {
      title: "Generate Biological Sequence Workspace Export",
      description:
        "App-only. Generate a canonical export directly from the trusted opened workspace source using destination-local bounded staging.",
      inputSchema: sequenceGenerateWorkspaceExportInputSchema.shape,
      annotations: {
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
        readOnlyHint: false,
      },
      _meta: { ui: { visibility: ["app"] } },
    },
    async (input, extra) => {
      const parsed = sequenceGenerateWorkspaceExportInputSchema.parse(input);
      commandStore.assertSessionActive(parsed.sessionId);
      return {
        content: [],
        structuredContent: await workbenchUploadStore.generateWorkspaceExport(
          parsed,
          extra,
          extra.signal,
        ),
      };
    },
  );

  registerAppTool(
    server,
    SEQUENCE_PERSIST_WORKBENCH_PAYLOAD_TOOL_NAME,
    {
      title: "Persist Biological Sequence Workbench Payload",
      description:
        "App-only. Idempotently persist one proxy-safe generated artifact to its authorized private or workspace sink, or save a private session.",
      inputSchema: sequencePersistWorkbenchPayloadInputSchema.shape,
      annotations: {
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
        readOnlyHint: false,
      },
      _meta: { ui: { visibility: ["app"] } },
    },
    async (input, extra) => {
      const parsed = sequencePersistWorkbenchPayloadInputSchema.parse(input);
      await assertPendingPersistenceCommand(
        commandStore,
        workspaceExportAuthorizations,
        workspacePublisher,
        parsed,
        extra,
      );
      const result = await workbenchUploadStore.persistOneShot(parsed, extra);
      workspaceExportAuthorizations.consumeIfPresent(parsed);
      return {
        content: [],
        structuredContent: result,
      };
    },
  );

  registerAppTool(
    server,
    SEQUENCE_BEGIN_WORKBENCH_PAYLOAD_UPLOAD_TOOL_NAME,
    {
      title: "Begin Biological Sequence Workbench Payload Upload",
      description:
        "App-only. Begin a bounded artifact or session upload bound to one active viewer command without reserving its declared workspace size.",
      inputSchema: sequenceBeginWorkbenchPayloadUploadInputSchema.shape,
      annotations: {
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
        readOnlyHint: false,
      },
      _meta: { ui: { visibility: ["app"] } },
    },
    async (input, extra) => {
      const parsed =
        sequenceBeginWorkbenchPayloadUploadInputSchema.parse(input);
      await assertPendingPersistenceCommand(
        commandStore,
        workspaceExportAuthorizations,
        workspacePublisher,
        parsed,
        extra,
      );
      return {
        content: [],
        structuredContent: await workbenchUploadStore.begin(parsed, extra),
      };
    },
  );

  registerAppTool(
    server,
    SEQUENCE_APPEND_WORKBENCH_PAYLOAD_CHUNK_TOOL_NAME,
    {
      title: "Append Biological Sequence Workbench Payload Chunk",
      description:
        "App-only. Idempotently append one bounded chunk at the server-authoritative offset.",
      inputSchema: sequenceAppendWorkbenchPayloadChunkInputSchema.shape,
      annotations: {
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
        readOnlyHint: false,
      },
      _meta: { ui: { visibility: ["app"] } },
    },
    async (input, extra) => {
      const parsed =
        sequenceAppendWorkbenchPayloadChunkInputSchema.parse(input);
      await assertPendingPersistenceCommandIdentity(
        commandStore,
        workspaceExportAuthorizations,
        workspacePublisher,
        parsed,
        extra,
      );
      return {
        content: [],
        structuredContent: await workbenchUploadStore.append(parsed, extra),
      };
    },
  );

  registerAppTool(
    server,
    SEQUENCE_FINISH_WORKBENCH_PAYLOAD_UPLOAD_TOOL_NAME,
    {
      title: "Finish Biological Sequence Workbench Payload Upload",
      description:
        "App-only. Validate length, digest, format, and content before committing to the authorized private or workspace sink.",
      inputSchema: sequenceFinishWorkbenchPayloadUploadInputSchema.shape,
      annotations: {
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
        readOnlyHint: false,
      },
      _meta: { ui: { visibility: ["app"] } },
    },
    async (input, extra) => {
      const parsed =
        sequenceFinishWorkbenchPayloadUploadInputSchema.parse(input);
      await assertPendingPersistenceCommandIdentity(
        commandStore,
        workspaceExportAuthorizations,
        workspacePublisher,
        parsed,
        extra,
      );
      const result = await workbenchUploadStore.finish(parsed, extra);
      workspaceExportAuthorizations.consumeIfPresent(parsed);
      return {
        content: [],
        structuredContent: result,
      };
    },
  );

  registerAppTool(
    server,
    SEQUENCE_ABORT_WORKBENCH_PAYLOAD_UPLOAD_TOOL_NAME,
    {
      title: "Abort Biological Sequence Workbench Payload Upload",
      description:
        "App-only. Cancel and clean up an unfinished workbench upload, or report the authoritative committed result.",
      inputSchema: sequenceAbortWorkbenchPayloadUploadInputSchema.shape,
      annotations: {
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: false,
        readOnlyHint: false,
      },
      _meta: { ui: { visibility: ["app"] } },
    },
    async (input, extra) => {
      const parsed =
        sequenceAbortWorkbenchPayloadUploadInputSchema.parse(input);
      assertPersistenceCommandIdentityForAbort(
        commandStore,
        workspaceExportAuthorizations,
        parsed,
      );
      const result = await workbenchUploadStore.abort(parsed, extra);
      workspaceExportAuthorizations.consumeIfPresent(parsed);
      return { content: [], structuredContent: result };
    },
  );

  registerAppTool(
    server,
    SEQUENCE_VIEWER_CHAT_TOOL_NAME,
    {
      title: "Open Biological Sequence & Alignment Viewer from chat",
      description:
        "Open a supported local biological sequence or alignment file in an inline viewer. Use the exact absolute file path whenever available. For marketplace starters, first follow the Biological Sequence & Alignment Viewer skill to fetch and validate the pinned official source using Codex's authorized network and workspace tools, then call this tool exactly once with the validated absolute local path. This route does not require the plugin host to expose MCP workspace roots. Optional presentation:'full' shows viewer controls by default; presentation:'inline' initially hides the toolbar until the top edge is hovered or focused. The result structuredContent includes viewerSessionId; for same-turn follow-up actions, pass that ID directly to sequence.control_viewer without waiting for later model context. Success confirms session creation, not rendering: report that the viewer is opening until live viewer context or an acknowledged action confirms readiness. Tell the user to click or expand the embedded Sequence open from chat tool card and that they can use Open in side pane or ask you to move or control the same live viewer. Do not repeat or format the file name or path in the user-facing response; it is not the opening action.",
      inputSchema: sequenceOpenFromChatToolInputSchema.shape,
      annotations: {
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
        readOnlyHint: true,
      },
      _meta: {
        ui: {
          resourceUri: SEQUENCE_VIEWER_RESOURCE_URI,
          visibility: ["model", "app"],
        },
        "openai/outputTemplate": SEQUENCE_VIEWER_RESOURCE_URI,
        "openai/widgetAccessible": true,
        "openai/toolInvocation/invoking":
          "Opening Biological Sequence & Alignment Viewer...",
        "openai/toolInvocation/invoked":
          "Biological Sequence & Alignment Viewer ready",
      },
    },
    async (input, extra) => {
      const parsedInput = sequenceOpenFromChatToolInputSchema.parse(input);
      const session = commandStore.registerSession();
      let opened:
        | Awaited<ReturnType<typeof chatFileResourceStore.openWithSource>>
        | undefined;
      try {
        opened = await chatFileResourceStore.openWithSource(
          parsedInput.path,
          extra,
          session.sessionId,
        );
        if (opened.workspaceBacked) {
          await workspacePublisher
            .bindSession(session.sessionId, opened.sourcePath, extra)
            .catch(() => false);
        }
        const scientificSource = opened.workspaceBacked
          ? await scientificPlatform.bindOpenedSource({
              extra,
              sessionId: session.sessionId,
              sourcePath: opened.sourcePath,
            })
          : null;
        if (
          opened.rangeOnly &&
          (scientificSource == null || scientificSource.format === "unsupported")
        ) {
          throw new Error(
            "This large workspace source requires an authorized, bounded Sequence viewer session.",
          );
        }
        const result = createSequenceOpenFromChatToolResult(
          parsedInput,
          opened.viewerFile,
          session,
          recoveryBroker == null
            ? undefined
            : validateHostSequenceRecoveryMetadata(
                await recoveryBroker.issueRecoveryMetadata({
                  extra,
                  family: "sequence",
                  logicalSessionId: session.sessionId,
                  resourceUri: SEQUENCE_VIEWER_RESOURCE_URI,
                  viewerFile: opened.viewerFile,
                }),
                session.sessionId,
              ),
        );
        return scientificSource == null
          ? result
          : {
              ...result,
              _meta: {
                ...result._meta,
                [SEQUENCE_PLUGIN_SCIENTIFIC_SOURCE_META_KEY]: scientificSource,
              },
            };
      } catch (error) {
        await opened?.discard?.().catch(() => undefined);
        workspacePublisher.clearSession(session.sessionId);
        commandStore.closeSession(session.sessionId);
        throw error;
      }
    },
  );

  registerAppTool(
    server,
    SEQUENCE_ACQUIRE_PUBLIC_EXAMPLE_TOOL_NAME,
    {
      title: "Acquire authoritative public sequence example",
      description:
        "Optional legacy acquisition route, available only when the plugin host independently exposes authenticated local workspace roots through MCP roots/list. For marketplace starters, follow the Biological Sequence & Alignment Viewer skill: Codex fetches and validates the pinned official source with its own authorized network and workspace tools, then calls sequence.open_from_chat exactly once with its exact absolute local path. This acquisition tool is never a starter prerequisite or a fallback when roots are unavailable; supplying workspaceRoot cannot grant access. When authorized, it acquires one exact versioned NCBI, UniProtKB, Rfam, or ENA example into codex-viewer-examples, enforces fixed endpoints and accession/release/checksum/format/byte bounds, records deterministic derivation and SHA-256 provenance, and opens the collision-safely published result in one session. Never substitute a bundled fixture or an arbitrary URL.",
      inputSchema: sequenceAcquirePublicExampleInputSchema.shape,
      annotations: {
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
        readOnlyHint: false,
      },
      _meta: {
        ui: {
          resourceUri: SEQUENCE_VIEWER_RESOURCE_URI,
          visibility: ["model", "app"],
        },
        "openai/outputTemplate": SEQUENCE_VIEWER_RESOURCE_URI,
        "openai/widgetAccessible": true,
        "openai/toolInvocation/invoking":
          "Acquiring and validating authoritative biological data...",
        "openai/toolInvocation/invoked":
          "Authoritative biological example ready",
      },
    },
    async (input, extra) => {
      const parsedInput = sequenceAcquirePublicExampleInputSchema.parse(input);
      const acquired = await publicExampleAcquirer.acquire(parsedInput, extra);
      await publicExampleLifecycleHooks.afterAcquisition?.();
      throwIfPublicExampleAcquisitionAborted(extra.signal);
      const session = commandStore.registerSession();
      let opened:
        | Awaited<
            ReturnType<typeof chatFileResourceStore.openVerifiedWithSource>
          >
        | undefined;
      try {
        const bound = await workspacePublisher.bindSession(
          session.sessionId,
          acquired.absolutePath,
          extra,
        );
        await publicExampleLifecycleHooks.afterBinding?.(session.sessionId);
        throwIfPublicExampleAcquisitionAborted(extra.signal);
        if (!bound) {
          throw new Error("The workspace source could not be bound.");
        }
        opened = await chatFileResourceStore.openVerifiedWithSource(
          acquired.absolutePath,
          {
            byteLength: acquired.provenance.artifactByteLength,
            fileIdentity: acquired.fileIdentity,
            sha256: acquired.provenance.artifactSha256,
          },
          extra,
          session.sessionId,
        );
        await publicExampleLifecycleHooks.afterHandleOpen?.(session.sessionId);
        throwIfPublicExampleAcquisitionAborted(extra.signal);
        if (!opened.workspaceBacked) {
          throw new Error("The workspace source was no longer active.");
        }
        throwIfPublicExampleAcquisitionAborted(extra.signal);
        const scientificSource = await scientificPlatform.bindOpenedSource({
          extra,
          sessionId: session.sessionId,
          sourcePath: opened.sourcePath,
        });
        const result = createSequenceAcquirePublicExampleToolResult(
          opened.viewerFile,
          session,
          acquired.provenance,
          recoveryBroker == null
            ? undefined
            : validateHostSequenceRecoveryMetadata(
                await recoveryBroker.issueRecoveryMetadata({
                  extra,
                  family: "sequence",
                  logicalSessionId: session.sessionId,
                  resourceUri: SEQUENCE_VIEWER_RESOURCE_URI,
                  viewerFile: opened.viewerFile,
                }),
                session.sessionId,
              ),
        );
        return scientificSource == null
          ? result
          : {
              ...result,
              _meta: {
                ...result._meta,
                [SEQUENCE_PLUGIN_SCIENTIFIC_SOURCE_META_KEY]: scientificSource,
              },
            };
      } catch (error) {
        await opened?.discard().catch(() => undefined);
        workspacePublisher.clearSession(session.sessionId);
        commandStore.closeSession(session.sessionId);
        throwIfPublicExampleAcquisitionAborted(extra.signal);
        if (
          error instanceof Error &&
          error.message ===
            "The viewer could not securely save this file handle. Check that Codex local state is writable and retry."
        ) {
          throw error;
        }
        throw new Error(
          "The authoritative public example was acquired, but its identity or active workspace changed before opening. No viewer was opened; retry from the intended workspace.",
        );
      }
    },
  );

  return server;
}

function isSupportedReferenceFileName(fileName: string): boolean {
  return /\.(?:fa|faa|fas|fasta|fna)(?:\.gz)?$/iu.test(fileName);
}

export function createSequenceOpenToolResult(input: SequenceOpenToolInput): {
  content: [];
  structuredContent: SequenceOpenToolInput;
} {
  return {
    content: [],
    structuredContent: input,
  };
}

function resolveSequenceOpenToolInput(
  rawInput: unknown,
): SequenceOpenToolInput {
  const input = sequenceOpenToolInputSchema.parse(rawInput);
  if (input.file == null) {
    throw new Error(
      "The host did not provide a file resource for the sequence viewer.",
    );
  }
  return { file: input.file };
}

function parseTrustedFileViewerMetadata(extra: unknown): string | null {
  if (typeof extra !== "object" || extra == null || !("_meta" in extra)) {
    return null;
  }
  const parsed = trustedFileViewerMetadataSchema.safeParse(extra._meta);
  return parsed.success ? parsed.data["openai/resource"].path : null;
}

export function createSequenceOpenFromChatToolResult(
  { path: _path, presentation }: SequenceOpenFromChatToolInput,
  viewerFile: ChatViewerFileInput,
  session: ViewerSession,
  recoveryMetadata?: SequenceScientificRecoveryMetadata,
): SequenceInlineViewerToolResult {
  const result = createSequenceInlineViewerToolResult({
    message:
      "The embedded Biological Sequence & Alignment Viewer is opening. Its session is created, but rendering is not yet confirmed. Click or expand the Sequence open from chat tool card above to view it. After it loads, use Open in side pane, or ask me to move or control the same live viewer.",
    session,
    viewerFile,
    recoveryMetadata,
  });
  return presentation == null
    ? result
    : {
        ...result,
        structuredContent: {
          ...result.structuredContent,
          viewerPresentation: presentation,
        },
      };
}

export function createSequenceAcquirePublicExampleToolResult(
  viewerFile: ChatViewerFileInput,
  session: ViewerSession,
  provenance: SequencePublicExampleProvenanceSummary,
  recoveryMetadata?: SequenceScientificRecoveryMetadata,
): SequencePublicExampleViewerToolResult {
  const result = createSequenceInlineViewerToolResult({
    message:
      "The authoritative public record was acquired and validated, and the embedded Biological Sequence & Alignment Viewer is opening. Rendering is not yet confirmed. Click or expand the acquisition tool card above to view it. Complete the requested analysis from live viewer state; use Open in side pane or ask me to move or control the same viewer.",
    session,
    viewerFile,
    recoveryMetadata,
  });
  return {
    ...result,
    structuredContent: {
      ...result.structuredContent,
      publicExampleProvenance: provenance,
    },
  };
}

type ViewerSession = {
  revision: number;
  sessionId: string;
};

type SequenceInlineViewerToolResult = {
  content: [{ type: "text"; text: string }];
  structuredContent: {
    schemaVersion: typeof SEQUENCE_VIEWER_SCHEMA_VERSION;
    sessionReady: true;
    viewerCommandRevision: number;
    viewerPresentation?: "full" | "inline";
    viewerReady: false;
    viewerSessionId: string;
  };
  _meta: {
    [SEQUENCE_VIEWER_CHAT_FILE_META_KEY]: ChatViewerFileInput;
    [SEQUENCE_SCIENTIFIC_RECOVERY_META_KEY]?: SequenceScientificRecoveryMetadata;
    "openai/outputTemplate": typeof SEQUENCE_VIEWER_RESOURCE_URI;
  };
};

type SequencePublicExampleViewerToolResult = Omit<
  SequenceInlineViewerToolResult,
  "structuredContent"
> & {
  structuredContent: SequenceInlineViewerToolResult["structuredContent"] & {
    publicExampleProvenance: SequencePublicExampleProvenanceSummary;
  };
};

function createSequenceInlineViewerToolResult({
  message,
  session,
  viewerFile,
  recoveryMetadata,
}: {
  message: string;
  session: ViewerSession;
  viewerFile: ChatViewerFileInput;
  recoveryMetadata?: SequenceScientificRecoveryMetadata;
}): SequenceInlineViewerToolResult {
  return {
    content: [
      {
        type: "text",
        text: message,
      },
    ],
    structuredContent: {
      schemaVersion: SEQUENCE_VIEWER_SCHEMA_VERSION,
      sessionReady: true,
      viewerCommandRevision: session.revision,
      viewerReady: false,
      viewerSessionId: session.sessionId,
    },
    _meta: {
      [SEQUENCE_VIEWER_CHAT_FILE_META_KEY]: viewerFile,
      ...(recoveryMetadata == null
        ? {}
        : { [SEQUENCE_SCIENTIFIC_RECOVERY_META_KEY]: recoveryMetadata }),
      "openai/outputTemplate": SEQUENCE_VIEWER_RESOURCE_URI,
    },
  };
}

function validateHostSequenceRecoveryMetadata(
  metadata: SequenceScientificRecoveryMetadata,
  logicalSessionId: string,
): SequenceScientificRecoveryMetadata {
  const parsed = sequenceScientificRecoveryMetadataSchema.parse(metadata);
  if (parsed.logicalSessionId !== logicalSessionId) {
    throw new Error(
      "The application returned a recovery grant for a different Sequence viewer session.",
    );
  }
  return parsed;
}

export function createSequenceViewerHtml({
  appJavaScriptGzipBase64,
  styles,
}: {
  appJavaScriptGzipBase64: string;
  styles: string;
}): string {
  const serializedAppJavaScriptChunks = chunkString(
    appJavaScriptGzipBase64,
    32_768,
  ).map((chunk) => JSON.stringify(chunk));
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>${escapeInlineHtmlTag(styles, "style")}</style>
  </head>
  <body>
    <div id="root"></div>
    <script type="module">
      try {
        const compressedBase64 = [${serializedAppJavaScriptChunks.join(",")}].join("");
        const compressedBinary = atob(compressedBase64);
        const compressedBytes = new Uint8Array(compressedBinary.length);
        for (let index = 0; index < compressedBinary.length; index += 1) {
          compressedBytes[index] = compressedBinary.charCodeAt(index);
        }
        const decompressedStream = new Blob([compressedBytes])
          .stream()
          .pipeThrough(new DecompressionStream("gzip"));
        const appJavaScript = await new Response(decompressedStream).arrayBuffer();
        const appJavaScriptUrl = URL.createObjectURL(
          new Blob([appJavaScript], { type: "text/javascript" }),
        );
        try {
          await import(appJavaScriptUrl);
        } finally {
          URL.revokeObjectURL(appJavaScriptUrl);
        }
      } catch (error) {
        console.error("Failed to load the Biological Sequence & Alignment Viewer bundle", error);
        document.getElementById("root").textContent =
          "Biological Sequence & Alignment Viewer failed to load its local application bundle.";
      }
    </script>
  </body>
</html>`;
}

export function createSequenceViewerCsp(): {
  connectDomains: [];
  resourceDomains: ["blob:"];
} {
  return {
    connectDomains: [],
    resourceDomains: ["blob:"],
  };
}

async function loadSequenceViewerResource(): Promise<{
  html: string;
}> {
  const distDirectory = path.dirname(fileURLToPath(import.meta.url));
  const [appJavaScriptGzip, styles] = await Promise.all([
    readFile(path.join(distDirectory, "views", "app.js.gz")),
    readFile(path.join(distDirectory, "views", "styles.css"), "utf8"),
  ]);

  return {
    html: createSequenceViewerHtml({
      appJavaScriptGzipBase64: appJavaScriptGzip.toString("base64"),
      styles,
    }),
  };
}

function chunkString(value: string, chunkSize: number): Array<string> {
  const chunks: Array<string> = [];
  for (let index = 0; index < value.length; index += chunkSize) {
    chunks.push(value.slice(index, index + chunkSize));
  }
  return chunks;
}

function escapeInlineHtmlTag(
  contents: string,
  tagName: "script" | "style",
): string {
  return contents.replaceAll(`</${tagName}`, `<\\/${tagName}`);
}

function isSafeWorkspacePath(filePath: string): boolean {
  return (
    !/[\0\n\r]/u.test(filePath) && !/^[a-z][a-z0-9+.-]*:\/\//iu.test(filePath)
  );
}

function createSequenceViewerCommand(
  input: z.infer<typeof sequenceViewerControlInputSchema>,
): SequenceViewerControlCommand {
  const { sessionId: _sessionId, ...command } = input;
  return command;
}

function modelVisibleLoadedTrackSummary(
  privateTrack: unknown,
  identity: {
    format: z.infer<typeof sequenceViewerLoadTrackInputSchema>["format"];
    name: string;
    trackId: string;
  },
) {
  const track = modelVisibleLoadedTrackSchema.parse(privateTrack);
  return {
    featureCount: track.features?.length ?? 0,
    format: identity.format,
    id: identity.trackId,
    kind: track.kind,
    mapping: track.mapping,
    name: identity.name,
    readCount: track.reads?.length ?? 0,
    sampleCount: track.vcfHeader?.sampleNames.length ?? 0,
    source: { displayName: identity.name },
    summary: track.summary,
    variantCount: track.variants?.length ?? 0,
  };
}

function operationToolResult(
  completion: {
    applied: boolean;
    message: string;
    state?: Record<string, unknown>;
  },
  result?: unknown,
) {
  return {
    content: [{ type: "text" as const, text: completion.message }],
    structuredContent: {
      applied: completion.applied,
      message: completion.message,
      result: result ?? completion.state ?? null,
      schemaVersion: SEQUENCE_VIEWER_SCHEMA_VERSION,
    },
  };
}

async function assertPendingPersistenceCommand(
  commandStore: SequenceViewerCommandStore,
  authorizations: SequenceWorkspaceExportAuthorizationStore,
  workspacePublisher: SequenceWorkspaceExportPublisher,
  input: SequenceWorkbenchPayloadDeclaration,
  extra: RootsRequestExtra,
): Promise<void> {
  let command: SequenceViewerCommand;
  try {
    command = commandStore.getPendingCommand(input.sessionId, input.commandId);
  } catch {
    commandStore.assertSessionActive(input.sessionId);
    const bindingId = authorizations.assertDeclaration(input);
    try {
      await workspacePublisher.assertSourceBinding(
        input.sessionId,
        bindingId,
        extra,
      );
    } catch (error) {
      throw safeSequenceWorkspacePublicationError(error);
    }
    return;
  }
  if (input.kind === "artifact") {
    if (
      command.action !== "export_artifact" ||
      command.format !== input.format ||
      JSON.stringify(command.destination) !== JSON.stringify(input.destination)
    ) {
      throw new Error(
        "The artifact upload is not bound to the matching export command.",
      );
    }
    if (input.destination.kind === "workspace") {
      try {
        await workspacePublisher.assertSessionSourceActive(
          input.sessionId,
          extra,
        );
      } catch (error) {
        throw safeSequenceWorkspacePublicationError(error);
      }
    }
    return;
  }
  if (
    command.action !== "save_session" ||
    command.name !== input.name ||
    input.destination.kind !== "private"
  ) {
    throw new Error(
      "The session upload is not bound to the matching save command.",
    );
  }
}

async function assertPendingPersistenceCommandIdentity(
  commandStore: SequenceViewerCommandStore,
  authorizations: SequenceWorkspaceExportAuthorizationStore,
  workspacePublisher: SequenceWorkspaceExportPublisher,
  input: {
    callerId: string;
    commandId: string;
    sessionId: string;
    uploadId: string;
  },
  extra: RootsRequestExtra,
): Promise<void> {
  let command: SequenceViewerCommand;
  try {
    command = commandStore.getPendingCommand(input.sessionId, input.commandId);
  } catch {
    commandStore.assertSessionActive(input.sessionId);
    const bindingId = authorizations.assertIdentity(input);
    try {
      await workspacePublisher.assertSourceBinding(
        input.sessionId,
        bindingId,
        extra,
      );
    } catch (error) {
      throw safeSequenceWorkspacePublicationError(error);
    }
    return;
  }
  if (
    command.action !== "export_artifact" &&
    command.action !== "save_session"
  ) {
    throw new Error(
      "The workbench upload is not bound to a persistence command.",
    );
  }
  if (
    command.action === "export_artifact" &&
    command.destination.kind === "workspace"
  ) {
    try {
      await workspacePublisher.assertSessionSourceActive(
        input.sessionId,
        extra,
      );
    } catch (error) {
      throw safeSequenceWorkspacePublicationError(error);
    }
  }
}

function assertPersistenceCommandIdentityForAbort(
  commandStore: SequenceViewerCommandStore,
  authorizations: SequenceWorkspaceExportAuthorizationStore,
  input: {
    callerId: string;
    commandId: string;
    sessionId: string;
    uploadId: string;
  },
): void {
  let command: SequenceViewerCommand;
  try {
    command = commandStore.getPendingCommand(input.sessionId, input.commandId);
  } catch {
    commandStore.assertSessionActive(input.sessionId);
    authorizations.assertIdentity(input);
    return;
  }
  if (
    command.action !== "export_artifact" &&
    command.action !== "save_session"
  ) {
    throw new Error(
      "The workbench upload is not bound to a persistence command.",
    );
  }
}

async function prepareTrackCommandContent({
  end,
  format,
  index,
  primary,
  reference,
  referenceFile,
  signal,
  start,
}: {
  end?: number;
  format: ResolvedSequenceWorkspaceTrackBundle["format"];
  index?: {
    bytes: Uint8Array;
    format: "bai" | "crai" | "csi";
    name: string;
  };
  primary: { bytes: Uint8Array; name: string };
  reference?: string;
  referenceFile?: { bytes: Uint8Array; name: string };
  signal?: AbortSignal;
  start?: number;
}): Promise<{
  content: string;
  resolvedReference?: string;
  sourceItemCount?: number;
  sourceTruncated?: boolean;
}> {
  signal?.throwIfAborted();
  let content: string;
  let resolvedReference = reference;
  let sourceItemCount: number | undefined;
  let sourceTruncated: boolean | undefined;
  if (format === "bam") {
    if (index == null || (index.format !== "bai" && index.format !== "csi")) {
      throw new Error(
        "BAM workspace tracks require a resolved BAI or CSI index.",
      );
    }
    const decoded = await decodeBamWindowToSam({
      bamBytes: primary.bytes,
      end,
      indexBytes: index.bytes,
      indexFormat: index.format,
      reference,
      start,
    });
    content = decoded.sam;
    resolvedReference = decoded.reference;
    sourceItemCount = decoded.readCount;
    sourceTruncated = decoded.truncated;
  } else if (format === "cram") {
    if (index == null || index.format !== "crai") {
      throw new Error("CRAM workspace tracks require a resolved CRAI index.");
    }
    const referenceContents =
      referenceFile == null
        ? undefined
        : isGzipCompressedBiologicalFileName(referenceFile.name)
          ? (await gunzip(Buffer.from(referenceFile.bytes))).toString("utf8")
          : Buffer.from(referenceFile.bytes).toString("utf8");
    const decoded = await decodeCramWindowToSam({
      cramBytes: primary.bytes,
      end,
      indexBytes: index.bytes,
      reference,
      referenceContents,
      referenceFileName: referenceFile?.name,
      start,
    });
    content = decoded.sam;
    resolvedReference = decoded.reference;
    sourceItemCount = decoded.readCount;
    sourceTruncated = decoded.truncated;
  } else {
    const bytes = isGzipCompressedBiologicalFileName(primary.name)
      ? await gunzip(Buffer.from(primary.bytes))
      : Buffer.from(primary.bytes);
    content = bytes.toString("utf8");
  }
  signal?.throwIfAborted();
  if (Buffer.byteLength(content, "utf8") > 16 * 1_024 * 1_024) {
    throw new Error(
      "The decoded track exceeds the viewer's 16 MiB command-transfer budget. Load a regional subset or indexed track artifact.",
    );
  }
  return {
    content,
    resolvedReference,
    sourceItemCount,
    sourceTruncated,
  };
}

function isSupportedTrackFileName(
  fileName: string,
  format: z.infer<typeof sequenceViewerLoadTrackInputSchema>["format"],
): boolean {
  const normalized = fileName.toLowerCase().replace(/\.gz$/u, "");
  const extensions: Record<
    z.infer<typeof sequenceViewerLoadTrackInputSchema>["format"],
    Array<string>
  > = {
    bam: [".bam"],
    bed: [".bed"],
    cram: [".cram"],
    gff3: [".gff", ".gff3"],
    gtf: [".gtf"],
    sam: [".sam"],
    vcf: [".vcf"],
  };
  return extensions[format].some((extension) => normalized.endsWith(extension));
}

if (
  process.argv[1] != null &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  await createSequenceViewerServer().connect(new StdioServerTransport());
}
