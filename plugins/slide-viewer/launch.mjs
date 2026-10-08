import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";

export const MINIMUM_SLIDE_NODE_VERSION = "22.23.2";

/** Runs before importing the bundled scientific dependencies. Never installs a runtime. */
export function assertSlideNodeRuntime(version) {
  const parsed = /^(\d+)\.(\d+)\.(\d+)$/.exec(version);
  const required = MINIMUM_SLIDE_NODE_VERSION.split(".").map(Number);
  const actual = parsed?.slice(1).map(Number);
  const supported =
    actual != null &&
    actual.every(Number.isSafeInteger) &&
    (actual[0] > required[0] ||
      (actual[0] === required[0] && actual[1] > required[1]) ||
      (actual[0] === required[0] &&
        actual[1] === required[1] &&
        actual[2] >= required[2]));
  if (!supported) {
    throw new Error(
      `Slide Viewer requires Node ${MINIMUM_SLIDE_NODE_VERSION} or newer; the MCP host supplied ${version}. ` +
        "Configure the host's Node runtime and restart the viewer. No runtime was downloaded or system setting changed.",
    );
  }
}

function isLauncherEntry() {
  if (process.argv[1] == null) return false;
  try {
    return (
      realpathSync(process.argv[1]) ===
      realpathSync(fileURLToPath(import.meta.url))
    );
  } catch {
    return false;
  }
}

if (isLauncherEntry()) {
  assertSlideNodeRuntime(process.versions.node);
  const { startSlideViewerServer } = await import("./dist/server.mjs");
  await startSlideViewerServer();
}
