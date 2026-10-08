import { randomUUID } from "node:crypto";

import { describe, expect, it } from "vitest";

import { SEQUENCE_VIEWER_LIMITS } from "./runtime-contract";
import {
  sequenceAppendWorkbenchPayloadChunkInputSchema,
  sequenceBeginWorkbenchPayloadUploadInputSchema,
  sequenceGenerateWorkspaceExportInputSchema,
  sequencePersistWorkbenchPayloadInputSchema,
} from "./workbench-persistence-protocol";

describe("workbench persistence protocol bounds", () => {
  it("admits one-shot payloads only through the centralized proxy-safe threshold", () => {
    const input = artifactDeclaration(
      SEQUENCE_VIEWER_LIMITS.persistence.maxOneShotBytes,
    );
    expect(
      sequencePersistWorkbenchPayloadInputSchema.parse({
        ...input,
        dataBase64: Buffer.alloc(input.byteLength).toString("base64"),
      }),
    ).toMatchObject({ byteLength: input.byteLength });
    expect(() =>
      sequencePersistWorkbenchPayloadInputSchema.parse({
        ...artifactDeclaration(input.byteLength + 1),
        dataBase64: Buffer.alloc(input.byteLength + 1).toString("base64"),
      }),
    ).toThrow("one-shot threshold");
  });

  it("keeps artifact and session declarations within their independent limits", () => {
    expect(
      sequenceBeginWorkbenchPayloadUploadInputSchema.parse(
        sessionDeclaration(SEQUENCE_VIEWER_LIMITS.session.maxSessionBytes),
      ),
    ).toMatchObject({ kind: "session" });
    expect(() =>
      sequenceBeginWorkbenchPayloadUploadInputSchema.parse(
        sessionDeclaration(SEQUENCE_VIEWER_LIMITS.session.maxSessionBytes + 1),
      ),
    ).toThrow("session size");
    expect(() =>
      sequenceBeginWorkbenchPayloadUploadInputSchema.parse(
        artifactDeclaration(
          SEQUENCE_VIEWER_LIMITS.session.maxArtifactBytes + 1,
        ),
      ),
    ).toThrow();
    expect(
      sequenceBeginWorkbenchPayloadUploadInputSchema.parse({
        ...artifactDeclaration(
          SEQUENCE_VIEWER_LIMITS.session.maxArtifactBytes + 1,
        ),
        destination: {
          base: "opened-source",
          kind: "workspace",
          relativePath: "large.fasta",
        },
        provenance: {
          engine: "test",
          parameters: {},
          sourceRevision: 0,
        },
      }),
    ).toMatchObject({
      byteLength: SEQUENCE_VIEWER_LIMITS.session.maxArtifactBytes + 1,
      destination: { kind: "workspace" },
    });
  });

  it("bounds encoded chunks and rejects malformed identities", () => {
    const identity = {
      callerId: randomUUID(),
      commandId: randomUUID(),
      sessionId: randomUUID(),
      uploadId: randomUUID(),
    };
    expect(
      sequenceAppendWorkbenchPayloadChunkInputSchema.parse({
        ...identity,
        dataBase64: Buffer.alloc(
          SEQUENCE_VIEWER_LIMITS.persistence.maxChunkBytes,
        ).toString("base64"),
        offset: 0,
      }),
    ).toMatchObject({ offset: 0 });
    expect(() =>
      sequenceAppendWorkbenchPayloadChunkInputSchema.parse({
        ...identity,
        dataBase64: Buffer.alloc(
          SEQUENCE_VIEWER_LIMITS.persistence.maxChunkBytes + 4,
        ).toString("base64"),
        offset: 0,
      }),
    ).toThrow();
    expect(() =>
      sequenceAppendWorkbenchPayloadChunkInputSchema.parse({
        ...identity,
        callerId: "not-a-uuid",
        dataBase64: "QQ==",
        offset: 0,
      }),
    ).toThrow();
  });

  it("rejects inconsistent server-generation metadata before file access", () => {
    const input = {
      callerId: randomUUID(),
      commandId: randomUUID(),
      destination: {
        base: "opened-source" as const,
        kind: "workspace" as const,
        relativePath: "exports/reads.fastq",
      },
      format: "fastq" as const,
      mediaType: "text/x-fasta",
      name: "reads.fastq",
      operationId: randomUUID(),
      provenance: {
        engine: "test",
        parameters: {},
        sourceRevision: 0,
      },
      sessionId: randomUUID(),
      source: { compression: "auto" as const, kind: "opened-source" as const },
    };
    expect(() => sequenceGenerateWorkspaceExportInputSchema.parse(input)).toThrow(
      "media type",
    );
    expect(() =>
      sequenceGenerateWorkspaceExportInputSchema.parse({
        ...input,
        destination: { ...input.destination, relativePath: "/tmp/reads.fastq" },
        mediaType: "text/x-fastq",
      }),
    ).toThrow();
  });
});

function artifactDeclaration(byteLength: number) {
  return {
    byteLength,
    callerId: randomUUID(),
    commandId: randomUUID(),
    format: "fasta",
    kind: "artifact",
    mediaType: "text/x-fasta",
    name: "demo.fasta",
    sessionId: randomUUID(),
    sha256: "0".repeat(64),
    uploadId: randomUUID(),
  };
}

function sessionDeclaration(byteLength: number) {
  return {
    byteLength,
    callerId: randomUUID(),
    commandId: randomUUID(),
    kind: "session",
    name: "demo.session.json",
    sessionId: randomUUID(),
    sha256: "0".repeat(64),
    uploadId: randomUUID(),
  };
}
