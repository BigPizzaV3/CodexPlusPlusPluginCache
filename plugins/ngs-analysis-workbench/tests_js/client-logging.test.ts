import assert from "node:assert/strict";
import test from "node:test";

import type { App } from "@modelcontextprotocol/ext-apps/app-with-deps";

import { InlineMcpClient } from "../src/inline/client.ts";
import { NgsMcpClient } from "../src/mcp/client.ts";

type LogEntry = {
  level: "error" | "warning";
  message: string;
  metadata?: Record<string, unknown>;
};

function recordingLogger() {
  const entries: LogEntry[] = [];
  return {
    entries,
    logger: {
      error(message: string, metadata?: Record<string, unknown>) {
        entries.push({ level: "error", message, metadata });
      },
      warn(message: string, metadata?: Record<string, unknown>) {
        entries.push({ level: "warning", message, metadata });
      },
    },
  };
}

function appWith(overrides: Record<string, unknown> = {}) {
  return {
    addEventListener() {},
    async callServerTool() {
      return { structuredContent: { ok: true } };
    },
    async connect() {},
    getHostContext() {
      return {};
    },
    async openLink() {
      return {};
    },
    removeEventListener() {},
    ...overrides,
  } as unknown as App;
}

test("logs connection failures instead of successful connections", async () => {
  const connectionError = new Error("host unavailable");
  const { entries, logger } = recordingLogger();
  const client = new NgsMcpClient(appWith({
    async connect() {
      throw connectionError;
    },
  }), logger);

  await assert.rejects(client.connect(), connectionError);
  assert.deepEqual(entries, [{
    level: "error",
    message: "Failed to connect NGS workbench app",
    metadata: { errorName: "Error" },
  }]);
});

test("logs each tool transport failure", async () => {
  const { entries, logger } = recordingLogger();
  let shouldFail = true;
  const client = new NgsMcpClient(appWith({
    async callServerTool() {
      if (shouldFail) throw new Error("disconnected");
      return { structuredContent: { ok: true } };
    },
  }), logger);

  const call = () => client.call("observe_ngs_run", {});
  await assert.rejects(call(), /disconnected/);
  await assert.rejects(call(), /disconnected/);
  assert.equal(entries.length, 2);

  shouldFail = false;
  await call();
  shouldFail = true;
  await assert.rejects(call(), /disconnected/);

  assert.equal(entries.length, 3);
  assert.equal(entries[0]?.message, "MCP tool request failed");
  assert.deepEqual(entries[0]?.metadata, {
    errorName: "Error",
    tool: "observe_ngs_run",
  });
});

test("logs MCP error results and missing structured content", async () => {
  const { entries, logger } = recordingLogger();
  const results = [
    { isError: true, content: [{ type: "text", text: "daemon unavailable" }] },
    {},
  ];
  const client = new NgsMcpClient(appWith({
    async callServerTool() {
      return results.shift();
    },
  }), logger);

  await assert.rejects(client.call("observe_ngs_run", {}), /daemon unavailable/);
  await assert.rejects(
    client.call("get_ngs_run_report", {}),
    /did not return structured content/,
  );

  assert.deepEqual(entries.map(({ level, message }) => ({ level, message })), [
    { level: "warning", message: "MCP tool returned an error" },
    { level: "error", message: "MCP tool returned invalid structured content" },
  ]);
  assert.deepEqual(entries.map(({ metadata }) => metadata), [
    { tool: "observe_ngs_run" },
    { tool: "get_ngs_run_report" },
  ]);
});

test("logs each incoming inline tool failure and invalid response", () => {
  const { entries, logger } = recordingLogger();
  const app = appWith();
  const client = new InlineMcpClient(app, logger);

  app.ontoolresult?.({ isError: true, content: [{ type: "text", text: "run failed" }] });
  app.ontoolresult?.({ isError: true, content: [{ type: "text", text: "run failed" }] });
  app.ontoolresult?.({ structuredContent: undefined });
  app.ontoolresult?.({ structuredContent: undefined });

  assert.deepEqual(entries.map(({ level, message }) => ({ level, message })), [
    { level: "warning", message: "NGS run review tool returned an error" },
    { level: "warning", message: "NGS run review tool returned an error" },
    { level: "error", message: "NGS run review tool returned invalid structured content" },
    { level: "error", message: "NGS run review tool returned invalid structured content" },
  ]);
  assert.deepEqual(entries.map(({ metadata }) => metadata), [
    undefined,
    undefined,
    undefined,
    undefined,
  ]);
});
