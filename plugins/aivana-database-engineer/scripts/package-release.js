const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const crypto = require("node:crypto");
const { execFileSync } = require("node:child_process");
const root = path.resolve(__dirname, "..");

function listReleaseFiles() {
  const options = { cwd: root, encoding: "utf8" };
  const output = process.env.npm_execpath
    ? execFileSync(process.execPath, [process.env.npm_execpath, "pack", "--dry-run", "--json", "--ignore-scripts"], options)
    : process.platform === "win32"
      ? execFileSync("cmd.exe", ["/d", "/s", "/c", "npm pack --dry-run --json --ignore-scripts"], options)
      : execFileSync("npm", ["pack", "--dry-run", "--json", "--ignore-scripts"], options);
  // npm pack omits package-lock.json, but standalone plugin installs need npm ci.
  const files = [...new Set([...JSON.parse(output)[0].files.map((file) => file.path), "package-lock.json"])].sort();
  if (files.length > 128) throw new Error(`Release exceeds 128 files: ${files.length}`);
  for (const file of files) {
    if (path.isAbsolute(file) || file.split(/[\\/]/).includes("..") ||
        /(^|\/)(node_modules|\.codexdb|state)(\/|$)/.test(file) ||
        /(^|\/)\.env($|\.(?!example$))/.test(file)) {
      throw new Error(`Unsafe release entry: ${file}`);
    }
  }
  return files;
}

function buildRelease() {
  const files = listReleaseFiles();
  const manifest = JSON.parse(fs.readFileSync(path.join(root, ".codex-plugin/plugin.json"), "utf8"));
  if (!/^[a-z0-9-]+$/.test(manifest.name)) throw new Error("Invalid plugin name");
  const stage = fs.mkdtempSync(path.join(os.tmpdir(), "codexdb-release-"));
  const outputDir = path.join(root, "dist");
  fs.mkdirSync(outputDir, { recursive: true });
  const archive = path.join(outputDir, `${manifest.name}-candidate.tgz`);
  try {
    for (const file of files) {
      const target = path.join(stage, manifest.name, file);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.copyFileSync(path.join(root, file), target);
    }
    execFileSync("tar", ["-czf", archive, "-C", stage, manifest.name]);
    const sha256 = crypto.createHash("sha256").update(fs.readFileSync(archive)).digest("hex");
    fs.writeFileSync(`${archive}.sha256`, `${sha256}  ${path.basename(archive)}\n`);
    console.log(JSON.stringify({ archive, sha256, files: files.length, status: "candidate_not_published" }, null, 2));
  } finally {
    fs.rmSync(stage, { recursive: true, force: true });
  }
}

module.exports = { listReleaseFiles };
if (require.main === module) buildRelease();
