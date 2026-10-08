import { mkdtemp, open, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { ListRootsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { afterEach, describe, expect, it } from "vitest";

import { SequencePluginScientificPlatform } from "./scientific-platform";
import {
  SEQUENCE_DESCRIBE_SCIENTIFIC_SOURCE_TOOL_NAME,
  SEQUENCE_LIST_SCIENTIFIC_RECORDS_TOOL_NAME,
  SEQUENCE_PLUGIN_SCIENTIFIC_SOURCE_META_KEY,
  SEQUENCE_READ_SCIENTIFIC_RANGE_TOOL_NAME,
  SEQUENCE_READ_SCIENTIFIC_WINDOW_TOOL_NAME,
  SEQUENCE_RESTORE_SCIENTIFIC_CHECKPOINT_TOOL_NAME,
  SEQUENCE_SAVE_SCIENTIFIC_CHECKPOINT_TOOL_NAME,
  sequenceScientificSourceSchema,
} from "./scientific-platform-protocol";
import {
  createSequenceViewerServer,
  SEQUENCE_VIEWER_CHAT_TOOL_NAME,
  SEQUENCE_VIEWER_TOOL_NAME,
} from "./server";
import { SEQUENCE_VIEWER_REGISTER_SESSION_TOOL_NAME } from "./viewer-commands";

const temporaryDirectories: Array<string> = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { force: true, recursive: true })),
  );
});

describe("stock-host plugin-owned Sequence scientific platform", () => {
  it("exposes only app-scoped bounded range, record, and window tools", async () => {
    const workspace = await createWorkspace();
    const contents = ">alpha first\nAACCGGTT\n>beta second\nTTGGCCAA\n";
    await writeFile(path.join(workspace, "family.fasta"), contents);
    const { client, close } = await createConnectedClient(workspace);

    try {
      const { tools } = await client.listTools();
      for (const name of [
        SEQUENCE_DESCRIBE_SCIENTIFIC_SOURCE_TOOL_NAME,
        SEQUENCE_LIST_SCIENTIFIC_RECORDS_TOOL_NAME,
        SEQUENCE_READ_SCIENTIFIC_RANGE_TOOL_NAME,
        SEQUENCE_READ_SCIENTIFIC_WINDOW_TOOL_NAME,
        SEQUENCE_RESTORE_SCIENTIFIC_CHECKPOINT_TOOL_NAME,
        SEQUENCE_SAVE_SCIENTIFIC_CHECKPOINT_TOOL_NAME,
      ]) {
        expect(tools.find((tool) => tool.name === name)?._meta).toEqual({
          ui: { visibility: ["app"] },
        });
      }

      const opened = await client.callTool({
        arguments: { path: "family.fasta" },
        name: SEQUENCE_VIEWER_CHAT_TOOL_NAME,
      });
      expect(opened.isError, JSON.stringify(opened)).not.toBe(true);
      expect(opened._meta, JSON.stringify(opened)).toHaveProperty(
        SEQUENCE_PLUGIN_SCIENTIFIC_SOURCE_META_KEY,
      );
      const source = sequenceScientificSourceSchema.parse(
        opened._meta?.[SEQUENCE_PLUGIN_SCIENTIFIC_SOURCE_META_KEY],
      );
      expect(source.format).toBe("fasta");
      expect(JSON.stringify(source)).not.toContain(workspace);
      const sourceArguments = {
        sessionId: source.sessionId,
        sourceId: source.sourceId,
        sourceRevision: source.sourceRevision,
      };

      await expect(
        client.callTool({
          arguments: sourceArguments,
          name: SEQUENCE_DESCRIBE_SCIENTIFIC_SOURCE_TOOL_NAME,
        }),
      ).resolves.toMatchObject({ structuredContent: source });

      const range = await client.callTool({
        arguments: { ...sourceArguments, length: 8, offsetDecimal: "13" },
        name: SEQUENCE_READ_SCIENTIFIC_RANGE_TOOL_NAME,
      });
      expect(range.structuredContent).toMatchObject({
        bytesBase64: Buffer.from("AACCGGTT").toString("base64"),
        offsetDecimal: "13",
        sourceRevision: source.sourceRevision,
      });

      await expect(
        client.callTool({
          arguments: { ...sourceArguments, limit: 2 },
          name: SEQUENCE_LIST_SCIENTIFIC_RECORDS_TOOL_NAME,
        }),
      ).resolves.toMatchObject({
        structuredContent: {
          records: [
            { description: "first", id: "alpha", sequenceLength: 8 },
            { description: "second", id: "beta", sequenceLength: 8 },
          ],
          sourceRevision: source.sourceRevision,
        },
      });

      await expect(
        client.callTool({
          arguments: {
            ...sourceArguments,
            end1Decimal: "6",
            recordNumber: 2,
            start1Decimal: "3",
          },
          name: SEQUENCE_READ_SCIENTIFIC_WINDOW_TOOL_NAME,
        }),
      ).resolves.toMatchObject({
        structuredContent: {
          sequence: "GGCC",
          sourceRevision: source.sourceRevision,
        },
      });
    } finally {
      await close();
    }
  });

  it("persists only a bounded source-bound checkpoint and rejects foreign sessions", async () => {
    const workspace = await createWorkspace();
    await writeFile(
      path.join(workspace, "family.fastq"),
      "@alpha\nACGT\n+\n1234\n",
    );
    const { client, close } = await createConnectedClient(workspace);

    try {
      const opened = await client.callTool({
        arguments: { path: "family.fastq" },
        name: SEQUENCE_VIEWER_CHAT_TOOL_NAME,
      });
      expect(opened.isError, JSON.stringify(opened)).not.toBe(true);
      const source = sequenceScientificSourceSchema.parse(
        opened._meta?.[SEQUENCE_PLUGIN_SCIENTIFIC_SOURCE_META_KEY],
      );
      const sourceArguments = {
        sessionId: source.sessionId,
        sourceId: source.sourceId,
        sourceRevision: source.sourceRevision,
      };

      await expect(
        client.callTool({
          arguments: {
            ...sourceArguments,
            end1Decimal: "3",
            includeQuality: true,
            recordNumber: 1,
            start1Decimal: "2",
          },
          name: SEQUENCE_READ_SCIENTIFIC_WINDOW_TOOL_NAME,
        }),
      ).resolves.toMatchObject({
        structuredContent: { quality: "23", sequence: "CG" },
      });

      await expect(
        client.callTool({
          arguments: sourceArguments,
          name: SEQUENCE_RESTORE_SCIENTIFIC_CHECKPOINT_TOOL_NAME,
        }),
      ).resolves.toMatchObject({
        structuredContent: { hasCheckpoint: false },
      });

      const checkpointBase64 = Buffer.from(
        JSON.stringify({ selectedRecord: 1, version: 1 }),
      ).toString("base64");
      await expect(
        client.callTool({
          arguments: {
            ...sourceArguments,
            checkpointBase64,
            lastAcknowledgedRevision: 4,
          },
          name: SEQUENCE_SAVE_SCIENTIFIC_CHECKPOINT_TOOL_NAME,
        }),
      ).resolves.toMatchObject({
        structuredContent: {
          checkpointVersion: 1,
          lastAcknowledgedRevision: 4,
          logicalSessionId: source.sessionId,
        },
      });
      await expect(
        client.callTool({
          arguments: sourceArguments,
          name: SEQUENCE_RESTORE_SCIENTIFIC_CHECKPOINT_TOOL_NAME,
        }),
      ).resolves.toMatchObject({
        structuredContent: {
          checkpointBase64,
          hasCheckpoint: true,
          lastAcknowledgedRevision: 4,
        },
      });

      const foreign = await client.callTool({
        arguments: {
          ...sourceArguments,
          sourceId: "00000000-0000-4000-8000-000000000001",
        },
        name: SEQUENCE_DESCRIBE_SCIENTIFIC_SOURCE_TOOL_NAME,
      });
      expect(foreign.isError).toBe(true);
    } finally {
      await close();
    }
  });

  it("fails closed on modified or cross-workspace scientific sources", async () => {
    const workspace = await createWorkspace();
    const file = path.join(workspace, "family.fasta");
    await writeFile(file, ">alpha\nAACCGGTT\n");
    const { client, close } = await createConnectedClient(workspace);

    try {
      const opened = await client.callTool({
        arguments: { path: "family.fasta" },
        name: SEQUENCE_VIEWER_CHAT_TOOL_NAME,
      });
      expect(opened.isError, JSON.stringify(opened)).not.toBe(true);
      const source = sequenceScientificSourceSchema.parse(
        opened._meta?.[SEQUENCE_PLUGIN_SCIENTIFIC_SOURCE_META_KEY],
      );
      await writeFile(file, ">alpha\nTTTTTTTT\n");

      const changed = await client.callTool({
        arguments: {
          length: 4,
          offsetDecimal: "7",
          sessionId: source.sessionId,
          sourceId: source.sourceId,
          sourceRevision: source.sourceRevision,
        },
        name: SEQUENCE_READ_SCIENTIFIC_RANGE_TOOL_NAME,
      });
      expect(changed.isError).toBe(true);
      expect(JSON.stringify(changed)).not.toContain(workspace);
    } finally {
      await close();
    }
  });

  it("binds stock workspace file previews when their existing app session registers", async () => {
    const workspace = await createWorkspace();
    const sourcePath = path.join(workspace, "preview.fasta");
    await writeFile(sourcePath, ">preview\nAACCGGTT\n");
    const { client, close } = await createConnectedClient(workspace);
    const hostMetadata = { "openai/resource": { path: sourcePath } };

    try {
      const opened = await client.callTool({
        _meta: hostMetadata,
        arguments: {
          file: {
            name: "preview.fasta",
            resourceUri: "codex-resource://sequence-preview",
          },
        },
        name: SEQUENCE_VIEWER_TOOL_NAME,
      });
      expect(opened.structuredContent).toEqual({
        file: {
          name: "preview.fasta",
          resourceUri: "codex-resource://sequence-preview",
        },
      });

      const registered = await client.callTool({
        _meta: hostMetadata,
        arguments: {},
        name: SEQUENCE_VIEWER_REGISTER_SESSION_TOOL_NAME,
      });
      const source = sequenceScientificSourceSchema.parse(
        registered._meta?.[SEQUENCE_PLUGIN_SCIENTIFIC_SOURCE_META_KEY],
      );
      expect(source.sessionId).toBe(
        (registered.structuredContent as { sessionId: string }).sessionId,
      );
      expect(JSON.stringify(registered)).not.toContain(sourcePath);

      await expect(
        client.callTool({
          arguments: {
            limit: 1,
            sessionId: source.sessionId,
            sourceId: source.sourceId,
            sourceRevision: source.sourceRevision,
          },
          name: SEQUENCE_LIST_SCIENTIFIC_RECORDS_TOOL_NAME,
        }),
      ).resolves.toMatchObject({
        structuredContent: {
          records: [{ id: "preview", sequenceLength: 8 }],
        },
      });
    } finally {
      await close();
    }
  });

  it("opens approved six-GiB workspace sources only through opaque app-scoped bounded ranges", async () => {
    const workspace = await createWorkspace();
    const sourcePath = path.join(workspace, "huge.fasta");
    const largeOffset = 6 * 1_024 * 1_024 * 1_024 + 17;
    const handle = await open(sourcePath, "w");
    try {
      await handle.write(Buffer.from(">huge\n"), 0, 6, 0);
      await handle.write(Buffer.from("ACGT"), 0, 4, largeOffset);
    } finally {
      await handle.close();
    }
    const { client, close } = await createConnectedClient(workspace);

    try {
      const opened = await client.callTool({
        arguments: { path: "huge.fasta" },
        name: SEQUENCE_VIEWER_CHAT_TOOL_NAME,
      });
      expect(opened.isError, JSON.stringify(opened)).not.toBe(true);
      expect(JSON.stringify(opened)).not.toContain(workspace);
      const source = sequenceScientificSourceSchema.parse(
        opened._meta?.[SEQUENCE_PLUGIN_SCIENTIFIC_SOURCE_META_KEY],
      );
      expect(source.sizeBytesDecimal).toBe(String(largeOffset + 4));
      await expect(
        client.callTool({
          arguments: {
            length: 4,
            offsetDecimal: String(largeOffset),
            sessionId: source.sessionId,
            sourceId: source.sourceId,
            sourceRevision: source.sourceRevision,
          },
          name: SEQUENCE_READ_SCIENTIFIC_RANGE_TOOL_NAME,
        }),
      ).resolves.toMatchObject({
        structuredContent: {
          bytesBase64: Buffer.from("ACGT").toString("base64"),
          offsetDecimal: String(largeOffset),
        },
      });

      const hiddenFile = opened._meta?.["openai/viewerFile"] as {
        primaryFile?: { uri?: string };
      };
      if (hiddenFile.primaryFile?.uri == null) {
        throw new Error("Missing signed, opaque range-only file handle.");
      }
      await expect(
        client.readResource({ uri: hiddenFile.primaryFile.uri }),
      ).rejects.toThrow("bounded, app-only range tools");

      const preview = await client.callTool({
        _meta: { "openai/resource": { path: sourcePath } },
        arguments: {
          file: {
            name: "huge.fasta",
            resourceUri: "codex-resource://large-sequence-preview",
          },
        },
        name: SEQUENCE_VIEWER_TOOL_NAME,
      });
      expect(preview.isError, JSON.stringify(preview)).not.toBe(true);
      expect(JSON.stringify(preview)).not.toContain(workspace);
      const previewSource = sequenceScientificSourceSchema.parse(
        preview._meta?.[SEQUENCE_PLUGIN_SCIENTIFIC_SOURCE_META_KEY],
      );
      expect(previewSource.sizeBytesDecimal).toBe(String(largeOffset + 4));
      expect(preview.structuredContent).toMatchObject({
        viewerSessionId: previewSource.sessionId,
      });
    } finally {
      await close();
    }
  });

  it("reads a single indexed chromosome beyond six GiB without scanning its source", async () => {
    const workspace = await createWorkspace();
    const sourcePath = path.join(workspace, "chromosome.fasta");
    const header = Buffer.from(">chrHuge\n");
    const chromosomeLength = 6 * 1_024 * 1_024 * 1_024 + 29;
    const markerStart1 = 6 * 1_024 * 1_024 * 1_024 + 17;
    const marker = Buffer.from("GATTACA");
    const source = await open(sourcePath, "w");
    try {
      await source.write(header, 0, header.byteLength, 0);
      await source.write(
        marker,
        0,
        marker.byteLength,
        header.byteLength + markerStart1 - 1,
      );
      await source.write(
        Buffer.from("N"),
        0,
        1,
        header.byteLength + chromosomeLength - 1,
      );
    } finally {
      await source.close();
    }
    await writeFile(
      `${sourcePath}.fai`,
      `chrHuge\t${chromosomeLength}\t${header.byteLength}\t60\t60\n`,
    );
    const { client, close } = await createConnectedClient(workspace);

    try {
      const opened = await client.callTool({
        arguments: { path: "chromosome.fasta" },
        name: SEQUENCE_VIEWER_CHAT_TOOL_NAME,
      });
      expect(opened.isError, JSON.stringify(opened)).not.toBe(true);
      expect(JSON.stringify(opened)).not.toContain(workspace);
      const descriptor = sequenceScientificSourceSchema.parse(
        opened._meta?.[SEQUENCE_PLUGIN_SCIENTIFIC_SOURCE_META_KEY],
      );
      expect(descriptor.sizeBytesDecimal).toBe(
        String(header.byteLength + chromosomeLength),
      );
      const sourceArguments = {
        sessionId: descriptor.sessionId,
        sourceId: descriptor.sourceId,
        sourceRevision: descriptor.sourceRevision,
      };

      await expect(
        client.callTool({
          arguments: { ...sourceArguments, limit: 1 },
          name: SEQUENCE_LIST_SCIENTIFIC_RECORDS_TOOL_NAME,
        }),
      ).resolves.toMatchObject({
        structuredContent: {
          complete: true,
          nextCursor: null,
          records: [
            {
              description: "",
              id: "chrHuge",
              sequenceLength: chromosomeLength,
            },
          ],
          sourceRevision: descriptor.sourceRevision,
        },
      });

      await expect(
        client.callTool({
          arguments: {
            ...sourceArguments,
            end1Decimal: String(markerStart1 + marker.byteLength - 1),
            recordNumber: 1,
            start1Decimal: String(markerStart1),
          },
          name: SEQUENCE_READ_SCIENTIFIC_WINDOW_TOOL_NAME,
        }),
      ).resolves.toMatchObject({
        structuredContent: {
          end1Decimal: String(markerStart1 + marker.byteLength - 1),
          sequence: marker.toString(),
          sourceRevision: descriptor.sourceRevision,
          start1Decimal: String(markerStart1),
        },
      });
    } finally {
      await close();
    }
  });

  it("fails closed when an approved FASTA index changes after authorization", async () => {
    const workspace = await createWorkspace();
    const sourcePath = path.join(workspace, "indexed.fasta");
    const indexPath = `${sourcePath}.fai`;
    await writeFile(sourcePath, ">alpha\nAACCGGTT\n");
    await writeFile(indexPath, "alpha\t8\t7\t8\t9\n");
    const { client, close } = await createConnectedClient(workspace);

    try {
      const opened = await client.callTool({
        arguments: { path: "indexed.fasta" },
        name: SEQUENCE_VIEWER_CHAT_TOOL_NAME,
      });
      expect(opened.isError, JSON.stringify(opened)).not.toBe(true);
      const descriptor = sequenceScientificSourceSchema.parse(
        opened._meta?.[SEQUENCE_PLUGIN_SCIENTIFIC_SOURCE_META_KEY],
      );
      const sourceArguments = {
        sessionId: descriptor.sessionId,
        sourceId: descriptor.sourceId,
        sourceRevision: descriptor.sourceRevision,
      };
      await writeFile(indexPath, "omega\t8\t7\t8\t9\n");

      for (const request of [
        {
          arguments: { ...sourceArguments, limit: 1 },
          name: SEQUENCE_LIST_SCIENTIFIC_RECORDS_TOOL_NAME,
        },
        {
          arguments: {
            ...sourceArguments,
            end1Decimal: "4",
            recordNumber: 1,
            start1Decimal: "1",
          },
          name: SEQUENCE_READ_SCIENTIFIC_WINDOW_TOOL_NAME,
        },
      ]) {
        const result = await client.callTool(request);
        expect(result.isError, JSON.stringify(result)).toBe(true);
        expect(JSON.stringify(result)).not.toContain(workspace);
      }
    } finally {
      await close();
    }
  });

  it.skipIf(process.platform === "win32")(
    "rejects a symbolic-link FASTA companion outside its approved workspace",
    async () => {
      const workspace = await createWorkspace();
      const unapproved = await createWorkspace();
      const sourcePath = path.join(workspace, "indexed.fasta");
      const externalIndex = path.join(unapproved, "external.fai");
      await writeFile(sourcePath, ">alpha\nAACCGGTT\n");
      await writeFile(externalIndex, "alpha\t8\t7\t8\t9\n");
      await symlink(externalIndex, `${sourcePath}.fai`);
      const { client, close } = await createConnectedClient(workspace);

      try {
        const opened = await client.callTool({
          arguments: { path: "indexed.fasta" },
          name: SEQUENCE_VIEWER_CHAT_TOOL_NAME,
        });
        expect(opened.isError, JSON.stringify(opened)).toBe(true);
        expect(JSON.stringify(opened)).not.toContain(workspace);
        expect(JSON.stringify(opened)).not.toContain(unapproved);
      } finally {
        await close();
      }
    },
  );

  it("restores a validated checkpoint after an independent plugin runtime reissues its opaque source", async () => {
    const workspace = await createWorkspace();
    const sourcePath = path.join(workspace, "recover.fasta");
    await writeFile(sourcePath, ">recover\nAACCGGTT\n");
    const stateDirectory = path.join(workspace, ".viewer-state");
    const sessionId = "3e091100-cbfc-4fb7-8fdf-9c0a016662b0";
    const extra = {
      sendRequest: async () => ({
        roots: [{ uri: pathToFileURL(workspace).href }],
      }),
    };
    const firstRuntime = new SequencePluginScientificPlatform({
      stateDirectory,
    });
    const first = await firstRuntime.bindOpenedSource({
      extra,
      sessionId,
      sourcePath,
    });
    expect(first).not.toBeNull();
    if (first == null) throw new Error("First source was not authorized.");

    const checkpointBase64 = Buffer.from('{"mode":"sequence"}').toString(
      "base64",
    );
    await firstRuntime.saveCheckpoint({
      checkpointBase64,
      lastAcknowledgedRevision: 7,
      sessionId,
      sourceId: first.sourceId,
      sourceRevision: first.sourceRevision,
    });

    const restartedRuntime = new SequencePluginScientificPlatform({
      stateDirectory,
    });
    const restarted = await restartedRuntime.bindOpenedSource({
      extra,
      sessionId,
      sourcePath,
    });
    expect(restarted?.sourceId).not.toBe(first.sourceId);
    expect(restarted?.sourceRevision).toBe(first.sourceRevision);
    if (restarted == null) throw new Error("Source was not reauthorized.");

    await expect(
      restartedRuntime.restoreCheckpoint({
        sessionId,
        sourceId: restarted.sourceId,
        sourceRevision: restarted.sourceRevision,
      }),
    ).resolves.toEqual({
      checkpointBase64,
      hasCheckpoint: true,
      lastAcknowledgedRevision: 7,
      recoveryReference: restarted.sourceId,
      sourceRevision: restarted.sourceRevision,
    });
  });
});

async function createWorkspace(): Promise<string> {
  const workspace = await mkdtemp(
    path.join(os.tmpdir(), "sequence-plugin-scientific-platform-"),
  );
  temporaryDirectories.push(workspace);
  return workspace;
}

async function createConnectedClient(workspace: string): Promise<{
  client: Client;
  close: () => Promise<void>;
}> {
  const client = new Client(
    { name: "stock-sequence-host", version: "1.0.0" },
    { capabilities: { roots: {} } },
  );
  client.setRequestHandler(ListRootsRequestSchema, async () => ({
    roots: [{ uri: pathToFileURL(workspace).href }],
  }));
  const server = createSequenceViewerServer({
    stateDirectory: path.join(workspace, ".viewer-state"),
  });
  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair();
  await Promise.all([
    client.connect(clientTransport),
    server.connect(serverTransport),
  ]);
  return {
    client,
    close: async () => {
      await client.close();
      await server.close();
    },
  };
}
