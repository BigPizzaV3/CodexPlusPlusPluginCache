import { execFile as execFileCallback } from "node:child_process";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

import { afterEach, describe, expect, it } from "vitest";

import {
  SOURCE_SNAPSHOT_EXCLUDED_EVIDENCE_FILES,
  assertQualificationSourceSnapshotMatches,
  digestTrackedPluginSource,
} from "./source-snapshot.mjs";

const execFile = promisify(execFileCallback);
const temporaryRoots = [];

afterEach(async () => {
  await Promise.all(
    temporaryRoots.splice(0).map((root) =>
      rm(root, { force: true, recursive: true }),
    ),
  );
});

describe("LSC-109 tracked source snapshots", () => {
  it("binds tracked plugin content while excluding only the evidence pair", async () => {
    const root = await createTrackedPlugin();
    const baseline = await digestTrackedPluginSource(root);

    await writeFile(
      path.join(root, "LSC_109_QUALIFICATION.md"),
      "updated report\n",
    );
    await writeFile(
      path.join(root, "lsc-109-qualification.json"),
      '{"updated":true}\n',
    );
    expect(await digestTrackedPluginSource(root)).toEqual(baseline);

    await writeFile(path.join(root, "src/server.ts"), "export const value = 2;\n");
    expect((await digestTrackedPluginSource(root)).sha256).not.toBe(
      baseline.sha256,
    );
    expect(baseline.excludedEvidenceFiles).toEqual(
      SOURCE_SNAPSHOT_EXCLUDED_EVIDENCE_FILES,
    );
  });

  it("is independent of repository topology for identical tracked content", async () => {
    const first = await createTrackedPlugin();
    const second = await createTrackedPlugin();

    expect(await digestTrackedPluginSource(second)).toEqual(
      await digestTrackedPluginSource(first),
    );
  });

  it("rejects source drift and any widened evidence exclusion", async () => {
    const root = await createTrackedPlugin();
    const expected = await digestTrackedPluginSource(root);
    const drifted = { ...expected, sha256: "f".repeat(64) };
    expect(() =>
      assertQualificationSourceSnapshotMatches(expected, drifted),
    ).toThrow(/source sha256 does not match/u);

    const widened = {
      ...expected,
      excludedEvidenceFiles: [
        ...expected.excludedEvidenceFiles,
        "src/server.ts",
      ],
    };
    expect(() =>
      assertQualificationSourceSnapshotMatches(expected, widened),
    ).toThrow(/may exclude only/u);
  });
});

async function createTrackedPlugin() {
  const root = await mkdtemp(path.join(os.tmpdir(), "sequence-source-snapshot-"));
  temporaryRoots.push(root);
  await mkdir(path.join(root, "src"), { recursive: true });
  await Promise.all([
    writeFile(path.join(root, "src/server.ts"), "export const value = 1;\n"),
    writeFile(path.join(root, "README.md"), "viewer\n"),
    writeFile(path.join(root, "LSC_109_QUALIFICATION.md"), "report\n"),
    writeFile(path.join(root, "lsc-109-qualification.json"), "{}\n"),
  ]);
  await execFile("git", ["init", "--quiet"], { cwd: root });
  await execFile("git", ["add", "--", "."], { cwd: root });
  return root;
}
