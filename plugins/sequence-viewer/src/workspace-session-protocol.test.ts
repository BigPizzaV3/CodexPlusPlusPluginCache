import { describe, expect, it } from "vitest";

import {
  sequenceListWorkspaceSessionsResultSchema,
  sequenceWorkspaceSessionManifestSchema,
} from "./workspace-session-protocol";

describe("workspace session protocol", () => {
  it("accepts only strict, source-relative, bounded manifests", () => {
    const valid = {
      createdAt: "2026-06-29T12:00:00.000Z",
      dependencies: [],
      mode: "sequence",
      payload: '{"schemaVersion":1}',
      payloadSha256: "a".repeat(64),
      plugin: { name: "sequence-viewer", version: "0.1.26" },
      schemaVersion: 1,
      source: {
        sha256: "b".repeat(64),
        size: 12,
        workspacePath: "data/source.fasta",
      },
      version: 1,
    };
    expect(sequenceWorkspaceSessionManifestSchema.parse(valid)).toEqual(valid);
    expect(() =>
      sequenceWorkspaceSessionManifestSchema.parse({
        ...valid,
        source: { ...valid.source, workspacePath: "/home/user/source.fasta" },
      }),
    ).toThrow();
    expect(() =>
      sequenceWorkspaceSessionManifestSchema.parse({
        ...valid,
        privateSessionId: "11111111-1111-4111-8111-111111111111",
      }),
    ).toThrow();
    expect(() =>
      sequenceWorkspaceSessionManifestSchema.parse({
        ...valid,
        payload: "x".repeat(512 * 1_024 + 1),
      }),
    ).toThrow("bounded session size");
  });

  it("does not admit absolute paths or arbitrary candidate fields", () => {
    const candidate = {
      candidateId: "11111111-1111-4111-8111-111111111111",
      createdAt: "2026-06-29T12:00:00.000Z",
      dependencies: [],
      mode: "alignment",
      name: "source.sequence-viewer.session.json",
      sourceStatus: "verification-required",
      workspacePath: "data/source.sequence-viewer.session.json",
    };
    expect(
      sequenceListWorkspaceSessionsResultSchema.parse({
        candidates: [candidate],
        omittedCandidates: 0,
      }),
    ).toBeDefined();
    expect(() =>
      sequenceListWorkspaceSessionsResultSchema.parse({
        candidates: [{ ...candidate, workspacePath: "C:\\private\\session.json" }],
        omittedCandidates: 0,
      }),
    ).toThrow();
  });
});
