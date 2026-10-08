import { createHash } from "node:crypto";
import { constants } from "node:fs";
import {
  type FileHandle,
  lstat,
  mkdtemp,
  open,
  readFile,
  rm,
  statfs,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createGunzip } from "node:zlib";

import type { RootsRequestExtra } from "./chat-file-resource";
import {
  createIncrementalExportValidator,
  IncrementalSequenceExportValidator,
} from "./incremental-export-validator";
import { SEQUENCE_VIEWER_LIMITS, utf8ByteLength } from "./runtime-contract";
import type { createServerWorkbenchStore } from "./server-workbench-store";
import { parseAndValidateWorkbenchSession } from "./workbench-session-validation";
import {
  sequenceAppendWorkbenchPayloadChunkInputSchema,
  sequenceBeginWorkbenchPayloadUploadInputSchema,
  sequenceFinishWorkbenchPayloadUploadInputSchema,
  sequenceGenerateWorkspaceExportInputSchema,
  sequencePersistWorkbenchPayloadInputSchema,
  sequenceWorkbenchPersistenceResultSchema,
  type SequenceWorkbenchPayloadDeclaration,
  type SequenceWorkbenchPersistenceResult,
  type SequenceGenerateWorkspaceExportInput,
  type SequenceWorkspacePublicationMetrics,
} from "./workbench-persistence-protocol";
import {
  SequenceWorkspaceExportPublisher,
  safeSequenceWorkspacePublicationError,
  type PreparedSequenceWorkspaceExport,
  type SequenceWorkspaceFileIdentity,
  type SequenceWorkspacePublicationResult,
} from "./workspace-export-publisher";
import type { SequenceWorkspaceStagedIdentity } from "./workspace-atomic-publisher";
import { createSequenceWorkspaceSessionManifest } from "./workspace-session-manager";

type WorkbenchStore = ReturnType<typeof createServerWorkbenchStore>;

type AcceptedChunk = {
  byteLength: number;
  offset: number;
  sha256: string;
};

type ActiveUpload = {
  abortController: AbortController;
  chunks: Array<AcceptedChunk>;
  destroyed: boolean;
  digest: ReturnType<typeof createHash>;
  expiresAt: number;
  file: FileHandle;
  fileClosed: boolean;
  finalDigest?: string;
  finalization?: Promise<SequenceWorkbenchPersistenceResult>;
  fingerprint: string;
  input: SequenceWorkbenchPayloadDeclaration;
  operation: Promise<void>;
  peakRetainedBytes: number;
  receivedBytes: number;
  retryCount: number;
  startedAt: number;
  stagingPath: string;
  stagingIdentity: SequenceWorkspaceStagedIdentity;
  validateElapsedMs: number;
  validationFinished: boolean;
  validator?: IncrementalSequenceExportValidator;
  workspaceStagedBytes: number;
  workspacePlan?: PreparedSequenceWorkspaceExport;
};

type PendingUpload = {
  abortController: AbortController;
  fingerprint: string;
  input: SequenceWorkbenchPayloadDeclaration;
  promise: Promise<ActiveUpload>;
};

type CompletedUpload = {
  expiresAt: number;
  fingerprint: string;
  input: SequenceWorkbenchPayloadDeclaration;
  result: SequenceWorkbenchPersistenceResult;
  workspacePlan?: PreparedSequenceWorkspaceExport;
};

type GeneratedWorkspaceExport = {
  expiresAt: number;
  fingerprint: string;
  plan: PreparedSequenceWorkspaceExport;
  result: SequenceWorkbenchPersistenceResult;
};

type PendingGeneratedWorkspaceExport = {
  abortController: AbortController;
  fingerprint: string;
  promise: Promise<SequenceWorkbenchPersistenceResult>;
};

export type SequenceWorkbenchUploadScheduler = {
  clearTimeout: (timer: ReturnType<typeof setTimeout>) => void;
  setTimeout: (
    callback: () => void,
    delayMs: number,
  ) => ReturnType<typeof setTimeout>;
};

type SequenceWorkbenchUploadOptions = {
  createStagingDirectory?: () => Promise<string>;
  getAvailableWorkspaceBytes?: (directory: string) => Promise<number>;
  maxWorkspaceArtifactBytes?: number;
  maxWorkspaceStagingBytes?: number;
  minWorkspaceFreeBytes?: number;
  now?: () => number;
  scheduler?: SequenceWorkbenchUploadScheduler;
  workspacePublisher?: SequenceWorkspaceExportPublisher;
};

const defaultScheduler: SequenceWorkbenchUploadScheduler = {
  clearTimeout: (timer) => clearTimeout(timer),
  setTimeout: (callback, delayMs) => setTimeout(callback, delayMs),
};

const mediaTypeByFormat = {
  a3m: "text/x-a3m",
  "aligned-fasta": "text/x-fasta",
  bed: "text/x-bed",
  clustal: "text/x-clustal",
  csv: "text/csv",
  embl: "text/x-embl",
  fasta: "text/x-fasta",
  fastq: "text/x-fastq",
  genbank: "text/x-genbank",
  gff3: "text/x-gff3",
  gtf: "text/x-gtf",
  json: "application/json",
  newick: "text/x-newick",
  pdf: "application/pdf",
  stockholm: "text/x-stockholm",
  svg: "image/svg+xml",
  tsv: "text/tab-separated-values",
  vcf: "text/x-vcf",
} as const satisfies Record<
  NonNullable<SequenceWorkbenchPayloadDeclaration["format"]>,
  string
>;

export class SequenceWorkbenchUploadStore {
  private readonly active = new Map<string, ActiveUpload>();
  private activeBytes = 0;
  private workspaceStagedBytes = 0;
  private cleanupTimer?: ReturnType<typeof setTimeout>;
  private readonly completed = new Map<string, CompletedUpload>();
  private readonly completedGenerations = new Map<
    string,
    GeneratedWorkspaceExport
  >();
  private disposal?: Promise<void>;
  private disposed = false;
  private readonly pending = new Map<string, PendingUpload>();
  private readonly pendingGenerations = new Map<
    string,
    PendingGeneratedWorkspaceExport
  >();
  private stagingDirectoryPromise?: Promise<string>;
  private readonly createStagingDirectory: () => Promise<string>;
  private readonly getAvailableWorkspaceBytes: (directory: string) => Promise<number>;
  private readonly maxWorkspaceArtifactBytes: number;
  private readonly maxWorkspaceStagingBytes: number;
  private readonly minWorkspaceFreeBytes: number;
  private readonly now: () => number;
  private readonly scheduler: SequenceWorkbenchUploadScheduler;
  private readonly workspacePublisher?: SequenceWorkspaceExportPublisher;

  constructor(
    private readonly workbenchStore: WorkbenchStore,
    {
      createStagingDirectory = () =>
        mkdtemp(path.join(os.tmpdir(), "sequence-viewer-workbench-uploads-")),
      getAvailableWorkspaceBytes = availableFilesystemBytes,
      maxWorkspaceArtifactBytes = SEQUENCE_VIEWER_LIMITS.workspace.maxArtifactBytes,
      maxWorkspaceStagingBytes =
        SEQUENCE_VIEWER_LIMITS.workspace.maxAggregateStagingBytes,
      minWorkspaceFreeBytes =
        SEQUENCE_VIEWER_LIMITS.workspace.minFreeBytesAfterStaging,
      now = Date.now,
      scheduler = defaultScheduler,
      workspacePublisher,
    }: SequenceWorkbenchUploadOptions = {},
  ) {
    this.createStagingDirectory = createStagingDirectory;
    this.getAvailableWorkspaceBytes = getAvailableWorkspaceBytes;
    this.maxWorkspaceArtifactBytes = assertWorkspaceLimit(
      "maxWorkspaceArtifactBytes",
      maxWorkspaceArtifactBytes,
      1_024 * 1_024 * 1_024,
    );
    this.maxWorkspaceStagingBytes = assertWorkspaceLimit(
      "maxWorkspaceStagingBytes",
      maxWorkspaceStagingBytes,
      this.maxWorkspaceArtifactBytes,
    );
    this.minWorkspaceFreeBytes = assertWorkspaceLimit(
      "minWorkspaceFreeBytes",
      minWorkspaceFreeBytes,
      0,
    );
    this.now = now;
    this.scheduler = scheduler;
    this.workspacePublisher = workspacePublisher;
  }

  async persistOneShot(
    rawInput: unknown,
    extra?: RootsRequestExtra,
  ): Promise<SequenceWorkbenchPersistenceResult> {
    const input = sequencePersistWorkbenchPayloadInputSchema.parse(rawInput);
    const bytes = decodeCanonicalBase64(input.dataBase64);
    if (bytes.byteLength !== input.byteLength) {
      throw new Error(
        "The one-shot payload does not match its declared byte length.",
      );
    }
    const { dataBase64: _dataBase64, ...declaration } = input;
    const progress = await this.begin(declaration, extra);
    if (progress.receivedBytes === 0 && input.byteLength > 0) {
      await this.append(
        {
          callerId: input.callerId,
          commandId: input.commandId,
          dataBase64: input.dataBase64,
          offset: 0,
          sessionId: input.sessionId,
          uploadId: input.uploadId,
        },
        extra,
      );
    } else if (progress.receivedBytes !== input.byteLength) {
      throw new Error(
        "The one-shot payload has inconsistent resumable progress.",
      );
    }
    return await this.finish(
      {
        callerId: input.callerId,
        commandId: input.commandId,
        sessionId: input.sessionId,
        uploadId: input.uploadId,
      },
      extra,
    );
  }

  async generateWorkspaceExport(
    rawInput: unknown,
    extra?: RootsRequestExtra,
    signal?: AbortSignal,
  ): Promise<SequenceWorkbenchPersistenceResult> {
    this.assertOpen();
    const input = sequenceGenerateWorkspaceExportInputSchema.parse(rawInput);
    await this.cleanupExpired();
    const fingerprint = createHash("sha256")
      .update(JSON.stringify(input))
      .digest("hex");
    const completed = this.completedGenerations.get(input.operationId);
    if (completed != null) {
      if (completed.fingerprint !== fingerprint) {
        throw new Error(
          "The workspace generation operation ID is already bound to another export.",
        );
      }
      await this.workspacePublisher?.revalidateCompleted(
        completed.plan,
        workspaceArtifactPublication(completed.result, completed.plan),
        extra,
      );
      completed.expiresAt = this.expiry();
      this.scheduleCleanup();
      return completed.result;
    }
    const pending = this.pendingGenerations.get(input.operationId);
    if (pending != null) {
      if (pending.fingerprint !== fingerprint) {
        throw new Error(
          "The workspace generation operation ID is already bound to another export.",
        );
      }
      return await waitForSignal(pending.promise, signal);
    }
    if (this.workspacePublisher == null) {
      throw new Error("Workspace publication is unavailable for this viewer.");
    }
    if (
      this.active.size +
        this.pending.size +
        this.pendingGenerations.size >=
      SEQUENCE_VIEWER_LIMITS.persistence.maxActiveUploads
    ) {
      throw new Error(
        "Too many workspace export operations are active. Finish or cancel an export and retry.",
      );
    }
    const abortController = new AbortController();
    const removeForwarder = forwardAbort(signal, abortController);
    const promise = this.generateWorkspaceExportInternal(
      input,
      fingerprint,
      extra,
      abortController.signal,
    );
    const pendingGeneration = { abortController, fingerprint, promise };
    this.pendingGenerations.set(input.operationId, pendingGeneration);
    try {
      return await promise;
    } finally {
      removeForwarder();
      if (this.pendingGenerations.get(input.operationId) === pendingGeneration) {
        this.pendingGenerations.delete(input.operationId);
      }
    }
  }

  async begin(rawInput: unknown, extra?: RootsRequestExtra): Promise<{
    maxChunkBytes: number;
    maxWorkspaceArtifactBytes: number;
    receivedBytes: number;
    uploadId: string;
  }> {
    this.assertOpen();
    const input =
      sequenceBeginWorkbenchPayloadUploadInputSchema.parse(rawInput);
    await this.cleanupExpired();
    this.assertOpen();
    const fingerprint = uploadFingerprint(input);

    const completed = this.completed.get(input.uploadId);
    if (completed != null) {
      this.assertBinding(completed.input, input);
      if (completed.fingerprint !== fingerprint) {
        throw new Error(
          "The workbench upload ID is already in use for different data.",
        );
      }
      await this.revalidateCompleted(completed, extra);
      completed.expiresAt = this.expiry();
      this.scheduleCleanup();
      return this.progress(input.uploadId, input.byteLength);
    }

    const existing = this.active.get(input.uploadId);
    if (existing != null) {
      this.assertBinding(existing.input, input);
      if (existing.fingerprint !== fingerprint) {
        throw new Error(
          "The workbench upload ID is already in use for different data.",
        );
      }
      await this.assertWorkspacePlanCurrent(existing.workspacePlan, extra);
      throwIfAborted(existing.abortController.signal);
      return await this.enqueue(existing, async () => {
        this.refresh(existing);
        return this.progress(input.uploadId, existing.receivedBytes);
      });
    }

    const pending = this.pending.get(input.uploadId);
    if (pending != null) {
      this.assertBinding(pending.input, input);
      if (pending.fingerprint !== fingerprint) {
        throw new Error(
          "The workbench upload ID is already in use for different data.",
        );
      }
      throwIfAborted(pending.abortController.signal);
      const upload = await pending.promise;
      await this.assertWorkspacePlanCurrent(upload.workspacePlan, extra);
      this.refresh(upload);
      return this.progress(input.uploadId, upload.receivedBytes);
    }

    if (
      this.active.size + this.pending.size >=
      SEQUENCE_VIEWER_LIMITS.persistence.maxActiveUploads
    ) {
      throw new Error(
        "Too many workbench payload uploads are active. Finish or cancel an upload and retry.",
      );
    }
    if (
      input.destination.kind !== "workspace" &&
      this.activeBytes + input.byteLength >
      SEQUENCE_VIEWER_LIMITS.persistence.maxActiveBytes
    ) {
      throw new Error("The active workbench upload byte budget is exhausted.");
    }

    if (
      input.destination.kind === "workspace" &&
      input.kind === "artifact" &&
      input.byteLength > this.maxWorkspaceArtifactBytes
    ) {
      throw new Error(
        `The workspace export exceeds the ${this.maxWorkspaceArtifactBytes.toLocaleString()}-byte workspace-output quota.`,
      );
    }

    if (input.destination.kind !== "workspace") {
      this.activeBytes += input.byteLength;
    }
    const abortController = new AbortController();
    const promise = this.createUpload(input, fingerprint, abortController, extra);
    const pendingUpload = { abortController, fingerprint, input, promise };
    this.pending.set(input.uploadId, pendingUpload);
    try {
      const upload = await promise;
      return this.progress(input.uploadId, upload.receivedBytes);
    } finally {
      if (this.pending.get(input.uploadId) === pendingUpload) {
        this.pending.delete(input.uploadId);
      }
    }
  }

  async append(rawInput: unknown, extra?: RootsRequestExtra): Promise<{
    maxChunkBytes: number;
    receivedBytes: number;
    uploadId: string;
  }> {
    this.assertOpen();
    const input =
      sequenceAppendWorkbenchPayloadChunkInputSchema.parse(rawInput);
    const chunk = decodeCanonicalBase64(input.dataBase64);
    if (
      chunk.byteLength === 0 ||
      chunk.byteLength > SEQUENCE_VIEWER_LIMITS.persistence.maxChunkBytes
    ) {
      throw new Error(
        `Workbench payload chunks must contain between 1 and ${SEQUENCE_VIEWER_LIMITS.persistence.maxChunkBytes} bytes.`,
      );
    }
    await this.cleanupExpired();
    this.assertOpen();
    const completed = this.completed.get(input.uploadId);
    if (completed != null) {
      this.assertBinding(completed.input, input);
      await this.revalidateCompleted(completed, extra);
      throw new Error("The workbench payload upload is already finalized.");
    }
    const upload = this.getActive(input);
    return await this.enqueue(upload, async () => {
      this.assertActive(upload);
      await this.assertWorkspacePlanCurrent(upload.workspacePlan, extra);
      throwIfAborted(upload.abortController.signal);
      if (upload.finalization != null) {
        throw new Error("The workbench payload upload is being finalized.");
      }
      const chunkSha256 = sha256Bytes(chunk);
      if (input.offset < upload.receivedBytes) {
        const accepted = upload.chunks.find(
          ({ offset }) => offset === input.offset,
        );
        if (
          accepted?.byteLength === chunk.byteLength &&
          accepted.sha256 === chunkSha256
        ) {
          upload.retryCount += 1;
          this.refresh(upload);
          return this.progress(input.uploadId, upload.receivedBytes);
        }
        throw new Error(
          "A retried workbench payload chunk did not match the previously accepted chunk.",
        );
      }
      if (input.offset !== upload.receivedBytes) {
        throw new Error(
          `Expected workbench payload offset ${upload.receivedBytes}, received ${input.offset}.`,
        );
      }
      const expectedBytes = Math.min(
        SEQUENCE_VIEWER_LIMITS.persistence.maxChunkBytes,
        upload.input.byteLength - upload.receivedBytes,
      );
      if (chunk.byteLength !== expectedBytes) {
        throw new Error(
          `Workbench payload chunk at offset ${input.offset} must contain exactly ${expectedBytes} bytes.`,
        );
      }
      if (upload.workspacePlan != null) {
        try {
          await this.reserveWorkspaceCapacity(
            path.dirname(upload.stagingPath),
            chunk.byteLength,
          );
        } catch (error) {
          await this.destroyUpload(upload).catch(() => undefined);
          throw safeWorkbenchUploadError(upload.input, error);
        }
      }
      const validationStarted = this.now();
      try {
        upload.validator?.update(chunk);
        upload.validateElapsedMs += Math.max(0, this.now() - validationStarted);
        await writeChunk(upload.file, chunk, input.offset);
      } catch (error) {
        if (upload.workspacePlan != null) {
          this.workspaceStagedBytes -= chunk.byteLength;
        }
        await this.destroyUpload(upload).catch(() => undefined);
        throw safeWorkbenchUploadError(upload.input, error);
      }
      upload.digest.update(chunk);
      upload.chunks.push({
        byteLength: chunk.byteLength,
        offset: input.offset,
        sha256: chunkSha256,
      });
      upload.receivedBytes += chunk.byteLength;
      if (upload.workspacePlan != null) {
        upload.workspaceStagedBytes += chunk.byteLength;
      }
      upload.peakRetainedBytes = Math.max(
        upload.peakRetainedBytes,
        chunk.byteLength * 4 + (upload.validator?.peakRetainedBytes ?? 0),
      );
      this.refresh(upload);
      return this.progress(input.uploadId, upload.receivedBytes);
    });
  }

  async finish(
    rawInput: unknown,
    extra?: RootsRequestExtra,
  ): Promise<SequenceWorkbenchPersistenceResult> {
    this.assertOpen();
    const input =
      sequenceFinishWorkbenchPayloadUploadInputSchema.parse(rawInput);
    await this.cleanupExpired();
    this.assertOpen();
    const completed = this.completed.get(input.uploadId);
    if (completed != null) {
      this.assertBinding(completed.input, input);
      await this.revalidateCompleted(completed, extra);
      completed.expiresAt = this.expiry();
      this.scheduleCleanup();
      return completed.result;
    }
    const upload = this.getActive(input);
    return await this.enqueue(upload, async () => {
      const completedAfterWait = this.completed.get(input.uploadId);
      if (completedAfterWait != null) {
        await this.revalidateCompleted(completedAfterWait, extra);
        return completedAfterWait.result;
      }
      this.assertActive(upload);
      await this.assertWorkspacePlanCurrent(upload.workspacePlan, extra);
      throwIfAborted(upload.abortController.signal);
      if (upload.receivedBytes !== upload.input.byteLength) {
        throw new Error(
          `The workbench payload upload is incomplete (${upload.receivedBytes} of ${upload.input.byteLength} bytes).`,
        );
      }
      if (upload.finalization != null) return await upload.finalization;
      this.refresh(upload);
      const finalization = this.commit(upload, extra).catch((error) => {
        throw safeWorkbenchUploadError(upload.input, error);
      });
      upload.finalization = finalization;
      try {
        return await finalization;
      } finally {
        upload.finalization = undefined;
      }
    });
  }

  async abort(rawInput: unknown, extra?: RootsRequestExtra): Promise<{
    aborted: boolean;
    result?: SequenceWorkbenchPersistenceResult;
    uploadId: string;
  }> {
    const input =
      sequenceFinishWorkbenchPayloadUploadInputSchema.parse(rawInput);
    const completed = this.completed.get(input.uploadId);
    if (completed != null) {
      this.assertBinding(completed.input, input);
      await this.revalidateCompleted(completed, extra);
      return {
        aborted: false,
        result: completed.result,
        uploadId: input.uploadId,
      };
    }
    const pending = this.pending.get(input.uploadId);
    if (pending != null) {
      this.assertBinding(pending.input, input);
      pending.abortController.abort(uploadCancellationReason());
      const materialized = await pending.promise.catch(() => undefined);
      const committed = this.completed.get(input.uploadId);
      if (committed != null) {
        await this.revalidateCompleted(committed, extra);
        return {
          aborted: false,
          result: committed.result,
          uploadId: input.uploadId,
        };
      }
      if (
        materialized != null &&
        this.active.get(input.uploadId) === materialized
      ) {
        await this.enqueue(
          materialized,
          async () => {
            try {
              await this.destroyUpload(materialized);
            } catch (error) {
              throw safeWorkbenchUploadError(materialized.input, error);
            }
          },
        );
      }
      return { aborted: true, uploadId: input.uploadId };
    }
    const upload = this.active.get(input.uploadId);
    if (upload == null) return { aborted: false, uploadId: input.uploadId };
    this.assertBinding(upload.input, input);
    upload.abortController.abort(uploadCancellationReason());
    const finalization = upload.finalization;
    if (finalization != null) await finalization.catch(() => undefined);
    const committed = this.completed.get(input.uploadId);
    if (committed != null) {
      await this.revalidateCompleted(committed, extra);
      return {
        aborted: false,
        result: committed.result,
        uploadId: input.uploadId,
      };
    }
    await this.enqueue(upload, async () => {
      try {
        await this.destroyUpload(upload);
      } catch (error) {
        throw safeWorkbenchUploadError(upload.input, error);
      }
    });
    return { aborted: true, uploadId: input.uploadId };
  }

  async cleanupExpired(): Promise<void> {
    this.clearCleanupTimer();
    const now = this.now();
    for (const [uploadId, completed] of this.completed) {
      if (completed.expiresAt <= now) this.completed.delete(uploadId);
    }
    for (const [operationId, completed] of this.completedGenerations) {
      if (completed.expiresAt <= now) {
        this.completedGenerations.delete(operationId);
      }
    }
    await Promise.allSettled(
      [...this.active.values()]
        .filter(
          (upload) => upload.expiresAt <= now && upload.finalization == null,
        )
        .map(async (upload) => {
          upload.abortController.abort(uploadCancellationReason());
          await this.enqueue(
            upload,
            async () => await this.destroyUpload(upload),
          );
        }),
    );
    this.scheduleCleanup();
  }

  dispose(): Promise<void> {
    if (this.disposal == null) {
      this.disposed = true;
      this.clearCleanupTimer();
      for (const pending of this.pending.values()) {
        pending.abortController.abort(uploadCancellationReason());
      }
      for (const pending of this.pendingGenerations.values()) {
        pending.abortController.abort(uploadCancellationReason());
      }
      for (const upload of this.active.values()) {
        upload.abortController.abort(uploadCancellationReason());
      }
      this.disposal = this.disposeInternal();
    }
    return this.disposal;
  }

  get activeUploads(): number {
    return this.active.size + this.pending.size;
  }

  get workspaceArtifactLimit(): number {
    return this.maxWorkspaceArtifactBytes;
  }

  get workspaceStagingUsage(): number {
    return this.workspaceStagedBytes;
  }

  private async commit(
    upload: ActiveUpload,
    extra?: RootsRequestExtra,
  ): Promise<SequenceWorkbenchPersistenceResult> {
    throwIfAborted(upload.abortController.signal);
    const stagedStat = await upload.file.stat({ bigint: true });
    if (
      !stagedStat.isFile() ||
      stagedStat.dev.toString() !== upload.stagingIdentity.device ||
      stagedStat.ino.toString() !== upload.stagingIdentity.inode ||
      Number(stagedStat.size) !== upload.input.byteLength
    ) {
      throw new Error("The staged workbench payload length is inconsistent.");
    }
    if (!upload.validationFinished) {
      const validationStarted = this.now();
      upload.validator?.finish();
      upload.validateElapsedMs += Math.max(0, this.now() - validationStarted);
      upload.validationFinished = true;
    }
    upload.finalDigest ??= upload.digest.digest("hex");
    if (upload.finalDigest !== upload.input.sha256) {
      throw new Error(
        "The staged workbench payload SHA-256 digest does not match.",
      );
    }
    await upload.file.sync();
    throwIfAborted(upload.abortController.signal);

    let result: SequenceWorkbenchPersistenceResult;
    if (upload.input.kind === "artifact") {
      if (upload.input.destination.kind === "workspace") {
        if (this.workspacePublisher == null || upload.workspacePlan == null) {
          throw new Error("Workspace publication is unavailable for this viewer.");
        }
        try {
          const publishStarted = this.now();
          const metrics = this.workspaceMetrics(upload, publishStarted);
          result = sequenceWorkbenchPersistenceResultSchema.parse({
            ...(await this.workspacePublisher.publishStaged(
              upload.workspacePlan,
              upload.stagingPath,
              stagingIdentityFromStat(stagedStat),
              upload.input.byteLength,
              upload.input.sha256,
              metrics,
              upload.abortController.signal,
              extra,
            )),
            kind: "artifact",
          });
        } catch (error) {
          throw safeSequenceWorkspacePublicationError(error);
        }
      } else {
        const { bytes, content } = await this.readBoundedPayload(upload);
        if (bytes.byteLength !== upload.input.byteLength) {
          throw new Error("The staged workbench payload length is inconsistent.");
        }
        validatePayload(upload.input, content, bytes);
        result = sequenceWorkbenchPersistenceResultSchema.parse({
          ...(await this.workbenchStore.persistArtifact({
            content,
            format: upload.input.format as keyof typeof mediaTypeByFormat,
            mediaType: upload.input.mediaType as string,
            name: upload.input.name,
          })),
          kind: "artifact",
        });
      }
    } else if (upload.input.destination.kind === "workspace") {
      if (this.workspacePublisher == null || upload.workspacePlan == null) {
        throw new Error("Workspace publication is unavailable for this viewer.");
      }
      const { content } = await this.readBoundedPayload(upload);
      validatePayload(upload.input, content);
      const prepared = await createSequenceWorkspaceSessionManifest(
        content,
        upload.workspacePlan,
        upload.abortController.signal,
      );
      let publication: SequenceWorkspacePublicationResult;
      try {
        publication = await this.workspacePublisher.publish(
          upload.workspacePlan,
          prepared.bytes,
          prepared.sha256,
          upload.abortController.signal,
          extra,
        );
      } catch (error) {
        throw safeSequenceWorkspacePublicationError(error);
      }
      result = sequenceWorkbenchPersistenceResultSchema.parse({
        destination: publication.destination,
        kind: "session",
        name: publication.name,
        outputWorkspacePath: publication.outputWorkspacePath,
        payloadSha256: upload.input.sha256,
        payloadSize: upload.input.byteLength,
        provenanceWorkspacePath: publication.provenanceWorkspacePath,
        sha256: publication.sha256,
        size: publication.size,
        version: 1,
      });
    } else {
      const { content } = await this.readBoundedPayload(upload);
      validatePayload(upload.input, content);
      const saved = await this.workbenchStore.saveSession({
        name: upload.input.name,
        session: content,
      });
      result = sequenceWorkbenchPersistenceResultSchema.parse({
        kind: "session",
        name: saved.name,
        savedSessionId: saved.id,
        sha256: saved.sha256,
        size: saved.size,
      });
    }

    this.completed.set(upload.input.uploadId, {
      expiresAt: this.expiry(),
      fingerprint: upload.fingerprint,
      input: upload.input,
      result,
      workspacePlan: upload.workspacePlan,
    });
    this.scheduleCleanup();
    await this.destroyUpload(upload).catch(() => undefined);
    return result;
  }

  private async generateWorkspaceExportInternal(
    input: SequenceGenerateWorkspaceExportInput,
    fingerprint: string,
    extra?: RootsRequestExtra,
    signal?: AbortSignal,
  ): Promise<SequenceWorkbenchPersistenceResult> {
    const publisher = this.workspacePublisher;
    if (publisher == null) {
      throw new Error("Workspace publication is unavailable for this viewer.");
    }
    throwIfAborted(signal);
    const declaration: SequenceWorkbenchPayloadDeclaration = {
      byteLength: 0,
      callerId: input.callerId,
      commandId: input.commandId,
      destination: input.destination,
      format: input.format,
      kind: "artifact",
      mediaType: input.mediaType,
      name: input.name,
      provenance: input.provenance,
      sessionId: input.sessionId,
      sha256: "0".repeat(64),
      uploadId: input.operationId,
    };
    const plan = await publisher.prepare(declaration, signal, extra);
    if (plan == null) throw new Error("Workspace export preparation failed.");
    const binding = await publisher.getActiveSourceBinding(input.sessionId, extra);
    if (binding.bindingId !== plan.bindingId) {
      throw new Error("The workspace source binding changed before generation.");
    }
    const stagingPath = path.join(
      plan.parentPath,
      `.${path.basename(plan.outputPath)}.${input.operationId}.generate.tmp`,
    );
    let stagingFile: FileHandle | undefined;
    let sourceFile: FileHandle | undefined;
    let stagingIdentity: SequenceWorkspaceStagedIdentity | undefined;
    let stagedBytes = 0;
    try {
      await publisher.assertPlanCurrent(plan, extra);
      stagingFile = await open(
        stagingPath,
        constants.O_RDWR |
          constants.O_CREAT |
          constants.O_EXCL |
          constants.O_NOFOLLOW,
        0o600,
      );
      const initialStagingStat = await stagingFile.stat({ bigint: true });
      if (
        !initialStagingStat.isFile() ||
        initialStagingStat.nlink !== 1n ||
        (process.platform !== "win32" &&
          (initialStagingStat.mode & 0o777n) !== 0o600n)
      ) {
        throw new Error("Server-generated staging is not private.");
      }
      stagingIdentity = stagingIdentityFromStat(initialStagingStat);
      sourceFile = await open(
        binding.sourcePath,
        constants.O_RDONLY | constants.O_NOFOLLOW,
      );
      await assertBoundSourceHandle(sourceFile, binding.sourceIdentity);
      const compression = await resolveSourceCompression(
        sourceFile,
        input.source.compression,
      );
      const validator = createIncrementalExportValidator(declaration)!;
      const digest = createHash("sha256");
      let chunkCount = 0;
      let peakRetainedBytes = 0;
      const startedAt = this.now();
      for await (const chunk of sourceOutputChunks(
        sourceFile,
        compression,
        signal,
      )) {
        throwIfAborted(signal);
        if (stagedBytes + chunk.byteLength > this.maxWorkspaceArtifactBytes) {
          throw new Error(
            "The server-generated export exceeds the workspace-output quota.",
          );
        }
        await this.reserveWorkspaceCapacity(plan.parentPath, chunk.byteLength);
        try {
          validator.update(chunk);
          await writeChunk(stagingFile, chunk, stagedBytes);
        } catch (error) {
          this.workspaceStagedBytes -= chunk.byteLength;
          throw error;
        }
        digest.update(chunk);
        stagedBytes += chunk.byteLength;
        chunkCount += 1;
        peakRetainedBytes = Math.max(
          peakRetainedBytes,
          chunk.byteLength * 4 + validator.peakRetainedBytes,
        );
      }
      validator.finish();
      await stagingFile.sync();
      await assertBoundSourceHandle(sourceFile, binding.sourceIdentity);
      await publisher.assertPlanCurrent(plan, extra);
      const stagingStat = await stagingFile.stat({ bigint: true });
      if (
        stagingStat.dev.toString() !== stagingIdentity.device ||
        stagingStat.ino.toString() !== stagingIdentity.inode ||
        Number(stagingStat.size) !== stagedBytes
      ) {
        throw new Error("Server-generated staging changed before publication.");
      }
      const sha256 = digest.digest("hex");
      const receive = Math.max(0, this.now() - startedAt);
      const metrics: SequenceWorkspacePublicationMetrics = {
        acceptedBytes: stagedBytes,
        chunkCount,
        committedBytes: stagedBytes,
        elapsedMs: {
          publish: 0,
          receive,
          total: receive,
          validate: receive,
        },
        mode: "server-generated",
        peakRetainedBytes,
        producedBytes: stagedBytes,
        retryCount: 0,
      };
      const publication = await publisher.publishStaged(
        plan,
        stagingPath,
        stagingIdentityFromStat(stagingStat),
        stagedBytes,
        sha256,
        metrics,
        signal ?? new AbortController().signal,
        extra,
      );
      const result = sequenceWorkbenchPersistenceResultSchema.parse({
        ...publication,
        kind: "artifact",
      });
      this.completedGenerations.set(input.operationId, {
        expiresAt: this.expiry(),
        fingerprint,
        plan,
        result,
      });
      this.scheduleCleanup();
      return result;
    } catch (error) {
      throw safeSequenceWorkspacePublicationError(error);
    } finally {
      await sourceFile?.close().catch(() => undefined);
      let cleanupIdentity = stagingIdentity;
      if (stagingFile != null) {
        cleanupIdentity = await stagingFile
          .stat({ bigint: true })
          .then(stagingIdentityFromStat)
          .catch(() => undefined);
      }
      await stagingFile?.close().catch(() => undefined);
      if (cleanupIdentity != null) {
        await removeStagingIfSame(stagingPath, cleanupIdentity).catch(
          () => undefined,
        );
      }
      this.workspaceStagedBytes -= stagedBytes;
    }
  }

  private async readBoundedPayload(upload: ActiveUpload): Promise<{
    bytes: Buffer;
    content: string;
  }> {
    const bytes = await readFile(upload.stagingPath);
    throwIfAborted(upload.abortController.signal);
    const content = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    if (utf8ByteLength(content) !== upload.input.byteLength) {
      throw new Error("The workbench payload is not canonical UTF-8 text.");
    }
    return { bytes, content };
  }

  private workspaceMetrics(
    upload: ActiveUpload,
    publishStarted: number,
  ): SequenceWorkspacePublicationMetrics {
    const receive = Math.max(0, publishStarted - upload.startedAt);
    return {
      acceptedBytes: upload.receivedBytes,
      chunkCount: upload.chunks.length,
      committedBytes: upload.input.byteLength,
      elapsedMs: {
        publish: 0,
        receive,
        total: receive,
        validate: upload.validateElapsedMs,
      },
      mode: "browser-streamed",
      peakRetainedBytes: upload.peakRetainedBytes,
      producedBytes: upload.input.byteLength,
      retryCount: upload.retryCount,
    };
  }

  private async createUpload(
    input: SequenceWorkbenchPayloadDeclaration,
    fingerprint: string,
    abortController: AbortController,
    extra?: RootsRequestExtra,
  ): Promise<ActiveUpload> {
    let file: FileHandle | undefined;
    let stagingPath: string | undefined;
    let stagingIdentity: SequenceWorkspaceStagedIdentity | undefined;
    let upload: ActiveUpload | undefined;
    try {
      throwIfAborted(abortController.signal);
      const workspacePlan =
        input.destination.kind === "workspace"
          ? await this.prepareWorkspaceExport(
              input,
              abortController.signal,
              extra,
            )
          : undefined;
      throwIfAborted(abortController.signal);
      const directory =
        workspacePlan == null
          ? await this.stagingDirectory()
          : workspacePlan.parentPath;
      throwIfAborted(abortController.signal);
      stagingPath =
        workspacePlan == null
          ? path.join(directory, `${input.uploadId}.part`)
          : path.join(
              directory,
              `.${path.basename(workspacePlan.outputPath)}.${input.uploadId}.upload.tmp`,
            );
      await this.assertWorkspacePlanCurrent(workspacePlan, extra);
      file = await open(
        stagingPath,
        constants.O_RDWR |
          constants.O_CREAT |
          constants.O_EXCL |
          constants.O_NOFOLLOW,
        0o600,
      );
      const stagingStat = await file.stat({ bigint: true });
      if (
        !stagingStat.isFile() ||
        stagingStat.nlink !== 1n ||
        (process.platform !== "win32" &&
          (stagingStat.mode & 0o777n) !== 0o600n)
      ) {
        throw new Error("Workbench staging is not a private regular file.");
      }
      stagingIdentity = stagingIdentityFromStat(stagingStat);
      throwIfAborted(abortController.signal);
      upload = {
        abortController,
        chunks: [],
        destroyed: false,
        digest: createHash("sha256"),
        expiresAt: this.expiry(),
        file,
        fileClosed: false,
        fingerprint,
        input,
        operation: Promise.resolve(),
        peakRetainedBytes: 0,
        receivedBytes: 0,
        retryCount: 0,
        startedAt: this.now(),
        stagingPath,
        stagingIdentity,
        validateElapsedMs: 0,
        validationFinished: false,
        validator: createIncrementalExportValidator(input),
        workspaceStagedBytes: 0,
        workspacePlan,
      };
      this.active.set(input.uploadId, upload);
      if (abortController.signal.aborted) {
        await this.destroyUpload(upload);
        throwIfAborted(abortController.signal);
      }
      this.scheduleCleanup();
      return upload;
    } catch (error) {
      if (upload != null) {
        await this.destroyUpload(upload).catch(() => undefined);
      } else {
        let cleanupIdentity = stagingIdentity;
        if (file != null) {
          cleanupIdentity = await file
            .stat({ bigint: true })
            .then(stagingIdentityFromStat)
            .catch(() => undefined);
          await file.close().catch(() => undefined);
        }
        if (stagingPath != null && cleanupIdentity != null) {
          await removeStagingIfSame(stagingPath, cleanupIdentity).catch(
            () => undefined,
          );
        }
        if (input.destination.kind !== "workspace") {
          this.activeBytes -= input.byteLength;
        }
      }
      throw safeWorkbenchUploadError(input, error);
    }
  }

  private async destroyUpload(upload: ActiveUpload): Promise<void> {
    if (upload.destroyed) return;
    let cleanupIdentity = upload.stagingIdentity;
    if (!upload.fileClosed) {
      cleanupIdentity = stagingIdentityFromStat(
        await upload.file.stat({ bigint: true }),
      );
      await upload.file.close();
      upload.fileClosed = true;
    }
    await removeStagingIfSame(upload.stagingPath, cleanupIdentity);
    upload.destroyed = true;
    if (this.active.get(upload.input.uploadId) === upload) {
      this.active.delete(upload.input.uploadId);
    }
    if (upload.input.destination.kind === "workspace") {
      this.workspaceStagedBytes -= upload.workspaceStagedBytes;
      upload.workspaceStagedBytes = 0;
    } else {
      this.activeBytes -= upload.input.byteLength;
    }
  }

  private async disposeInternal(): Promise<void> {
    await Promise.allSettled(
      [...this.pending.values()].map(({ promise }) => promise),
    );
    await Promise.allSettled(
      [...this.pendingGenerations.values()].map(({ promise }) => promise),
    );
    await Promise.allSettled(
      [...this.active.values()].map(async (upload) => {
        await this.enqueue(
          upload,
          async () => await this.destroyUpload(upload),
        );
      }),
    );
    this.completed.clear();
    this.completedGenerations.clear();
    const directory = await this.stagingDirectoryPromise?.catch(
      () => undefined,
    );
    if (directory != null)
      await rm(directory, { force: true, recursive: true });
  }

  private async prepareWorkspaceExport(
    input: SequenceWorkbenchPayloadDeclaration,
    signal: AbortSignal,
    extra?: RootsRequestExtra,
  ): Promise<PreparedSequenceWorkspaceExport> {
    if (this.workspacePublisher == null) {
      throw new Error(
        "Workspace publication is unavailable for this viewer. Reopen a local workspace file and retry.",
      );
    }
    let plan: PreparedSequenceWorkspaceExport | undefined;
    try {
      plan = await this.workspacePublisher.prepare(input, signal, extra);
    } catch (error) {
      throw safeSequenceWorkspacePublicationError(error);
    }
    if (plan == null) {
      throw new Error("The workspace export declaration is inconsistent.");
    }
    return plan;
  }

  private async revalidateCompleted(
    completed: CompletedUpload,
    extra?: RootsRequestExtra,
  ): Promise<void> {
    if (completed.workspacePlan == null) return;
    if (this.workspacePublisher == null) {
      throw new Error("Workspace publication is unavailable for this viewer.");
    }
    const result =
      "destination" in completed.result &&
      completed.result.destination.kind === "workspace"
        ? ({
            destination: completed.result.destination,
            format: completed.workspacePlan.format,
            mediaType: completed.workspacePlan.mediaType,
            metrics:
              "metrics" in completed.result
                ? completed.result.metrics
                : undefined,
            name: completed.result.name,
            outputWorkspacePath: completed.result.outputWorkspacePath,
            provenanceWorkspacePath:
              completed.result.provenanceWorkspacePath,
            sha256: completed.result.sha256,
            size: completed.result.size,
            version: 1,
          } satisfies SequenceWorkspacePublicationResult)
        : undefined;
    try {
      await this.workspacePublisher.revalidateCompleted(
        completed.workspacePlan,
        result,
        extra,
      );
    } catch (error) {
      throw safeSequenceWorkspacePublicationError(error);
    }
  }

  private async assertWorkspacePlanCurrent(
    plan: PreparedSequenceWorkspaceExport | undefined,
    extra?: RootsRequestExtra,
  ): Promise<void> {
    try {
      await this.workspacePublisher?.assertPlanCurrent(plan, extra);
    } catch (error) {
      throw safeSequenceWorkspacePublicationError(error);
    }
  }

  private enqueue<T>(
    upload: ActiveUpload,
    operation: () => Promise<T>,
  ): Promise<T> {
    const result = upload.operation.then(operation, operation);
    upload.operation = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }

  private getActive(input: {
    callerId: string;
    commandId: string;
    sessionId: string;
    uploadId: string;
  }): ActiveUpload {
    const upload = this.active.get(input.uploadId);
    if (upload == null || upload.destroyed) {
      throw new Error(
        "The workbench payload upload was not found or has expired.",
      );
    }
    this.assertBinding(upload.input, input);
    return upload;
  }

  private assertActive(upload: ActiveUpload): void {
    if (this.active.get(upload.input.uploadId) !== upload || upload.destroyed) {
      throw new Error("The workbench payload upload is no longer active.");
    }
  }

  private assertBinding(
    expected: SequenceWorkbenchPayloadDeclaration,
    actual: { callerId: string; commandId: string; sessionId: string },
  ): void {
    if (expected.sessionId !== actual.sessionId) {
      throw new Error(
        "The workbench payload upload belongs to another viewer session.",
      );
    }
    if (expected.commandId !== actual.commandId) {
      throw new Error(
        "The workbench payload upload belongs to another viewer command.",
      );
    }
    if (expected.callerId !== actual.callerId) {
      throw new Error(
        "The workbench payload upload belongs to another caller.",
      );
    }
  }

  private progress(uploadId: string, receivedBytes: number) {
    return {
      maxChunkBytes: SEQUENCE_VIEWER_LIMITS.persistence.maxChunkBytes,
      maxWorkspaceArtifactBytes: this.maxWorkspaceArtifactBytes,
      receivedBytes,
      uploadId,
    };
  }

  private async reserveWorkspaceCapacity(
    directory: string,
    additionalBytes: number,
  ): Promise<void> {
    if (
      this.workspaceStagedBytes + additionalBytes >
      this.maxWorkspaceStagingBytes
    ) {
      throw new Error("The aggregate workspace staging quota is exhausted.");
    }
    this.workspaceStagedBytes += additionalBytes;
    try {
      const available = await this.getAvailableWorkspaceBytes(directory);
      if (available - additionalBytes < this.minWorkspaceFreeBytes) {
        throw new Error(
          "The workspace destination does not have enough free disk space for this chunk.",
        );
      }
    } catch (error) {
      this.workspaceStagedBytes -= additionalBytes;
      throw error;
    }
  }

  private refresh(upload: ActiveUpload): void {
    upload.expiresAt = this.expiry();
    this.scheduleCleanup();
  }

  private expiry(): number {
    return this.now() + SEQUENCE_VIEWER_LIMITS.persistence.uploadTtlMs;
  }

  private stagingDirectory(): Promise<string> {
    this.stagingDirectoryPromise ??= this.createStagingDirectory();
    return this.stagingDirectoryPromise;
  }

  private scheduleCleanup(): void {
    if (this.disposed) return;
    this.clearCleanupTimer();
    const expiries = [
      ...[...this.active.values()].map(({ expiresAt }) => expiresAt),
      ...[...this.completed.values()].map(({ expiresAt }) => expiresAt),
      ...[...this.completedGenerations.values()].map(
        ({ expiresAt }) => expiresAt,
      ),
    ];
    if (expiries.length === 0) return;
    const delay = Math.max(100, Math.min(...expiries) - this.now());
    this.cleanupTimer = this.scheduler.setTimeout(() => {
      this.cleanupTimer = undefined;
      void this.cleanupExpired();
    }, delay);
  }

  private clearCleanupTimer(): void {
    if (this.cleanupTimer == null) return;
    this.scheduler.clearTimeout(this.cleanupTimer);
    this.cleanupTimer = undefined;
  }

  private assertOpen(): void {
    if (this.disposed)
      throw new Error("The workbench payload upload store is closed.");
  }
}

function uploadFingerprint(input: SequenceWorkbenchPayloadDeclaration): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        byteLength: input.byteLength,
        callerId: input.callerId,
        commandId: input.commandId,
        format: input.format ?? null,
        destination: input.destination,
        kind: input.kind,
        mediaType: input.mediaType ?? null,
        name: input.name,
        provenance: input.provenance ?? null,
        sessionId: input.sessionId,
        sha256: input.sha256,
        uploadId: input.uploadId,
      }),
    )
    .digest("hex");
}

function decodeCanonicalBase64(value: string): Buffer {
  if (
    value.length % 4 !== 0 ||
    !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/u.test(
      value,
    )
  ) {
    throw new Error("Workbench payload data must be canonical base64.");
  }
  const bytes = Buffer.from(value, "base64");
  if (bytes.toString("base64") !== value) {
    throw new Error("Workbench payload data must be canonical base64.");
  }
  return bytes;
}

function sha256Bytes(value: Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

function safeWorkbenchUploadError(
  input: SequenceWorkbenchPayloadDeclaration,
  error: unknown,
): unknown {
  return input.destination.kind === "workspace"
    ? safeSequenceWorkspacePublicationError(error)
    : error;
}

async function writeChunk(
  file: FileHandle,
  chunk: Uint8Array,
  offset: number,
): Promise<void> {
  let written = 0;
  while (written < chunk.byteLength) {
    const result = await file.write(
      chunk,
      written,
      chunk.byteLength - written,
      offset + written,
    );
    if (result.bytesWritten === 0) {
      throw new Error("The workbench payload staging write made no progress.");
    }
    written += result.bytesWritten;
  }
}

function validatePayload(
  input: SequenceWorkbenchPayloadDeclaration,
  content: string,
  bytes?: Uint8Array,
): void {
  if (input.kind === "session") {
    parseAndValidateWorkbenchSession(content);
    return;
  }
  const format = input.format as keyof typeof mediaTypeByFormat;
  const mediaType = input.mediaType;
  if (mediaType !== mediaTypeByFormat[format]) {
    throw new Error(`The ${format} artifact media type is invalid.`);
  }
  if (
    format === "a3m" ||
    format === "clustal" ||
    format === "gtf" ||
    format === "pdf" ||
    format === "stockholm"
  ) {
    const validator = new IncrementalSequenceExportValidator(format, mediaType);
    validator.update(bytes ?? new TextEncoder().encode(content));
    validator.finish();
    return;
  }
  const trimmed = content.trim();
  if (trimmed.length === 0 && format !== "bed") {
    throw new Error("The exported artifact is empty.");
  }
  if (format === "json") {
    JSON.parse(content);
  } else if (
    (format === "fasta" || format === "aligned-fasta") &&
    !trimmed.startsWith(">")
  ) {
    throw new Error("The exported FASTA artifact is invalid.");
  } else if (format === "fastq" && !trimmed.startsWith("@")) {
    throw new Error("The exported FASTQ artifact is invalid.");
  } else if (
    format === "genbank" &&
    (!trimmed.startsWith("LOCUS") || !trimmed.endsWith("//"))
  ) {
    throw new Error("The exported GenBank artifact is invalid.");
  } else if (
    format === "embl" &&
    (!trimmed.startsWith("ID") || !trimmed.endsWith("//"))
  ) {
    throw new Error("The exported EMBL artifact is invalid.");
  } else if (format === "gff3" && !trimmed.startsWith("##gff-version 3")) {
    throw new Error("The exported GFF3 artifact is invalid.");
  } else if (format === "svg" && !/^<svg[\s>]/u.test(trimmed)) {
    throw new Error("The exported SVG artifact is invalid.");
  } else if (format === "newick" && !trimmed.endsWith(";")) {
    throw new Error("The exported Newick artifact is invalid.");
  } else if (format === "vcf" && !trimmed.startsWith("##fileformat=VCF")) {
    throw new Error("The exported VCF artifact is invalid.");
  }
}

function uploadCancellationReason(): DOMException {
  return new DOMException("Workbench payload upload cancelled.", "AbortError");
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw signal.reason ?? uploadCancellationReason();
}

function workspaceArtifactPublication(
  result: SequenceWorkbenchPersistenceResult,
  plan: PreparedSequenceWorkspaceExport,
): SequenceWorkspacePublicationResult {
  if (
    result.kind !== "artifact" ||
    !("destination" in result) ||
    result.destination.kind !== "workspace"
  ) {
    throw new Error("The generated workspace result is inconsistent.");
  }
  return {
    destination: result.destination,
    format: plan.format,
    mediaType: plan.mediaType,
    metrics: result.metrics,
    name: result.name,
    outputWorkspacePath: result.outputWorkspacePath,
    provenanceWorkspacePath: result.provenanceWorkspacePath,
    sha256: result.sha256,
    size: result.size,
    version: 1,
  };
}

async function assertBoundSourceHandle(
  file: FileHandle,
  expected: SequenceWorkspaceFileIdentity,
): Promise<void> {
  const current = await file.stat({ bigint: true });
  if (
    !current.isFile() ||
    current.dev.toString() !== expected.device ||
    current.ino.toString() !== expected.inode ||
    current.size.toString() !== expected.size ||
    current.mtimeNs.toString() !== expected.modifiedAtNanoseconds ||
    current.ctimeNs.toString() !== expected.changedAtNanoseconds ||
    current.nlink.toString() !== expected.links
  ) {
    throw new Error("The workspace source changed during export generation.");
  }
}

async function resolveSourceCompression(
  file: FileHandle,
  requested: "auto" | "gzip" | "none",
): Promise<"gzip" | "none"> {
  if (requested !== "auto") return requested;
  const header = Buffer.alloc(2);
  const { bytesRead } = await file.read(header, 0, header.length, 0);
  return bytesRead === 2 && header[0] === 0x1f && header[1] === 0x8b
    ? "gzip"
    : "none";
}

async function* sourceOutputChunks(
  file: FileHandle,
  compression: "gzip" | "none",
  signal?: AbortSignal,
): AsyncGenerator<Uint8Array> {
  const source = file.createReadStream({
    autoClose: false,
    highWaterMark: 256 * 1_024,
    signal,
    start: 0,
  });
  const output = compression === "gzip" ? source.pipe(createGunzip()) : source;
  let completed = false;
  let pending = new Uint8Array(256 * 1_024);
  let pendingLength = 0;
  try {
    for await (const chunk of output) {
      throwIfAborted(signal);
      const bytes =
        chunk instanceof Uint8Array
          ? new Uint8Array(chunk.buffer, chunk.byteOffset, chunk.byteLength)
          : Buffer.from(chunk as string);
      for (let offset = 0; offset < bytes.byteLength; ) {
        const copied = Math.min(
          pending.byteLength - pendingLength,
          bytes.byteLength - offset,
        );
        pending.set(bytes.subarray(offset, offset + copied), pendingLength);
        pendingLength += copied;
        offset += copied;
        if (pendingLength === pending.byteLength) {
          yield pending;
          pending = new Uint8Array(256 * 1_024);
          pendingLength = 0;
        }
      }
    }
    if (pendingLength > 0) yield pending.slice(0, pendingLength);
    completed = true;
  } finally {
    if (!completed) {
      output.destroy();
      if (output !== source) source.destroy();
    }
  }
}

async function waitForSignal<T>(
  promise: Promise<T>,
  signal?: AbortSignal,
): Promise<T> {
  if (signal == null) return await promise;
  throwIfAborted(signal);
  return await new Promise<T>((resolve, reject) => {
    const finish = (callback: () => void) => {
      signal.removeEventListener("abort", onAbort);
      callback();
    };
    const onAbort = () =>
      finish(() => reject(signal.reason ?? uploadCancellationReason()));
    signal.addEventListener("abort", onAbort, { once: true });
    void promise.then(
      (value) => finish(() => resolve(value)),
      (error) => finish(() => reject(error)),
    );
  });
}

function forwardAbort(
  source: AbortSignal | undefined,
  destination: AbortController,
): () => void {
  if (source == null) return () => undefined;
  const onAbort = () =>
    destination.abort(source.reason ?? uploadCancellationReason());
  if (source.aborted) onAbort();
  else source.addEventListener("abort", onAbort, { once: true });
  return () => source.removeEventListener("abort", onAbort);
}

async function availableFilesystemBytes(directory: string): Promise<number> {
  const fileSystem = await statfs(directory, { bigint: true });
  const bytes = fileSystem.bavail * fileSystem.bsize;
  return bytes > BigInt(Number.MAX_SAFE_INTEGER)
    ? Number.MAX_SAFE_INTEGER
    : Number(bytes);
}

function assertWorkspaceLimit(
  name: string,
  value: number,
  minimum: number,
): number {
  if (!Number.isSafeInteger(value) || value < minimum) {
    throw new Error(`${name} must be a safe integer of at least ${minimum}.`);
  }
  return value;
}

async function removeStagingIfSame(
  stagingPath: string,
  expected: SequenceWorkspaceStagedIdentity,
): Promise<void> {
  try {
    const staged = await lstat(stagingPath, { bigint: true });
    if (
      staged.isSymbolicLink() ||
      !staged.isFile() ||
      staged.dev.toString() !== expected.device ||
      staged.ino.toString() !== expected.inode ||
      staged.ctimeNs.toString() !== expected.changedAtNanoseconds ||
      staged.mtimeNs.toString() !== expected.modifiedAtNanoseconds ||
      staged.size.toString() !== expected.size
    ) {
      throw new Error("Workbench staging changed before cleanup.");
    }
    await rm(stagingPath);
  } catch (error) {
    if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) {
      throw error;
    }
  }
}

function stagingIdentityFromStat(fileStat: {
  ctimeNs: bigint;
  dev: bigint;
  ino: bigint;
  mtimeNs: bigint;
  size: bigint;
}): SequenceWorkspaceStagedIdentity {
  return {
    changedAtNanoseconds: fileStat.ctimeNs.toString(),
    device: fileStat.dev.toString(),
    inode: fileStat.ino.toString(),
    modifiedAtNanoseconds: fileStat.mtimeNs.toString(),
    size: fileStat.size.toString(),
  };
}
