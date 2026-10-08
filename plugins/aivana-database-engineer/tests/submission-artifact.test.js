const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { listReleaseFiles } = require("../scripts/package-release");

const repoRoot = path.resolve(__dirname, "..", "..", "..");

function listSubmissionFiles() {
  return listReleaseFiles();
}

test("repository root contains required Codex plugin manifest", () => {
  const manifestPath = path.join(repoRoot, ".codex-plugin", "plugin.json");
  assert.equal(fs.existsSync(manifestPath), true, ".codex-plugin/plugin.json must exist at repository root");

  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  assert.equal(manifest.name, "sqlserver-postgres-performance-advisor");
  assert.equal(manifest.skills, "./plugins/sqlserver-postgres-performance-advisor/skills/");
});

test("submission artifact stays within scanner file-count limit", () => {
  const files = listSubmissionFiles();
  assert.ok(files.length <= 128, `submission has ${files.length} files, limit is 128`);
  assert.ok(files.includes(".codex-plugin/plugin.json"));
  assert.ok(files.includes("runtime/runTool.js"));
  assert.ok(files.includes("package-lock.json"));
  assert.ok(files.includes("assets/aivana-database-engineer.png"));
  const manifest = JSON.parse(fs.readFileSync(path.join(repoRoot, "plugins", "sqlserver-postgres-performance-advisor", ".codex-plugin", "plugin.json"), "utf8"));
  assert.equal(manifest.interface.displayName, "Aivana Database Engineer");
  assert.ok(files.includes(manifest.interface.logo.replace(/^\.\//, "")));
  assert.ok(files.includes(manifest.interface.composerIcon.replace(/^\.\//, "")));
  assert.ok(files.includes("skills/sql-performance-advisor/SKILL.md"));
  assert.ok(!files.some((file) => /(^|\/)(node_modules|\.codexdb|state)(\/|$)/.test(file)));
  assert.ok(!files.some((file) => /(^|\/)\.env($|\.(?!example$))/.test(file)));
});
