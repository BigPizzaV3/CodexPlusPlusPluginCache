import {
  chmod,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { createServerWorkbenchStore } from "./server-workbench-store";

const temporaryDirectories: Array<string> = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { force: true, recursive: true })),
  );
});

describe("persistent workbench artifact and session store", () => {
  it("preserves Windows ACL-managed state without applying POSIX chmod", async () => {
    const directory = await temporaryDirectory();
    const artifactsDirectory = path.join(
      directory,
      "workbench-v1",
      "artifacts",
    );
    await mkdir(artifactsDirectory, { recursive: true });
    const supportsPosixPermissions = process.platform !== "win32";
    if (supportsPosixPermissions) {
      await chmod(artifactsDirectory, 0o755);
    }
    const originalPlatform = Object.getOwnPropertyDescriptor(
      process,
      "platform",
    );
    if (originalPlatform == null) {
      throw new Error("The native platform cannot be verified.");
    }
    Object.defineProperty(process, "platform", {
      ...originalPlatform,
      value: "win32",
    });
    try {
      const store = createServerWorkbenchStore({ stateDirectory: directory });
      const artifact = await store.persistArtifact({
        content: ">windows\nACGT\n",
        format: "fasta",
        mediaType: "text/x-fasta",
        name: "windows.fasta",
      });
      await expect(store.readArtifact(artifact.id)).resolves.toMatchObject({
        content: ">windows\nACGT\n",
      });
      if (supportsPosixPermissions) {
        expect((await stat(artifactsDirectory)).mode & 0o777).toBe(0o755);
      }
    } finally {
      Object.defineProperty(process, "platform", originalPlatform);
    }
  });

  it("persists and reads bounded artifacts through opaque resource IDs", async () => {
    const directory = await temporaryDirectory();
    const store = createServerWorkbenchStore({ stateDirectory: directory });
    const artifact = await store.persistArtifact({
      content: ">demo\nACGT\n",
      format: "fasta",
      mediaType: "text/x-fasta",
      name: "demo.fasta",
    });

    expect(artifact.resourceUri).toBe(
      `viewer-artifact://sequence-viewer/generated/${artifact.id}`,
    );
    await expect(store.readArtifact(artifact.id)).resolves.toEqual({
      content: ">demo\nACGT\n",
      metadata: expect.objectContaining({
        format: "fasta",
        id: artifact.id,
        name: "demo.fasta",
        size: 11,
      }),
    });
  });

  it("round-trips versioned viewer sessions without exposing local paths", async () => {
    const directory = await temporaryDirectory();
    const store = createServerWorkbenchStore({ stateDirectory: directory });
    const saved = await store.saveSession({
      name: "analysis.session.json",
      session: '{"schemaVersion":1,"view":{"mode":"sequence"}}',
    });
    expect(saved.id).toMatch(/^[0-9a-f-]{36}$/u);
    await expect(store.readSession(saved.id)).resolves.toContain(
      '"schemaVersion":1',
    );
  });

  it("detects artifact content tampering instead of trusting stale metadata", async () => {
    const directory = await temporaryDirectory();
    const store = createServerWorkbenchStore({ stateDirectory: directory });
    const artifact = await store.persistArtifact({
      content: "original",
      format: "txt",
      mediaType: "text/plain",
      name: "result.txt",
    });
    await writeFile(
      path.join(
        directory,
        "workbench-v1",
        "artifacts",
        `${artifact.id}.artifact`,
      ),
      "changed",
    );
    await expect(store.readArtifact(artifact.id)).rejects.toThrow(
      "does not match",
    );
  });

  it("rejects path-like or malformed identifiers", async () => {
    const directory = await temporaryDirectory();
    const store = createServerWorkbenchStore({ stateDirectory: directory });
    await expect(store.readArtifact("../../secret")).rejects.toThrow(
      "identifier is invalid",
    );
    await expect(store.readSession("not-a-uuid")).rejects.toThrow(
      "identifier is invalid",
    );
  });

  it("writes private state files with owner-only permissions", async () => {
    const directory = await temporaryDirectory();
    const store = createServerWorkbenchStore({ stateDirectory: directory });
    const artifact = await store.persistArtifact({
      content: "private",
      format: "txt",
      mediaType: "text/plain",
      name: "private.txt",
    });
    const filePath = path.join(
      directory,
      "workbench-v1",
      "artifacts",
      `${artifact.id}.metadata.json`,
    );
    expect((await readFile(filePath, "utf8")).toString()).toContain(
      artifact.id,
    );
    const fileStat = await stat(filePath);
    expect(fileStat.isFile()).toBe(true);
    if (process.platform !== "win32") {
      expect(fileStat.mode & 0o777).toBe(0o600);
    }
  });
});

async function temporaryDirectory(): Promise<string> {
  const directory = await mkdtemp(
    path.join(os.tmpdir(), "sequence-workbench-store-"),
  );
  temporaryDirectories.push(directory);
  return directory;
}
