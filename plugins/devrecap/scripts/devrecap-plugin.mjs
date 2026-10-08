#!/usr/bin/env node

import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { readFileSync } from "node:fs";

const major = Number(process.versions.node.split(".")[0] ?? 0);
if (!Number.isFinite(major) || major < 24) {
  process.stderr.write(`DevRecap requires Node.js 24 or newer. Current version: ${process.version}\n`);
  process.exitCode = 1;
} else {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

  if (process.argv.includes("--plugin-info")) {
    const manifest = JSON.parse(readFileSync(join(root, "plugin.json"), "utf8"));
    const htmlSource = readFileSync(join(root, "packages", "report-engine", "src", "html.ts"), "utf8");
    const renderer = htmlSource.includes("--forest:#19372f") && htmlSource.includes("brand-mark") && htmlSource.includes("derecap")
      ? "editorial-v2"
      : "legacy-or-unknown";

    process.stdout.write(`${JSON.stringify({
      pluginVersion: manifest.version,
      renderer,
      pluginRoot: root,
    })}\n`);
  } else {
    // Marketplace installs bundle the full DevRecap source tree. Create the
    // lightweight workspace links before loading the TypeScript CLI so the user
    // does not need npm install or a globally linked devrecap binary.
    process.env.DEVRECAP_LINK_QUIET = "1";
    await import(pathToFileURL(join(root, "scripts", "link-workspaces.mjs")).href);
    await import(pathToFileURL(join(root, "apps", "cli", "src", "index.ts")).href);
  }
}
