import { createServer } from "node:http";
import { mkdtemp, readFile, realpath, rm, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { ListRootsRequestSchema } from "@modelcontextprotocol/sdk/types.js";

import { resolveSequenceViewerRuntimeRoot } from "./plugin-runtime-root.mjs";

const sourceDirectory = await realpath(
  path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."),
);
const { manifest, runtimeRoot } = await resolveSequenceViewerRuntimeRoot(sourceDirectory);
const port = Number(process.env.SEQUENCE_VIEWER_E2E_PORT ?? "43128");
const MCP_REQUEST_ENVELOPE_BYTES = 280 * 1_024;
const faultInjectionEnabled = process.env.SEQUENCE_VIEWER_E2E_FAULT_INJECTION === "1";
const qualificationFaultScenarios = new Set([
  "accession-missing",
  "deterministic-subset-failure",
  "malformed-database-response",
  "network-unavailable",
  "output-quota-failure",
  "oversized-source-or-analysis-budget",
  "payload-format-mismatch",
  "rate-limit",
]);
if (!Number.isInteger(port) || port < 1 || port > 65_535) {
  throw new Error("SEQUENCE_VIEWER_E2E_PORT must be a valid TCP port.");
}

let mcpClientPromise;
let mcpTransport;
let mcpSpawnCount = 0;
let workspaceRootListRequestCount = 0;
const mcpBridgeRequestCounts = { resourceReads: 0, toolCalls: 0 };
let codexHome;
let activeFaultScenario;
let activeWorkspaceRootMode = "provided";

const server = createServer(async (request, response) => {
  try {
    const requestUrl = new URL(request.url ?? "/", `http://127.0.0.1:${port}`);
    if (
      request.method === "GET" &&
      requestUrl.pathname === "/__sequence-viewer-persistent/mcp-status"
    ) {
      sendJson(response, 200, mcpProcessStatus());
      return;
    }
    if (
      request.method === "POST" &&
      requestUrl.pathname === "/__sequence-viewer-persistent/reset-mcp"
    ) {
      const before = mcpProcessStatus();
      await resetMcpClient();
      const terminatedPidRunning = processIsAlive(before.pid);
      if (terminatedPidRunning) {
        throw new Error("The original Sequence MCP process did not terminate.");
      }
      sendJson(response, 200, {
        after: mcpProcessStatus(),
        before,
        terminatedPid: before.pid,
        terminatedPidRunning,
      });
      return;
    }
    if (request.method === "POST" && requestUrl.pathname === "/__sequence-viewer-mcp") {
      await handleMcpRequest(request, response);
      return;
    }
    if (request.method !== "GET" && request.method !== "HEAD") {
      sendJson(response, 405, { error: "Method not allowed." });
      return;
    }
    await serveStatic(requestUrl.pathname, request.method === "HEAD", response);
  } catch (error) {
    sendJson(response, 500, {
      error: error instanceof Error ? error.message : "Installed-host harness request failed.",
    });
  }
});

server.listen(port, "127.0.0.1", () => {
  process.stdout.write(
    `Sequence Viewer ${manifest.version} installed-host server listening on 127.0.0.1:${port}\n`,
  );
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.once(signal, () => void shutdown());
}

async function handleMcpRequest(request, response) {
  const body = await readJsonBody(request, MCP_REQUEST_ENVELOPE_BYTES);
  if (
    body == null ||
    typeof body !== "object" ||
    !["resources/read", "tools/call"].includes(body.method)
  ) {
    sendJson(response, 400, { error: "Unsupported MCP bridge request." });
    return;
  }
  const requestedWorkspaceRootMode = workspaceRootMode(request);
  if (requestedWorkspaceRootMode !== activeWorkspaceRootMode) {
    await resetMcpClient();
    activeWorkspaceRootMode = requestedWorkspaceRootMode;
    mcpBridgeRequestCounts.resourceReads = 0;
    mcpBridgeRequestCounts.toolCalls = 0;
    workspaceRootListRequestCount = 0;
  }
  if (body.method === "tools/call" && body.params?.name === "sequence.acquire_public_example") {
    const requestedFault = qualificationFaultScenario(request);
    await resetMcpClient();
    activeFaultScenario = requestedFault;
  }
  if (body.method === "resources/read") {
    mcpBridgeRequestCounts.resourceReads += 1;
  } else {
    mcpBridgeRequestCounts.toolCalls += 1;
  }
  const client = await getMcpClient();
  const result =
    body.method === "resources/read"
      ? await client.readResource(body.params)
      : await client.callTool(body.params);
  sendJson(response, 200, result);
}

async function getMcpClient() {
  if (mcpClientPromise != null) return await mcpClientPromise;
  mcpClientPromise = (async () => {
    const configuredWorkspace = process.env.SEQUENCE_VIEWER_PUBLIC_EXAMPLES_EVIDENCE_ROOT?.trim();
    if (configuredWorkspace == null || !path.isAbsolute(configuredWorkspace)) {
      throw new Error("The real public-starter host requires an absolute evidence workspace.");
    }
    const workspace = await realpath(configuredWorkspace);
    codexHome = await mkdtemp(path.join(os.tmpdir(), "sequence-viewer-installed-host-codex-"));
    const client = new Client(
      { name: "sequence-viewer-installed-host", version: "1.0.0" },
      { capabilities: { roots: {} } },
    );
    const exposeWorkspaceRoot = activeWorkspaceRootMode === "provided";
    client.setRequestHandler(ListRootsRequestSchema, async () => {
      workspaceRootListRequestCount += 1;
      return {
        roots: exposeWorkspaceRoot ? [{ uri: pathToFileURL(workspace).href }] : [],
      };
    });
    const transport = new StdioClientTransport({
      args: ["dist/server.mjs"],
      command: process.execPath,
      cwd: runtimeRoot,
      env: definedEnvironment({
        ...process.env,
        CODEX_HOME: codexHome,
        ...(activeFaultScenario == null
          ? {}
          : {
              NODE_OPTIONS: nodeOptionsWithFaultInjection(),
              SEQUENCE_VIEWER_E2E_FAULT_SCENARIO: activeFaultScenario,
            }),
      }),
      stderr: "pipe",
    });
    mcpTransport = transport;
    await client.connect(transport);
    mcpSpawnCount += 1;
    return client;
  })();
  return await mcpClientPromise;
}

function workspaceRootMode(request) {
  const value = request.headers["x-sequence-viewer-workspace-roots"];
  if (value == null || value === "") return "provided";
  if (value !== "none") {
    throw new Error("Unknown installed-host workspace root mode.");
  }
  return "none";
}

function qualificationFaultScenario(request) {
  const value = request.headers["x-sequence-viewer-qualification-fault"];
  if (value == null || value === "") return undefined;
  if (!faultInjectionEnabled) {
    throw new Error("Installed-host fault injection is disabled outside qualification.");
  }
  if (Array.isArray(value) || !qualificationFaultScenarios.has(value)) {
    throw new Error("Unknown installed-host qualification fault scenario.");
  }
  return value;
}

function nodeOptionsWithFaultInjection() {
  const preload = path.join(sourceDirectory, "e2e/installed-host-fault-injection.mjs");
  return [process.env.NODE_OPTIONS?.trim(), `--import=${pathToFileURL(preload).href}`]
    .filter(Boolean)
    .join(" ");
}

async function serveStatic(requestPath, headOnly, response) {
  const decoded = decodeURIComponent(requestPath === "/" ? "/e2e/installed.html" : requestPath);
  const filePath = path.resolve(sourceDirectory, `.${decoded}`);
  const relative = path.relative(sourceDirectory, filePath);
  if (
    relative === "" ||
    path.isAbsolute(relative) ||
    relative === ".." ||
    relative.startsWith(`..${path.sep}`)
  ) {
    sendJson(response, 404, { error: "Not found." });
    return;
  }
  const fileStat = await stat(filePath);
  if (!fileStat.isFile()) {
    sendJson(response, 404, { error: "Not found." });
    return;
  }
  response.writeHead(200, {
    "cache-control": "no-store",
    "content-length": String(fileStat.size),
    "content-type": contentType(filePath),
  });
  if (headOnly) {
    response.end();
    return;
  }
  response.end(await readFile(filePath));
}

async function readJsonBody(request, maxBytes) {
  const chunks = [];
  let byteLength = 0;
  for await (const chunk of request) {
    byteLength += chunk.byteLength;
    if (byteLength > maxBytes) {
      throw new Error("MCP bridge request exceeded its byte budget.");
    }
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks, byteLength).toString("utf8"));
}

function sendJson(response, status, value) {
  const body = `${JSON.stringify(value)}\n`;
  response.writeHead(status, {
    "cache-control": "no-store",
    "content-length": String(Buffer.byteLength(body)),
    "content-type": "application/json; charset=utf-8",
  });
  response.end(body);
}

function contentType(filePath) {
  switch (path.extname(filePath).toLowerCase()) {
    case ".css":
      return "text/css; charset=utf-8";
    case ".html":
      return "text/html; charset=utf-8";
    case ".js":
    case ".mjs":
      return "text/javascript; charset=utf-8";
    case ".json":
      return "application/json; charset=utf-8";
    case ".png":
      return "image/png";
    default:
      return "application/octet-stream";
  }
}

function definedEnvironment(environment) {
  return Object.fromEntries(Object.entries(environment).filter(([, value]) => value != null));
}

function mcpProcessStatus() {
  const pid = mcpTransport?.pid ?? null;
  return {
    advertisedWorkspaceRootCount:
      mcpClientPromise == null ? null : activeWorkspaceRootMode === "provided" ? 1 : 0,
    bridgeRequests: { ...mcpBridgeRequestCounts },
    pid,
    running: processIsAlive(pid),
    spawnCount: mcpSpawnCount,
    workspaceRootListRequestCount,
  };
}

function processIsAlive(pid) {
  if (!Number.isSafeInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    if (error?.code === "EPERM") return true;
    return false;
  }
}

async function shutdown() {
  server.close();
  await resetMcpClient();
  process.exit(0);
}

async function resetMcpClient() {
  if (mcpClientPromise != null) {
    await mcpClientPromise.then((client) => client.close()).catch(() => undefined);
    mcpClientPromise = undefined;
  }
  mcpTransport = undefined;
  if (codexHome != null) {
    await rm(codexHome, { force: true, recursive: true }).catch(() => undefined);
    codexHome = undefined;
  }
}
