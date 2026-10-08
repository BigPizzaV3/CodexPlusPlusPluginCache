import type { App } from "@modelcontextprotocol/ext-apps";
import { z } from "zod";

import { SEQUENCE_VIEWER_VERSION } from "../version";
import { isSafeWorkspaceExportRelativePath } from "../viewer-operations";
import {
  isSafeWorkspaceBrowserChildName,
  sequenceCreateWorkspaceDirectoryInputSchema,
  sequenceCreateWorkspaceDirectoryResultSchema,
  sequenceListWorkspaceDirectoryInputSchema,
  sequenceListWorkspaceDirectoryResultSchema,
  type SequenceCreateWorkspaceDirectoryInput,
  type SequenceCreateWorkspaceDirectoryResult,
  type SequenceListWorkspaceDirectoryInput,
  type SequenceListWorkspaceDirectoryResult,
} from "../workspace-browser-protocol";

const safeDecimal = z.string().regex(/^(0|[1-9]\d*)$/u);
const safeIdentifier = z.string().min(1).max(256);
const safeNativeMemberName = z
  .string()
  .regex(/^[A-Za-z0-9][A-Za-z0-9_. -]{0,254}$/u)
  .refine(isSafeWorkspaceBrowserChildName);
const safeSequenceCursor = z
  .string()
  .max(64)
  .regex(/^(0|[1-9]\d*)(?::(0|[1-9]\d*))?$/u);
const safeRevision = z
  .number()
  .int()
  .nonnegative()
  .max(Number.MAX_SAFE_INTEGER);
const MAX_SEQUENCE_CHECKPOINT_BYTES = 256 * 1024;
export const MAX_SEQUENCE_SOURCE_RANGE_BYTES = 256 * 1024;
export const MAX_SEQUENCE_SOURCE_EDIT_CHUNK_BYTES = 1024 * 1024;
const LEGACY_SEQUENCE_SOURCE_EDIT_CHUNK_BYTES = 64 * 1024;

export type SequenceScientificDataTransport = Readonly<{
  request: (input: {
    family: "sequence";
    logicalSessionId: string;
    backendInstanceId: string;
    backendGeneration: number;
    sourceRevision: string;
    operation: string;
    payload: Record<string, unknown>;
    signal?: AbortSignal;
  }) => Promise<{ structuredContent: unknown }>;
}>;

export type SequencePersistentDataSession = Readonly<{
  family: "sequence";
  logicalSessionId: string;
  backendInstanceId: string;
  backendGeneration: number;
  sourceRevision: string;
  canEditApprovedSource?: boolean;
}>;

const hostSequenceCapabilitiesSchema = z
  .object({
    protocolVersion: z.literal(1),
    processIsolation: z.literal("family-process"),
    binaryTransfer: z.enum(["bounded-process-ipc", "message-port"]),
    familyScopedChannels: z.literal(true),
    transportSupportsRangeReads: z.literal(true),
    attachment: z
      .object({
        family: z.literal("sequence"),
        logicalSessionId: safeIdentifier,
        backendInstanceId: safeIdentifier,
        backendGeneration: z.number().int().nonnegative(),
        frameId: safeIdentifier,
        channelId: safeIdentifier,
        expiresAtMs: z.number().finite(),
      })
      .passthrough(),
    effectiveCapabilities: z
      .object({
        family: z.literal("sequence"),
        logicalSessionId: safeIdentifier,
        backendInstanceId: safeIdentifier,
        backendGeneration: z.number().int().nonnegative(),
        sourceRevision: z.string().min(1).max(1024),
        canReadRanges: z.literal(true),
        canEditApprovedSource: z.boolean().optional(),
      })
      .passthrough(),
  })
  .passthrough();

type SequenceHostApp = Pick<App, "getHostCapabilities" | "callServerTool"> &
  Partial<Pick<App, "getHostContext">>;
type SequenceHostCapabilities = z.output<typeof hostSequenceCapabilitiesSchema>;
type SequenceHostBinding = {
  attachment: SequenceHostCapabilities["attachment"];
};

const sequenceHostBindings = new WeakMap<
  ScientificSequenceDataClient,
  SequenceHostBinding
>();
const rebindSequenceHostSession = Symbol("rebindSequenceHostSession");

function parseSequenceHostCapabilities(
  app: SequenceHostApp,
  refreshedHostContext?: unknown,
): SequenceHostCapabilities | null {
  const hostContext = refreshedHostContext ?? app.getHostContext?.();
  const scientificViewerCarrier =
    hostContext != null &&
    typeof hostContext === "object" &&
    Object.hasOwn(hostContext, "scientificViewers")
      ? hostContext
      : app.getHostCapabilities();
  const parsed = z
    .object({ scientificViewers: hostSequenceCapabilitiesSchema })
    .passthrough()
    .safeParse(scientificViewerCarrier);
  if (!parsed.success) return null;

  const { attachment, effectiveCapabilities } = parsed.data.scientificViewers;
  if (
    attachment.expiresAtMs <= Date.now() ||
    attachment.logicalSessionId !== effectiveCapabilities.logicalSessionId ||
    attachment.backendInstanceId !== effectiveCapabilities.backendInstanceId ||
    attachment.backendGeneration !== effectiveCapabilities.backendGeneration
  ) {
    return null;
  }
  return parsed.data.scientificViewers;
}

/**
 * Bind range reads to the live, host-authenticated iframe. Source grants remain
 * inside Electron; widgets never manufacture or receive filesystem authority.
 */
export function createHostScientificSequenceDataClient(
  app: SequenceHostApp,
): ScientificSequenceDataClient | null {
  if (typeof app.callServerTool !== "function") {
    return null;
  }
  const capabilities = parseSequenceHostCapabilities(app);
  if (capabilities == null) return null;
  const { attachment, effectiveCapabilities } = capabilities;
  const binding: SequenceHostBinding = { attachment };
  const client = new ScientificSequenceDataClient(
    {
      request: async (input) => {
        input.signal?.throwIfAborted();
        const result = await app.callServerTool(
          {
            name: input.operation,
            arguments: {
              family: "sequence",
              logicalSessionId: input.logicalSessionId,
              backendInstanceId: input.backendInstanceId,
              backendGeneration: input.backendGeneration,
              sourceRevision: input.sourceRevision,
              frameId: binding.attachment.frameId,
              channelId: binding.attachment.channelId,
              resourceUri: "ui://sequence-viewer/viewer",
              ...input.payload,
            },
          },
          input.signal == null ? undefined : { signal: input.signal },
        );
        input.signal?.throwIfAborted();
        if (result.isError) {
          throw new Error(
            "The persistent Sequence source request was refused.",
          );
        }
        return { structuredContent: result.structuredContent };
      },
    },
    {
      family: "sequence",
      logicalSessionId: attachment.logicalSessionId,
      backendInstanceId: attachment.backendInstanceId,
      backendGeneration: attachment.backendGeneration,
      sourceRevision: effectiveCapabilities.sourceRevision,
      canEditApprovedSource:
        effectiveCapabilities.canEditApprovedSource === true,
    },
  );
  sequenceHostBindings.set(client, binding);
  return client;
}

/** Renew a trusted native channel without replacing its live workbench state. */
export function refreshHostScientificSequenceDataClient(
  app: SequenceHostApp,
  client: ScientificSequenceDataClient,
  refreshedHostContext?: unknown,
): boolean {
  const binding = sequenceHostBindings.get(client);
  const capabilities = parseSequenceHostCapabilities(app, refreshedHostContext);
  if (binding == null || capabilities == null) return false;

  const { attachment, effectiveCapabilities } = capabilities;
  const current = client.session;
  if (
    attachment.family !== current.family ||
    attachment.logicalSessionId !== current.logicalSessionId ||
    attachment.frameId !== binding.attachment.frameId ||
    effectiveCapabilities.sourceRevision !== current.sourceRevision ||
    (effectiveCapabilities.canEditApprovedSource === true) !==
      (current.canEditApprovedSource === true) ||
    attachment.backendGeneration < current.backendGeneration
  ) {
    return false;
  }
  if (
    attachment.backendGeneration === current.backendGeneration &&
    (attachment.backendInstanceId !== current.backendInstanceId ||
      attachment.expiresAtMs < binding.attachment.expiresAtMs ||
      (attachment.expiresAtMs === binding.attachment.expiresAtMs &&
        attachment.channelId === binding.attachment.channelId))
  ) {
    return false;
  }

  client[rebindSequenceHostSession]({
    family: "sequence",
    logicalSessionId: attachment.logicalSessionId,
    backendInstanceId: attachment.backendInstanceId,
    backendGeneration: attachment.backendGeneration,
    sourceRevision: effectiveCapabilities.sourceRevision,
    canEditApprovedSource: effectiveCapabilities.canEditApprovedSource === true,
  });
  binding.attachment = attachment;
  return true;
}

const sequenceRecordPageSchema = z
  .object({
    cursor: safeSequenceCursor,
    nextCursor: safeSequenceCursor.nullable(),
    sourceRevision: z.string().min(1),
    complete: z.boolean(),
    records: z
      .array(
        z
          .object({
            id: z.string().min(1),
            description: z.string(),
            sequenceLength: z.number().int().nonnegative(),
          })
          .passthrough(),
      )
      .max(256),
  })
  .passthrough();

const sequenceWindowSchema = z
  .object({
    sourceRevision: z.string().min(1).max(1024),
    sequence: z.string().max(1024 * 1024),
    quality: z
      .string()
      .max(1024 * 1024)
      .optional(),
    start1: z.number().int().positive().optional(),
    end1: z.number().int().positive().optional(),
    start1Decimal: safeDecimal.optional(),
    end1Decimal: safeDecimal.optional(),
  })
  .passthrough();

const sequenceAlignmentTileSchema = z
  .object({
    sourceRevision: z.string().min(1).max(1024),
    columnStart1: z.number().int().positive(),
    columnEnd1: z.number().int().positive(),
    rowStart1: z.number().int().positive(),
    rowEnd1: z.number().int().positive(),
    rows: z
      .array(
        z
          .object({
            id: z.string().min(1),
            row1: z.number().int().positive(),
            aligned: z.string().max(1024 * 1024),
          })
          .passthrough(),
      )
      .max(1024),
  })
  .passthrough();

const sourceBoundResultSchema = z
  .object({ sourceRevision: z.string().min(1).max(1024) })
  .passthrough();

const sequenceCompositionResultSchema = sourceBoundResultSchema.extend({
  alphabet: z.enum(["dna", "rna"]),
  ambiguousBases: z.number().int().nonnegative(),
  canonicalBases: z.number().int().nonnegative(),
  counts: z
    .array(
      z.object({
        count: z.number().int().nonnegative(),
        symbol: z.string().min(1),
      }),
    )
    .max(32),
  gaps: z.number().int().nonnegative(),
  gcExpectedFraction: z.number().finite().min(0).max(1).nullable(),
  gcFraction: z.number().finite().min(0).max(1).nullable(),
  length: z.number().int().nonnegative(),
  recordNumber: z.number().int().positive(),
});

const sequenceReverseComplementResultSchema = sourceBoundResultSchema.extend({
  alphabet: z.enum(["dna", "rna"]),
  length: z
    .number()
    .int()
    .nonnegative()
    .max(1024 * 1024),
  recordNumber: z.number().int().positive(),
  sequence: z.string().max(1024 * 1024),
});

const sequenceTranslationResultSchema = sourceBoundResultSchema.extend({
  ambiguousCodons: z.number().int().nonnegative(),
  codonsTranslated: z.number().int().nonnegative(),
  frame: z.union([z.literal(0), z.literal(1), z.literal(2)]),
  geneticCode: z.number().int().positive(),
  partialBases: z.number().int().nonnegative(),
  protein: z.string().max(1024 * 1024),
  recordNumber: z.number().int().positive(),
  resolvedAmbiguousCodons: z.number().int().nonnegative(),
  stopCount: z.number().int().nonnegative(),
  strand: z.enum(["+", "-"]),
});

const sequenceOrfResultSchema = sourceBoundResultSchema.extend({
  complete: z.boolean(),
  completenessReason: z.string().max(128).optional(),
  orfs: z
    .array(
      z.object({
        complete: z.boolean(),
        end1: z.number().int().positive(),
        frame: z.union([z.literal(0), z.literal(1), z.literal(2)]),
        protein: z.string().max(1024 * 1024),
        start1: z.number().int().positive(),
        startCodon: z.string().max(16),
        stopCodon: z.string().max(16).nullable(),
        strand: z.enum(["+", "-"]),
      }),
    )
    .max(100_000),
  recordNumber: z.number().int().positive(),
});

const advancedSearchPatternSchema = z.object({
  id: safeIdentifier,
  maxDistance: z.number().int().nonnegative().max(8).optional(),
  mode: z.enum(["literal", "iupac", "hamming", "edit", "regex"]),
  pattern: z.string().min(1).max(4096),
});

const sequenceSearchResultSchema = sourceBoundResultSchema.extend({
  bins: z
    .array(
      z.object({
        count: z.number().int().nonnegative(),
        end1: z.number().int().positive(),
        start1: z.number().int().positive(),
      }),
    )
    .max(2048),
  comparisons: z.number().int().nonnegative(),
  complete: z.boolean(),
  completenessReason: z.string().max(128).optional(),
  hits: z
    .array(
      z.object({
        distance: z.number().int().nonnegative(),
        end1: z.number().int().positive(),
        patternId: safeIdentifier,
        start1: z.number().int().positive(),
        strand: z.enum(["+", "-"]),
        wrapsOrigin: z.boolean(),
      }),
    )
    .max(100_000),
  interpretation: z.literal("exact-sequence-match-not-functional-validation"),
  patterns: z
    .array(
      z.object({
        id: safeIdentifier,
        mode: advancedSearchPatternSchema.shape.mode,
      }),
    )
    .max(512),
  recordNumber: z.number().int().positive(),
});

const sequenceQcResultSchema = sourceBoundResultSchema.extend({
  complete: z.boolean(),
  completenessReasons: z.array(z.string().max(128)).max(32),
  cycles: z.array(z.object({}).passthrough()).max(1024 * 1024),
  format: z.enum(["fasta", "fastq"]),
  method: z.string().min(1).max(128),
  populationRecords: z.number().int().nonnegative(),
  qualityEncoding: z.enum(["phred+33", "phred+64", "none"]),
  recordsAnalyzed: z.number().int().nonnegative().max(4096),
  sourceEtag: z.string().min(1).max(1024),
  totals: z.object({}).passthrough(),
});

const sequenceEvidenceTileSchema = sourceBoundResultSchema.extend({
  complete: z.boolean(),
  end1: z.number().int().positive(),
  items: z.array(z.object({}).passthrough()).max(4096),
  reference: z.string().min(1).max(1024),
  start1: z.number().int().positive(),
});

const sequenceEvidenceRecordSchema = z
  .object({
    reference: z.string().min(1).max(1024),
    start1: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
    end1: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
    strand: z.enum(["+", "-", "."]).optional(),
  })
  .passthrough();

const sequenceRichExportFormatSchema = z.enum([
  "a3m",
  "aligned-fasta",
  "bed",
  "clustal",
  "csv",
  "embl",
  "fasta",
  "fastq",
  "genbank",
  "gff3",
  "gtf",
  "json",
  "newick",
  "pdf",
  "stockholm",
  "svg",
  "tsv",
  "vcf",
]);

const sequenceNativeRichTrackSchema = z
  .object({
    alt: z
      .string()
      .min(1)
      .max(4096)
      .regex(/^[A-Za-z.*,-]+$/u)
      .optional(),
    end1: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
    id: z
      .string()
      .min(1)
      .max(1024)
      .regex(/^[^\u0000-\u001f\u007f]+$/u)
      .optional(),
    kind: z
      .string()
      .min(1)
      .max(256)
      .regex(/^[^\u0000-\u001f\u007f]+$/u)
      .optional(),
    metadata: z
      .record(
        z.string().min(1).max(256),
        z.union([
          z.string().max(1024),
          z.number().finite(),
          z.boolean(),
          z.null(),
        ]),
      )
      .refine((metadata) => Object.keys(metadata).length <= 16, {
        message: "The native rich annotation metadata exceeds its budget.",
      })
      .optional(),
    ref: z
      .string()
      .min(1)
      .max(4096)
      .regex(/^[A-Za-z.*-]+$/u)
      .optional(),
    reference: z
      .string()
      .min(1)
      .max(1024)
      .regex(/^[^\u0000-\u001f\u007f]+$/u),
    score: z.number().finite().optional(),
    start1: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
    strand: z.enum(["+", "-", "."]).optional(),
  })
  .strict()
  .refine(({ end1, start1 }) => end1 >= start1, {
    message: "The native rich annotation coordinates are inconsistent.",
  });

const sequencePublicationSchema = z
  .object({
    transactionId: z.string().min(1),
    publicationId: z.string().min(1),
    state: z.literal("published"),
    bytesWrittenDecimal: safeDecimal,
    manifest: z.object({}).passthrough().optional(),
  })
  .passthrough();

const sequenceArtifactTransactionSchema = z
  .object({
    transactionId: safeIdentifier,
    publicationId: safeIdentifier.optional(),
    state: z.enum(["staging", "published", "aborted"]).optional(),
    bytesWrittenDecimal: safeDecimal.optional(),
    memberOffsets: z
      .array(
        z.object({
          memberName: safeNativeMemberName,
          role: z.enum(["data", "provenance"]),
          bytesWrittenDecimal: safeDecimal,
        }),
      )
      .max(2)
      .optional(),
  })
  .passthrough();

const sequenceStagedSourceArtifactSchema =
  sequenceArtifactTransactionSchema.extend({
    publicationId: safeIdentifier,
    state: z.literal("staging"),
    bytesWrittenDecimal: safeDecimal,
    sha256: z.string().regex(/^[a-f\d]{64}$/u),
  });

const sequenceNativeArtifactDestinationSchema = z.object({
  relativePath: z
    .string()
    .refine(
      isSafeWorkspaceExportRelativePath,
      "The native Sequence destination is not safe.",
    ),
  collisionPolicy: z.enum(["fail", "next-version"]),
  artifactKind: z.string().min(1).max(128),
});

const sequenceSourceEditLeaseSchema = z.object({
  editId: safeIdentifier,
  expiresAtMs: z.number().finite().positive(),
  sourceRevision: z.string().min(1).max(1024),
  bytesWrittenDecimal: safeDecimal,
  maxChunkBytes: z
    .number()
    .int()
    .positive()
    .max(MAX_SEQUENCE_SOURCE_EDIT_CHUNK_BYTES)
    .optional(),
});

const sequenceSourceEditCommitSchema = z.object({
  editId: safeIdentifier,
  sourceRevision: z.string().min(1).max(1024),
  bytesWrittenDecimal: safeDecimal,
  sourceIdentity: z.object({
    fileId: safeIdentifier,
    etag: z.string().min(1).max(1024),
    rootId: safeIdentifier,
    sizeBytesDecimal: safeDecimal,
    sourceIntegrity: z.unknown().optional(),
  }),
});

const sequenceSourceEditResumeSchema = sequenceSourceEditLeaseSchema.extend({
  state: z.enum(["staging", "publishing", "published"]).optional(),
  committedResult: sequenceSourceEditCommitSchema.optional(),
});

const sequenceSourceEditAbortSchema = z.object({
  editId: safeIdentifier,
  aborted: z.literal(true),
});

const sequenceOriginalSourceRangeSchema = z.object({
  bytes: z.custom<Uint8Array>(
    (bytes) =>
      ArrayBuffer.isView(bytes) &&
      Object.prototype.toString.call(bytes) === "[object Uint8Array]",
    "The original Sequence range must contain authenticated bytes.",
  ),
  eof: z.boolean(),
});

const sequenceListNativeDirectoryInputSchema =
  sequenceListWorkspaceDirectoryInputSchema.omit({
    sessionId: true,
  });
const sequenceCreateNativeDirectoryInputSchema =
  sequenceCreateWorkspaceDirectoryInputSchema.omit({
    sessionId: true,
  });

const sequenceCheckpointBytesSchema = z
  .custom<Uint8Array>(
    (checkpoint) =>
      ArrayBuffer.isView(checkpoint) &&
      Object.prototype.toString.call(checkpoint) === "[object Uint8Array]",
    "The persistent Sequence checkpoint must contain authenticated bytes.",
  )
  .refine(
    (checkpoint) => checkpoint.byteLength <= MAX_SEQUENCE_CHECKPOINT_BYTES,
    {
      message: "The persistent Sequence checkpoint exceeds its bounded budget.",
    },
  );

const sequenceCheckpointReceiptSchema = z.object({
  recoveryReference: safeIdentifier,
  logicalSessionId: safeIdentifier,
  lastAcknowledgedRevision: safeRevision,
  checkpointVersion: z.literal(1),
});

const sequenceRestoredCheckpointSchema = z.discriminatedUnion("hasCheckpoint", [
  z.object({
    checkpoint: sequenceCheckpointBytesSchema,
    lastAcknowledgedRevision: safeRevision,
    sourceRevision: z.string().min(1).max(1024),
    recoveryReference: safeIdentifier,
    hasCheckpoint: z.literal(true),
  }),
  z.object({
    checkpoint: sequenceCheckpointBytesSchema.optional(),
    lastAcknowledgedRevision: safeRevision.optional(),
    sourceRevision: z.string().min(1).max(1024).optional(),
    recoveryReference: safeIdentifier.optional(),
    hasCheckpoint: z.literal(false),
  }),
]);

export type SequenceCheckpointReceipt = z.output<
  typeof sequenceCheckpointReceiptSchema
>;

export type SequenceRestoredCheckpoint = z.output<
  typeof sequenceRestoredCheckpointSchema
>;

export type SequenceNativeArtifactDestination = z.output<
  typeof sequenceNativeArtifactDestinationSchema
>;

export type SequenceNativeArtifactTransaction = z.output<
  typeof sequenceArtifactTransactionSchema
>;

export type SequenceNativeArtifactPublication = z.output<
  typeof sequencePublicationSchema
>;

export type SequenceNativeStagedSourceArtifact = z.output<
  typeof sequenceStagedSourceArtifactSchema
>;

export type SequenceSourceEditLease = z.output<
  typeof sequenceSourceEditLeaseSchema
>;

export type SequenceSourceEditResume = z.output<
  typeof sequenceSourceEditResumeSchema
>;

export type SequenceSourceEditCommit = z.output<
  typeof sequenceSourceEditCommitSchema
>;

type SequenceBoundedWindowInput = Readonly<{
  recordNumber: number;
  start1Decimal: string;
  end1Decimal: string;
  signal?: AbortSignal;
}>;

type SequenceEvidenceTileInput = Readonly<{
  records: Array<Record<string, unknown>>;
  reference: string;
  start1: number;
  end1: number;
  maxItems?: number;
  signal?: AbortSignal;
}>;

/**
 * Typed, generation-fenced access to the unchanged Sequence/Alignment viewer.
 * File bytes are obtained from the application bridge, not MCP resources.
 */
export class ScientificSequenceDataClient {
  #session: SequencePersistentDataSession;
  readonly #sourceEditChunkLimits = new Map<string, number>();

  constructor(
    private readonly transport: SequenceScientificDataTransport,
    session: SequencePersistentDataSession,
  ) {
    if (
      session.family !== "sequence" ||
      !safeIdentifier.safeParse(session.logicalSessionId).success ||
      !safeIdentifier.safeParse(session.backendInstanceId).success ||
      !Number.isSafeInteger(session.backendGeneration) ||
      session.backendGeneration < 0 ||
      session.sourceRevision.length === 0
    ) {
      throw new Error("The persistent Sequence backend session is invalid.");
    }
    this.#session = session;
  }

  get session(): SequencePersistentDataSession {
    return this.#session;
  }

  [rebindSequenceHostSession](session: SequencePersistentDataSession): void {
    this.#session = session;
  }

  async readOriginalSourceRange(input: {
    offsetDecimal: string;
    length: number;
    signal?: AbortSignal;
  }): Promise<{ bytes: Uint8Array; eof: boolean }> {
    if (
      !safeDecimal.safeParse(input.offsetDecimal).success ||
      !Number.isSafeInteger(input.length) ||
      input.length <= 0 ||
      input.length > MAX_SEQUENCE_SOURCE_RANGE_BYTES
    ) {
      throw new Error("The original Sequence source range is not safe.");
    }
    const range = sequenceOriginalSourceRangeSchema.parse(
      await this.request(
        "ui/scientific/sequence/read-range",
        { offsetDecimal: input.offsetDecimal, length: input.length },
        input.signal,
      ),
    );
    if (
      range.bytes.byteLength > input.length ||
      (range.bytes.byteLength === 0 && !range.eof)
    ) {
      throw new Error("The original Sequence source range is not authentic.");
    }
    return range;
  }

  async checkpoint(input: {
    checkpoint: Uint8Array;
    lastAcknowledgedRevision: number;
    signal?: AbortSignal;
  }): Promise<SequenceCheckpointReceipt> {
    const checkpoint = sequenceCheckpointBytesSchema.parse(input.checkpoint);
    const lastAcknowledgedRevision = safeRevision.parse(
      input.lastAcknowledgedRevision,
    );
    const receipt = sequenceCheckpointReceiptSchema.parse(
      await this.request(
        "ui/scientific/sequence/checkpoint",
        { checkpoint, lastAcknowledgedRevision },
        input.signal,
      ),
    );
    if (receipt.logicalSessionId !== this.session.logicalSessionId) {
      throw new Error(
        "The persistent Sequence checkpoint belongs to a different session.",
      );
    }
    if (receipt.lastAcknowledgedRevision < lastAcknowledgedRevision) {
      throw new Error(
        "The persistent Sequence checkpoint acknowledged a stale revision.",
      );
    }
    return receipt;
  }

  async restoreCheckpoint(
    input: { signal?: AbortSignal } = {},
  ): Promise<SequenceRestoredCheckpoint> {
    const checkpoint = sequenceRestoredCheckpointSchema.parse(
      await this.request(
        "ui/scientific/sequence/restore_checkpoint",
        {},
        input.signal,
      ),
    );
    if (
      checkpoint.sourceRevision != null &&
      checkpoint.sourceRevision !== this.session.sourceRevision
    ) {
      throw new Error(
        "The persistent Sequence checkpoint source revision has changed.",
      );
    }
    return checkpoint;
  }

  async listWorkspaceDirectory(
    input: Omit<SequenceListWorkspaceDirectoryInput, "sessionId"> & {
      signal?: AbortSignal;
    },
  ): Promise<SequenceListWorkspaceDirectoryResult> {
    const { signal, ...directory } = input;
    const payload = sequenceListNativeDirectoryInputSchema.parse(directory);
    return sequenceListWorkspaceDirectoryResultSchema.parse(
      await this.request(
        "ui/scientific/sequence/workspace/list",
        payload,
        signal,
      ),
    );
  }

  async createWorkspaceDirectory(
    input: Omit<SequenceCreateWorkspaceDirectoryInput, "sessionId"> & {
      signal?: AbortSignal;
    },
  ): Promise<SequenceCreateWorkspaceDirectoryResult> {
    const { signal, ...directory } = input;
    const payload = sequenceCreateNativeDirectoryInputSchema.parse(directory);
    return sequenceCreateWorkspaceDirectoryResultSchema.parse(
      await this.request(
        "ui/scientific/sequence/workspace/create-directory",
        payload,
        signal,
      ),
    );
  }

  async beginArtifactExport(
    input: SequenceNativeArtifactDestination & {
      idempotencyKey: string;
      memberName: string;
      signal?: AbortSignal;
    },
  ): Promise<SequenceNativeArtifactTransaction> {
    const destination = sequenceNativeArtifactDestinationSchema.parse(input);
    if (
      !safeIdentifier.safeParse(input.idempotencyKey).success ||
      !safeNativeMemberName.safeParse(input.memberName).success
    ) {
      throw new Error("The native Sequence artifact transaction is not safe.");
    }
    return sequenceArtifactTransactionSchema.parse(
      await this.request(
        "ui/scientific/sequence/export/begin",
        {
          ...destination,
          idempotencyKey: input.idempotencyKey,
          memberName: input.memberName,
          pluginVersion: SEQUENCE_VIEWER_VERSION,
        },
        input.signal,
      ),
    );
  }

  async appendArtifactExport(
    input: SequenceNativeArtifactDestination & {
      transactionId: string;
      memberName: string;
      offsetDecimal: string;
      bytes: Uint8Array;
      expectedChunkDigest: string;
      requestId: string;
      role?: "data" | "provenance";
      signal?: AbortSignal;
    },
  ): Promise<SequenceNativeArtifactTransaction> {
    const destination = sequenceNativeArtifactDestinationSchema.parse(input);
    if (
      !safeIdentifier.safeParse(input.transactionId).success ||
      !safeIdentifier.safeParse(input.requestId).success ||
      !safeNativeMemberName.safeParse(input.memberName).success ||
      !safeDecimal.safeParse(input.offsetDecimal).success ||
      !sequenceCheckpointBytesSchema.safeParse(input.bytes).success ||
      input.bytes.byteLength === 0 ||
      input.bytes.byteLength > 64 * 1024 ||
      !/^[a-f\d]{64}$/u.test(input.expectedChunkDigest)
    ) {
      throw new Error("The native Sequence artifact chunk is not safe.");
    }
    return sequenceArtifactTransactionSchema.parse(
      await this.request(
        "ui/scientific/sequence/export/append",
        {
          ...destination,
          transactionId: input.transactionId,
          memberName: input.memberName,
          offsetDecimal: input.offsetDecimal,
          bytes: input.bytes,
          expectedChunkDigest: input.expectedChunkDigest,
          requestId: input.requestId,
          role: input.role ?? "data",
        },
        input.signal,
      ),
    );
  }

  async commitArtifactExport(
    input: SequenceNativeArtifactDestination & {
      transactionId: string;
      publication?: "single-file" | "sibling-set";
      signal?: AbortSignal;
    },
  ): Promise<SequenceNativeArtifactPublication> {
    const destination = sequenceNativeArtifactDestinationSchema.parse(input);
    const transactionId = safeIdentifier.parse(input.transactionId);
    return sequencePublicationSchema.parse(
      await this.request(
        "ui/scientific/sequence/export/commit",
        {
          ...destination,
          transactionId,
          publication: input.publication ?? "single-file",
        },
        input.signal,
      ),
    );
  }

  async abortArtifactExport(
    input: SequenceNativeArtifactDestination & {
      transactionId: string;
      signal?: AbortSignal;
    },
  ): Promise<void> {
    const destination = sequenceNativeArtifactDestinationSchema.parse(input);
    const transactionId = safeIdentifier.parse(input.transactionId);
    await this.request(
      "ui/scientific/sequence/export/abort",
      { ...destination, transactionId },
      input.signal,
    );
  }

  async resumeArtifactExport(
    input: SequenceNativeArtifactDestination & {
      transactionId: string;
      memberName: string;
      signal?: AbortSignal;
    },
  ): Promise<SequenceNativeArtifactTransaction> {
    const destination = sequenceNativeArtifactDestinationSchema.parse(input);
    const transactionId = safeIdentifier.parse(input.transactionId);
    if (!safeNativeMemberName.safeParse(input.memberName).success) {
      throw new Error("The native Sequence export member is not safe.");
    }
    const transaction = sequenceArtifactTransactionSchema.parse(
      await this.request(
        "ui/scientific/sequence/export/resume",
        {
          ...destination,
          transactionId,
          memberName: input.memberName,
          pluginVersion: SEQUENCE_VIEWER_VERSION,
        },
        input.signal,
      ),
    );
    if (
      transaction.bytesWrittenDecimal == null ||
      transaction.memberOffsets == null
    ) {
      throw new Error(
        "The resumed Sequence artifact has no authenticated member offsets.",
      );
    }
    const members = new Set<string>();
    let committedBytes = 0n;
    for (const member of transaction.memberOffsets) {
      if (
        members.has(member.memberName) ||
        (member.role === "data" && member.memberName !== input.memberName) ||
        (member.role === "provenance" &&
          member.memberName !== `${input.memberName}.provenance.json`) ||
        member.bytesWrittenDecimal === "0"
      ) {
        throw new Error(
          "The resumed Sequence artifact has inconsistent member offsets.",
        );
      }
      members.add(member.memberName);
      committedBytes += BigInt(member.bytesWrittenDecimal);
    }
    if (
      committedBytes !== BigInt(transaction.bytesWrittenDecimal) ||
      (committedBytes > 0n && !members.has(input.memberName))
    ) {
      throw new Error(
        "The resumed Sequence artifact has inconsistent member offsets.",
      );
    }
    return transaction;
  }

  async exportOpenedSource(
    input: SequenceNativeArtifactDestination & {
      format: "fasta" | "fastq" | "aligned-fasta";
      idempotencyKey: string;
      memberName: string;
      signal?: AbortSignal;
    },
  ): Promise<SequenceNativeArtifactPublication> {
    const destination = sequenceNativeArtifactDestinationSchema.parse(input);
    if (
      !z.enum(["fasta", "fastq", "aligned-fasta"]).safeParse(input.format)
        .success ||
      !safeIdentifier.safeParse(input.idempotencyKey).success ||
      !safeNativeMemberName.safeParse(input.memberName).success
    ) {
      throw new Error("The native Sequence source export is not valid.");
    }
    return sequencePublicationSchema.parse(
      await this.request(
        "ui/scientific/sequence/export/source",
        {
          ...destination,
          format: input.format,
          idempotencyKey: input.idempotencyKey,
          memberName: input.memberName,
          pluginVersion: SEQUENCE_VIEWER_VERSION,
        },
        input.signal,
      ),
    );
  }

  async stageOpenedSource(
    input: SequenceNativeArtifactDestination & {
      format: "fasta" | "fastq" | "aligned-fasta";
      idempotencyKey: string;
      memberName: string;
      signal?: AbortSignal;
    },
  ): Promise<SequenceNativeStagedSourceArtifact> {
    const destination = sequenceNativeArtifactDestinationSchema.parse(input);
    if (
      !z.enum(["fasta", "fastq", "aligned-fasta"]).safeParse(input.format)
        .success ||
      !safeIdentifier.safeParse(input.idempotencyKey).success ||
      !safeNativeMemberName.safeParse(input.memberName).success
    ) {
      throw new Error("The native Sequence source export is not valid.");
    }
    return sequenceStagedSourceArtifactSchema.parse(
      await this.request(
        "ui/scientific/sequence/export/source",
        {
          ...destination,
          deferCommit: true,
          format: input.format,
          idempotencyKey: input.idempotencyKey,
          memberName: input.memberName,
          pluginVersion: SEQUENCE_VIEWER_VERSION,
        },
        input.signal,
      ),
    );
  }

  async stageNativeRichSource(
    input: SequenceNativeArtifactDestination & {
      format: z.output<typeof sequenceRichExportFormatSchema>;
      idempotencyKey: string;
      memberName: string;
      recordNumber?: number;
      records?: Array<z.output<typeof sequenceNativeRichTrackSchema>>;
      signal?: AbortSignal;
    },
  ): Promise<SequenceNativeStagedSourceArtifact> {
    const destination = sequenceNativeArtifactDestinationSchema.parse(input);
    if (
      !sequenceRichExportFormatSchema.safeParse(input.format).success ||
      !safeIdentifier.safeParse(input.idempotencyKey).success ||
      !safeNativeMemberName.safeParse(input.memberName).success ||
      (input.recordNumber != null &&
        !z.number().int().positive().safeParse(input.recordNumber).success) ||
      (input.records != null &&
        !z
          .array(sequenceNativeRichTrackSchema)
          .max(4096)
          .safeParse(input.records).success)
    ) {
      throw new Error("The native rich Sequence source export is not valid.");
    }
    return sequenceStagedSourceArtifactSchema.parse(
      await this.request(
        "ui/scientific/sequence/export/rich",
        {
          ...destination,
          deferCommit: true,
          format: input.format,
          idempotencyKey: input.idempotencyKey,
          memberName: input.memberName,
          pluginVersion: SEQUENCE_VIEWER_VERSION,
          ...(input.recordNumber == null
            ? {}
            : { recordNumber: input.recordNumber }),
          ...(input.records == null ? {} : { records: input.records }),
        },
        input.signal,
      ),
    );
  }

  async beginSourceEdit(input: {
    approvedOperation: "replace-source";
    expectedSourceRevision: string;
    maxOutputBytesDecimal?: string;
    signal?: AbortSignal;
  }): Promise<SequenceSourceEditLease> {
    if (
      this.session.canEditApprovedSource !== true ||
      input.approvedOperation !== "replace-source" ||
      input.expectedSourceRevision !== this.session.sourceRevision ||
      (input.maxOutputBytesDecimal != null &&
        !safeDecimal.safeParse(input.maxOutputBytesDecimal).success)
    ) {
      throw new Error("The original Sequence file edit is not authorized.");
    }
    const result = sequenceSourceEditLeaseSchema.parse(
      await this.request(
        "ui/scientific/sequence/source_edit/begin",
        {
          approvedOperation: input.approvedOperation,
          expectedSourceRevision: input.expectedSourceRevision,
          ...(input.maxOutputBytesDecimal == null
            ? {}
            : { maxOutputBytesDecimal: input.maxOutputBytesDecimal }),
        },
        input.signal,
      ),
    );
    if (
      result.sourceRevision !== this.session.sourceRevision ||
      result.expiresAtMs <= Date.now() ||
      result.bytesWrittenDecimal !== "0"
    ) {
      throw new Error("The original Sequence edit lease is stale or invalid.");
    }
    this.#sourceEditChunkLimits.set(
      result.editId,
      result.maxChunkBytes ?? LEGACY_SEQUENCE_SOURCE_EDIT_CHUNK_BYTES,
    );
    return result;
  }

  async appendSourceEdit(input: {
    editId: string;
    offsetDecimal: string;
    bytes: Uint8Array;
    requestId?: string;
    signal?: AbortSignal;
  }): Promise<SequenceSourceEditLease> {
    const maxChunkBytes =
      this.#sourceEditChunkLimits.get(input.editId) ??
      LEGACY_SEQUENCE_SOURCE_EDIT_CHUNK_BYTES;
    if (
      this.session.canEditApprovedSource !== true ||
      !safeIdentifier.safeParse(input.editId).success ||
      !safeDecimal.safeParse(input.offsetDecimal).success ||
      !ArrayBuffer.isView(input.bytes) ||
      Object.prototype.toString.call(input.bytes) !== "[object Uint8Array]" ||
      input.bytes.byteLength === 0 ||
      input.bytes.byteLength > maxChunkBytes ||
      (input.requestId != null &&
        !safeIdentifier.safeParse(input.requestId).success)
    ) {
      throw new Error("The original Sequence edit chunk is not safe.");
    }
    const result = sequenceSourceEditLeaseSchema.parse(
      await this.request(
        "ui/scientific/sequence/source_edit/append",
        {
          editId: input.editId,
          offsetDecimal: input.offsetDecimal,
          bytes: input.bytes,
          ...(input.requestId == null ? {} : { requestId: input.requestId }),
        },
        input.signal,
      ),
    );
    if (
      result.editId !== input.editId ||
      result.sourceRevision !== this.session.sourceRevision ||
      result.expiresAtMs <= Date.now() ||
      BigInt(result.bytesWrittenDecimal) !==
        BigInt(input.offsetDecimal) + BigInt(input.bytes.byteLength)
    ) {
      throw new Error(
        "The original Sequence edit did not commit its exact chunk.",
      );
    }
    this.#sourceEditChunkLimits.set(
      result.editId,
      result.maxChunkBytes ?? maxChunkBytes,
    );
    return result;
  }

  async resumeSourceEdit(input: {
    editId: string;
    signal?: AbortSignal;
  }): Promise<SequenceSourceEditResume> {
    if (
      this.session.canEditApprovedSource !== true ||
      !safeIdentifier.safeParse(input.editId).success
    ) {
      throw new Error(
        "The original Sequence edit resumption is not authorized.",
      );
    }
    const result = sequenceSourceEditResumeSchema.parse(
      await this.request(
        "ui/scientific/sequence/source_edit/resume",
        { editId: input.editId },
        input.signal,
      ),
    );
    if (
      result.editId !== input.editId ||
      result.sourceRevision !== this.session.sourceRevision ||
      result.expiresAtMs <= Date.now() ||
      (result.state === "published" &&
        (result.committedResult == null ||
          result.committedResult.editId !== input.editId ||
          result.committedResult.bytesWrittenDecimal !==
            result.bytesWrittenDecimal ||
          result.committedResult.sourceIdentity.sizeBytesDecimal !==
            result.bytesWrittenDecimal ||
          result.committedResult.sourceRevision ===
            this.session.sourceRevision)) ||
      (result.state !== "published" && result.committedResult != null)
    ) {
      throw new Error(
        "The original Sequence edit resumed with invalid authority.",
      );
    }
    this.#sourceEditChunkLimits.set(
      result.editId,
      result.maxChunkBytes ?? LEGACY_SEQUENCE_SOURCE_EDIT_CHUNK_BYTES,
    );
    return result;
  }

  async commitSourceEdit(input: {
    editId: string;
    signal?: AbortSignal;
  }): Promise<SequenceSourceEditCommit> {
    if (this.session.canEditApprovedSource !== true) {
      throw new Error("The original Sequence file edit is not authorized.");
    }
    const editId = safeIdentifier.parse(input.editId);
    const result = sequenceSourceEditCommitSchema.parse(
      await this.request(
        "ui/scientific/sequence/source_edit/commit",
        { editId },
        input.signal,
      ),
    );
    if (
      result.editId !== editId ||
      result.bytesWrittenDecimal !== result.sourceIdentity.sizeBytesDecimal
    ) {
      throw new Error(
        "The original Sequence edit publication is not authentic.",
      );
    }
    this.#sourceEditChunkLimits.delete(editId);
    return result;
  }

  async abortSourceEdit(input: {
    editId: string;
    signal?: AbortSignal;
  }): Promise<void> {
    if (this.session.canEditApprovedSource !== true) {
      throw new Error("The original Sequence file edit is not authorized.");
    }
    const editId = safeIdentifier.parse(input.editId);
    const result = sequenceSourceEditAbortSchema.parse(
      await this.request(
        "ui/scientific/sequence/source_edit/abort",
        { editId },
        input.signal,
      ),
    );
    if (result.editId !== editId) {
      throw new Error("The original Sequence edit belongs to another session.");
    }
    this.#sourceEditChunkLimits.delete(editId);
  }

  async listRecords(input: {
    cursor?: string;
    limit: number;
    signal?: AbortSignal;
  }) {
    if (
      !Number.isSafeInteger(input.limit) ||
      input.limit <= 0 ||
      input.limit > 256
    ) {
      throw new Error("The requested Sequence page exceeds its bounded limit.");
    }
    const result = sequenceRecordPageSchema.parse(
      await this.request(
        "ui/scientific/sequence/records",
        {
          cursor: input.cursor ?? "0",
          limit: input.limit,
        },
        input.signal,
      ),
    );
    if (result.sourceRevision !== this.session.sourceRevision) {
      throw new Error("The persistent Sequence source revision has changed.");
    }
    return result;
  }

  async readResidueWindow(input: {
    recordNumber: number;
    start1Decimal: string;
    end1Decimal: string;
    includeQuality?: boolean;
    signal?: AbortSignal;
  }) {
    if (
      !Number.isSafeInteger(input.recordNumber) ||
      input.recordNumber <= 0 ||
      !safeDecimal.safeParse(input.start1Decimal).success ||
      !safeDecimal.safeParse(input.end1Decimal).success
    ) {
      throw new Error("The requested Sequence record or interval is invalid.");
    }
    const result = sequenceWindowSchema.parse(
      await this.request(
        "ui/scientific/sequence/window",
        {
          recordNumber: input.recordNumber,
          start1Decimal: input.start1Decimal,
          end1Decimal: input.end1Decimal,
          includeQuality: input.includeQuality === true,
        },
        input.signal,
      ),
    );
    if (result.sourceRevision !== this.session.sourceRevision) {
      throw new Error(
        "The persistent Sequence residue window source revision has changed.",
      );
    }
    if (
      input.includeQuality &&
      (result.quality == null ||
        result.quality.length !== result.sequence.length)
    ) {
      throw new Error(
        "The returned FASTQ qualities do not match their sequence.",
      );
    }
    return result;
  }

  async readAlignmentTile(input: {
    rowStart1: number;
    rowEnd1: number;
    columnStart1: number;
    columnEnd1: number;
    signal?: AbortSignal;
  }) {
    if (
      input.rowEnd1 < input.rowStart1 ||
      input.columnEnd1 < input.columnStart1 ||
      input.rowEnd1 - input.rowStart1 >= 1024 ||
      input.columnEnd1 - input.columnStart1 >= 1024 * 1024
    ) {
      throw new Error(
        "The requested alignment tile exceeds its bounded shape.",
      );
    }
    const result = sequenceAlignmentTileSchema.parse(
      await this.request(
        "ui/scientific/sequence/alignment/tile",
        {
          rowStart1: input.rowStart1,
          rowEnd1: input.rowEnd1,
          columnStart1: input.columnStart1,
          columnEnd1: input.columnEnd1,
        },
        input.signal,
      ),
    );
    if (result.sourceRevision !== this.session.sourceRevision) {
      throw new Error(
        "The persistent Sequence alignment tile source revision has changed.",
      );
    }
    return result;
  }

  async analyzeComposition(
    input: SequenceBoundedWindowInput & { alphabet?: "dna" | "rna" },
  ) {
    const { signal, alphabet = "dna" } = input;
    return this.requestSourceBoundResult(
      "ui/scientific/sequence/analysis/composition",
      { ...this.getBoundedWindow(input), alphabet },
      sequenceCompositionResultSchema,
      signal,
    );
  }

  async reverseComplement(
    input: SequenceBoundedWindowInput & { alphabet?: "dna" | "rna" },
  ) {
    const { signal, alphabet = "dna" } = input;
    return this.requestSourceBoundResult(
      "ui/scientific/sequence/analysis/reverse-complement",
      { ...this.getBoundedWindow(input), alphabet },
      sequenceReverseComplementResultSchema,
      signal,
    );
  }

  async translate(
    input: SequenceBoundedWindowInput & {
      alphabet?: "dna" | "rna";
      ambiguity?: "error" | "resolve";
      frame?: 0 | 1 | 2;
      geneticCode?: number;
      strand?: "+" | "-";
    },
  ) {
    const {
      signal,
      alphabet = "dna",
      ambiguity = "error",
      frame = 0,
      geneticCode = 1,
      strand = "+",
    } = input;
    if (
      ![
        1, 2, 3, 4, 5, 6, 9, 10, 11, 12, 13, 14, 15, 16, 21, 22, 23, 24, 25, 26,
        27, 28, 29, 30, 31, 32, 33,
      ].includes(geneticCode)
    ) {
      throw new Error("The requested Sequence genetic code is not supported.");
    }
    return this.requestSourceBoundResult(
      "ui/scientific/sequence/analysis/translate",
      {
        ...this.getBoundedWindow(input),
        alphabet,
        ambiguity,
        frame,
        geneticCode,
        strand,
      },
      sequenceTranslationResultSchema,
      signal,
    );
  }

  async findOpenReadingFrames(
    input: SequenceBoundedWindowInput & {
      alphabet?: "dna" | "rna";
      geneticCode?: number;
      maxOrfs?: number;
      minCodons?: number;
      strand?: "+" | "-";
    },
  ) {
    const {
      signal,
      alphabet = "dna",
      geneticCode = 1,
      maxOrfs = 1024,
      minCodons = 1,
      strand = "+",
    } = input;
    if (
      !Number.isSafeInteger(maxOrfs) ||
      maxOrfs <= 0 ||
      maxOrfs > 10_000 ||
      !Number.isSafeInteger(minCodons) ||
      minCodons <= 0
    ) {
      throw new Error("The requested open reading frame budget is invalid.");
    }
    return this.requestSourceBoundResult(
      "ui/scientific/sequence/analysis/orfs",
      {
        ...this.getBoundedWindow(input),
        alphabet,
        geneticCode,
        maxOrfs,
        minAminoAcids: minCodons,
        strand,
      },
      sequenceOrfResultSchema,
      signal,
    );
  }

  async searchAdvanced(
    input: SequenceBoundedWindowInput & {
      patterns: Array<{
        id: string;
        pattern: string;
        mode: "literal" | "iupac" | "hamming" | "edit" | "regex";
        maxDistance?: number;
      }>;
      includeReverseComplement?: boolean;
      maxComparisons?: number;
      maxHits?: number;
    },
  ) {
    const {
      signal,
      includeReverseComplement = false,
      maxComparisons = 1_000_000,
      maxHits = 1024,
    } = input;
    const patterns = z
      .array(advancedSearchPatternSchema)
      .min(1)
      .max(256)
      .parse(input.patterns);
    if (
      !Number.isSafeInteger(maxComparisons) ||
      maxComparisons <= 0 ||
      maxComparisons > 25_000_000 ||
      !Number.isSafeInteger(maxHits) ||
      maxHits <= 0 ||
      maxHits > 10_000
    ) {
      throw new Error(
        "The requested Sequence search exceeds its bounded budget.",
      );
    }
    return this.requestSourceBoundResult(
      "ui/scientific/sequence/search/advanced",
      {
        ...this.getBoundedWindow(input),
        patterns,
        includeReverseComplement,
        maxComparisons,
        maxHits,
      },
      sequenceSearchResultSchema,
      signal,
    );
  }

  async qualityControl(input: {
    maxRecords?: number;
    maxTotalBases?: number;
    qualityEncoding?: "phred+33" | "phred+64";
    signal?: AbortSignal;
  }) {
    const {
      maxRecords = 256,
      maxTotalBases = 1024 * 1024,
      qualityEncoding,
      signal,
    } = input;
    if (
      !Number.isSafeInteger(maxRecords) ||
      maxRecords <= 0 ||
      maxRecords > 4096 ||
      !Number.isSafeInteger(maxTotalBases) ||
      maxTotalBases <= 0 ||
      maxTotalBases > 16 * 1024 * 1024
    ) {
      throw new Error(
        "The requested Sequence quality control exceeds its bounded budget.",
      );
    }
    return this.requestSourceBoundResult(
      "ui/scientific/sequence/qc",
      {
        maxRecords,
        maxTotalBases,
        ...(qualityEncoding == null ? {} : { qualityEncoding }),
      },
      sequenceQcResultSchema,
      signal,
    );
  }

  async readTrackTile(input: SequenceEvidenceTileInput) {
    return this.requestSourceBoundResult(
      "ui/scientific/sequence/tracks/tile",
      this.getBoundedEvidenceTile(input),
      sequenceEvidenceTileSchema,
      input.signal,
    );
  }

  async readEvidenceTile(input: SequenceEvidenceTileInput) {
    return this.requestSourceBoundResult(
      "ui/scientific/sequence/evidence/tile",
      this.getBoundedEvidenceTile(input),
      sequenceEvidenceTileSchema,
      input.signal,
    );
  }

  async applyCopyEdit(input: {
    recordNumber: number;
    operationId: string;
    expectedRevisionDecimal: string;
    operation: Record<string, unknown>;
    signal?: AbortSignal;
  }) {
    const revision = z
      .object({ revisionDecimal: safeDecimal, idempotent: z.boolean() })
      .strict();
    return revision.parse(
      await this.request(
        "ui/scientific/sequence/edit",
        {
          recordNumber: input.recordNumber,
          operationId: input.operationId,
          expectedRevisionDecimal: input.expectedRevisionDecimal,
          operation: input.operation,
        },
        input.signal,
      ),
    );
  }

  async exportDerivedCopy(input: {
    recordNumber: number;
    idempotencyKey: string;
    memberName: string;
    format: "fasta" | "fastq";
    header: string;
    relativePath: string;
    collisionPolicy?: "fail" | "next-version";
    signal?: AbortSignal;
  }) {
    if (
      !Number.isSafeInteger(input.recordNumber) ||
      input.recordNumber <= 0 ||
      !safeIdentifier.safeParse(input.idempotencyKey).success ||
      !safeNativeMemberName.safeParse(input.memberName).success ||
      input.header.length === 0 ||
      input.header.length > 4096 ||
      /[\r\n\0]/u.test(input.header) ||
      input.relativePath.length > 2048 ||
      !isSafeWorkspaceExportRelativePath(input.relativePath) ||
      input.relativePath.split("/").includes("..")
    ) {
      throw new Error(
        "The selected Sequence artifact destination is not valid.",
      );
    }
    return sequencePublicationSchema.parse(
      await this.request(
        "ui/scientific/sequence/export",
        {
          recordNumber: input.recordNumber,
          idempotencyKey: input.idempotencyKey,
          memberName: input.memberName,
          format: input.format,
          header: input.header,
          relativePath: input.relativePath,
          collisionPolicy: input.collisionPolicy ?? "fail",
          artifactKind:
            input.format === "fastq" ? "sequence-fastq" : "sequence-fasta",
          pluginVersion: SEQUENCE_VIEWER_VERSION,
        },
        input.signal,
      ),
    );
  }

  private getBoundedWindow(input: SequenceBoundedWindowInput): {
    recordNumber: number;
    start1Decimal: string;
    end1Decimal: string;
  } {
    if (
      !Number.isSafeInteger(input.recordNumber) ||
      input.recordNumber <= 0 ||
      input.start1Decimal.length > 32 ||
      input.end1Decimal.length > 32 ||
      !safeDecimal.safeParse(input.start1Decimal).success ||
      !safeDecimal.safeParse(input.end1Decimal).success
    ) {
      throw new Error("The requested Sequence record or interval is invalid.");
    }
    const start = BigInt(input.start1Decimal);
    const end = BigInt(input.end1Decimal);
    if (start < 1n || end < start || end - start + 1n > 1024n * 1024n) {
      throw new Error(
        "The requested Sequence window exceeds its bounded limit.",
      );
    }
    return {
      recordNumber: input.recordNumber,
      start1Decimal: input.start1Decimal,
      end1Decimal: input.end1Decimal,
    };
  }

  private getBoundedEvidenceTile(input: SequenceEvidenceTileInput): {
    records: Array<z.output<typeof sequenceEvidenceRecordSchema>>;
    reference: string;
    start1: number;
    end1: number;
    maxItems: number;
  } {
    const maxItems = input.maxItems ?? 4096;
    if (
      !z.string().min(1).max(1024).safeParse(input.reference).success ||
      !Number.isSafeInteger(input.start1) ||
      !Number.isSafeInteger(input.end1) ||
      input.start1 <= 0 ||
      input.end1 < input.start1 ||
      input.end1 - input.start1 >= 1024 * 1024 ||
      !Number.isSafeInteger(maxItems) ||
      maxItems <= 0 ||
      maxItems > 4096
    ) {
      throw new Error(
        "The requested Sequence evidence tile exceeds its bounded limit.",
      );
    }
    const records = z
      .array(sequenceEvidenceRecordSchema)
      .max(4096)
      .parse(input.records);
    if (records.some((record) => record.end1 < record.start1)) {
      throw new Error(
        "The requested Sequence evidence coordinates are invalid.",
      );
    }
    return {
      records,
      reference: input.reference,
      start1: input.start1,
      end1: input.end1,
      maxItems,
    };
  }

  private async requestSourceBoundResult<
    Result extends { sourceRevision: string },
  >(
    operation: string,
    payload: Record<string, unknown>,
    schema: z.ZodType<Result>,
    signal?: AbortSignal,
  ): Promise<Result> {
    const result = schema.parse(await this.request(operation, payload, signal));
    if (result.sourceRevision !== this.session.sourceRevision) {
      throw new Error("The persistent Sequence source revision has changed.");
    }
    return result;
  }

  private async request(
    operation: string,
    payload: Record<string, unknown>,
    signal?: AbortSignal,
  ): Promise<unknown> {
    signal?.throwIfAborted();
    const result = await this.transport.request({
      family: "sequence",
      logicalSessionId: this.session.logicalSessionId,
      backendInstanceId: this.session.backendInstanceId,
      backendGeneration: this.session.backendGeneration,
      sourceRevision: this.session.sourceRevision,
      operation,
      payload,
      signal,
    });
    signal?.throwIfAborted();
    return result.structuredContent;
  }
}
