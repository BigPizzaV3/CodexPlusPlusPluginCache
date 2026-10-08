import { readFile } from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { SEQUENCE_VIEWER_VERSION } from "./version";

const MARKETPLACE_SHORT_DESCRIPTION =
  "Inspect, analyze, and compare biological sequences and alignments in Codex.";

describe("plugin manifest", () => {
  it("keeps the marketplace short description on the approved tagline", async () => {
    const manifest = await readJson(".codex-plugin", "plugin.json");

    expect(manifest.interface?.shortDescription).toBe(
      MARKETPLACE_SHORT_DESCRIPTION,
    );
  });

  it("keeps package and runtime versions synchronized", async () => {
    const [manifest, packageManifest] = await Promise.all([
      readJson(".codex-plugin", "plugin.json"),
      readJson("package.json"),
    ]);

    expect(manifest.version).toBe(SEQUENCE_VIEWER_VERSION);
    expect(packageManifest.version).toBe(SEQUENCE_VIEWER_VERSION);
  });
});

async function readJson(...segments: string[]) {
  return JSON.parse(
    await readFile(path.join(process.cwd(), ...segments), "utf8"),
  );
}
