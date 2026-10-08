import { App } from "@modelcontextprotocol/ext-apps";

import {
  SEQUENCE_LIST_WORKSPACE_TRACK_DIRECTORY_TOOL_NAME,
  SEQUENCE_LOAD_WORKSPACE_TRACK_TOOL_NAME,
  SEQUENCE_RESOLVE_WORKSPACE_TRACK_BUNDLE_TOOL_NAME,
  sequenceListWorkspaceTrackDirectoryInputSchema,
  sequenceListWorkspaceTrackDirectoryResultSchema,
  sequenceLoadWorkspaceTrackInputSchema,
  sequenceLoadWorkspaceTrackResultSchema,
  sequenceResolveWorkspaceTrackBundleInputSchema,
  sequenceResolveWorkspaceTrackBundleResultSchema,
  type SequenceListWorkspaceTrackDirectoryInput,
  type SequenceListWorkspaceTrackDirectoryResult,
  type SequenceLoadWorkspaceTrackInput,
  type SequenceLoadWorkspaceTrackResult,
  type SequenceResolveWorkspaceTrackBundleInput,
  type SequenceResolveWorkspaceTrackBundleResult,
} from "../workspace-track-protocol";
import { isRetryableSequencePersistenceError } from "./workbench-persistence";

type WithSignal<T> = Omit<T, "sessionId"> & { signal?: AbortSignal };

export type SequenceWorkspaceTrackBrowserClient = {
  listDirectory: (
    input: WithSignal<SequenceListWorkspaceTrackDirectoryInput>,
  ) => Promise<SequenceListWorkspaceTrackDirectoryResult>;
  loadBundle: (
    input: WithSignal<SequenceLoadWorkspaceTrackInput>,
  ) => Promise<SequenceLoadWorkspaceTrackResult>;
  resolveBundle: (
    input: WithSignal<SequenceResolveWorkspaceTrackBundleInput>,
  ) => Promise<SequenceResolveWorkspaceTrackBundleResult>;
};

export function createSequenceWorkspaceTrackBrowserClient(
  app: Pick<App, "callServerTool">,
  sessionId: string,
): SequenceWorkspaceTrackBrowserClient {
  return {
    listDirectory: async ({ signal, ...input }) => {
      const parsed = sequenceListWorkspaceTrackDirectoryInputSchema.parse({
        ...input,
        sessionId,
      });
      const result = await callReadOnlyToolWithRetry(
        app,
        {
          arguments: parsed,
          name: SEQUENCE_LIST_WORKSPACE_TRACK_DIRECTORY_TOOL_NAME,
        },
        signal,
      );
      return sequenceListWorkspaceTrackDirectoryResultSchema.parse(
        result.structuredContent,
      );
    },
    loadBundle: async ({ signal, ...input }) => {
      const parsed = sequenceLoadWorkspaceTrackInputSchema.parse({
        ...input,
        sessionId,
      });
      throwIfAborted(signal);
      const result =
        signal == null
          ? await app.callServerTool({
              arguments: parsed,
              name: SEQUENCE_LOAD_WORKSPACE_TRACK_TOOL_NAME,
            })
          : await app.callServerTool(
              {
                arguments: parsed,
                name: SEQUENCE_LOAD_WORKSPACE_TRACK_TOOL_NAME,
              },
              { signal },
            );
      return sequenceLoadWorkspaceTrackResultSchema.parse(
        result.structuredContent,
      );
    },
    resolveBundle: async ({ signal, ...input }) => {
      const parsed = sequenceResolveWorkspaceTrackBundleInputSchema.parse({
        ...input,
        sessionId,
      });
      const result = await callReadOnlyToolWithRetry(
        app,
        {
          arguments: parsed,
          name: SEQUENCE_RESOLVE_WORKSPACE_TRACK_BUNDLE_TOOL_NAME,
        },
        signal,
      );
      return sequenceResolveWorkspaceTrackBundleResultSchema.parse(
        result.structuredContent,
      );
    },
  };
}

async function callReadOnlyToolWithRetry(
  app: Pick<App, "callServerTool">,
  request: Parameters<App["callServerTool"]>[0],
  signal?: AbortSignal,
): Promise<Awaited<ReturnType<App["callServerTool"]>>> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      throwIfAborted(signal);
      return signal == null
        ? await app.callServerTool(request)
        : await app.callServerTool(request, { signal });
    } catch (error) {
      lastError = error;
      if (!isRetryableSequencePersistenceError(error) || attempt === 2) {
        throw error;
      }
      await abortableDelay(100 * 2 ** attempt, signal);
    }
  }
  throw lastError;
}

function throwIfAborted(signal?: AbortSignal): void {
  if (!signal?.aborted) return;
  throw (
    signal.reason ??
    new DOMException("Workspace browsing cancelled.", "AbortError")
  );
}

async function abortableDelay(
  milliseconds: number,
  signal?: AbortSignal,
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const timeout = window.setTimeout(resolve, milliseconds);
    signal?.addEventListener(
      "abort",
      () => {
        window.clearTimeout(timeout);
        reject(
          signal.reason ??
            new DOMException("Workspace browsing cancelled.", "AbortError"),
        );
      },
      { once: true },
    );
  });
}
