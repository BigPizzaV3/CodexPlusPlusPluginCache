import { createHash, randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import type { App } from "@modelcontextprotocol/ext-apps";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SEQUENCE_VIEWER_LIMITS } from "../runtime-contract";
import { createServerWorkbenchStore } from "../server-workbench-store";
import { SequenceWorkbenchUploadStore } from "../server-workbench-upload";
import {
  SEQUENCE_ABORT_WORKBENCH_PAYLOAD_UPLOAD_TOOL_NAME,
  SEQUENCE_APPEND_WORKBENCH_PAYLOAD_CHUNK_TOOL_NAME,
  SEQUENCE_BEGIN_WORKBENCH_PAYLOAD_UPLOAD_TOOL_NAME,
  SEQUENCE_FINISH_WORKBENCH_PAYLOAD_UPLOAD_TOOL_NAME,
  SEQUENCE_PERSIST_WORKBENCH_PAYLOAD_TOOL_NAME,
  SEQUENCE_PREPARE_WORKSPACE_EXPORT_TOOL_NAME,
} from "../workbench-persistence-protocol";
import {
  SEQUENCE_CREATE_WORKSPACE_DIRECTORY_TOOL_NAME,
  SEQUENCE_LIST_WORKSPACE_DIRECTORY_TOOL_NAME,
} from "../workspace-browser-protocol";
import {
  encodedSequenceToolRequestBytes,
  createSequenceWorkspaceArtifactPublisher,
  persistSequenceCommandResult,
  persistSequenceWorkbenchPayload,
  publishPreparedSequenceWorkspaceArtifact,
} from "./workbench-persistence";

const temporaryDirectories: Array<string> = [];
const stores: Array<SequenceWorkbenchUploadStore> = [];

afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.allSettled(stores.splice(0).map((store) => store.dispose()));
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { force: true, recursive: true })),
  );
});

describe("proxy-safe workbench persistence client", () => {
  it("preserves actionable MCP error-result messages during upload reconciliation", async () => {
    const callServerTool = vi.fn(
      async (request: Parameters<App["callServerTool"]>[0]) => {
        const uploadId = (request.arguments as { uploadId: string }).uploadId;
        if (request.name === SEQUENCE_BEGIN_WORKBENCH_PAYLOAD_UPLOAD_TOOL_NAME) {
          return {
            content: [
              {
                text: "The workspace export or provenance sidecar already exists.",
                type: "text",
              },
            ],
            isError: true,
          } as Awaited<ReturnType<App["callServerTool"]>>;
        }
        expect(request.name).toBe(
          SEQUENCE_ABORT_WORKBENCH_PAYLOAD_UPLOAD_TOOL_NAME,
        );
        return {
          content: [],
          structuredContent: { aborted: true, uploadId },
        } as Awaited<ReturnType<App["callServerTool"]>>;
      },
    );

    await expect(
      persistSequenceWorkbenchPayload(
        { callServerTool } as unknown as Pick<App, "callServerTool">,
        {
          commandId: randomUUID(),
          content: "(P01116,P01111,P01112);\n",
          destination: {
            base: "opened-source",
            collisionPolicy: "exact",
            kind: "workspace",
            relativePath: "RAS.nwk",
          },
          format: "newick",
          kind: "artifact",
          mediaType: "text/x-newick",
          name: "RAS.nwk",
          provenance: {
            engine: "sequence-viewer-guide-tree-v1",
            parameters: {},
            sourceRevision: 0,
          },
          sessionId: randomUUID(),
        },
      ),
    ).rejects.toThrow(
      "The workspace export or provenance sidecar already exists.",
    );
    expect(callServerTool.mock.calls.map(([request]) => request.name)).toEqual([
      SEQUENCE_BEGIN_WORKBENCH_PAYLOAD_UPLOAD_TOOL_NAME,
      SEQUENCE_ABORT_WORKBENCH_PAYLOAD_UPLOAD_TOOL_NAME,
    ]);
  });

  it("preflights UI workspace exports and uses the bounded streaming transport", async () => {
    const commandId = randomUUID();
    const content = ">ui\nACGT\n";
    const digest = createHash("sha256").update(content).digest("hex");
    const callServerTool = vi.fn(
      async (request: Parameters<App["callServerTool"]>[0]) => {
        if (request.name === SEQUENCE_PREPARE_WORKSPACE_EXPORT_TOOL_NAME) {
          return {
            content: [],
            structuredContent: {
              commandId,
              destination: { base: "opened-source", kind: "workspace" },
            },
          } as Awaited<ReturnType<App["callServerTool"]>>;
        }
        if (request.name === SEQUENCE_BEGIN_WORKBENCH_PAYLOAD_UPLOAD_TOOL_NAME) {
          return {
            content: [],
            structuredContent: {
              maxChunkBytes: SEQUENCE_VIEWER_LIMITS.persistence.maxChunkBytes,
              maxWorkspaceArtifactBytes:
                SEQUENCE_VIEWER_LIMITS.workspace.maxArtifactBytes,
              receivedBytes: 0,
              uploadId: (request.arguments as { uploadId: string }).uploadId,
            },
          } as Awaited<ReturnType<App["callServerTool"]>>;
        }
        if (request.name === SEQUENCE_APPEND_WORKBENCH_PAYLOAD_CHUNK_TOOL_NAME) {
          return {
            content: [],
            structuredContent: {
              maxChunkBytes: SEQUENCE_VIEWER_LIMITS.persistence.maxChunkBytes,
              maxWorkspaceArtifactBytes:
                SEQUENCE_VIEWER_LIMITS.workspace.maxArtifactBytes,
              receivedBytes: Buffer.byteLength(content),
              uploadId: (request.arguments as { uploadId: string }).uploadId,
            },
          } as Awaited<ReturnType<App["callServerTool"]>>;
        }
        expect(request.name).toBe(
          SEQUENCE_FINISH_WORKBENCH_PAYLOAD_UPLOAD_TOOL_NAME,
        );
        return {
          content: [],
          structuredContent: {
            destination: { base: "opened-source", kind: "workspace" },
            format: "fasta",
            kind: "artifact",
            mediaType: "text/x-fasta",
            name: "ui-derived.fasta",
            outputWorkspacePath: "data/exports/ui-derived.fasta",
            provenanceWorkspacePath:
              "data/exports/ui-derived.fasta.provenance.json",
            sha256: digest,
            size: Buffer.byteLength(content),
            version: 1,
          },
        } as Awaited<ReturnType<App["callServerTool"]>>;
      },
    );
    const app = { callServerTool } as unknown as Pick<App, "callServerTool">;
    const result = await publishPreparedSequenceWorkspaceArtifact(app, {
      artifact: {
        content,
        format: "fasta",
        mediaType: "text/x-fasta",
        name: "suggested.fasta",
        provenance: {
          engine: "sequence-viewer-browser-export-v1",
          parameters: { kind: "record-fasta" },
          sourceRevision: 0,
        },
      },
      relativePath: "exports/ui-derived.fasta",
      sessionId: randomUUID(),
    });

    expect(result).toMatchObject({
      kind: "artifact",
      name: "ui-derived.fasta",
      outputWorkspacePath: "data/exports/ui-derived.fasta",
    });
    expect(callServerTool).toHaveBeenCalledTimes(4);
    const [preflight, begin, append, finish] = callServerTool.mock.calls.map(([request]) =>
      request,
    );
    expect(preflight).toMatchObject({
      arguments: {
        destination: {
          base: "opened-source",
          collisionPolicy: "exact",
          kind: "workspace",
          relativePath: "exports/ui-derived.fasta",
        },
        name: "ui-derived.fasta",
        sha256: digest,
      },
      name: SEQUENCE_PREPARE_WORKSPACE_EXPORT_TOOL_NAME,
    });
    expect(begin).toMatchObject({
      arguments: { commandId, name: "ui-derived.fasta" },
      name: SEQUENCE_BEGIN_WORKBENCH_PAYLOAD_UPLOAD_TOOL_NAME,
    });
    expect(append?.name).toBe(
      SEQUENCE_APPEND_WORKBENCH_PAYLOAD_CHUNK_TOOL_NAME,
    );
    expect(finish?.name).toBe(
      SEQUENCE_FINISH_WORKBENCH_PAYLOAD_UPLOAD_TOOL_NAME,
    );
    expect(
      Math.max(
        ...[preflight, begin, append, finish].map((request) =>
          encodedSequenceToolRequestBytes(request!),
        ),
      ),
    ).toBeLessThanOrEqual(SEQUENCE_VIEWER_LIMITS.persistence.proxyEnvelopeBytes);
  });

  it("binds browser and folder calls to the live viewer session", async () => {
    const sessionId = randomUUID();
    const callServerTool = vi.fn(
      async (request: Parameters<App["callServerTool"]>[0]) => {
        if (request.name === SEQUENCE_LIST_WORKSPACE_DIRECTORY_TOOL_NAME) {
          return {
            content: [],
            structuredContent: {
              directory: {
                breadcrumbs: [
                  { label: "Workspace", relativePath: ".", workspacePath: "." },
                ],
                relativePath: ".",
                sourceDirectoryWorkspacePath: ".",
                workspacePath: ".",
              },
              entries: [],
              omittedEntries: 0,
            },
          } as Awaited<ReturnType<App["callServerTool"]>>;
        }
        expect(request.name).toBe(SEQUENCE_CREATE_WORKSPACE_DIRECTORY_TOOL_NAME);
        return {
          content: [],
          structuredContent: {
            name: "analysis",
            relativePath: "analysis",
            workspacePath: "analysis",
          },
        } as Awaited<ReturnType<App["callServerTool"]>>;
      },
    );
    const publisher = createSequenceWorkspaceArtifactPublisher(
      { callServerTool } as unknown as Pick<App, "callServerTool">,
      sessionId,
    );

    await publisher.listDirectory({ directory: ".", limit: 50 });
    await publisher.createDirectory({
      name: "analysis",
      parentDirectory: ".",
    });

    expect(callServerTool).toHaveBeenNthCalledWith(1, {
      arguments: { directory: ".", limit: 50, sessionId },
      name: SEQUENCE_LIST_WORKSPACE_DIRECTORY_TOOL_NAME,
    });
    expect(callServerTool).toHaveBeenNthCalledWith(2, {
      arguments: { name: "analysis", parentDirectory: ".", sessionId },
      name: SEQUENCE_CREATE_WORKSPACE_DIRECTORY_TOOL_NAME,
    });
  });

  it("accepts only deterministic server-selected names for explicit next-version saves", async () => {
    const content = ">versioned\nAC\n";
    const digest = createHash("sha256").update(content).digest("hex");
    const commandId = randomUUID();
    const callServerTool = vi.fn(
      async (request: Parameters<App["callServerTool"]>[0]) => {
        if (request.name === SEQUENCE_ABORT_WORKBENCH_PAYLOAD_UPLOAD_TOOL_NAME) {
          return {
            content: [],
            structuredContent: {
              aborted: true,
              uploadId: (request.arguments as { uploadId: string }).uploadId,
            },
          } as Awaited<ReturnType<App["callServerTool"]>>;
        }
        if (request.name === SEQUENCE_PREPARE_WORKSPACE_EXPORT_TOOL_NAME) {
          return {
            content: [],
            structuredContent: {
                commandId,
                destination: { base: "opened-source", kind: "workspace" },
            },
          } as Awaited<ReturnType<App["callServerTool"]>>;
        }
        if (request.name === SEQUENCE_BEGIN_WORKBENCH_PAYLOAD_UPLOAD_TOOL_NAME) {
          return {
            content: [],
            structuredContent: {
              maxChunkBytes: SEQUENCE_VIEWER_LIMITS.persistence.maxChunkBytes,
              maxWorkspaceArtifactBytes:
                SEQUENCE_VIEWER_LIMITS.workspace.maxArtifactBytes,
              receivedBytes: 0,
              uploadId: (request.arguments as { uploadId: string }).uploadId,
            },
          } as Awaited<ReturnType<App["callServerTool"]>>;
        }
        if (request.name === SEQUENCE_APPEND_WORKBENCH_PAYLOAD_CHUNK_TOOL_NAME) {
          return {
            content: [],
            structuredContent: {
              maxChunkBytes: SEQUENCE_VIEWER_LIMITS.persistence.maxChunkBytes,
              maxWorkspaceArtifactBytes:
                SEQUENCE_VIEWER_LIMITS.workspace.maxArtifactBytes,
              receivedBytes: Buffer.byteLength(content),
              uploadId: (request.arguments as { uploadId: string }).uploadId,
            },
          } as Awaited<ReturnType<App["callServerTool"]>>;
        }
        return {
          content: [],
          structuredContent: {
                destination: { base: "opened-source", kind: "workspace" },
                format: "fasta",
                kind: "artifact",
                mediaType: "text/x-fasta",
                name: "derived-2.fasta",
                outputWorkspacePath: "data/derived-2.fasta",
                provenanceWorkspacePath:
                  "data/derived-2.fasta.provenance.json",
                sha256: digest,
                size: Buffer.byteLength(content),
                version: 1,
          },
        } as Awaited<ReturnType<App["callServerTool"]>>;
      },
    );
    const input = {
      artifact: {
        content,
        format: "fasta" as const,
        mediaType: "text/x-fasta",
        name: "derived.fasta",
        provenance: {
          engine: "sequence-viewer-browser-export-v1",
          parameters: {},
          sourceRevision: 0,
        },
      },
      relativePath: "derived.fasta",
      sessionId: randomUUID(),
    };

    await expect(
      publishPreparedSequenceWorkspaceArtifact(
        { callServerTool } as unknown as Pick<App, "callServerTool">,
        { ...input, collisionPolicy: "next-version" },
      ),
    ).resolves.toMatchObject({ name: "derived-2.fasta" });
    await expect(
      publishPreparedSequenceWorkspaceArtifact(
        { callServerTool } as unknown as Pick<App, "callServerTool">,
        input,
      ),
    ).rejects.toThrow("workspace artifact binding is inconsistent");
  });

  it("does not replay a folder creation after a lost mutating response", async () => {
    const callServerTool = vi.fn(async () => {
      throw new Error("proxy timeout after create");
    });
    const publisher = createSequenceWorkspaceArtifactPublisher(
      { callServerTool } as unknown as Pick<App, "callServerTool">,
      randomUUID(),
    );

    await expect(
      publisher.createDirectory({ name: "analysis", parentDirectory: "." }),
    ).rejects.toThrow("proxy timeout after create");
    expect(callServerTool).toHaveBeenCalledOnce();
  });

  it("rejects unsafe UI destinations before any server call", async () => {
    const callServerTool = vi.fn();
    await expect(
      publishPreparedSequenceWorkspaceArtifact(
        { callServerTool } as unknown as Pick<App, "callServerTool">,
        {
          artifact: {
            content: ">ui\nACGT\n",
            format: "fasta",
            mediaType: "text/x-fasta",
            name: "ui.fasta",
            provenance: {
              engine: "sequence-viewer-browser-export-v1",
              parameters: {},
              sourceRevision: 0,
            },
          },
          relativePath: "/tmp/ui.fasta",
          sessionId: randomUUID(),
        },
      ),
    ).rejects.toThrow();
    expect(callServerTool).not.toHaveBeenCalled();
  });
  it("uses the idempotent one-shot path only below the centralized threshold", async () => {
    const { app, requests } = await createAdapter();
    const content = `>${"A".repeat(
      SEQUENCE_VIEWER_LIMITS.persistence.maxOneShotBytes - 2,
    )}`;
    const result = await persistSequenceWorkbenchPayload(app, {
      commandId: randomUUID(),
      content,
      format: "fasta",
      kind: "artifact",
      mediaType: "text/x-fasta",
      name: "threshold.fasta",
      sessionId: randomUUID(),
    });

    expect(result).toMatchObject({ kind: "artifact", name: "threshold.fasta" });
    expect(requests.map(({ name }) => name)).toEqual([
      SEQUENCE_PERSIST_WORKBENCH_PAYLOAD_TOOL_NAME,
    ]);
    expect(
      Math.max(...requests.map(encodedSequenceToolRequestBytes)),
    ).toBeLessThanOrEqual(
      SEQUENCE_VIEWER_LIMITS.persistence.proxyEnvelopeBytes,
    );
  });

  it("resumes a multi-megabyte artifact after lost append and finish responses", async () => {
    let loseAppendResponse = true;
    let loseFinishResponse = true;
    const { app, requests, workbench } = await createAdapter({
      afterCall: ({ name }, result) => {
        if (
          name === SEQUENCE_APPEND_WORKBENCH_PAYLOAD_CHUNK_TOOL_NAME &&
          loseAppendResponse
        ) {
          loseAppendResponse = false;
          throw new Error("proxy timeout after append");
        }
        if (
          name === SEQUENCE_FINISH_WORKBENCH_PAYLOAD_UPLOAD_TOOL_NAME &&
          loseFinishResponse
        ) {
          loseFinishResponse = false;
          throw new Error("proxy timeout after finish");
        }
        return result;
      },
    });
    const content = `>${"A".repeat(2 * 1_024 * 1_024)}`;
    const result = await persistSequenceWorkbenchPayload(app, {
      commandId: randomUUID(),
      content,
      format: "fasta",
      kind: "artifact",
      mediaType: "text/x-fasta",
      name: "large.fasta",
      sessionId: randomUUID(),
    });

    expect(result).toMatchObject({
      kind: "artifact",
      size: Buffer.byteLength(content),
    });
    expect(
      requests.filter(
        ({ name }) =>
          name === SEQUENCE_APPEND_WORKBENCH_PAYLOAD_CHUNK_TOOL_NAME,
      ).length,
    ).toBeGreaterThan(
      Math.ceil(
        Buffer.byteLength(content) /
          SEQUENCE_VIEWER_LIMITS.persistence.maxChunkBytes,
      ),
    );
    expect(
      requests.filter(
        ({ name }) =>
          name === SEQUENCE_FINISH_WORKBENCH_PAYLOAD_UPLOAD_TOOL_NAME,
      ),
    ).toHaveLength(2);
    expect(
      Math.max(...requests.map(encodedSequenceToolRequestBytes)),
    ).toBeLessThanOrEqual(
      SEQUENCE_VIEWER_LIMITS.persistence.proxyEnvelopeBytes,
    );
    if (result.kind !== "artifact" || !("id" in result)) {
      throw new Error("Expected private artifact result.");
    }
    await expect(workbench.readArtifact(result.id)).resolves.toMatchObject({
      content,
    });
  });

  it("streams beyond 64 MiB, retries the identical lost chunk, and stays inside the host envelope", async () => {
    const commandId = randomUUID();
    const totalBytes = 64 * 1_024 * 1_024 + 1;
    const header = ">large\n";
    const slab = "A".repeat(64 * 1_024);
    let producerStarts = 0;
    const createChunks = async function* () {
      producerStarts += 1;
      yield header;
      let remaining = totalBytes - Buffer.byteLength(header);
      while (remaining > 0) {
        const length = Math.min(remaining, slab.length);
        yield slab.slice(0, length);
        remaining -= length;
      }
    };
    const digest = createHash("sha256");
    const requests: Array<Parameters<App["callServerTool"]>[0]> = [];
    let receivedBytes = 0;
    let lostResponse = false;
    let lostRequest: { dataBase64: string; offset: number } | undefined;
    const callServerTool = vi.fn(
      async (request: Parameters<App["callServerTool"]>[0]) => {
        requests.push(request);
        const args = request.arguments as Record<string, unknown>;
        if (request.name === SEQUENCE_PREPARE_WORKSPACE_EXPORT_TOOL_NAME) {
          return {
            content: [],
            structuredContent: {
              commandId,
              destination: { base: "opened-source", kind: "workspace" },
              maxWorkspaceArtifactBytes:
                SEQUENCE_VIEWER_LIMITS.workspace.maxArtifactBytes,
            },
          } as Awaited<ReturnType<App["callServerTool"]>>;
        }
        if (request.name === SEQUENCE_BEGIN_WORKBENCH_PAYLOAD_UPLOAD_TOOL_NAME) {
          return {
            content: [],
            structuredContent: {
              maxChunkBytes: SEQUENCE_VIEWER_LIMITS.persistence.maxChunkBytes,
              maxWorkspaceArtifactBytes:
                SEQUENCE_VIEWER_LIMITS.workspace.maxArtifactBytes,
              receivedBytes,
              uploadId: args.uploadId,
            },
          } as Awaited<ReturnType<App["callServerTool"]>>;
        }
        if (request.name === SEQUENCE_APPEND_WORKBENCH_PAYLOAD_CHUNK_TOOL_NAME) {
          const offset = args.offset as number;
          const dataBase64 = args.dataBase64 as string;
          const chunk = Buffer.from(dataBase64, "base64");
          if (offset < receivedBytes) {
            expect({ dataBase64, offset }).toEqual(lostRequest);
          } else {
            expect(offset).toBe(receivedBytes);
            digest.update(chunk);
            receivedBytes += chunk.byteLength;
            if (!lostResponse && receivedBytes >= 64 * 1_024 * 1_024) {
              lostResponse = true;
              lostRequest = { dataBase64, offset };
              throw new Error("proxy timeout after accepted append");
            }
          }
          return {
            content: [],
            structuredContent: {
              maxChunkBytes: SEQUENCE_VIEWER_LIMITS.persistence.maxChunkBytes,
              maxWorkspaceArtifactBytes:
                SEQUENCE_VIEWER_LIMITS.workspace.maxArtifactBytes,
              receivedBytes,
              uploadId: args.uploadId,
            },
          } as Awaited<ReturnType<App["callServerTool"]>>;
        }
        if (request.name === SEQUENCE_FINISH_WORKBENCH_PAYLOAD_UPLOAD_TOOL_NAME) {
          const sha256 = digest.digest("hex");
          return {
            content: [],
            structuredContent: {
              destination: { base: "opened-source", kind: "workspace" },
              format: "fasta",
              kind: "artifact",
              mediaType: "text/x-fasta",
              name: "large.fasta",
              outputWorkspacePath: "data/large.fasta",
              provenanceWorkspacePath: "data/large.fasta.provenance.json",
              sha256,
              size: totalBytes,
              version: 1,
            },
          } as Awaited<ReturnType<App["callServerTool"]>>;
        }
        throw new Error(`Unexpected tool ${request.name}`);
      },
    );

    const result = await publishPreparedSequenceWorkspaceArtifact(
      { callServerTool } as unknown as Pick<App, "callServerTool">,
      {
        artifact: {
          createChunks,
          format: "fasta",
          mediaType: "text/x-fasta",
          name: "large.fasta",
          provenance: {
            engine: "sequence-viewer-browser-export-v1",
            parameters: { scope: "all" },
            sourceRevision: 0,
          },
        },
        relativePath: "large.fasta",
        sessionId: randomUUID(),
      },
    );

    expect(result).toMatchObject({ kind: "artifact", size: totalBytes });
    expect(lostResponse).toBe(true);
    expect(producerStarts).toBe(2);
    expect(Math.max(...requests.map(encodedSequenceToolRequestBytes))).toBeLessThanOrEqual(
      SEQUENCE_VIEWER_LIMITS.persistence.proxyEnvelopeBytes,
    );
  }, 30_000);

  it("chunks a near-maximum valid session and never includes it in completion", async () => {
    const { app, requests } = await createAdapter();
    const session = validSession(430 * 1_024);
    const commandId = randomUUID();
    const result = await persistSequenceCommandResult(app, {
      command: {
        action: "save_session",
        commandId,
        name: "large.sequence-session.json",
        revision: 1,
      },
      result: {
        applied: true,
        message: "Serialized session.",
        state: { session },
      },
      sessionId: randomUUID(),
    });

    expect(result.state?.session).toMatchObject({
      name: "large.sequence-session.json",
      savedSessionId: expect.any(String),
      size: Buffer.byteLength(session),
    });
    expect(result.state?.session).not.toEqual(session);
    expect(JSON.stringify(result)).not.toContain(session.slice(-1_000));
    expect(requests[0]?.name).toBe(
      SEQUENCE_BEGIN_WORKBENCH_PAYLOAD_UPLOAD_TOOL_NAME,
    );
    expect(
      Math.max(...requests.map(encodedSequenceToolRequestBytes)),
    ).toBeLessThanOrEqual(
      SEQUENCE_VIEWER_LIMITS.persistence.proxyEnvelopeBytes,
    );
  });

  it("replaces export bodies with compact artifact metadata", async () => {
    const { app } = await createAdapter();
    const content = `>${"C".repeat(400 * 1_024)}`;
    const result = await persistSequenceCommandResult(app, {
      command: {
        action: "export_artifact",
        commandId: randomUUID(),
        destination: { kind: "private" },
        format: "fasta",
        revision: 1,
        scope: "all",
      },
      result: {
        applied: true,
        message: "Prepared export.",
        state: {
          artifact: {
            content,
            format: "fasta",
            mediaType: "text/x-fasta",
            name: "export.fasta",
          },
          provenance: {
            engine: "sequence-viewer-export-v1",
            parameters: { scope: "all" },
            sourceRevision: 2,
          },
        },
      },
      sessionId: randomUUID(),
    });

    expect(result.state?.artifact).toMatchObject({
      resourceUri: expect.stringMatching(/^viewer-artifact:/u),
      sha256: expect.stringMatching(/^[a-f0-9]{64}$/u),
      size: Buffer.byteLength(content),
    });
    expect(result.state?.artifact).not.toHaveProperty("content");
  });

  it("aborts and cleans staging when the caller cancels before commit", async () => {
    const controller = new AbortController();
    const { app, store } = await createAdapter({
      beforeCall: ({ name }) => {
        if (name === SEQUENCE_APPEND_WORKBENCH_PAYLOAD_CHUNK_TOOL_NAME) {
          controller.abort(new DOMException("cancelled", "AbortError"));
        }
      },
    });
    const content = `>${"G".repeat(400 * 1_024)}`;
    await expect(
      persistSequenceWorkbenchPayload(app, {
        commandId: randomUUID(),
        content,
        format: "fasta",
        kind: "artifact",
        mediaType: "text/x-fasta",
        name: "cancelled.fasta",
        sessionId: randomUUID(),
        signal: controller.signal,
      }),
    ).rejects.toMatchObject({ name: "AbortError" });
    expect(store.activeUploads).toBe(0);
  });
});

type AdapterOptions = {
  afterCall?: (
    request: Parameters<App["callServerTool"]>[0],
    result: Awaited<ReturnType<App["callServerTool"]>>,
  ) => Awaited<ReturnType<App["callServerTool"]>>;
  beforeCall?: (request: Parameters<App["callServerTool"]>[0]) => void;
};

async function createAdapter(options: AdapterOptions = {}) {
  const stateDirectory = await temporaryDirectory();
  const stagingDirectory = await temporaryDirectory();
  const workbench = createServerWorkbenchStore({ stateDirectory });
  const store = new SequenceWorkbenchUploadStore(workbench, {
    createStagingDirectory: async () => stagingDirectory,
  });
  stores.push(store);
  const requests: Array<Parameters<App["callServerTool"]>[0]> = [];
  const callServerTool = vi.fn(
    async (request: Parameters<App["callServerTool"]>[0]) => {
      requests.push(request);
      options.beforeCall?.(request);
      const input = request.arguments ?? {};
      const structuredContent =
        request.name === SEQUENCE_PERSIST_WORKBENCH_PAYLOAD_TOOL_NAME
          ? await store.persistOneShot(input)
          : request.name === SEQUENCE_BEGIN_WORKBENCH_PAYLOAD_UPLOAD_TOOL_NAME
          ? await store.begin(input)
          : request.name === SEQUENCE_APPEND_WORKBENCH_PAYLOAD_CHUNK_TOOL_NAME
          ? await store.append(input)
          : request.name === SEQUENCE_FINISH_WORKBENCH_PAYLOAD_UPLOAD_TOOL_NAME
          ? await store.finish(input)
          : request.name === SEQUENCE_ABORT_WORKBENCH_PAYLOAD_UPLOAD_TOOL_NAME
          ? await store.abort(input)
          : (() => {
              throw new Error(`Unexpected tool ${request.name}`);
            })();
      const response = { content: [], structuredContent } as Awaited<
        ReturnType<App["callServerTool"]>
      >;
      return options.afterCall?.(request, response) ?? response;
    },
  );
  return {
    app: { callServerTool } as unknown as Pick<App, "callServerTool">,
    requests,
    store,
    workbench,
  };
}

function validSession(artifactBytes: number): string {
  return JSON.stringify({
    artifacts: [
      {
        content: `>${"A".repeat(artifactBytes - 1)}`,
        createdAt: 1,
        format: "fasta",
        id: randomUUID(),
        mediaType: "text/x-fasta",
        name: "large.fasta",
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
    path.join(os.tmpdir(), "sequence-persistence-client-test-"),
  );
  temporaryDirectories.push(directory);
  return directory;
}
