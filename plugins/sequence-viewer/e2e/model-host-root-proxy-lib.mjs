import { mkdtemp, realpath, rm, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListResourceTemplatesRequestSchema,
  ListRootsRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

import { resolveSequenceViewerRuntimeRoot } from "./plugin-runtime-root.mjs";

const RUNTIME_ROOT_ENV = "SEQUENCE_VIEWER_QUALIFICATION_RUNTIME_ROOT";
const WORKSPACE_ROOT_ENV = "SEQUENCE_VIEWER_QUALIFICATION_WORKSPACE_ROOT";
const AUTO_MOUNT_ENV = "SEQUENCE_VIEWER_QUALIFICATION_AUTO_MOUNT_APP";
const SCREENSHOT_PATH_ENV = "SEQUENCE_VIEWER_QUALIFICATION_SCREENSHOT_PATH";

export function readProxyConfiguration(args, environment = process.env) {
  const parsed = parseArguments(args);
  const autoMountApp = selectBoolean({
    argument: parsed.autoMountApp,
    environment: environment[AUTO_MOUNT_ENV],
    flag: "--auto-mount-app",
    variable: AUTO_MOUNT_ENV,
  });
  const screenshotPath = selectOptionalPath({
    argument: parsed.screenshotPath,
    environment: environment[SCREENSHOT_PATH_ENV],
    flag: "--screenshot-path",
    variable: SCREENSHOT_PATH_ENV,
  });
  if (screenshotPath != null && !autoMountApp) {
    throw new Error("--screenshot-path requires --auto-mount-app.");
  }
  return {
    autoMountApp,
    runtimeRoot: selectPath({
      argument: parsed.runtimeRoot,
      environment: environment[RUNTIME_ROOT_ENV],
      flag: "--runtime-root",
      variable: RUNTIME_ROOT_ENV,
    }),
    workspaceRoot: selectPath({
      argument: parsed.workspaceRoot,
      environment: environment[WORKSPACE_ROOT_ENV],
      flag: "--workspace-root",
      variable: WORKSPACE_ROOT_ENV,
    }),
    screenshotPath,
  };
}

export async function validateProxyRoots({
  autoMountApp = false,
  runtimeRoot,
  screenshotPath,
  workspaceRoot,
}) {
  assertAbsolutePath(runtimeRoot, "Sequence Viewer qualification runtime root");
  assertAbsolutePath(workspaceRoot, "Sequence Viewer qualification workspace root");

  const canonicalWorkspaceRoot = await canonicalDirectory(
    workspaceRoot,
    "Sequence Viewer qualification workspace root",
  );
  // The runtime validator intentionally consumes the explicit host-selected
  // path. The proxy never consults a model-provided path or ambient override.
  const resolvedRuntime = await resolveSequenceViewerRuntimeRoot(runtimeRoot, {
    configuredRoot: runtimeRoot,
  });

  const canonicalRuntimeRoot = resolvedRuntime.runtimeRoot;
  if (
    containsPath(canonicalRuntimeRoot, canonicalWorkspaceRoot) ||
    containsPath(canonicalWorkspaceRoot, canonicalRuntimeRoot)
  ) {
    throw new Error(
      "The qualification runtime and workspace roots must be disjoint directories.",
    );
  }

  return {
    manifest: resolvedRuntime.manifest,
    runtimeRoot: canonicalRuntimeRoot,
    autoMountApp,
    screenshotPath,
    workspaceRoot: canonicalWorkspaceRoot,
  };
}

export async function connectSequenceViewerClient({ runtimeRoot, workspaceRoot }) {
  const privateStateRoot = await mkdtemp(
    path.join(os.tmpdir(), "sequence-viewer-model-host-"),
  );
  const client = new Client(
    { name: "sequence-viewer-qualification-root-host", version: "1.0.0" },
    { capabilities: { roots: {} } },
  );
  client.setRequestHandler(ListRootsRequestSchema, async () => ({
    roots: [
      {
        name: path.basename(workspaceRoot),
        uri: pathToFileURL(workspaceRoot).href,
      },
    ],
  }));

  const transport = new StdioClientTransport({
    args: ["dist/server.mjs"],
    command: process.execPath,
    cwd: runtimeRoot,
    env: definedEnvironment({
      ...process.env,
      CODEX_HOME: privateStateRoot,
    }),
    // The outer stdio channel must remain valid MCP JSON-RPC. Child diagnostics
    // are safe on the inherited stderr stream.
    stderr: "inherit",
  });

  try {
    await client.connect(transport);
  } catch (error) {
    await rm(privateStateRoot, { force: true, recursive: true });
    throw error;
  }

  let closing;
  return {
    client,
    async close() {
      closing ??= (async () => {
        await client.close().catch(() => undefined);
        await rm(privateStateRoot, { force: true, recursive: true });
      })();
      await closing;
    },
  };
}

export function createForwardingHandlers(client, { appMounter } = {}) {
  let toolCallChain = Promise.resolve();
  return {
    async callTool(request, extra) {
      const call = toolCallChain.then(async () => {
        throwIfAborted(extra.signal);
        const result = await client.callTool(request.params, undefined, {
          signal: extra.signal,
        });
        await appMounter?.mountOpeningResult(request, result);
        await appMounter?.captureEvidence?.();
        return result;
      });
      // A mounted MCP App has one ordered command channel. Preserve model-call
      // order and apply backpressure rather than racing several commands into
      // the same long-poll loop. A failed call releases the next waiter.
      toolCallChain = call.then(
        () => undefined,
        () => undefined,
      );
      return await call;
    },
    async listResourceTemplates(request, extra) {
      return await client.listResourceTemplates(request.params, {
        signal: extra.signal,
      });
    },
    async listResources(request, extra) {
      return await client.listResources(request.params, {
        signal: extra.signal,
      });
    },
    async listTools(request, extra) {
      return await client.listTools(request.params, { signal: extra.signal });
    },
    async readResource(request, extra) {
      return await client.readResource(request.params, {
        signal: extra.signal,
      });
    },
  };
}

function throwIfAborted(signal) {
  if (signal?.aborted !== true) return;
  throw signal.reason instanceof Error
    ? signal.reason
    : new Error("The qualification model tool call was cancelled.");
}

export function createSequenceViewerProxyServer(
  client,
  manifest,
  { appMounter } = {},
) {
  const childCapabilities = client.getServerCapabilities() ?? {};
  const capabilities = {};
  if (childCapabilities.tools != null) {
    capabilities.tools = { listChanged: false };
  }
  if (childCapabilities.resources != null) {
    capabilities.resources = { listChanged: false, subscribe: false };
  }

  const server = new Server(
    {
      name: "sequence-viewer-qualification-root-proxy",
      version: manifest.version,
    },
    {
      capabilities,
      instructions:
        "Qualification-only Sequence Viewer host adapter. " +
        "The workspace root is supplied and canonicalized by the host.",
    },
  );
  const handlers = createForwardingHandlers(client, { appMounter });
  if (childCapabilities.tools != null) {
    server.setRequestHandler(ListToolsRequestSchema, handlers.listTools);
    server.setRequestHandler(CallToolRequestSchema, handlers.callTool);
  }
  if (childCapabilities.resources != null) {
    server.setRequestHandler(ListResourcesRequestSchema, handlers.listResources);
    server.setRequestHandler(
      ListResourceTemplatesRequestSchema,
      handlers.listResourceTemplates,
    );
    server.setRequestHandler(ReadResourceRequestSchema, handlers.readResource);
  }
  return server;
}

function parseArguments(args) {
  const parsed = {};
  for (let index = 0; index < args.length; index += 1) {
    const flag = args[index];
    if (flag === "--auto-mount-app") {
      if (parsed.autoMountApp === true) {
        throw new Error("--auto-mount-app may only be provided once.");
      }
      parsed.autoMountApp = true;
      continue;
    }
    if (
      !["--runtime-root", "--screenshot-path", "--workspace-root"].includes(
        flag,
      )
    ) {
      throw new Error(`Unsupported qualification proxy argument: ${flag}`);
    }
    const value = args[index + 1];
    if (value == null || value.startsWith("--")) {
      throw new Error(`${flag} requires an absolute directory path.`);
    }
    const key =
      flag === "--runtime-root"
        ? "runtimeRoot"
        : flag === "--screenshot-path"
          ? "screenshotPath"
          : "workspaceRoot";
    if (parsed[key] != null) {
      throw new Error(`${flag} may only be provided once.`);
    }
    parsed[key] = value;
    index += 1;
  }
  return parsed;
}

function selectBoolean({ argument, environment, flag, variable }) {
  const fromEnvironment = normalizeBoolean(environment, variable);
  if (argument === true && fromEnvironment === false) {
    throw new Error(`${flag} and ${variable} configure different values.`);
  }
  return argument === true || fromEnvironment === true;
}

function normalizeBoolean(value, variable) {
  if (value == null || value === "") return undefined;
  if (value === "1") return true;
  if (value === "0") return false;
  throw new Error(`${variable} must be 1 or 0.`);
}

function selectPath({ argument, environment, flag, variable }) {
  const fromArgument = normalizeConfiguredPath(argument);
  const fromEnvironment = normalizeConfiguredPath(environment);
  if (
    fromArgument != null &&
    fromEnvironment != null &&
    fromArgument !== fromEnvironment
  ) {
    throw new Error(`${flag} and ${variable} configure different paths.`);
  }
  const selected = fromArgument ?? fromEnvironment;
  if (selected == null) {
    throw new Error(`${flag} or ${variable} is required.`);
  }
  assertAbsolutePath(selected, flag);
  return selected;
}

function selectOptionalPath({ argument, environment, flag, variable }) {
  const fromArgument = normalizeConfiguredPath(argument);
  const fromEnvironment = normalizeConfiguredPath(environment);
  if (
    fromArgument != null &&
    fromEnvironment != null &&
    fromArgument !== fromEnvironment
  ) {
    throw new Error(`${flag} and ${variable} configure different paths.`);
  }
  const selected = fromArgument ?? fromEnvironment;
  if (selected != null) assertAbsolutePath(selected, flag);
  return selected;
}

function normalizeConfiguredPath(value) {
  if (typeof value !== "string" || value.trim() === "") return undefined;
  if (value !== value.trim()) {
    throw new Error("Qualification proxy paths may not contain outer whitespace.");
  }
  return value;
}

function assertAbsolutePath(value, label) {
  if (typeof value !== "string" || !path.isAbsolute(value)) {
    throw new Error(`${label} must be an absolute path.`);
  }
}

async function canonicalDirectory(value, label) {
  const canonical = await realpath(value);
  if (!(await stat(canonical)).isDirectory()) {
    throw new Error(`${label} must be a directory.`);
  }
  return canonical;
}

function containsPath(parent, candidate) {
  const relative = path.relative(parent, candidate);
  return (
    relative === "" ||
    (!path.isAbsolute(relative) &&
      relative !== ".." &&
      !relative.startsWith(`..${path.sep}`))
  );
}

function definedEnvironment(environment) {
  return Object.fromEntries(
    Object.entries(environment).filter(([, value]) => value != null),
  );
}
