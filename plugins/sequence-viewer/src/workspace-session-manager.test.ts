import { createHash, randomUUID } from "node:crypto";
import {
  link,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { afterEach, describe, expect, it } from "vitest";

import type { RootsRequestExtra } from "./chat-file-resource";
import type { SequenceWorkbenchPayloadDeclaration } from "./workbench-persistence-protocol";
import { SequenceWorkspaceExportPublisher } from "./workspace-export-publisher";
import {
  createSequenceWorkspaceSessionManifest,
  SequenceWorkspaceSessionManager,
} from "./workspace-session-manager";
import { sequenceWorkspaceSessionManifestSchema } from "./workspace-session-protocol";

const temporaryDirectories: Array<string> = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { force: true, recursive: true })),
  );
});

describe("SequenceWorkspaceSessionManager", () => {
  it.each(["sequence", "alignment"] as const)(
    "creates, discovers, and revalidates a %s project",
    async (mode) => {
      const fixture = await createFixture();
      const payload = validSession(mode);
      await publishManifest(fixture, payload, `${mode}.sequence-viewer.session.json`);

      const listed = await fixture.manager.list(
        { sessionId: fixture.sessionId },
        fixture.extra,
      );
      expect(listed).toMatchObject({
        candidates: [
          {
            mode,
            sourceStatus: "verification-required",
            workspacePath: `data/${mode}.sequence-viewer.session.json`,
          },
        ],
        omittedCandidates: 0,
      });

      const resolved = await fixture.manager.resolve(
        listed.candidates[0]!.candidateId,
        fixture.sessionId,
        undefined,
        fixture.extra,
      );
      expect(resolved).toMatchObject({ mode, payload });
    },
  );

  it("omits malformed, incompatible, digest-tampered, linked, and non-adjacent manifests", async () => {
    const fixture = await createFixture();
    const validPath = await publishManifest(
      fixture,
      validSession("sequence"),
      "valid.sequence-viewer.session.json",
    );
    const valid = JSON.parse(await readFile(validPath, "utf8")) as Record<
      string,
      unknown
    >;
    await writeFile(
      path.join(fixture.sourceDirectory, "malformed.sequence-viewer.session.json"),
      "{",
    );
    await writeFile(
      path.join(fixture.sourceDirectory, "incompatible.sequence-viewer.session.json"),
      JSON.stringify({ ...valid, schemaVersion: 2 }),
    );
    await writeFile(
      path.join(fixture.sourceDirectory, "tampered.sequence-viewer.session.json"),
      JSON.stringify({ ...valid, payload: `${String(valid.payload)} ` }),
    );
    await link(
      validPath,
      path.join(fixture.sourceDirectory, "linked.sequence-viewer.session.json"),
    );
    await mkdir(path.join(fixture.sourceDirectory, "nested"));
    await writeFile(
      path.join(
        fixture.sourceDirectory,
        "nested",
        "hidden.sequence-viewer.session.json",
      ),
      JSON.stringify(valid),
    );

    const listed = await fixture.manager.list(
      { sessionId: fixture.sessionId },
      fixture.extra,
    );
    // Hardlinking the valid manifest also raises its link count, so both names
    // are omitted instead of exposing an aliasing race.
    expect(listed.candidates).toEqual([]);
    expect(listed.omittedCandidates).toBe(3);
  });

  it("reports optional dependency drift but rejects required dependency drift", async () => {
    const fixture = await createFixture();
    const trackPath = path.join(fixture.sourceDirectory, "features.bed");
    const track = "chr1\t0\t4\tfeature\n";
    await writeFile(trackPath, track);
    const manifestPath = await publishManifest(
      fixture,
      validSession("sequence", {
        trackHash: sha256(track),
        trackWorkspacePath: "data/features.bed",
      }),
      "tracked.sequence-viewer.session.json",
    );
    await rm(trackPath);

    let listed = await fixture.manager.list(
      { sessionId: fixture.sessionId },
      fixture.extra,
    );
    expect(listed.candidates[0]?.dependencies).toEqual([
      expect.objectContaining({ required: false, status: "missing" }),
    ]);
    await expect(
      fixture.manager.resolve(
        listed.candidates[0]!.candidateId,
        fixture.sessionId,
        undefined,
        fixture.extra,
      ),
    ).resolves.toMatchObject({
      dependencies: [expect.objectContaining({ status: "missing" })],
    });

    const manifest = sequenceWorkspaceSessionManifestSchema.parse(
      JSON.parse(await readFile(manifestPath, "utf8")),
    );
    manifest.dependencies[0]!.required = true;
    await writeFile(manifestPath, `${JSON.stringify(manifest)}\n`);
    listed = await fixture.manager.list(
      { sessionId: fixture.sessionId },
      fixture.extra,
    );
    await expect(
      fixture.manager.resolve(
        listed.candidates[0]!.candidateId,
        fixture.sessionId,
        undefined,
        fixture.extra,
      ),
    ).rejects.toThrow("Required workspace dependency");
  });

  it("rejects expired, cross-viewer, changed-manifest, changed-source, and cancelled restores", async () => {
    let now = 1_750_000_000_000;
    const fixture = await createFixture({ now: () => now });
    const manifestPath = await publishManifest(
      fixture,
      validSession("sequence"),
      "durable.sequence-viewer.session.json",
    );
    let listed = await fixture.manager.list(
      { sessionId: fixture.sessionId },
      fixture.extra,
    );
    const candidateId = listed.candidates[0]!.candidateId;
    await expect(
      fixture.manager.resolve(candidateId, randomUUID(), undefined, fixture.extra),
    ).rejects.toThrow("another viewer");

    const cancelled = new AbortController();
    cancelled.abort(new DOMException("cancelled", "AbortError"));
    await expect(
      fixture.manager.resolve(
        candidateId,
        fixture.sessionId,
        cancelled.signal,
        fixture.extra,
      ),
    ).rejects.toMatchObject({ name: "AbortError" });

    await writeFile(manifestPath, await readFile(manifestPath));
    await expect(
      fixture.manager.resolve(
        candidateId,
        fixture.sessionId,
        undefined,
        fixture.extra,
      ),
    ).rejects.toThrow(/changed/u);

    listed = await fixture.manager.list(
      { sessionId: fixture.sessionId },
      fixture.extra,
    );
    await writeFile(fixture.sourcePath, ">source\nTGCA\n");
    await expect(
      fixture.manager.resolve(
        listed.candidates[0]!.candidateId,
        fixture.sessionId,
        undefined,
        fixture.extra,
      ),
    ).rejects.toThrow();

    now += 20 * 60 * 1_000;
    await expect(
      fixture.manager.resolve(candidateId, fixture.sessionId, undefined, fixture.extra),
    ).rejects.toThrow("expired");
  });
});

async function createFixture({ now }: { now?: () => number } = {}) {
  const root = await mkdtemp(path.join(os.tmpdir(), "sequence-session-test-"));
  temporaryDirectories.push(root);
  const sourceDirectory = path.join(root, "data");
  await mkdir(sourceDirectory);
  const sourcePath = path.join(sourceDirectory, "source.fasta");
  await writeFile(sourcePath, ">source\nACGT\n");
  const extra = {
    async sendRequest() {
      return { roots: [{ uri: pathToFileURL(root).href }] };
    },
  } as unknown as RootsRequestExtra;
  const sessionId = randomUUID();
  const publisher = new SequenceWorkspaceExportPublisher({ now });
  await publisher.bindSession(sessionId, sourcePath, extra);
  return {
    extra,
    manager: new SequenceWorkspaceSessionManager(publisher, { now }),
    publisher,
    root,
    sessionId,
    sourceDirectory,
    sourcePath,
  };
}

async function publishManifest(
  fixture: Awaited<ReturnType<typeof createFixture>>,
  payload: string,
  name: string,
): Promise<string> {
  const declaration: SequenceWorkbenchPayloadDeclaration = {
    byteLength: Buffer.byteLength(payload),
    callerId: randomUUID(),
    commandId: randomUUID(),
    destination: {
      base: "opened-source",
      kind: "workspace",
      relativePath: name,
    },
    kind: "session",
    name,
    sessionId: fixture.sessionId,
    sha256: sha256(payload),
    uploadId: randomUUID(),
  };
  const plan = await fixture.publisher.prepare(declaration, undefined, fixture.extra);
  if (plan == null) throw new Error("Expected a workspace plan.");
  const prepared = await createSequenceWorkspaceSessionManifest(payload, plan);
  await fixture.publisher.publish(
    plan,
    prepared.bytes,
    prepared.sha256,
    new AbortController().signal,
    fixture.extra,
  );
  return plan.outputPath;
}

function validSession(
  mode: "alignment" | "sequence",
  dependency?: { trackHash: string; trackWorkspacePath: string },
): string {
  return JSON.stringify({
    artifacts: [],
    createdAt: 1,
    dirty: false,
    jobs: [],
    revision: 0,
    schemaVersion: 1,
    source: {
      fileName: "source.fasta",
      format: mode === "sequence" ? "fasta" : "aligned-fasta",
      stateKey: "source-state",
    },
    tracks:
      dependency == null
        ? []
        : [
            {
              features: [],
              format: "bed",
              id: "track-1",
              kind: "annotations",
              mapping: {
                matchedReference: null,
                requestedReference: null,
                status: "unresolved",
                unmatchedReferences: [],
              },
              name: "features.bed",
              source: {
                contentHash: dependency.trackHash,
                displayName: "features.bed",
                workspacePath: dependency.trackWorkspacePath,
              },
              summary: { itemCount: 0, references: [], truncated: false },
            },
          ],
    view:
      mode === "sequence"
        ? { mode, sequence: sequenceView() }
        : { alignment: alignmentView(), mode },
  });
}

function sequenceView() {
  return {
    geneticCodeId: 1,
    layout: "linear",
    orientation: "forward",
    paletteId: "neutral",
    selectedFeatureId: null,
    selectedRecordId: "source",
    selection: null,
    showFeatures: true,
    showQuality: true,
    showTranslation: true,
    synchronizedViews: true,
    viewport: null,
    wrapWidth: 60,
  };
}

function alignmentView() {
  return {
    analysisScope: "all-unhidden-rows",
    cellWidth: 24,
    colorMode: "identity",
    referenceMode: "none",
    residuePalette: null,
    rowFilter: "",
    searchScope: "currently-displayed-rows",
    selectedColumns: null,
    selectedRows: [],
    showAnnotationTracks: true,
    showIdenticalAsDots: false,
    showRnaStructureOverlays: true,
  };
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}
