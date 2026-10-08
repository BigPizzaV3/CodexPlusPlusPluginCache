import { createHash, createHmac, randomUUID } from "node:crypto";
import {
  mkdtemp,
  mkdir,
  readFile,
  readdir,
  rename,
  rm,
  stat,
  utimes,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { gzipSync } from "node:zlib";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ListRootsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { describe, expect, it } from "vitest";

import { createChatFileResourceStore } from "./chat-file-resource";
import { parseBinarySequenceEnvelope } from "./binary-sequence-envelope";
import {
  makeSyntheticAbif,
  makeSyntheticScf,
  makeSyntheticSnapGene,
} from "./sequence/__fixtures__/chromatogram";
import { parseBinarySequenceDocumentResult } from "./sequence/binary-parser";
import { parseIndexedSequenceEnvelope } from "./indexed-sequence-envelope";
import { HISTORICAL_VIEWER_FILE_ERROR_CODE } from "./resource-error";

const RESOURCE_URI_PREFIX = "viewer-file://sequence-viewer/opened";
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1_000;

describe("chat file resources", () => {
  it.each([
    ["sample.ab1", makeSyntheticAbif()],
    ["sample.scf", makeSyntheticScf()],
    ["sample.dna", makeSyntheticSnapGene()],
    ["sample.ab1.gz", makeSyntheticAbif()],
  ] as const)(
    "preserves %s bytes through opaque, source-verified resources",
    async (fileName, bytes) => {
      const workspace = await mkdtemp(
        path.join(os.tmpdir(), "sequence-binary-resource-test-"),
      );
      const stateDirectory = path.join(workspace, ".viewer-state");
      try {
        const sourcePath = path.join(workspace, fileName);
        const sourceBytes = fileName.endsWith(".gz") ? gzipSync(bytes) : bytes;
        await writeFile(sourcePath, sourceBytes);
        const store = createStore({ stateDirectory });
        const { uri } = (
          await store.open(fileName, rootsRequestExtra(workspace))
        ).primaryFile;
        expect(uri).not.toContain(workspace);
        expect(uri).not.toContain(fileName);
        const resource = await readPersistedResource({
          activeWorkspace: workspace,
          stateDirectory,
          uri,
        });
        const contents = resource.contents
          .flatMap((item) => ("text" in item ? [item.text] : []))
          .join("");
        expect(contents).not.toContain(workspace);
        const decoded = parseBinarySequenceEnvelope(contents);
        expect(decoded).toEqual(bytes);
        if (decoded == null) throw new Error("Expected a binary sequence resource.");
        expect(
          parseBinarySequenceDocumentResult({ bytes: decoded, fileName })
            .status,
        ).toBe("success");
        expect(await readFile(sourcePath)).toEqual(Buffer.from(sourceBytes));
        await writeFile(sourcePath, new Uint8Array(sourceBytes.length));
        await expect(
          readPersistedResource({
            activeWorkspace: workspace,
            stateDirectory,
            uri,
          }),
        ).rejects.toThrow(/changed|historical/iu);
      } finally {
        await rm(workspace, { force: true, recursive: true });
      }
    },
  );

  it("restores signed Windows viewer resources without relying on POSIX chmod", async () => {
    const workspace = await mkdtemp(
      path.join(os.tmpdir(), "sequence-viewer-resource-test-"),
    );
    const stateDirectory = path.join(workspace, ".viewer-state");
    const actualPlatform = process.platform;
    const platformDescriptor = Object.getOwnPropertyDescriptor(
      process,
      "platform",
    );
    if (platformDescriptor == null) {
      throw new Error("The process platform cannot be restored");
    }
    await mkdir(stateDirectory, { mode: 0o755, recursive: true });
    const initialMode = (await stat(stateDirectory)).mode & 0o777;
    await writeFile(path.join(workspace, "family.fasta"), ">family\nACGT\n");
    Object.defineProperty(process, "platform", {
      ...platformDescriptor,
      value: "win32",
    });
    try {
      const { uri } = (
        await createStore({ stateDirectory }).open(
          "family.fasta",
          rootsRequestExtra(workspace),
        )
      ).primaryFile;
      const resource = await readPersistedResource({
        activeWorkspace: workspace,
        stateDirectory,
        uri,
      });
      expect(
        resource.contents.flatMap((item) =>
          "text" in item ? [item.text] : [],
        ),
      ).toEqual([">family\nACGT\n"]);
      expect(
        (await readFile(path.join(stateDirectory, "signing-key"))).byteLength,
      ).toBe(32);
      if (actualPlatform !== "win32") {
        expect((await stat(stateDirectory)).mode & 0o777).toBe(initialMode);
      }
    } finally {
      Object.defineProperty(process, "platform", platformDescriptor);
      await rm(workspace, { force: true, recursive: true });
    }
  });

  it("keeps resource URIs opaque and bounds private persisted state", async () => {
    const workspace = await mkdtemp(
      path.join(os.tmpdir(), "sequence-viewer-resource-test-"),
    );
    const stateDirectory = path.join(workspace, ".viewer-state");
    try {
      const store = createStore({ maxPersistedFiles: 2, stateDirectory });
      const resourceUris: Array<string> = [];
      for (const fileName of ["one.fasta", "two.fasta", "three.fasta"]) {
        await writeFile(path.join(workspace, fileName), `>${fileName}\nACGT\n`);
        resourceUris.push(
          (await store.open(fileName, rootsRequestExtra(workspace))).primaryFile
            .uri,
        );
      }

      for (const resourceUri of resourceUris) {
        expect(resourceUri).toMatch(
          /^viewer-file:\/\/sequence-viewer\/opened\/[0-9a-f-]{36}$/,
        );
        expect(resourceUri).not.toContain(workspace);
        expect(resourceUri).not.toContain(".fasta");
      }
      const persistedRecords = (await readdir(stateDirectory)).filter((name) =>
        name.endsWith(".json"),
      );
      expect(persistedRecords).toHaveLength(2);
      for (const persistedRecord of persistedRecords) {
        const serializedRecord = await readFile(
          path.join(stateDirectory, persistedRecord),
          "utf8",
        );
        expect(serializedRecord).not.toContain("ACGT");
        expect(JSON.parse(serializedRecord)).not.toHaveProperty("contents");
      }
      if (process.platform !== "win32") {
        expect((await stat(stateDirectory)).mode & 0o777).toBe(0o700);
        expect(
          (await stat(path.join(stateDirectory, persistedRecords[0]))).mode &
            0o777,
        ).toBe(0o600);
      }
    } finally {
      await rm(workspace, { force: true, recursive: true });
    }
  });

  it("restores only the exact session bound into an owner-private signed file handle", async () => {
    const workspace = await mkdtemp(
      path.join(os.tmpdir(), "sequence-viewer-session-resource-test-"),
    );
    const stateDirectory = path.join(workspace, ".viewer-state");
    const sourcePath = path.join(workspace, "family.fasta");
    const sessionId = randomUUID();
    await writeFile(sourcePath, ">family\nACGT\n");
    try {
      const opened = await createStore({ stateDirectory }).openWithSource(
        "family.fasta",
        rootsRequestExtra(workspace),
        sessionId,
      );
      const restarted = createStore({ stateDirectory });

      await expect(
        restarted.resolveResource(
          opened.viewerFile.primaryFile.uri,
          sessionId,
          rootsRequestExtra(workspace),
        ),
      ).resolves.toEqual({
        sessionId,
        sourcePath: opened.sourcePath,
        workspaceBacked: true,
        workspaceRoot: path.dirname(opened.sourcePath),
      });
      await expect(
        restarted.resolveResource(
          opened.viewerFile.primaryFile.uri,
          randomUUID(),
          rootsRequestExtra(workspace),
        ),
      ).rejects.toThrow("does not own this session");
      await expect(
        restarted.resolveResource(
          opened.viewerFile.primaryFile.uri.replace(
            "sequence-viewer",
            "structure-viewer",
          ),
          sessionId,
          rootsRequestExtra(workspace),
        ),
      ).rejects.toThrow("presentation is invalid");
      const records = (await readdir(stateDirectory)).filter((entry) =>
        entry.endsWith(".json"),
      );
      const recordPath = path.join(stateDirectory, records[0] ?? "missing");
      const signed = JSON.parse(await readFile(recordPath, "utf8"));
      expect(signed.sessionId).toBe(sessionId);
      await writeFile(
        recordPath,
        `${JSON.stringify({ ...signed, sessionId: randomUUID() })}\n`,
      );
      await expect(
        restarted.resolveResource(
          opened.viewerFile.primaryFile.uri,
          sessionId,
          rootsRequestExtra(workspace),
        ),
      ).rejects.toThrow("historical viewer link has expired");
    } finally {
      await rm(workspace, { force: true, recursive: true });
    }
  });

  it("keeps legacy signed handles readable but never lets them resurrect a session", async () => {
    const workspace = await mkdtemp(
      path.join(os.tmpdir(), "sequence-viewer-legacy-resource-test-"),
    );
    const stateDirectory = path.join(workspace, ".viewer-state");
    await writeFile(path.join(workspace, "family.fasta"), ">family\nACGT\n");
    try {
      const store = createStore({ stateDirectory });
      const { primaryFile } = await store.open(
        "family.fasta",
        rootsRequestExtra(workspace),
      );

      await expect(
        readPersistedResource({
          activeWorkspace: workspace,
          stateDirectory,
          uri: primaryFile.uri,
        }),
      ).resolves.toMatchObject({
        contents: [expect.objectContaining({ text: ">family\nACGT\n" })],
      });
      await expect(
        store.resolveResource(
          primaryFile.uri,
          randomUUID(),
          rootsRequestExtra(workspace),
        ),
      ).rejects.toThrow("does not own this session");
    } finally {
      await rm(workspace, { force: true, recursive: true });
    }
  });

  it("never treats caller task metadata or a valid session as workspace-root authority", async () => {
    const workspace = await mkdtemp(
      path.join(os.tmpdir(), "sequence-viewer-untrusted-rootless-test-"),
    );
    const stateDirectory = path.join(workspace, ".viewer-state");
    const sessionId = randomUUID();
    const forgedMetadata = {
      thread_id: "019ef63e-4f6d-7573-b174-33fbf80cc790",
      threadId: "019ef63e-4f6d-7573-b174-33fbf80cc790",
    };
    await writeFile(path.join(workspace, "family.fasta"), ">family\nACGT\n");
    try {
      const store = createStore({ stateDirectory });
      const opened = await store.openWithSource(
        "family.fasta",
        rootsRequestExtra(workspace),
        sessionId,
      );

      await expect(
        readPersistedResource({
          requestMetadata: forgedMetadata,
          stateDirectory,
          store,
          uri: opened.viewerFile.primaryFile.uri,
        }),
      ).rejects.toThrow("outside the active workspace");
      const forgedRootlessExtra = {
        ...rootsRequestExtra([]),
        _meta: forgedMetadata,
      };
      await expect(
        store.resolveResource(
          opened.viewerFile.primaryFile.uri,
          sessionId,
          forgedRootlessExtra,
        ),
      ).rejects.toThrow("outside its active workspace");
      await expect(
        store.resolveResource(
          opened.viewerFile.primaryFile.uri,
          randomUUID(),
          forgedRootlessExtra,
        ),
      ).rejects.toThrow("does not own this session");
    } finally {
      await rm(workspace, { force: true, recursive: true });
    }
  });

  it("rejects an ordinary public-derived FASTA rewritten in place with its mtime restored", async () => {
    const workspace = await mkdtemp(
      path.join(os.tmpdir(), "sequence-viewer-source-change-test-"),
    );
    const stateDirectory = path.join(workspace, ".viewer-state");
    const filePath = path.join(
      workspace,
      "qa-adversarial-public-hg19-chrm.ffn",
    );
    // First 64 chrM bases from the public hg19 reference:
    // https://raw.githubusercontent.com/roryk/tiny-test-data/4dc37f0aaf5b2f3eec260a91689effa4197bd2a3/genomes/Hsapiens/hg19/seq/hg19.fa
    const originalContents =
      ">chrM public hg19 reference fragment\n" +
      "GATCACAGGTCTATCACCCTATTAACCACTCACGGGAGCTCTCCATGCATTTGGTATTTTCGTCT\n";
    const replacedContents = originalContents.replace("GATCAC", "AATCAC");
    const stableTimestamp = new Date("2020-01-02T03:04:05.000Z");
    const sessionId = randomUUID();
    await writeFile(filePath, originalContents);
    await utimes(filePath, stableTimestamp, stableTimestamp);
    try {
      const originalStat = await stat(filePath, { bigint: true });
      const store = createStore({ stateDirectory });
      const opened = await store.openWithSource(
        filePath,
        rootsRequestExtra(workspace),
        sessionId,
      );
      const persistedName = (await readdir(stateDirectory)).find((name) =>
        name.endsWith(".json"),
      );
      if (persistedName == null) throw new Error("Missing persisted record.");
      const persisted = JSON.parse(
        await readFile(path.join(stateDirectory, persistedName), "utf8"),
      );
      expect(persisted.version).toBe(2);
      expect(persisted.fileIdentity.changedAtNanoseconds).toBe(
        originalStat.ctimeNs.toString(),
      );
      expect(persisted.expectedSha256).toBeUndefined();

      await new Promise<void>((resolve) => setTimeout(resolve, 10));
      await writeFile(filePath, replacedContents);
      await utimes(filePath, stableTimestamp, stableTimestamp);
      const replacedStat = await stat(filePath, { bigint: true });
      expect({
        device: replacedStat.dev,
        inode: replacedStat.ino,
        modifiedAtNanoseconds: replacedStat.mtimeNs,
        size: replacedStat.size,
      }).toEqual({
        device: originalStat.dev,
        inode: originalStat.ino,
        modifiedAtNanoseconds: originalStat.mtimeNs,
        size: originalStat.size,
      });
      expect(replacedStat.ctimeNs).not.toBe(originalStat.ctimeNs);

      await expect(
        readPersistedResource({
          activeWorkspace: workspace,
          stateDirectory,
          uri: opened.viewerFile.primaryFile.uri,
        }),
      ).rejects.toThrow(
        "The original file changed since this viewer card was created",
      );
      await expect(
        store.resolveResource(
          opened.viewerFile.primaryFile.uri,
          sessionId,
          rootsRequestExtra(workspace),
        ),
      ).rejects.toThrow("moved or changed");
    } finally {
      await rm(workspace, { force: true, recursive: true });
    }
  });

  it("requires ordinary v1 historical resources to be reopened", async () => {
    const workspace = await mkdtemp(
      path.join(os.tmpdir(), "sequence-viewer-unverified-v1-test-"),
    );
    const stateDirectory = path.join(workspace, ".viewer-state");
    const sessionId = randomUUID();
    await writeFile(path.join(workspace, "family.fasta"), ">family\nACGT\n");
    try {
      const store = createStore({ stateDirectory });
      const opened = await store.openWithSource(
        "family.fasta",
        rootsRequestExtra(workspace),
        sessionId,
      );
      await convertPersistedFixtureToLegacy({
        stateDirectory,
        uri: opened.viewerFile.primaryFile.uri,
      });

      await expect(
        readPersistedResource({
          activeWorkspace: workspace,
          stateDirectory,
          uri: opened.viewerFile.primaryFile.uri,
        }),
      ).rejects.toThrow("historical viewer link has expired");
      await expect(
        store.resolveResource(
          opened.viewerFile.primaryFile.uri,
          sessionId,
          rootsRequestExtra(workspace),
        ),
      ).rejects.toThrow("historical viewer link has expired");
    } finally {
      await rm(workspace, { force: true, recursive: true });
    }
  });

  it("rejects tampering with the signed v2 file change time", async () => {
    const workspace = await mkdtemp(
      path.join(os.tmpdir(), "sequence-viewer-signed-ctime-test-"),
    );
    const stateDirectory = path.join(workspace, ".viewer-state");
    await writeFile(path.join(workspace, "family.fasta"), ">family\nACGT\n");
    try {
      const { uri } = (
        await createStore({ stateDirectory }).open(
          "family.fasta",
          rootsRequestExtra(workspace),
        )
      ).primaryFile;
      const token = uri.slice(`${RESOURCE_URI_PREFIX}/`.length);
      const recordPath = path.join(stateDirectory, `${token}.json`);
      const persisted = JSON.parse(await readFile(recordPath, "utf8"));
      persisted.fileIdentity.changedAtNanoseconds = (
        BigInt(persisted.fileIdentity.changedAtNanoseconds) + 1n
      ).toString();
      await writeFile(recordPath, `${JSON.stringify(persisted)}\n`);

      await expect(
        readPersistedResource({
          activeWorkspace: workspace,
          stateDirectory,
          uri,
        }),
      ).rejects.toThrow("historical viewer link has expired");
    } finally {
      await rm(workspace, { force: true, recursive: true });
    }
  });

  it("preserves digest-pinned v1 public handles and verifies them during session recovery", async () => {
    const workspace = await mkdtemp(
      path.join(os.tmpdir(), "sequence-viewer-verified-v1-test-"),
    );
    const stateDirectory = path.join(workspace, ".viewer-state");
    const filePath = path.join(workspace, "family.fasta");
    const originalContents = ">family\nACGT\n";
    const replacedContents = ">family\nTGCA\n";
    const stableTimestamp = new Date("2020-01-02T03:04:05.000Z");
    const sessionId = randomUUID();
    await writeFile(filePath, originalContents);
    await utimes(filePath, stableTimestamp, stableTimestamp);
    try {
      const originalStat = await stat(filePath, { bigint: true });
      const expected = {
        byteLength: Buffer.byteLength(originalContents),
        fileIdentity: {
          device: originalStat.dev.toString(),
          inode: originalStat.ino.toString(),
          modifiedAtNanoseconds: originalStat.mtimeNs.toString(),
          size: originalStat.size.toString(),
        },
        sha256: createHash("sha256").update(originalContents).digest("hex"),
      };
      const store = createStore({ stateDirectory });
      const opened = await store.openVerifiedWithSource(
        filePath,
        expected,
        rootsRequestExtra(workspace),
        sessionId,
      );
      await convertPersistedFixtureToLegacy({
        stateDirectory,
        uri: opened.viewerFile.primaryFile.uri,
      });

      await expect(
        readPersistedResource({
          activeWorkspace: workspace,
          stateDirectory,
          uri: opened.viewerFile.primaryFile.uri,
        }),
      ).resolves.toMatchObject({
        contents: [expect.objectContaining({ text: originalContents })],
      });
      await expect(
        store.resolveResource(
          opened.viewerFile.primaryFile.uri,
          sessionId,
          rootsRequestExtra(workspace),
        ),
      ).resolves.toMatchObject({
        sessionId,
        sourcePath: opened.sourcePath,
      });

      await writeFile(filePath, replacedContents);
      await utimes(filePath, stableTimestamp, stableTimestamp);
      const replacedStat = await stat(filePath, { bigint: true });
      expect(replacedStat.ino).toBe(originalStat.ino);
      expect(replacedStat.mtimeNs).toBe(originalStat.mtimeNs);
      expect(replacedStat.size).toBe(originalStat.size);
      expect(replacedStat.ctimeNs).not.toBe(originalStat.ctimeNs);

      await expect(
        readPersistedResource({
          activeWorkspace: workspace,
          stateDirectory,
          uri: opened.viewerFile.primaryFile.uri,
        }),
      ).rejects.toThrow("original file changed");
      await expect(
        store.resolveResource(
          opened.viewerFile.primaryFile.uri,
          sessionId,
          rootsRequestExtra(workspace),
        ),
      ).rejects.toThrow("moved or changed");
    } finally {
      await rm(workspace, { force: true, recursive: true });
    }
  });

  it("rejects source replacement and changed active roots during session recovery", async () => {
    const sandbox = await mkdtemp(
      path.join(os.tmpdir(), "sequence-viewer-session-drift-test-"),
    );
    const workspace = path.join(sandbox, "workspace");
    const other = path.join(sandbox, "other");
    const stateDirectory = path.join(sandbox, ".viewer-state");
    await mkdir(workspace);
    await mkdir(other);
    const sourcePath = path.join(workspace, "family.fasta");
    await writeFile(sourcePath, ">family\nACGT\n");
    const sessionId = randomUUID();
    try {
      const store = createStore({ stateDirectory });
      const opened = await store.openWithSource(
        "family.fasta",
        rootsRequestExtra(workspace),
        sessionId,
      );

      await expect(
        store.resolveResource(
          opened.viewerFile.primaryFile.uri,
          sessionId,
          rootsRequestExtra(other),
        ),
      ).rejects.toThrow("outside its active workspace");

      await rename(sourcePath, `${sourcePath}.old`);
      await writeFile(sourcePath, ">family\nTGCA\n");
      await expect(
        store.resolveResource(
          opened.viewerFile.primaryFile.uri,
          sessionId,
          rootsRequestExtra(workspace),
        ),
      ).rejects.toThrow("moved or changed");
    } finally {
      await rm(sandbox, { force: true, recursive: true });
    }
  });

  it("rejects expired session handles", async () => {
    const workspace = await mkdtemp(
      path.join(os.tmpdir(), "sequence-viewer-session-expiry-test-"),
    );
    const stateDirectory = path.join(workspace, ".viewer-state");
    const sourcePath = path.join(workspace, "family.fasta");
    await writeFile(sourcePath, ">family\nACGT\n");
    const sessionId = randomUUID();
    let now = Date.now();
    try {
      const store = createStore({ now: () => now, stateDirectory });
      const opened = await store.openWithSource(
        "family.fasta",
        rootsRequestExtra(workspace),
        sessionId,
      );

      now += THIRTY_DAYS_MS + 1;
      await expect(
        store.resolveResource(
          opened.viewerFile.primaryFile.uri,
          sessionId,
          rootsRequestExtra(workspace),
        ),
      ).rejects.toThrow("historical viewer link has expired");
    } finally {
      await rm(workspace, { force: true, recursive: true });
    }
  });

  it("rejects a tampered persisted path before reading it", async () => {
    const workspace = await mkdtemp(
      path.join(os.tmpdir(), "sequence-viewer-resource-test-"),
    );
    const stateDirectory = path.join(workspace, ".viewer-state");
    const filePath = path.join(workspace, "family.fasta");
    const outsideWorkspace = await mkdtemp(
      path.join(os.tmpdir(), "sequence-viewer-resource-outside-"),
    );
    const outsidePath = path.join(outsideWorkspace, "attacker-selected.fasta");
    await writeFile(filePath, ">family\nACGT\n");
    await writeFile(outsidePath, ">outside\nSECRET\n");
    try {
      const store = createStore({ stateDirectory });
      const { uri } = (
        await store.open("family.fasta", rootsRequestExtra(workspace))
      ).primaryFile;
      const persistedName = (await readdir(stateDirectory)).find((name) =>
        name.endsWith(".json"),
      );
      if (persistedName == null) {
        throw new Error("Expected a persisted viewer record.");
      }
      const persistedPath = path.join(stateDirectory, persistedName);
      const persisted = JSON.parse(await readFile(persistedPath, "utf8")) as {
        absolutePath: string;
      };
      persisted.absolutePath = outsidePath;
      await writeFile(persistedPath, `${JSON.stringify(persisted)}\n`);

      await expect(
        readPersistedResource({ stateDirectory, uri }),
      ).rejects.toThrow(HISTORICAL_VIEWER_FILE_ERROR_CODE);
    } finally {
      await rm(workspace, { force: true, recursive: true });
      await rm(outsideWorkspace, { force: true, recursive: true });
    }
  });

  it("does not mint handles for files outside active workspace roots", async () => {
    const sandbox = await mkdtemp(
      path.join(os.tmpdir(), "sequence-viewer-resource-test-"),
    );
    const workspace = path.join(sandbox, "workspace");
    const outsideDirectory = path.join(sandbox, "outside");
    const outsidePath = path.join(outsideDirectory, "outside.fasta");
    await Promise.all([mkdir(workspace), mkdir(outsideDirectory)]);
    await writeFile(outsidePath, ">outside\nACGT\n");
    try {
      const store = createStore({
        stateDirectory: path.join(sandbox, ".viewer-state"),
      });
      await expect(
        store.open("../outside/outside.fasta", rootsRequestExtra(workspace)),
      ).rejects.toThrow("not found inside the active local workspace roots");
      await expect(
        store.open(outsidePath, rootsRequestExtra(workspace)),
      ).rejects.toThrow("not found inside the active local workspace roots");
    } finally {
      await rm(sandbox, { force: true, recursive: true });
    }
  });

  it("fails closed when a relative source is ambiguous across workspace roots", async () => {
    const sandbox = await mkdtemp(
      path.join(os.tmpdir(), "sequence-viewer-resource-test-"),
    );
    const first = path.join(sandbox, "first");
    const second = path.join(sandbox, "second");
    await Promise.all([mkdir(first), mkdir(second)]);
    await Promise.all([
      writeFile(path.join(first, "family.fasta"), ">first\nAAAA\n"),
      writeFile(path.join(second, "family.fasta"), ">second\nCCCC\n"),
    ]);
    try {
      const store = createStore({
        stateDirectory: path.join(sandbox, ".viewer-state"),
      });
      await expect(
        store.open("family.fasta", rootsRequestExtra([first, second])),
      ).rejects.toThrow("multiple active workspace roots");
    } finally {
      await rm(sandbox, { force: true, recursive: true });
    }
  });

  it("revalidates active workspace roots after a restart", async () => {
    const workspace = await mkdtemp(
      path.join(os.tmpdir(), "sequence-viewer-resource-test-"),
    );
    const otherWorkspace = await mkdtemp(
      path.join(os.tmpdir(), "sequence-viewer-resource-other-"),
    );
    const stateDirectory = path.join(workspace, ".viewer-state");
    await writeFile(path.join(workspace, "family.fasta"), ">family\nACGT\n");
    try {
      const { uri } = (
        await createStore({ stateDirectory }).open(
          "family.fasta",
          rootsRequestExtra(workspace),
        )
      ).primaryFile;

      await expect(
        readPersistedResource({
          activeWorkspace: otherWorkspace,
          stateDirectory,
          uri,
        }),
      ).rejects.toThrow("outside the active workspace");
    } finally {
      await Promise.all([
        rm(workspace, { force: true, recursive: true }),
        rm(otherWorkspace, { force: true, recursive: true }),
      ]);
    }
  });

  it("rejects a changed deepest workspace-root binding", async () => {
    const workspace = await mkdtemp(
      path.join(os.tmpdir(), "sequence-viewer-resource-test-"),
    );
    const nestedWorkspace = path.join(workspace, "nested");
    const stateDirectory = path.join(workspace, ".viewer-state");
    await mkdir(nestedWorkspace);
    await writeFile(
      path.join(nestedWorkspace, "family.fasta"),
      ">family\nACGT\n",
    );
    try {
      const { uri } = (
        await createStore({ stateDirectory }).open(
          path.join(nestedWorkspace, "family.fasta"),
          rootsRequestExtra([workspace, nestedWorkspace]),
        )
      ).primaryFile;

      await expect(
        readPersistedResource({
          activeWorkspace: workspace,
          stateDirectory,
          uri,
        }),
      ).rejects.toThrow("outside the active workspace");
    } finally {
      await rm(workspace, { force: true, recursive: true });
    }
  });

  it("expires persisted handles after the retention window", async () => {
    const workspace = await mkdtemp(
      path.join(os.tmpdir(), "sequence-viewer-resource-test-"),
    );
    const stateDirectory = path.join(workspace, ".viewer-state");
    await writeFile(path.join(workspace, "family.fasta"), ">family\nACGT\n");
    try {
      const { uri } = (
        await createStore({
          now: () => 10_000,
          stateDirectory,
        }).open("family.fasta", rootsRequestExtra(workspace))
      ).primaryFile;

      await expect(
        readPersistedResource({
          activeWorkspace: workspace,
          now: () => 10_000 + THIRTY_DAYS_MS + 1,
          stateDirectory,
          uri,
        }),
      ).rejects.toThrow("historical viewer link has expired");
      expect(
        (await readdir(stateDirectory)).filter((name) =>
          name.endsWith(".json"),
        ),
      ).toHaveLength(0);
    } finally {
      await rm(workspace, { force: true, recursive: true });
    }
  });

  it("retires signed historical bundled cards without reading their source", async () => {
    const workspace = await mkdtemp(
      path.join(os.tmpdir(), "sequence-viewer-resource-test-"),
    );
    const stateDirectory = path.join(workspace, ".viewer-state");
    await writeFile(path.join(workspace, "family.fasta"), ">family\nACGT\n");
    try {
      const { uri } = (
        await createStore({ stateDirectory }).open(
          "family.fasta",
          rootsRequestExtra(workspace),
        )
      ).primaryFile;
      const persistedName = (await readdir(stateDirectory)).find((name) =>
        name.endsWith(".json"),
      );
      if (persistedName == null) throw new Error("Missing persisted record.");
      const persistedPath = path.join(stateDirectory, persistedName);
      const persisted = JSON.parse(await readFile(persistedPath, "utf8"));
      persisted.bundled = true;
      persisted.workspaceRoot = null;
      const key = await readFile(path.join(stateDirectory, "signing-key"));
      persisted.signature = signPersistedFixture(persisted, key);
      await writeFile(persistedPath, `${JSON.stringify(persisted)}\n`);

      await expect(
        readPersistedResource({
          activeWorkspace: workspace,
          stateDirectory,
          uri,
        }),
      ).rejects.toThrow("Bundled example cards are retired");
    } finally {
      await rm(workspace, { force: true, recursive: true });
    }
  });

  it("verifies an expected public-source digest before persisting and supports rollback", async () => {
    const workspace = await mkdtemp(
      path.join(os.tmpdir(), "sequence-viewer-resource-test-"),
    );
    const stateDirectory = path.join(workspace, ".viewer-state");
    const filePath = path.join(workspace, "family.fasta");
    const contents = ">family\nACGT\n";
    await writeFile(filePath, contents);
    try {
      const fileStat = await stat(filePath, { bigint: true });
      const expected = {
        byteLength: Buffer.byteLength(contents),
        fileIdentity: {
          device: fileStat.dev.toString(),
          inode: fileStat.ino.toString(),
          modifiedAtNanoseconds: fileStat.mtimeNs.toString(),
          size: fileStat.size.toString(),
        },
        sha256: createHash("sha256").update(contents).digest("hex"),
      };
      const store = createStore({ stateDirectory });
      await expect(
        store.openVerifiedWithSource(
          filePath,
          { ...expected, sha256: "0".repeat(64) },
          rootsRequestExtra(workspace),
        ),
      ).rejects.toThrow("changed before it could be opened");
      await expect(readdir(stateDirectory)).rejects.toMatchObject({
        code: "ENOENT",
      });

      const opened = await store.openVerifiedWithSource(
        filePath,
        expected,
        rootsRequestExtra(workspace),
      );
      expect(
        (await readdir(stateDirectory)).filter((name) =>
          name.endsWith(".json"),
        ),
      ).toHaveLength(1);
      const persistedName = (await readdir(stateDirectory)).find((name) =>
        name.endsWith(".json"),
      );
      if (persistedName == null) throw new Error("Missing persisted record.");
      const persistedPath = path.join(stateDirectory, persistedName);
      const persisted = JSON.parse(await readFile(persistedPath, "utf8"));
      expect(persisted.expectedSha256).toBe(expected.sha256);
      const resource = await readPersistedResource({
        activeWorkspace: workspace,
        stateDirectory,
        uri: opened.viewerFile.primaryFile.uri,
      });
      expect(resource.contents).toEqual([
        expect.objectContaining({ text: contents }),
      ]);
      persisted.expectedSha256 = "f".repeat(64);
      await writeFile(persistedPath, `${JSON.stringify(persisted)}\n`);
      await expect(
        readPersistedResource({
          activeWorkspace: workspace,
          stateDirectory,
          uri: opened.viewerFile.primaryFile.uri,
        }),
      ).rejects.toThrow("historical viewer link has expired");
      await opened.discard();
      await opened.discard();
      expect(
        (await readdir(stateDirectory)).filter((name) =>
          name.endsWith(".json"),
        ),
      ).toHaveLength(0);
    } finally {
      await rm(workspace, { force: true, recursive: true });
    }
  });

  it("rejects a verified public source rewritten at the same size with its mtime restored", async () => {
    const workspace = await mkdtemp(
      path.join(os.tmpdir(), "sequence-viewer-resource-test-"),
    );
    const stateDirectory = path.join(workspace, ".viewer-state");
    const filePath = path.join(workspace, "family.fasta");
    const originalContents = ">family\nACGT\n";
    const replacedContents = ">family\nTGCA\n";
    const stableTimestamp = new Date("2020-01-02T03:04:05.000Z");
    await writeFile(filePath, originalContents);
    await utimes(filePath, stableTimestamp, stableTimestamp);
    try {
      const originalStat = await stat(filePath, { bigint: true });
      const expected = {
        byteLength: Buffer.byteLength(originalContents),
        fileIdentity: {
          device: originalStat.dev.toString(),
          inode: originalStat.ino.toString(),
          modifiedAtNanoseconds: originalStat.mtimeNs.toString(),
          size: originalStat.size.toString(),
        },
        sha256: createHash("sha256").update(originalContents).digest("hex"),
      };
      const opened = await createStore({
        stateDirectory,
      }).openVerifiedWithSource(
        filePath,
        expected,
        rootsRequestExtra(workspace),
      );
      const persistedName = (await readdir(stateDirectory)).find((name) =>
        name.endsWith(".json"),
      );
      if (persistedName == null) throw new Error("Missing persisted record.");
      const persisted = JSON.parse(
        await readFile(path.join(stateDirectory, persistedName), "utf8"),
      );
      expect(persisted.expectedSha256).toBe(expected.sha256);

      await writeFile(filePath, replacedContents);
      await utimes(filePath, stableTimestamp, stableTimestamp);
      const replacedStat = await stat(filePath, { bigint: true });
      expect({
        device: replacedStat.dev.toString(),
        inode: replacedStat.ino.toString(),
        modifiedAtNanoseconds: replacedStat.mtimeNs.toString(),
        size: replacedStat.size.toString(),
      }).toEqual(expected.fileIdentity);

      await expect(
        readPersistedResource({
          activeWorkspace: workspace,
          stateDirectory,
          uri: opened.viewerFile.primaryFile.uri,
        }),
      ).rejects.toThrow(
        "The original file changed since this viewer card was created",
      );
    } finally {
      await rm(workspace, { force: true, recursive: true });
    }
  });

  it("removes a newly signed handle when post-write pruning fails", async () => {
    const workspace = await mkdtemp(
      path.join(os.tmpdir(), "sequence-viewer-resource-test-"),
    );
    const stateDirectory = path.join(workspace, ".viewer-state");
    await writeFile(path.join(workspace, "family.fasta"), ">family\nACGT\n");
    const failingPersistedLimit = {
      valueOf() {
        throw new Error("injected prune failure");
      },
    } as unknown as number;
    try {
      const store = createChatFileResourceStore({
        isSupportedFileName: (fileName) => fileName.endsWith(".fasta"),
        maxPersistedFiles: failingPersistedLimit,
        resourceUriPrefix: RESOURCE_URI_PREFIX,
        stateDirectory,
        viewerName: "sequence viewer",
      });
      await expect(
        store.open("family.fasta", rootsRequestExtra(workspace)),
      ).rejects.toThrow("could not securely save this file handle");
      expect(
        (await readdir(stateDirectory)).filter((name) =>
          name.endsWith(".json"),
        ),
      ).toHaveLength(0);
    } finally {
      await rm(workspace, { force: true, recursive: true });
    }
  });

  it("reports moved and changed source files explicitly", async () => {
    const workspace = await mkdtemp(
      path.join(os.tmpdir(), "sequence-viewer-resource-test-"),
    );
    const stateDirectory = path.join(workspace, ".viewer-state");
    const changedPath = path.join(workspace, "changed.fasta");
    const movedPath = path.join(workspace, "moved.fasta");
    await Promise.all([
      writeFile(changedPath, ">changed\nACGT\n"),
      writeFile(movedPath, ">moved\nACGT\n"),
    ]);
    try {
      const store = createStore({ stateDirectory });
      const changedUri = (
        await store.open("changed.fasta", rootsRequestExtra(workspace))
      ).primaryFile.uri;
      const movedUri = (
        await store.open("moved.fasta", rootsRequestExtra(workspace))
      ).primaryFile.uri;

      await writeFile(changedPath, ">changed\nACGTACGT\n");
      await rename(movedPath, path.join(workspace, "new-name.fasta"));

      await expect(
        readPersistedResource({
          activeWorkspace: workspace,
          stateDirectory,
          uri: changedUri,
        }),
      ).rejects.toThrow("file changed");
      await expect(
        readPersistedResource({
          activeWorkspace: workspace,
          stateDirectory,
          uri: movedUri,
        }),
      ).rejects.toThrow("moved or deleted");
    } finally {
      await rm(workspace, { force: true, recursive: true });
    }
  });

  it("rejects oversized files before persisting or materializing their contents", async () => {
    const workspace = await mkdtemp(
      path.join(os.tmpdir(), "sequence-viewer-resource-test-"),
    );
    const stateDirectory = path.join(workspace, ".viewer-state");
    await writeFile(
      path.join(workspace, "large.fasta"),
      `>large\n${"A".repeat(64)}\n`,
    );
    try {
      await expect(
        createStore({ maxFileBytes: 32, stateDirectory }).open(
          "large.fasta",
          rootsRequestExtra(workspace),
        ),
      ).rejects.toThrow("accepts at most 32 B");
      await expect(readdir(stateDirectory)).rejects.toMatchObject({
        code: "ENOENT",
      });
    } finally {
      await rm(workspace, { force: true, recursive: true });
    }
  });

  it("keeps oversized workspace FASTA handles signed, opaque, and inaccessible to generic resources", async () => {
    const workspace = await mkdtemp(
      path.join(os.tmpdir(), "sequence-viewer-range-only-test-"),
    );
    const stateDirectory = path.join(workspace, ".viewer-state");
    await writeFile(
      path.join(workspace, "large.fasta"),
      `>large\n${"A".repeat(192)}\n`,
    );
    const store = createChatFileResourceStore({
      isSupportedFileName: () => true,
      maxFileBytes: 32,
      maxIndexedFileBytes: 128,
      maxRangedFileBytes: 256,
      resourceUriPrefix: RESOURCE_URI_PREFIX,
      stateDirectory,
      viewerName: "sequence viewer",
    });

    try {
      const opened = await store.openWithSource(
        "large.fasta",
        rootsRequestExtra(workspace),
      );
      expect(opened.rangeOnly).toBe(true);
      expect(opened.workspaceBacked).toBe(true);
      expect(JSON.stringify(opened.viewerFile)).not.toContain(workspace);
      await expect(
        readPersistedResource({
          activeWorkspace: workspace,
          stateDirectory,
          store,
          uri: opened.viewerFile.primaryFile.uri,
        }),
      ).rejects.toThrow("bounded, app-only range tools");

      const recordName = (await readdir(stateDirectory)).find((name) =>
        name.endsWith(".json"),
      );
      if (recordName == null)
        throw new Error("Missing signed range-only record.");
      const recordPath = path.join(stateDirectory, recordName);
      const record = JSON.parse(await readFile(recordPath, "utf8")) as {
        rangeOnly?: true;
      };
      expect(record.rangeOnly).toBe(true);
      delete record.rangeOnly;
      await writeFile(recordPath, JSON.stringify(record));
      await expect(
        readPersistedResource({
          activeWorkspace: workspace,
          stateDirectory,
          store,
          uri: opened.viewerFile.primaryFile.uri,
        }),
      ).rejects.toThrow("historical viewer link has expired");
    } finally {
      await rm(workspace, { force: true, recursive: true });
    }
  });

  it("reauthorizes signed range-only sessions without reading the whole source", async () => {
    const workspace = await mkdtemp(
      path.join(os.tmpdir(), "sequence-viewer-range-session-test-"),
    );
    const stateDirectory = path.join(workspace, ".viewer-state");
    await writeFile(
      path.join(workspace, "large.fasta"),
      `>large\n${"A".repeat(192)}\n`,
    );
    const store = createChatFileResourceStore({
      isSupportedFileName: () => true,
      maxFileBytes: 32,
      maxIndexedFileBytes: 128,
      maxRangedFileBytes: 256,
      resourceUriPrefix: RESOURCE_URI_PREFIX,
      stateDirectory,
      viewerName: "sequence viewer",
    });
    const sessionId = randomUUID();

    try {
      const opened = await store.openWithSource(
        "large.fasta",
        rootsRequestExtra(workspace),
        sessionId,
      );
      await expect(
        store.resolveResource(
          opened.viewerFile.primaryFile.uri,
          sessionId,
          rootsRequestExtra(workspace),
        ),
      ).resolves.toEqual({
        rangeOnly: true,
        sessionId,
        sourcePath: opened.sourcePath,
        workspaceBacked: true,
        workspaceRoot: path.dirname(opened.sourcePath),
      });
      await expect(
        readPersistedResource({
          activeWorkspace: workspace,
          stateDirectory,
          store,
          uri: opened.viewerFile.primaryFile.uri,
        }),
      ).rejects.toThrow("bounded, app-only range tools");
    } finally {
      await rm(workspace, { force: true, recursive: true });
    }
  });

  it("selects only workspace-backed indexable inputs above the native direct-text threshold", async () => {
    const sandbox = await mkdtemp(
      path.join(os.tmpdir(), "sequence-viewer-native-index-test-"),
    );
    const workspace = path.join(sandbox, "workspace");
    const outside = path.join(sandbox, "outside");
    const stateDirectory = path.join(sandbox, ".viewer-state");
    await Promise.all([mkdir(workspace), mkdir(outside)]);
    await Promise.all([
      writeFile(path.join(workspace, "exact.fasta"), Buffer.alloc(32, "A")),
      writeFile(path.join(workspace, "large.fastq"), Buffer.alloc(33, "A")),
      writeFile(
        path.join(workspace, "too-large.fasta"),
        Buffer.alloc(129, "A"),
      ),
      writeFile(path.join(workspace, "large.gb"), Buffer.alloc(64, "A")),
      writeFile(path.join(outside, "outside.fasta"), Buffer.alloc(64, "A")),
    ]);
    const store = createChatFileResourceStore({
      isSupportedFileName: () => true,
      maxFileBytes: 32,
      maxIndexedFileBytes: 128,
      resourceUriPrefix: RESOURCE_URI_PREFIX,
      stateDirectory,
      viewerName: "sequence viewer",
    });
    try {
      await expect(
        store.openIndexedWorkspaceFile(
          path.join(workspace, "exact.fasta"),
          rootsRequestExtra(workspace),
          32,
        ),
      ).resolves.toBeNull();
      await expect(
        store.openIndexedWorkspaceFile(
          path.join(workspace, "large.gb"),
          rootsRequestExtra(workspace),
          32,
        ),
      ).resolves.toBeNull();
      await expect(
        store.openIndexedWorkspaceFile(
          path.join(outside, "outside.fasta"),
          rootsRequestExtra(workspace),
          32,
        ),
      ).resolves.toBeNull();
      await expect(
        store.openIndexedWorkspaceFile(
          path.join(workspace, "large.fastq"),
          { sendRequest: async () => Promise.reject(new Error("no roots")) },
          32,
        ),
      ).resolves.toBeNull();

      const opened = await store.openIndexedWorkspaceFile(
        path.join(workspace, "large.fastq"),
        rootsRequestExtra(workspace),
        32,
      );
      expect(opened).toMatchObject({
        viewerFile: {
          primaryFile: {
            name: "large.fastq",
            uri: expect.stringMatching(
              /^viewer-file:\/\/sequence-viewer\/opened\/[0-9a-f-]{36}$/,
            ),
          },
        },
        workspaceBacked: true,
      });
      expect(JSON.stringify(opened?.viewerFile)).not.toContain(workspace);
      await expect(
        store.openIndexedWorkspaceFile(
          path.join(workspace, "too-large.fasta"),
          rootsRequestExtra(workspace),
          32,
        ),
      ).rejects.toThrow("accepts at most 128 B");
    } finally {
      await rm(sandbox, { force: true, recursive: true });
    }
  });

  it.each(["gz", "bgz", "bgzf", "bgzip"] as const)(
    "streams %s-compressed FASTA into a bounded indexed envelope",
    async (extension) => {
      const workspace = await mkdtemp(
        path.join(os.tmpdir(), "sequence-viewer-resource-test-"),
      );
      const stateDirectory = path.join(workspace, ".viewer-state");
      const source = ">alpha first\nACGT\n>beta\nTTTT\n";
      const fileName = `family.fasta.${extension}`;
      await writeFile(path.join(workspace, fileName), gzipSync(source));
      try {
        const store = createStore({ stateDirectory });
        const opened = await store.openIndexedWorkspaceFile(
          fileName,
          rootsRequestExtra(workspace),
          1,
        );
        if (opened == null) throw new Error("Expected an indexed gzip handle.");
        const { uri } = opened.viewerFile.primaryFile;
        const resource = await readPersistedResource({
          activeWorkspace: workspace,
          stateDirectory,
          uri,
        });
        const text = resource.contents.flatMap((item) =>
          "text" in item ? [item.text] : [],
        )[0];
        const envelope = parseIndexedSequenceEnvelope(text ?? "");
        expect(envelope?.index).toMatchObject({
          complete: true,
          compressed: true,
          indexedRecordCount: 2,
          materializedRecordCount: 2,
        });
        expect(envelope?.document.records.map(({ id }) => id)).toEqual([
          "alpha",
          "beta",
        ]);
      } finally {
        await rm(workspace, { force: true, recursive: true });
      }
    },
  );

  it("streams BGZF-suffixed FASTQ and restores exact genuine qualities", async () => {
    const workspace = await mkdtemp(
      path.join(os.tmpdir(), "sequence-viewer-resource-test-"),
    );
    const stateDirectory = path.join(workspace, ".viewer-state");
    const source = "@read-1 first\nACGT\n+\n!!!!\n";
    await writeFile(path.join(workspace, "reads.fastq.bgzf"), gzipSync(source));
    try {
      const store = createStore({ stateDirectory });
      const opened = await store.openIndexedWorkspaceFile(
        "reads.fastq.bgzf",
        rootsRequestExtra(workspace),
        1,
      );
      if (opened == null) {
        throw new Error("Expected an indexed compressed FASTQ handle.");
      }
      const resource = await readPersistedResource({
        activeWorkspace: workspace,
        stateDirectory,
        uri: opened.viewerFile.primaryFile.uri,
      });
      const text = resource.contents.flatMap((item) =>
        "text" in item ? [item.text] : [],
      )[0];
      const envelope = parseIndexedSequenceEnvelope(text ?? "");
      expect(envelope?.index).toMatchObject({
        complete: true,
        compressed: true,
        indexedRecordCount: 1,
      });
      expect(envelope?.document).toMatchObject({
        format: "fastq",
        records: [
          {
            id: "read-1",
            sequence: "ACGT",
            quality: { ascii: "!!!!", phred: [0, 0, 0, 0] },
          },
        ],
      });
    } finally {
      await rm(workspace, { force: true, recursive: true });
    }
  });

  it("bounds decoded gzip bytes before scanning an indexed FASTA", async () => {
    const workspace = await mkdtemp(
      path.join(os.tmpdir(), "sequence-viewer-resource-test-"),
    );
    const stateDirectory = path.join(workspace, ".viewer-state");
    await writeFile(
      path.join(workspace, "expanded.fasta.gz"),
      gzipSync(`>expanded\n${"A".repeat(4_096)}\n`),
    );
    try {
      const store = createChatFileResourceStore({
        isSupportedFileName: (fileName) => fileName.endsWith(".fasta.gz"),
        maxFileBytes: 32,
        maxIndexedFileBytes: 128,
        resourceUriPrefix: RESOURCE_URI_PREFIX,
        stateDirectory,
        viewerName: "sequence viewer",
      });
      const { uri } = (
        await store.open("expanded.fasta.gz", rootsRequestExtra(workspace))
      ).primaryFile;

      await expect(
        readPersistedResource({
          activeWorkspace: workspace,
          stateDirectory,
          store,
          uri,
        }),
      ).rejects.toThrow("expands beyond the bounded viewer limit of 128 B");
    } finally {
      await rm(workspace, { force: true, recursive: true });
    }
  });

  it("bounds gzip expansion before materializing non-indexed text", async () => {
    const workspace = await mkdtemp(
      path.join(os.tmpdir(), "sequence-viewer-resource-test-"),
    );
    const stateDirectory = path.join(workspace, ".viewer-state");
    await writeFile(
      path.join(workspace, "expanded.gb.gz"),
      gzipSync("A".repeat(4_096)),
    );
    try {
      const store = createChatFileResourceStore({
        isSupportedFileName: (fileName) => fileName.endsWith(".gb.gz"),
        maxCompressedFileBytes: 1_024,
        maxFileBytes: 32,
        resourceUriPrefix: RESOURCE_URI_PREFIX,
        stateDirectory,
        viewerName: "sequence viewer",
      });
      const { uri } = (
        await store.open("expanded.gb.gz", rootsRequestExtra(workspace))
      ).primaryFile;

      await expect(
        readPersistedResource({
          activeWorkspace: workspace,
          stateDirectory,
          store,
          uri,
        }),
      ).rejects.toThrow("expands beyond the bounded viewer limit of 32 B");
    } finally {
      await rm(workspace, { force: true, recursive: true });
    }
  });
});

function createStore({
  maxFileBytes,
  maxPersistedFiles,
  now,
  stateDirectory,
}: {
  maxFileBytes?: number;
  maxPersistedFiles?: number;
  now?: () => number;
  stateDirectory: string;
}) {
  return createChatFileResourceStore({
    isSupportedFileName: (fileName) =>
      /\.(?:fasta|fastq|ffn|ab1|abi|scf|dna)(?:\.(?:bgz|bgzf|bgzip|gz))?$/iu.test(fileName),
    maxFileBytes,
    maxPersistedFiles,
    now,
    resourceUriPrefix: RESOURCE_URI_PREFIX,
    stateDirectory,
    viewerName: "sequence viewer",
  });
}

function rootsRequestExtra(workspace: string | Array<string>) {
  const workspaces = Array.isArray(workspace) ? workspace : [workspace];
  return {
    sendRequest: async () => ({
      roots: workspaces.map((root) => ({ uri: pathToFileURL(root).href })),
    }),
  };
}

async function readPersistedResource({
  activeWorkspace,
  now,
  requestMetadata,
  stateDirectory,
  store,
  uri,
}: {
  activeWorkspace?: string;
  now?: () => number;
  requestMetadata?: Record<string, unknown>;
  stateDirectory: string;
  store?: ReturnType<typeof createChatFileResourceStore>;
  uri: string;
}) {
  const client = new Client(
    { name: "sequence-viewer-resource-test", version: "0.1.0" },
    activeWorkspace == null ? undefined : { capabilities: { roots: {} } },
  );
  if (activeWorkspace != null) {
    client.setRequestHandler(ListRootsRequestSchema, async () => ({
      roots: [{ uri: pathToFileURL(activeWorkspace).href }],
    }));
  }
  const server = new McpServer({
    name: "sequence-viewer-resource-test",
    version: "0.1.0",
  });
  (store ?? createStore({ now, stateDirectory })).register(server);
  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair();
  await Promise.all([
    client.connect(clientTransport),
    server.connect(serverTransport),
  ]);
  try {
    return await client.readResource({
      ...(requestMetadata == null ? {} : { _meta: requestMetadata }),
      uri,
    });
  } finally {
    await client.close();
    await server.close();
  }
}

function signPersistedFixture(
  payload: {
    absolutePath: string;
    bundled?: true;
    expectedSha256?: string;
    fileIdentity: {
      changedAtNanoseconds?: string;
      device: string;
      inode: string;
      modifiedAtNanoseconds: string;
      size: string;
    };
    name: string;
    openedAt: number;
    rangeOnly?: true;
    sessionId?: string;
    token: string;
    version: number;
    workspaceRoot: string | null;
  },
  key: Buffer,
): string {
  return createHmac("sha256", key)
    .update(
      JSON.stringify({
        absolutePath: payload.absolutePath,
        bundled: payload.bundled,
        expectedSha256: payload.expectedSha256,
        fileIdentity: payload.fileIdentity,
        name: payload.name,
        openedAt: payload.openedAt,
        ...(payload.rangeOnly ? { rangeOnly: true } : {}),
        ...(payload.sessionId == null ? {} : { sessionId: payload.sessionId }),
        token: payload.token,
        version: payload.version,
        workspaceRoot: payload.workspaceRoot,
      }),
    )
    .digest("base64url");
}

async function convertPersistedFixtureToLegacy({
  stateDirectory,
  uri,
}: {
  stateDirectory: string;
  uri: string;
}): Promise<void> {
  const token = uri.slice(`${RESOURCE_URI_PREFIX}/`.length);
  const recordPath = path.join(stateDirectory, `${token}.json`);
  const persisted = JSON.parse(await readFile(recordPath, "utf8"));
  const { changedAtNanoseconds: _changedAtNanoseconds, ...legacyIdentity } =
    persisted.fileIdentity;
  const legacy = {
    ...persisted,
    fileIdentity: legacyIdentity,
    version: 1,
  };
  const key = await readFile(path.join(stateDirectory, "signing-key"));
  legacy.signature = signPersistedFixture(legacy, key);
  await writeFile(recordPath, `${JSON.stringify(legacy)}\n`);
}
