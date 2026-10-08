import { randomUUID } from "node:crypto";
import {
  link,
  mkdir,
  mkdtemp,
  rm,
  rename,
  symlink,
  truncate,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { afterEach, describe, expect, it } from "vitest";

import type { RootsRequestExtra } from "./chat-file-resource";
import {
  inferWorkspaceTrackFile,
  SequenceWorkspaceTrackBrowser,
} from "./workspace-track-browser";
import { SequenceWorkspaceExportPublisher } from "./workspace-export-publisher";

const temporaryDirectories: Array<string> = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { force: true, recursive: true })),
  );
});

describe("workspace track browser", () => {
  it.each([
    ["genes.gff.gz", "gff3", "annotation"],
    ["genes.gff.bgz", "gff3", "annotation"],
    ["genes.gff3.bgzf", "gff3", "annotation"],
    ["genes.gtf", "gtf", "annotation"],
    ["regions.bed.gz", "bed", "annotation"],
    ["regions.bed.bgzip", "bed", "annotation"],
    ["variants.vcf.gz", "vcf", "variant"],
    ["variants.vcf.bgzf", "vcf", "variant"],
    ["reads.sam", "sam", "reads"],
    ["reads.bam", "bam", "reads"],
    ["reads.bam.bai", "bai", "index"],
    ["reads.csi", "csi", "index"],
    ["reads.cram", "cram", "reads"],
    ["reads.cram.crai", "crai", "index"],
    ["reference.fna.gz", "fasta", "reference"],
    ["reference.fasta.bgz", "fasta", "reference"],
  ] as const)("recognizes %s", (name, format, role) => {
    expect(inferWorkspaceTrackFile(name)).toEqual({ format, role });
  });

  it("lists one stable bounded page with safe relative metadata", async () => {
    const fixture = await createFixture();
    await Promise.all([
      writeFile(path.join(fixture.data, "a.gff3"), "##gff-version 3\n"),
      writeFile(path.join(fixture.data, "b.vcf"), "##fileformat=VCFv4.3\n"),
      writeFile(path.join(fixture.data, "ignored.txt"), "nope\n"),
      mkdir(path.join(fixture.data, "nested")),
    ]);
    let fileSymlinkAvailable = true;
    try {
      await symlink(
        path.join(fixture.data, "a.gff3"),
        path.join(fixture.data, "linked.gff3"),
        "file",
      );
    } catch (error) {
      if (
        process.platform !== "win32" ||
        !(error instanceof Error) ||
        !("code" in error) ||
        (error.code !== "EPERM" && error.code !== "EACCES")
      ) {
        throw error;
      }
      fileSymlinkAvailable = false;
    }
    const first = await fixture.browser.listDirectory({
      limit: 2,
      sessionId: fixture.sessionId,
    });
    expect(first.entries).toHaveLength(2);
    expect(first.nextCursor).toBeDefined();
    expect(first.omittedEntries).toBe(fileSymlinkAvailable ? 2 : 1);
    expect(JSON.stringify(first)).not.toContain(fixture.root);
    expect(first.breadcrumbs[0]?.workspacePath).toBe(".");
    const second = await fixture.browser.listDirectory({
      cursor: first.nextCursor,
      directoryCandidateId: first.directory.candidateId,
      limit: 2,
      sessionId: fixture.sessionId,
    });
    expect([
      ...first.entries.map(({ workspacePath }) => workspacePath),
      ...second.entries.map(({ workspacePath }) => workspacePath),
    ]).toEqual([
      "data/a.gff3",
      "data/b.vcf",
      "data/nested",
      "data/source.fasta",
    ]);
  });

  it("rejects stale cursors after a directory change", async () => {
    const fixture = await createFixture();
    await Promise.all([
      writeFile(path.join(fixture.data, "a.bed"), "chr1\t0\t1\n"),
      writeFile(path.join(fixture.data, "b.bed"), "chr1\t1\t2\n"),
    ]);
    const first = await fixture.browser.listDirectory({
      limit: 1,
      sessionId: fixture.sessionId,
    });
    await writeFile(path.join(fixture.data, "c.bed"), "chr1\t2\t3\n");
    await expect(
      fixture.browser.listDirectory({
        cursor: first.nextCursor,
        directoryCandidateId: first.directory.candidateId,
        limit: 1,
        sessionId: fixture.sessionId,
      }),
    ).rejects.toThrow(/stale or invalid/u);
  });

  it("resolves and reads an unambiguous BAM bundle without disclosing paths", async () => {
    const fixture = await createFixture();
    await Promise.all([
      writeFile(path.join(fixture.data, "reads.bam"), "bam-bytes"),
      writeFile(path.join(fixture.data, "reads.bam.bai"), "index-bytes"),
    ]);
    const listing = await fixture.browser.listDirectory({
      limit: 50,
      sessionId: fixture.sessionId,
    });
    const primary = fileEntry(listing, "reads.bam");
    expect(primary.bundle).toMatchObject({
      indexMatches: 1,
      indexStatus: "ready",
      referenceStatus: "not-required",
    });
    const resolved = await fixture.browser.resolveBundle({
      primaryCandidateId: primary.candidateId,
      sessionId: fixture.sessionId,
    });
    expect(resolved).toMatchObject({ ready: true });
    expect(JSON.stringify(resolved)).not.toContain(fixture.root);
    const bundle = await fixture.browser.readBundle(
      resolved.bundleId!,
      fixture.sessionId,
    );
    expect(Buffer.from(bundle.primary.bytes).toString()).toBe("bam-bytes");
    expect(Buffer.from(bundle.index!.bytes).toString()).toBe("index-bytes");
    expect(bundle.primary.workspacePath).toBe("data/reads.bam");
  });

  it("requires explicit companion selection when index or reference inference is ambiguous", async () => {
    const fixture = await createFixture();
    await Promise.all([
      writeFile(path.join(fixture.data, "reads.bam"), "bam"),
      writeFile(path.join(fixture.data, "reads.bam.bai"), "bai"),
      writeFile(path.join(fixture.data, "reads.csi"), "csi"),
      writeFile(path.join(fixture.data, "reads.cram"), "cram"),
      writeFile(path.join(fixture.data, "reads.cram.crai"), "crai"),
      writeFile(path.join(fixture.data, "other.fa"), ">chr1\nACGT\n"),
    ]);
    const listing = await fixture.browser.listDirectory({
      limit: 50,
      sessionId: fixture.sessionId,
    });
    const bam = await fixture.browser.resolveBundle({
      primaryCandidateId: fileEntry(listing, "reads.bam").candidateId,
      sessionId: fixture.sessionId,
    });
    expect(bam).toMatchObject({
      ready: false,
      requirements: [
        expect.objectContaining({ role: "index", status: "ambiguous" }),
      ],
    });
    const cram = await fixture.browser.resolveBundle({
      primaryCandidateId: fileEntry(listing, "reads.cram").candidateId,
      sessionId: fixture.sessionId,
    });
    expect(cram.requirements).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ role: "index", status: "selected" }),
        expect.objectContaining({ role: "reference", status: "ambiguous" }),
      ]),
    );
  });

  it("binds candidates to session, source identity, expiry, cancellation, and non-aliasing", async () => {
    let now = 1_000;
    const fixture = await createFixture(() => now);
    const trackPath = path.join(fixture.data, "track.bed");
    await writeFile(trackPath, "chr1\t0\t2\n");
    const listing = await fixture.browser.listDirectory({
      limit: 50,
      sessionId: fixture.sessionId,
    });
    const candidate = fileEntry(listing, "track.bed");
    await expect(
      fixture.browser.resolveBundle({
        primaryCandidateId: candidate.candidateId,
        sessionId: randomUUID(),
      }),
    ).rejects.toThrow(/belongs to another viewer|unavailable/u);
    await truncate(trackPath, 2);
    await expect(
      fixture.browser.resolveBundle({
        primaryCandidateId: candidate.candidateId,
        sessionId: fixture.sessionId,
      }),
    ).rejects.toThrow(/changed/u);

    const refreshed = await fixture.browser.listDirectory({
      limit: 50,
      sessionId: fixture.sessionId,
    });
    now += 5 * 60_000;
    await expect(
      fixture.browser.resolveBundle({
        primaryCandidateId: fileEntry(refreshed, "track.bed").candidateId,
        sessionId: fixture.sessionId,
      }),
    ).rejects.toThrow(/expired/u);
    const controller = new AbortController();
    controller.abort(new DOMException("cancelled", "AbortError"));
    await expect(
      fixture.browser.listDirectory(
        { limit: 50, sessionId: fixture.sessionId },
        { ...fixture.extra, signal: controller.signal },
      ),
    ).rejects.toMatchObject({ name: "AbortError" });
  });

  it("rejects hard-linked bundle aliases", async () => {
    const fixture = await createFixture();
    const bamPath = path.join(fixture.data, "reads.bam");
    await writeFile(bamPath, "same-inode");
    await link(bamPath, path.join(fixture.data, "reads.bam.bai"));
    const listing = await fixture.browser.listDirectory({
      limit: 50,
      sessionId: fixture.sessionId,
    });
    await expect(
      fixture.browser.resolveBundle({
        primaryCandidateId: fileEntry(listing, "reads.bam").candidateId,
        sessionId: fixture.sessionId,
      }),
    ).rejects.toThrow(/alias/u);
  });

  it("revalidates resolved files, source bindings, and root identity before use", async () => {
    const fixture = await createFixture();
    const trackPath = path.join(fixture.data, "track.bed");
    await writeFile(trackPath, "chr1\t0\t2\n");
    const listing = await fixture.browser.listDirectory({
      limit: 50,
      sessionId: fixture.sessionId,
    });
    const resolved = await fixture.browser.resolveBundle({
      primaryCandidateId: fileEntry(listing, "track.bed").candidateId,
      sessionId: fixture.sessionId,
    });
    await truncate(trackPath, 2);
    await expect(
      fixture.browser.readBundle(resolved.bundleId!, fixture.sessionId),
    ).rejects.toThrow(/changed/u);

    await writeFile(trackPath, "chr1\t0\t3\n");
    const reboundListing = await fixture.browser.listDirectory({
      limit: 50,
      sessionId: fixture.sessionId,
    });
    const otherSource = path.join(fixture.data, "other-source.fasta");
    await writeFile(otherSource, ">chr1\nAAAA\n");
    await fixture.publisher.bindSession(
      fixture.sessionId,
      otherSource,
      fixture.extra,
    );
    await expect(
      fixture.browser.resolveBundle({
        primaryCandidateId: fileEntry(reboundListing, "track.bed").candidateId,
        sessionId: fixture.sessionId,
      }),
    ).rejects.toThrow(/expired|belongs|changed/u);

    const movedRoot = `${fixture.root}-moved`;
    await rename(fixture.root, movedRoot);
    await mkdir(fixture.root);
    await expect(
      fixture.browser.listDirectory({
        limit: 50,
        sessionId: fixture.sessionId,
      }),
    ).rejects.toThrow(/source or root/u);
  });
});

async function createFixture(now?: () => number) {
  const directory = await mkdtemp(path.join(os.tmpdir(), "sequence-tracks-"));
  temporaryDirectories.push(directory);
  const root = path.join(directory, "project");
  const data = path.join(root, "data");
  await mkdir(data, { recursive: true });
  const sourcePath = path.join(data, "source.fasta");
  await writeFile(sourcePath, ">chr1\nACGT\n");
  const sessionId = randomUUID();
  const extra = rootsExtra([root]);
  const publisher = new SequenceWorkspaceExportPublisher();
  await publisher.bindSession(sessionId, sourcePath, extra);
  return {
    browser: new SequenceWorkspaceTrackBrowser(publisher, { now }),
    data,
    extra,
    publisher,
    root,
    sessionId,
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

function fileEntry(
  listing: Awaited<ReturnType<SequenceWorkspaceTrackBrowser["listDirectory"]>>,
  label: string,
) {
  const entry = listing.entries.find(
    (candidate) => candidate.kind === "file" && candidate.label === label,
  );
  if (entry?.kind !== "file") throw new Error(`Missing ${label}.`);
  return entry;
}
