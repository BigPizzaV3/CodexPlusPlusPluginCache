import { randomUUID } from "node:crypto";

import { describe, expect, it } from "vitest";

import { SequenceWorkspaceExportAuthorizationStore } from "./workspace-export-authorization";
import { sequencePrepareWorkspaceExportInputSchema } from "./workbench-persistence-protocol";

describe("SequenceWorkspaceExportAuthorizationStore", () => {
  it("binds UI preflight to the exact session, source binding, destination, and declaration", () => {
    const store = new SequenceWorkspaceExportAuthorizationStore();
    const input = request();
    const bindingId = randomUUID();
    const commandId = store.create(input, bindingId);
    const callerId = randomUUID();
    const uploadId = randomUUID();
    const declaration = {
      ...input,
      callerId,
      commandId,
      kind: "artifact" as const,
      uploadId,
    };
    expect(store.assertDeclaration(declaration)).toBe(bindingId);
    expect(
      store.assertIdentity({ callerId, commandId, sessionId: input.sessionId, uploadId }),
    ).toBe(bindingId);

    for (const changed of [
      { sha256: "b".repeat(64) },
      { name: "retargeted.fasta" },
      {
        destination: {
          ...input.destination,
          relativePath: "exports/retargeted.fasta",
        },
      },
      { format: "json" as const },
    ]) {
      expect(() =>
        store.assertDeclaration({ ...declaration, ...changed }),
      ).toThrow("does not match");
    }
    expect(() =>
      store.assertIdentity({ callerId, commandId, sessionId: randomUUID(), uploadId }),
    ).toThrow("another viewer session");
    expect(() =>
      store.assertIdentity({
        callerId,
        commandId,
        sessionId: input.sessionId,
        uploadId: randomUUID(),
      }),
    ).toThrow("another upload");
  });

  it("consumes terminal authorizations without breaking exact response retries", () => {
    const store = new SequenceWorkspaceExportAuthorizationStore();
    const input = request();
    const commandId = store.create(input, randomUUID());
    const declaration = {
      ...input,
      callerId: randomUUID(),
      commandId,
      kind: "artifact" as const,
      uploadId: randomUUID(),
    };
    store.assertDeclaration(declaration);
    expect(store.consumeIfPresent(declaration)).toBe(true);
    expect(store.assertDeclaration(declaration)).toBeTypeOf("string");
    expect(store.consumeIfPresent(declaration)).toBe(true);

    for (let index = 0; index < 65; index += 1) {
      const requestInput = request();
      const nextCommandId = store.create(requestInput, randomUUID());
      const identity = {
        ...requestInput,
        callerId: randomUUID(),
        commandId: nextCommandId,
        kind: "artifact" as const,
        uploadId: randomUUID(),
      };
      store.assertDeclaration(identity);
      expect(store.consumeIfPresent(identity)).toBe(true);
    }
  });

  it("expires unused authorizations", () => {
    let now = 100;
    const store = new SequenceWorkspaceExportAuthorizationStore(() => now);
    const input = request();
    const commandId = store.create(input, randomUUID());
    const identity = {
      callerId: randomUUID(),
      commandId,
      sessionId: input.sessionId,
      uploadId: randomUUID(),
    };
    now += 5 * 60 * 1_000 + 1;
    expect(() => store.assertIdentity(identity)).toThrow("expired");
  });
});

function request() {
  return sequencePrepareWorkspaceExportInputSchema.parse({
    byteLength: 10,
    destination: {
      base: "opened-source",
      kind: "workspace",
      relativePath: "exports/derived.fasta",
    },
    format: "fasta",
    mediaType: "text/x-fasta",
    name: "derived.fasta",
    provenance: {
      engine: "sequence-viewer-browser-export-v1",
      parameters: { scope: "all" },
      sourceRevision: 0,
    },
    sessionId: randomUUID(),
    sha256: "a".repeat(64),
  });
}
