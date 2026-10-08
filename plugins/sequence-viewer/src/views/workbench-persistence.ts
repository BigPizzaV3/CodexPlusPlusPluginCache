import { App } from "@modelcontextprotocol/ext-apps";
import { z } from "zod";

import { SEQUENCE_VIEWER_LIMITS, utf8ByteLength } from "../runtime-contract";
import type {
  QueuedSequenceViewerCommand,
  SequenceViewerCommandResult,
} from "../viewer-commands";
import {
  SEQUENCE_ABORT_WORKBENCH_PAYLOAD_UPLOAD_TOOL_NAME,
  SEQUENCE_APPEND_WORKBENCH_PAYLOAD_CHUNK_TOOL_NAME,
  SEQUENCE_BEGIN_WORKBENCH_PAYLOAD_UPLOAD_TOOL_NAME,
  SEQUENCE_FINISH_WORKBENCH_PAYLOAD_UPLOAD_TOOL_NAME,
  SEQUENCE_GENERATE_WORKSPACE_EXPORT_TOOL_NAME,
  SEQUENCE_PERSIST_WORKBENCH_PAYLOAD_TOOL_NAME,
  SEQUENCE_PREPARE_WORKSPACE_EXPORT_TOOL_NAME,
  sequenceAbortWorkbenchPayloadUploadResultSchema,
  sequenceGenerateWorkspaceExportInputSchema,
  sequencePrepareWorkspaceExportInputSchema,
  sequencePrepareWorkspaceExportResultSchema,
  sequenceWorkbenchPayloadUploadProgressSchema,
  sequenceWorkbenchPersistenceResultSchema,
  type SequenceWorkbenchPayloadDeclaration,
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
  measureSequenceWorkspaceProducer,
  sequenceWorkspaceUploadChunks,
  type SequenceWorkspaceChunkProducer,
} from "./workspace-artifact-stream";

const preparedArtifactSchema = z
  .object({
    content: z.string(),
    format: z.string().trim().min(1).max(100),
    mediaType: z.string().trim().min(1).max(200),
    name: z.string().trim().min(1).max(255),
  })
  .strict();

const provenanceSchema = z
  .object({
    engine: z.string().trim().min(1).max(500),
    parameters: z.record(z.string().max(500), z.unknown()),
    sourceRevision: z.number().int().nonnegative(),
  })
  .strict()
  .refine(
    (value) => utf8ByteLength(JSON.stringify(value)) <= 32 * 1_024,
    "Artifact provenance exceeds the compact completion budget.",
  );

type PersistSequenceWorkbenchPayloadInput = {
  commandId: string;
  content: string;
  destination?: SequenceWorkbenchPayloadDeclaration["destination"];
  format?: string;
  kind: "artifact" | "session";
  mediaType?: string;
  name: string;
  provenance?: SequenceWorkbenchPayloadDeclaration["provenance"];
  sessionId: string;
  signal?: AbortSignal;
};

export type PreparedSequenceWorkspaceArtifact = {
  content?: string;
  createChunks?: SequenceWorkspaceChunkProducer;
  format: NonNullable<SequenceWorkbenchPayloadDeclaration["format"]>;
  mediaType: string;
  name: string;
  provenance: NonNullable<SequenceWorkbenchPayloadDeclaration["provenance"]>;
  serverGeneration?: {
    compression: "auto" | "gzip" | "none";
    kind: "opened-source" | "native-rich";
    records?: Array<{
      alt?: string;
      end1: number;
      id?: string;
      kind?: string;
      metadata?: Record<string, string | number | boolean | null>;
      ref?: string;
      reference: string;
      score?: number;
      start1: number;
      strand?: "+" | "-" | ".";
    }>;
  };
};
export type SequenceWorkspaceArtifactPublisher = {
  (
    artifact: PreparedSequenceWorkspaceArtifact,
    relativePath: string,
    collisionPolicy?: "exact" | "next-version",
    signal?: AbortSignal,
  ): Promise<SequenceWorkbenchPersistenceResult>;
  createDirectory: (
    input: Omit<SequenceCreateWorkspaceDirectoryInput, "sessionId"> & {
      signal?: AbortSignal;
    },
  ) => Promise<SequenceCreateWorkspaceDirectoryResult>;
  listDirectory: (
    input: Omit<SequenceListWorkspaceDirectoryInput, "sessionId"> & {
      signal?: AbortSignal;
    },
  ) => Promise<SequenceListWorkspaceDirectoryResult>;
  supportsNativeRichGeneration?: boolean;
};

export function createSequenceWorkspaceArtifactPublisher(
  app: Pick<App, "callServerTool">,
  sessionId: string,
): SequenceWorkspaceArtifactPublisher {
  const publisher = (async (
    artifact: PreparedSequenceWorkspaceArtifact,
    relativePath: string,
    collisionPolicy: "exact" | "next-version" = "exact",
    signal?: AbortSignal,
  ) =>
    await publishPreparedSequenceWorkspaceArtifact(app, {
      artifact,
      collisionPolicy,
      relativePath,
      sessionId,
      signal,
    })) as SequenceWorkspaceArtifactPublisher;
  publisher.listDirectory = async ({ signal, ...input }) => {
    const parsed = sequenceListWorkspaceDirectoryInputSchema.parse({
      ...input,
      sessionId,
    });
    const result = await callServerToolWithRetry(
      app,
      {
        arguments: parsed,
        name: SEQUENCE_LIST_WORKSPACE_DIRECTORY_TOOL_NAME,
      },
      signal,
    );
    return sequenceListWorkspaceDirectoryResultSchema.parse(
      result.structuredContent,
    );
  };
  publisher.createDirectory = async ({ signal, ...input }) => {
    const parsed = sequenceCreateWorkspaceDirectoryInputSchema.parse({
      ...input,
      sessionId,
    });
    const result = await callServerToolOnce(
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
  return publisher;
}

async function callServerToolOnce(
  app: Pick<App, "callServerTool">,
  request: Parameters<App["callServerTool"]>[0],
  signal?: AbortSignal,
): Promise<Awaited<ReturnType<App["callServerTool"]>>> {
  assertProxySafeRequest(request);
  throwIfAborted(signal);
  return signal == null
    ? await app.callServerTool(request)
    : await app.callServerTool(request, { signal });
}

export async function publishPreparedSequenceWorkspaceArtifact(
  app: Pick<App, "callServerTool">,
  {
    artifact,
    collisionPolicy = "exact",
    relativePath,
    sessionId,
    signal,
  }: {
    artifact: PreparedSequenceWorkspaceArtifact;
    collisionPolicy?: "exact" | "next-version";
    relativePath: string;
    sessionId: string;
    signal?: AbortSignal;
  },
): Promise<SequenceWorkbenchPersistenceResult> {
  throwIfAborted(signal);
  const producerCount = [
    artifact.content,
    artifact.createChunks,
    artifact.serverGeneration,
  ].filter((value) => value != null).length;
  if (producerCount !== 1) {
    throw new Error(
      "A workspace artifact must provide exactly one repeatable content producer.",
    );
  }
  if (artifact.serverGeneration != null) {
    if (artifact.serverGeneration.kind !== "opened-source") {
      throw new Error(
        "Native rich Sequence generation requires an authenticated desktop backend.",
      );
    }
    if (
      artifact.format !== "fasta" &&
      artifact.format !== "fastq" &&
      artifact.format !== "aligned-fasta"
    ) {
      throw new Error(
        "This export format cannot be generated from the canonical source.",
      );
    }
    const requestedName = workspaceDestinationName(relativePath);
    const commandId = globalThis.crypto.randomUUID();
    const callerId = await deterministicUuid(
      `sequence-workspace-generation-caller\n${sessionId}\n${commandId}`,
    );
    const operationId = globalThis.crypto.randomUUID();
    const generated = await callServerToolWithRetry(
      app,
      {
        arguments: sequenceGenerateWorkspaceExportInputSchema.parse({
          callerId,
          commandId,
          destination: {
            base: "opened-source",
            collisionPolicy,
            kind: "workspace",
            relativePath,
          },
          format: artifact.format,
          mediaType: artifact.mediaType,
          name: requestedName,
          operationId,
          provenance: artifact.provenance,
          sessionId,
          source: artifact.serverGeneration,
        }),
        name: SEQUENCE_GENERATE_WORKSPACE_EXPORT_TOOL_NAME,
      },
      signal,
    );
    const result = sequenceWorkbenchPersistenceResultSchema.parse(
      generated.structuredContent,
    );
    if (
      result.kind !== "artifact" ||
      !("destination" in result) ||
      result.destination.kind !== "workspace" ||
      result.format !== artifact.format ||
      result.mediaType !== artifact.mediaType
    ) {
      throw new Error("The server-generated workspace result is inconsistent.");
    }
    return result;
  }
  const createChunks =
    artifact.createChunks ?? stringWorkspaceProducer(artifact.content!);
  const measurement = await measureSequenceWorkspaceProducer(
    createChunks,
    signal,
  );
  const byteLength = measurement.byteLength;
  const sha256 = measurement.sha256;
  const requestedName = workspaceDestinationName(relativePath);
  const preflightInput = sequencePrepareWorkspaceExportInputSchema.parse({
    byteLength,
    destination: {
      base: "opened-source",
      collisionPolicy,
      kind: "workspace",
      relativePath,
    },
    format: artifact.format,
    mediaType: artifact.mediaType,
    name: requestedName,
    provenance: artifact.provenance,
    sessionId,
    sha256,
  });
  const prepared = await callServerToolWithRetry(
    app,
    {
      arguments: preflightInput,
      name: SEQUENCE_PREPARE_WORKSPACE_EXPORT_TOOL_NAME,
    },
    signal,
  );
  const authorization = sequencePrepareWorkspaceExportResultSchema.parse(
    prepared.structuredContent,
  );
  if (byteLength > authorization.maxWorkspaceArtifactBytes) {
    throw new Error(
      `The workspace export contains ${byteLength.toLocaleString()} bytes; this server accepts at most ${authorization.maxWorkspaceArtifactBytes.toLocaleString()} workspace-output bytes.`,
    );
  }
  return await persistSequenceWorkspaceProducer(app, {
    byteLength,
    commandId: authorization.commandId,
    createChunks,
    destination: preflightInput.destination,
    format: artifact.format,
    mediaType: artifact.mediaType,
    name: preflightInput.name,
    provenance: artifact.provenance,
    sessionId,
    sha256,
    signal,
  });
}

export async function persistSequenceWorkbenchPayload(
  app: Pick<App, "callServerTool">,
  input: PersistSequenceWorkbenchPayloadInput,
): Promise<SequenceWorkbenchPersistenceResult> {
  throwIfAborted(input.signal);
  if (input.kind === "artifact" && input.destination?.kind === "workspace") {
    if (
      input.format == null ||
      input.mediaType == null ||
      input.provenance == null
    ) {
      throw new Error(
        "Workspace artifact persistence requires export metadata.",
      );
    }
    const createChunks = stringWorkspaceProducer(input.content);
    const measured = await measureSequenceWorkspaceProducer(
      createChunks,
      input.signal,
    );
    return await persistSequenceWorkspaceProducer(app, {
      byteLength: measured.byteLength,
      commandId: input.commandId,
      createChunks,
      destination: input.destination,
      format: input.format as NonNullable<
        SequenceWorkbenchPayloadDeclaration["format"]
      >,
      mediaType: input.mediaType,
      name: input.name,
      provenance: input.provenance,
      sessionId: input.sessionId,
      sha256: measured.sha256,
      signal: input.signal,
    });
  }
  const bytes = new TextEncoder().encode(input.content);
  const maxBytes =
    input.kind === "artifact"
      ? SEQUENCE_VIEWER_LIMITS.session.maxArtifactBytes
      : SEQUENCE_VIEWER_LIMITS.session.maxSessionBytes;
  if (
    (bytes.byteLength === 0 && input.kind === "session") ||
    bytes.byteLength > maxBytes
  ) {
    throw new Error(
      `The ${
        input.kind
      } payload contains ${bytes.byteLength.toLocaleString()} bytes; the bounded limit is ${maxBytes.toLocaleString()} bytes.`,
    );
  }
  const sha256 = await sha256Bytes(bytes);
  const callerId = await deterministicUuid(
    `sequence-workbench-caller\n${input.sessionId}\n${input.commandId}`,
  );
  const uploadId = await deterministicUuid(
    JSON.stringify({
      byteLength: bytes.byteLength,
      commandId: input.commandId,
      destination: input.destination ?? { kind: "private" },
      format: input.format ?? null,
      kind: input.kind,
      mediaType: input.mediaType ?? null,
      name: input.name,
      provenance: input.provenance ?? null,
      sessionId: input.sessionId,
      sha256,
    }),
  );
  const declaration: SequenceWorkbenchPayloadDeclaration = {
    byteLength: bytes.byteLength,
    callerId,
    commandId: input.commandId,
    destination: input.destination ?? { kind: "private" },
    format: input.format as SequenceWorkbenchPayloadDeclaration["format"],
    kind: input.kind,
    mediaType: input.mediaType,
    name: input.name,
    provenance: input.provenance,
    sessionId: input.sessionId,
    sha256,
    uploadId,
  };

  if (bytes.byteLength <= SEQUENCE_VIEWER_LIMITS.persistence.maxOneShotBytes) {
    try {
      const result = await callServerToolWithRetry(
        app,
        {
          arguments: {
            ...declaration,
            dataBase64: bytesToBase64(bytes),
          },
          name: SEQUENCE_PERSIST_WORKBENCH_PAYLOAD_TOOL_NAME,
        },
        input.signal,
      );
      return assertCompletedResult(result.structuredContent, declaration);
    } catch (error) {
      return await reconcileFailure(app, declaration, error);
    }
  }

  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await uploadAttempt(app, declaration, bytes, input.signal);
    } catch (error) {
      lastError = error;
      if (!isRetryableSequencePersistenceError(error)) {
        return await reconcileFailure(app, declaration, error);
      }
      if (attempt < 2) await abortableDelay(100 * 2 ** attempt, input.signal);
    }
  }
  throw lastError;
}

async function persistSequenceWorkspaceProducer(
  app: Pick<App, "callServerTool">,
  input: {
    byteLength: number;
    commandId: string;
    createChunks: SequenceWorkspaceChunkProducer;
    destination: Extract<
      SequenceWorkbenchPayloadDeclaration["destination"],
      { kind: "workspace" }
    >;
    format: NonNullable<SequenceWorkbenchPayloadDeclaration["format"]>;
    mediaType: string;
    name: string;
    provenance: NonNullable<SequenceWorkbenchPayloadDeclaration["provenance"]>;
    sessionId: string;
    sha256: string;
    signal?: AbortSignal;
  },
): Promise<SequenceWorkbenchPersistenceResult> {
  const callerId = await deterministicUuid(
    `sequence-workbench-caller\n${input.sessionId}\n${input.commandId}`,
  );
  const uploadId = await deterministicUuid(
    JSON.stringify({
      byteLength: input.byteLength,
      commandId: input.commandId,
      destination: input.destination,
      format: input.format,
      kind: "artifact",
      mediaType: input.mediaType,
      name: input.name,
      provenance: input.provenance,
      sessionId: input.sessionId,
      sha256: input.sha256,
    }),
  );
  const declaration: SequenceWorkbenchPayloadDeclaration = {
    byteLength: input.byteLength,
    callerId,
    commandId: input.commandId,
    destination: input.destination,
    format: input.format,
    kind: "artifact",
    mediaType: input.mediaType,
    name: input.name,
    provenance: input.provenance,
    sessionId: input.sessionId,
    sha256: input.sha256,
    uploadId,
  };
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await uploadProducerAttempt(
        app,
        declaration,
        input.createChunks,
        input.signal,
      );
    } catch (error) {
      lastError = error;
      if (!isRetryableSequencePersistenceError(error)) {
        return await reconcileFailure(app, declaration, error);
      }
      if (attempt < 2) await abortableDelay(100 * 2 ** attempt, input.signal);
    }
  }
  return await reconcileFailure(app, declaration, lastError);
}

async function uploadProducerAttempt(
  app: Pick<App, "callServerTool">,
  declaration: SequenceWorkbenchPayloadDeclaration,
  createChunks: SequenceWorkspaceChunkProducer,
  signal?: AbortSignal,
): Promise<SequenceWorkbenchPersistenceResult> {
  const begin = await callServerToolWithRetry(
    app,
    {
      arguments: declaration,
      name: SEQUENCE_BEGIN_WORKBENCH_PAYLOAD_UPLOAD_TOOL_NAME,
    },
    signal,
  );
  const progress = sequenceWorkbenchPayloadUploadProgressSchema.parse(
    begin.structuredContent,
  );
  if (declaration.byteLength > progress.maxWorkspaceArtifactBytes) {
    throw new Error("The server workspace-output quota changed before upload.");
  }
  const chunkBytes = assertProgress(
    progress,
    declaration,
    declaration.byteLength,
  );
  let acknowledged = progress.receivedBytes;
  if (acknowledged < declaration.byteLength) {
    for await (const chunk of sequenceWorkspaceUploadChunks(createChunks, {
      maxChunkBytes: chunkBytes,
      signal,
      startOffset: acknowledged,
      totalBytes: declaration.byteLength,
    })) {
      const appended = await callServerToolWithRetry(
        app,
        {
          arguments: {
            ...persistenceIdentity(declaration),
            dataBase64: bytesToBase64(chunk.bytes),
            offset: chunk.offset,
          },
          name: SEQUENCE_APPEND_WORKBENCH_PAYLOAD_CHUNK_TOOL_NAME,
        },
        signal,
      );
      const accepted = sequenceWorkbenchPayloadUploadProgressSchema.parse(
        appended.structuredContent,
      );
      if (
        assertProgress(accepted, declaration, declaration.byteLength) !==
          chunkBytes ||
        accepted.receivedBytes !== chunk.offset + chunk.bytes.byteLength
      ) {
        throw new Error("The workbench upload returned inconsistent progress.");
      }
      acknowledged = accepted.receivedBytes;
    }
  }
  if (acknowledged !== declaration.byteLength) {
    throw new Error("The workspace export producer ended before completion.");
  }
  const finished = await callServerToolWithRetry(
    app,
    {
      arguments: persistenceIdentity(declaration),
      name: SEQUENCE_FINISH_WORKBENCH_PAYLOAD_UPLOAD_TOOL_NAME,
    },
    signal,
  );
  return assertCompletedResult(finished.structuredContent, declaration);
}

export async function persistSequenceCommandResult(
  app: Pick<App, "callServerTool">,
  {
    command,
    result,
    sessionId,
    signal,
  }: {
    command: QueuedSequenceViewerCommand;
    result: SequenceViewerCommandResult;
    sessionId: string;
    signal?: AbortSignal;
  },
): Promise<SequenceViewerCommandResult> {
  if (!result.applied) return result;
  if (command.action === "export_artifact") {
    const artifact = preparedArtifactSchema.parse(result.state?.artifact);
    const provenance = provenanceSchema.parse(result.state?.provenance);
    const destination = command.destination ?? { kind: "private" as const };
    const persisted = await persistSequenceWorkbenchPayload(app, {
      commandId: command.commandId,
      content: artifact.content,
      destination,
      format: artifact.format,
      kind: "artifact",
      mediaType: artifact.mediaType,
      name:
        destination.kind === "workspace"
          ? workspaceDestinationName(destination.relativePath)
          : artifact.name,
      provenance,
      sessionId,
      signal,
    });
    if (persisted.kind !== "artifact") {
      throw new Error("The workbench persistence result kind is inconsistent.");
    }
    const { kind: _kind, ...metadata } = persisted;
    return {
      ...result,
      state: { artifact: metadata, provenance },
    };
  }
  if (command.action === "save_session") {
    const session = z.string().parse(result.state?.session);
    const persisted = await persistSequenceWorkbenchPayload(app, {
      commandId: command.commandId,
      content: session,
      kind: "session",
      name: command.name,
      sessionId,
      signal,
    });
    if (persisted.kind !== "session") {
      throw new Error("The workbench persistence result kind is inconsistent.");
    }
    const { kind: _kind, ...metadata } = persisted;
    return { ...result, state: { session: metadata } };
  }
  return result;
}

async function uploadAttempt(
  app: Pick<App, "callServerTool">,
  declaration: SequenceWorkbenchPayloadDeclaration,
  bytes: Uint8Array,
  signal?: AbortSignal,
): Promise<SequenceWorkbenchPersistenceResult> {
  const begin = await callServerToolWithRetry(
    app,
    {
      arguments: declaration,
      name: SEQUENCE_BEGIN_WORKBENCH_PAYLOAD_UPLOAD_TOOL_NAME,
    },
    signal,
  );
  const progress = sequenceWorkbenchPayloadUploadProgressSchema.parse(
    begin.structuredContent,
  );
  const chunkBytes = assertProgress(progress, declaration, bytes.byteLength);
  let offset = progress.receivedBytes;
  while (offset < bytes.byteLength) {
    throwIfAborted(signal);
    const end = Math.min(offset + chunkBytes, bytes.byteLength);
    const appended = await callServerToolWithRetry(
      app,
      {
        arguments: {
          callerId: declaration.callerId,
          commandId: declaration.commandId,
          dataBase64: bytesToBase64(bytes.subarray(offset, end)),
          offset,
          sessionId: declaration.sessionId,
          uploadId: declaration.uploadId,
        },
        name: SEQUENCE_APPEND_WORKBENCH_PAYLOAD_CHUNK_TOOL_NAME,
      },
      signal,
    );
    const accepted = sequenceWorkbenchPayloadUploadProgressSchema.parse(
      appended.structuredContent,
    );
    if (
      assertProgress(accepted, declaration, bytes.byteLength) !== chunkBytes ||
      accepted.receivedBytes < end
    ) {
      throw new Error("The workbench upload returned inconsistent progress.");
    }
    offset = accepted.receivedBytes;
  }
  throwIfAborted(signal);
  const finished = await callServerToolWithRetry(
    app,
    {
      arguments: persistenceIdentity(declaration),
      name: SEQUENCE_FINISH_WORKBENCH_PAYLOAD_UPLOAD_TOOL_NAME,
    },
    signal,
  );
  return assertCompletedResult(finished.structuredContent, declaration);
}

async function reconcileFailure(
  app: Pick<App, "callServerTool">,
  declaration: SequenceWorkbenchPayloadDeclaration,
  originalError: unknown,
): Promise<SequenceWorkbenchPersistenceResult> {
  let response: Awaited<ReturnType<App["callServerTool"]>>;
  try {
    response = await callServerToolWithRetry(app, {
      arguments: persistenceIdentity(declaration),
      name: SEQUENCE_ABORT_WORKBENCH_PAYLOAD_UPLOAD_TOOL_NAME,
    });
  } catch (abortError) {
    if (isAbortError(originalError)) throw abortError;
    throw originalError;
  }
  const aborted = sequenceAbortWorkbenchPayloadUploadResultSchema.parse(
    response.structuredContent,
  );
  if (aborted.uploadId !== declaration.uploadId) {
    throw new Error(
      "The workbench upload returned an inconsistent abort result.",
    );
  }
  if (aborted.result != null) {
    return assertCompletedResult(aborted.result, declaration);
  }
  throw originalError;
}

function assertCompletedResult(
  value: unknown,
  declaration: SequenceWorkbenchPayloadDeclaration,
): SequenceWorkbenchPersistenceResult {
  const result = sequenceWorkbenchPersistenceResultSchema.parse(value);
  const workspaceSession = result.kind === "session" && "destination" in result;
  if (result.kind !== declaration.kind) {
    throw new Error("The workbench persistence result is inconsistent.");
  }
  if (workspaceSession) {
    if (
      declaration.destination.kind !== "workspace" ||
      result.payloadSize !== declaration.byteLength ||
      result.payloadSha256 !== declaration.sha256
    ) {
      throw new Error("The workspace session payload result is inconsistent.");
    }
  } else if (
    result.size !== declaration.byteLength ||
    result.sha256 !== declaration.sha256
  ) {
    throw new Error("The workbench persistence result is inconsistent.");
  }
  if (
    result.kind === "artifact" &&
    (result.format !== declaration.format ||
      result.mediaType !== declaration.mediaType)
  ) {
    throw new Error("The persisted artifact metadata is inconsistent.");
  }
  if (result.kind === "artifact") {
    const isWorkspaceResult = "destination" in result;
    if ((declaration.destination.kind === "workspace") !== isWorkspaceResult) {
      throw new Error("The persisted artifact destination is inconsistent.");
    }
    if (isWorkspaceResult) {
      const workspaceDestination =
        declaration.destination.kind === "workspace"
          ? declaration.destination
          : undefined;
      if (
        workspaceDestination == null ||
        !isExpectedWorkspaceResultName(
          declaration.name,
          result.name,
          workspaceDestination.collisionPolicy ?? "exact",
        ) ||
        result.outputWorkspacePath.split("/").at(-1) !== result.name ||
        result.provenanceWorkspacePath !==
          `${result.outputWorkspacePath}.provenance.json`
      ) {
        throw new Error(
          "The persisted workspace artifact binding is inconsistent.",
        );
      }
    } else if (result.name !== declaration.name) {
      throw new Error("The persisted artifact name is inconsistent.");
    }
  } else if (workspaceSession) {
    if (
      !isExpectedWorkspaceResultName(
        declaration.name,
        result.name,
        declaration.destination.kind === "workspace"
          ? (declaration.destination.collisionPolicy ?? "exact")
          : "exact",
      ) ||
      result.outputWorkspacePath.split("/").at(-1) !== result.name ||
      result.provenanceWorkspacePath !==
        `${result.outputWorkspacePath}.provenance.json`
    ) {
      throw new Error(
        "The persisted workspace session binding is inconsistent.",
      );
    }
  } else if (result.name !== declaration.name) {
    throw new Error("The persisted session name is inconsistent.");
  }
  return result;
}

function isExpectedWorkspaceResultName(
  requestedName: string,
  resultName: string,
  collisionPolicy: "exact" | "next-version",
): boolean {
  if (resultName === requestedName) return true;
  if (collisionPolicy !== "next-version") return false;
  const extensionIndex = requestedName.lastIndexOf(".");
  for (
    let attempt = 2;
    attempt <= SEQUENCE_VIEWER_LIMITS.workspace.maxVersionAttempts;
    attempt += 1
  ) {
    const candidate =
      extensionIndex <= 0
        ? `${requestedName}-${attempt}`
        : `${requestedName.slice(0, extensionIndex)}-${attempt}${requestedName.slice(extensionIndex)}`;
    if (resultName === candidate) return true;
  }
  return false;
}

function workspaceDestinationName(relativePath: string): string {
  const name = relativePath.split("/").at(-1);
  if (name == null || name.length === 0) {
    throw new Error("The workspace export destination has no filename.");
  }
  return name;
}

function assertProgress(
  progress: z.infer<typeof sequenceWorkbenchPayloadUploadProgressSchema>,
  declaration: SequenceWorkbenchPayloadDeclaration,
  totalBytes: number,
): number {
  const chunkBytes = Math.min(
    progress.maxChunkBytes,
    SEQUENCE_VIEWER_LIMITS.persistence.maxChunkBytes,
  );
  if (
    progress.uploadId !== declaration.uploadId ||
    progress.receivedBytes > totalBytes ||
    (progress.receivedBytes < totalBytes &&
      progress.receivedBytes % chunkBytes !== 0)
  ) {
    throw new Error("The workbench upload returned inconsistent progress.");
  }
  return chunkBytes;
}

function persistenceIdentity(declaration: SequenceWorkbenchPayloadDeclaration) {
  return {
    callerId: declaration.callerId,
    commandId: declaration.commandId,
    sessionId: declaration.sessionId,
    uploadId: declaration.uploadId,
  };
}

async function callServerToolWithRetry(
  app: Pick<App, "callServerTool">,
  request: Parameters<App["callServerTool"]>[0],
  signal?: AbortSignal,
): Promise<Awaited<ReturnType<App["callServerTool"]>>> {
  assertProxySafeRequest(request);
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      throwIfAborted(signal);
      const response =
        signal == null
          ? await app.callServerTool(request)
          : await app.callServerTool(request, { signal });
      if (response.isError === true) {
        const message = response.content
          ?.filter(
            (item): item is Extract<typeof item, { type: "text" }> =>
              item.type === "text",
          )
          .map(({ text }) => text.trim())
          .filter((text) => text.length > 0)
          .join("\n");
        throw new Error(
          message || `The ${request.name} server tool reported an error.`,
        );
      }
      return response;
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

export function encodedSequenceToolRequestBytes(
  request: Parameters<App["callServerTool"]>[0],
): number {
  return new TextEncoder().encode(
    JSON.stringify({ arguments: request.arguments ?? {}, name: request.name }),
  ).byteLength;
}

function assertProxySafeRequest(
  request: Parameters<App["callServerTool"]>[0],
): void {
  const byteLength = encodedSequenceToolRequestBytes(request);
  if (byteLength > SEQUENCE_VIEWER_LIMITS.persistence.proxyEnvelopeBytes) {
    throw new Error(
      `The workbench persistence request is ${byteLength.toLocaleString()} bytes and exceeds the ${SEQUENCE_VIEWER_LIMITS.persistence.proxyEnvelopeBytes.toLocaleString()}-byte proxy envelope.`,
    );
  }
}

export function isRetryableSequencePersistenceError(error: unknown): boolean {
  if (isAbortError(error)) return false;
  const message =
    error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  return /connection|disconnected|econn|network|proxy|socket|stream|timeout|timed out|transport|failed to fetch/i.test(
    message,
  );
}

function isAbortError(error: unknown): boolean {
  return (
    (error instanceof DOMException && error.name === "AbortError") ||
    (error instanceof Error && error.name === "AbortError")
  );
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw (
      signal.reason ?? new DOMException("Operation cancelled.", "AbortError")
    );
  }
}

async function abortableDelay(
  delayMs: number,
  signal?: AbortSignal,
): Promise<void> {
  throwIfAborted(signal);
  await new Promise<void>((resolve, reject) => {
    const finish = (callback: () => void) => {
      signal?.removeEventListener("abort", onAbort);
      callback();
    };
    const timer = setTimeout(() => finish(resolve), delayMs);
    const onAbort = () => {
      clearTimeout(timer);
      finish(() =>
        reject(
          signal?.reason ??
            new DOMException("Operation cancelled.", "AbortError"),
        ),
      );
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

function bytesToBase64(bytes: Uint8Array): string {
  let encoded = "";
  // Keep the transient binary string small. The chunk size is divisible by
  // three so padding appears only on the final fragment.
  const chunkSize = 24 * 1_024;
  for (let offset = 0; offset < bytes.byteLength; offset += chunkSize) {
    const chunk = bytes.subarray(offset, offset + chunkSize);
    encoded += btoa(String.fromCharCode(...chunk));
  }
  return encoded;
}

async function sha256Bytes(bytes: Uint8Array): Promise<string> {
  const digestInput =
    bytes.buffer instanceof ArrayBuffer
      ? new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength)
      : Uint8Array.from(bytes);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", digestInput);
  return [...new Uint8Array(digest)]
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
}

async function deterministicUuid(value: string): Promise<string> {
  const digest = new Uint8Array(
    await globalThis.crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(value),
    ),
  ).slice(0, 16);
  digest[6] = ((digest[6] ?? 0) & 0x0f) | 0x40;
  digest[8] = ((digest[8] ?? 0) & 0x3f) | 0x80;
  const hex = [...digest]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(
    12,
    16,
  )}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function stringWorkspaceProducer(
  value: string,
): SequenceWorkspaceChunkProducer {
  return async function* () {
    yield value;
  };
}
