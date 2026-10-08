import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const [flag, ...testFiles] = process.argv.slice(2);
const supportedFlags = new Set([
  "SEQUENCE_VIEWER_LARGE_WORKSPACE_QUALIFICATION",
  "SEQUENCE_VIEWER_PUBLIC_EXAMPLES_LIVE",
]);

if (!supportedFlags.has(flag) || testFiles.length === 0) {
  throw new Error("An explicit supported Sequence qualification is required.");
}

const vitestPath = fileURLToPath(
  new URL("../node_modules/vitest/vitest.mjs", import.meta.url),
);
const child = spawn(
  process.execPath,
  [vitestPath, "run", ...testFiles, "--maxWorkers=1", "--no-file-parallelism"],
  {
    env: { ...process.env, [flag]: "1" },
    stdio: "inherit",
    windowsHide: true,
  },
);

process.exitCode = await new Promise((resolve, reject) => {
  child.once("error", reject);
  child.once("exit", (code, signal) => {
    resolve(code ?? (signal == null ? 1 : 128));
  });
});
