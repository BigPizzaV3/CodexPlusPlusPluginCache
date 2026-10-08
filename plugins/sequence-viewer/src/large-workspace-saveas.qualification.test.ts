import { createHash, randomUUID } from "node:crypto";
import { once } from "node:events";
import {
  createReadStream,
  createWriteStream,
} from "node:fs";
import { mkdir, mkdtemp, readdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { createGzip } from "node:zlib";

import { describe, expect, it } from "vitest";

import { SEQUENCE_VIEWER_LIMITS } from "./runtime-contract";
import { createServerWorkbenchStore } from "./server-workbench-store";
import { SequenceWorkbenchUploadStore } from "./server-workbench-upload";
import {
  measureSequenceWorkspaceProducer,
  SEQUENCE_WORKSPACE_WIDGET_PEAK_LIMIT,
  sequenceWorkspaceUploadChunks,
} from "./views/workspace-artifact-stream";
import { SequenceWorkspaceExportPublisher } from "./workspace-export-publisher";

const enabled = process.env.SEQUENCE_VIEWER_LARGE_WORKSPACE_QUALIFICATION === "1";

describe("large workspace Save As qualification", () => {
  it.runIf(enabled)(
    "streams 512 MiB + 1 through the browser producer with exact length and digest",
    async () => {
      const totalBytes = 512 * 1_024 * 1_024 + 1;
      const slab = "A".repeat(64 * 1_024);
      const producer = async function* () {
        yield ">large\n";
        let remaining = totalBytes - 7;
        while (remaining > 0) {
          const length = Math.min(remaining, slab.length);
          yield slab.slice(0, length);
          remaining -= length;
        }
      };
      const measured = await measureSequenceWorkspaceProducer(producer);
      const digest = createHash("sha256");
      let streamed = 0;
      let peakChunk = 0;
      for await (const { bytes } of sequenceWorkspaceUploadChunks(producer, {
        maxChunkBytes: SEQUENCE_VIEWER_LIMITS.persistence.maxChunkBytes,
        startOffset: 0,
        totalBytes,
      })) {
        digest.update(bytes);
        streamed += bytes.byteLength;
        peakChunk = Math.max(peakChunk, bytes.byteLength);
      }
      expect(streamed).toBe(totalBytes);
      expect(digest.digest("hex")).toBe(measured.sha256);
      expect(peakChunk).toBeLessThanOrEqual(
        SEQUENCE_VIEWER_LIMITS.persistence.maxChunkBytes,
      );
      expect(measured.peakRetainedBytes).toBeLessThanOrEqual(64 * 1_024);
      expect(peakChunk * 6 + measured.peakRetainedBytes).toBeLessThanOrEqual(
        SEQUENCE_WORKSPACE_WIDGET_PEAK_LIMIT,
      );
    },
    180_000,
  );

  it.runIf(enabled)(
    "generates and atomically publishes an Alignment output above 1 GiB",
    async () => {
      const root = await mkdtemp(path.join(os.tmpdir(), "sequence-large-saveas-"));
      const data = path.join(root, "data");
      const state = path.join(root, "state");
      await Promise.all([mkdir(data), mkdir(state)]);
      const sourcePath = path.join(data, "source.afa.gz");
      const source = createWriteStream(sourcePath, { mode: 0o600 });
      const gzip = createGzip({ level: 1 });
      gzip.pipe(source);
      const slab = Buffer.alloc(1_024 * 1_024, 0x41);
      const write = async (value: Uint8Array | string) => {
        if (!gzip.write(value)) await once(gzip, "drain");
      };
      await write(">row-a\n");
      for (let index = 0; index < 512; index += 1) await write(slab);
      await write("\n>row-b\n");
      for (let index = 0; index < 512; index += 1) await write(slab);
      await write("\n");
      gzip.end();
      await once(source, "close");

      const sessionId = randomUUID();
      const publisher = new SequenceWorkspaceExportPublisher();
      await publisher.bindSession(sessionId, sourcePath, {
        async sendRequest() {
          return { roots: [{ uri: pathToFileURL(root).href }] };
        },
      } as never);
      let cancelAfter64MiB = false;
      let capacityChecks = 0;
      let cancellation: AbortController | undefined;
      const store = new SequenceWorkbenchUploadStore(
        createServerWorkbenchStore({ stateDirectory: state }),
        {
          getAvailableWorkspaceBytes: async () => {
            capacityChecks += 1;
            if (
              cancelAfter64MiB &&
              capacityChecks * 256 * 1_024 > 64 * 1_024 * 1_024
            ) {
              cancellation?.abort(
                new DOMException("qualification cancellation", "AbortError"),
              );
            }
            return Number.MAX_SAFE_INTEGER;
          },
          workspacePublisher: publisher,
        },
      );
      try {
        cancellation = new AbortController();
        cancelAfter64MiB = true;
        await expect(
          store.generateWorkspaceExport(
            {
              callerId: randomUUID(),
              commandId: randomUUID(),
              destination: {
                base: "opened-source",
                kind: "workspace",
                relativePath: "cancelled.afa",
              },
              format: "aligned-fasta",
              mediaType: "text/x-fasta",
              name: "cancelled.afa",
              operationId: randomUUID(),
              provenance: {
                engine: "sequence-viewer-large-qualification-v1",
                parameters: { milestone: "cancel-after-64-mib" },
                sourceRevision: 0,
              },
              sessionId,
              source: { compression: "gzip", kind: "opened-source" },
            },
            undefined,
            cancellation.signal,
          ),
        ).rejects.toMatchObject({ name: "AbortError" });
        expect(store.workspaceStagingUsage).toBe(0);
        expect(await readdir(data)).not.toEqual(
          expect.arrayContaining([
            "cancelled.afa",
            "cancelled.afa.provenance.json",
          ]),
        );
        expect((await readdir(data)).some((name) => name.endsWith(".tmp"))).toBe(
          false,
        );

        cancelAfter64MiB = false;
        capacityChecks = 0;
        const result = await store.generateWorkspaceExport({
          callerId: randomUUID(),
          commandId: randomUUID(),
          destination: {
            base: "opened-source",
            kind: "workspace",
            relativePath: "generated.afa",
          },
          format: "aligned-fasta",
          mediaType: "text/x-fasta",
          name: "generated.afa",
          operationId: randomUUID(),
          provenance: {
            engine: "sequence-viewer-large-qualification-v1",
            parameters: { milestone: "1-gib" },
            sourceRevision: 0,
          },
          sessionId,
          source: { compression: "gzip", kind: "opened-source" },
        });
        expect(result).toMatchObject({
          kind: "artifact",
          metrics: {
            mode: "server-generated",
            peakRetainedBytes: expect.any(Number),
          },
        });
        if (result.kind !== "artifact" || !("metrics" in result)) {
          throw new Error("Expected generated workspace artifact metrics.");
        }
        expect(result.size).toBeGreaterThan(1_024 * 1_024 * 1_024);
        expect(result.metrics?.peakRetainedBytes).toBeLessThanOrEqual(
          4 * 1_024 * 1_024,
        );
        const digest = createHash("sha256");
        for await (const chunk of createReadStream(
          path.join(data, "generated.afa"),
        )) {
          digest.update(chunk);
        }
        expect(digest.digest("hex")).toBe(result.sha256);
      } finally {
        await store.dispose();
        await rm(root, { force: true, recursive: true });
      }
    },
    300_000,
  );
});
