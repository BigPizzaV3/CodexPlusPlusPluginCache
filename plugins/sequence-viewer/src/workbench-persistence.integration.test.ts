import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import type { App } from "@modelcontextprotocol/ext-apps";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { afterEach, describe, expect, it } from "vitest";

import { createSequenceViewerServer } from "./server";
import {
  SEQUENCE_VIEWER_COMPLETE_COMMAND_TOOL_NAME,
  SEQUENCE_VIEWER_REGISTER_SESSION_TOOL_NAME,
  SEQUENCE_VIEWER_WAIT_FOR_COMMAND_TOOL_NAME,
  queuedSequenceViewerCommandSchema,
} from "./viewer-commands";
import {
  SEQUENCE_VIEWER_EXPORT_TOOL_NAME,
  SEQUENCE_VIEWER_SAVE_SESSION_TOOL_NAME,
} from "./viewer-operations";
import { persistSequenceCommandResult } from "./views/workbench-persistence";

const temporaryDirectories: Array<string> = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { force: true, recursive: true })),
  );
});

describe("real app/server workbench persistence protocol", () => {
  it("persists multi-megabyte artifacts and near-limit sessions before compact completion", async () => {
    const stateDirectory = await temporaryDirectory();
    const client = new Client(
      { name: "sequence-persistence-integration", version: "0.1.0" },
      { capabilities: {} },
    );
    const server = createSequenceViewerServer({ stateDirectory });
    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();
    await Promise.all([
      client.connect(clientTransport),
      server.connect(serverTransport),
    ]);
    const app = {
      callServerTool: async (request: Parameters<App["callServerTool"]>[0]) =>
        await client.callTool(request),
    } as unknown as Pick<App, "callServerTool">;
    try {
      const registration = await client.callTool({
        arguments: {},
        name: SEQUENCE_VIEWER_REGISTER_SESSION_TOOL_NAME,
      });
      const sessionId = (
        registration.structuredContent as { sessionId: string }
      ).sessionId;

      const exportPromise = client.callTool({
        arguments: { format: "fasta", scope: "all", sessionId },
        name: SEQUENCE_VIEWER_EXPORT_TOOL_NAME,
      });
      const exportCommand = await waitForCommand(client, sessionId, 0);
      const exportContent = `>${"A".repeat(3 * 1_024 * 1_024)}`;
      const exportCompletion = await persistSequenceCommandResult(app, {
        command: exportCommand,
        result: {
          applied: true,
          message: "Prepared large.fasta for download.",
          state: {
            artifact: {
              content: exportContent,
              format: "fasta",
              mediaType: "text/x-fasta",
              name: "large.fasta",
            },
            provenance: {
              engine: "sequence-viewer-export-v1",
              parameters: { scope: "all" },
              sourceRevision: 1,
            },
          },
        },
        sessionId,
      });
      expect(JSON.stringify(exportCompletion)).not.toContain(
        exportContent.slice(-10_000),
      );
      await client.callTool({
        arguments: {
          applied: exportCompletion.applied,
          commandId: exportCommand.commandId,
          message: exportCompletion.message,
          sessionId,
          state: exportCompletion.state,
        },
        name: SEQUENCE_VIEWER_COMPLETE_COMMAND_TOOL_NAME,
      });
      const exported = await exportPromise;
      expect(exported.structuredContent).toMatchObject({
        result: {
          resourceUri: expect.stringMatching(/^viewer-artifact:/u),
          sha256: expect.stringMatching(/^[a-f0-9]{64}$/u),
          size: Buffer.byteLength(exportContent),
        },
      });

      const savePromise = client.callTool({
        arguments: { name: "large.session.json", sessionId },
        name: SEQUENCE_VIEWER_SAVE_SESSION_TOOL_NAME,
      });
      const saveCommand = await waitForCommand(
        client,
        sessionId,
        exportCommand.revision,
      );
      const session = validSession(440 * 1_024);
      const saveCompletion = await persistSequenceCommandResult(app, {
        command: saveCommand,
        result: {
          applied: true,
          message: "Serialized the current workbench session.",
          state: { session },
        },
        sessionId,
      });
      expect(JSON.stringify(saveCompletion)).not.toContain(
        session.slice(-10_000),
      );
      await client.callTool({
        arguments: {
          applied: saveCompletion.applied,
          commandId: saveCommand.commandId,
          message: saveCompletion.message,
          sessionId,
          state: saveCompletion.state,
        },
        name: SEQUENCE_VIEWER_COMPLETE_COMMAND_TOOL_NAME,
      });
      await expect(savePromise).resolves.toMatchObject({
        structuredContent: {
          result: {
            name: "large.session.json",
            savedSessionId: expect.any(String),
            sha256: expect.stringMatching(/^[a-f0-9]{64}$/u),
            size: Buffer.byteLength(session),
          },
        },
      });
    } finally {
      await client.close();
      await server.close();
    }
  });

  it("rejects persistence that is not bound to the pending command", async () => {
    const stateDirectory = await temporaryDirectory();
    const client = new Client(
      { name: "sequence-persistence-binding", version: "0.1.0" },
      { capabilities: {} },
    );
    const server = createSequenceViewerServer({ stateDirectory });
    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();
    await Promise.all([
      client.connect(clientTransport),
      server.connect(serverTransport),
    ]);
    try {
      await expect(
        client.callTool({
          arguments: {
            byteLength: 1,
            callerId: randomUUID(),
            commandId: randomUUID(),
            dataBase64: "QQ==",
            format: "fasta",
            kind: "artifact",
            mediaType: "text/x-fasta",
            name: "unauthorized.fasta",
            sessionId: randomUUID(),
            sha256:
              "559aead08264d5795d3909718cdd05abd49572e84fe55590eef31a88a08fdffd",
            uploadId: randomUUID(),
          },
          name: "sequence.persist_workbench_payload",
        }),
      ).resolves.toMatchObject({
        content: [{ text: expect.stringMatching(/viewer session|pending/u) }],
        isError: true,
      });
    } finally {
      await client.close();
      await server.close();
    }
  });
});

async function waitForCommand(
  client: Client,
  sessionId: string,
  afterRevision: number,
) {
  const response = await client.callTool({
    arguments: { afterRevision, sessionId, timeoutMs: 1_000 },
    name: SEQUENCE_VIEWER_WAIT_FOR_COMMAND_TOOL_NAME,
  });
  return queuedSequenceViewerCommandSchema.parse(
    (response.structuredContent as { command: unknown }).command,
  );
}

function validSession(artifactBytes: number): string {
  return JSON.stringify({
    artifacts: [
      {
        content: `>${"C".repeat(artifactBytes - 1)}`,
        createdAt: 1,
        format: "fasta",
        id: randomUUID(),
        mediaType: "text/x-fasta",
        name: "derived.fasta",
        provenance: {
          engine: "test",
          parameters: {},
          sourceRevision: 0,
        },
      },
    ],
    createdAt: 1,
    dirty: false,
    jobs: [],
    revision: 0,
    schemaVersion: 1,
    source: { fileName: "demo.fasta", format: "fasta" },
    tracks: [],
    view: {
      mode: "sequence",
      sequence: {
        geneticCodeId: 1,
        layout: "linear",
        orientation: "forward",
        paletteId: "neutral",
        selectedFeatureId: null,
        selectedRecordId: "record-1",
        selection: null,
        showFeatures: true,
        showQuality: true,
        showTranslation: true,
        synchronizedViews: true,
        viewport: null,
        wrapWidth: 60,
      },
    },
  });
}

async function temporaryDirectory(): Promise<string> {
  const directory = await mkdtemp(
    path.join(os.tmpdir(), "sequence-persistence-integration-"),
  );
  temporaryDirectories.push(directory);
  return directory;
}
