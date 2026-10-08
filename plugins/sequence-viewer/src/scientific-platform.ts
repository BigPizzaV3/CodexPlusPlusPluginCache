import { randomUUID } from "node:crypto";
import { realpath } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { ListRootsResultSchema } from "@modelcontextprotocol/sdk/types.js";
import {
  DurableScientificSessionStore,
  isScientificPlatformError,
  PluginScientificFileService,
} from "@openai/scientific-viewer-platform/core";
import {
  FileScientificSequencePageStore,
  parseScientificFaiIndex,
  PersistentScientificSequenceIndex,
  readScientificFaiWindow,
  type ScientificFaiIndex,
  type ScientificSequenceByteSource,
  type ScientificSequenceFormat,
} from "@openai/scientific-viewer-platform/sequence";

import type { RootsRequestExtra } from "./chat-file-resource";
import { SEQUENCE_VIEWER_LIMITS } from "./runtime-contract";
import type { SequenceScientificSource } from "./scientific-platform-protocol";

const MAX_PHYSICAL_SOURCE_READ_BYTES = 64 * 1_024;
const MAX_APPROVED_FASTA_INDEX_BYTES = 1_024 * 1_024;
const MAX_APPROVED_FASTA_INDEX_RECORDS = 10_000;

type BoundSequenceSource = {
  descriptor: SequenceScientificSource;
  fastaIndex?: {
    index: ScientificFaiIndex;
    revision: string;
    sourceId: string;
  };
  fileService: PluginScientificFileService;
  index?: PersistentScientificSequenceIndex;
  sourcePath: string;
  workspaceRoot: string;
};

export class SequencePluginScientificPlatform {
  readonly #sources = new Map<string, BoundSequenceSource>();
  readonly #checkpointStore: DurableScientificSessionStore;
  readonly #indexDirectory: string;

  constructor({ stateDirectory }: { stateDirectory?: string } = {}) {
    const root = path.resolve(
      stateDirectory ??
        path.join(
          process.env.CODEX_HOME?.trim() || path.join(os.homedir(), ".codex"),
          "state",
          "plugins",
          "sequence-viewer",
        ),
      "scientific-platform-v1",
    );
    this.#checkpointStore = new DurableScientificSessionStore({
      directory: path.join(root, "checkpoints"),
      maxCheckpointBytes: SEQUENCE_VIEWER_LIMITS.persistence.maxChunkBytes,
    });
    this.#indexDirectory = path.join(root, "indexes");
  }

  /** Roots originate only from the MCP host, never from model or iframe input. */
  async bindOpenedSource({
    expectedWorkspaceRoot,
    extra,
    sessionId,
    sourcePath,
  }: {
    expectedWorkspaceRoot?: string;
    extra: RootsRequestExtra;
    sessionId: string;
    sourcePath: string;
  }): Promise<SequenceScientificSource | null> {
    let roots: Array<{ uri: string }>;
    try {
      ({ roots } = await extra.sendRequest(
        { method: "roots/list" },
        ListRootsResultSchema,
      ));
    } catch {
      // Absolute files remain available through the preexisting bounded MCP
      // resource, but ranged access never manufactures a workspace grant.
      return null;
    }

    const approvedRoots = (
      await Promise.all(
        roots.map(async ({ uri }) => {
          try {
            const parsed = new URL(uri);
            if (parsed.protocol !== "file:") return null;
            const rawPath = fileURLToPath(parsed);
            return {
              id: randomUUID(),
              path: await realpath(rawPath),
              rawPath,
            };
          } catch {
            return null;
          }
        }),
      )
    )
      .filter((root): root is NonNullable<typeof root> => root != null)
      .filter(
        ({ path: rootPath, rawPath }) =>
          isSafeRootRelativePath(path.relative(rootPath, sourcePath)) ||
          isSafeRootRelativePath(path.relative(rawPath, sourcePath)),
      )
      .sort((left, right) => right.path.length - left.path.length);
    const root = approvedRoots[0];
    if (root == null) return null;
    if (expectedWorkspaceRoot != null && root.path !== expectedWorkspaceRoot) {
      throw new Error(
        "The saved biological viewer source is outside its original active workspace.",
      );
    }

    const fileService = new PluginScientificFileService({
      maxReadBytes: MAX_PHYSICAL_SOURCE_READ_BYTES,
      roots: [root],
    });
    const relativePath = isSafeRootRelativePath(
      path.relative(root.path, sourcePath),
    )
      ? path.relative(root.path, sourcePath)
      : path.relative(root.rawPath, sourcePath);
    const registered = await fileService.registerSource({
      family: "sequence",
      relativePath,
      rootId: root.id,
      sessionId,
    });
    const descriptor: SequenceScientificSource = {
      family: "sequence",
      fileName: registered.fileName,
      format: sequenceFormat(registered.fileName),
      protocolVersion: 1,
      sessionId,
      sizeBytesDecimal: registered.size.toString(),
      sourceId: registered.sourceId,
      sourceRevision: registered.revision,
    };
    const fastaIndex =
      descriptor.format === "unsupported"
        ? undefined
        : await this.#bindApprovedFastaIndex({
            fileService,
            relativePath,
            rootId: root.id,
            sessionId,
            sourceSize: registered.size,
          });
    this.#sources.set(sessionId, {
      descriptor,
      ...(fastaIndex == null ? {} : { fastaIndex }),
      fileService,
      sourcePath,
      workspaceRoot: root.path,
    });
    return descriptor;
  }

  async describeOpenedSource({
    sessionId,
    signal,
    sourcePath,
    workspaceRoot,
  }: {
    sessionId: string;
    signal?: AbortSignal;
    sourcePath: string;
    workspaceRoot: string;
  }): Promise<SequenceScientificSource | null> {
    const source = this.#sources.get(sessionId);
    if (
      source == null ||
      source.sourcePath !== sourcePath ||
      source.workspaceRoot !== workspaceRoot
    ) {
      return null;
    }
    // A zero-byte bounded read still revalidates the pinned root, no-follow
    // source identity, full ctime-inclusive revision, and capability expiry;
    // the shared service renews an expired unchanged capability in place.
    await source.fileService.readRange({
      family: "sequence",
      length: 0,
      offset: 0n,
      revision: source.descriptor.sourceRevision,
      sessionId,
      signal,
      sourceId: source.descriptor.sourceId,
    });
    return source.descriptor;
  }

  describe(input: {
    sessionId: string;
    sourceId: string;
    sourceRevision: string;
  }): SequenceScientificSource {
    return this.#source(input).descriptor;
  }

  async readRange(input: {
    length: number;
    offsetDecimal: string;
    sessionId: string;
    signal?: AbortSignal;
    sourceId: string;
    sourceRevision: string;
  }): Promise<{
    bytesBase64: string;
    eof: boolean;
    offsetDecimal: string;
    sizeBytesDecimal: string;
    sourceRevision: string;
  }> {
    const source = this.#source(input);
    const bytes = await this.#readBoundedSource({
      length: input.length,
      offset: BigInt(input.offsetDecimal),
      sessionId: input.sessionId,
      signal: input.signal,
      source,
    });
    return {
      bytesBase64: Buffer.from(bytes).toString("base64"),
      eof:
        BigInt(input.offsetDecimal) + BigInt(bytes.byteLength) ===
        BigInt(source.descriptor.sizeBytesDecimal),
      offsetDecimal: input.offsetDecimal,
      sizeBytesDecimal: source.descriptor.sizeBytesDecimal,
      sourceRevision: source.descriptor.sourceRevision,
    };
  }

  async listRecords(input: {
    cursor?: string;
    limit: number;
    sessionId: string;
    signal?: AbortSignal;
    sourceId: string;
    sourceRevision: string;
  }): Promise<{
    complete: boolean;
    cursor: string;
    nextCursor: string | null;
    records: Array<{
      description: string;
      id: string;
      sequenceLength: number;
    }>;
    sourceRevision: string;
  }> {
    const source = this.#source(input);
    if (source.fastaIndex != null) {
      await this.#validateFastaIndex(source, input.sessionId, input.signal);
      const cursor = input.cursor ?? "0";
      if (!/^(0|[1-9]\d*)$/u.test(cursor)) {
        throw new Error("The indexed Sequence record cursor is invalid.");
      }
      const offset = Number(cursor);
      if (
        !Number.isSafeInteger(offset) ||
        offset >= source.fastaIndex.index.records.length
      ) {
        throw new Error("The indexed Sequence record cursor is out of bounds.");
      }
      const records = source.fastaIndex.index.records.slice(
        offset,
        offset + input.limit,
      );
      const nextOffset = offset + records.length;
      return {
        complete: nextOffset === source.fastaIndex.index.records.length,
        cursor,
        nextCursor:
          nextOffset === source.fastaIndex.index.records.length
            ? null
            : String(nextOffset),
        records: records.map((record) => ({
          description: "",
          id: record.name,
          sequenceLength: Number(record.length),
        })),
        sourceRevision: source.descriptor.sourceRevision,
      };
    }
    const page = await this.#index(source, input.sessionId).listRecords({
      cursor: input.cursor,
      limit: input.limit,
      signal: input.signal,
    });
    return {
      complete: page.complete,
      cursor: page.cursor,
      nextCursor: page.nextCursor,
      records: page.records.map(({ description, id, sequenceLength }) => ({
        description,
        id,
        sequenceLength,
      })),
      sourceRevision: page.sourceRevision,
    };
  }

  async readWindow(input: {
    end1Decimal: string;
    includeQuality?: boolean;
    recordNumber: number;
    sessionId: string;
    signal?: AbortSignal;
    sourceId: string;
    sourceRevision: string;
    start1Decimal: string;
  }): Promise<{
    end1Decimal: string;
    quality?: string;
    sequence: string;
    sourceRevision: string;
    start1Decimal: string;
  }> {
    const start1 = Number(input.start1Decimal);
    const end1 = Number(input.end1Decimal);
    if (
      !Number.isSafeInteger(start1) ||
      !Number.isSafeInteger(end1) ||
      start1 <= 0 ||
      end1 < start1 ||
      end1 - start1 + 1 > MAX_PHYSICAL_SOURCE_READ_BYTES
    ) {
      throw new Error(
        "The requested Sequence window is outside its safe budget.",
      );
    }

    const source = this.#source(input);
    if (source.fastaIndex != null) {
      await this.#validateFastaIndex(source, input.sessionId, input.signal);
      const record = source.fastaIndex.index.records[input.recordNumber - 1];
      if (record == null) {
        throw new Error(
          "The requested indexed Sequence record is unavailable.",
        );
      }
      if (input.includeQuality && record.qualityOffset == null) {
        throw new Error(
          "The requested Sequence record has no FASTQ qualities.",
        );
      }
      const window = await readScientificFaiWindow({
        budget: {
          maxRangeReads: 1_024,
          maxReadBytes: 3 * MAX_PHYSICAL_SOURCE_READ_BYTES,
          maxWindowBases: MAX_PHYSICAL_SOURCE_READ_BYTES,
        },
        end1,
        index: source.fastaIndex.index,
        name: record.name,
        source: this.#byteSource(source, input.sessionId),
        start1,
      });
      return {
        end1Decimal: String(window.end1),
        ...(input.includeQuality && window.quality != null
          ? { quality: window.quality }
          : {}),
        sequence: window.sequence,
        sourceRevision: source.descriptor.sourceRevision,
        start1Decimal: String(window.start1),
      };
    }
    const window = await this.#index(source, input.sessionId).readWindow({
      end1,
      recordNumber: input.recordNumber,
      signal: input.signal,
      start1,
    });
    if (input.includeQuality && window.quality == null) {
      throw new Error("The requested Sequence record has no FASTQ qualities.");
    }
    return {
      end1Decimal: String(window.end1),
      ...(input.includeQuality && window.quality != null
        ? { quality: window.quality }
        : {}),
      sequence: window.sequence,
      sourceRevision: source.descriptor.sourceRevision,
      start1Decimal: String(window.start1),
    };
  }

  async saveCheckpoint(input: {
    checkpointBase64: string;
    lastAcknowledgedRevision: number;
    sessionId: string;
    sourceId: string;
    sourceRevision: string;
  }): Promise<{
    checkpointVersion: 1;
    lastAcknowledgedRevision: number;
    logicalSessionId: string;
    recoveryReference: string;
  }> {
    const source = this.#source(input);
    const checkpoint = Buffer.from(input.checkpointBase64, "base64");
    if (
      checkpoint.byteLength === 0 ||
      checkpoint.byteLength >
        SEQUENCE_VIEWER_LIMITS.persistence.maxChunkBytes ||
      checkpoint.toString("base64") !== input.checkpointBase64
    ) {
      throw new Error(
        "The Sequence checkpoint is invalid or exceeds its budget.",
      );
    }
    await this.#checkpointStore.save({
      checkpoint,
      family: "sequence",
      generation: 0,
      lastAcknowledgedRevision: input.lastAcknowledgedRevision,
      sessionId: input.sessionId,
      sourceId: source.descriptor.sourceId,
      sourceRevision: source.descriptor.sourceRevision,
      updatedAtMs: Date.now(),
    });
    return {
      checkpointVersion: 1,
      lastAcknowledgedRevision: input.lastAcknowledgedRevision,
      logicalSessionId: input.sessionId,
      recoveryReference: source.descriptor.sourceId,
    };
  }

  async restoreCheckpoint(input: {
    sessionId: string;
    sourceId: string;
    sourceRevision: string;
  }): Promise<
    | { hasCheckpoint: false }
    | {
        checkpointBase64: string;
        hasCheckpoint: true;
        lastAcknowledgedRevision: number;
        recoveryReference: string;
        sourceRevision: string;
      }
  > {
    const source = this.#source(input);
    const saved = await this.#checkpointStore.load({
      family: "sequence",
      sessionId: input.sessionId,
    });
    if (saved == null) return { hasCheckpoint: false };
    // Source IDs are intentionally ephemeral capabilities. A new plugin MCP
    // process reissues one after independently authorizing the same workspace
    // source; continuity is the same family/session plus its cryptographically
    // measured file identity, never equality of a discarded random handle.
    if (saved.sourceRevision !== source.descriptor.sourceRevision) {
      throw new Error("The Sequence checkpoint belongs to another source.");
    }
    return {
      checkpointBase64: Buffer.from(saved.checkpoint).toString("base64"),
      hasCheckpoint: true,
      lastAcknowledgedRevision: saved.lastAcknowledgedRevision,
      recoveryReference: source.descriptor.sourceId,
      sourceRevision: source.descriptor.sourceRevision,
    };
  }

  #source(input: {
    sessionId: string;
    sourceId: string;
    sourceRevision: string;
  }): BoundSequenceSource {
    const source = this.#sources.get(input.sessionId);
    if (
      source == null ||
      source.descriptor.sourceId !== input.sourceId ||
      source.descriptor.sourceRevision !== input.sourceRevision
    ) {
      throw new Error("The Sequence source does not belong to this viewer.");
    }
    return source;
  }

  #index(
    source: BoundSequenceSource,
    sessionId: string,
  ): PersistentScientificSequenceIndex {
    if (source.descriptor.format === "unsupported") {
      throw new Error(
        "This Sequence format requires the existing bounded MCP resource path.",
      );
    }
    if (source.index != null) return source.index;

    source.index = new PersistentScientificSequenceIndex({
      binding: {
        family: "sequence",
        logicalSessionId: sessionId,
        parserVersion: "plugin-sequence-v1",
        sourceRevision: source.descriptor.sourceRevision,
        sourceSizeBytesDecimal: source.descriptor.sizeBytesDecimal,
      },
      format: source.descriptor.format as ScientificSequenceFormat,
      pageStore: new FileScientificSequencePageStore(this.#indexDirectory),
      source: this.#byteSource(source, sessionId),
    });
    return source.index;
  }

  #byteSource(
    source: BoundSequenceSource,
    sessionId: string,
  ): ScientificSequenceByteSource {
    return {
      etag: source.descriptor.sourceRevision,
      sizeBytes: BigInt(source.descriptor.sizeBytesDecimal),
      readRange: async ({ expectedEtag, length, offset }) => {
        if (expectedEtag !== source.descriptor.sourceRevision) {
          throw new Error("The Sequence source revision is no longer current.");
        }
        const bytes = await this.#readBoundedSource({
          length,
          offset,
          sessionId,
          source,
        });
        return {
          bytes,
          eof:
            offset + BigInt(bytes.byteLength) ===
            BigInt(source.descriptor.sizeBytesDecimal),
          etag: source.descriptor.sourceRevision,
          offset,
        };
      },
    };
  }

  async #bindApprovedFastaIndex({
    fileService,
    relativePath,
    rootId,
    sessionId,
    sourceSize,
  }: {
    fileService: PluginScientificFileService;
    relativePath: string;
    rootId: string;
    sessionId: string;
    sourceSize: bigint;
  }): Promise<BoundSequenceSource["fastaIndex"]> {
    let registered;
    try {
      registered = await fileService.registerSource({
        family: "sequence",
        relativePath: `${relativePath}.fai`,
        rootId,
        sessionId,
      });
    } catch (error) {
      if (isScientificPlatformError(error, "SOURCE_NOT_FOUND"))
        return undefined;
      throw error;
    }
    if (
      registered.size === 0n ||
      registered.size > BigInt(MAX_APPROVED_FASTA_INDEX_BYTES)
    ) {
      throw new Error(
        "The approved Sequence index exceeds its bounded budget.",
      );
    }

    const contents = new Uint8Array(Number(registered.size));
    let copied = 0;
    while (copied < contents.byteLength) {
      const range = await fileService.readRange({
        family: "sequence",
        length: Math.min(
          MAX_PHYSICAL_SOURCE_READ_BYTES,
          contents.byteLength - copied,
        ),
        offset: BigInt(copied),
        revision: registered.revision,
        sessionId,
        sourceId: registered.sourceId,
      });
      contents.set(range.bytes, copied);
      copied += range.bytes.byteLength;
    }
    const index = parseScientificFaiIndex({
      contents: new TextDecoder("utf-8", { fatal: true }).decode(contents),
      maxRecords: MAX_APPROVED_FASTA_INDEX_RECORDS,
      uncompressedSizeBytes: sourceSize,
    });
    if (
      index.records.some(
        (record) => !Number.isSafeInteger(Number(record.length)),
      )
    ) {
      throw new Error(
        "The approved Sequence index exceeds its coordinate budget.",
      );
    }
    return {
      index,
      revision: registered.revision,
      sourceId: registered.sourceId,
    };
  }

  async #validateFastaIndex(
    source: BoundSequenceSource,
    sessionId: string,
    signal?: AbortSignal,
  ): Promise<void> {
    const index = source.fastaIndex;
    if (index == null)
      throw new Error("The approved Sequence index is missing.");
    await Promise.all([
      source.fileService.readRange({
        family: "sequence",
        length: 0,
        offset: 0,
        revision: source.descriptor.sourceRevision,
        sessionId,
        signal,
        sourceId: source.descriptor.sourceId,
      }),
      source.fileService.readRange({
        family: "sequence",
        length: 0,
        offset: 0,
        revision: index.revision,
        sessionId,
        signal,
        sourceId: index.sourceId,
      }),
    ]);
  }

  async #readBoundedSource({
    length,
    offset,
    sessionId,
    signal,
    source,
  }: {
    length: number;
    offset: bigint;
    sessionId: string;
    signal?: AbortSignal;
    source: BoundSequenceSource;
  }): Promise<Uint8Array> {
    const sourceSize = BigInt(source.descriptor.sizeBytesDecimal);
    const available = sourceSize - offset;
    if (available < 0n || length < 0) {
      throw new Error("The requested Sequence source range is invalid.");
    }
    const total = Number(
      BigInt(length) < available ? BigInt(length) : available,
    );
    if (!Number.isSafeInteger(total)) {
      throw new Error("The requested Sequence source range is too large.");
    }
    const result = new Uint8Array(total);
    let copied = 0;
    while (copied < total) {
      signal?.throwIfAborted();
      const current = await source.fileService.readRange({
        family: "sequence",
        length: Math.min(MAX_PHYSICAL_SOURCE_READ_BYTES, total - copied),
        offset: offset + BigInt(copied),
        revision: source.descriptor.sourceRevision,
        sessionId,
        signal,
        sourceId: source.descriptor.sourceId,
      });
      result.set(current.bytes, copied);
      copied += current.bytes.byteLength;
    }
    return result;
  }
}

function sequenceFormat(
  name: string,
): ScientificSequenceFormat | "unsupported" {
  if (/\.(?:fa|fasta|fna|faa|fas)$/iu.test(name)) return "fasta";
  if (/\.(?:fq|fastq)$/iu.test(name)) return "fastq";
  return "unsupported";
}

function isSafeRootRelativePath(relativePath: string): boolean {
  return (
    relativePath !== "" &&
    relativePath !== ".." &&
    !relativePath.startsWith(`..${path.sep}`) &&
    !path.isAbsolute(relativePath)
  );
}
