import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (path) => readFileSync(join(root, path), "utf8");
const manifest = JSON.parse(read(".codex-plugin/plugin.json"));
const hook = read("hooks/track-session.sh");
const setup = read("setup.sh");
const statusSkill = read("skills/quarryfi-status/SKILL.md");
const submission = read("docs/openai-directory-submission.md");

assert.equal(manifest.name, "quarryfi-time-tracker");
assert.equal(manifest.version, "0.4.7");
assert.equal("hooks" in manifest, false);
assert.equal(existsSync(join(root, "hooks", "hooks.json")), true, "default hook bundle must exist");
assert.equal(existsSync(join(root, "hooks.json")), false, "legacy root hook bundle must not be duplicated");
assert.equal(manifest.license, "MIT");
assert.match(manifest.interface.longDescription, /does not determine tax-credit eligibility/i);
assert.equal(manifest.interface.composerIcon, "./assets/quarryfi-mark.png");
assert.equal(manifest.interface.logo, "./assets/quarryfi-mark.png");
assert.equal(manifest.interface.logoDark, "./assets/quarryfi-mark.png");
assert.ok(manifest.interface.shortDescription.length <= 30);
assert.equal(manifest.interface.defaultPrompt.length, 3);
for (const assetPath of [manifest.interface.composerIcon, manifest.interface.logo, manifest.interface.logoDark]) {
  const asset = join(root, assetPath.replace(/^\.\//, ""));
  assert.equal(existsSync(asset), true, `${assetPath} must exist`);
  const png = readFileSync(asset);
  assert.deepEqual([...png.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
}
assert.equal(existsSync(join(root, "LICENSE")), true);
assert.equal(existsSync(join(root, "SECURITY.md")), true);
assert.ok((statSync(join(root, "setup.sh")).mode & 0o111) !== 0, "setup.sh must be executable");
for (const groups of Object.values(JSON.parse(read("hooks/hooks.json")).hooks ?? {})) {
  for (const group of groups) {
    for (const registeredHook of group.hooks ?? []) {
      assert.match(
        registeredHook.command,
        /^bash "\$PLUGIN_ROOT\/hooks\/track-session\.sh" /,
        "marketplace hooks must tolerate archives that strip executable bits",
      );
    }
  }
}

assert.match(hook, /normalize_api_url\(\)/);
assert.match(hook, /echo "\$DEFAULT_API_URL"/);
assert.match(hook, /--proto '=https'/);
assert.match(hook, /--tlsv1\.2/);
assert.match(hook, /json_escape/);
assert.match(setup, /read -srp "  API Key \(input hidden\): "/);
assert.doesNotMatch(setup, /API URL \[/);
assert.match(setup, /chmod 700 "\$CONFIG_DIR"/);
assert.match(setup, /chmod 600 "\$config_tmp"/);
assert.match(statusSkill, /Do not use a configured `api_url` value/);
assert.match(statusSkill, /Never ask the user to paste a tracker key into Codex/);

const positiveBlock = submission.match(/## Positive review cases([\s\S]*?)## Negative review cases/)?.[1] ?? "";
const negativeBlock = submission.match(/## Negative review cases([\s\S]*?)## Review fixture/)?.[1] ?? "";
assert.equal((positiveBlock.match(/^\d+\./gm) ?? []).length, 5, "submission needs five positive cases");
assert.equal((negativeBlock.match(/^\d+\./gm) ?? []).length, 3, "submission needs three negative cases");

for (const contents of [manifest.description, manifest.interface.longDescription, hook, setup, statusSkill]) {
  assert.ok(!contents.includes("quarryfi.smashedstudiosllc.workers.dev"));
}

execFileSync("bash", ["-n", join(root, "hooks/track-session.sh")]);
execFileSync("bash", ["-n", join(root, "setup.sh")]);
console.log("OpenAI directory submission readiness checks passed.");
