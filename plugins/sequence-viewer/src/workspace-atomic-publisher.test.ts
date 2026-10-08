import { mkdtemp, open, readFile, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  publishSequenceWorkspacePair,
  publishSequenceWorkspaceStagedPair,
  SequenceWorkspaceCollisionError,
} from "./workspace-atomic-publisher";

const temporaryDirectories: Array<string> = [];
const publicationPolicyPlatforms: Array<"darwin" | "win32"> =
  process.platform === "win32" ? ["win32"] : ["darwin", "win32"];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { force: true, recursive: true })),
  );
});

describe("destination-local staged workspace publication", () => {
  it.each(publicationPolicyPlatforms)(
    "serializes equivalent %s destinations without weakening collision protection",
    async (platform) => {
      const directory = await temporaryDirectory();
      const firstPath = path.join(directory, "output.fasta");
      const secondPath =
        platform === "win32"
          ? path.join(directory, "OUTPUT.fasta")
          : `${directory}${path.sep}.${path.sep}output.fasta`;
      const originalPlatform = Object.getOwnPropertyDescriptor(
        process,
        "platform",
      );
      if (originalPlatform == null) {
        throw new Error("The native platform cannot be verified.");
      }

      let enterFirst!: () => void;
      let releaseFirst!: () => void;
      const enteredFirst = new Promise<void>((resolve) => {
        enterFirst = resolve;
      });
      const firstGate = new Promise<void>((resolve) => {
        releaseFirst = resolve;
      });
      let secondEntered = false;

      Object.defineProperty(process, "platform", {
        ...originalPlatform,
        value: platform,
      });
      let first: Promise<void> | undefined;
      let second: Promise<{ error?: unknown }> | undefined;
      try {
        first = publishSequenceWorkspacePair({
          artifact: new TextEncoder().encode(">first\nACGT\n"),
          artifactPath: firstPath,
          hooks: {
            beforeArtifactLink: async () => {
              enterFirst();
              await firstGate;
            },
          },
          sidecar: '{"source":"first"}\n',
          sidecarPath: `${firstPath}.provenance.json`,
        });
        await enteredFirst;
        second = publishSequenceWorkspacePair({
          artifact: new TextEncoder().encode(">second\nTTTT\n"),
          artifactPath: secondPath,
          hooks: {
            beforeArtifactLink: () => {
              secondEntered = true;
            },
          },
          sidecar: '{"source":"second"}\n',
          sidecarPath: `${secondPath}.provenance.json`,
        }).then(
          () => ({}),
          (error: unknown) => ({ error }),
        );

        await new Promise<void>((resolve) => setImmediate(resolve));
        expect(secondEntered).toBe(false);
        releaseFirst();
        await first;
        const outcome = await second;
        expect(await readFile(firstPath, "utf8")).toBe(">first\nACGT\n");
        if (outcome.error != null) {
          expect(outcome.error).toBeInstanceOf(SequenceWorkspaceCollisionError);
        } else {
          expect(await readFile(secondPath, "utf8")).toBe(">second\nTTTT\n");
        }
      } finally {
        releaseFirst();
        await Promise.allSettled([first, second]);
        Object.defineProperty(process, "platform", originalPlatform);
      }
    },
  );

  it("links a private staged file and sidecar without materializing the artifact", async () => {
    const directory = await temporaryDirectory();
    const staged = path.join(directory, ".output.fasta.upload.tmp");
    const artifact = path.join(directory, "output.fasta");
    const sidecar = `${artifact}.provenance.json`;
    await writePrivate(staged, ">demo\nACGT\n");
    const identity = await stagedIdentity(staged);

    await publishSequenceWorkspaceStagedPair({
      artifactPath: artifact,
      sidecar: "{}\n",
      sidecarPath: sidecar,
      stagedArtifactPath: staged,
      stagedIdentity: identity,
    });

    await expect(readFile(artifact, "utf8")).resolves.toBe(">demo\nACGT\n");
    await expect(readFile(sidecar, "utf8")).resolves.toBe("{}\n");
    const [stagedStat, artifactStat] = await Promise.all([
      stat(staged, { bigint: true }),
      stat(artifact, { bigint: true }),
    ]);
    expect(artifactStat.ino).toBe(stagedStat.ino);
  });

  it("fails closed when staging is replaced during a containment race", async () => {
    const directory = await temporaryDirectory();
    const staged = path.join(directory, ".output.fasta.upload.tmp");
    const artifact = path.join(directory, "output.fasta");
    const sidecar = `${artifact}.provenance.json`;
    await writePrivate(staged, ">trusted\nACGT\n");
    const identity = await stagedIdentity(staged);

    await expect(
      publishSequenceWorkspaceStagedPair({
        artifactPath: artifact,
        hooks: {
          beforeArtifactLink: async () => {
            await rm(staged);
            await writePrivate(staged, ">replacement\nAAAA\n");
          },
        },
        sidecar: "{}\n",
        sidecarPath: sidecar,
        stagedArtifactPath: staged,
        stagedIdentity: identity,
      }),
    ).rejects.toThrow("staging changed");
    await expect(readFile(artifact)).rejects.toMatchObject({ code: "ENOENT" });
    await expect(readFile(sidecar)).rejects.toMatchObject({ code: "ENOENT" });
  });
});

async function temporaryDirectory(): Promise<string> {
  const directory = await mkdtemp(
    path.join(os.tmpdir(), "sequence-workspace-atomic-test-"),
  );
  temporaryDirectories.push(directory);
  return directory;
}

async function writePrivate(filePath: string, content: string): Promise<void> {
  const file = await open(filePath, "wx", 0o600);
  try {
    await file.writeFile(content);
    await file.sync();
  } finally {
    await file.close();
  }
}

async function stagedIdentity(filePath: string) {
  const fileStat = await stat(filePath, { bigint: true });
  return {
    changedAtNanoseconds: fileStat.ctimeNs.toString(),
    device: fileStat.dev.toString(),
    inode: fileStat.ino.toString(),
    modifiedAtNanoseconds: fileStat.mtimeNs.toString(),
    size: fileStat.size.toString(),
  };
}
