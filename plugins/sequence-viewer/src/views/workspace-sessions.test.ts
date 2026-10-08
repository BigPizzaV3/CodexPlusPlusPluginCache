import { randomUUID } from "node:crypto";

import { describe, expect, it, vi } from "vitest";

import {
  SEQUENCE_PERSIST_WORKBENCH_PAYLOAD_TOOL_NAME,
  SEQUENCE_PREPARE_WORKSPACE_EXPORT_TOOL_NAME,
} from "../workbench-persistence-protocol";
import {
  SEQUENCE_LIST_WORKSPACE_SESSIONS_TOOL_NAME,
  SEQUENCE_RESTORE_WORKSPACE_SESSION_TOOL_NAME,
} from "../workspace-session-protocol";
import { createSequenceWorkspaceSessionClient } from "./workspace-sessions";

describe("workspace session client", () => {
  it("retries read-only discovery but never replays restore", async () => {
    const sessionId = randomUUID();
    const candidateId = randomUUID();
    const callServerTool = vi
      .fn()
      .mockRejectedValueOnce(new Error("transport disconnected"))
      .mockResolvedValueOnce({
        structuredContent: { candidates: [], omittedCandidates: 0 },
      })
      .mockRejectedValueOnce(new Error("network timeout"));
    const client = createSequenceWorkspaceSessionClient(
      { callServerTool } as never,
      sessionId,
    );

    await expect(client.discover()).resolves.toEqual({
      candidates: [],
      omittedCandidates: 0,
    });
    expect(callServerTool).toHaveBeenNthCalledWith(2, {
      arguments: { sessionId },
      name: SEQUENCE_LIST_WORKSPACE_SESSIONS_TOOL_NAME,
    });
    await expect(client.restore(candidateId)).rejects.toThrow("network timeout");
    expect(callServerTool).toHaveBeenCalledTimes(3);
    expect(callServerTool).toHaveBeenLastCalledWith({
      arguments: { candidateId, sessionId },
      name: SEQUENCE_RESTORE_WORKSPACE_SESSION_TOOL_NAME,
    });
  });

  it("sends only the bounded payload and source-relative Save As destination", async () => {
    const sessionId = randomUUID();
    const commandId = randomUUID();
    const callServerTool = vi
      .fn()
      .mockResolvedValueOnce({
        structuredContent: {
          commandId,
          destination: { base: "opened-source", kind: "workspace" },
        },
      })
      .mockImplementationOnce(async ({ arguments: input }) => ({
        structuredContent: {
          destination: { base: "opened-source", kind: "workspace" },
          kind: "session",
          name: "source.sequence-viewer.session.json",
          outputWorkspacePath: "data/source.sequence-viewer.session.json",
          payloadSha256: (input as { sha256: string }).sha256,
          payloadSize: (input as { byteLength: number }).byteLength,
          provenanceWorkspacePath:
            "data/source.sequence-viewer.session.json.provenance.json",
          sha256: "a".repeat(64),
          size: 1_024,
          version: 1,
        },
      }));
    const client = createSequenceWorkspaceSessionClient(
      { callServerTool } as never,
      sessionId,
    );
    const content = '{"schemaVersion":1}';

    await expect(
      client(
        { content, name: "source.sequence-viewer.session.json" },
        "projects/source.sequence-viewer.session.json",
        "next-version",
      ),
    ).resolves.toMatchObject({ kind: "session" });
    expect(callServerTool).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        arguments: expect.objectContaining({
          destination: {
            base: "opened-source",
            collisionPolicy: "next-version",
            kind: "workspace",
            relativePath: "projects/source.sequence-viewer.session.json",
          },
          kind: "session",
          sessionId,
        }),
        name: SEQUENCE_PREPARE_WORKSPACE_EXPORT_TOOL_NAME,
      }),
    );
    expect(callServerTool).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        arguments: expect.objectContaining({
          commandId,
          dataBase64: Buffer.from(content).toString("base64"),
          kind: "session",
          sessionId,
        }),
        name: SEQUENCE_PERSIST_WORKBENCH_PAYLOAD_TOOL_NAME,
      }),
    );
    expect(JSON.stringify(callServerTool.mock.calls)).not.toContain("/home/");
  });
});
