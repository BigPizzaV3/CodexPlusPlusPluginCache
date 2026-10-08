import { createHash, randomUUID } from "node:crypto";
import {
  link,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rename,
  rm,
  stat,
  symlink,
  utimes,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { afterEach, describe, expect, it } from "vitest";

import {
  readWorkspaceFileBytes,
  type RootsRequestExtra,
} from "./chat-file-resource";
import type { SequenceWorkbenchPayloadDeclaration } from "./workbench-persistence-protocol";
import { SequenceWorkspaceExportPublisher } from "./workspace-export-publisher";

const temporaryDirectories: Array<string> = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { force: true, recursive: true })),
  );
});

describe("SequenceWorkspaceExportPublisher", () => {
  it("publishes exact bytes and path-free provenance beside the opened source", async () => {
    const fixture = await createFixture();
    const publisher = new SequenceWorkspaceExportPublisher({
      now: () => 1_750_000_000_000,
    });
    await expect(
      publisher.bindSession(
        fixture.sessionId,
        fixture.sourcePath,
        fixture.extra,
      ),
    ).resolves.toBe(true);
    const content = ">visible\nACGT\n";
    const declaration = workspaceDeclaration(content, fixture.sessionId, {
      relativePath: "exports/family-visible.fasta",
    });
    const plan = await publisher.prepare(declaration);
    if (plan == null) throw new Error("Expected workspace plan.");
    const result = await publisher.publish(
      plan,
      Buffer.from(content),
      declaration.sha256,
      new AbortController().signal,
    );

    expect(result).toEqual({
      destination: { base: "opened-source", kind: "workspace" },
      format: "fasta",
      mediaType: "text/x-fasta",
      name: "family-visible.fasta",
      outputWorkspacePath: "data/exports/family-visible.fasta",
      provenanceWorkspacePath:
        "data/exports/family-visible.fasta.provenance.json",
      sha256: declaration.sha256,
      size: Buffer.byteLength(content),
      version: 1,
    });
    await expect(
      readFile(
        path.join(fixture.projectRoot, result.outputWorkspacePath),
        "utf8",
      ),
    ).resolves.toBe(content);
    const provenance = await readFile(
      path.join(fixture.projectRoot, result.provenanceWorkspacePath),
      "utf8",
    );
    expect(provenance).toContain('"workspacePath": "data/family.aln-fasta"');
    expect(provenance).toContain(`"sha256": "${declaration.sha256}"`);
    expect(provenance).not.toContain(fixture.directory);
    await expect(readFile(fixture.sourcePath, "utf8")).resolves.toBe(
      fixture.sourceContent,
    );
    const reopened = await readWorkspaceFileBytes({
      extra: fixture.extra,
      filePath: result.outputWorkspacePath,
      isSupportedFileName: (fileName) => fileName.endsWith(".fasta"),
      maxFileBytes: 1_024 * 1_024,
      viewerName: "biological sequence viewer",
    });
    expect(reopened.name).toBe("family-visible.fasta");
    expect(reopened.bytes.toString("utf8")).toBe(content);
    await expect(
      publisher.revalidateCompleted(plan, result),
    ).resolves.toBeUndefined();
    await writeFile(plan.provenancePath, "{}\n");
    await expect(publisher.revalidateCompleted(plan, result)).rejects.toThrow(
      "changed after publication",
    );
  });

  it("allows parent traversal only inside the deepest bound workspace root", async () => {
    const fixture = await createFixture();
    const publisher = new SequenceWorkspaceExportPublisher();
    await publisher.bindSession(
      fixture.sessionId,
      fixture.sourcePath,
      rootsExtra([fixture.directory, fixture.projectRoot]),
    );
    const content = "motif\tstart\tend\nA\t1\t4\n";
    const declaration = workspaceDeclaration(content, fixture.sessionId, {
      format: "tsv",
      mediaType: "text/tab-separated-values",
      relativePath: "../results/motif-hits.tsv",
    });
    const plan = await publisher.prepare(declaration);
    if (plan == null) throw new Error("Expected workspace plan.");
    const result = await publisher.publish(
      plan,
      Buffer.from(content),
      declaration.sha256,
      new AbortController().signal,
    );
    expect(result.outputWorkspacePath).toBe("results/motif-hits.tsv");
    await expect(
      readFile(
        path.join(fixture.projectRoot, "results/motif-hits.tsv"),
        "utf8",
      ),
    ).resolves.toBe(content);
  });

  it("fails closed without roots or a source inside the active roots", async () => {
    const fixture = await createFixture();
    const publisher = new SequenceWorkspaceExportPublisher();
    await expect(
      publisher.bindSession(
        fixture.sessionId,
        fixture.sourcePath,
        rootsExtra([]),
      ),
    ).resolves.toBe(false);
    await expect(
      publisher.prepare(workspaceDeclaration(">x\nA\n", fixture.sessionId)),
    ).rejects.toThrow("trusted file metadata");

    const outside = await temporaryDirectory();
    const outsideSource = path.join(outside, "outside.fasta");
    await writeFile(outsideSource, ">outside\nA\n");
    await expect(
      publisher.bindSession(fixture.sessionId, outsideSource, fixture.extra),
    ).resolves.toBe(false);
  });

  it("invalidates a source binding when its exact workspace root is no longer active", async () => {
    const fixture = await createFixture();
    const activeRoots = [fixture.projectRoot];
    const extra = rootsExtra(activeRoots);
    const publisher = new SequenceWorkspaceExportPublisher();
    await expect(
      publisher.bindSession(fixture.sessionId, fixture.sourcePath, extra),
    ).resolves.toBe(true);
    const bindingId = await publisher.preflight(
      {
        destination: {
          base: "opened-source",
          kind: "workspace",
          relativePath: "exports/active-root.fasta",
        },
        format: "fasta",
        name: "active-root.fasta",
        sessionId: fixture.sessionId,
      },
      extra,
    );

    activeRoots.splice(0);
    await expect(
      publisher.assertSourceBinding(fixture.sessionId, bindingId, extra),
    ).rejects.toThrow("same active workspace root");
  });

  it("rechecks the active root inside the atomic publication lifecycle", async () => {
    const fixture = await createFixture();
    const activeRoots = [fixture.projectRoot];
    const extra = rootsExtra(activeRoots);
    const publisher = new SequenceWorkspaceExportPublisher({
      atomicHooks: {
        beforeArtifactLink: () => {
          activeRoots.splice(0);
        },
      },
    });
    await publisher.bindSession(fixture.sessionId, fixture.sourcePath, extra);
    const content = ">out\nAC\n";
    const declaration = workspaceDeclaration(content, fixture.sessionId);
    const plan = await publisher.prepare(
      declaration,
      new AbortController().signal,
      extra,
    );
    if (plan == null) throw new Error("Expected workspace plan.");

    await expect(
      publisher.publish(
        plan,
        Buffer.from(content),
        declaration.sha256,
        new AbortController().signal,
        extra,
      ),
    ).rejects.toThrow("same active workspace root");
    await expect(readFile(plan.outputPath)).rejects.toMatchObject({
      code: "ENOENT",
    });
    await expect(readFile(plan.provenancePath)).rejects.toMatchObject({
      code: "ENOENT",
    });
  });

  it("rejects escape, missing or linked parents, collisions, and format mismatches", async () => {
    const fixture = await createFixture();
    const publisher = new SequenceWorkspaceExportPublisher();
    await publisher.bindSession(
      fixture.sessionId,
      fixture.sourcePath,
      fixture.extra,
    );

    await expect(
      publisher.prepare(
        workspaceDeclaration(">x\nA\n", fixture.sessionId, {
          relativePath: "../../../escape.fasta",
        }),
      ),
    ).rejects.toThrow("escapes");
    await expect(
      publisher.prepare(
        workspaceDeclaration(">x\nA\n", fixture.sessionId, {
          relativePath: "missing/export.fasta",
        }),
      ),
    ).rejects.toThrow("must already exist");
    await expect(
      publisher.prepare(
        workspaceDeclaration(">x\nA\n", fixture.sessionId, {
          relativePath: "exports/export.csv",
        }),
      ),
    ).rejects.toThrow("does not match fasta");

    const existing = path.join(
      fixture.projectRoot,
      "data/exports/existing.fasta",
    );
    await writeFile(existing, "sentinel");
    await expect(
      publisher.prepare(
        workspaceDeclaration(">x\nA\n", fixture.sessionId, {
          relativePath: "exports/existing.fasta",
        }),
      ),
    ).rejects.toThrow("already exists");

    const linked = path.join(fixture.projectRoot, "data/linked");
    await symlink(
      path.resolve(fixture.projectRoot, "results"),
      linked,
      process.platform === "win32" ? "junction" : "dir",
    );
    await expect(
      publisher.prepare(
        workspaceDeclaration(">x\nA\n", fixture.sessionId, {
          relativePath: "linked/export.fasta",
        }),
      ),
    ).rejects.toThrow(/symbolic links|junctions/u);
  });

  it("detects source changes and leaves no partial pair", async () => {
    const fixture = await createFixture();
    let mutate = false;
    const publisher = new SequenceWorkspaceExportPublisher({
      atomicHooks: {
        beforeArtifactLink: async () => {
          if (mutate) await writeFile(fixture.sourcePath, ">changed\nTT\n");
        },
      },
    });
    await publisher.bindSession(
      fixture.sessionId,
      fixture.sourcePath,
      fixture.extra,
    );
    const declaration = workspaceDeclaration(">out\nAA\n", fixture.sessionId);
    const plan = await publisher.prepare(declaration);
    if (plan == null) throw new Error("Expected workspace plan.");
    mutate = true;
    await expect(
      publisher.publish(
        plan,
        Buffer.from(">out\nAA\n"),
        declaration.sha256,
        new AbortController().signal,
      ),
    ).rejects.toThrow("changed");
    await expect(readFile(plan.outputPath)).rejects.toMatchObject({
      code: "ENOENT",
    });
    await expect(readFile(plan.provenancePath)).rejects.toMatchObject({
      code: "ENOENT",
    });
  });

  it("detects an in-place source rewrite even when size and mtime are restored", async () => {
    const fixture = await createFixture();
    const publisher = new SequenceWorkspaceExportPublisher();
    await publisher.bindSession(
      fixture.sessionId,
      fixture.sourcePath,
      fixture.extra,
    );
    const declaration = workspaceDeclaration(">out\nAA\n", fixture.sessionId);
    const plan = await publisher.prepare(declaration);
    if (plan == null) throw new Error("Expected workspace plan.");
    const originalStat = await stat(fixture.sourcePath);
    await writeFile(fixture.sourcePath, ">mutate\nTGCA\n");
    await utimes(fixture.sourcePath, originalStat.atime, originalStat.mtime);

    await expect(publisher.assertPlanCurrent(plan)).rejects.toThrow("changed");
  });

  it("detects a same-content target swap before committing provenance", async () => {
    const fixture = await createFixture();
    let artifactPath = "";
    const publisher = new SequenceWorkspaceExportPublisher({
      atomicHooks: {
        beforeSidecarLink: async () => {
          const bytes = await readFile(artifactPath);
          await rm(artifactPath);
          await writeFile(artifactPath, bytes);
        },
      },
    });
    await publisher.bindSession(
      fixture.sessionId,
      fixture.sourcePath,
      fixture.extra,
    );
    const content = ">swapped\nAC\n";
    const declaration = workspaceDeclaration(content, fixture.sessionId, {
      relativePath: "exports/swapped.fasta",
    });
    const plan = await publisher.prepare(declaration);
    if (plan == null) throw new Error("Expected workspace plan.");
    artifactPath = plan.outputPath;

    await expect(
      publisher.publish(
        plan,
        Buffer.from(content),
        declaration.sha256,
        new AbortController().signal,
      ),
    ).rejects.toThrow("target changed during commit");
    await expect(readFile(plan.outputPath, "utf8")).resolves.toBe(content);
    await expect(readFile(plan.provenancePath)).rejects.toMatchObject({
      code: "ENOENT",
    });
  });

  it("rejects hardlink aliases and publishes exactly once under races", async () => {
    const fixture = await createFixture();
    const publisher = new SequenceWorkspaceExportPublisher();
    await publisher.bindSession(
      fixture.sessionId,
      fixture.sourcePath,
      fixture.extra,
    );
    const alias = path.join(fixture.projectRoot, "data/exports/alias.fasta");
    await link(fixture.sourcePath, alias);
    await expect(
      publisher.prepare(
        workspaceDeclaration(">x\nA\n", fixture.sessionId, {
          relativePath: "exports/alias.fasta",
        }),
      ),
    ).rejects.toThrow(/changed|already exists/u);
    await rm(alias);
    await expect(
      publisher.bindSession(
        fixture.sessionId,
        fixture.sourcePath,
        fixture.extra,
      ),
    ).resolves.toBe(true);

    const content = ">race\nAC\n";
    const declaration = workspaceDeclaration(content, fixture.sessionId, {
      relativePath: "exports/race.fasta",
    });
    const [firstPlan, secondPlan] = await Promise.all([
      publisher.prepare(declaration),
      publisher.prepare({ ...declaration, uploadId: randomUUID() }),
    ]);
    if (firstPlan == null || secondPlan == null) {
      throw new Error("Expected workspace plans.");
    }
    const settled = await Promise.allSettled([
      publisher.publish(
        firstPlan,
        Buffer.from(content),
        declaration.sha256,
        new AbortController().signal,
      ),
      publisher.publish(
        secondPlan,
        Buffer.from(content),
        declaration.sha256,
        new AbortController().signal,
      ),
    ]);
    expect(settled.filter(({ status }) => status === "fulfilled")).toHaveLength(
      1,
    );
    expect(settled.filter(({ status }) => status === "rejected")).toHaveLength(
      1,
    );
    expect(settled.find(({ status }) => status === "rejected")).toMatchObject({
      reason: expect.objectContaining({
        message: expect.stringContaining("already exists"),
      }),
    });
  });

  it("publishes concurrent exports to distinct destinations independently", async () => {
    const fixture = await createFixture();
    const publisher = new SequenceWorkspaceExportPublisher();
    await publisher.bindSession(
      fixture.sessionId,
      fixture.sourcePath,
      fixture.extra,
    );
    const firstContent = ">first\nAC\n";
    const secondContent = ">second\nGT\n";
    const firstDeclaration = workspaceDeclaration(
      firstContent,
      fixture.sessionId,
      { relativePath: "exports/first.fasta" },
    );
    const secondDeclaration = workspaceDeclaration(
      secondContent,
      fixture.sessionId,
      { relativePath: "exports/second.fasta" },
    );
    const [firstPlan, secondPlan] = await Promise.all([
      publisher.prepare(firstDeclaration),
      publisher.prepare(secondDeclaration),
    ]);
    if (firstPlan == null || secondPlan == null) {
      throw new Error("Expected workspace plans.");
    }

    const [firstResult, secondResult] = await Promise.all([
      publisher.publish(
        firstPlan,
        Buffer.from(firstContent),
        firstDeclaration.sha256,
        new AbortController().signal,
      ),
      publisher.publish(
        secondPlan,
        Buffer.from(secondContent),
        secondDeclaration.sha256,
        new AbortController().signal,
      ),
    ]);
    expect(firstResult.outputWorkspacePath).toBe("data/exports/first.fasta");
    expect(secondResult.outputWorkspacePath).toBe("data/exports/second.fasta");
    await expect(readFile(firstPlan.outputPath, "utf8")).resolves.toBe(
      firstContent,
    );
    await expect(readFile(secondPlan.outputPath, "utf8")).resolves.toBe(
      secondContent,
    );
  });

  it("lists bounded source-relative pages, rejects stale cursors, and omits links", async () => {
    const fixture = await createFixture();
    await Promise.all([
      writeFile(path.join(fixture.projectRoot, "data/a.txt"), "a"),
      writeFile(path.join(fixture.projectRoot, "data/b.txt"), "bb"),
    ]);
    await symlink(
      path.resolve(fixture.projectRoot, "results"),
      path.join(fixture.projectRoot, "data/linked-results"),
      process.platform === "win32" ? "junction" : "dir",
    );
    const publisher = new SequenceWorkspaceExportPublisher();
    await publisher.bindSession(
      fixture.sessionId,
      fixture.sourcePath,
      fixture.extra,
    );

    const first = await publisher.listDirectory(
      {
        candidate: { format: "fasta", name: "derived.fasta" },
        directory: ".",
        limit: 2,
        sessionId: fixture.sessionId,
      },
      fixture.extra,
    );
    expect(first.entries).toEqual([
      { kind: "file", name: "a.txt", relativePath: "a.txt", size: 1 },
      { kind: "file", name: "b.txt", relativePath: "b.txt", size: 2 },
    ]);
    expect(first.nextCursor).toEqual(expect.any(String));
    expect(first.omittedEntries).toBe(1);
    expect(first.directory).toMatchObject({
      breadcrumbs: [
        { label: "Workspace", relativePath: "..", workspacePath: "." },
        { label: "data", relativePath: ".", workspacePath: "data" },
      ],
      parentRelativePath: "..",
      relativePath: ".",
      sourceDirectoryWorkspacePath: "data",
      workspacePath: "data",
    });
    expect(first.candidate).toEqual({
      exactAvailable: true,
      exactWorkspacePath: "data/derived.fasta",
      name: "derived.fasta",
      nextVersionName: "derived.fasta",
      nextVersionWorkspacePath: "data/derived.fasta",
    });
    expect(JSON.stringify(first)).not.toContain(fixture.directory);

    const second = await publisher.listDirectory({
      cursor: first.nextCursor,
      directory: ".",
      limit: 2,
      sessionId: fixture.sessionId,
    });
    expect(second.entries.map(({ name }) => name)).toEqual([
      "exports",
      "family.aln-fasta",
    ]);

    await writeFile(path.join(fixture.projectRoot, "data/changed.txt"), "new");
    await expect(
      publisher.listDirectory({
        cursor: first.nextCursor,
        directory: ".",
        limit: 2,
        sessionId: fixture.sessionId,
      }),
    ).rejects.toThrow("stale or invalid");
    await expect(
      publisher.listDirectory({
        directory: "../../..",
        limit: 10,
        sessionId: fixture.sessionId,
      }),
    ).rejects.toThrow("escapes");
  });

  it("creates one child exclusively and rolls it back when the root binding changes", async () => {
    const fixture = await createFixture();
    const publisher = new SequenceWorkspaceExportPublisher();
    await publisher.bindSession(
      fixture.sessionId,
      fixture.sourcePath,
      fixture.extra,
    );
    await expect(
      publisher.createDirectory(
        {
          name: "analysis",
          parentDirectory: ".",
          sessionId: fixture.sessionId,
        },
        fixture.extra,
      ),
    ).resolves.toEqual({
      name: "analysis",
      relativePath: "analysis",
      workspacePath: "data/analysis",
    });
    await expect(
      publisher.createDirectory({
        name: "analysis",
        parentDirectory: ".",
        sessionId: fixture.sessionId,
      }),
    ).rejects.toThrow("already exists");

    const activeRoots = [fixture.projectRoot];
    let rootRequests = 0;
    const changingExtra = {
      async sendRequest() {
        rootRequests += 1;
        return {
          roots:
            rootRequests < 3
              ? activeRoots.map((root) => ({ uri: pathToFileURL(root).href }))
              : [],
        };
      },
    } as RootsRequestExtra;
    const changingPublisher = new SequenceWorkspaceExportPublisher();
    await changingPublisher.bindSession(
      fixture.sessionId,
      fixture.sourcePath,
      changingExtra,
    );
    await expect(
      changingPublisher.createDirectory(
        {
          name: "rolled-back",
          parentDirectory: ".",
          sessionId: fixture.sessionId,
        },
        changingExtra,
      ),
    ).rejects.toThrow("same active workspace root");
    await expect(
      readdir(path.join(fixture.projectRoot, "data")),
    ).resolves.not.toContain("rolled-back");
  });

  it("selects deterministic versions and fails after the bounded candidate set", async () => {
    const fixture = await createFixture();
    const publisher = new SequenceWorkspaceExportPublisher();
    await publisher.bindSession(
      fixture.sessionId,
      fixture.sourcePath,
      fixture.extra,
    );
    const exportsDirectory = path.join(fixture.projectRoot, "data/exports");
    await Promise.all([
      writeFile(path.join(exportsDirectory, "version.fasta"), "occupied"),
      writeFile(
        path.join(exportsDirectory, "version-2.fasta.provenance.json"),
        "occupied",
      ),
    ]);
    const content = ">versioned\nAC\n";
    const declaration = workspaceDeclaration(content, fixture.sessionId, {
      collisionPolicy: "next-version",
      relativePath: "exports/version.fasta",
    });
    const plan = await publisher.prepare(declaration);
    if (plan == null) throw new Error("Expected workspace plan.");
    expect(plan.name).toBe("version-3.fasta");
    const result = await publisher.publish(
      plan,
      Buffer.from(content),
      declaration.sha256,
      new AbortController().signal,
    );
    expect(result.outputWorkspacePath).toBe("data/exports/version-3.fasta");

    await Promise.all(
      Array.from({ length: 100 }, (_, index) => {
        const suffix = index === 0 ? "" : `-${index + 1}`;
        return writeFile(
          path.join(exportsDirectory, `exhausted${suffix}.fasta`),
          "occupied",
        );
      }),
    );
    await expect(
      publisher.prepare(
        workspaceDeclaration(content, fixture.sessionId, {
          collisionPolicy: "next-version",
          relativePath: "exports/exhausted.fasta",
        }),
      ),
    ).rejects.toThrow("within 100 attempts");
  });

  it("publishes simultaneous next-version saves without overwriting either pair", async () => {
    const fixture = await createFixture();
    const publisher = new SequenceWorkspaceExportPublisher();
    await publisher.bindSession(
      fixture.sessionId,
      fixture.sourcePath,
      fixture.extra,
    );
    const content = ">race\nAC\n";
    const declaration = workspaceDeclaration(content, fixture.sessionId, {
      collisionPolicy: "next-version",
      relativePath: "exports/concurrent.fasta",
    });
    const [firstPlan, secondPlan] = await Promise.all([
      publisher.prepare(declaration),
      publisher.prepare({ ...declaration, uploadId: randomUUID() }),
    ]);
    if (firstPlan == null || secondPlan == null) {
      throw new Error("Expected workspace plans.");
    }
    const results = await Promise.all([
      publisher.publish(
        firstPlan,
        Buffer.from(content),
        declaration.sha256,
        new AbortController().signal,
      ),
      publisher.publish(
        secondPlan,
        Buffer.from(content),
        declaration.sha256,
        new AbortController().signal,
      ),
    ]);
    expect(
      results.map(({ outputWorkspacePath }) => outputWorkspacePath).sort(),
    ).toEqual([
      "data/exports/concurrent-2.fasta",
      "data/exports/concurrent.fasta",
    ]);
    for (const result of results) {
      await expect(
        readFile(
          path.join(fixture.projectRoot, result.outputWorkspacePath),
          "utf8",
        ),
      ).resolves.toBe(content);
      await expect(
        readFile(
          path.join(fixture.projectRoot, result.provenanceWorkspacePath),
          "utf8",
        ),
      ).resolves.toContain(result.outputWorkspacePath);
    }
  });

  it("rolls back an artifact-side race before retrying the next version", async () => {
    const fixture = await createFixture();
    let firstSidecarPath = "";
    let injectCollision = true;
    const publisher = new SequenceWorkspaceExportPublisher({
      atomicHooks: {
        beforeSidecarLink: async () => {
          if (!injectCollision) return;
          injectCollision = false;
          await writeFile(firstSidecarPath, "external-sentinel");
        },
      },
    });
    await publisher.bindSession(
      fixture.sessionId,
      fixture.sourcePath,
      fixture.extra,
    );
    const content = ">rollback\nAC\n";
    const declaration = workspaceDeclaration(content, fixture.sessionId, {
      collisionPolicy: "next-version",
      relativePath: "exports/rollback.fasta",
    });
    const plan = await publisher.prepare(declaration);
    if (plan == null) throw new Error("Expected workspace plan.");
    firstSidecarPath = plan.provenancePath;
    const result = await publisher.publish(
      plan,
      Buffer.from(content),
      declaration.sha256,
      new AbortController().signal,
    );

    expect(result.outputWorkspacePath).toBe("data/exports/rollback-2.fasta");
    await expect(
      readFile(path.join(fixture.projectRoot, "data/exports/rollback.fasta")),
    ).rejects.toMatchObject({ code: "ENOENT" });
    await expect(readFile(firstSidecarPath, "utf8")).resolves.toBe(
      "external-sentinel",
    );
  });

  it("rejects a root identity swap before publication", async () => {
    const fixture = await createFixture();
    const publisher = new SequenceWorkspaceExportPublisher();
    await publisher.bindSession(
      fixture.sessionId,
      fixture.sourcePath,
      fixture.extra,
    );
    const declaration = workspaceDeclaration(">out\nA\n", fixture.sessionId);
    const plan = await publisher.prepare(declaration);
    if (plan == null) throw new Error("Expected workspace plan.");
    const moved = `${fixture.projectRoot}-moved`;
    await rename(fixture.projectRoot, moved);
    await mkdir(fixture.projectRoot);
    await expect(publisher.assertPlanCurrent(plan)).rejects.toThrow(
      /source or root/u,
    );
  });
});

async function createFixture() {
  const directory = await temporaryDirectory();
  const projectRoot = path.join(directory, "project");
  const sourceDirectory = path.join(projectRoot, "data");
  await Promise.all([
    mkdir(path.join(sourceDirectory, "exports"), { recursive: true }),
    mkdir(path.join(projectRoot, "results"), { recursive: true }),
  ]);
  const sourcePath = path.join(sourceDirectory, "family.aln-fasta");
  const sourceContent = ">source\nACGT\n";
  await writeFile(sourcePath, sourceContent);
  return {
    directory,
    extra: rootsExtra([projectRoot]),
    projectRoot,
    sessionId: randomUUID(),
    sourceContent,
    sourcePath,
  };
}

function rootsExtra(roots: Array<string>): RootsRequestExtra {
  return {
    async sendRequest() {
      return {
        roots: roots.map((root) => ({ uri: pathToFileURL(root).href })),
      };
    },
  } as RootsRequestExtra;
}

function workspaceDeclaration(
  content: string,
  sessionId: string,
  overrides: {
    collisionPolicy?: "exact" | "next-version";
    format?: SequenceWorkbenchPayloadDeclaration["format"];
    mediaType?: string;
    relativePath?: string;
  } = {},
): SequenceWorkbenchPayloadDeclaration {
  const relativePath = overrides.relativePath ?? "exports/output.fasta";
  return {
    byteLength: Buffer.byteLength(content),
    callerId: randomUUID(),
    commandId: randomUUID(),
    destination: {
      base: "opened-source",
      kind: "workspace",
      relativePath,
      ...(overrides.collisionPolicy == null
        ? {}
        : { collisionPolicy: overrides.collisionPolicy }),
    },
    format: overrides.format ?? "fasta",
    kind: "artifact",
    mediaType: overrides.mediaType ?? "text/x-fasta",
    name: relativePath.split("/").at(-1) ?? "output.fasta",
    provenance: {
      engine: "sequence-viewer-export-v1",
      parameters: { scope: "visible" },
      sourceRevision: 7,
    },
    sessionId,
    sha256: createHash("sha256").update(content).digest("hex"),
    uploadId: randomUUID(),
  };
}

async function temporaryDirectory(): Promise<string> {
  const directory = await mkdtemp(
    path.join(os.tmpdir(), "sequence-workspace-export-"),
  );
  temporaryDirectories.push(directory);
  return directory;
}
