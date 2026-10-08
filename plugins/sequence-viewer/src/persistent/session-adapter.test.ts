import { describe, expect, it, vi } from "vitest";

import {
  checkpointSequenceViewerWithHost,
  type SequencePersistentRecoveryContext,
} from "./session-adapter";

const context: SequencePersistentRecoveryContext = {
  threadId: "thread-sequence-1",
  toolCallId: "tool-call-1",
  backendInstanceId: "sequence-instance-1",
  backendGeneration: 4,
  sourceGrantId: "host-grant-sequence-1",
  sourceRevision: "etag-sequence-1",
  pluginVersion: "0.1.26",
  checkpoint: new TextEncoder().encode('{"mode":"alignment"}'),
  lastAcknowledgedRevision: 7,
};

describe("application-owned Sequence recovery", () => {
  it("publishes only the opaque recovery reference actually minted by the host", async () => {
    const checkpointFrame = vi.fn(async () => ({
      recoveryReference: "host-sealed-42fce7bc607443b8bba0",
      logicalSessionId: "logical-sequence-1",
      expiresAtMs: 20_000,
    }));

    const metadata = await checkpointSequenceViewerWithHost({
      bridge: { checkpointFrame },
      context,
      logicalSessionId: "logical-sequence-1",
      nowMs: 10_000,
    });

    expect(checkpointFrame).toHaveBeenCalledOnce();
    expect(checkpointFrame).toHaveBeenCalledWith({
      family: "sequence",
      logicalSessionId: "logical-sequence-1",
      threadId: context.threadId,
      toolCallId: context.toolCallId,
      backendInstanceId: context.backendInstanceId,
      backendGeneration: context.backendGeneration,
      sourceGrantId: context.sourceGrantId,
      sourceRevision: context.sourceRevision,
      pluginVersion: context.pluginVersion,
      serverName: "sequence-viewer",
      resourceUri: "ui://sequence-viewer/viewer",
      checkpoint: context.checkpoint,
      lastAcknowledgedRevision: 7,
    });
    expect(metadata).toEqual({
      family: "sequence",
      logicalSessionId: "logical-sequence-1",
      recoveryReference: "host-sealed-42fce7bc607443b8bba0",
      resourceUri: "ui://sequence-viewer/viewer",
      threadId: "thread-sequence-1",
    });
    expect(metadata.recoveryReference).not.toBe(metadata.logicalSessionId);
    expect(JSON.stringify(metadata)).not.toContain(context.sourceGrantId);
    expect(JSON.stringify(metadata)).not.toContain(context.backendInstanceId);
  });

  it("refuses an expired or cross-session host receipt", async () => {
    for (const receipt of [
      {
        recoveryReference: "opaque-expired",
        logicalSessionId: "logical-sequence-1",
        expiresAtMs: 1,
      },
      {
        recoveryReference: "opaque-other-session",
        logicalSessionId: "another-sequence-session",
        expiresAtMs: 20_000,
      },
    ]) {
      await expect(
        checkpointSequenceViewerWithHost({
          bridge: { checkpointFrame: async () => receipt },
          context,
          logicalSessionId: "logical-sequence-1",
          nowMs: 10_000,
        }),
      ).rejects.toThrow(/expired or mismatched/u);
    }
  });

  it("rejects a large raw-sequence checkpoint before invoking the host", async () => {
    const checkpointFrame = vi.fn();

    await expect(
      checkpointSequenceViewerWithHost({
        bridge: { checkpointFrame },
        context: {
          ...context,
          checkpoint: new Uint8Array(256 * 1024 + 1),
        },
        logicalSessionId: "logical-sequence-1",
      }),
    ).rejects.toThrow(/checkpoint/u);
    expect(checkpointFrame).not.toHaveBeenCalled();
  });

  it("propagates host refusal without inventing recovery credentials", async () => {
    await expect(
      checkpointSequenceViewerWithHost({
        bridge: {
          checkpointFrame: async () => {
            throw new Error("The source capability was revoked.");
          },
        },
        context,
        logicalSessionId: "logical-sequence-1",
      }),
    ).rejects.toThrow(/revoked/u);
  });
});
