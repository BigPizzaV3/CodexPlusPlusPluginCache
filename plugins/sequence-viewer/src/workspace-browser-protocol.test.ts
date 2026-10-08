import { describe, expect, it } from "vitest";

import {
  sequenceCreateWorkspaceDirectoryInputSchema,
  sequenceListWorkspaceDirectoryInputSchema,
  sequenceListWorkspaceDirectoryResultSchema,
} from "./workspace-browser-protocol";

const sessionId = "11111111-1111-4111-8111-111111111111";

describe("workspace browser protocol", () => {
  it("accepts bounded source-relative navigation and one child segment", () => {
    expect(
      sequenceListWorkspaceDirectoryInputSchema.parse({
        candidate: { format: "fasta", name: "derived.fasta" },
        directory: "../../results",
        sessionId,
      }),
    ).toMatchObject({ directory: "../../results", limit: 50 });
    expect(
      sequenceCreateWorkspaceDirectoryInputSchema.parse({
        name: "new analysis",
        parentDirectory: "../results",
        sessionId,
      }),
    ).toMatchObject({ name: "new analysis", parentDirectory: "../results" });
  });

  it("rejects absolute, URI-like, malformed, and reserved navigation", () => {
    for (const directory of [
      "",
      "/tmp",
      "C:/tmp",
      "file:///tmp",
      "../bad//path",
      "../CON/path",
      "../trailing./path",
      "../linked\\path",
    ]) {
      expect(
        sequenceListWorkspaceDirectoryInputSchema.safeParse({
          directory,
          sessionId,
        }).success,
      ).toBe(false);
    }
    for (const name of [".", "..", "nested/folder", "CON", "name.", "name "]) {
      expect(
        sequenceCreateWorkspaceDirectoryInputSchema.safeParse({
          name,
          parentDirectory: ".",
          sessionId,
        }).success,
      ).toBe(false);
    }
  });

  it("allows only relative nondisclosing browser results", () => {
    const valid = {
      directory: {
        breadcrumbs: [
          { label: "Workspace", relativePath: "..", workspacePath: "." },
          { label: "results", relativePath: "../results", workspacePath: "results" },
        ],
        parentRelativePath: "..",
        relativePath: "../results",
        sourceDirectoryWorkspacePath: "data",
        workspacePath: "results",
      },
      entries: [
        {
          kind: "file",
          name: "derived.fasta",
          relativePath: "../results/derived.fasta",
          size: 12,
        },
      ],
      omittedEntries: 0,
    };
    expect(sequenceListWorkspaceDirectoryResultSchema.safeParse(valid).success).toBe(
      true,
    );
    expect(
      sequenceListWorkspaceDirectoryResultSchema.safeParse({
        ...valid,
        directory: { ...valid.directory, workspacePath: "/home/user/results" },
      }).success,
    ).toBe(false);
  });
});
