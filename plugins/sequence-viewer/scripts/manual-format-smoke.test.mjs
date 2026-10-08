import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const pluginDirectory = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

describe("manual format smoke CLI", () => {
  it("accepts the conventional argument separator without treating it as a path", () => {
    const result = spawnSync(
      process.execPath,
      [
        path.join(pluginDirectory, "scripts/manual-format-smoke.mjs"),
        "--",
        "smoke-fixtures/dna-single.fasta",
      ],
      { cwd: pluginDirectory, encoding: "utf8" },
    );

    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).not.toContain('"input":"--"');
    expect(JSON.parse(result.stdout.trim())).toMatchObject({
      format: "fasta",
      input: "smoke-fixtures/dna-single.fasta",
      status: "success",
      viewer: "sequence",
    });
  });
});
