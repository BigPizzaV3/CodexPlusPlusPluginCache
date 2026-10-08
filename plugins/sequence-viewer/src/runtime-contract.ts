/** Hard limits shared by the server, parsers, UI, context, and tests. */
export const SEQUENCE_VIEWER_SCHEMA_VERSION = 1;
export const SEQUENCE_VIEWER_MODEL_CONTEXT_SCHEMA_VERSION = 2;

export const SEQUENCE_VIEWER_LIMITS = Object.freeze({
  analysis: Object.freeze({
    maxAlignmentDynamicProgrammingCells: 20_000_000,
    maxOrfs: 2_000,
    maxPrimerCandidates: 2_000,
    maxRestrictionSites: 10_000,
    maxResultBytes: 512 * 1_024,
  }),
  command: Object.freeze({
    // Live viewer state is returned inside sequence.complete_viewer_command.
    // Leave deterministic room for command metadata and the JSON-RPC/tool
    // wrapper beneath the installed-host 280 KiB request envelope.
    maxCompletionRequestBytes: 272 * 1_024,
    maxCompletionStateBytes: 240 * 1_024,
    maxPendingGlobal: 256,
    maxPendingPerSession: 16,
    maxSessions: 128,
    maxWaitersGlobal: 128,
    maxWaitersPerSession: 8,
  }),
  context: Object.freeze({
    maxBytes: 64 * 1_024,
    maxTextBytes: 8 * 1_024,
    minPublishIntervalMs: 75,
  }),
  input: Object.freeze({
    maxFastqRecords: 1_000_000,
    maxMsaCells: 20_000_000,
    maxMsaRows: 100_000,
    maxSequenceRecords: 100_000,
    maxTextBytes: 32 * 1_024 * 1_024,
    maxTrackItems: 200_000,
    maxTotalResidues: 25_000_000,
    retainedFastaBases: 12 * 1_024 * 1_024,
    retainedFastqBases: 1_000_000,
    retainedFastqRecords: 5_000,
  }),
  persistence: Object.freeze({
    commandTimeoutMs: 5 * 60_000,
    maxActiveBytes: 32 * 1_024 * 1_024,
    maxActiveUploads: 8,
    // 192 KiB becomes exactly 256 KiB after base64 encoding, leaving room
    // for the request envelope beneath the installed-host 280 KiB cap.
    maxChunkBytes: 192 * 1_024,
    // The one-shot request carries declaration metadata in addition to the
    // encoded payload, so keep a wider margin than the chunk-only path.
    maxOneShotBytes: 180 * 1_024,
    proxyEnvelopeBytes: 280 * 1_024,
    uploadTtlMs: 10 * 60_000,
  }),
  session: Object.freeze({
    maxArtifacts: 128,
    maxArtifactBytes: 8 * 1_024 * 1_024,
    maxArtifactCacheBytes: 32 * 1_024 * 1_024,
    maxSessionBytes: 512 * 1_024,
    maxSessions: 128,
  }),
  search: Object.freeze({
    maxComparisons: 50_000_000,
    maxHits: 5_000,
  }),
  ui: Object.freeze({
    recordPageSize: 100,
    searchHitPageSize: 100,
    trackFeaturePageSize: 200,
  }),
  worker: Object.freeze({
    timeoutMs: 30_000,
  }),
  workspace: Object.freeze({
    // Workspace exports are streamed to destination-local staging and have a
    // budget independent from private artifacts, sessions, and browser caches.
    // Keep the default above the 1 GiB qualification milestone; servers may
    // advertise a smaller operational value only when it is still >= 1 GiB.
    maxArtifactBytes: 2 * 1_024 * 1_024 * 1_024,
    maxAggregateStagingBytes: 4 * 1_024 * 1_024 * 1_024,
    maxBundleCandidates: 100,
    maxBundleTokens: 256,
    maxCandidateTokens: 4_096,
    maxSessionCandidates: 20,
    maxSessionDependencies: 128,
    maxSessionDependencyBytes: 512 * 1_024 * 1_024,
    maxSessionManifestBytes: 4 * 1_024 * 1_024,
    maxSessionSourceBytes: 512 * 1_024 * 1_024,
    maxDirectoryEntries: 10_000,
    maxDirectoryPageSize: 100,
    minFreeBytesAfterStaging: 64 * 1_024 * 1_024,
    tokenTtlMs: 5 * 60_000,
    maxVersionAttempts: 100,
  }),
});

export class SequenceViewerLimitError extends Error {
  readonly code: string;
  readonly details: Record<string, unknown>;

  constructor(
    code: string,
    message: string,
    details: Record<string, unknown> = {},
  ) {
    super(`[${code}] ${message}`);
    this.name = "SequenceViewerLimitError";
    this.code = code;
    this.details = details;
  }
}

export function utf8ByteLength(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}

export function assertTextWithinInputBudget(value: string): void {
  const byteLength = utf8ByteLength(value);
  if (byteLength > SEQUENCE_VIEWER_LIMITS.input.maxTextBytes) {
    throw new SequenceViewerLimitError(
      "input_too_large",
      `This file is ${formatBytes(byteLength)}; the bounded viewer accepts at most ${formatBytes(SEQUENCE_VIEWER_LIMITS.input.maxTextBytes)} of text. Create a smaller subset or summary and reopen it.`,
      {
        byteLength,
        maxBytes: SEQUENCE_VIEWER_LIMITS.input.maxTextBytes,
      },
    );
  }
}

export function formatBytes(bytes: number): string {
  if (bytes < 1_024) return `${bytes} B`;
  if (bytes < 1_024 * 1_024) return `${(bytes / 1_024).toFixed(1)} KiB`;
  return `${(bytes / (1_024 * 1_024)).toFixed(1)} MiB`;
}
