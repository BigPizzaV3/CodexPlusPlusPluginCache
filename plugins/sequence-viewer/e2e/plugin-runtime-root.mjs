import { access, readFile, realpath, stat } from "node:fs/promises";
import path from "node:path";

const EXPECTED_PLUGIN_NAME = "sequence-viewer";

export async function resolveSequenceViewerRuntimeRoot(
  sourceRoot,
  {
    configuredRoot =
      process.env.SEQUENCE_VIEWER_E2E_PLUGIN_ROOT?.trim() ?? "",
  } = {},
) {
  if (configuredRoot !== "" && !path.isAbsolute(configuredRoot)) {
    throw new Error(
      "SEQUENCE_VIEWER_E2E_PLUGIN_ROOT must be an absolute plugin directory.",
    );
  }

  const runtimeRoot = await realpath(configuredRoot || sourceRoot);
  const runtimeStat = await stat(runtimeRoot);
  if (!runtimeStat.isDirectory()) {
    throw new Error("The Sequence Viewer E2E runtime root must be a directory.");
  }

  const [manifest, starterContract, mcpConfig] = await Promise.all([
    readJson(path.join(runtimeRoot, ".codex-plugin/plugin.json"), "manifest"),
    readJson(path.join(runtimeRoot, "starter-examples.json"), "starter contract"),
    readJson(path.join(runtimeRoot, ".mcp.json"), "MCP configuration"),
  ]);
  if (manifest.name !== EXPECTED_PLUGIN_NAME) {
    throw new Error(
      `Expected Sequence Viewer E2E plugin name ${EXPECTED_PLUGIN_NAME}.`,
    );
  }
  if (
    typeof manifest.version !== "string" ||
    !/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/u.test(manifest.version)
  ) {
    throw new Error("The Sequence Viewer E2E plugin version is invalid.");
  }
  if (starterContract.pluginVersion !== manifest.version) {
    throw new Error(
      "The Sequence Viewer E2E manifest and starter contract versions differ.",
    );
  }
  const serverConfig = mcpConfig.mcpServers?.[EXPECTED_PLUGIN_NAME];
  if (
    serverConfig?.command !== "node" ||
    !Array.isArray(serverConfig.args) ||
    !serverConfig.args.includes("./dist/server.mjs")
  ) {
    throw new Error(
      "The Sequence Viewer E2E runtime does not declare its bundled MCP server.",
    );
  }
  await Promise.all([
    access(path.join(runtimeRoot, "dist/server.mjs")),
    access(path.join(runtimeRoot, "dist/views/app.js.gz")),
    access(path.join(runtimeRoot, "dist/views/styles.css")),
  ]);

  return { manifest, runtimeRoot };
}

async function readJson(filePath, label) {
  try {
    const value = JSON.parse(await readFile(filePath, "utf8"));
    if (value == null || typeof value !== "object" || Array.isArray(value)) {
      throw new Error(`${label} must be a JSON object.`);
    }
    return value;
  } catch (error) {
    throw new Error(
      `Could not validate the Sequence Viewer E2E ${label}.`,
      { cause: error },
    );
  }
}
