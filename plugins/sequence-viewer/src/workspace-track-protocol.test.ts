import { randomUUID } from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  sequenceListWorkspaceTrackDirectoryResultSchema,
  sequenceLoadWorkspaceTrackInputSchema,
  sequenceResolveWorkspaceTrackBundleResultSchema,
} from "./workspace-track-protocol";

describe("workspace track protocol", () => {
  it("accepts only bounded paired inclusive windows", () => {
    const base = { bundleId: randomUUID(), sessionId: randomUUID() };
    expect(
      sequenceLoadWorkspaceTrackInputSchema.parse({
        ...base,
        end: 100_000,
        reference: "chr1",
        start: 1,
      }),
    ).toMatchObject({ start: 1, end: 100_000 });
    expect(() =>
      sequenceLoadWorkspaceTrackInputSchema.parse({ ...base, start: 1 }),
    ).toThrow(/both start and end/u);
    expect(() =>
      sequenceLoadWorkspaceTrackInputSchema.parse({
        ...base,
        end: 100_001,
        start: 1,
      }),
    ).toThrow(/100,000/u);
  });

  it("rejects absolute, traversal, URL, and backslash metadata", () => {
    const candidateId = randomUUID();
    const base = {
      candidateId,
      format: "bed",
      kind: "file",
      label: "track.bed",
      role: "annotation",
      size: 10,
    };
    for (const workspacePath of [
      "/tmp/track.bed",
      "../track.bed",
      "data/../track.bed",
      "file:track.bed",
      "data\\track.bed",
    ]) {
      expect(() =>
        sequenceListWorkspaceTrackDirectoryResultSchema.parse({
          breadcrumbs: [
            {
              candidateId: randomUUID(),
              label: "Workspace",
              workspacePath: ".",
            },
          ],
          directory: {
            candidateId: randomUUID(),
            label: "Workspace",
            workspacePath: ".",
          },
          entries: [{ ...base, workspacePath }],
          omittedEntries: 0,
        }),
      ).toThrow();
    }
  });

  it("requires ready and bundle ID to agree", () => {
    const primary = {
      candidateId: randomUUID(),
      format: "bed",
      kind: "file",
      label: "track.bed",
      role: "annotation",
      size: 10,
      workspacePath: "data/track.bed",
    };
    expect(() =>
      sequenceResolveWorkspaceTrackBundleResultSchema.parse({
        primary,
        ready: true,
        requirements: [],
      }),
    ).toThrow(/bundleId/u);
    expect(() =>
      sequenceResolveWorkspaceTrackBundleResultSchema.parse({
        bundleId: randomUUID(),
        primary,
        ready: false,
        requirements: [],
      }),
    ).toThrow(/bundleId/u);
  });
});
