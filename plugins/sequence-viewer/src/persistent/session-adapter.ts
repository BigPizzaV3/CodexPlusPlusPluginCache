import { z } from "zod";

import {
  createSequenceScientificRecoveryMetadata,
  SEQUENCE_PERSISTENT_RESOURCE_URI,
  type SequenceScientificRecoveryMetadata,
} from "./recovery-adapter";

export type SequencePersistentRecoveryContext = Readonly<{
  threadId: string;
  toolCallId: string;
  backendInstanceId: string;
  backendGeneration: number;
  sourceGrantId: string;
  sourceRevision: string;
  pluginVersion: string;
  checkpoint: Uint8Array;
  lastAcknowledgedRevision: number;
}>;

export type SequencePersistentRecoveryBridge = Readonly<{
  checkpointFrame: (input: {
    family: "sequence";
    logicalSessionId: string;
    threadId: string;
    toolCallId: string;
    backendInstanceId: string;
    backendGeneration: number;
    sourceGrantId: string;
    sourceRevision: string;
    pluginVersion: string;
    serverName: "sequence-viewer";
    resourceUri: typeof SEQUENCE_PERSISTENT_RESOURCE_URI;
    checkpoint: Uint8Array;
    lastAcknowledgedRevision: number;
  }) => Promise<{
    recoveryReference: string;
    logicalSessionId: string;
    expiresAtMs: number;
  }>;
}>;

const hostRecoveryReceiptSchema = z
  .object({
    recoveryReference: z.string().min(1).max(256),
    logicalSessionId: z.string().min(1).max(256),
    expiresAtMs: z.number().int().positive(),
  })
  .strict();

const MAX_SEQUENCE_CHECKPOINT_BYTES = 256 * 1024;

/**
 * Request an actual encrypted recovery record from the application control
 * plane. The MCP plugin never creates, signs, or guesses a recovery grant.
 */
export async function checkpointSequenceViewerWithHost(input: {
  bridge: SequencePersistentRecoveryBridge;
  context: SequencePersistentRecoveryContext;
  logicalSessionId: string;
  nowMs?: number;
}): Promise<SequenceScientificRecoveryMetadata> {
  if (
    input.context.checkpoint.byteLength > MAX_SEQUENCE_CHECKPOINT_BYTES ||
    !Number.isSafeInteger(input.context.backendGeneration) ||
    input.context.backendGeneration < 0 ||
    !Number.isSafeInteger(input.context.lastAcknowledgedRevision) ||
    input.context.lastAcknowledgedRevision < 0
  ) {
    throw new Error("The Sequence host checkpoint is invalid or exceeds its budget.");
  }

  const receipt = hostRecoveryReceiptSchema.parse(
    await input.bridge.checkpointFrame({
      family: "sequence",
      logicalSessionId: input.logicalSessionId,
      threadId: input.context.threadId,
      toolCallId: input.context.toolCallId,
      backendInstanceId: input.context.backendInstanceId,
      backendGeneration: input.context.backendGeneration,
      sourceGrantId: input.context.sourceGrantId,
      sourceRevision: input.context.sourceRevision,
      pluginVersion: input.context.pluginVersion,
      serverName: "sequence-viewer",
      resourceUri: SEQUENCE_PERSISTENT_RESOURCE_URI,
      checkpoint: input.context.checkpoint,
      lastAcknowledgedRevision: input.context.lastAcknowledgedRevision,
    }),
  );

  if (
    receipt.logicalSessionId !== input.logicalSessionId ||
    receipt.expiresAtMs <= (input.nowMs ?? Date.now())
  ) {
    throw new Error("The Sequence host returned an expired or mismatched recovery grant.");
  }

  return createSequenceScientificRecoveryMetadata({
    logicalSessionId: receipt.logicalSessionId,
    recoveryReference: receipt.recoveryReference,
    threadId: input.context.threadId,
  });
}
