import { createHash, randomUUID } from "node:crypto";
import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { gzipSync } from "node:zlib";

import { afterEach, describe, expect, it, vi } from "vitest";

import { SEQUENCE_VIEWER_LIMITS } from "./runtime-contract";
import { buildAlignedFasta } from "./msa/exports";
import { createServerWorkbenchStore } from "./server-workbench-store";
import { SequenceWorkbenchUploadStore } from "./server-workbench-upload";
import type { SequenceWorkbenchPayloadDeclaration } from "./workbench-persistence-protocol";
import { SequenceWorkspaceExportPublisher } from "./workspace-export-publisher";

const temporaryDirectories: Array<string> = [];
const stores: Array<SequenceWorkbenchUploadStore> = [];

// Genuine RF04178 sequence and structure from Biopython commit
// c9489604d1d9607602ca9199a3852c1219ed330f, Tests/Stockholm/rfam1.seed.txt.
// Original fixture SHA-256:
// a77480898aab5cc85b2c3eb332b05242c77aef0b9e4a29f5177f7d54adf6c035.
const publicRfamSequence = [
  "GUAAGUAAAAGUGUAACAGGAAGAAAGUUGCAGCAUAUAUGCGGUGAAUUAUGCGGUGUCAUAGGAAUUG",
  "AGGAUUUAUGUAAGAUGCUGAUAAUGAGUAAGGAACCUUAAAGUUAAUCGUUCCCUGUCUCUCCGCAGAA",
  "CCUACUGGACAAAACAGGACAGUAAGUGGACAAAAACCUACAAAUCAGC-GAUUUGUAGGUUUUUU",
].join("");
const publicRfamSecondaryStructure = [
  ":::::::::::<<<<<<_________>>>>>>,,,,,,,,((((,,,<<<<<-<<<<<<<----<<<___",
  "____>>>------>>>>>>>>>>>><<<<<-<<<<_______________>>>>->>->>>,))))----",
  "-----------------------------------<<<<<<<<<<<____>>>>>>>>>>>:::::",
].join("");
const publicRfamStockholm = [
  "# STOCKHOLM 1.0",
  "#=GF AC RF04178",
  "#=GF ID BTnc005",
  `AE015928.1/72774-72978 ${publicRfamSequence}`,
  `#=GC SS_cons ${publicRfamSecondaryStructure}`,
  "//",
].join("\n");

afterEach(async () => {
  await Promise.allSettled(stores.splice(0).map((store) => store.dispose()));
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { force: true, recursive: true })),
  );
});

describe("SequenceWorkbenchUploadStore", () => {
  it("persists a proxy-safe one-shot artifact idempotently", async () => {
    const { store, workbench } = await createStore();
    const content = ">demo\nACGT\n";
    const input = oneShotInput(artifactDeclaration(content), content);

    const first = await store.persistOneShot(input);
    const replayed = await store.persistOneShot(input);

    expect(replayed).toEqual(first);
    expect(first).toMatchObject({
      format: "fasta",
      kind: "artifact",
      name: "demo.fasta",
      sha256: sha256(content),
      size: Buffer.byteLength(content),
    });
    if (first.kind !== "artifact" || !("id" in first)) {
      throw new Error("Expected private artifact result.");
    }
    await expect(workbench.readArtifact(first.id)).resolves.toMatchObject({
      content,
    });
  });

  it.each([
    [
      "a3m",
      "text/x-a3m",
      "alignment.a3m",
      ">alpha\nACgtGT\n>beta\nA-GT\n",
    ],
    [
      "clustal",
      "text/x-clustal",
      "alignment.aln",
      "CLUSTAL W multiple sequence alignment\n\nalpha  ACGT\nbeta   A-GT\n",
    ],
    [
      "gtf",
      "text/x-gtf",
      "annotations.gtf",
      'AC007323.5\tGenBank\tCDS\t3698\t3978\t.\t+\t2\tgene_id "AC007323.5"; transcript_id "AT1G01010";\n',
    ],
    [
      "pdf",
      "application/pdf",
      "alignment.pdf",
      "%PDF-1.4\n1 0 obj\n<<>>\nendobj\nstartxref\n9\n%%EOF\n",
    ],
    [
      "stockholm",
      "text/x-stockholm",
      "alignment.sto",
      publicRfamStockholm,
    ],
  ] as const)(
    "persists advertised %s exports as retrievable private artifacts",
    async (format, mediaType, name, content) => {
      const { store, workbench } = await createStore();
      const declaration = artifactDeclaration(content, {
        format,
        mediaType,
        name,
      });

      const result = await store.persistOneShot(
        oneShotInput(declaration, content),
      );

      expect(result).toMatchObject({
        format,
        kind: "artifact",
        mediaType,
        name,
        resourceUri: expect.stringMatching(
          /^viewer-artifact:\/\/sequence-viewer\/generated\//u,
        ),
        sha256: sha256(content),
        size: Buffer.byteLength(content),
      });
      if (result.kind !== "artifact" || !("id" in result)) {
        throw new Error("Expected a retrievable private artifact.");
      }
      await expect(workbench.readArtifact(result.id)).resolves.toMatchObject({
        content,
        metadata: { format, mediaType, name },
      });
    },
  );

  it.each([
    ["a3m", "text/x-a3m", "alignment.a3m", ">alpha\n"],
    ["clustal", "text/x-clustal", "alignment.aln", ">alpha\nACGT\n"],
    [
      "gtf",
      "text/x-gtf",
      "annotations.gtf",
      "chr1\tviewer\tgene\t1\t4\t.\t+\t.\tname x;\n",
    ],
    ["pdf", "application/pdf", "alignment.pdf", "%PDF-1.4\n1 0 obj\n"],
    [
      "stockholm",
      "text/x-stockholm",
      "alignment.sto",
      "# STOCKHOLM 1.0\nalpha ACGU\n",
    ],
  ] as const)(
    "rejects structurally invalid private %s artifacts",
    async (format, mediaType, name, content) => {
      const { store } = await createStore();
      const declaration = artifactDeclaration(content, {
        format,
        mediaType,
        name,
      });

      await expect(
        store.persistOneShot(oneShotInput(declaration, content)),
      ).rejects.toThrow();
    },
  );

  it.each([
    ["a3m", "alignment.a3m", ">alpha\nACGT\n"],
    [
      "clustal",
      "alignment.aln",
      "CLUSTAL W multiple sequence alignment\n\nalpha ACGT\n",
    ],
    [
      "gtf",
      "annotations.gtf",
      'chr1\tviewer\tgene\t1\t4\t.\t+\t.\tgene_id "gene-1";\n',
    ],
    [
      "pdf",
      "alignment.pdf",
      "%PDF-1.4\n1 0 obj\n<<>>\nendobj\nstartxref\n9\n%%EOF\n",
    ],
    [
      "stockholm",
      "alignment.sto",
      "# STOCKHOLM 1.0\nalpha ACGU\n//\n",
    ],
  ] as const)(
    "rejects a mismatched media type for private %s artifacts",
    async (format, name, content) => {
      const { store } = await createStore();
      const declaration = artifactDeclaration(content, {
        format,
        mediaType: "text/plain",
        name,
      });

      await expect(
        store.persistOneShot(oneShotInput(declaration, content)),
      ).rejects.toThrow("media type");
    },
  );

  it("preserves a valid empty BED export", async () => {
    const { store } = await createStore();
    const declaration = artifactDeclaration("", {
      format: "bed",
      mediaType: "text/x-bed",
      name: "empty.bed",
    });
    await expect(
      store.persistOneShot(oneShotInput(declaration, "")),
    ).resolves.toMatchObject({
      format: "bed",
      kind: "artifact",
      size: 0,
    });
  });

  it("resumes multi-chunk uploads and accepts only identical retries", async () => {
    const { store } = await createStore();
    const content = `>${"a".repeat(
      SEQUENCE_VIEWER_LIMITS.persistence.maxChunkBytes * 2 + 17,
    )}`;
    const declaration = artifactDeclaration(content);
    const bytes = Buffer.from(content);
    const first = bytes.subarray(
      0,
      SEQUENCE_VIEWER_LIMITS.persistence.maxChunkBytes,
    );

    await store.begin(declaration);
    await store.append(chunkInput(declaration, 0, first));
    await expect(
      store.append(chunkInput(declaration, 0, first)),
    ).resolves.toMatchObject({ receivedBytes: first.byteLength });
    await expect(
      store.append(
        chunkInput(declaration, 0, Buffer.alloc(first.byteLength, 7)),
      ),
    ).rejects.toThrow("did not match");
    await expect(
      store.append(
        chunkInput(
          declaration,
          first.byteLength + 1,
          bytes.subarray(first.byteLength, first.byteLength * 2),
        ),
      ),
    ).rejects.toThrow("Expected workbench payload offset");

    await expect(store.begin(declaration)).resolves.toMatchObject({
      receivedBytes: first.byteLength,
    });
    for (let offset = first.byteLength; offset < bytes.byteLength; ) {
      const end = Math.min(
        offset + SEQUENCE_VIEWER_LIMITS.persistence.maxChunkBytes,
        bytes.byteLength,
      );
      await store.append(
        chunkInput(declaration, offset, bytes.subarray(offset, end)),
      );
      offset = end;
    }
    const result = await store.finish(identity(declaration));
    expect(result).toMatchObject({
      kind: "artifact",
      sha256: declaration.sha256,
      size: bytes.byteLength,
    });
    await expect(store.finish(identity(declaration))).resolves.toEqual(result);
  });

  it("rejects incomplete, oversized, and digest-mismatched declarations", async () => {
    const { store } = await createStore();
    const content = ">demo\nACGT\n";
    const incomplete = artifactDeclaration(content);
    await store.begin(incomplete);
    await expect(store.finish(identity(incomplete))).rejects.toThrow(
      "incomplete",
    );
    await store.abort(identity(incomplete));

    const badDigest = artifactDeclaration(content, {
      sha256: "0".repeat(64),
    });
    await store.begin(badDigest);
    await store.append(chunkInput(badDigest, 0, Buffer.from(content)));
    await expect(store.finish(identity(badDigest))).rejects.toThrow("SHA-256");
    await store.abort(identity(badDigest));

    await expect(
      store.begin({
        ...artifactDeclaration(content),
        byteLength: SEQUENCE_VIEWER_LIMITS.session.maxArtifactBytes + 1,
      }),
    ).rejects.toThrow();
  });

  it("binds uploads to the exact session, command, caller, and declaration", async () => {
    const { store } = await createStore();
    const content = ">demo\nACGT\n";
    const declaration = artifactDeclaration(content);
    await store.begin(declaration);

    for (const changed of [
      { callerId: randomUUID() },
      { commandId: randomUUID() },
      { sessionId: randomUUID() },
    ]) {
      await expect(
        store.append({
          ...chunkInput(declaration, 0, Buffer.from(content)),
          ...changed,
        }),
      ).rejects.toThrow(/another (caller|viewer command|viewer session)/u);
    }
    await expect(
      store.begin({ ...declaration, name: "different.fasta" }),
    ).rejects.toThrow("different data");
    await store.abort(identity(declaration));
  });

  it("bounds concurrent upload count and declared active bytes", async () => {
    const { store } = await createStore();
    const countDeclarations = Array.from(
      { length: SEQUENCE_VIEWER_LIMITS.persistence.maxActiveUploads },
      () => artifactDeclaration(">A"),
    );
    for (const declaration of countDeclarations) {
      await store.begin(declaration);
    }
    await expect(store.begin(artifactDeclaration(">B"))).rejects.toThrow(
      "Too many",
    );
    await Promise.all(
      countDeclarations.map((declaration) =>
        store.abort(identity(declaration)),
      ),
    );

    const byteDeclarations = Array.from({ length: 4 }, () =>
      artifactDeclaration("", {
        byteLength: SEQUENCE_VIEWER_LIMITS.session.maxArtifactBytes,
        sha256: "0".repeat(64),
      }),
    );
    for (const declaration of byteDeclarations) {
      await store.begin(declaration);
    }
    await expect(
      store.begin(
        artifactDeclaration("", {
          byteLength: 1,
          sha256: "0".repeat(64),
        }),
      ),
    ).rejects.toThrow("byte budget");
    await Promise.all(
      byteDeclarations.map((declaration) => store.abort(identity(declaration))),
    );
  });

  it("validates sessions and returns compact saved-session metadata", async () => {
    const { store, workbench } = await createStore();
    const content = validSession();
    const declaration = sessionDeclaration(content);
    const result = await store.persistOneShot(
      oneShotInput(declaration, content),
    );
    expect(result).toEqual({
      kind: "session",
      name: declaration.name,
      savedSessionId: expect.any(String),
      sha256: declaration.sha256,
      size: declaration.byteLength,
    });
    if (result.kind !== "session" || !("savedSessionId" in result)) {
      throw new Error("Expected private session result.");
    }
    await expect(workbench.readSession(result.savedSessionId)).resolves.toBe(
      content,
    );

    const invalid = '{"schemaVersion":1}';
    const invalidDeclaration = sessionDeclaration(invalid);
    await store.begin(invalidDeclaration);
    await store.append(chunkInput(invalidDeclaration, 0, Buffer.from(invalid)));
    await expect(store.finish(identity(invalidDeclaration))).rejects.toThrow();
    await store.abort(identity(invalidDeclaration));
  });

  it("cleans up cancellation and expiry without publishing partial content", async () => {
    let now = 1_000;
    const { stagingDirectory, store } = await createStore({ now: () => now });
    const content = ">demo\nACGT\n";
    const cancelled = artifactDeclaration(content);
    await store.begin(cancelled);
    await store.append(chunkInput(cancelled, 0, Buffer.from(content)));
    await expect(store.abort(identity(cancelled))).resolves.toEqual({
      aborted: true,
      uploadId: cancelled.uploadId,
    });
    expect(store.activeUploads).toBe(0);

    const expired = artifactDeclaration(content);
    await store.begin(expired);
    now += SEQUENCE_VIEWER_LIMITS.persistence.uploadTtlMs + 1;
    await store.cleanupExpired();
    expect(store.activeUploads).toBe(0);
    await expect(store.finish(identity(expired))).rejects.toThrow(
      "not found or has expired",
    );
    expect(await readdir(stagingDirectory)).toEqual([]);
  });

  it("releases a pending begin when abort wins staging creation", async () => {
    const directory = await temporaryDirectory();
    const stagingDirectory = await temporaryDirectory();
    const workbench = createServerWorkbenchStore({ stateDirectory: directory });
    let releaseStagingDirectory: (() => void) | undefined;
    const stagingDirectoryGate = new Promise<void>((resolve) => {
      releaseStagingDirectory = resolve;
    });
    const stagingDirectoryRequested = vi.fn();
    const store = new SequenceWorkbenchUploadStore(workbench, {
      createStagingDirectory: async () => {
        stagingDirectoryRequested();
        await stagingDirectoryGate;
        return stagingDirectory;
      },
    });
    stores.push(store);
    const declaration = artifactDeclaration(">demo\nACGT\n");

    const beginning = store.begin(declaration);
    await vi.waitFor(() =>
      expect(stagingDirectoryRequested).toHaveBeenCalledOnce(),
    );
    expect(store.activeUploads).toBe(1);
    const aborting = store.abort(identity(declaration));
    releaseStagingDirectory?.();

    await expect(beginning).rejects.toMatchObject({ name: "AbortError" });
    await expect(aborting).resolves.toEqual({
      aborted: true,
      uploadId: declaration.uploadId,
    });
    expect(store.activeUploads).toBe(0);
    expect(await readdir(stagingDirectory)).toEqual([]);
  });

  it("reports a committed result when cancellation races with publication", async () => {
    const directory = await temporaryDirectory();
    const workbench = createServerWorkbenchStore({ stateDirectory: directory });
    const originalPersist = workbench.persistArtifact.bind(workbench);
    let releaseCommit: (() => void) | undefined;
    const commitGate = new Promise<void>((resolve) => {
      releaseCommit = resolve;
    });
    const commitStarted = vi.fn();
    workbench.persistArtifact = vi.fn(async (input) => {
      commitStarted();
      await commitGate;
      return await originalPersist(input);
    });
    const stagingDirectory = await temporaryDirectory();
    const store = new SequenceWorkbenchUploadStore(workbench, {
      createStagingDirectory: async () => stagingDirectory,
    });
    stores.push(store);
    const content = ">demo\nACGT\n";
    const declaration = artifactDeclaration(content);
    await store.begin(declaration);
    await store.append(chunkInput(declaration, 0, Buffer.from(content)));
    const finishing = store.finish(identity(declaration));
    await vi.waitFor(() => expect(commitStarted).toHaveBeenCalledOnce());
    const aborting = store.abort(identity(declaration));
    releaseCommit?.();
    const [result, aborted] = await Promise.all([finishing, aborting]);
    expect(aborted).toEqual({
      aborted: false,
      result,
      uploadId: declaration.uploadId,
    });
  });

  it("publishes every supported export format through the existing one-shot transport", async () => {
    const fixture = await createWorkspaceStore();
    const exports = {
      "aligned-fasta": [">a\nA-\n>b\nAC\n", "visible.afa", "text/x-fasta"],
      bed: ["", "features.bed", "text/x-bed"],
      csv: ["name,value\na,1\n", "results.csv", "text/csv"],
      embl: ["ID   demo;\nSQ   Sequence 1 BP;\n     a\n//\n", "record.embl", "text/x-embl"],
      fasta: [">demo\nACGT\n", "record.fasta", "text/x-fasta"],
      fastq: ["@demo\nACGT\n+\nIIII\n", "reads.fastq", "text/x-fastq"],
      genbank: ["LOCUS       DEMO 1 bp\nORIGIN\n        1 a\n//\n", "record.gbk", "text/x-genbank"],
      gff3: ["##gff-version 3\nchr1\tdemo\tgene\t1\t1\t.\t+\t.\tID=g1\n", "features.gff3", "text/x-gff3"],
      json: ["{\"records\":[]}", "viewer.json", "application/json"],
      newick: ["(a:1,b:1);\n", "tree.nwk", "text/x-newick"],
      svg: ["<svg xmlns=\"http://www.w3.org/2000/svg\"></svg>\n", "range.svg", "image/svg+xml"],
      tsv: ["name\tvalue\na\t1\n", "hits.tsv", "text/tab-separated-values"],
      vcf: ["##fileformat=VCFv4.3\n#CHROM\tPOS\tID\tREF\tALT\tQUAL\tFILTER\tINFO\n", "variants.vcf", "text/x-vcf"],
    } as const;

    for (const [format, [content, name, mediaType]] of Object.entries(exports)) {
      const declaration = artifactDeclaration(content, {
        destination: {
          base: "opened-source",
          kind: "workspace",
          relativePath: `exports/${name}`,
        },
        format: format as SequenceWorkbenchPayloadDeclaration["format"],
        mediaType,
        name,
        provenance: {
          engine: "sequence-viewer-export-v1",
          parameters: { format },
          sourceRevision: 1,
        },
        sessionId: fixture.sessionId,
      });
      const result = await fixture.store.persistOneShot(
        oneShotInput(declaration, content),
      );
      expect(result).toMatchObject({
        destination: { base: "opened-source", kind: "workspace" },
        format,
        kind: "artifact",
        mediaType,
        name,
        sha256: declaration.sha256,
        size: Buffer.byteLength(content),
      });
      await expect(
        readFile(path.join(fixture.sourceDirectory, "exports", name), "utf8"),
      ).resolves.toBe(content);
    }
    await expect(readFile(fixture.sourcePath, "utf8")).resolves.toBe(
      fixture.sourceContent,
    );
  });

  it("publishes server-authored workspace session manifests through the existing transport", async () => {
    const fixture = await createWorkspaceStore();
    const content = validSession();
    const declaration: SequenceWorkbenchPayloadDeclaration = {
      ...sessionDeclaration(content),
      destination: {
        base: "opened-source",
        collisionPolicy: "next-version",
        kind: "workspace",
        relativePath: "source.sequence-viewer.session.json",
      },
      name: "source.sequence-viewer.session.json",
      sessionId: fixture.sessionId,
    };
    const first = await fixture.store.persistOneShot(
      oneShotInput(declaration, content),
    );
    const secondDeclaration: SequenceWorkbenchPayloadDeclaration = {
      ...declaration,
      callerId: randomUUID(),
      commandId: randomUUID(),
      uploadId: randomUUID(),
    };
    const second = await fixture.store.persistOneShot(
      oneShotInput(secondDeclaration, content),
    );

    expect(first).toMatchObject({
      destination: { base: "opened-source", kind: "workspace" },
      kind: "session",
      name: "source.sequence-viewer.session.json",
      outputWorkspacePath: "data/source.sequence-viewer.session.json",
      payloadSha256: declaration.sha256,
      payloadSize: declaration.byteLength,
      version: 1,
    });
    expect(second).toMatchObject({
      kind: "session",
      name: "source.sequence-viewer.session-2.json",
      outputWorkspacePath: "data/source.sequence-viewer.session-2.json",
    });
    expect(first).not.toHaveProperty("savedSessionId");
    const manifestText = await readFile(
      path.join(
        fixture.sourceDirectory,
        "source.sequence-viewer.session.json",
      ),
      "utf8",
    );
    const manifest = JSON.parse(manifestText) as Record<string, unknown>;
    expect(manifest).toMatchObject({
      mode: "sequence",
      payload: content,
      payloadSha256: declaration.sha256,
      schemaVersion: 1,
      source: {
        sha256: sha256(fixture.sourceContent),
        size: Buffer.byteLength(fixture.sourceContent),
        workspacePath: "data/source.fasta",
      },
      version: 1,
    });
    expect(manifestText).not.toContain(fixture.sourcePath);
    expect(manifestText).not.toContain(declaration.commandId);
    expect(manifestText).not.toContain(declaration.uploadId);
  });

  it("resumes and idempotently finishes a multi-megabyte workspace export", async () => {
    const fixture = await createWorkspaceStore();
    const content = `>large\n${"ACGT".repeat(600 * 1_024)}\n`;
    const declaration = artifactDeclaration(content, {
      destination: {
        base: "opened-source",
        kind: "workspace",
        relativePath: "exports/large.fasta",
      },
      name: "large.fasta",
      provenance: {
        engine: "sequence-viewer-export-v1",
        parameters: { scope: "all" },
        sourceRevision: 2,
      },
      sessionId: fixture.sessionId,
    });
    const bytes = Buffer.from(content);
    await fixture.store.begin(declaration);
    const firstEnd = SEQUENCE_VIEWER_LIMITS.persistence.maxChunkBytes;
    await fixture.store.append(
      chunkInput(declaration, 0, bytes.subarray(0, firstEnd)),
    );
    await fixture.store.append(
      chunkInput(declaration, 0, bytes.subarray(0, firstEnd)),
    );
    await expect(fixture.store.begin(declaration)).resolves.toMatchObject({
      receivedBytes: firstEnd,
    });
    for (let offset = firstEnd; offset < bytes.byteLength; ) {
      const end = Math.min(
        offset + SEQUENCE_VIEWER_LIMITS.persistence.maxChunkBytes,
        bytes.byteLength,
      );
      await fixture.store.append(
        chunkInput(declaration, offset, bytes.subarray(offset, end)),
      );
      offset = end;
    }
    const result = await fixture.store.finish(identity(declaration));
    expect(result).toMatchObject({
      metrics: {
        acceptedBytes: bytes.byteLength,
        committedBytes: bytes.byteLength,
        mode: "browser-streamed",
        producedBytes: bytes.byteLength,
        retryCount: 1,
      },
    });
    await expect(fixture.store.finish(identity(declaration))).resolves.toEqual(
      result,
    );
    await expect(
      readFile(path.join(fixture.sourceDirectory, "exports/large.fasta")),
    ).resolves.toEqual(bytes);
  }, 20_000);

  it("generates an Alignment export directly from the trusted source idempotently", async () => {
    const fixture = await createWorkspaceStore({
      sourceContent: ">a\nAC-\n>b\nA--",
      sourceName: "source.afa",
    });
    const input = {
      callerId: randomUUID(),
      commandId: randomUUID(),
      destination: {
        base: "opened-source" as const,
        kind: "workspace" as const,
        relativePath: "exports/generated.afa",
      },
      format: "aligned-fasta" as const,
      mediaType: "text/x-fasta" as const,
      name: "generated.afa",
      operationId: randomUUID(),
      provenance: {
        engine: "sequence-viewer-alignment-server-export-v1",
        parameters: { scope: "all" },
        sourceRevision: 0,
      },
      sessionId: fixture.sessionId,
      source: { compression: "auto" as const, kind: "opened-source" as const },
    };

    const result = await fixture.store.generateWorkspaceExport(input);
    expect(fixture.sourceContent).toBe(
      buildAlignedFasta([
        { alignedSequence: "AC-", id: "a", label: "a", ungappedLength: 2 },
        { alignedSequence: "A--", id: "b", label: "b", ungappedLength: 1 },
      ]),
    );
    await expect(fixture.store.generateWorkspaceExport(input)).resolves.toEqual(
      result,
    );
    expect(result).toMatchObject({
      kind: "artifact",
      metrics: {
        acceptedBytes: Buffer.byteLength(fixture.sourceContent),
        committedBytes: Buffer.byteLength(fixture.sourceContent),
        mode: "server-generated",
        peakRetainedBytes: expect.any(Number),
        producedBytes: Buffer.byteLength(fixture.sourceContent),
      },
      name: "generated.afa",
      size: Buffer.byteLength(fixture.sourceContent),
    });
    await expect(
      readFile(
        path.join(fixture.sourceDirectory, "exports/generated.afa"),
        "utf8",
      ),
    ).resolves.toBe(fixture.sourceContent);
  });

  it("generates a gzip-backed Sequence export without retaining the decoded output", async () => {
    const sourceContent = `>gzip\n${"ACGT".repeat(300_000)}\n`;
    const fixture = await createWorkspaceStore({
      sourceBytes: gzipSync(sourceContent),
      sourceContent,
      sourceName: "source.fasta.gz",
    });
    const result = await fixture.store.generateWorkspaceExport({
      callerId: randomUUID(),
      commandId: randomUUID(),
      destination: {
        base: "opened-source",
        kind: "workspace",
        relativePath: "exports/decoded.fasta",
      },
      format: "fasta",
      mediaType: "text/x-fasta",
      name: "decoded.fasta",
      operationId: randomUUID(),
      provenance: {
        engine: "sequence-viewer-server-export-v1",
        parameters: { compression: "gzip" },
        sourceRevision: 0,
      },
      sessionId: fixture.sessionId,
      source: { compression: "auto", kind: "opened-source" },
    });

    expect(result).toMatchObject({
      kind: "artifact",
      metrics: {
        mode: "server-generated",
        peakRetainedBytes: expect.any(Number),
      },
      sha256: sha256(sourceContent),
      size: Buffer.byteLength(sourceContent),
    });
    if (result.kind !== "artifact" || !("metrics" in result)) {
      throw new Error("Expected generated workspace artifact metrics.");
    }
    expect(result.metrics?.peakRetainedBytes).toBeLessThanOrEqual(4 * 1_024 * 1_024);
    await expect(
      readFile(path.join(fixture.sourceDirectory, "exports/decoded.fasta"), "utf8"),
    ).resolves.toBe(sourceContent);
  }, 20_000);

  it("enforces workspace-output and disk quotas without reserving declared bytes", async () => {
    const fixture = await createWorkspaceStore({
      getAvailableWorkspaceBytes: async () => 0,
    });
    const tooLarge = artifactDeclaration("", {
      byteLength: SEQUENCE_VIEWER_LIMITS.workspace.maxArtifactBytes + 1,
      destination: {
        base: "opened-source",
        kind: "workspace",
        relativePath: "exports/too-large.fasta",
      },
      name: "too-large.fasta",
      provenance: {
        engine: "test",
        parameters: {},
        sourceRevision: 0,
      },
      sessionId: fixture.sessionId,
      sha256: "0".repeat(64),
    });
    await expect(fixture.store.begin(tooLarge)).rejects.toThrow(
      "workspace-output quota",
    );

    const declarations = ["first", "second"].map((stem) =>
      artifactDeclaration("", {
        byteLength: 1_024 * 1_024 * 1_024,
        destination: {
          base: "opened-source",
          kind: "workspace",
          relativePath: `exports/${stem}.fasta`,
        },
        name: `${stem}.fasta`,
        provenance: {
          engine: "test",
          parameters: {},
          sourceRevision: 0,
        },
        sessionId: fixture.sessionId,
        sha256: "0".repeat(64),
      }),
    );
    for (const declaration of declarations) {
      await expect(fixture.store.begin(declaration)).resolves.toMatchObject({
        receivedBytes: 0,
      });
    }
    expect(fixture.store.workspaceStagingUsage).toBe(0);
    await Promise.all(
      declarations.map((declaration) =>
        fixture.store.abort(identity(declaration)),
      ),
    );

    const content = ">disk\nACGT\n";
    const diskFailure = artifactDeclaration(content, {
      destination: {
        base: "opened-source",
        kind: "workspace",
        relativePath: "exports/disk.fasta",
      },
      name: "disk.fasta",
      provenance: {
        engine: "test",
        parameters: {},
        sourceRevision: 0,
      },
      sessionId: fixture.sessionId,
    });
    await fixture.store.begin(diskFailure);
    await expect(
      fixture.store.append(
        chunkInput(diskFailure, 0, Buffer.from(content)),
      ),
    ).rejects.toThrow("free disk space");
    expect(fixture.store.activeUploads).toBe(0);
    expect(fixture.store.workspaceStagingUsage).toBe(0);
    expect(
      (await readdir(path.join(fixture.sourceDirectory, "exports"))).some(
        (name) => name.endsWith(".tmp"),
      ),
    ).toBe(false);
    await expect(
      readFile(path.join(fixture.sourceDirectory, "exports/disk.fasta")),
    ).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("removes destination-local staging after incremental validation fails", async () => {
    const fixture = await createWorkspaceStore();
    const content = '{"value":}';
    const declaration = artifactDeclaration(content, {
      destination: {
        base: "opened-source",
        kind: "workspace",
        relativePath: "exports/invalid.json",
      },
      format: "json",
      mediaType: "application/json",
      name: "invalid.json",
      provenance: {
        engine: "test",
        parameters: {},
        sourceRevision: 0,
      },
      sessionId: fixture.sessionId,
    });
    await fixture.store.begin(declaration);
    await expect(
      fixture.store.append(
        chunkInput(declaration, 0, Buffer.from(content)),
      ),
    ).rejects.toThrow("JSON");
    expect(fixture.store.activeUploads).toBe(0);
    expect(fixture.store.workspaceStagingUsage).toBe(0);
    await expect(
      readFile(path.join(fixture.sourceDirectory, "exports/invalid.json")),
    ).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("returns the actual deterministic name for a next-version workspace upload", async () => {
    const fixture = await createWorkspaceStore();
    await writeFile(
      path.join(fixture.sourceDirectory, "exports/versioned.fasta"),
      "occupied",
    );
    const content = ">versioned\nAC\n";
    const declaration = artifactDeclaration(content, {
      destination: {
        base: "opened-source",
        collisionPolicy: "next-version",
        kind: "workspace",
        relativePath: "exports/versioned.fasta",
      },
      name: "versioned.fasta",
      provenance: {
        engine: "sequence-viewer-browser-export-v1",
        parameters: {},
        sourceRevision: 1,
      },
      sessionId: fixture.sessionId,
    });

    const result = await fixture.store.persistOneShot(
      oneShotInput(declaration, content),
    );

    expect(result).toMatchObject({
      kind: "artifact",
      name: "versioned-2.fasta",
      outputWorkspacePath: "data/exports/versioned-2.fasta",
    });
    await expect(
      readFile(
        path.join(fixture.sourceDirectory, "exports/versioned-2.fasta"),
        "utf8",
      ),
    ).resolves.toBe(content);
  });
});

async function createWorkspaceStore({
  getAvailableWorkspaceBytes,
  sourceContent = ">source\nACGT\n",
  sourceBytes,
  sourceName = "source.fasta",
}: {
  getAvailableWorkspaceBytes?: (directory: string) => Promise<number>;
  sourceContent?: string;
  sourceBytes?: Uint8Array;
  sourceName?: string;
} = {}) {
  const directory = await temporaryDirectory();
  const stateDirectory = await temporaryDirectory();
  const stagingDirectory = await temporaryDirectory();
  const sourceDirectory = path.join(directory, "data");
  await mkdir(path.join(sourceDirectory, "exports"), { recursive: true });
  const sourcePath = path.join(sourceDirectory, sourceName);
  await writeFile(sourcePath, sourceBytes ?? sourceContent);
  const sessionId = randomUUID();
  const workspacePublisher = new SequenceWorkspaceExportPublisher();
  await workspacePublisher.bindSession(sessionId, sourcePath, {
    async sendRequest() {
      return { roots: [{ uri: pathToFileURL(directory).href }] };
    },
  } as never);
  const workbench = createServerWorkbenchStore({ stateDirectory });
  const store = new SequenceWorkbenchUploadStore(workbench, {
    createStagingDirectory: async () => stagingDirectory,
    getAvailableWorkspaceBytes,
    workspacePublisher,
  });
  stores.push(store);
  return {
    sessionId,
    sourceContent,
    sourceDirectory,
    sourcePath,
    store,
  };
}

async function createStore({ now }: { now?: () => number } = {}) {
  const directory = await temporaryDirectory();
  const stagingDirectory = await temporaryDirectory();
  const workbench = createServerWorkbenchStore({ stateDirectory: directory });
  const store = new SequenceWorkbenchUploadStore(workbench, {
    createStagingDirectory: async () => stagingDirectory,
    now,
  });
  stores.push(store);
  return { stagingDirectory, store, workbench };
}

function artifactDeclaration(
  content: string,
  overrides: Partial<SequenceWorkbenchPayloadDeclaration> = {},
): SequenceWorkbenchPayloadDeclaration {
  const { destination = { kind: "private" }, ...rest } = overrides;
  return {
    byteLength: Buffer.byteLength(content),
    callerId: randomUUID(),
    commandId: randomUUID(),
    destination,
    format: "fasta",
    kind: "artifact",
    mediaType: "text/x-fasta",
    name: "demo.fasta",
    sessionId: randomUUID(),
    sha256: sha256(content),
    uploadId: randomUUID(),
    ...rest,
  };
}

function sessionDeclaration(
  content: string,
): SequenceWorkbenchPayloadDeclaration {
  return {
    byteLength: Buffer.byteLength(content),
    callerId: randomUUID(),
    commandId: randomUUID(),
    destination: { kind: "private" },
    kind: "session",
    name: "demo.sequence-session.json",
    sessionId: randomUUID(),
    sha256: sha256(content),
    uploadId: randomUUID(),
  };
}

function oneShotInput(
  declaration: SequenceWorkbenchPayloadDeclaration,
  content: string,
) {
  return {
    ...declaration,
    dataBase64: Buffer.from(content).toString("base64"),
  };
}

function chunkInput(
  declaration: SequenceWorkbenchPayloadDeclaration,
  offset: number,
  bytes: Uint8Array,
) {
  return {
    ...identity(declaration),
    dataBase64: Buffer.from(bytes).toString("base64"),
    offset,
  };
}

function identity(declaration: SequenceWorkbenchPayloadDeclaration) {
  return {
    callerId: declaration.callerId,
    commandId: declaration.commandId,
    sessionId: declaration.sessionId,
    uploadId: declaration.uploadId,
  };
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function validSession(): string {
  return JSON.stringify({
    artifacts: [],
    createdAt: 1,
    dirty: false,
    jobs: [],
    revision: 0,
    schemaVersion: 1,
    source: { fileName: "demo.fasta", format: "fasta" },
    tracks: [],
    view: {
      mode: "sequence",
      sequence: {
        geneticCodeId: 1,
        layout: "linear",
        orientation: "forward",
        paletteId: "neutral",
        selectedFeatureId: null,
        selectedRecordId: "record-1",
        selection: null,
        showFeatures: true,
        showQuality: true,
        showTranslation: true,
        synchronizedViews: true,
        viewport: null,
        wrapWidth: 60,
      },
    },
  });
}

async function temporaryDirectory(): Promise<string> {
  const directory = await mkdtemp(
    path.join(os.tmpdir(), "sequence-workbench-upload-test-"),
  );
  temporaryDirectories.push(directory);
  return directory;
}
