import { App } from "@modelcontextprotocol/ext-apps";

import {
  SEQUENCE_PREPARE_WORKSPACE_EXPORT_TOOL_NAME,
  sequencePrepareWorkspaceExportInputSchema,
  sequencePrepareWorkspaceExportResultSchema,
  type SequenceWorkbenchPersistenceResult,
} from "../workbench-persistence-protocol";
import {
  SEQUENCE_CREATE_WORKSPACE_DIRECTORY_TOOL_NAME,
  SEQUENCE_LIST_WORKSPACE_DIRECTORY_TOOL_NAME,
  sequenceCreateWorkspaceDirectoryInputSchema,
  sequenceCreateWorkspaceDirectoryResultSchema,
  sequenceListWorkspaceDirectoryInputSchema,
  sequenceListWorkspaceDirectoryResultSchema,
  type SequenceCreateWorkspaceDirectoryInput,
  type SequenceCreateWorkspaceDirectoryResult,
  type SequenceListWorkspaceDirectoryInput,
  type SequenceListWorkspaceDirectoryResult,
} from "../workspace-browser-protocol";
import {
  SEQUENCE_LIST_WORKSPACE_SESSIONS_TOOL_NAME,
  SEQUENCE_RESTORE_WORKSPACE_SESSION_TOOL_NAME,
  sequenceListWorkspaceSessionsInputSchema,
  sequenceListWorkspaceSessionsResultSchema,
  sequenceRestoreWorkspaceSessionInputSchema,
  sequenceRestoreWorkspaceSessionResultSchema,
  type SequenceListWorkspaceSessionsResult,
  type SequenceRestoreWorkspaceSessionResult,
} from "../workspace-session-protocol";
import {
  isRetryableSequencePersistenceError,
  persistSequenceWorkbenchPayload,
} from "./workbench-persistence";

export type PreparedSequenceWorkspaceSession = {
  content: string;
  name: string;
};

export type SequenceWorkspaceSessionClient = {
  (
    session: PreparedSequenceWorkspaceSession,
    relativePath: string,
    collisionPolicy?: "exact" | "next-version",
    signal?: AbortSignal,
  ): Promise<SequenceWorkbenchPersistenceResult>;
  createDirectory: (
    input: Omit<SequenceCreateWorkspaceDirectoryInput, "sessionId"> & {
      signal?: AbortSignal;
    },
  ) => Promise<SequenceCreateWorkspaceDirectoryResult>;
  discover: (signal?: AbortSignal) => Promise<SequenceListWorkspaceSessionsResult>;
  listDirectory: (
    input: Omit<SequenceListWorkspaceDirectoryInput, "sessionId"> & {
      signal?: AbortSignal;
    },
  ) => Promise<SequenceListWorkspaceDirectoryResult>;
  restore: (
    candidateId: string,
    signal?: AbortSignal,
  ) => Promise<SequenceRestoreWorkspaceSessionResult>;
};

export function createSequenceWorkspaceSessionClient(
  app: Pick<App, "callServerTool">,
  sessionId: string,
): SequenceWorkspaceSessionClient {
  const client = (async (
    session: PreparedSequenceWorkspaceSession,
    relativePath: string,
    collisionPolicy: "exact" | "next-version" = "exact",
    signal?: AbortSignal,
  ) => {
    const bytes = new TextEncoder().encode(session.content);
    const digest = await sha256Bytes(bytes);
    const preparation = sequencePrepareWorkspaceExportInputSchema.parse({
      byteLength: bytes.byteLength,
      destination: {
        base: "opened-source",
        collisionPolicy,
        kind: "workspace",
        relativePath,
      },
      kind: "session",
      name: workspaceName(relativePath),
      sessionId,
      sha256: digest,
    });
    const prepared = await callWithRetry(
      app,
      {
        arguments: preparation,
        name: SEQUENCE_PREPARE_WORKSPACE_EXPORT_TOOL_NAME,
      },
      signal,
    );
    const authorization = sequencePrepareWorkspaceExportResultSchema.parse(
      prepared.structuredContent,
    );
    const result = await persistSequenceWorkbenchPayload(app, {
      commandId: authorization.commandId,
      content: session.content,
      destination: preparation.destination,
      kind: "session",
      name: preparation.name,
      sessionId,
      signal,
    });
    if (
      result.kind !== "session" ||
      !("destination" in result) ||
      result.destination.kind !== "workspace"
    ) {
      throw new Error("The server did not confirm a workspace session.");
    }
    return result;
  }) as SequenceWorkspaceSessionClient;

  client.listDirectory = async ({ signal, ...input }) => {
    const parsed = sequenceListWorkspaceDirectoryInputSchema.parse({
      ...input,
      sessionId,
    });
    const result = await callWithRetry(
      app,
      { arguments: parsed, name: SEQUENCE_LIST_WORKSPACE_DIRECTORY_TOOL_NAME },
      signal,
    );
    return sequenceListWorkspaceDirectoryResultSchema.parse(
      result.structuredContent,
    );
  };
  client.createDirectory = async ({ signal, ...input }) => {
    const parsed = sequenceCreateWorkspaceDirectoryInputSchema.parse({
      ...input,
      sessionId,
    });
    const result = await callOnce(
      app,
      {
        arguments: parsed,
        name: SEQUENCE_CREATE_WORKSPACE_DIRECTORY_TOOL_NAME,
      },
      signal,
    );
    return sequenceCreateWorkspaceDirectoryResultSchema.parse(
      result.structuredContent,
    );
  };
  client.discover = async (signal) => {
    const parsed = sequenceListWorkspaceSessionsInputSchema.parse({ sessionId });
    const result = await callWithRetry(
      app,
      { arguments: parsed, name: SEQUENCE_LIST_WORKSPACE_SESSIONS_TOOL_NAME },
      signal,
    );
    return sequenceListWorkspaceSessionsResultSchema.parse(
      result.structuredContent,
    );
  };
  client.restore = async (candidateId, signal) => {
    const parsed = sequenceRestoreWorkspaceSessionInputSchema.parse({
      candidateId,
      sessionId,
    });
    const result = await callOnce(
      app,
      {
        arguments: parsed,
        name: SEQUENCE_RESTORE_WORKSPACE_SESSION_TOOL_NAME,
      },
      signal,
    );
    return sequenceRestoreWorkspaceSessionResultSchema.parse(
      result.structuredContent,
    );
  };
  return client;
}

async function callWithRetry(
  app: Pick<App, "callServerTool">,
  request: Parameters<App["callServerTool"]>[0],
  signal?: AbortSignal,
): Promise<Awaited<ReturnType<App["callServerTool"]>>> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await callOnce(app, request, signal);
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

async function callOnce(
  app: Pick<App, "callServerTool">,
  request: Parameters<App["callServerTool"]>[0],
  signal?: AbortSignal,
): Promise<Awaited<ReturnType<App["callServerTool"]>>> {
  throwIfAborted(signal);
  return signal == null
    ? await app.callServerTool(request)
    : await app.callServerTool(request, { signal });
}

async function sha256Bytes(bytes: Uint8Array): Promise<string> {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  const digest = await crypto.subtle.digest("SHA-256", copy.buffer);
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function workspaceName(relativePath: string): string {
  const name = relativePath.split("/").at(-1);
  if (name == null || name.length === 0) {
    throw new Error("The workspace session destination has no filename.");
  }
  return name;
}

function throwIfAborted(signal?: AbortSignal): void {
  if (!signal?.aborted) return;
  throw signal.reason ?? new DOMException("Workspace session cancelled.", "AbortError");
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
            new DOMException("Workspace session cancelled.", "AbortError"),
        );
      },
      { once: true },
    );
  });
}
