import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  assertQualificationBundleMatches,
  BUNDLE_DIGEST_ALGORITHM,
  digestBundle,
} from "./bundle-digest.mjs";
import {
  assertQualificationBundleWhenRequired,
  shouldValidateQualification,
} from "./bundle.mjs";

describe("bundle digest", () => {
  it("binds sorted paths, byte lengths, and file digests", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "sequence-bundle-digest-"));
    await mkdir(path.join(root, "nested"));
    await writeFile(path.join(root, "z.txt"), "z\n");
    await writeFile(path.join(root, "nested/a.txt"), "alpha\n");

    const first = await digestBundle(root);
    const second = await digestBundle(root);
    expect(first).toEqual(second);
    expect(first).toEqual(
      expect.objectContaining({
        byteLength: 8,
        digestAlgorithm: BUNDLE_DIGEST_ALGORITHM,
        fileCount: 2,
        sha256: expect.stringMatching(/^[a-f0-9]{64}$/u),
      }),
    );

    await writeFile(path.join(root, "z.txt"), "zz\n");
    expect((await digestBundle(root)).sha256).not.toBe(first.sha256);
  });

  it("rejects any generated bundle metadata drift", () => {
    const expected = {
      byteLength: 10,
      fileCount: 2,
      manifestSha256: "b".repeat(64),
      sha256: "a".repeat(64),
      starterContractSha256: "c".repeat(64),
    };
    expect(() => assertQualificationBundleMatches(expected, expected)).not.toThrow();
    for (const [field, driftedValue] of [
      ["byteLength", 11],
      ["fileCount", 3],
      ["manifestSha256", "d".repeat(64)],
      ["sha256", "e".repeat(64)],
      ["starterContractSha256", "f".repeat(64)],
    ]) {
      expect(() =>
        assertQualificationBundleMatches(
          { ...expected, [field]: driftedValue },
          expected,
        ),
      ).toThrow(new RegExp(`bundle ${field}`, "u"));
    }
  });

  it("rejects missing qualified metadata instead of treating it as a match", () => {
    const expected = {
      byteLength: 10,
      fileCount: 2,
      manifestSha256: "b".repeat(64),
      sha256: "a".repeat(64),
      starterContractSha256: "c".repeat(64),
    };

    for (const field of Object.keys(expected)) {
      const incomplete = { ...expected };
      delete incomplete[field];
      expect(() =>
        assertQualificationBundleMatches(expected, incomplete),
      ).toThrow(new RegExp(`bundle ${field}`, "u"));
    }
  });

  it("keeps normal bundles strict while allowing qualification regeneration", () => {
    const qualified = {
      byteLength: 10,
      fileCount: 2,
      manifestSha256: "b".repeat(64),
      sha256: "a".repeat(64),
      starterContractSha256: "c".repeat(64),
    };
    const generated = { ...qualified, sha256: "d".repeat(64) };
    expect(shouldValidateQualification("enforce")).toBe(true);
    expect(shouldValidateQualification("regenerate")).toBe(false);
    expect(() =>
      assertQualificationBundleWhenRequired({
        generatedBundle: generated,
        qualificationBundle: qualified,
        qualificationMode: "enforce",
      }),
    ).toThrow(/bundle sha256/u);
    expect(() =>
      assertQualificationBundleWhenRequired({
        generatedBundle: generated,
        qualificationBundle: qualified,
        qualificationMode: "regenerate",
      }),
    ).not.toThrow();
    expect(() => shouldValidateQualification("skip")).toThrow(
      /Unsupported qualification mode/u,
    );
  });
});
