import { runInNewContext } from "node:vm";

import { McpUiInitializeResultSchema } from "@modelcontextprotocol/ext-apps";
import { describe, expect, it, vi } from "vitest";

import {
  createHostScientificSequenceDataClient,
  MAX_SEQUENCE_SOURCE_EDIT_CHUNK_BYTES,
  MAX_SEQUENCE_SOURCE_RANGE_BYTES,
  refreshHostScientificSequenceDataClient,
  ScientificSequenceDataClient,
  type SequencePersistentDataSession,
  type SequenceScientificDataTransport,
} from "./scientific-data-client";

const session: SequencePersistentDataSession = {
  family: "sequence",
  logicalSessionId: "logical-sequence-1",
  backendInstanceId: "sequence-instance-1",
  backendGeneration: 4,
  sourceRevision: "source-revision-1",
  canEditApprovedSource: true,
};

describe("host-mediated persistent Sequence data client", () => {
  it("activates the live first-party host gateway without exposing a source grant", async () => {
    const callServerTool = vi.fn(async () => ({
      content: [],
      structuredContent: {
        cursor: "0",
        nextCursor: null,
        sourceRevision: session.sourceRevision,
        complete: true,
        records: [{ id: "source-record", description: "", sequenceLength: 4 }],
      },
    }));
    const app = {
      getHostCapabilities: () => ({
        serverTools: {},
        scientificViewers: {
          protocolVersion: 1,
          processIsolation: "family-process",
          binaryTransfer: "bounded-process-ipc",
          familyScopedChannels: true,
          transportSupportsRangeReads: true,
          attachment: {
            family: "sequence",
            logicalSessionId: session.logicalSessionId,
            backendInstanceId: session.backendInstanceId,
            backendGeneration: session.backendGeneration,
            frameId: "sequence-frame-1",
            channelId: "sequence-channel-1",
            expiresAtMs: Date.now() + 60_000,
          },
          effectiveCapabilities: {
            ...session,
            canReadRanges: true,
          },
        },
      }),
      callServerTool,
    };
    const client = createHostScientificSequenceDataClient(app);
    expect(client).not.toBeNull();
    await expect(client?.listRecords({ limit: 1 })).resolves.toMatchObject({
      records: [{ id: "source-record" }],
    });
    expect(callServerTool).toHaveBeenCalledWith(
      {
        name: "ui/scientific/sequence/records",
        arguments: {
          family: "sequence",
          logicalSessionId: session.logicalSessionId,
          backendInstanceId: session.backendInstanceId,
          backendGeneration: session.backendGeneration,
          sourceRevision: session.sourceRevision,
          frameId: "sequence-frame-1",
          channelId: "sequence-channel-1",
          resourceUri: "ui://sequence-viewer/viewer",
          cursor: "0",
          limit: 1,
        },
      },
      undefined,
    );
    expect(JSON.stringify(callServerTool.mock.calls)).not.toContain(
      "sourceGrantId",
    );
  });

  it("keeps its existing client and never replays a write when a restarted backend renews its channel", async () => {
    const callServerTool = vi.fn(async ({ name }: { name: string }) => ({
      content: [],
      structuredContent:
        name === "ui/scientific/sequence/checkpoint"
          ? {
              checkpointVersion: 1,
              lastAcknowledgedRevision: 7,
              logicalSessionId: session.logicalSessionId,
              recoveryReference: "sequence-recovery-1",
            }
          : {
              complete: true,
              cursor: "0",
              nextCursor: null,
              records: [
                { id: "source-record", description: "", sequenceLength: 4 },
              ],
              sourceRevision: session.sourceRevision,
            },
    }));
    const initial = sequenceHostContext();
    let hostContext = initial;
    const app = {
      callServerTool,
      getHostCapabilities: () => ({}),
      getHostContext: () => hostContext,
    };
    const client = createHostScientificSequenceDataClient(app);
    if (client == null)
      throw new Error("Expected an authenticated Sequence client.");
    await client.checkpoint({
      checkpoint: new Uint8Array([1]),
      lastAcknowledgedRevision: 7,
    });

    hostContext = sequenceHostContext({
      backendGeneration: session.backendGeneration + 1,
      backendInstanceId: "restarted-sequence-instance",
      channelId: "restarted-sequence-channel",
    });
    expect(
      refreshHostScientificSequenceDataClient(app, client, hostContext),
    ).toBe(true);
    expect(callServerTool).toHaveBeenCalledTimes(1);
    expect(client.session).toMatchObject({
      backendGeneration: session.backendGeneration + 1,
      backendInstanceId: "restarted-sequence-instance",
      logicalSessionId: session.logicalSessionId,
      sourceRevision: session.sourceRevision,
    });

    await client.listRecords({ limit: 1 });
    expect(callServerTool).toHaveBeenCalledTimes(2);
    expect(callServerTool).toHaveBeenLastCalledWith(
      expect.objectContaining({
        arguments: expect.objectContaining({
          backendGeneration: session.backendGeneration + 1,
          backendInstanceId: "restarted-sequence-instance",
          channelId: "restarted-sequence-channel",
          frameId: "sequence-frame-1",
        }),
        name: "ui/scientific/sequence/records",
      }),
      undefined,
    );
  });

  it("renews an expired channel after more than five idle minutes without advancing generation", async () => {
    let now = 1_800_000_000_000;
    const clock = vi.spyOn(Date, "now").mockImplementation(() => now);
    try {
      let hostContext = sequenceHostContext({ expiresAtMs: now + 60_000 });
      const callServerTool = vi.fn(async () => ({
        content: [],
        structuredContent: {
          complete: true,
          cursor: "0",
          nextCursor: null,
          records: [
            { id: "source-record", description: "", sequenceLength: 4 },
          ],
          sourceRevision: session.sourceRevision,
        },
      }));
      const app = {
        callServerTool,
        getHostCapabilities: () => ({}),
        getHostContext: () => hostContext,
      };
      const client = createHostScientificSequenceDataClient(app);
      if (client == null)
        throw new Error("Expected an authenticated Sequence client.");

      hostContext = sequenceHostContext({
        channelId: "rotated-sequence-channel",
        expiresAtMs: now + 60_000,
      });
      expect(
        refreshHostScientificSequenceDataClient(app, client, hostContext),
      ).toBe(true);

      now += 6 * 60_000;
      hostContext = sequenceHostContext({
        channelId: "renewed-sequence-channel",
        expiresAtMs: now + 60_000,
      });
      expect(
        refreshHostScientificSequenceDataClient(app, client, hostContext),
      ).toBe(true);
      expect(client.session.backendGeneration).toBe(session.backendGeneration);
      await client.listRecords({ limit: 1 });
      expect(callServerTool).toHaveBeenCalledWith(
        expect.objectContaining({
          arguments: expect.objectContaining({
            backendGeneration: session.backendGeneration,
            channelId: "renewed-sequence-channel",
          }),
        }),
        undefined,
      );
    } finally {
      clock.mockRestore();
    }
  });

  it("rejects stale, forged, expired, and widened renewed native authority", async () => {
    const initial = sequenceHostContext({ expiresAtMs: Date.now() + 60_000 });
    let hostContext = initial;
    const callServerTool = vi.fn(async () => ({
      content: [],
      structuredContent: {
        complete: true,
        cursor: "0",
        nextCursor: null,
        records: [{ id: "source-record", description: "", sequenceLength: 4 }],
        sourceRevision: session.sourceRevision,
      },
    }));
    const app = {
      callServerTool,
      getHostCapabilities: () => ({}),
      getHostContext: () => hostContext,
    };
    const client = createHostScientificSequenceDataClient(app);
    if (client == null)
      throw new Error("Expected an authenticated Sequence client.");

    for (const overrides of [
      { backendGeneration: session.backendGeneration - 1 },
      { backendInstanceId: "substituted-instance" },
      { logicalSessionId: "substituted-session" },
      { sourceRevision: "substituted-source" },
      { frameId: "substituted-frame" },
      { expiresAtMs: Date.now() - 1 },
      { canEditApprovedSource: false },
    ]) {
      hostContext = sequenceHostContext(overrides);
      expect(
        refreshHostScientificSequenceDataClient(app, client, hostContext),
      ).toBe(false);
      expect(client.session).toEqual(session);
    }

    await client.listRecords({ limit: 1 });
    expect(callServerTool).toHaveBeenCalledWith(
      expect.objectContaining({
        arguments: expect.objectContaining({
          backendGeneration: session.backendGeneration,
          backendInstanceId: session.backendInstanceId,
          channelId: "sequence-channel-1",
          frameId: "sequence-frame-1",
        }),
      }),
      undefined,
    );
  });

  it("recovers native authority from host context after the real SDK strips scientific capabilities", async () => {
    const scientificViewers = {
      protocolVersion: 1,
      processIsolation: "family-process",
      binaryTransfer: "bounded-process-ipc",
      familyScopedChannels: true,
      transportSupportsRangeReads: true,
      attachment: {
        family: "sequence",
        logicalSessionId: session.logicalSessionId,
        backendInstanceId: session.backendInstanceId,
        backendGeneration: session.backendGeneration,
        frameId: "sdk-sequence-frame",
        channelId: "sdk-sequence-channel",
        expiresAtMs: Date.now() + 60_000,
      },
      effectiveCapabilities: {
        ...session,
        canReadRanges: true,
      },
    };
    const initialized = McpUiInitializeResultSchema.parse({
      protocolVersion: "2026-01-26",
      hostInfo: { name: "Installed Sequence host", version: "1.0.0" },
      hostCapabilities: { serverTools: {}, scientificViewers },
      hostContext: {
        availableDisplayModes: ["inline"],
        displayMode: "inline",
        scientificViewers,
      },
    });
    expect(
      Object.hasOwn(initialized.hostCapabilities, "scientificViewers"),
    ).toBe(false);
    expect(Object.hasOwn(initialized.hostContext, "scientificViewers")).toBe(
      true,
    );

    const callServerTool = vi.fn(async () => ({
      content: [],
      structuredContent: {
        complete: true,
        cursor: "0",
        nextCursor: null,
        records: [{ id: "source-record", description: "", sequenceLength: 4 }],
        sourceRevision: session.sourceRevision,
      },
    }));
    const client = createHostScientificSequenceDataClient({
      getHostCapabilities: () => initialized.hostCapabilities,
      getHostContext: () => initialized.hostContext,
      callServerTool,
    });

    expect(client?.session).toMatchObject({
      ...session,
      canEditApprovedSource: true,
    });
    await expect(client?.listRecords({ limit: 1 })).resolves.toMatchObject({
      records: [{ id: "source-record" }],
    });
    expect(callServerTool).toHaveBeenCalledWith(
      expect.objectContaining({
        arguments: expect.objectContaining({
          frameId: "sdk-sequence-frame",
          channelId: "sdk-sequence-channel",
          resourceUri: "ui://sequence-viewer/viewer",
        }),
        name: "ui/scientific/sequence/records",
      }),
      undefined,
    );
  });

  it("rejects a malformed host-context capability without falling back to a substituted host", () => {
    const scientificViewers = {
      protocolVersion: 1,
      processIsolation: "family-process",
      binaryTransfer: "bounded-process-ipc",
      familyScopedChannels: true,
      transportSupportsRangeReads: true,
      attachment: {
        family: "sequence",
        logicalSessionId: session.logicalSessionId,
        backendInstanceId: session.backendInstanceId,
        backendGeneration: session.backendGeneration,
        frameId: "sequence-frame-1",
        channelId: "sequence-channel-1",
        expiresAtMs: Date.now() + 60_000,
      },
      effectiveCapabilities: {
        ...session,
        canReadRanges: true,
      },
    };
    const callServerTool = vi.fn();
    const client = createHostScientificSequenceDataClient({
      getHostCapabilities: () => ({ serverTools: {}, scientificViewers }),
      getHostContext: () => ({
        scientificViewers: {
          ...scientificViewers,
          attachment: {
            ...scientificViewers.attachment,
            logicalSessionId: "substituted-sequence-session",
          },
        },
      }),
      callServerTool,
    });

    expect(client).toBeNull();
    expect(callServerTool).not.toHaveBeenCalled();
  });

  it("keeps range reads available but refuses source writes without the explicit host capability", async () => {
    const callServerTool = vi.fn(async () => ({
      content: [],
      structuredContent: {
        cursor: "0",
        nextCursor: null,
        sourceRevision: session.sourceRevision,
        complete: true,
        records: [{ id: "source-record", description: "", sequenceLength: 4 }],
      },
    }));
    for (const canEditApprovedSource of [undefined, false]) {
      callServerTool.mockClear();
      const app = {
        getHostCapabilities: () => ({
          serverTools: {},
          scientificViewers: {
            protocolVersion: 1,
            processIsolation: "family-process",
            binaryTransfer: "bounded-process-ipc",
            familyScopedChannels: true,
            transportSupportsRangeReads: true,
            attachment: {
              family: "sequence",
              logicalSessionId: session.logicalSessionId,
              backendInstanceId: session.backendInstanceId,
              backendGeneration: session.backendGeneration,
              frameId: "sequence-frame-1",
              channelId: "sequence-channel-1",
              expiresAtMs: Date.now() + 60_000,
            },
            effectiveCapabilities: {
              family: session.family,
              logicalSessionId: session.logicalSessionId,
              backendInstanceId: session.backendInstanceId,
              backendGeneration: session.backendGeneration,
              sourceRevision: session.sourceRevision,
              canReadRanges: true,
              ...(canEditApprovedSource == null
                ? {}
                : { canEditApprovedSource }),
            },
          },
        }),
        callServerTool,
      };
      const client = createHostScientificSequenceDataClient(app);
      expect(client?.session.canEditApprovedSource).toBe(false);
      await expect(client?.listRecords({ limit: 1 })).resolves.toMatchObject({
        records: [{ id: "source-record" }],
      });
      await expect(
        client?.beginSourceEdit({
          approvedOperation: "replace-source",
          expectedSourceRevision: session.sourceRevision,
        }),
      ).rejects.toThrow(/authorized/u);
      expect(callServerTool).toHaveBeenCalledTimes(1);
      expect(callServerTool).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "ui/scientific/sequence/records",
        }),
        undefined,
      );
    }
  });

  it("never dispatches any source-edit operation from an unapproved native session", async () => {
    const request = vi.fn<SequenceScientificDataTransport["request"]>();
    const client = new ScientificSequenceDataClient(
      { request },
      { ...session, canEditApprovedSource: false },
    );

    await expect(
      client.beginSourceEdit({
        approvedOperation: "replace-source",
        expectedSourceRevision: session.sourceRevision,
      }),
    ).rejects.toThrow(/authorized/u);
    await expect(
      client.appendSourceEdit({
        editId: "source-edit-1",
        offsetDecimal: "0",
        bytes: new Uint8Array([65]),
      }),
    ).rejects.toThrow(/safe|authorized/u);
    await expect(
      client.commitSourceEdit({ editId: "source-edit-1" }),
    ).rejects.toThrow(/authorized/u);
    await expect(
      client.abortSourceEdit({ editId: "source-edit-1" }),
    ).rejects.toThrow(/authorized/u);
    await expect(
      client.resumeSourceEdit({ editId: "source-edit-1" }),
    ).rejects.toThrow(/authorized/u);
    expect(request).not.toHaveBeenCalled();
  });

  it("reads authenticated original source windows at exact offsets beyond four GiB", async () => {
    const bytes = new Uint8Array([65, 67, 71, 84]);
    const request = vi
      .fn<SequenceScientificDataTransport["request"]>()
      .mockResolvedValue({ structuredContent: { bytes, eof: false } });
    const client = new ScientificSequenceDataClient({ request }, session);

    await expect(
      client.readOriginalSourceRange({
        length: MAX_SEQUENCE_SOURCE_RANGE_BYTES,
        offsetDecimal: "4294967317",
      }),
    ).resolves.toEqual({ bytes, eof: false });
    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({
        operation: "ui/scientific/sequence/read-range",
        payload: {
          length: MAX_SEQUENCE_SOURCE_RANGE_BYTES,
          offsetDecimal: "4294967317",
        },
        sourceRevision: session.sourceRevision,
      }),
    );
  });

  it("rejects unsafe raw-source ranges before dispatching authenticated filesystem access", async () => {
    const request = vi.fn<SequenceScientificDataTransport["request"]>();
    const client = new ScientificSequenceDataClient({ request }, session);
    for (const invalid of [
      { length: 0, offsetDecimal: "0" },
      { length: -1, offsetDecimal: "0" },
      { length: MAX_SEQUENCE_SOURCE_RANGE_BYTES + 1, offsetDecimal: "0" },
      { length: 1.5, offsetDecimal: "0" },
      { length: 1, offsetDecimal: "-1" },
      { length: 1, offsetDecimal: "01" },
      { length: 1, offsetDecimal: "1e8" },
    ]) {
      await expect(client.readOriginalSourceRange(invalid)).rejects.toThrow(
        /safe/iu,
      );
    }
    expect(request).not.toHaveBeenCalled();
  });

  it("rejects forged, stalled, or oversized source range results and propagates authorization refusal", async () => {
    const request = vi.fn<SequenceScientificDataTransport["request"]>();
    const client = new ScientificSequenceDataClient({ request }, session);
    for (const structuredContent of [
      { bytes: new Uint8Array(5), eof: false },
      { bytes: new Uint8Array(), eof: false },
      { bytes: [1, 2], eof: true },
      { bytes: new Uint8Array([1]), eof: "true" },
    ]) {
      request.mockResolvedValueOnce({ structuredContent });
      await expect(
        client.readOriginalSourceRange({ length: 4, offsetDecimal: "0" }),
      ).rejects.toThrow();
    }
    request.mockRejectedValueOnce(
      new Error("PERMISSION_DENIED: source grant revoked"),
    );
    await expect(
      client.readOriginalSourceRange({ length: 4, offsetDecimal: "0" }),
    ).rejects.toThrow(/permission.denied|revoked/iu);
  });

  it("refuses an expired or differently bound first-party host attachment", () => {
    const callServerTool = vi.fn();
    for (const overrides of [
      { expiresAtMs: Date.now() - 1 },
      { logicalSessionId: "another-sequence-session" },
      { family: "structure" },
    ]) {
      const app = {
        getHostCapabilities: () => ({
          serverTools: {},
          scientificViewers: {
            protocolVersion: 1,
            processIsolation: "family-process",
            binaryTransfer: "bounded-process-ipc",
            familyScopedChannels: true,
            transportSupportsRangeReads: true,
            attachment: {
              ...session,
              frameId: "sequence-frame-1",
              channelId: "sequence-channel-1",
              expiresAtMs: Date.now() + 60_000,
              ...overrides,
            },
            effectiveCapabilities: { ...session, canReadRanges: true },
          },
        }),
        callServerTool,
      };
      expect(createHostScientificSequenceDataClient(app)).toBeNull();
    }
    expect(callServerTool).not.toHaveBeenCalled();
  });

  it("rejects unauthenticated loopback and unknown scientific transports", () => {
    const callServerTool = vi.fn();
    for (const binaryTransfer of [
      "host-private-loopback",
      "http://127.0.0.1",
      "localhost",
      undefined,
    ]) {
      const app = {
        getHostCapabilities: () => ({
          serverTools: {},
          scientificViewers: {
            protocolVersion: 1,
            processIsolation: "family-process",
            binaryTransfer,
            familyScopedChannels: true,
            transportSupportsRangeReads: true,
            attachment: {
              ...session,
              frameId: "sequence-frame-1",
              channelId: "sequence-channel-1",
              expiresAtMs: Date.now() + 60_000,
            },
            effectiveCapabilities: { ...session, canReadRanges: true },
          },
        }),
        callServerTool,
      };
      expect(createHostScientificSequenceDataClient(app)).toBeNull();
    }
    expect(callServerTool).not.toHaveBeenCalled();
  });

  it("persists and restores the exact Sequence checkpoint through the authenticated native host", async () => {
    const checkpoint = new TextEncoder().encode(
      '{"version":1,"viewport":{"start1":4294967301}}',
    );
    const request = vi
      .fn<SequenceScientificDataTransport["request"]>()
      .mockResolvedValueOnce({
        structuredContent: {
          recoveryReference: "sequence-recovery-1",
          logicalSessionId: session.logicalSessionId,
          lastAcknowledgedRevision: 12,
          checkpointVersion: 1,
        },
      })
      .mockResolvedValueOnce({
        structuredContent: {
          checkpoint,
          lastAcknowledgedRevision: 12,
          sourceRevision: session.sourceRevision,
          recoveryReference: "sequence-recovery-1",
          hasCheckpoint: true,
        },
      });
    const client = new ScientificSequenceDataClient({ request }, session);

    await expect(
      client.checkpoint({ checkpoint, lastAcknowledgedRevision: 12 }),
    ).resolves.toMatchObject({
      logicalSessionId: session.logicalSessionId,
      lastAcknowledgedRevision: 12,
      checkpointVersion: 1,
    });
    await expect(client.restoreCheckpoint()).resolves.toMatchObject({
      checkpoint,
      sourceRevision: session.sourceRevision,
      hasCheckpoint: true,
    });
    expect(request.mock.calls.map(([input]) => input.operation)).toEqual([
      "ui/scientific/sequence/checkpoint",
      "ui/scientific/sequence/restore_checkpoint",
    ]);
    expect(request).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        logicalSessionId: session.logicalSessionId,
        sourceRevision: session.sourceRevision,
        payload: { checkpoint, lastAcknowledgedRevision: 12 },
      }),
    );
    expect(request).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ payload: {} }),
    );
  });

  it("rejects oversized, stale, substituted, and malformed recovery checkpoints", async () => {
    const request = vi.fn<SequenceScientificDataTransport["request"]>();
    const client = new ScientificSequenceDataClient({ request }, session);

    await expect(
      client.checkpoint({
        checkpoint: new Uint8Array(256 * 1024 + 1),
        lastAcknowledgedRevision: 1,
      }),
    ).rejects.toThrow(/checkpoint|bounded/u);
    await expect(
      client.checkpoint({
        checkpoint: new Uint8Array([1]),
        lastAcknowledgedRevision: -1,
      }),
    ).rejects.toThrow();
    expect(request).not.toHaveBeenCalled();

    request.mockResolvedValueOnce({
      structuredContent: {
        recoveryReference: "sequence-recovery-1",
        logicalSessionId: "different-sequence-session",
        lastAcknowledgedRevision: 2,
        checkpointVersion: 1,
      },
    });
    await expect(
      client.checkpoint({
        checkpoint: new Uint8Array([1]),
        lastAcknowledgedRevision: 2,
      }),
    ).rejects.toThrow(/different session/u);

    request.mockResolvedValueOnce({
      structuredContent: {
        checkpoint: new Uint8Array([1]),
        lastAcknowledgedRevision: 2,
        sourceRevision: "different-source-revision",
        recoveryReference: "sequence-recovery-1",
        hasCheckpoint: true,
      },
    });
    await expect(client.restoreCheckpoint()).rejects.toThrow(/revision/u);
  });

  it("opens a new native viewer without mistaking its bootstrap marker for a recovered scene", async () => {
    const bootstrap = new TextEncoder().encode(
      JSON.stringify({
        version: 1,
        family: "sequence",
        logicalSessionId: session.logicalSessionId,
        sourceRevision: session.sourceRevision,
        lastAcknowledgedRevision: 0,
        stateStatus: "not-captured",
      }),
    );
    const request = vi
      .fn<SequenceScientificDataTransport["request"]>()
      .mockResolvedValueOnce({
        structuredContent: {
          checkpoint: bootstrap,
          lastAcknowledgedRevision: 0,
          sourceRevision: session.sourceRevision,
          recoveryReference: "sequence-recovery-1",
          hasCheckpoint: false,
        },
      })
      .mockResolvedValueOnce({
        structuredContent: { hasCheckpoint: false },
      });
    const client = new ScientificSequenceDataClient({ request }, session);

    await expect(client.restoreCheckpoint()).resolves.toMatchObject({
      checkpoint: bootstrap,
      sourceRevision: session.sourceRevision,
      hasCheckpoint: false,
    });
    await expect(client.restoreCheckpoint()).resolves.toEqual({
      hasCheckpoint: false,
    });
    expect(request.mock.calls.map(([input]) => input.operation)).toEqual([
      "ui/scientific/sequence/restore_checkpoint",
      "ui/scientific/sequence/restore_checkpoint",
    ]);
  });

  it("restores genuine cross-realm Electron checkpoint bytes without accepting other views", async () => {
    const crossRealmCheckpoint: Uint8Array = runInNewContext(
      "new Uint8Array([123, 34, 118, 34, 58, 49, 125])",
    );
    expect(crossRealmCheckpoint).not.toBeInstanceOf(Uint8Array);
    expect(ArrayBuffer.isView(crossRealmCheckpoint)).toBe(true);
    const request = vi
      .fn<SequenceScientificDataTransport["request"]>()
      .mockResolvedValueOnce({
        structuredContent: {
          checkpoint: crossRealmCheckpoint,
          lastAcknowledgedRevision: 3,
          sourceRevision: session.sourceRevision,
          recoveryReference: "sequence-recovery-1",
          hasCheckpoint: true,
        },
      })
      .mockResolvedValueOnce({
        structuredContent: {
          checkpoint: new DataView(new ArrayBuffer(8)),
          lastAcknowledgedRevision: 3,
          sourceRevision: session.sourceRevision,
          recoveryReference: "sequence-recovery-1",
          hasCheckpoint: true,
        },
      });
    const client = new ScientificSequenceDataClient({ request }, session);

    await expect(client.restoreCheckpoint()).resolves.toMatchObject({
      checkpoint: crossRealmCheckpoint,
      hasCheckpoint: true,
    });
    await expect(client.restoreCheckpoint()).rejects.toThrow(/bytes/u);
  });

  it("preserves bounded page-and-record continuations without dropping records", async () => {
    const request = vi.fn<SequenceScientificDataTransport["request"]>(
      async () => ({
        structuredContent: {
          cursor: "0:2",
          nextCursor: "0:4",
          sourceRevision: session.sourceRevision,
          complete: false,
          records: [
            { id: "record-3", description: "", sequenceLength: 8 },
            { id: "record-4", description: "", sequenceLength: 9 },
          ],
        },
      }),
    );
    const client = new ScientificSequenceDataClient({ request }, session);

    await expect(
      client.listRecords({ cursor: "0:2", limit: 2 }),
    ).resolves.toMatchObject({
      cursor: "0:2",
      nextCursor: "0:4",
      records: [{ id: "record-3" }, { id: "record-4" }],
    });
    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({ payload: { cursor: "0:2", limit: 2 } }),
    );
  });

  it("writes the original source only through an explicitly approved bounded native transaction", async () => {
    const expiresAtMs = Date.now() + 60_000;
    const bytes = new TextEncoder().encode(">updated\nAACCGGTT\n");
    const request = vi
      .fn<SequenceScientificDataTransport["request"]>()
      .mockResolvedValueOnce({
        structuredContent: {
          editId: "sequence-source-edit-1",
          expiresAtMs,
          sourceRevision: session.sourceRevision,
          bytesWrittenDecimal: "0",
        },
      })
      .mockResolvedValueOnce({
        structuredContent: {
          editId: "sequence-source-edit-1",
          expiresAtMs,
          sourceRevision: session.sourceRevision,
          bytesWrittenDecimal: String(bytes.byteLength),
        },
      })
      .mockResolvedValueOnce({
        structuredContent: {
          editId: "sequence-source-edit-1",
          sourceRevision: "updated-source-revision-2",
          bytesWrittenDecimal: String(bytes.byteLength),
          sourceIdentity: {
            fileId: "source-file-1",
            etag: "updated-source-etag-2",
            rootId: "workspace-root-1",
            sizeBytesDecimal: String(bytes.byteLength),
          },
        },
      });
    const client = new ScientificSequenceDataClient({ request }, session);

    expect(request).not.toHaveBeenCalled();
    const lease = await client.beginSourceEdit({
      approvedOperation: "replace-source",
      expectedSourceRevision: session.sourceRevision,
      maxOutputBytesDecimal: String(bytes.byteLength),
    });
    await client.appendSourceEdit({
      editId: lease.editId,
      offsetDecimal: "0",
      bytes,
    });
    await expect(
      client.commitSourceEdit({ editId: lease.editId }),
    ).resolves.toMatchObject({
      sourceRevision: "updated-source-revision-2",
      bytesWrittenDecimal: String(bytes.byteLength),
    });
    expect(request.mock.calls.map(([input]) => input.operation)).toEqual([
      "ui/scientific/sequence/source_edit/begin",
      "ui/scientific/sequence/source_edit/append",
      "ui/scientific/sequence/source_edit/commit",
    ]);
    expect(request).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        payload: {
          approvedOperation: "replace-source",
          expectedSourceRevision: session.sourceRevision,
          maxOutputBytesDecimal: String(bytes.byteLength),
        },
      }),
    );
  });

  it("rejects stale, oversized, or substituted source edits before writing the original file", async () => {
    const request = vi.fn<SequenceScientificDataTransport["request"]>();
    const client = new ScientificSequenceDataClient({ request }, session);

    await expect(
      client.beginSourceEdit({
        approvedOperation: "replace-source",
        expectedSourceRevision: "substituted-source-revision",
      }),
    ).rejects.toThrow(/authorized/u);
    await expect(
      client.appendSourceEdit({
        editId: "source-edit-1",
        offsetDecimal: "0",
        bytes: new Uint8Array(64 * 1024 + 1),
      }),
    ).rejects.toThrow(/safe/u);
    expect(request).not.toHaveBeenCalled();

    request.mockResolvedValueOnce({
      structuredContent: {
        editId: "source-edit-1",
        expiresAtMs: Date.now() + 60_000,
        sourceRevision: "substituted-source-revision",
        bytesWrittenDecimal: "0",
      },
    });
    await expect(
      client.beginSourceEdit({
        approvedOperation: "replace-source",
        expectedSourceRevision: session.sourceRevision,
      }),
    ).rejects.toThrow(/stale|invalid/u);
  });

  it("negotiates bounded one-MiB original-source writes with stable idempotency keys", async () => {
    const bytes = new Uint8Array(MAX_SEQUENCE_SOURCE_EDIT_CHUNK_BYTES);
    const request = vi
      .fn<SequenceScientificDataTransport["request"]>()
      .mockResolvedValueOnce({
        structuredContent: {
          bytesWrittenDecimal: "0",
          editId: "large-source-edit",
          expiresAtMs: Date.now() + 60_000,
          maxChunkBytes: MAX_SEQUENCE_SOURCE_EDIT_CHUNK_BYTES,
          sourceRevision: session.sourceRevision,
        },
      })
      .mockResolvedValueOnce({
        structuredContent: {
          bytesWrittenDecimal: String(bytes.byteLength),
          editId: "large-source-edit",
          expiresAtMs: Date.now() + 60_000,
          maxChunkBytes: MAX_SEQUENCE_SOURCE_EDIT_CHUNK_BYTES,
          sourceRevision: session.sourceRevision,
        },
      });
    const client = new ScientificSequenceDataClient({ request }, session);
    const lease = await client.beginSourceEdit({
      approvedOperation: "replace-source",
      expectedSourceRevision: session.sourceRevision,
    });
    expect(lease.maxChunkBytes).toBe(MAX_SEQUENCE_SOURCE_EDIT_CHUNK_BYTES);
    await client.appendSourceEdit({
      bytes,
      editId: lease.editId,
      offsetDecimal: "0",
      requestId: "stable-one-mib-chunk",
    });
    const appendedChunk = request.mock.calls[1]?.[0].payload;
    expect(appendedChunk?.bytes).toBe(bytes);
    expect(appendedChunk?.requestId).toBe("stable-one-mib-chunk");
    await expect(
      client.appendSourceEdit({
        bytes: new Uint8Array(MAX_SEQUENCE_SOURCE_EDIT_CHUNK_BYTES + 1),
        editId: lease.editId,
        offsetDecimal: String(bytes.byteLength),
        requestId: "oversized-chunk",
      }),
    ).rejects.toThrow(/safe/u);
    expect(request).toHaveBeenCalledTimes(2);
  });

  it("resumes a durable original-source edit at its authenticated committed offset", async () => {
    const request = vi
      .fn<SequenceScientificDataTransport["request"]>()
      .mockResolvedValue({
        structuredContent: {
          bytesWrittenDecimal: "1048576",
          editId: "durable-source-edit",
          expiresAtMs: Date.now() + 60_000,
          maxChunkBytes: MAX_SEQUENCE_SOURCE_EDIT_CHUNK_BYTES,
          sourceRevision: session.sourceRevision,
          state: "staging",
        },
      });
    const client = new ScientificSequenceDataClient({ request }, session);
    await expect(
      client.resumeSourceEdit({ editId: "durable-source-edit" }),
    ).resolves.toMatchObject({
      bytesWrittenDecimal: "1048576",
      maxChunkBytes: MAX_SEQUENCE_SOURCE_EDIT_CHUNK_BYTES,
      state: "staging",
    });
    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({
        operation: "ui/scientific/sequence/source_edit/resume",
        payload: { editId: "durable-source-edit" },
      }),
    );
  });

  it("rejects renewed source edits with substituted authority or unsafe negotiated chunks", async () => {
    const request = vi.fn<SequenceScientificDataTransport["request"]>();
    const client = new ScientificSequenceDataClient({ request }, session);
    for (const invalid of [
      { sourceRevision: "substituted-source" },
      { editId: "substituted-edit" },
      { expiresAtMs: Date.now() - 1 },
      { maxChunkBytes: MAX_SEQUENCE_SOURCE_EDIT_CHUNK_BYTES + 1 },
    ]) {
      request.mockResolvedValueOnce({
        structuredContent: {
          bytesWrittenDecimal: "0",
          editId: "durable-source-edit",
          expiresAtMs: Date.now() + 60_000,
          maxChunkBytes: MAX_SEQUENCE_SOURCE_EDIT_CHUNK_BYTES,
          sourceRevision: session.sourceRevision,
          state: "staging",
          ...invalid,
        },
      });
      await expect(
        client.resumeSourceEdit({ editId: "durable-source-edit" }),
      ).rejects.toThrow();
    }
  });

  it("recovers an exactly-once published original when the commit response was lost", async () => {
    const committedResult = {
      bytesWrittenDecimal: "1048576",
      editId: "published-source-edit",
      sourceIdentity: {
        etag: "source-etag-v2",
        fileId: "source-file-1",
        rootId: "workspace-root-1",
        sizeBytesDecimal: "1048576",
      },
      sourceRevision: "source-revision-v2",
    };
    const request = vi
      .fn<SequenceScientificDataTransport["request"]>()
      .mockResolvedValue({
        structuredContent: {
          bytesWrittenDecimal: "1048576",
          committedResult,
          editId: "published-source-edit",
          expiresAtMs: Date.now() + 60_000,
          maxChunkBytes: MAX_SEQUENCE_SOURCE_EDIT_CHUNK_BYTES,
          sourceRevision: session.sourceRevision,
          state: "published",
        },
      });
    const client = new ScientificSequenceDataClient({ request }, session);
    await expect(
      client.resumeSourceEdit({ editId: "published-source-edit" }),
    ).resolves.toMatchObject({ committedResult, state: "published" });
  });

  it("rejects forged cached publications before trusting a resumed original-source commit", async () => {
    const committedResult = {
      bytesWrittenDecimal: "1048576",
      editId: "published-source-edit",
      sourceIdentity: {
        etag: "independently-validated-physical-etag-v2",
        fileId: "source-file-1",
        rootId: "workspace-root-1",
        sizeBytesDecimal: "1048576",
      },
      sourceRevision: "distinct-logical-source-revision-v2",
    };
    const request = vi.fn<SequenceScientificDataTransport["request"]>();
    const client = new ScientificSequenceDataClient({ request }, session);
    for (const forgery of [
      { ...committedResult, editId: "substituted-source-edit" },
      { ...committedResult, bytesWrittenDecimal: "1048575" },
      {
        ...committedResult,
        sourceIdentity: {
          ...committedResult.sourceIdentity,
          sizeBytesDecimal: "1048575",
        },
      },
      {
        ...committedResult,
        sourceIdentity: { ...committedResult.sourceIdentity, etag: "" },
      },
      { ...committedResult, sourceRevision: session.sourceRevision },
      undefined,
    ]) {
      request.mockResolvedValueOnce({
        structuredContent: {
          bytesWrittenDecimal: "1048576",
          committedResult: forgery,
          editId: "published-source-edit",
          expiresAtMs: Date.now() + 60_000,
          maxChunkBytes: MAX_SEQUENCE_SOURCE_EDIT_CHUNK_BYTES,
          sourceRevision: session.sourceRevision,
          state: "published",
        },
      });
      await expect(
        client.resumeSourceEdit({ editId: "published-source-edit" }),
      ).rejects.toThrow();
    }
  });

  it("renews the same durable source edit after more than thirty minutes of streaming", async () => {
    let now = 1_800_000_000_000;
    const clock = vi.spyOn(Date, "now").mockImplementation(() => now);
    try {
      const request = vi
        .fn<SequenceScientificDataTransport["request"]>()
        .mockResolvedValueOnce({
          structuredContent: {
            bytesWrittenDecimal: "0",
            editId: "long-running-source-edit",
            expiresAtMs: now + 5 * 60_000,
            maxChunkBytes: MAX_SEQUENCE_SOURCE_EDIT_CHUNK_BYTES,
            sourceRevision: session.sourceRevision,
          },
        });
      const client = new ScientificSequenceDataClient({ request }, session);
      await client.beginSourceEdit({
        approvedOperation: "replace-source",
        expectedSourceRevision: session.sourceRevision,
      });

      now += 31 * 60_000;
      request.mockResolvedValueOnce({
        structuredContent: {
          bytesWrittenDecimal: "1048576",
          editId: "long-running-source-edit",
          expiresAtMs: now + 5 * 60_000,
          maxChunkBytes: MAX_SEQUENCE_SOURCE_EDIT_CHUNK_BYTES,
          sourceRevision: session.sourceRevision,
          state: "staging",
        },
      });
      await expect(
        client.resumeSourceEdit({ editId: "long-running-source-edit" }),
      ).resolves.toMatchObject({
        bytesWrittenDecimal: "1048576",
        editId: "long-running-source-edit",
      });
      expect(request.mock.calls.map(([call]) => call.operation)).toEqual([
        "ui/scientific/sequence/source_edit/begin",
        "ui/scientific/sequence/source_edit/resume",
      ]);
    } finally {
      clock.mockRestore();
    }
  });

  it("aborts only the authenticated, explicitly selected original-file transaction", async () => {
    const request = vi
      .fn<SequenceScientificDataTransport["request"]>()
      .mockResolvedValueOnce({
        structuredContent: {
          editId: "source-edit-1",
          aborted: true,
        },
      });
    const client = new ScientificSequenceDataClient({ request }, session);

    await expect(
      client.abortSourceEdit({ editId: "source-edit-1" }),
    ).resolves.toBeUndefined();
    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({
        operation: "ui/scientific/sequence/source_edit/abort",
        payload: { editId: "source-edit-1" },
      }),
    );
  });

  it("asks the isolated backend to stream every source record without a full-file payload", async () => {
    const request = vi.fn<SequenceScientificDataTransport["request"]>(
      async () => ({
        structuredContent: {
          transactionId: "source-transaction-1",
          publicationId: "source-publication-1",
          state: "published",
          bytesWrittenDecimal: "22",
          manifest: {
            entries: [
              {
                relativeName: "all-records.fasta",
                sizeBytesDecimal: "22",
                sha256: `sha256:${"a".repeat(64)}`,
              },
            ],
          },
        },
      }),
    );
    const client = new ScientificSequenceDataClient({ request }, session);

    await expect(
      client.exportOpenedSource({
        artifactKind: "sequence-fasta",
        collisionPolicy: "fail",
        format: "fasta",
        idempotencyKey: "source-export-1",
        memberName: "all-records.fasta",
        relativePath: "results/all-records.fasta",
      }),
    ).resolves.toMatchObject({ state: "published" });
    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({
        operation: "ui/scientific/sequence/export/source",
        payload: {
          artifactKind: "sequence-fasta",
          collisionPolicy: "fail",
          format: "fasta",
          idempotencyKey: "source-export-1",
          memberName: "all-records.fasta",
          pluginVersion: "0.1.43",
          relativePath: "results/all-records.fasta",
        },
      }),
    );
  });

  it("stages a source export for one atomic data-and-provenance publication", async () => {
    const request = vi.fn<SequenceScientificDataTransport["request"]>(
      async () => ({
        structuredContent: {
          bytesWrittenDecimal: "22",
          publicationId: "source-publication-1",
          sha256: "a".repeat(64),
          state: "staging",
          transactionId: "source-transaction-1",
        },
      }),
    );
    const client = new ScientificSequenceDataClient({ request }, session);

    await expect(
      client.stageOpenedSource({
        artifactKind: "sequence-fasta",
        collisionPolicy: "fail",
        format: "fasta",
        idempotencyKey: "source-export-1",
        memberName: "all-records.fasta",
        relativePath: "results/all-records.fasta",
      }),
    ).resolves.toMatchObject({
      bytesWrittenDecimal: "22",
      publicationId: "source-publication-1",
      state: "staging",
    });
    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({
        operation: "ui/scientific/sequence/export/source",
        payload: expect.objectContaining({
          deferCommit: true,
          pluginVersion: "0.1.43",
        }),
      }),
    );
  });

  it("stages genuine native rich generation without receiving source bytes in the renderer", async () => {
    const request = vi.fn<SequenceScientificDataTransport["request"]>(
      async () => ({
        structuredContent: {
          bytesWrittenDecimal: "247",
          publicationId: "rich-publication-1",
          sha256: "b".repeat(64),
          state: "staging",
          transactionId: "rich-transaction-1",
        },
      }),
    );
    const client = new ScientificSequenceDataClient({ request }, session);

    await expect(
      client.stageNativeRichSource({
        artifactKind: "sequence-genbank",
        collisionPolicy: "fail",
        format: "genbank",
        idempotencyKey: "rich-export-1",
        memberName: "reference.gb",
        recordNumber: 1,
        relativePath: "results/reference.gb",
      }),
    ).resolves.toMatchObject({
      bytesWrittenDecimal: "247",
      publicationId: "rich-publication-1",
      sha256: "b".repeat(64),
      state: "staging",
    });
    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({
        operation: "ui/scientific/sequence/export/rich",
        payload: {
          artifactKind: "sequence-genbank",
          collisionPolicy: "fail",
          deferCommit: true,
          format: "genbank",
          idempotencyKey: "rich-export-1",
          memberName: "reference.gb",
          pluginVersion: "0.1.43",
          recordNumber: 1,
          relativePath: "results/reference.gb",
        },
      }),
    );
    expect(request.mock.calls[0]?.[0].payload).not.toHaveProperty("bytes");

    await expect(
      client.stageNativeRichSource({
        artifactKind: "sequence-genbank",
        collisionPolicy: "fail",
        format: "genbank",
        idempotencyKey: "rich-export-1",
        memberName: "reference.gb",
        recordNumber: 0,
        relativePath: "results/reference.gb",
      }),
    ).rejects.toThrow("not valid");
    expect(request).toHaveBeenCalledTimes(1);
  });

  it("restores the authenticated independent data and provenance offsets", async () => {
    const request = vi.fn<SequenceScientificDataTransport["request"]>(
      async () => ({
        structuredContent: {
          bytesWrittenDecimal: "44",
          memberOffsets: [
            {
              bytesWrittenDecimal: "33",
              memberName: "all-records.fasta",
              role: "data",
            },
            {
              bytesWrittenDecimal: "11",
              memberName: "all-records.fasta.provenance.json",
              role: "provenance",
            },
          ],
          publicationId: "source-publication-1",
          state: "staging",
          transactionId: "source-transaction-1",
        },
      }),
    );
    const client = new ScientificSequenceDataClient({ request }, session);

    await expect(
      client.resumeArtifactExport({
        artifactKind: "sequence-fasta",
        collisionPolicy: "fail",
        memberName: "all-records.fasta",
        relativePath: "results/all-records.fasta",
        transactionId: "source-transaction-1",
      }),
    ).resolves.toMatchObject({
      bytesWrittenDecimal: "44",
      memberOffsets: [
        { bytesWrittenDecimal: "33", role: "data" },
        { bytesWrittenDecimal: "11", role: "provenance" },
      ],
    });
    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({
        operation: "ui/scientific/sequence/export/resume",
        payload: expect.objectContaining({
          artifactKind: "sequence-fasta",
          collisionPolicy: "fail",
          pluginVersion: "0.1.43",
          relativePath: "results/all-records.fasta",
        }),
      }),
    );
  });

  it("rejects resumed artifact totals that conflate different durable members", async () => {
    const request = vi.fn<SequenceScientificDataTransport["request"]>(
      async () => ({
        structuredContent: {
          bytesWrittenDecimal: "33",
          memberOffsets: [
            {
              bytesWrittenDecimal: "33",
              memberName: "all-records.fasta",
              role: "data",
            },
            {
              bytesWrittenDecimal: "11",
              memberName: "all-records.fasta.provenance.json",
              role: "provenance",
            },
          ],
          state: "staging",
          transactionId: "source-transaction-1",
        },
      }),
    );
    const client = new ScientificSequenceDataClient({ request }, session);

    await expect(
      client.resumeArtifactExport({
        artifactKind: "sequence-fasta",
        collisionPolicy: "fail",
        memberName: "all-records.fasta",
        relativePath: "results/all-records.fasta",
        transactionId: "source-transaction-1",
      }),
    ).rejects.toThrow(/inconsistent member offsets/u);
  });

  it("uses the host-allowed canonical Sequence alignment tile operation", async () => {
    const request = vi.fn<SequenceScientificDataTransport["request"]>(
      async () => ({
        structuredContent: {
          sourceRevision: session.sourceRevision,
          rowStart1: 1,
          rowEnd1: 1,
          columnStart1: 1,
          columnEnd1: 4,
          rows: [{ id: "row-1", row1: 1, aligned: "A-CG" }],
        },
      }),
    );
    const client = new ScientificSequenceDataClient({ request }, session);
    await client.readAlignmentTile({
      rowStart1: 1,
      rowEnd1: 1,
      columnStart1: 1,
      columnEnd1: 4,
    });
    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({
        operation: "ui/scientific/sequence/alignment/tile",
      }),
    );
  });

  it("publishes only a real user-selected relative destination through the host-owned artifact route", async () => {
    const request = vi.fn<SequenceScientificDataTransport["request"]>(
      async () => ({
        structuredContent: {
          transactionId: "host-transaction-1",
          publicationId: "host-publication-1",
          state: "published",
          bytesWrittenDecimal: "15",
          manifest: { artifactKind: "sequence-fasta" },
        },
      }),
    );
    const client = new ScientificSequenceDataClient({ request }, session);
    await expect(
      client.exportDerivedCopy({
        recordNumber: 1,
        idempotencyKey: "user-export-1",
        memberName: "derived.fasta",
        format: "fasta",
        header: "derived",
        relativePath: "results/derived.fasta",
      }),
    ).resolves.toMatchObject({
      transactionId: "host-transaction-1",
      state: "published",
    });
    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({
        operation: "ui/scientific/sequence/export",
        payload: expect.objectContaining({
          relativePath: "results/derived.fasta",
          collisionPolicy: "fail",
          artifactKind: "sequence-fasta",
        }),
      }),
    );
    expect(JSON.stringify(request.mock.calls)).not.toContain(
      "destinationGrantId",
    );
  });

  it("refuses path traversal before requesting a scientific artifact grant", async () => {
    const request = vi.fn<SequenceScientificDataTransport["request"]>();
    const client = new ScientificSequenceDataClient({ request }, session);
    await expect(
      client.exportDerivedCopy({
        recordNumber: 1,
        idempotencyKey: "unsafe-export-1",
        memberName: "derived.fasta",
        format: "fasta",
        header: "derived",
        relativePath: "../derived.fasta",
      }),
    ).rejects.toThrow(/destination/u);
    expect(request).not.toHaveBeenCalled();
  });

  it.each([
    "C:/Windows/derived.fasta",
    "C:\\Windows\\derived.fasta",
    "\\\\server\\share\\derived.fasta",
    "\\\\?\\C:\\Windows\\derived.fasta",
    "results/derived.fasta:hidden",
    "results/CON.fasta",
    "results/derived.fasta ",
  ])(
    "rejects the platform-unsafe derived destination before native dispatch: %s",
    async (relativePath) => {
      const request = vi.fn<SequenceScientificDataTransport["request"]>();
      const client = new ScientificSequenceDataClient({ request }, session);
      await expect(
        client.exportDerivedCopy({
          recordNumber: 1,
          idempotencyKey: "unsafe-windows-export-1",
          memberName: "derived.fasta",
          format: "fasta",
          header: "derived",
          relativePath,
        }),
      ).rejects.toThrow(/destination/u);
      expect(request).not.toHaveBeenCalled();
    },
  );

  it.each(["CON", "AUX.fasta", "COM1.fastq", "LPT9.fa", "result.fasta "])(
    "rejects the Windows-reserved artifact member before requesting a grant: %s",
    async (memberName) => {
      const request = vi.fn<SequenceScientificDataTransport["request"]>();
      const client = new ScientificSequenceDataClient({ request }, session);
      await expect(
        client.beginArtifactExport({
          artifactKind: "sequence-fasta",
          collisionPolicy: "fail",
          idempotencyKey: "unsafe-windows-member-1",
          memberName,
          relativePath: "results/derived.fasta",
        }),
      ).rejects.toThrow(/safe/u);
      expect(request).not.toHaveBeenCalled();
    },
  );

  it("pages original record metadata over the generation-scoped host bridge", async () => {
    const request = vi.fn<SequenceScientificDataTransport["request"]>(
      async () => ({
        structuredContent: {
          cursor: "0",
          nextCursor: "1",
          sourceRevision: session.sourceRevision,
          complete: false,
          records: [
            {
              id: "late-record",
              description: "Late record",
              sequenceLength: 7,
            },
          ],
        },
      }),
    );
    const client = new ScientificSequenceDataClient({ request }, session);

    await expect(client.listRecords({ limit: 1 })).resolves.toMatchObject({
      nextCursor: "1",
      records: [{ id: "late-record" }],
    });
    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({
        family: "sequence",
        logicalSessionId: session.logicalSessionId,
        backendInstanceId: session.backendInstanceId,
        backendGeneration: 4,
        sourceRevision: session.sourceRevision,
        operation: "ui/scientific/sequence/records",
        payload: { cursor: "0", limit: 1 },
      }),
    );
  });

  it("preserves exact source-matched FASTQ qualities", async () => {
    const request = vi.fn<SequenceScientificDataTransport["request"]>(
      async () => ({
        structuredContent: {
          sourceRevision: session.sourceRevision,
          sequence: "ACGT",
          quality: "1234",
          start1: 1,
          end1: 4,
        },
      }),
    );
    const client = new ScientificSequenceDataClient({ request }, session);

    expect(
      await client.readResidueWindow({
        recordNumber: 100_001,
        start1Decimal: "100000001",
        end1Decimal: "100000004",
        includeQuality: true,
      }),
    ).toMatchObject({ sequence: "ACGT", quality: "1234" });
    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({
        operation: "ui/scientific/sequence/window",
        payload: expect.objectContaining({
          recordNumber: 100_001,
          start1Decimal: "100000001",
          includeQuality: true,
        }),
      }),
    );
  });

  it.each([
    { name: "missing", sourceRevision: undefined },
    { name: "stale", sourceRevision: "changed-source" },
  ])(
    "refuses a $name source revision on a residue window",
    async ({ sourceRevision }) => {
      const request: SequenceScientificDataTransport["request"] = async () => ({
        structuredContent: {
          ...(sourceRevision == null ? {} : { sourceRevision }),
          sequence: "ACGT",
          quality: "1234",
          start1: 1,
          end1: 4,
        },
      });
      const client = new ScientificSequenceDataClient({ request }, session);

      await expect(
        client.readResidueWindow({
          recordNumber: 1,
          start1Decimal: "1",
          end1Decimal: "4",
          includeQuality: true,
        }),
      ).rejects.toThrow(/sourceRevision|revision/u);
    },
  );

  it("rejects stale source results instead of silently loading the whole file", async () => {
    const request: SequenceScientificDataTransport["request"] = async () => ({
      structuredContent: {
        cursor: "0",
        nextCursor: null,
        sourceRevision: "changed-source",
        complete: true,
        records: [],
      },
    });
    const client = new ScientificSequenceDataClient({ request }, session);
    await expect(client.listRecords({ limit: 1 })).rejects.toThrow(/revision/u);
  });

  it("refuses a partial or substituted FASTQ quality string", async () => {
    const request: SequenceScientificDataTransport["request"] = async () => ({
      structuredContent: {
        sourceRevision: session.sourceRevision,
        sequence: "ACGT",
        quality: "12",
      },
    });
    const client = new ScientificSequenceDataClient({ request }, session);
    await expect(
      client.readResidueWindow({
        recordNumber: 1,
        start1Decimal: "1",
        end1Decimal: "4",
        includeQuality: true,
      }),
    ).rejects.toThrow(/qualities/u);
  });

  it("reads distant alignment tiles without constructing a dense matrix", async () => {
    const request: SequenceScientificDataTransport["request"] = async () => ({
      structuredContent: {
        sourceRevision: session.sourceRevision,
        rowStart1: 100_001,
        rowEnd1: 100_001,
        columnStart1: 100_000_001,
        columnEnd1: 100_000_004,
        rows: [{ id: "late-row", row1: 100_001, aligned: "A-CG" }],
      },
    });
    const client = new ScientificSequenceDataClient({ request }, session);
    await expect(
      client.readAlignmentTile({
        rowStart1: 100_001,
        rowEnd1: 100_001,
        columnStart1: 100_000_001,
        columnEnd1: 100_000_004,
      }),
    ).resolves.toMatchObject({ rows: [{ aligned: "A-CG" }] });
  });

  it.each([
    { name: "missing", sourceRevision: undefined },
    { name: "stale", sourceRevision: "changed-source" },
  ])(
    "refuses a $name source revision on an alignment tile",
    async ({ sourceRevision }) => {
      const request: SequenceScientificDataTransport["request"] = async () => ({
        structuredContent: {
          ...(sourceRevision == null ? {} : { sourceRevision }),
          rowStart1: 1,
          rowEnd1: 1,
          columnStart1: 1,
          columnEnd1: 4,
          rows: [{ id: "row-1", row1: 1, aligned: "A-CG" }],
        },
      });
      const client = new ScientificSequenceDataClient({ request }, session);

      await expect(
        client.readAlignmentTile({
          rowStart1: 1,
          rowEnd1: 1,
          columnStart1: 1,
          columnEnd1: 4,
        }),
      ).rejects.toThrow(/sourceRevision|revision/u);
    },
  );

  it("refuses another family's session or oversized pages", async () => {
    const request: SequenceScientificDataTransport["request"] = async () => ({
      structuredContent: {},
    });
    const client = new ScientificSequenceDataClient({ request }, session);
    await expect(client.listRecords({ limit: 257 })).rejects.toThrow(
      /bounded/u,
    );
  });

  it("requests revision-fenced sequence composition from the isolated backend", async () => {
    const request = vi.fn<SequenceScientificDataTransport["request"]>(
      async () => ({
        structuredContent: {
          sourceRevision: session.sourceRevision,
          alphabet: "dna",
          ambiguousBases: 0,
          canonicalBases: 4,
          counts: [
            { symbol: "A", count: 1 },
            { symbol: "C", count: 1 },
            { symbol: "G", count: 1 },
            { symbol: "T", count: 1 },
          ],
          gaps: 0,
          gcExpectedFraction: 0.5,
          gcFraction: 0.5,
          length: 4,
          recordNumber: 1,
        },
      }),
    );
    const client = new ScientificSequenceDataClient({ request }, session);

    await expect(
      client.analyzeComposition({
        recordNumber: 1,
        start1Decimal: "1",
        end1Decimal: "4",
      }),
    ).resolves.toMatchObject({ canonicalBases: 4, gcFraction: 0.5 });
    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({
        operation: "ui/scientific/sequence/analysis/composition",
        sourceRevision: session.sourceRevision,
        payload: {
          recordNumber: 1,
          start1Decimal: "1",
          end1Decimal: "4",
          alphabet: "dna",
        },
      }),
    );
  });

  it("validates bounded reverse-complement and exact genetic-code translation", async () => {
    const request = vi
      .fn<SequenceScientificDataTransport["request"]>()
      .mockResolvedValueOnce({
        structuredContent: {
          sourceRevision: session.sourceRevision,
          alphabet: "dna",
          length: 9,
          recordNumber: 1,
          sequence: "TTACGGCAT",
        },
      })
      .mockResolvedValueOnce({
        structuredContent: {
          sourceRevision: session.sourceRevision,
          ambiguousCodons: 0,
          codonsTranslated: 3,
          frame: 0,
          geneticCode: 1,
          partialBases: 0,
          protein: "MP*",
          recordNumber: 1,
          resolvedAmbiguousCodons: 0,
          stopCount: 1,
          strand: "+",
        },
      });
    const client = new ScientificSequenceDataClient({ request }, session);
    const window = { recordNumber: 1, start1Decimal: "1", end1Decimal: "9" };

    await expect(client.reverseComplement(window)).resolves.toMatchObject({
      sequence: "TTACGGCAT",
    });
    await expect(client.translate(window)).resolves.toMatchObject({
      protein: "MP*",
    });
    expect(request.mock.calls.map(([input]) => input.operation)).toEqual([
      "ui/scientific/sequence/analysis/reverse-complement",
      "ui/scientific/sequence/analysis/translate",
    ]);
    await expect(
      client.translate({ ...window, geneticCode: 7 }),
    ).rejects.toThrow(/genetic code/u);
    expect(request).toHaveBeenCalledTimes(2);
  });

  it("forwards ORF bounds using the actual production worker parameter", async () => {
    const request = vi.fn<SequenceScientificDataTransport["request"]>(
      async () => ({
        structuredContent: {
          sourceRevision: session.sourceRevision,
          complete: true,
          orfs: [
            {
              complete: true,
              end1: 9,
              frame: 0,
              protein: "MK",
              start1: 1,
              startCodon: "ATG",
              stopCodon: "TAA",
              strand: "+",
            },
          ],
          recordNumber: 1,
        },
      }),
    );
    const client = new ScientificSequenceDataClient({ request }, session);

    await expect(
      client.findOpenReadingFrames({
        recordNumber: 1,
        start1Decimal: "1",
        end1Decimal: "9",
        minCodons: 2,
      }),
    ).resolves.toMatchObject({ orfs: [{ protein: "MK" }] });
    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({
        operation: "ui/scientific/sequence/analysis/orfs",
        payload: expect.objectContaining({ minAminoAcids: 2, maxOrfs: 1024 }),
      }),
    );
  });

  it("searches source-backed motifs within the production comparison budget", async () => {
    const request = vi.fn<SequenceScientificDataTransport["request"]>(
      async () => ({
        structuredContent: {
          sourceRevision: session.sourceRevision,
          bins: [{ count: 2, start1: 1, end1: 8 }],
          comparisons: 8,
          complete: true,
          hits: [
            {
              distance: 0,
              end1: 3,
              patternId: "motif-1",
              start1: 1,
              strand: "+",
              wrapsOrigin: false,
            },
          ],
          interpretation: "exact-sequence-match-not-functional-validation",
          patterns: [{ id: "motif-1", mode: "literal" }],
          recordNumber: 1,
        },
      }),
    );
    const client = new ScientificSequenceDataClient({ request }, session);

    await expect(
      client.searchAdvanced({
        recordNumber: 1,
        start1Decimal: "1",
        end1Decimal: "8",
        patterns: [{ id: "motif-1", mode: "literal", pattern: "ACG" }],
      }),
    ).resolves.toMatchObject({ hits: [{ start1: 1, end1: 3 }] });
    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({
        operation: "ui/scientific/sequence/search/advanced",
      }),
    );
  });

  it("reads authenticated quality-control and evidence-tile operations", async () => {
    const request = vi
      .fn<SequenceScientificDataTransport["request"]>()
      .mockResolvedValueOnce({
        structuredContent: {
          sourceRevision: session.sourceRevision,
          complete: true,
          completenessReasons: [],
          cycles: [],
          format: "fastq",
          method: "exact",
          populationRecords: 2,
          qualityEncoding: "phred+33",
          recordsAnalyzed: 2,
          sourceEtag: session.sourceRevision,
          totals: { bases: 8 },
        },
      })
      .mockResolvedValueOnce({
        structuredContent: {
          sourceRevision: session.sourceRevision,
          complete: true,
          reference: "chr1",
          start1: 1,
          end1: 8,
          items: [{ reference: "chr1", start1: 2, end1: 4, id: "variant-1" }],
        },
      });
    const client = new ScientificSequenceDataClient({ request }, session);

    await expect(
      client.qualityControl({ maxRecords: 2 }),
    ).resolves.toMatchObject({
      recordsAnalyzed: 2,
      qualityEncoding: "phred+33",
    });
    await expect(
      client.readEvidenceTile({
        records: [{ reference: "chr1", start1: 2, end1: 4, id: "variant-1" }],
        reference: "chr1",
        start1: 1,
        end1: 8,
      }),
    ).resolves.toMatchObject({ items: [{ id: "variant-1" }] });
    expect(request.mock.calls.map(([input]) => input.operation)).toEqual([
      "ui/scientific/sequence/qc",
      "ui/scientific/sequence/evidence/tile",
    ]);
  });

  it("rejects stale advanced results and unsafe window or track budgets before use", async () => {
    const request = vi.fn<SequenceScientificDataTransport["request"]>(
      async () => ({
        structuredContent: {
          sourceRevision: "stale-source-revision",
          alphabet: "dna",
          length: 4,
          recordNumber: 1,
          sequence: "ACGT",
        },
      }),
    );
    const client = new ScientificSequenceDataClient({ request }, session);

    await expect(
      client.reverseComplement({
        recordNumber: 1,
        start1Decimal: "1",
        end1Decimal: "4",
      }),
    ).rejects.toThrow(/revision/u);
    await expect(
      client.analyzeComposition({
        recordNumber: 1,
        start1Decimal: "1",
        end1Decimal: "1048577",
      }),
    ).rejects.toThrow(/bounded/u);
    await expect(
      client.readTrackTile({
        records: [{ reference: "chr1", start1: 5, end1: 2 }],
        reference: "chr1",
        start1: 1,
        end1: 8,
      }),
    ).rejects.toThrow(/coordinates/u);
    expect(request).toHaveBeenCalledTimes(1);
  });

  it("propagates user cancellation before issuing a source request", async () => {
    const request = vi.fn<SequenceScientificDataTransport["request"]>();
    const client = new ScientificSequenceDataClient({ request }, session);
    const controller = new AbortController();
    controller.abort();

    await expect(
      client.listRecords({ limit: 1, signal: controller.signal }),
    ).rejects.toThrow();
    expect(request).not.toHaveBeenCalled();
  });
});

function sequenceHostContext(
  options: {
    backendGeneration?: number;
    backendInstanceId?: string;
    canEditApprovedSource?: boolean;
    channelId?: string;
    expiresAtMs?: number;
    frameId?: string;
    logicalSessionId?: string;
    sourceRevision?: string;
  } = {},
): { scientificViewers: Record<string, unknown> } {
  const nextSession = {
    ...session,
    backendGeneration: options.backendGeneration ?? session.backendGeneration,
    backendInstanceId: options.backendInstanceId ?? session.backendInstanceId,
    canEditApprovedSource:
      options.canEditApprovedSource ?? session.canEditApprovedSource,
    logicalSessionId: options.logicalSessionId ?? session.logicalSessionId,
    sourceRevision: options.sourceRevision ?? session.sourceRevision,
  };
  return {
    scientificViewers: {
      attachment: {
        backendGeneration: nextSession.backendGeneration,
        backendInstanceId: nextSession.backendInstanceId,
        channelId: options.channelId ?? "sequence-channel-1",
        expiresAtMs: options.expiresAtMs ?? Date.now() + 120_000,
        family: nextSession.family,
        frameId: options.frameId ?? "sequence-frame-1",
        logicalSessionId: nextSession.logicalSessionId,
      },
      binaryTransfer: "bounded-process-ipc",
      effectiveCapabilities: { ...nextSession, canReadRanges: true },
      familyScopedChannels: true,
      processIsolation: "family-process",
      protocolVersion: 1,
      transportSupportsRangeReads: true,
    },
  };
}
