import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  measureSequenceWorkspaceProducer,
  sequenceWorkspaceUploadChunks,
} from "./workspace-artifact-stream";

describe("workspace artifact stream", () => {
  it("matches the standard SHA-256 empty-input vector", async () => {
    const measured = await measureSequenceWorkspaceProducer(async function* () {
      return;
    });
    expect(measured).toEqual({
      byteLength: 0,
      peakRetainedBytes: 0,
      sha256:
        "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    });
  });

  it("measures and chunks a repeatable Unicode producer with bounded memory", async () => {
    const text = `>café\n${"ACGT".repeat(100_000)}\n`;
    const producer = async function* () {
      yield text.slice(0, 70_001);
      yield text.slice(70_001);
    };
    const measured = await measureSequenceWorkspaceProducer(producer);
    expect(measured).toMatchObject({
      byteLength: Buffer.byteLength(text),
      sha256: createHash("sha256").update(text).digest("hex"),
    });
    const chunks: Array<Uint8Array> = [];
    for await (const chunk of sequenceWorkspaceUploadChunks(producer, {
      maxChunkBytes: 192 * 1_024,
      startOffset: 0,
      totalBytes: measured.byteLength,
    })) {
      chunks.push(chunk.bytes);
    }
    expect(Buffer.concat(chunks)).toEqual(Buffer.from(text));
  });

  it("resumes at an acknowledged chunk boundary without retaining a prefix", async () => {
    const bytes = Buffer.alloc(192 * 1_024 * 3 + 7, 0x61);
    const producer = async function* () {
      yield bytes;
    };
    const chunks = [];
    for await (const chunk of sequenceWorkspaceUploadChunks(producer, {
      maxChunkBytes: 192 * 1_024,
      startOffset: 192 * 1_024 * 2,
      totalBytes: bytes.byteLength,
    })) {
      chunks.push(chunk);
    }
    expect(chunks[0]?.offset).toBe(192 * 1_024 * 2);
    expect(Buffer.concat(chunks.map(({ bytes: chunk }) => chunk))).toEqual(
      bytes.subarray(192 * 1_024 * 2),
    );
  });
});
