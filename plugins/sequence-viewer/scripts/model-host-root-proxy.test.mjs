import { mkdir, mkdtemp, realpath, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createForwardingHandlers,
  readProxyConfiguration,
  validateProxyRoots,
} from "../e2e/model-host-root-proxy-lib.mjs";
import { openingResult } from "../e2e/model-host-app-mount.mjs";

const temporaryRoots = [];

afterEach(async () => {
  await Promise.all(
    temporaryRoots.splice(0).map((root) =>
      rm(root, { force: true, recursive: true }),
    ),
  );
});

describe("Sequence Viewer qualification model-host root proxy", () => {
  it("requires unambiguous absolute host-controlled runtime and workspace roots", () => {
    expect(() => readProxyConfiguration([], {})).toThrow(
      "--runtime-root or SEQUENCE_VIEWER_QUALIFICATION_RUNTIME_ROOT is required",
    );
    expect(() =>
      readProxyConfiguration(
        ["--runtime-root", "relative", "--workspace-root", "/workspace"],
        {},
      ),
    ).toThrow("--runtime-root must be an absolute path");
    expect(() =>
      readProxyConfiguration(
        ["--runtime-root", "/runtime", "--workspace-root", "/workspace"],
        { SEQUENCE_VIEWER_QUALIFICATION_RUNTIME_ROOT: "/different" },
      ),
    ).toThrow("configure different paths");

    expect(
      readProxyConfiguration(
        ["--runtime-root", "/runtime", "--workspace-root", "/workspace"],
        {},
      ),
    ).toEqual({
      autoMountApp: false,
      runtimeRoot: "/runtime",
      screenshotPath: undefined,
      workspaceRoot: "/workspace",
    });

    expect(
      readProxyConfiguration(
        [
          "--auto-mount-app",
          "--runtime-root",
          "/runtime",
          "--screenshot-path",
          "/evidence/viewer.png",
          "--workspace-root",
          "/workspace",
        ],
        {},
      ),
    ).toMatchObject({
      autoMountApp: true,
      screenshotPath: "/evidence/viewer.png",
    });
    expect(() =>
      readProxyConfiguration(
        [
          "--runtime-root",
          "/runtime",
          "--screenshot-path",
          "/evidence/viewer.png",
          "--workspace-root",
          "/workspace",
        ],
        {},
      ),
    ).toThrow("--screenshot-path requires --auto-mount-app");
  });

  it("canonicalizes a valid bundle and rejects a workspace that contains it", async () => {
    const root = await makeTemporaryRoot();
    const runtimeRoot = path.join(root, "runtime");
    const workspaceRoot = path.join(root, "workspace");
    await makeBundle(runtimeRoot);
    await mkdir(workspaceRoot);

    await expect(
      validateProxyRoots({ runtimeRoot, workspaceRoot }),
    ).resolves.toMatchObject({
      manifest: { name: "sequence-viewer", version: "1.2.3" },
      runtimeRoot: await realpath(runtimeRoot),
      workspaceRoot: await realpath(workspaceRoot),
    });
    await expect(
      validateProxyRoots({ runtimeRoot, workspaceRoot: root }),
    ).rejects.toThrow("must be disjoint directories");
  });

  it("forwards cancellation and preserves tool-result metadata verbatim", async () => {
    const result = {
      content: [{ type: "text", text: "opened" }],
      _meta: {
        "openai/outputTemplate": "ui://widget/sequence-viewer",
        viewerSessionId: "session-1",
      },
      structuredContent: { viewerSessionId: "session-1" },
    };
    const callTool = vi.fn(async () => result);
    const mountOpeningResult = vi.fn(async () => undefined);
    const captureEvidence = vi.fn(async () => undefined);
    const client = {
      callTool,
      listResourceTemplates: vi.fn(),
      listResources: vi.fn(),
      listTools: vi.fn(),
      readResource: vi.fn(),
    };
    const signal = new AbortController().signal;
    const request = {
      params: { name: "sequence.open_from_chat", arguments: {} },
    };
    const forwarded = await createForwardingHandlers(client, {
      appMounter: { captureEvidence, mountOpeningResult },
    }).callTool(
      request,
      { signal },
    );

    expect(forwarded).toBe(result);
    expect(callTool).toHaveBeenCalledWith(
      { name: "sequence.open_from_chat", arguments: {} },
      undefined,
      { signal },
    );
    expect(mountOpeningResult).toHaveBeenCalledWith(request, result);
    expect(captureEvidence).toHaveBeenCalledOnce();
  });

  it("serializes concurrent model calls into the mounted viewer command channel", async () => {
    let releaseFirst;
    const firstPending = new Promise((resolve) => {
      releaseFirst = resolve;
    });
    const starts = [];
    const callTool = vi.fn(async ({ name }) => {
      starts.push(name);
      if (name === "sequence.query_viewer") await firstPending;
      return { structuredContent: { applied: true } };
    });
    const handlers = createForwardingHandlers({
      callTool,
      listResourceTemplates: vi.fn(),
      listResources: vi.fn(),
      listTools: vi.fn(),
      readResource: vi.fn(),
    });
    const extra = { signal: new AbortController().signal };
    const first = handlers.callTool(
      { params: { name: "sequence.query_viewer", arguments: {} } },
      extra,
    );
    const second = handlers.callTool(
      { params: { name: "sequence.control_viewer", arguments: {} } },
      extra,
    );

    await vi.waitFor(() => expect(starts).toEqual(["sequence.query_viewer"]));
    releaseFirst();
    await expect(Promise.all([first, second])).resolves.toHaveLength(2);
    expect(starts).toEqual([
      "sequence.query_viewer",
      "sequence.control_viewer",
    ]);
  });

  it("mounts only complete successful opening results", () => {
    const request = {
      params: {
        arguments: { exampleId: "ncbi-nc-001416-1" },
        name: "sequence.acquire_public_example",
      },
    };
    const result = {
      _meta: {
        "openai/outputTemplate": "ui://sequence-viewer/viewer",
        "openai/viewerFile": {
          primaryFile: {
            name: "NC_001416.1.gb",
            uri: "viewer-file://sequence-viewer/opened/source",
          },
        },
      },
      structuredContent: { viewerSessionId: "session-1" },
    };

    expect(openingResult(request, result)).toMatchObject({
      input: {
        file: {
          name: "NC_001416.1.gb",
          resourceUri: "viewer-file://sequence-viewer/opened/source",
        },
      },
      sessionId: "session-1",
      templateUri: "ui://sequence-viewer/viewer",
    });
    expect(openingResult(request, { ...result, _meta: {} })).toBeUndefined();
    expect(
      openingResult(request, { ...result, isError: true }),
    ).toBeUndefined();
  });
});

async function makeTemporaryRoot() {
  const root = await mkdtemp(path.join(os.tmpdir(), "sequence-root-proxy-test-"));
  temporaryRoots.push(root);
  return root;
}

async function makeBundle(runtimeRoot) {
  await Promise.all([
    mkdir(path.join(runtimeRoot, ".codex-plugin"), { recursive: true }),
    mkdir(path.join(runtimeRoot, "dist/views"), { recursive: true }),
  ]);
  await Promise.all([
    writeFile(
      path.join(runtimeRoot, ".codex-plugin/plugin.json"),
      JSON.stringify({ name: "sequence-viewer", version: "1.2.3" }),
    ),
    writeFile(
      path.join(runtimeRoot, "starter-examples.json"),
      JSON.stringify({ pluginVersion: "1.2.3" }),
    ),
    writeFile(
      path.join(runtimeRoot, ".mcp.json"),
      JSON.stringify({
        mcpServers: {
          "sequence-viewer": {
            args: ["./dist/server.mjs"],
            command: "node",
          },
        },
      }),
    ),
    writeFile(path.join(runtimeRoot, "dist/server.mjs"), ""),
    writeFile(path.join(runtimeRoot, "dist/views/app.js.gz"), ""),
    writeFile(path.join(runtimeRoot, "dist/views/styles.css"), ""),
  ]);
}
