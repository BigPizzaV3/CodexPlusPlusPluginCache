import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import {
  mockAppInstances,
  mockConnectToolResult,
  mockConnectToolResultAfterConnect,
  mockConnectSuppressToolResult,
  mockInitialHostContext,
  mockNativeHostCapabilities,
  mockServerToolHandler,
} from "./__fixtures__/app-host";
import { createArtifactStateKey } from "../artifact-state-key";
import { serializeIndexedSequenceEnvelope } from "../indexed-sequence-envelope";
import { parseIndexedSequenceLines } from "../indexed-sequence-parser";
import { parseMsa } from "../msa/parser";
import {
  createDurableAlignmentState,
  createDurableSequenceState,
  decodeSequenceDurableViewerState,
  encodeSequenceDurableViewerState,
} from "../persistent/durable-viewer-state";
import { SEQUENCE_VIEWER_LIMITS } from "../runtime-contract";
import { parseSequenceDocument } from "../sequence/parser";
import {
  createAlignmentWorkbenchState,
  createSequenceWorkbenchState,
} from "../workbench-state";
import {
  createProxySafeCommandCompletionRequest,
  startSequenceViewerApp,
} from "./app";
import { encodedSequenceToolRequestBytes } from "./workbench-persistence";

const openingHints = [
  { opening: "chat", args: { path: "results/demo.fasta" } },
  {
    opening: "public-example",
    args: { exampleId: "uniprot-human-ras-sv1" },
  },
] as const;

describe("sequence viewer app", () => {
  it.each(["light", "dark"] as const)(
    "applies the initial %s host theme and style variables",
    async (theme) => {
      mockInitialHostContext.current = {
        theme,
        styles: {
          variables: {
            "--color-background-primary": "#252525",
            "--color-text-primary": "#ececec",
            "--font-sans": "Example Sans, sans-serif",
          },
        },
      };

      await act(async () => {
        await startSequenceViewerApp(document.createElement("div"));
      });

      expect(document.documentElement).toHaveAttribute("data-theme", theme);
      expect(document.documentElement.style.colorScheme).toBe(theme);
      expect(
        document.documentElement.style.getPropertyValue(
          "--color-background-primary",
        ),
      ).toBe("#252525");
      expect(
        document.documentElement.style.getPropertyValue("--color-text-primary"),
      ).toBe("#ececec");
      expect(
        document.documentElement.style.getPropertyValue("--font-sans"),
      ).toBe("Example Sans, sans-serif");
    },
  );

  it("preserves appearance values omitted from partial host-context updates", async () => {
    mockInitialHostContext.current = {
      theme: "light",
      styles: {
        variables: {
          "--color-background-primary": "#fafafa",
          "--font-sans": "Example Sans, sans-serif",
        },
      },
    };
    await act(async () => {
      await startSequenceViewerApp(document.createElement("div"));
    });
    const app = mockAppInstances.at(-1);
    if (app?.hostContextChanged == null) {
      throw new Error("Expected a host-context change handler.");
    }

    // The SDK merges each notification into getHostContext before dispatch.
    app.getHostContext.mockReturnValue({
      ...mockInitialHostContext.current,
      theme: "dark",
    });
    await act(async () => app.hostContextChanged?.({ theme: "dark" }));
    expect(document.documentElement).toHaveAttribute("data-theme", "dark");
    expect(document.documentElement.style.colorScheme).toBe("dark");
    expect(
      document.documentElement.style.getPropertyValue(
        "--color-background-primary",
      ),
    ).toBe("#fafafa");

    const styles = { variables: { "--color-background-primary": "#242424" } };
    app.getHostContext.mockReturnValue({ theme: "dark", styles });
    await act(async () => app.hostContextChanged?.({ styles }));
    expect(document.documentElement).toHaveAttribute("data-theme", "dark");
    expect(
      document.documentElement.style.getPropertyValue(
        "--color-background-primary",
      ),
    ).toBe("#242424");
    expect(document.documentElement.style.getPropertyValue("--font-sans")).toBe(
      "Example Sans, sans-serif",
    );

    app.getHostContext.mockReturnValue({ theme: "light", styles });
    await act(async () => app.hostContextChanged?.({ theme: "light" }));
    expect(document.documentElement).toHaveAttribute("data-theme", "light");
    expect(document.documentElement.style.colorScheme).toBe("light");
    expect(
      document.documentElement.style.getPropertyValue(
        "--color-background-primary",
      ),
    ).toBe("#242424");

    app.getHostContext.mockReturnValue({});
    await act(async () => app.hostContextChanged?.({}));
    expect(document.documentElement).toHaveAttribute("data-theme", "light");
    expect(document.documentElement.style.getPropertyValue("--font-sans")).toBe(
      "Example Sans, sans-serif",
    );
  });

  it.each([
    { label: "absent", context: undefined },
    { label: "empty", context: {} },
    { label: "empty styles", context: { styles: {} } },
    { label: "empty variables", context: { styles: { variables: {} } } },
  ])(
    "preserves fallback appearance with $label host context",
    async ({ context }) => {
      mockInitialHostContext.current = context;
      document.documentElement.removeAttribute("data-theme");
      document.documentElement.style.removeProperty("color-scheme");
      document.documentElement.style.setProperty(
        "--font-sans",
        "Existing Sans",
      );

      await act(async () => {
        await startSequenceViewerApp(document.createElement("div"));
      });

      expect(document.documentElement).not.toHaveAttribute("data-theme");
      expect(document.documentElement.style.colorScheme).toBe("");
      expect(
        document.documentElement.style.getPropertyValue("--font-sans"),
      ).toBe("Existing Sans");
    },
  );

  it("replaces an oversized command completion with a proxy-safe failure", () => {
    const request = createProxySafeCommandCompletionRequest({
      commandId: "11111111-1111-4111-8111-111111111111",
      result: {
        applied: true,
        message: "Returned live viewer state.",
        state: { query: { items: ["x".repeat(300 * 1_024)] } },
      },
      sessionId: "22222222-2222-4222-8222-222222222222",
    });

    expect(request).toMatchObject({
      arguments: {
        applied: false,
        commandId: "11111111-1111-4111-8111-111111111111",
        sessionId: "22222222-2222-4222-8222-222222222222",
        state: {},
      },
      name: "sequence.complete_viewer_command",
    });
    expect(encodedSequenceToolRequestBytes(request)).toBeLessThanOrEqual(
      SEQUENCE_VIEWER_LIMITS.command.maxCompletionRequestBytes,
    );
    const jsonRpcRequestBytes = new TextEncoder().encode(
      JSON.stringify({
        id: "sequence-viewer-completion",
        jsonrpc: "2.0",
        method: "tools/call",
        params: request,
      }),
    ).byteLength;
    expect(jsonRpcRequestBytes).toBeLessThanOrEqual(
      SEQUENCE_VIEWER_LIMITS.persistence.proxyEnvelopeBytes,
    );
  });

  it.each(openingHints)(
    "loads a $opening sequence from the tool result resource",
    async ({ args }) => {
      const rootElement = document.createElement("div");
      document.body.append(rootElement);

      await startSequenceViewerApp(rootElement);
      const app = mockAppInstances.at(-1);
      expect(app).toBeDefined();
      expect(app?.info).toEqual({ name: "sequence-viewer", version: "0.1.43" });
      if (app == null || app.ontoolinput == null || app.ontoolresult == null) {
        throw new Error("Expected sequence viewer app tool handlers.");
      }
      app.readServerResource.mockResolvedValue({
        contents: [
          {
            text: ">demo\nACGT\n",
            uri: "viewer-file://sequence-viewer/opened/token",
          },
        ],
      });

      await app.ontoolinput({ arguments: args });
      expect(await screen.findByText("Loading sequence…")).toBeInTheDocument();
      expect(app.readServerResource).not.toHaveBeenCalled();
      await app.ontoolresult({
        _meta: {
          "openai/viewerFile": {
            primaryFile: {
              name: "demo.fasta",
              uri: "viewer-file://sequence-viewer/opened/token",
            },
          },
        },
      });

      expect(await screen.findByText("demo.fasta")).toBeInTheDocument();
      expect(app.readServerResource).toHaveBeenCalledWith({
        uri: "viewer-file://sequence-viewer/opened/token",
      });
    },
  );

  it.each(openingHints)(
    "finishes an authoritative resource load after a late $opening hint",
    async ({ args }) => {
      const rootElement = document.createElement("div");
      document.body.append(rootElement);
      const uri = "viewer-file://sequence-viewer/opened/delayed";
      let finishRead:
        | ((result: { contents: Array<{ text: string; uri: string }> }) => void)
        | undefined;
      const resource = new Promise<{
        contents: Array<{ text: string; uri: string }>;
      }>((resolve) => {
        finishRead = resolve;
      });

      await startSequenceViewerApp(rootElement);
      const app = mockAppInstances.at(-1);
      if (app?.ontoolinput == null || app.ontoolresult == null) {
        throw new Error("Expected Sequence viewer opening handlers.");
      }
      app.readServerResource.mockReturnValue(resource);
      const loading = app.ontoolresult({
        _meta: {
          "openai/viewerFile": {
            primaryFile: { name: "demo.fasta", uri },
          },
        },
      });
      await waitFor(() =>
        expect(app.readServerResource).toHaveBeenCalledOnce(),
      );
      await app.ontoolinput({ arguments: args });
      await act(async () => {
        finishRead?.({ contents: [{ text: ">demo\nACGT\n", uri }] });
        await loading;
      });

      expect(within(rootElement).getByText("demo.fasta")).toBeVisible();
      expect(
        within(rootElement).queryByText("Loading sequence…"),
      ).not.toBeInTheDocument();
      expect(app.readServerResource).toHaveBeenCalledOnce();
    },
  );

  it.each(["during", "after"] as const)(
    "loads a rootless chat resource before polling when its result arrives %s connection",
    async (resultTiming) => {
      const rootElement = document.createElement("div");
      document.body.append(rootElement);
      const sessionId = "11111111-1111-4111-8111-111111111111";
      const uri = "viewer-file://sequence-viewer/opened/rootless";
      const resource = { contents: [{ text: ">demo\nACGT\n", uri }] };
      let finishRead: ((value: typeof resource) => void) | undefined;
      const reading = new Promise<typeof resource>((resolve) => {
        finishRead = resolve;
      });
      let loading: Promise<void> | undefined;
      mockConnectSuppressToolResult.current = true;
      mockServerToolHandler.current = async (request) => {
        const { name } = request as { name: string };
        if (name === "sequence.wait_for_viewer_command") {
          return new Promise(() => undefined);
        }
        throw new Error(`Unexpected rootless startup tool: ${name}`);
      };

      try {
        const connecting = startSequenceViewerApp(rootElement);
        const app = mockAppInstances.at(-1);
        if (app?.ontoolresult == null || app.callServerTool == null) {
          throw new Error("Expected Sequence viewer app tool handlers.");
        }
        app.readServerResource.mockReturnValue(reading);
        if (resultTiming === "after") await connecting;
        loading = app.ontoolresult({
          _meta: {
            "openai/viewerFile": {
              primaryFile: { name: "demo.fasta", uri },
            },
          },
          structuredContent: {
            viewerCommandRevision: 0,
            viewerSessionId: sessionId,
          },
        });
        await connecting;

        expect(app.readServerResource).toHaveBeenCalledExactlyOnceWith({ uri });
        expect(app.callServerTool).not.toHaveBeenCalled();
        await act(async () => {
          finishRead?.(resource);
          await loading;
        });

        expect(within(rootElement).getByText("demo.fasta")).toBeVisible();
        expect(app.callServerTool).toHaveBeenCalledWith({
          arguments: {
            afterRevision: 0,
            sessionId,
            timeoutMs: 25_000,
          },
          name: "sequence.wait_for_viewer_command",
        });
      } finally {
        finishRead?.(resource);
        await loading;
        mockConnectSuppressToolResult.current = false;
        mockServerToolHandler.current = null;
      }
    },
  );

  it.each(openingHints)(
    "preserves an authoritative error after a late $opening hint until a retry result arrives",
    async ({ args }) => {
      const rootElement = document.createElement("div");
      document.body.append(rootElement);
      const message = "The host rejected the selected sequence resource.";
      const uri = "viewer-file://sequence-viewer/opened/retry";
      await startSequenceViewerApp(rootElement);
      const app = mockAppInstances.at(-1);
      if (app?.ontoolinput == null || app.ontoolresult == null) {
        throw new Error("Expected Sequence viewer opening handlers.");
      }
      await act(async () => {
        await app.ontoolresult?.({
          content: [{ type: "text", text: message }],
          isError: true,
        });
        await app.ontoolinput?.({ arguments: args });
      });

      expect(within(rootElement).getByText(message)).toBeVisible();
      expect(app.readServerResource).not.toHaveBeenCalled();
      app.readServerResource.mockResolvedValue({
        contents: [{ text: ">retry\nAACCGGTT\n", uri }],
      });
      await app.ontoolresult({
        _meta: {
          "openai/viewerFile": {
            primaryFile: { name: "retry.fasta", uri },
          },
        },
      });

      expect(await within(rootElement).findByText("retry.fasta")).toBeVisible();
      expect(within(rootElement).queryByText(message)).not.toBeInTheDocument();
      expect(app.readServerResource).toHaveBeenCalledExactlyOnceWith({ uri });
    },
  );

  it("accepts a native retry after an error and a new authoritative chat result after ready", async () => {
    const rootElement = document.createElement("div");
    document.body.append(rootElement);
    const nativeSessionId = "11111111-1111-4111-8111-111111111111";
    const chatSessionId = "22222222-2222-4222-8222-222222222222";
    const nativeUri = "codex-resource://native-retry";
    const chatUri = "viewer-file://sequence-viewer/opened/replacement";
    mockConnectSuppressToolResult.current = true;
    mockServerToolHandler.current = async (request) => {
      const { name } = request as { name: string };
      if (name === "sequence.register_viewer_session") {
        return {
          structuredContent: { revision: 0, sessionId: nativeSessionId },
        };
      }
      if (name === "sequence.wait_for_viewer_command") {
        return new Promise(() => undefined);
      }
      throw new Error(`Unexpected Sequence retry tool: ${name}`);
    };

    try {
      await startSequenceViewerApp(rootElement);
      const app = mockAppInstances.at(-1);
      if (app?.ontoolinput == null || app.ontoolresult == null) {
        throw new Error("Expected Sequence viewer opening handlers.");
      }
      app.readServerResource
        .mockResolvedValueOnce({
          contents: [{ text: ">native\nACGT\n", uri: nativeUri }],
        })
        .mockResolvedValueOnce({
          contents: [{ text: ">replacement\nAACCGGTT\n", uri: chatUri }],
        });
      await app.ontoolresult({
        content: [{ type: "text", text: "The original opening failed." }],
        isError: true,
      });
      await app.ontoolinput({
        arguments: { file: { name: "native.fasta", resourceUri: nativeUri } },
      });
      expect(
        await within(rootElement).findByText("native.fasta"),
      ).toBeVisible();
      await waitFor(() => {
        expect(app.callServerTool).toHaveBeenCalledWith({
          arguments: expect.objectContaining({ sessionId: nativeSessionId }),
          name: "sequence.wait_for_viewer_command",
        });
      });

      await act(async () => {
        await app.ontoolinput?.({
          arguments: { path: "results/replacement.fasta" },
        });
      });
      expect(within(rootElement).getByText("native.fasta")).toBeVisible();
      await app.ontoolresult({
        _meta: {
          "openai/viewerFile": {
            primaryFile: { name: "replacement.fasta", uri: chatUri },
          },
        },
        structuredContent: {
          viewerCommandRevision: 5,
          viewerReady: true,
          viewerSessionId: chatSessionId,
        },
      });

      expect(
        await within(rootElement).findByText("replacement.fasta"),
      ).toBeVisible();
      expect(
        within(rootElement).queryByText("native.fasta"),
      ).not.toBeInTheDocument();
      expect(app.readServerResource).toHaveBeenNthCalledWith(1, {
        uri: nativeUri,
      });
      expect(app.readServerResource).toHaveBeenNthCalledWith(2, {
        uri: chatUri,
      });
      await waitFor(() => {
        expect(app.callServerTool).toHaveBeenCalledWith({
          arguments: {
            afterRevision: 5,
            sessionId: chatSessionId,
            timeoutMs: 25_000,
          },
          name: "sequence.wait_for_viewer_command",
        });
      });
    } finally {
      mockConnectSuppressToolResult.current = false;
      mockServerToolHandler.current = null;
    }
  });

  it.each(["during connection", "after acquisition input"] as const)(
    "shows an opening error %s without reading a resource or registering a session",
    async (delivery) => {
      const rootElement = document.createElement("div");
      document.body.append(rootElement);
      const message =
        "The installed host did not expose a readable local workspace root. Open a local workspace and retry. The host must provide an independently authenticated local workspace root through MCP roots/list.";
      const sessionId = "11111111-1111-4111-8111-111111111111";
      const result = {
        content: [{ type: "text" as const, text: message }],
        isError: true,
        ...(delivery === "during connection"
          ? {
              _meta: {
                "openai/viewerFile": {
                  primaryFile: {
                    name: "untrusted.fasta",
                    uri: "viewer-file://sequence-viewer/opened/rejected",
                  },
                },
              },
              structuredContent: {
                viewerCommandRevision: 0,
                viewerSessionId: sessionId,
              },
            }
          : {}),
      };
      mockConnectSuppressToolResult.current = delivery !== "during connection";
      mockConnectToolResult.current =
        delivery === "during connection" ? result : null;
      mockServerToolHandler.current = async (request) => {
        const { name } = request as { name: string };
        if (name === "sequence.register_viewer_session") {
          return { structuredContent: { revision: 0, sessionId } };
        }
        return new Promise(() => undefined);
      };

      try {
        await startSequenceViewerApp(rootElement);
        const app = mockAppInstances.at(-1);
        if (app?.ontoolinput == null || app.ontoolresult == null) {
          throw new Error("Expected Sequence viewer opening handlers.");
        }
        if (delivery === "after acquisition input") {
          await app.ontoolinput({
            arguments: { exampleId: "uniprot-human-ras-sv1" },
          });
          await app.ontoolresult(result);
        }

        expect(
          await within(rootElement).findByText("Sequence could not be opened"),
        ).toBeInTheDocument();
        expect(within(rootElement).getByText(message)).toBeInTheDocument();
        expect(
          within(rootElement).queryByText("No sequence selected"),
        ).not.toBeInTheDocument();
        expect(app.readServerResource).not.toHaveBeenCalled();
        expect(app.callServerTool).not.toHaveBeenCalled();
      } finally {
        mockConnectToolResult.current = null;
        mockConnectSuppressToolResult.current = false;
        mockServerToolHandler.current = null;
      }
    },
  );

  it.each([
    {
      description: "missing diagnostic",
      content: [],
      expected:
        "The opening tool failed. Ask Codex to retry opening the sequence from chat.",
    },
    {
      description: "oversized diagnostic",
      content: [{ type: "text" as const, text: "x".repeat(10_000) }],
      expected: `${"x".repeat(1_999)}…`,
    },
  ])(
    "handles a failed chat open with a $description",
    async ({ content, expected }) => {
      const rootElement = document.createElement("div");
      document.body.append(rootElement);
      await startSequenceViewerApp(rootElement);
      const app = mockAppInstances.at(-1);
      if (app?.ontoolinput == null || app.ontoolresult == null) {
        throw new Error("Expected Sequence viewer opening handlers.");
      }

      await app.ontoolinput({ arguments: { path: "results/demo.fasta" } });
      await app.ontoolresult({ content, isError: true });

      expect(
        await within(rootElement).findByText(expected),
      ).toBeInTheDocument();
      expect(app.readServerResource).not.toHaveBeenCalled();
    },
  );

  it.each(["native error", "chat retry"] as const)(
    "ignores a superseded resource load after a %s",
    async (scenario) => {
      const rootElement = document.createElement("div");
      document.body.append(rootElement);
      const sessionId = "11111111-1111-4111-8111-111111111111";
      const file = {
        name: "rejected.fasta",
        resourceUri: "codex-resource://rejected-sequence",
      };
      let finishRead:
        | ((result: { contents: Array<{ text: string; uri: string }> }) => void)
        | undefined;
      const resource = new Promise<{
        contents: Array<{ text: string; uri: string }>;
      }>((resolve) => {
        finishRead = resolve;
      });
      mockConnectSuppressToolResult.current = true;
      mockServerToolHandler.current = async (request) => {
        const { name } = request as { name: string };
        if (name === "sequence.register_viewer_session") {
          return { structuredContent: { revision: 0, sessionId } };
        }
        return new Promise(() => undefined);
      };

      try {
        await startSequenceViewerApp(rootElement);
        const app = mockAppInstances.at(-1);
        if (app?.ontoolinput == null || app.ontoolresult == null) {
          throw new Error("Expected Sequence viewer opening handlers.");
        }
        app.readServerResource.mockReturnValue(resource);
        const loading =
          scenario === "native error"
            ? app.ontoolinput({ arguments: { file } })
            : app.ontoolresult({
                _meta: {
                  "openai/viewerFile": {
                    primaryFile: { name: file.name, uri: file.resourceUri },
                  },
                },
              });
        const message = "The host rejected the selected sequence resource.";
        await app.ontoolresult({
          content: [{ type: "text", text: message }],
          isError: true,
        });
        if (scenario === "chat retry") {
          await app.ontoolinput({ arguments: { path: "results/retry.fasta" } });
        }
        await act(async () => {
          finishRead?.({
            contents: [{ text: ">rejected\nACGT\n", uri: file.resourceUri }],
          });
          await loading;
        });

        expect(
          await within(rootElement).findByText(message),
        ).toBeInTheDocument();
        expect(
          within(rootElement).queryByText(file.name),
        ).not.toBeInTheDocument();
        expect(app.readServerResource).toHaveBeenCalledOnce();
        expect(app.callServerTool).not.toHaveBeenCalled();
      } finally {
        finishRead?.({ contents: [] });
        mockConnectSuppressToolResult.current = false;
        mockServerToolHandler.current = null;
      }
    },
  );

  it("does not adopt a failed opening's pending fallback session during a retry", async () => {
    const rootElement = document.createElement("div");
    document.body.append(rootElement);
    const sessionId = "11111111-1111-4111-8111-111111111111";
    let finishRegistration:
      | ((result: {
          structuredContent: { revision: number; sessionId: string };
        }) => void)
      | undefined;
    const registration = new Promise<{
      structuredContent: { revision: number; sessionId: string };
    }>((resolve) => {
      finishRegistration = resolve;
    });
    mockConnectSuppressToolResult.current = true;
    mockServerToolHandler.current = async (request) => {
      const { name } = request as { name: string };
      if (name === "sequence.register_viewer_session") return registration;
      return new Promise(() => undefined);
    };

    try {
      await startSequenceViewerApp(rootElement);
      const app = mockAppInstances.at(-1);
      if (app?.ontoolinput == null || app.ontoolresult == null) {
        throw new Error("Expected Sequence viewer opening handlers.");
      }
      app.readServerResource.mockResolvedValue({
        contents: [{ text: ">native\nACGT\n", uri: "codex-resource://native" }],
      });
      await app.ontoolinput({
        arguments: {
          file: {
            name: "native.fasta",
            resourceUri: "codex-resource://native",
          },
        },
      });
      await waitFor(() => {
        expect(app.callServerTool).toHaveBeenCalledWith({
          arguments: {},
          name: "sequence.register_viewer_session",
        });
      });
      await app.ontoolresult({
        content: [{ type: "text", text: "The original opening failed." }],
        isError: true,
      });
      await app.ontoolinput({ arguments: { path: "results/retry.fasta" } });
      await act(async () => {
        finishRegistration?.({ structuredContent: { revision: 0, sessionId } });
        await registration;
      });

      expect(
        await within(rootElement).findByText("The original opening failed."),
      ).toBeInTheDocument();
      expect(app.readServerResource).toHaveBeenCalledOnce();
      expect(app.callServerTool).toHaveBeenCalledOnce();
    } finally {
      finishRegistration?.({ structuredContent: { revision: 0, sessionId } });
      mockConnectSuppressToolResult.current = false;
      mockServerToolHandler.current = null;
    }
  });

  it.each([{ opening: "no", args: undefined }, ...openingHints])(
    "preserves live state and command revision with a late $opening hint and result replay",
    async ({ args }) => {
      const rootElement = document.createElement("div");
      document.body.append(rootElement);
      const sessionId = "11111111-1111-4111-8111-111111111111";
      const commandId = "22222222-2222-4222-8222-222222222222";
      let waitCount = 0;
      mockConnectSuppressToolResult.current = true;
      mockServerToolHandler.current = async (request) => {
        const { arguments: args, name } = request as {
          arguments?: { afterRevision?: number };
          name: string;
        };
        if (name === "sequence.wait_for_viewer_command") {
          waitCount += 1;
          if (waitCount === 1) {
            expect(args?.afterRevision).toBe(0);
            return {
              structuredContent: {
                command: {
                  action: "set_display_mode",
                  commandId,
                  displayMode: "fullscreen",
                  revision: 1,
                },
              },
            };
          }
          expect(args?.afterRevision).toBe(1);
          return new Promise(() => undefined);
        }
        if (name === "sequence.complete_viewer_command") {
          return { structuredContent: { completed: true } };
        }
        throw new Error(`Unexpected Sequence tool: ${name}`);
      };

      try {
        await startSequenceViewerApp(rootElement);
        const app = mockAppInstances.at(-1);
        if (
          app?.ontoolinput == null ||
          app.ontoolresult == null ||
          app.callServerTool == null
        ) {
          throw new Error("Expected a stock-host Sequence app.");
        }
        app.readServerResource.mockResolvedValue({
          contents: [
            {
              text: ">demo\nAACCGGTT\n",
              uri: "viewer-file://sequence-viewer/opened/token",
            },
          ],
        });
        const result = {
          _meta: {
            "openai/viewerFile": {
              primaryFile: {
                name: "demo.fasta",
                uri: "viewer-file://sequence-viewer/opened/token",
              },
            },
          },
          structuredContent: {
            viewerCommandRevision: 0,
            viewerReady: true,
            viewerSessionId: sessionId,
          },
        };

        await app.ontoolresult(result);
        await waitFor(() => expect(waitCount).toBe(2));
        const search = await within(rootElement).findByRole("textbox", {
          name: "Search sequence",
        });
        await userEvent.type(search, "CCGG");
        expect(search).toHaveValue("CCGG");
        const resourceReads = app.readServerResource.mock.calls.length;

        if (args != null) {
          await act(async () => app.ontoolinput?.({ arguments: args }));
          expect(
            within(rootElement).getByRole("textbox", {
              name: "Search sequence",
            }),
          ).toBe(search);
          expect(search).toHaveValue("CCGG");
        }
        await app.ontoolresult(result);

        expect(
          within(rootElement).getByRole("textbox", { name: "Search sequence" }),
        ).toBe(search);
        expect(search).toHaveValue("CCGG");
        expect(app.readServerResource).toHaveBeenCalledTimes(resourceReads);
        expect(waitCount).toBe(2);
        expect(
          within(rootElement).queryByText("Loading sequence…"),
        ).not.toBeInTheDocument();
      } finally {
        mockConnectSuppressToolResult.current = false;
        mockServerToolHandler.current = null;
      }
    },
  );

  it("preserves alignment filters when the same stock-host chat result is replayed", async () => {
    const rootElement = document.createElement("div");
    document.body.append(rootElement);
    const sessionId = "33333333-3333-4333-8333-333333333333";
    mockConnectSuppressToolResult.current = true;
    mockServerToolHandler.current = async (request) => {
      const { name } = request as { name: string };
      if (name === "sequence.wait_for_viewer_command") {
        return new Promise(() => undefined);
      }
      throw new Error(`Unexpected Alignment tool: ${name}`);
    };

    try {
      await startSequenceViewerApp(rootElement);
      const app = mockAppInstances.at(-1);
      if (app?.ontoolresult == null) {
        throw new Error("Expected a stock-host Alignment app.");
      }
      app.readServerResource.mockResolvedValue({
        contents: [
          {
            text: ">row-a\nAC-GT\n>row-b\nACTGT\n",
            uri: "viewer-file://sequence-viewer/opened/alignment",
          },
        ],
      });
      const result = {
        _meta: {
          "openai/viewerFile": {
            primaryFile: {
              name: "family.fasta",
              uri: "viewer-file://sequence-viewer/opened/alignment",
            },
          },
        },
        structuredContent: {
          viewerCommandRevision: 0,
          viewerReady: true,
          viewerSessionId: sessionId,
        },
      };

      await app.ontoolresult(result);
      const filter = await within(rootElement).findByRole("textbox", {
        name: "Filter MSA rows",
      });
      await userEvent.type(filter, "row-a");

      await app.ontoolresult(result);

      expect(
        within(rootElement).getByRole("textbox", { name: "Filter MSA rows" }),
      ).toBe(filter);
      expect(filter).toHaveValue("row-a");
      expect(app.readServerResource).toHaveBeenCalledOnce();
    } finally {
      mockConnectSuppressToolResult.current = false;
      mockServerToolHandler.current = null;
    }
  });

  it("loads bounded plugin-owned records on a stock host without scientific viewer extensions", async () => {
    const rootElement = document.createElement("div");
    document.body.append(rootElement);
    const sessionId = "11111111-1111-4111-8111-111111111111";
    const sourceId = "22222222-2222-4222-8222-222222222222";
    const sourceRevision = `sha256:${"a".repeat(64)}`;
    const checkpoint = { structuredContent: { hasCheckpoint: false } };
    let finishCheckpoint: ((value: typeof checkpoint) => void) | undefined;
    const restoringCheckpoint = new Promise<typeof checkpoint>((resolve) => {
      finishCheckpoint = resolve;
    });
    let loading: Promise<void> | undefined;
    mockNativeHostCapabilities.current = null;
    mockConnectSuppressToolResult.current = true;
    mockServerToolHandler.current = async (request) => {
      const { name } = request as { name: string };
      if (name === "sequence.wait_for_viewer_command") {
        return new Promise(() => undefined);
      }
      if (name === "sequence.restore_scientific_checkpoint") {
        return restoringCheckpoint;
      }
      if (name === "sequence.list_scientific_records") {
        return {
          structuredContent: {
            complete: true,
            cursor: "0",
            nextCursor: null,
            records: [
              { description: "bounded", id: "alpha", sequenceLength: 8 },
            ],
            sourceRevision,
          },
        };
      }
      if (name === "sequence.read_scientific_window") {
        return {
          structuredContent: {
            end1Decimal: "8",
            sequence: "AACCGGTT",
            sourceRevision,
            start1Decimal: "1",
          },
        };
      }
      if (name === "sequence.save_scientific_checkpoint") {
        return {
          structuredContent: {
            checkpointVersion: 1,
            lastAcknowledgedRevision: 1,
            logicalSessionId: sessionId,
            recoveryReference: sourceId,
          },
        };
      }
      throw new Error(`Unexpected stock-host Sequence tool: ${name}`);
    };

    try {
      const connecting = startSequenceViewerApp(rootElement);
      const app = mockAppInstances.at(-1);
      if (app?.ontoolresult == null || app.callServerTool == null) {
        throw new Error("Expected standard MCP app tool handlers.");
      }
      loading = app.ontoolresult({
        _meta: {
          "openai/scientific-viewer/plugin-source": {
            family: "sequence",
            fileName: "plugin.fasta",
            format: "fasta",
            protocolVersion: 1,
            sessionId,
            sizeBytesDecimal: "24",
            sourceId,
            sourceRevision,
          },
          "openai/viewerFile": {
            primaryFile: {
              name: "plugin.fasta",
              uri: "viewer-file://sequence-viewer/opened/opaque",
            },
          },
        },
        structuredContent: {
          viewerCommandRevision: 0,
          viewerReady: true,
          viewerSessionId: sessionId,
        },
      });
      await connecting;
      expect(app.callServerTool).not.toHaveBeenCalledWith(
        expect.objectContaining({ name: "sequence.wait_for_viewer_command" }),
      );
      finishCheckpoint?.(checkpoint);
      await loading;

      expect(
        await within(rootElement).findByText("plugin.fasta"),
      ).toBeVisible();
      expect(app.readServerResource).not.toHaveBeenCalled();
      expect(mockNativeHostCapabilities.current).toBeNull();
      const calls = app.callServerTool.mock.calls.map(
        ([request]) => (request as { name: string }).name,
      );
      expect(calls).toEqual(
        expect.arrayContaining([
          "sequence.list_scientific_records",
          "sequence.read_scientific_window",
          "sequence.restore_scientific_checkpoint",
        ]),
      );
      expect(calls.every((name) => !name.startsWith("ui/scientific/"))).toBe(
        true,
      );
    } finally {
      finishCheckpoint?.(checkpoint);
      await loading;
      mockConnectSuppressToolResult.current = false;
      mockNativeHostCapabilities.current = null;
      mockServerToolHandler.current = null;
    }
  });

  it.each([
    { mode: "sequence", opening: "chat" },
    { mode: "alignment", opening: "chat" },
    { mode: "sequence", opening: "native-indexed" },
  ] as const)(
    "restores an authenticated stock-host $opening session before loading its saved $mode state",
    async ({ mode, opening }) => {
      const rootElement = document.createElement("div");
      document.body.append(rootElement);
      const sessionId = "11111111-1111-4111-8111-111111111111";
      const previousSourceId = "22222222-2222-4222-8222-222222222222";
      const restoredSourceId = "33333333-3333-4333-8333-333333333333";
      const sourceRevision = `sha256:${"a".repeat(64)}`;
      const restoredRevision = 7;
      const resourceUri = "viewer-file://sequence-viewer/opened/authenticated";
      const fileName = mode === "alignment" ? "family.fasta" : "restored.fasta";
      const records =
        mode === "alignment"
          ? [
              { id: "row-a", sequence: "AC-GT" },
              { id: "row-b", sequence: "ACTGT" },
            ]
          : [{ id: "alpha", sequence: "AACCGGTT" }];
      const contents = records
        .map(({ id, sequence }) => `>${id}\n${sequence}\n`)
        .join("");
      const sourceStateKey = createArtifactStateKey(contents, fileName);
      const checkpoint = (() => {
        if (mode === "alignment") {
          const parsed = parseMsa(contents, fileName);
          if (parsed.status !== "success") throw new Error(parsed.message);
          const anchor = parsed.document.rows[0];
          if (anchor == null)
            throw new Error("Expected an aligned source row.");
          return encodeSequenceDurableViewerState({
            alignment: createDurableAlignmentState({
              alignmentColumnJump: "3",
              anchorRowId: anchor.id,
              fileName,
              focusedCell: { column: 2, rowId: anchor.id, symbol: "-" },
              guideTreeNewick: null,
              initialDocument: parsed.document,
              motifQuery: "CG",
              pinnedCell: { column: 1, rowId: anchor.id, symbol: "C" },
              referencePositionJump: "2",
              selectedHitIndex: 0,
              sourceStateKey,
              state: createAlignmentWorkbenchState(parsed.document),
              view: {
                analysisScope: "all-unhidden-rows",
                cellWidth: 25,
                colorMode: "identity",
                referenceMode: "anchor",
                residuePalette: "neutral",
                rowFilter: "row-a",
                searchScope: "currently-displayed-rows",
                selectedColumns: { end: 3, start: 1 },
                selectedRows: [anchor.id],
                showAnnotationTracks: true,
                showIdenticalAsDots: true,
                showRnaStructureOverlays: false,
              },
              viewport: { column: 1, row: 0 },
            }),
            family: "sequence",
            mode,
            sourceRevision,
            sourceStateKey,
            version: 1,
          });
        }
        const sourceDocument = parseSequenceDocument({ contents, fileName });
        const record = sourceDocument.records[0];
        if (record == null)
          throw new Error("Expected a sequence source record.");
        return encodeSequenceDurableViewerState({
          family: "sequence",
          mode,
          sequence: createDurableSequenceState({
            activeSearchHitIndex: 0,
            focusCoordinate: 3,
            initialDocument: sourceDocument,
            query: "CCGG",
            sourceStateKey,
            state: createSequenceWorkbenchState(sourceDocument),
            view: {
              geneticCodeId: 1,
              layout: "split",
              orientation: "reverse-complement",
              paletteId: "neutral",
              selectedFeatureId: null,
              selectedRecordId: record.id,
              selection: { end: 5, recordId: record.id, start: 3 },
              showFeatures: true,
              showQuality: false,
              showTranslation: false,
              synchronizedViews: true,
              viewport: { end: 8, start: 1 },
              wrapWidth: 60,
            },
          }),
          sourceRevision,
          sourceStateKey,
          version: 1,
        });
      })();
      const checkpointBase64 = Buffer.from(checkpoint).toString("base64");
      let sessionRestored = false;
      let staleCheckpointReportedMissing = false;
      mockConnectSuppressToolResult.current = true;
      mockServerToolHandler.current = async (request) => {
        const { arguments: args, name } = request as {
          arguments?: {
            recordNumber?: number;
            resourceUri?: string;
            sessionId?: string;
            sourceId?: string;
          };
          name: string;
        };
        if (name === "sequence.restore_chat_viewer_session") {
          expect(args).toEqual({
            resourceUri,
            sessionId,
          });
          sessionRestored = true;
          return {
            _meta: {
              "openai/scientific-viewer/plugin-source": {
                family: "sequence",
                fileName,
                format: "fasta",
                protocolVersion: 1,
                sessionId,
                sizeBytesDecimal: String(contents.length),
                sourceId: restoredSourceId,
                sourceRevision,
              },
            },
            structuredContent: {
              revision: restoredRevision,
              schemaVersion: 1,
              sessionId,
            },
          };
        }
        if (name === "sequence.wait_for_viewer_command") {
          expect(sessionRestored).toBe(true);
          expect(args).toMatchObject({
            afterRevision: restoredRevision,
            sessionId,
          });
          return new Promise(() => undefined);
        }
        if (
          mode === "alignment" &&
          name === "sequence.restore_scientific_checkpoint" &&
          args?.sourceId === previousSourceId
        ) {
          staleCheckpointReportedMissing = true;
          return { structuredContent: { hasCheckpoint: false } };
        }
        if (args?.sourceId !== restoredSourceId) {
          throw new Error(
            "The viewer session is no longer active. Reopen the viewer and try again.",
          );
        }
        if (name === "sequence.restore_scientific_checkpoint") {
          return {
            structuredContent: {
              checkpointBase64,
              hasCheckpoint: true,
              lastAcknowledgedRevision: restoredRevision,
              recoveryReference: restoredSourceId,
              sourceRevision,
            },
          };
        }
        if (name === "sequence.list_scientific_records") {
          return {
            structuredContent: {
              complete: true,
              cursor: "0",
              nextCursor: null,
              records: records.map(({ id, sequence }) => ({
                description: "",
                id,
                sequenceLength: sequence.length,
              })),
              sourceRevision,
            },
          };
        }
        if (name === "sequence.read_scientific_window") {
          const record = records[(args?.recordNumber ?? 1) - 1];
          if (record == null)
            throw new Error("Expected a requested source row.");
          return {
            structuredContent: {
              end1Decimal: String(record.sequence.length),
              sequence: record.sequence,
              sourceRevision,
              start1Decimal: "1",
            },
          };
        }
        if (name === "sequence.save_scientific_checkpoint") {
          return {
            structuredContent: {
              checkpointVersion: 1,
              lastAcknowledgedRevision: 5,
              logicalSessionId: sessionId,
              recoveryReference: restoredSourceId,
            },
          };
        }
        throw new Error(`Unexpected restored Sequence tool: ${name}`);
      };

      try {
        await startSequenceViewerApp(rootElement);
        const app = mockAppInstances.at(-1);
        if (app?.ontoolresult == null || app.callServerTool == null) {
          throw new Error("Expected a stock-host Sequence app.");
        }
        const openingResult = {
          _meta: {
            "openai/scientific-viewer/plugin-source": {
              family: "sequence",
              fileName,
              format: "fasta",
              protocolVersion: 1,
              sessionId,
              sizeBytesDecimal: String(contents.length),
              sourceId: previousSourceId,
              sourceRevision,
            },
            "openai/viewerFile": {
              primaryFile: {
                name: fileName,
                uri: resourceUri,
              },
            },
          },
          structuredContent: {
            ...(opening === "native-indexed"
              ? { file: { name: fileName, resourceUri } }
              : {}),
            viewerCommandRevision: 0,
            viewerReady: true,
            viewerSessionId: sessionId,
          },
        };
        await app.ontoolresult(openingResult);

        await waitFor(() => {
          if (mode === "alignment") {
            expect(
              within(rootElement).getByRole("button", { name: "Alignment" }),
            ).toHaveAttribute("aria-pressed", "true");
            expect(
              within(rootElement).getByRole("textbox", {
                name: "Filter MSA rows",
              }),
            ).toHaveValue("row-a");
            expect(
              within(rootElement).getByDisplayValue("CG"),
            ).toBeInTheDocument();
            return;
          }
          expect(
            rootElement.querySelector('input[aria-label="Search sequence"]'),
          ).toHaveValue("CCGG");
          expect(
            within(rootElement).getByRole("button", { name: "Split" }),
          ).toHaveAttribute("aria-pressed", "true");
        });
        const calls = app.callServerTool.mock.calls.map(
          ([request]) => (request as { name: string }).name,
        );
        expect(
          calls.filter(
            (name) => name === "sequence.restore_chat_viewer_session",
          ),
        ).toHaveLength(1);
        expect(
          calls.indexOf("sequence.restore_chat_viewer_session"),
        ).toBeLessThan(calls.indexOf("sequence.wait_for_viewer_command"));
        expect(calls).not.toContain("sequence.register_viewer_session");
        if (opening === "native-indexed") {
          const search = rootElement.querySelector(
            'input[aria-label="Search sequence"]',
          );
          const previousCalls = calls.length;
          await app.ontoolresult(openingResult);
          expect(
            rootElement.querySelector('input[aria-label="Search sequence"]'),
          ).toBe(search);
          expect(app.callServerTool.mock.calls).toHaveLength(previousCalls);
        }
        expect(staleCheckpointReportedMissing).toBe(mode === "alignment");
        expect(app.readServerResource).not.toHaveBeenCalled();
      } finally {
        mockConnectSuppressToolResult.current = false;
        mockServerToolHandler.current = null;
      }
    },
  );

  it("restores an expired command session after its compressed source loads successfully", async () => {
    const rootElement = document.createElement("div");
    document.body.append(rootElement);
    const sessionId = "11111111-1111-4111-8111-111111111111";
    const sourceId = "22222222-2222-4222-8222-222222222222";
    const commandId = "33333333-3333-4333-8333-333333333333";
    const sourceRevision = `sha256:${"a".repeat(64)}`;
    const resourceUri = "viewer-file://sequence-viewer/opened/compressed";
    const source = {
      family: "sequence",
      fileName: "compressed.fasta.gz",
      format: "unsupported",
      protocolVersion: 1,
      sessionId,
      sizeBytesDecimal: "16",
      sourceId,
      sourceRevision,
    };
    let waitCount = 0;
    mockConnectSuppressToolResult.current = true;
    mockServerToolHandler.current = async (request) => {
      const { arguments: args, name } = request as {
        arguments?: {
          afterRevision?: number;
          resourceUri?: string;
          sessionId?: string;
        };
        name: string;
      };
      if (name === "sequence.restore_scientific_checkpoint") {
        return { structuredContent: { hasCheckpoint: false } };
      }
      if (name === "sequence.wait_for_viewer_command") {
        waitCount += 1;
        if (waitCount === 1) {
          return {
            content: [
              {
                text: "The viewer session is no longer active. Reopen the viewer and try again.",
                type: "text",
              },
            ],
            isError: true,
          };
        }
        if (waitCount === 2) {
          expect(args?.afterRevision).toBe(4);
          return {
            structuredContent: {
              command: {
                action: "set_display_mode",
                commandId,
                displayMode: "fullscreen",
                revision: 5,
              },
            },
          };
        }
        expect(args?.afterRevision).toBe(5);
        return new Promise(() => undefined);
      }
      if (name === "sequence.restore_chat_viewer_session") {
        expect(args).toEqual({ resourceUri, sessionId });
        return {
          _meta: { "openai/scientific-viewer/plugin-source": source },
          structuredContent: { revision: 4, schemaVersion: 1, sessionId },
        };
      }
      if (name === "sequence.complete_viewer_command") {
        return { structuredContent: { completed: true } };
      }
      if (name === "sequence.save_scientific_checkpoint") {
        return {
          structuredContent: {
            checkpointVersion: 1,
            lastAcknowledgedRevision: 1,
            logicalSessionId: sessionId,
            recoveryReference: sourceId,
          },
        };
      }
      throw new Error(`Unexpected expired-session recovery tool: ${name}`);
    };

    try {
      await startSequenceViewerApp(rootElement);
      const app = mockAppInstances.at(-1);
      if (app?.ontoolresult == null || app.callServerTool == null) {
        throw new Error("Expected a stock-host Sequence app.");
      }
      app.readServerResource.mockResolvedValue({
        contents: [{ text: ">compressed\nAACCGGTT\n", uri: resourceUri }],
      });
      await app.ontoolresult({
        _meta: {
          "openai/scientific-viewer/plugin-source": source,
          "openai/viewerFile": {
            primaryFile: { name: source.fileName, uri: resourceUri },
          },
        },
        structuredContent: {
          viewerCommandRevision: 0,
          viewerReady: true,
          viewerSessionId: sessionId,
        },
      });

      await waitFor(() => {
        expect(app.requestDisplayMode).toHaveBeenCalledWith({
          mode: "fullscreen",
        });
        expect(app.callServerTool).toHaveBeenCalledWith({
          arguments: expect.objectContaining({
            applied: true,
            commandId,
            sessionId,
          }),
          name: "sequence.complete_viewer_command",
        });
      });
      expect(app.readServerResource).toHaveBeenCalledOnce();
      expect(
        app.callServerTool.mock.calls.filter(
          ([request]) =>
            (request as { name: string }).name ===
            "sequence.restore_chat_viewer_session",
        ),
      ).toHaveLength(1);
    } finally {
      mockConnectSuppressToolResult.current = false;
      mockServerToolHandler.current = null;
    }
  });

  it("ignores a stale chat restoration after a newer viewer session becomes active", async () => {
    const rootElement = document.createElement("div");
    document.body.append(rootElement);
    const staleSessionId = "11111111-1111-4111-8111-111111111111";
    const staleSourceId = "22222222-2222-4222-8222-222222222222";
    const restoredSourceId = "33333333-3333-4333-8333-333333333333";
    const currentSessionId = "44444444-4444-4444-8444-444444444444";
    const currentSourceId = "55555555-5555-4555-8555-555555555555";
    const staleSourceRevision = `sha256:${"a".repeat(64)}`;
    const currentSourceRevision = `sha256:${"b".repeat(64)}`;
    let resolveStaleRestoration: ((result: unknown) => void) | undefined;
    const staleRestoration = new Promise<unknown>((resolve) => {
      resolveStaleRestoration = resolve;
    });
    const source = ({
      fileName,
      sessionId,
      sourceId,
      sourceRevision,
    }: {
      fileName: string;
      sessionId: string;
      sourceId: string;
      sourceRevision: string;
    }) => ({
      family: "sequence",
      fileName,
      format: "fasta",
      protocolVersion: 1,
      sessionId,
      sizeBytesDecimal: "16",
      sourceId,
      sourceRevision,
    });
    const result = (fileName: string, sessionId: string, sourceId: string) => ({
      _meta: {
        "openai/scientific-viewer/plugin-source": source({
          fileName,
          sessionId,
          sourceId,
          sourceRevision:
            sessionId === staleSessionId
              ? staleSourceRevision
              : currentSourceRevision,
        }),
        "openai/viewerFile": {
          primaryFile: {
            name: fileName,
            uri: `viewer-file://sequence-viewer/opened/${fileName}`,
          },
        },
      },
      structuredContent: {
        viewerCommandRevision: 0,
        viewerReady: true,
        viewerSessionId: sessionId,
      },
    });
    mockConnectSuppressToolResult.current = true;
    mockServerToolHandler.current = async (request) => {
      const { arguments: args, name } = request as {
        arguments?: { sessionId?: string; sourceId?: string };
        name: string;
      };
      if (name === "sequence.restore_chat_viewer_session") {
        expect(args?.sessionId).toBe(staleSessionId);
        return staleRestoration;
      }
      if (name === "sequence.wait_for_viewer_command") {
        expect(args?.sessionId).toBe(currentSessionId);
        return new Promise(() => undefined);
      }
      if (args?.sourceId !== currentSourceId) {
        throw new Error("The viewer session is no longer active.");
      }
      if (name === "sequence.restore_scientific_checkpoint") {
        return { structuredContent: { hasCheckpoint: false } };
      }
      if (name === "sequence.list_scientific_records") {
        return {
          structuredContent: {
            complete: true,
            cursor: "0",
            nextCursor: null,
            records: [{ description: "", id: "current", sequenceLength: 8 }],
            sourceRevision: currentSourceRevision,
          },
        };
      }
      if (name === "sequence.read_scientific_window") {
        return {
          structuredContent: {
            end1Decimal: "8",
            sequence: "AACCGGTT",
            sourceRevision: currentSourceRevision,
            start1Decimal: "1",
          },
        };
      }
      if (name === "sequence.save_scientific_checkpoint") {
        return {
          structuredContent: {
            checkpointVersion: 1,
            lastAcknowledgedRevision: 1,
            logicalSessionId: currentSessionId,
            recoveryReference: currentSourceId,
          },
        };
      }
      throw new Error(`Unexpected concurrent Sequence tool: ${name}`);
    };

    try {
      await startSequenceViewerApp(rootElement);
      const app = mockAppInstances.at(-1);
      if (app?.ontoolresult == null || app.callServerTool == null) {
        throw new Error("Expected a stock-host Sequence app.");
      }
      const staleLoad = app.ontoolresult(
        result("stale.fasta", staleSessionId, staleSourceId),
      );
      await waitFor(() => {
        expect(app.callServerTool).toHaveBeenCalledWith({
          arguments: {
            resourceUri: "viewer-file://sequence-viewer/opened/stale.fasta",
            sessionId: staleSessionId,
          },
          name: "sequence.restore_chat_viewer_session",
        });
      });

      const currentResult = result(
        "current.fasta",
        currentSessionId,
        currentSourceId,
      );
      await app.ontoolresult(currentResult);
      const search = await within(rootElement).findByRole("textbox", {
        name: "Search sequence",
      });
      await userEvent.type(search, "GG");
      resolveStaleRestoration?.({
        _meta: {
          "openai/scientific-viewer/plugin-source": source({
            fileName: "stale.fasta",
            sessionId: staleSessionId,
            sourceId: restoredSourceId,
            sourceRevision: staleSourceRevision,
          }),
        },
        structuredContent: {
          revision: 3,
          schemaVersion: 1,
          sessionId: staleSessionId,
        },
      });
      await staleLoad;
      await app.ontoolresult(currentResult);

      expect(
        await within(rootElement).findByText("current.fasta"),
      ).toBeVisible();
      expect(
        within(rootElement).getByRole("textbox", { name: "Search sequence" }),
      ).toBe(search);
      expect(search).toHaveValue("GG");
      expect(
        app.callServerTool.mock.calls.filter(
          ([request]) =>
            (request as { name: string }).name ===
            "sequence.list_scientific_records",
        ),
      ).toHaveLength(2);
      expect(app.readServerResource).not.toHaveBeenCalled();
    } finally {
      mockConnectSuppressToolResult.current = false;
      mockServerToolHandler.current = null;
    }
  });

  it("fails closed when chat restoration returns a different source revision", async () => {
    const rootElement = document.createElement("div");
    document.body.append(rootElement);
    const sessionId = "11111111-1111-4111-8111-111111111111";
    const sourceId = "22222222-2222-4222-8222-222222222222";
    const sourceRevision = `sha256:${"a".repeat(64)}`;
    mockConnectSuppressToolResult.current = true;
    mockServerToolHandler.current = async (request) => {
      const { name } = request as { name: string };
      if (name === "sequence.restore_chat_viewer_session") {
        return {
          _meta: {
            "openai/scientific-viewer/plugin-source": {
              family: "sequence",
              fileName: "changed.fasta",
              format: "fasta",
              protocolVersion: 1,
              sessionId,
              sizeBytesDecimal: "16",
              sourceId: "33333333-3333-4333-8333-333333333333",
              sourceRevision: `sha256:${"b".repeat(64)}`,
            },
          },
          structuredContent: { revision: 0, sessionId },
        };
      }
      throw new Error("The viewer session is no longer active.");
    };

    try {
      await startSequenceViewerApp(rootElement);
      const app = mockAppInstances.at(-1);
      if (app?.ontoolresult == null) {
        throw new Error("Expected a stock-host Sequence app.");
      }
      await app.ontoolresult({
        _meta: {
          "openai/scientific-viewer/plugin-source": {
            family: "sequence",
            fileName: "changed.fasta",
            format: "fasta",
            protocolVersion: 1,
            sessionId,
            sizeBytesDecimal: "16",
            sourceId,
            sourceRevision,
          },
          "openai/viewerFile": {
            primaryFile: {
              name: "changed.fasta",
              uri: "viewer-file://sequence-viewer/opened/changed",
            },
          },
        },
        structuredContent: {
          viewerCommandRevision: 0,
          viewerReady: true,
          viewerSessionId: sessionId,
        },
      });

      expect(
        await within(rootElement).findByText(
          /source changed or could not be reauthorized/u,
        ),
      ).toBeInTheDocument();
      expect(app.readServerResource).not.toHaveBeenCalled();
    } finally {
      mockConnectSuppressToolResult.current = false;
      mockServerToolHandler.current = null;
    }
  });

  it("flushes the latest stock-host interaction during capture-phase pagehide", async () => {
    const rootElement = document.createElement("div");
    document.body.append(rootElement);
    const sessionId = "11111111-1111-4111-8111-111111111111";
    const sourceId = "22222222-2222-4222-8222-222222222222";
    const sourceRevision = `sha256:${"a".repeat(64)}`;
    const checkpoints: Uint8Array[] = [];
    mockConnectSuppressToolResult.current = true;
    mockServerToolHandler.current = async (request) => {
      const { arguments: args, name } = request as {
        arguments?: { checkpointBase64?: string };
        name: string;
      };
      if (name === "sequence.wait_for_viewer_command") {
        return new Promise(() => undefined);
      }
      if (name === "sequence.restore_scientific_checkpoint") {
        return { structuredContent: { hasCheckpoint: false } };
      }
      if (name === "sequence.list_scientific_records") {
        return {
          structuredContent: {
            complete: true,
            cursor: "0",
            nextCursor: null,
            records: [{ description: "", id: "alpha", sequenceLength: 8 }],
            sourceRevision,
          },
        };
      }
      if (name === "sequence.read_scientific_window") {
        return {
          structuredContent: {
            end1Decimal: "8",
            sequence: "AACCGGTT",
            sourceRevision,
            start1Decimal: "1",
          },
        };
      }
      if (name === "sequence.save_scientific_checkpoint") {
        if (args?.checkpointBase64 == null) {
          throw new Error("Expected a bounded private viewer checkpoint.");
        }
        checkpoints.push(Buffer.from(args.checkpointBase64, "base64"));
        return {
          structuredContent: {
            checkpointVersion: 1,
            lastAcknowledgedRevision: checkpoints.length,
            logicalSessionId: sessionId,
            recoveryReference: sourceId,
          },
        };
      }
      throw new Error(`Unexpected Sequence checkpoint tool: ${name}`);
    };

    try {
      await startSequenceViewerApp(rootElement);
      const app = mockAppInstances.at(-1);
      if (app?.ontoolresult == null) {
        throw new Error("Expected a stock-host Sequence app.");
      }
      await app.ontoolresult({
        _meta: {
          "openai/scientific-viewer/plugin-source": {
            family: "sequence",
            fileName: "capture.fasta",
            format: "fasta",
            protocolVersion: 1,
            sessionId,
            sizeBytesDecimal: "16",
            sourceId,
            sourceRevision,
          },
          "openai/viewerFile": {
            primaryFile: {
              name: "capture.fasta",
              uri: "viewer-file://sequence-viewer/opened/capture",
            },
          },
        },
        structuredContent: {
          viewerCommandRevision: 0,
          viewerReady: true,
          viewerSessionId: sessionId,
        },
      });
      const search = await within(rootElement).findByRole("textbox", {
        name: "Search sequence",
      });
      await userEvent.type(search, "CCGG");
      checkpoints.length = 0;

      const persistedPagehide = new Event("pagehide");
      Object.defineProperty(persistedPagehide, "persisted", { value: true });
      window.dispatchEvent(persistedPagehide);

      await waitFor(() => {
        expect(checkpoints).toHaveLength(1);
        expect(decodeSequenceDurableViewerState(checkpoints[0]!)).toMatchObject(
          {
            sequence: { query: "CCGG" },
            sourceRevision,
          },
        );
      });

      await userEvent.clear(search);
      await userEvent.type(search, "TT");
      checkpoints.length = 0;
      const visibility = vi
        .spyOn(document, "visibilityState", "get")
        .mockReturnValue("hidden");
      try {
        document.dispatchEvent(new Event("visibilitychange"));
        await waitFor(() => {
          expect(checkpoints).toHaveLength(1);
          expect(
            decodeSequenceDurableViewerState(checkpoints[0]!),
          ).toMatchObject({
            sequence: { query: "TT" },
            sourceRevision,
          });
        });
      } finally {
        visibility.mockRestore();
      }

      await userEvent.clear(search);
      await userEvent.type(search, "GG");
      checkpoints.length = 0;
      window.dispatchEvent(new Event("pagehide"));
      await waitFor(() => {
        expect(checkpoints).toHaveLength(1);
        expect(decodeSequenceDurableViewerState(checkpoints[0]!)).toMatchObject(
          {
            sequence: { query: "GG" },
            sourceRevision,
          },
        );
      });
    } finally {
      mockConnectSuppressToolResult.current = false;
      mockServerToolHandler.current = null;
    }
  });

  it("hydrates a trusted native open from structured tool-result content", async () => {
    const rootElement = document.createElement("div");
    document.body.append(rootElement);

    await startSequenceViewerApp(rootElement);
    const app = mockAppInstances.at(-1);
    if (app == null || app.ontoolinput == null || app.ontoolresult == null) {
      throw new Error("Expected sequence viewer app tool handlers.");
    }
    app.readServerResource.mockResolvedValue({
      contents: [
        {
          text: ">trusted\nACGT\n",
          uri: "codex-resource://trusted-family",
        },
      ],
    });

    await app.ontoolinput({ arguments: {} });
    expect(await screen.findByText("No sequence selected")).toBeInTheDocument();
    await app.ontoolresult({
      structuredContent: {
        file: {
          name: "family.fasta",
          resourceUri: "codex-resource://trusted-family",
        },
      },
    });

    expect(
      await within(rootElement).findByText("family.fasta"),
    ).toBeInTheDocument();
    expect(app.readServerResource).toHaveBeenCalledWith({
      uri: "codex-resource://trusted-family",
    });
  });

  it("lets an authoritative indexed native result supersede an in-flight oversized host resource", async () => {
    const rootElement = document.createElement("div");
    document.body.append(rootElement);
    async function* lines() {
      yield ">indexed";
      yield "ACGT";
    }
    const indexedEnvelope = serializeIndexedSequenceEnvelope(
      await parseIndexedSequenceLines({
        compressed: false,
        fileName: "family.fasta",
        format: "fasta",
        lines: lines(),
        sourceBytes: 32 * 1_024 * 1_024 + 1,
        sourceVersion: "native-indexed-v1",
      }),
    );
    let resolveHostRead:
      | ((value: { contents: Array<{ text: string; uri: string }> }) => void)
      | undefined;
    const hostRead = new Promise<{
      contents: Array<{ text: string; uri: string }>;
    }>((resolve) => {
      resolveHostRead = resolve;
    });

    await startSequenceViewerApp(rootElement);
    const app = mockAppInstances.at(-1);
    if (app == null || app.ontoolinput == null || app.ontoolresult == null) {
      throw new Error("Expected sequence viewer app tool handlers.");
    }
    app.readServerResource.mockImplementation(
      async ({ uri }: { uri: string }) => {
        if (uri === "codex-resource://oversized-family") {
          return await hostRead;
        }
        return { contents: [{ text: indexedEnvelope, uri }] };
      },
    );

    const inputLoad = app.ontoolinput({
      arguments: {
        file: {
          name: "family.fasta",
          resourceUri: "codex-resource://oversized-family",
        },
      },
    });
    await waitFor(() => {
      expect(app.readServerResource).toHaveBeenCalledWith({
        uri: "codex-resource://oversized-family",
      });
    });
    await app.ontoolresult({
      structuredContent: {
        file: {
          name: "family.fasta",
          resourceUri: "viewer-file://sequence-viewer/opened/indexed-token",
        },
      },
    });

    expect(
      await within(rootElement).findByText("family.fasta"),
    ).toBeInTheDocument();
    expect(
      within(rootElement).getByRole("gridcell", {
        name: /indexed position 1 A/,
      }),
    ).toBeInTheDocument();
    resolveHostRead?.({
      contents: [
        {
          text: ">stale-host\nTTTT\n",
          uri: "codex-resource://oversized-family",
        },
      ],
    });
    await inputLoad;
    expect(
      within(rootElement).getByRole("gridcell", {
        name: /indexed position 1 A/,
      }),
    ).toBeInTheDocument();
    expect(within(rootElement).queryByText("stale-host")).toBeNull();
  });

  it("keeps the native host resource without rereading it when metadata cannot provide an indexed result", async () => {
    const rootElement = document.createElement("div");
    document.body.append(rootElement);

    await startSequenceViewerApp(rootElement);
    const app = mockAppInstances.at(-1);
    if (app == null || app.ontoolinput == null || app.ontoolresult == null) {
      throw new Error("Expected sequence viewer app tool handlers.");
    }
    app.readServerResource.mockResolvedValue({
      contents: [{ text: ">direct\nACGT\n", uri: "codex-resource://direct" }],
    });
    const directInput = {
      file: {
        name: "direct.fasta",
        resourceUri: "codex-resource://direct",
      },
    };

    await app.ontoolinput({ arguments: directInput });
    await app.ontoolresult({ structuredContent: directInput });

    expect(await screen.findByText("direct.fasta")).toBeInTheDocument();
    expect(app.readServerResource).toHaveBeenCalledOnce();
  });

  it("asks Codex to reopen an expired historical chat resource", async () => {
    const rootElement = document.createElement("div");
    document.body.append(rootElement);

    await startSequenceViewerApp(rootElement);
    const app = mockAppInstances.at(-1);
    expect(app).toBeDefined();
    if (app == null || app.ontoolresult == null) {
      throw new Error("Expected sequence viewer app tool result handler.");
    }
    app.getHostCapabilities.mockReturnValue({ message: { text: {} } });
    app.readServerResource.mockRejectedValue(
      new Error(
        "MCP error -32603: SEQUENCE_VIEWER_FILE_EXPIRED: This historical viewer link has expired. Reopen the file from chat.",
      ),
    );

    await app.ontoolresult({
      _meta: {
        "openai/viewerFile": {
          primaryFile: {
            name: "demo.fasta",
            uri: "viewer-file://sequence-viewer/opened/token",
          },
        },
      },
    });
    await userEvent.click(
      await within(rootElement).findByRole("button", {
        name: "Reopen from chat",
      }),
    );

    expect(app.sendMessage).toHaveBeenCalledWith({
      content: [
        {
          text: "Reopen the file used by this historical Biological Sequence & Alignment Viewer card from its current local path.",
          type: "text",
        },
      ],
      role: "user",
    });
  });

  it("moves the same live sequence viewer between chat and the side pane", async () => {
    const rootElement = document.createElement("div");
    document.body.append(rootElement);

    await startSequenceViewerApp(rootElement);
    const app = mockAppInstances.at(-1);
    expect(app).toBeDefined();
    if (app == null || app.ontoolinput == null || app.ontoolresult == null) {
      throw new Error("Expected sequence viewer app tool handlers.");
    }
    app.readServerResource.mockResolvedValue({
      contents: [
        {
          text: ">demo\nACGT\n",
          uri: "viewer-file://sequence-viewer/opened/token",
        },
      ],
    });

    await app.ontoolinput({ arguments: { path: "results/demo.fasta" } });
    await app.ontoolresult({
      _meta: {
        "openai/viewerFile": {
          primaryFile: {
            name: "demo.fasta",
            uri: "viewer-file://sequence-viewer/opened/token",
          },
        },
      },
    });

    const viewer = within(rootElement);
    await userEvent.click(
      await viewer.findByRole("button", { name: "Open in side pane" }),
    );
    expect(app.requestDisplayMode).toHaveBeenCalledWith({ mode: "fullscreen" });
    expect(
      await viewer.findByRole("button", { name: "Return to chat" }),
    ).toBeInTheDocument();

    await userEvent.click(
      viewer.getByRole("button", { name: "Return to chat" }),
    );
    expect(app.requestDisplayMode).toHaveBeenLastCalledWith({ mode: "inline" });
    expect(app.readServerResource).toHaveBeenCalledOnce();
  });

  it.each([
    { presentation: "full", toolbarVisible: true },
    { presentation: "inline", toolbarVisible: false },
  ] as const)(
    "uses $presentation opening presentation without changing host display mode",
    async ({ presentation, toolbarVisible }) => {
      const rootElement = document.createElement("div");
      document.body.append(rootElement);
      await startSequenceViewerApp(rootElement);
      const app = mockAppInstances.at(-1);
      if (app?.ontoolinput == null || app.ontoolresult == null) {
        throw new Error("Expected a Sequence viewer opening app.");
      }
      app.getHostCapabilities.mockReturnValue({
        updateModelContext: { text: {} },
      });
      app.readServerResource.mockResolvedValue({
        contents: [
          {
            text: ">demo\nAACCGGTT\n",
            uri: "viewer-file://sequence-viewer/opened/presentation",
          },
        ],
      });

      await app.ontoolinput({
        arguments: { path: "results/demo.fasta", presentation },
      });
      const result = {
        _meta: {
          "openai/viewerFile": {
            primaryFile: {
              name: "demo.fasta",
              uri: "viewer-file://sequence-viewer/opened/presentation",
            },
          },
        },
        structuredContent: { viewerPresentation: presentation },
      };
      await app.ontoolresult(result);

      await waitFor(() => {
        expect(
          rootElement.querySelector("[data-toolbar-visible]"),
        ).toHaveAttribute("data-toolbar-visible", String(toolbarVisible));
      });
      if (!toolbarVisible) {
        await waitFor(() => {
          expect(app.updateModelContext).toHaveBeenLastCalledWith(
            expect.objectContaining({
              structuredContent: expect.objectContaining({
                toolbarVisible: false,
              }),
            }),
          );
        });
        const updateCountBeforeReveal =
          app.updateModelContext.mock.calls.length;
        await userEvent.click(
          within(rootElement).getByRole("button", {
            name: "Reveal sequence viewer toolbar",
          }),
        );
        for (const [update] of app.updateModelContext.mock.calls.slice(
          updateCountBeforeReveal,
        )) {
          expect(update).toMatchObject({
            structuredContent: { toolbarVisible: false },
          });
        }
        await userEvent.click(
          within(rootElement).getByRole("button", { name: "Show toolbar" }),
        );
        await waitFor(() => {
          expect(app.updateModelContext).toHaveBeenLastCalledWith(
            expect.objectContaining({
              structuredContent: expect.objectContaining({
                toolbarVisible: true,
              }),
            }),
          );
        });
        await app.ontoolresult(result);
        expect(
          rootElement.querySelector("[data-toolbar-visible]"),
        ).toHaveAttribute("data-toolbar-visible", "true");
      }
      expect(app.requestDisplayMode).not.toHaveBeenCalled();
      expect(app.readServerResource).toHaveBeenCalledOnce();
    },
  );

  it("applies a model-issued display command through the MCP App bridge", async () => {
    const sessionId = "11111111-1111-4111-8111-111111111111";
    const commandId = "22222222-2222-4222-8222-222222222222";
    let waitCount = 0;
    mockServerToolHandler.current = async (request) => {
      const { name } = request as { name: string };
      if (name === "sequence.register_viewer_session") {
        return { structuredContent: { revision: 0, sessionId } };
      }
      if (name === "sequence.wait_for_viewer_command") {
        waitCount += 1;
        if (waitCount === 1) {
          return {
            structuredContent: {
              command: {
                action: "set_display_mode",
                commandId,
                displayMode: "fullscreen",
                revision: 1,
              },
            },
          };
        }
        return new Promise(() => undefined);
      }
      return { structuredContent: { completed: true } };
    };

    try {
      await startSequenceViewerApp(document.createElement("div"));
      const app = mockAppInstances.at(-1);
      expect(app?.callServerTool).toBeDefined();
      if (app?.ontoolinput == null) {
        throw new Error("Expected Sequence viewer app input handler.");
      }
      app.readServerResource.mockResolvedValue({
        contents: [{ text: ">demo\nACGT\n", uri: "codex-resource://demo" }],
      });
      await app.ontoolinput({
        arguments: {
          file: { name: "demo.fasta", resourceUri: "codex-resource://demo" },
        },
      });
      await waitFor(() => {
        expect(app?.requestDisplayMode).toHaveBeenCalledWith({
          mode: "fullscreen",
        });
        expect(app?.callServerTool).toHaveBeenCalledWith({
          arguments: {
            applied: true,
            commandId,
            message: "Moved the viewer to the side pane.",
            sessionId,
            state: { displayMode: "fullscreen" },
          },
          name: "sequence.complete_viewer_command",
        });
      });
    } finally {
      mockServerToolHandler.current = null;
    }
  });

  it("applies model-issued toolbar visibility through the existing viewer command queue", async () => {
    const rootElement = document.createElement("div");
    document.body.append(rootElement);
    const sessionId = "11111111-1111-4111-8111-111111111111";
    const commandId = "22222222-2222-4222-8222-222222222222";
    let waitCount = 0;
    mockConnectSuppressToolResult.current = true;
    mockServerToolHandler.current = async (request) => {
      const { name } = request as { name: string };
      if (name === "sequence.wait_for_viewer_command") {
        waitCount += 1;
        if (waitCount === 1) {
          return {
            structuredContent: {
              command: {
                action: "set_toolbar_visibility",
                commandId,
                revision: 1,
                visible: false,
              },
            },
          };
        }
        return new Promise(() => undefined);
      }
      if (name === "sequence.complete_viewer_command") {
        return { structuredContent: { completed: true } };
      }
      throw new Error(`Unexpected toolbar visibility tool: ${name}`);
    };

    try {
      await startSequenceViewerApp(rootElement);
      const app = mockAppInstances.at(-1);
      if (app?.ontoolresult == null || app.callServerTool == null) {
        throw new Error("Expected a model-controllable Sequence viewer.");
      }
      app.readServerResource.mockResolvedValue({
        contents: [
          {
            text: ">demo\nAACCGGTT\n",
            uri: "viewer-file://sequence-viewer/opened/toolbar",
          },
        ],
      });
      await app.ontoolresult({
        _meta: {
          "openai/viewerFile": {
            primaryFile: {
              name: "demo.fasta",
              uri: "viewer-file://sequence-viewer/opened/toolbar",
            },
          },
        },
        structuredContent: {
          viewerCommandRevision: 0,
          viewerReady: true,
          viewerSessionId: sessionId,
        },
      });

      await waitFor(() => {
        expect(
          rootElement.querySelector("[data-toolbar-visible]"),
        ).toHaveAttribute("data-toolbar-visible", "false");
        expect(app.callServerTool).toHaveBeenCalledWith({
          arguments: expect.objectContaining({
            applied: true,
            commandId,
            sessionId,
            state: { toolbarVisible: false },
          }),
          name: "sequence.complete_viewer_command",
        });
      });
      expect(app.requestDisplayMode).not.toHaveBeenCalled();
      expect(
        app.callServerTool.mock.calls.filter(
          ([request]) =>
            (request as { name: string }).name ===
            "sequence.complete_viewer_command",
        ),
      ).toHaveLength(1);
    } finally {
      mockConnectSuppressToolResult.current = false;
      mockServerToolHandler.current = null;
    }
  });

  it("retries a lost completion response without reapplying the command", async () => {
    const sessionId = "11111111-1111-4111-8111-111111111111";
    const commandId = "22222222-2222-4222-8222-222222222222";
    let waitCount = 0;
    let completionCount = 0;
    mockServerToolHandler.current = async (request) => {
      const { name } = request as { name: string };
      if (name === "sequence.register_viewer_session") {
        return { structuredContent: { revision: 0, sessionId } };
      }
      if (name === "sequence.wait_for_viewer_command") {
        waitCount += 1;
        if (waitCount === 1) {
          return {
            structuredContent: {
              command: {
                action: "set_display_mode",
                commandId,
                displayMode: "fullscreen",
                revision: 1,
              },
            },
          };
        }
        return new Promise(() => undefined);
      }
      if (name === "sequence.complete_viewer_command") {
        completionCount += 1;
        if (completionCount === 1) {
          throw new Error(
            "response lost after the server persisted completion",
          );
        }
      }
      return { structuredContent: { completed: true } };
    };

    try {
      await startSequenceViewerApp(document.createElement("div"));
      const app = mockAppInstances.at(-1);
      if (app?.ontoolinput == null) {
        throw new Error("Expected Sequence viewer app input handler.");
      }
      app.readServerResource.mockResolvedValue({
        contents: [{ text: ">demo\nACGT\n", uri: "codex-resource://demo" }],
      });
      await app.ontoolinput({
        arguments: {
          file: { name: "demo.fasta", resourceUri: "codex-resource://demo" },
        },
      });
      await waitFor(
        () => {
          expect(completionCount).toBe(2);
          expect(app?.requestDisplayMode).toHaveBeenCalledOnce();
          expect(app?.callServerTool).toHaveBeenCalledWith({
            arguments: {
              afterRevision: 1,
              sessionId,
              timeoutMs: 25_000,
            },
            name: "sequence.wait_for_viewer_command",
          });
        },
        { timeout: 3_000 },
      );
    } finally {
      mockServerToolHandler.current = null;
    }
  });

  it("advances to the next command after a proxy-bounded large feature query", async () => {
    const sessionId = "11111111-1111-4111-8111-111111111111";
    const queryCommandId = "22222222-2222-4222-8222-222222222222";
    const displayCommandId = "33333333-3333-4333-8333-333333333333";
    const features = Array.from(
      { length: 50 },
      (_, index) => `     misc_feature    ${index + 1}..${index + 1}
                     /gene="cI"
                     /note="feature-${index}-${"x".repeat(5_000)}"`,
    ).join("\n");
    const genbank = `LOCUS       LARGE                    100 bp    DNA     linear
FEATURES             Location/Qualifiers
     source          1..100
${features}
ORIGIN
        1 ${"a".repeat(100)}
//
`;
    mockConnectToolResult.current = {
      _meta: {
        "openai/viewerFile": {
          primaryFile: {
            name: "large-features.gb",
            uri: "viewer-file://sequence-viewer/opened/large-features",
          },
        },
      },
      structuredContent: {
        viewerCommandRevision: 0,
        viewerReady: true,
        viewerSessionId: sessionId,
      },
    };
    mockConnectToolResultAfterConnect.current = true;
    const completions: Array<
      Parameters<typeof encodedSequenceToolRequestBytes>[0]
    > = [];
    mockServerToolHandler.current = async (request) => {
      const typedRequest = request as {
        arguments?: { afterRevision?: number };
        name: string;
      };
      if (typedRequest.name === "sequence.wait_for_viewer_command") {
        if (typedRequest.arguments?.afterRevision === 0) {
          return {
            structuredContent: {
              command: {
                action: "query_viewer",
                commandId: queryCommandId,
                request: { limit: 50, query: "cI", target: "features" },
                revision: 1,
              },
            },
          };
        }
        if (typedRequest.arguments?.afterRevision === 1) {
          return {
            structuredContent: {
              command: {
                action: "set_display_mode",
                commandId: displayCommandId,
                displayMode: "fullscreen",
                revision: 2,
              },
            },
          };
        }
        return new Promise(() => undefined);
      }
      if (typedRequest.name === "sequence.complete_viewer_command") {
        completions.push(
          request as Parameters<typeof encodedSequenceToolRequestBytes>[0],
        );
      }
      return { structuredContent: { completed: true } };
    };

    try {
      await startSequenceViewerApp(document.createElement("div"));
      const app = mockAppInstances.at(-1);
      expect(app).toBeDefined();
      app?.readServerResource.mockResolvedValue({
        contents: [
          {
            text: genbank,
            uri: "viewer-file://sequence-viewer/opened/large-features",
          },
        ],
      });
      await waitFor(
        () => {
          expect(completions).toHaveLength(2);
          expect(app?.requestDisplayMode).toHaveBeenCalledWith({
            mode: "fullscreen",
          });
          expect(app?.callServerTool).toHaveBeenCalledWith({
            arguments: {
              afterRevision: 2,
              sessionId,
              timeoutMs: 25_000,
            },
            name: "sequence.wait_for_viewer_command",
          });
        },
        { timeout: 5_000 },
      );
      const queryCompletion = completions[0];
      expect(queryCompletion).toMatchObject({
        arguments: {
          applied: true,
          commandId: queryCommandId,
          state: {
            query: {
              nextCursor: expect.any(String),
              page: { totalCount: 50 },
              truncated: true,
            },
          },
        },
      });
      const fullRequestBytes = new TextEncoder().encode(
        JSON.stringify({
          id: "sequence-viewer-completion",
          jsonrpc: "2.0",
          method: "tools/call",
          params: queryCompletion,
        }),
      ).byteLength;
      expect(fullRequestBytes).toBeLessThanOrEqual(
        SEQUENCE_VIEWER_LIMITS.persistence.proxyEnvelopeBytes,
      );
    } finally {
      mockConnectToolResult.current = null;
      mockConnectToolResultAfterConnect.current = false;
      mockServerToolHandler.current = null;
    }
  }, 15_000);

  it.each(["committed", "rejected"] as const)(
    "shows a private export artifact only after its authenticated %s completion",
    async (outcome) => {
      const sessionId = "11111111-1111-4111-8111-111111111111";
      const commandId = "22222222-2222-4222-8222-222222222222";
      const artifactId = "33333333-3333-4333-8333-333333333333";
      const artifactName = `${outcome}-public-reference.fasta`;
      let waitCount = 0;
      let releasePersistence: (() => void) | undefined;
      let releaseCompletion: (() => void) | undefined;
      const persistenceStarted = vi.fn();
      const completionStarted = vi.fn();
      mockServerToolHandler.current = async (request) => {
        const { arguments: args, name } = request as {
          arguments?: {
            applied?: boolean;
            byteLength?: number;
            format?: string;
            mediaType?: string;
            name?: string;
            sha256?: string;
            uploadId?: string;
          };
          name: string;
        };
        if (name === "sequence.register_viewer_session") {
          return { structuredContent: { revision: 0, sessionId } };
        }
        if (name === "sequence.wait_for_viewer_command") {
          waitCount += 1;
          if (waitCount === 1) {
            return {
              structuredContent: {
                command: {
                  action: "export_artifact",
                  commandId,
                  destination: { kind: "private" },
                  format: "fasta",
                  name: `${outcome}-public-reference`,
                  revision: 1,
                  scope: "all",
                },
              },
            };
          }
          return new Promise(() => undefined);
        }
        if (name === "sequence.persist_workbench_payload") {
          persistenceStarted();
          return await new Promise((resolve) => {
            releasePersistence = () => {
              resolve(
                outcome === "rejected"
                  ? {
                      content: [
                        {
                          text: "The artifact media type is not supported.",
                          type: "text",
                        },
                      ],
                      isError: true,
                    }
                  : {
                      structuredContent: {
                        createdAt: 1,
                        format: args?.format,
                        id: artifactId,
                        kind: "artifact",
                        mediaType: args?.mediaType,
                        name: args?.name,
                        resourceUri: `viewer-artifact://sequence-viewer/generated/${artifactId}`,
                        sha256: args?.sha256,
                        size: args?.byteLength,
                        version: 1,
                      },
                    },
              );
            };
          });
        }
        if (name === "sequence.abort_workbench_payload_upload") {
          return {
            structuredContent: { aborted: true, uploadId: args?.uploadId },
          };
        }
        if (name === "sequence.complete_viewer_command") {
          completionStarted(args?.applied);
          if (outcome === "committed") {
            return await new Promise((resolve) => {
              releaseCompletion = () => {
                resolve({ structuredContent: { completed: true } });
              };
            });
          }
          return { structuredContent: { completed: true } };
        }
        throw new Error(`Unexpected private export tool: ${name}`);
      };

      try {
        const rootElement = document.createElement("div");
        document.body.append(rootElement);
        await startSequenceViewerApp(rootElement);
        const app = mockAppInstances.at(-1);
        if (app?.ontoolinput == null) {
          throw new Error("Expected sequence viewer app input handler.");
        }
        app.readServerResource.mockResolvedValue({
          contents: [
            {
              text: ">public-reference\nACGT\n",
              uri: "codex-resource://public",
            },
          ],
        });
        await app.ontoolinput({
          arguments: {
            file: {
              name: "public.fasta",
              resourceUri: "codex-resource://public",
            },
          },
        });
        await waitFor(() => expect(persistenceStarted).toHaveBeenCalledOnce());
        await userEvent.click(
          within(rootElement).getByRole("button", { name: "Export" }),
        );
        expect(within(rootElement).queryByText(artifactName)).toBeNull();

        await act(async () => releasePersistence?.());
        await waitFor(() =>
          expect(completionStarted).toHaveBeenCalledWith(
            outcome === "committed",
          ),
        );
        expect(within(rootElement).queryByText(artifactName)).toBeNull();

        if (outcome === "committed") {
          await act(async () => releaseCompletion?.());
          expect(
            await within(rootElement).findByText(artifactName),
          ).toBeInTheDocument();
        } else {
          expect(app.callServerTool).toHaveBeenCalledWith({
            arguments: expect.objectContaining({
              applied: false,
              commandId,
              message: expect.stringContaining(
                "The artifact media type is not supported.",
              ),
              sessionId,
            }),
            name: "sequence.complete_viewer_command",
          });
          expect(within(rootElement).queryByText(artifactName)).toBeNull();
        }
      } finally {
        releasePersistence?.();
        releaseCompletion?.();
        mockServerToolHandler.current = null;
      }
    },
  );

  it("completes an aborted persistence command when the viewer session changes", async () => {
    const sessionId = "11111111-1111-4111-8111-111111111111";
    const nextSessionId = "22222222-2222-4222-8222-222222222222";
    const commandId = "33333333-3333-4333-8333-333333333333";
    let waitCount = 0;
    const persistenceStarted = vi.fn();
    mockServerToolHandler.current = async (request, options) => {
      const { arguments: args, name } = request as {
        arguments?: { uploadId?: string };
        name: string;
      };
      if (name === "sequence.register_viewer_session") {
        return { structuredContent: { revision: 0, sessionId } };
      }
      if (name === "sequence.wait_for_viewer_command") {
        waitCount += 1;
        if (waitCount === 1) {
          return {
            structuredContent: {
              command: {
                action: "export_artifact",
                commandId,
                format: "fasta",
                name: "aborted-public-reference",
                revision: 1,
                scope: "all",
              },
            },
          };
        }
        return new Promise(() => undefined);
      }
      if (name === "sequence.persist_workbench_payload") {
        persistenceStarted();
        const signal = options?.signal;
        if (signal == null)
          throw new Error("Expected persistence cancellation.");
        return await new Promise((_, reject) => {
          if (signal.aborted) {
            reject(signal.reason);
            return;
          }
          signal.addEventListener("abort", () => reject(signal.reason), {
            once: true,
          });
        });
      }
      if (name === "sequence.abort_workbench_payload_upload") {
        return {
          structuredContent: { aborted: true, uploadId: args?.uploadId },
        };
      }
      return { structuredContent: { completed: true } };
    };

    try {
      const rootElement = document.createElement("div");
      document.body.append(rootElement);
      await startSequenceViewerApp(rootElement);
      const app = mockAppInstances.at(-1);
      if (app == null || app.ontoolinput == null || app.ontoolresult == null) {
        throw new Error("Expected sequence viewer app tool handlers.");
      }
      app.readServerResource.mockResolvedValue({
        contents: [{ text: ">demo\nACGT\n", uri: "codex-resource://sequence" }],
      });
      await app.ontoolinput({
        arguments: {
          file: {
            name: "demo.fasta",
            resourceUri: "codex-resource://sequence",
          },
        },
      });
      await waitFor(() => expect(persistenceStarted).toHaveBeenCalledOnce());
      await userEvent.click(
        within(rootElement).getByRole("button", { name: "Export" }),
      );
      expect(
        within(rootElement).queryByText("aborted-public-reference.fasta"),
      ).toBeNull();

      await app.ontoolresult({
        structuredContent: {
          viewerCommandRevision: 0,
          viewerReady: true,
          viewerSessionId: nextSessionId,
        },
      });

      await waitFor(() => {
        expect(app.callServerTool).toHaveBeenCalledWith({
          arguments: {
            applied: false,
            commandId,
            message: "The viewer session changed before persistence completed.",
            sessionId,
            state: {},
          },
          name: "sequence.complete_viewer_command",
        });
      });
      expect(
        within(rootElement).queryByText("aborted-public-reference.fasta"),
      ).toBeNull();
    } finally {
      mockServerToolHandler.current = null;
    }
  });

  it("acknowledges state-less viewer commands with a concrete state object", async () => {
    const sessionId = "11111111-1111-4111-8111-111111111111";
    const commandId = "22222222-2222-4222-8222-222222222222";
    let waitCount = 0;
    mockServerToolHandler.current = async (request) => {
      const { name } = request as { name: string };
      if (name === "sequence.register_viewer_session") {
        return { structuredContent: { revision: 0, sessionId } };
      }
      if (name === "sequence.wait_for_viewer_command") {
        waitCount += 1;
        if (waitCount === 1) {
          return {
            structuredContent: {
              command: {
                action: "clear_sequence_selection",
                commandId,
                revision: 1,
              },
            },
          };
        }
        return new Promise(() => undefined);
      }
      return { structuredContent: { completed: true } };
    };

    try {
      await startSequenceViewerApp(document.createElement("div"));
      const app = mockAppInstances.at(-1);
      if (app == null || app.ontoolinput == null) {
        throw new Error("Expected sequence viewer app input handler.");
      }
      app.readServerResource.mockResolvedValue({
        contents: [{ text: ">demo\nACGT\n", uri: "codex-resource://sequence" }],
      });
      await app.ontoolinput({
        arguments: {
          file: {
            name: "demo.fasta",
            resourceUri: "codex-resource://sequence",
          },
        },
      });

      await waitFor(() => {
        expect(app.callServerTool).toHaveBeenCalledWith({
          arguments: {
            applied: true,
            commandId,
            message: "Cleared the sequence selection.",
            sessionId,
            state: {},
          },
          name: "sequence.complete_viewer_command",
        });
        expect(app.callServerTool).toHaveBeenCalledWith({
          arguments: {
            afterRevision: 1,
            sessionId,
            timeoutMs: 25_000,
          },
          name: "sequence.wait_for_viewer_command",
        });
      });
    } finally {
      mockServerToolHandler.current = null;
    }
  });

  it("preserves a chat-provisioned session delivered during app connection", async () => {
    const chatSessionId = "22222222-2222-4222-8222-222222222222";
    const commandId = "33333333-3333-4333-8333-333333333333";
    let chatWaitCount = 0;
    mockConnectSuppressToolResult.current = true;
    mockConnectToolResult.current = {
      _meta: {
        "openai/viewerFile": {
          primaryFile: {
            name: "demo.fasta",
            uri: "viewer-file://sequence-viewer/opened/token",
          },
        },
      },
      structuredContent: {
        viewerCommandRevision: 0,
        viewerReady: true,
        viewerSessionId: chatSessionId,
      },
    };
    mockServerToolHandler.current = async (request) => {
      const { arguments: args, name } = request as {
        arguments?: { sessionId?: string };
        name: string;
      };
      if (name === "sequence.register_viewer_session") {
        throw new Error("The chat-provisioned session must be reused.");
      }
      if (name === "sequence.wait_for_viewer_command") {
        expect(args?.sessionId).toBe(chatSessionId);
        chatWaitCount += 1;
        if (chatWaitCount === 1) {
          return {
            structuredContent: {
              command: {
                action: "set_display_mode",
                commandId,
                displayMode: "fullscreen",
                revision: 1,
              },
            },
          };
        }
        return new Promise(() => undefined);
      }
      return { structuredContent: { completed: true } };
    };

    try {
      const starting = startSequenceViewerApp(document.createElement("div"));
      const app = mockAppInstances.at(-1);
      if (app?.ontoolresult == null) {
        throw new Error("Expected Sequence viewer app result handler.");
      }
      app.readServerResource.mockResolvedValue({
        contents: [
          {
            text: ">demo\nACGT\n",
            uri: "viewer-file://sequence-viewer/opened/token",
          },
        ],
      });
      await app.ontoolresult(mockConnectToolResult.current);
      await starting;
      await waitFor(() => {
        expect(app?.requestDisplayMode).toHaveBeenCalledWith({
          mode: "fullscreen",
        });
        expect(app?.callServerTool).not.toHaveBeenCalledWith({
          arguments: {},
          name: "sequence.register_viewer_session",
        });
      });
    } finally {
      mockConnectSuppressToolResult.current = false;
      mockConnectToolResult.current = null;
      mockServerToolHandler.current = null;
    }
  });

  it("waits for a queued chat-provisioned session before registering a fallback", async () => {
    const chatSessionId = "22222222-2222-4222-8222-222222222222";
    mockConnectToolResult.current = {
      _meta: {
        "openai/viewerFile": {
          primaryFile: {
            name: "demo.fasta",
            uri: "viewer-file://sequence-viewer/opened/token",
          },
        },
      },
      structuredContent: {
        viewerCommandRevision: 0,
        viewerReady: true,
        viewerSessionId: chatSessionId,
      },
    };
    mockConnectToolResultAfterConnect.current = true;
    mockServerToolHandler.current = async (request) => {
      const { arguments: args, name } = request as {
        arguments?: { sessionId?: string };
        name: string;
      };
      if (name === "sequence.register_viewer_session") {
        throw new Error("The queued chat-provisioned session must be reused.");
      }
      if (name === "sequence.wait_for_viewer_command") {
        expect(args?.sessionId).toBe(chatSessionId);
        return new Promise(() => undefined);
      }
      return { structuredContent: { completed: true } };
    };

    try {
      const starting = startSequenceViewerApp(document.createElement("div"));
      const app = mockAppInstances.at(-1);
      app?.readServerResource.mockResolvedValue({
        contents: [
          {
            text: ">demo\nACGT\n",
            uri: "viewer-file://sequence-viewer/opened/token",
          },
        ],
      });
      await starting;
      await waitFor(() => {
        expect(app?.callServerTool).toHaveBeenCalledWith({
          arguments: {
            afterRevision: 0,
            sessionId: chatSessionId,
            timeoutMs: 25_000,
          },
          name: "sequence.wait_for_viewer_command",
        });
        expect(app?.callServerTool).not.toHaveBeenCalledWith({
          arguments: {},
          name: "sequence.register_viewer_session",
        });
      });
    } finally {
      mockConnectToolResult.current = null;
      mockConnectToolResultAfterConnect.current = false;
      mockServerToolHandler.current = null;
    }
  });

  it("lets ready context deliver the opening session before fallback registration", async () => {
    const chatSessionId = "22222222-2222-4222-8222-222222222222";
    const file = {
      name: "demo.fasta",
      resourceUri: "viewer-file://sequence-viewer/opened/token",
    };
    mockConnectSuppressToolResult.current = true;
    mockServerToolHandler.current = async (request) => {
      const { arguments: args, name } = request as {
        arguments?: { sessionId?: string };
        name: string;
      };
      if (name === "sequence.register_viewer_session") {
        throw new Error(
          "A pending opening result must win over fallback registration.",
        );
      }
      if (name === "sequence.wait_for_viewer_command") {
        expect(args?.sessionId).toBe(chatSessionId);
        return new Promise(() => undefined);
      }
      return { structuredContent: { completed: true } };
    };

    try {
      await startSequenceViewerApp(document.createElement("div"));
      const app = mockAppInstances.at(-1);
      if (app == null || app.ontoolinput == null || app.ontoolresult == null) {
        throw new Error("Expected sequence viewer app tool handlers.");
      }
      app.getHostCapabilities.mockReturnValue({
        updateModelContext: { text: {} },
      });
      app.readServerResource.mockResolvedValue({
        contents: [{ text: ">demo\nACGT\n", uri: file.resourceUri }],
      });
      let resultSent = false;
      app.updateModelContext.mockImplementation(
        async ({ structuredContent }: { structuredContent?: unknown }) => {
          const context = structuredContent as { viewer?: unknown } | undefined;
          if (context?.viewer == null || resultSent) return;
          resultSent = true;
          await app.ontoolresult?.({
            structuredContent: {
              file,
              viewerCommandRevision: 0,
              viewerReady: true,
              viewerSessionId: chatSessionId,
            },
          });
        },
      );

      await app.ontoolinput({ arguments: { file } });
      await waitFor(() => {
        expect(app.callServerTool).toHaveBeenCalledWith({
          arguments: {
            afterRevision: 0,
            sessionId: chatSessionId,
            timeoutMs: 25_000,
          },
          name: "sequence.wait_for_viewer_command",
        });
        expect(app.callServerTool).not.toHaveBeenCalledWith({
          arguments: {},
          name: "sequence.register_viewer_session",
        });
      });
    } finally {
      mockConnectSuppressToolResult.current = false;
      mockServerToolHandler.current = null;
    }
  });

  it("waits for ready-context acknowledgement before native fallback registration", async () => {
    const fallbackSessionId = "11111111-1111-4111-8111-111111111111";
    const file = {
      name: "demo.fasta",
      resourceUri: "codex-resource://native-input-only",
    };
    let acknowledgeContext: (() => void) | undefined;
    const contextAcknowledged = new Promise<void>((resolve) => {
      acknowledgeContext = resolve;
    });
    mockConnectSuppressToolResult.current = true;
    mockServerToolHandler.current = async (request) => {
      const { name } = request as { name: string };
      if (name === "sequence.register_viewer_session") {
        return {
          structuredContent: { revision: 0, sessionId: fallbackSessionId },
        };
      }
      if (name === "sequence.wait_for_viewer_command") {
        return new Promise(() => undefined);
      }
      return { structuredContent: { completed: true } };
    };

    try {
      await startSequenceViewerApp(document.createElement("div"));
      const app = mockAppInstances.at(-1);
      if (app == null || app.ontoolinput == null) {
        throw new Error("Expected sequence viewer app tool input handler.");
      }
      app.getHostCapabilities.mockReturnValue({
        updateModelContext: { text: {} },
      });
      app.readServerResource.mockResolvedValue({
        contents: [{ text: ">demo\nACGT\n", uri: file.resourceUri }],
      });
      app.updateModelContext.mockImplementation(
        async ({ structuredContent }: { structuredContent?: unknown }) => {
          const context = structuredContent as { viewer?: unknown } | undefined;
          if (context?.viewer != null) await contextAcknowledged;
        },
      );

      await app.ontoolinput({ arguments: { file } });
      await waitFor(() => {
        expect(
          app.updateModelContext.mock.calls.some(
            ([value]) =>
              (value as { structuredContent?: { viewer?: unknown } })
                .structuredContent?.viewer != null,
          ),
        ).toBe(true);
      });
      expect(app.callServerTool).not.toHaveBeenCalledWith({
        arguments: {},
        name: "sequence.register_viewer_session",
      });

      acknowledgeContext?.();
      await waitFor(() => {
        expect(app.callServerTool).toHaveBeenCalledWith({
          arguments: {},
          name: "sequence.register_viewer_session",
        });
        expect(app.callServerTool).toHaveBeenCalledWith({
          arguments: {
            afterRevision: 0,
            sessionId: fallbackSessionId,
            timeoutMs: 25_000,
          },
          name: "sequence.wait_for_viewer_command",
        });
      });
    } finally {
      acknowledgeContext?.();
      mockConnectSuppressToolResult.current = false;
      mockServerToolHandler.current = null;
    }
  });

  it.each([false, true])(
    "attaches a native-preview source only when it still matches its live viewer (changed: %s)",
    async (changed) => {
      const rootElement = document.createElement("div");
      document.body.append(rootElement);
      const sessionId = "11111111-1111-4111-8111-111111111111";
      const sourceId = "22222222-2222-4222-8222-222222222222";
      const sourceRevision = `sha256:${"a".repeat(64)}`;
      const file = {
        name: "preview.fasta",
        resourceUri: "codex-resource://trusted-preview",
      };
      let releaseRegistration:
        | ((result: {
            _meta: Record<string, unknown>;
            structuredContent: { revision: number; sessionId: string };
          }) => void)
        | undefined;
      const registration = new Promise<{
        _meta: Record<string, unknown>;
        structuredContent: { revision: number; sessionId: string };
      }>((resolve) => {
        releaseRegistration = resolve;
      });
      mockConnectSuppressToolResult.current = true;
      mockServerToolHandler.current = async (request) => {
        const { name } = request as { name: string };
        if (name === "sequence.register_viewer_session")
          return await registration;
        if (name === "sequence.wait_for_viewer_command") {
          return new Promise(() => undefined);
        }
        if (name === "sequence.restore_scientific_checkpoint") {
          return { structuredContent: { hasCheckpoint: false } };
        }
        if (name === "sequence.save_scientific_checkpoint") {
          return {
            structuredContent: {
              checkpointVersion: 1,
              lastAcknowledgedRevision: 1,
              logicalSessionId: sessionId,
              recoveryReference: sourceId,
            },
          };
        }
        if (
          name === "sequence.list_scientific_records" ||
          name === "sequence.read_scientific_window"
        ) {
          throw new Error(
            "An already-mounted native preview must not be reloaded.",
          );
        }
        throw new Error(`Unexpected native-preview tool: ${name}`);
      };

      try {
        await startSequenceViewerApp(rootElement);
        const app = mockAppInstances.at(-1);
        if (app?.ontoolinput == null || app.callServerTool == null) {
          throw new Error("Expected a stock-host Sequence preview.");
        }
        app.getHostCapabilities.mockReturnValue({
          updateModelContext: { text: {} },
        });
        app.readServerResource.mockResolvedValue({
          contents: [{ text: ">preview\nAACCGGTT\n", uri: file.resourceUri }],
        });
        await app.ontoolinput({ arguments: { file } });
        const search = await within(rootElement).findByRole("textbox", {
          name: "Search sequence",
        });
        await userEvent.type(search, "CCGG");
        const currentSearch = changed
          ? await (async () => {
              const nextFile = {
                name: file.name,
                resourceUri: "codex-resource://current-preview",
              };
              app.readServerResource.mockResolvedValue({
                contents: [
                  { text: ">current\nAACCGGTT\n", uri: nextFile.resourceUri },
                ],
              });
              await app.ontoolinput?.({ arguments: { file: nextFile } });
              await within(rootElement).findByText(nextFile.name);
              const nextSearch = await within(rootElement).findByRole(
                "textbox",
                {
                  name: "Search sequence",
                },
              );
              await userEvent.type(nextSearch, "TT");
              return nextSearch;
            })()
          : search;

        releaseRegistration?.({
          _meta: {
            "openai/scientific-viewer/plugin-source": {
              family: "sequence",
              fileName: file.name,
              format: "fasta",
              protocolVersion: 1,
              sessionId,
              sizeBytesDecimal: "16",
              sourceId,
              sourceRevision,
            },
          },
          structuredContent: { revision: 0, sessionId },
        });

        await waitFor(() => {
          expect(app.callServerTool).toHaveBeenCalledWith({
            arguments: {
              afterRevision: 0,
              sessionId,
              timeoutMs: 25_000,
            },
            name: "sequence.wait_for_viewer_command",
          });
        });
        if (changed) {
          expect(app.callServerTool).not.toHaveBeenCalledWith(
            expect.objectContaining({
              name: "sequence.restore_scientific_checkpoint",
            }),
            undefined,
          );
        } else {
          await waitFor(() => {
            expect(app.callServerTool).toHaveBeenCalledWith(
              {
                arguments: { sessionId, sourceId, sourceRevision },
                name: "sequence.restore_scientific_checkpoint",
              },
              undefined,
            );
          });
        }
        expect(
          within(rootElement).getByRole("textbox", { name: "Search sequence" }),
        ).toBe(currentSearch);
        expect(currentSearch).toHaveValue(changed ? "TT" : "CCGG");
        expect(app.readServerResource).toHaveBeenCalledTimes(changed ? 2 : 1);
        expect(
          within(rootElement).queryByText("Loading sequence…"),
        ).not.toBeInTheDocument();
      } finally {
        releaseRegistration?.({
          _meta: {},
          structuredContent: { revision: 0, sessionId },
        });
        mockConnectSuppressToolResult.current = false;
        mockServerToolHandler.current = null;
      }
    },
  );

  it("reports a native-preview checkpoint failure and retries before enabling commands", async () => {
    const rootElement = document.createElement("div");
    document.body.append(rootElement);
    const sessionId = "11111111-1111-4111-8111-111111111111";
    const sourceId = "22222222-2222-4222-8222-222222222222";
    const sourceRevision = `sha256:${"a".repeat(64)}`;
    const file = {
      name: "preview.fasta",
      resourceUri: "codex-resource://trusted-preview",
    };
    const message = "The saved Sequence checkpoint could not be restored.";
    let rejectCheckpoint: ((error: Error) => void) | undefined;
    const failedCheckpoint = new Promise<never>((_resolve, reject) => {
      rejectCheckpoint = reject;
    });
    let restorationAttempts = 0;
    mockConnectSuppressToolResult.current = true;
    mockServerToolHandler.current = async (request) => {
      const { name } = request as { name: string };
      if (name === "sequence.register_viewer_session") {
        return {
          _meta: {
            "openai/scientific-viewer/plugin-source": {
              family: "sequence",
              fileName: file.name,
              format: "fasta",
              protocolVersion: 1,
              sessionId,
              sizeBytesDecimal: "18",
              sourceId,
              sourceRevision,
            },
          },
          structuredContent: { revision: 0, sessionId },
        };
      }
      if (name === "sequence.restore_scientific_checkpoint") {
        restorationAttempts += 1;
        if (restorationAttempts === 1) return failedCheckpoint;
        return { structuredContent: { hasCheckpoint: false } };
      }
      if (name === "sequence.list_scientific_records") {
        return {
          structuredContent: {
            complete: true,
            cursor: "0",
            nextCursor: null,
            records: [{ description: "", id: "preview", sequenceLength: 8 }],
            sourceRevision,
          },
        };
      }
      if (name === "sequence.read_scientific_window") {
        return {
          structuredContent: {
            end1Decimal: "8",
            sequence: "AACCGGTT",
            sourceRevision,
            start1Decimal: "1",
          },
        };
      }
      if (name === "sequence.wait_for_viewer_command") {
        return new Promise(() => undefined);
      }
      throw new Error(`Unexpected native-preview recovery tool: ${name}`);
    };

    try {
      await startSequenceViewerApp(rootElement);
      const app = mockAppInstances.at(-1);
      if (app?.ontoolinput == null || app.callServerTool == null) {
        throw new Error("Expected Sequence viewer app input handler.");
      }
      app.getHostCapabilities.mockReturnValue({
        updateModelContext: { text: {} },
      });
      app.readServerResource.mockResolvedValue({
        contents: [{ text: ">preview\nAACCGGTT\n", uri: file.resourceUri }],
      });
      await app.ontoolinput({ arguments: { file } });
      await waitFor(() => expect(restorationAttempts).toBe(1));
      await act(async () => rejectCheckpoint?.(new Error(message)));

      expect(await within(rootElement).findByText(message)).toBeVisible();
      expect(app.callServerTool).not.toHaveBeenCalledWith(
        expect.objectContaining({ name: "sequence.wait_for_viewer_command" }),
      );
      await app.ontoolinput({ arguments: { file } });
      expect(await within(rootElement).findByText(file.name)).toBeVisible();
      expect(within(rootElement).queryByText(message)).not.toBeInTheDocument();
      expect(restorationAttempts).toBe(2);
      expect(app.callServerTool).toHaveBeenCalledWith({
        arguments: { afterRevision: 0, sessionId, timeoutMs: 25_000 },
        name: "sequence.wait_for_viewer_command",
      });
    } finally {
      mockConnectSuppressToolResult.current = false;
      mockServerToolHandler.current = null;
    }
  });

  it("registers a fallback session for native hosts that send only tool input", async () => {
    const fallbackSessionId = "11111111-1111-4111-8111-111111111111";
    mockConnectSuppressToolResult.current = true;
    mockServerToolHandler.current = async (request) => {
      const { name } = request as { name: string };
      if (name === "sequence.register_viewer_session") {
        return {
          structuredContent: {
            revision: 0,
            schemaVersion: 1,
            sessionId: fallbackSessionId,
          },
        };
      }
      if (name === "sequence.wait_for_viewer_command") {
        return new Promise(() => undefined);
      }
      return { structuredContent: { completed: true } };
    };

    try {
      await startSequenceViewerApp(document.createElement("div"));
      const app = mockAppInstances.at(-1);
      expect(app).toBeDefined();
      app?.readServerResource.mockResolvedValue({
        contents: [
          {
            text: ">demo\nACGT\n",
            uri: "viewer-file://sequence-viewer/opened/token",
          },
        ],
      });
      await app?.ontoolinput?.({
        arguments: {
          file: {
            name: "demo.fasta",
            resourceUri: "viewer-file://sequence-viewer/opened/token",
          },
        },
      });
      await waitFor(() => {
        expect(app?.callServerTool).toHaveBeenCalledWith({
          arguments: {},
          name: "sequence.register_viewer_session",
        });
        expect(app?.callServerTool).toHaveBeenCalledWith({
          arguments: {
            afterRevision: 0,
            sessionId: fallbackSessionId,
            timeoutMs: 25_000,
          },
          name: "sequence.wait_for_viewer_command",
        });
      });
    } finally {
      mockConnectSuppressToolResult.current = false;
      mockServerToolHandler.current = null;
    }
  });

  it("adopts the chat-provisioned session for same-turn viewer control", async () => {
    const fallbackSessionId = "11111111-1111-4111-8111-111111111111";
    const chatSessionId = "22222222-2222-4222-8222-222222222222";
    const commandId = "33333333-3333-4333-8333-333333333333";
    let chatWaitCount = 0;
    mockServerToolHandler.current = async (request) => {
      const { arguments: args, name } = request as {
        arguments?: { sessionId?: string };
        name: string;
      };
      if (name === "sequence.register_viewer_session") {
        return {
          structuredContent: { revision: 0, sessionId: fallbackSessionId },
        };
      }
      if (name === "sequence.wait_for_viewer_command") {
        if (args?.sessionId !== chatSessionId) {
          return new Promise(() => undefined);
        }
        chatWaitCount += 1;
        if (chatWaitCount === 1) {
          return {
            structuredContent: {
              command: {
                action: "set_display_mode",
                commandId,
                displayMode: "fullscreen",
                revision: 1,
              },
            },
          };
        }
        return new Promise(() => undefined);
      }
      return { structuredContent: { completed: true } };
    };

    try {
      const rootElement = document.createElement("div");
      await startSequenceViewerApp(rootElement);
      const app = mockAppInstances.at(-1);
      if (app == null || app.ontoolresult == null) {
        throw new Error("Expected sequence viewer app tool result handler.");
      }
      app.readServerResource.mockResolvedValue({
        contents: [
          {
            text: ">demo\nACGT\n",
            uri: "viewer-file://sequence-viewer/opened/token",
          },
        ],
      });
      await app.ontoolresult({
        _meta: {
          "openai/viewerFile": {
            primaryFile: {
              name: "demo.fasta",
              uri: "viewer-file://sequence-viewer/opened/token",
            },
          },
        },
        structuredContent: {
          viewerCommandRevision: 0,
          viewerReady: true,
          viewerSessionId: chatSessionId,
        },
      });

      await waitFor(() => {
        expect(app.requestDisplayMode).toHaveBeenCalledWith({
          mode: "fullscreen",
        });
        expect(app.callServerTool).toHaveBeenCalledWith({
          arguments: expect.objectContaining({
            commandId,
            sessionId: chatSessionId,
          }),
          name: "sequence.complete_viewer_command",
        });
      });
    } finally {
      mockServerToolHandler.current = null;
    }
  });
});
