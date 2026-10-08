import type {
  McpUiStyles,
  McpUiTheme,
  McpUiToolResultNotification,
} from "@modelcontextprotocol/ext-apps";
import { act } from "@testing-library/react";
import type { Root } from "react-dom/client";
import { afterEach, beforeEach, vi } from "vitest";

export type MockHostContext = {
  availableDisplayModes?: Array<"inline" | "fullscreen">;
  displayMode?: "inline" | "fullscreen";
  scientificViewers?: Record<string, unknown>;
  styles?: { variables?: Partial<McpUiStyles> };
  theme?: McpUiTheme;
};

type MockToolResult = Partial<
  Pick<McpUiToolResultNotification["params"], "content" | "isError">
> & {
  _meta?: unknown;
  structuredContent?: unknown;
};

const {
  mockAppInstances,
  mockConnectToolResult,
  mockConnectToolResultAfterConnect,
  mockConnectSuppressToolResult,
  mockConnectToolResultTimers,
  mockInitialHostContext,
  mockNativeHostCapabilities,
  mockReactRoots,
  mockServerToolHandler,
} = vi.hoisted(() => ({
  mockAppInstances: [] as Array<{
    addEventListener: ReturnType<typeof vi.fn>;
    connect: ReturnType<typeof vi.fn>;
    getHostCapabilities: ReturnType<typeof vi.fn>;
    getHostContext: ReturnType<typeof vi.fn>;
    hostContextChanged?: (context: MockHostContext) => void;
    info: { name: string; version: string };
    ontoolinput?: (input: { arguments?: unknown }) => Promise<void>;
    ontoolresult?: (result: MockToolResult) => Promise<void>;
    readServerResource: ReturnType<typeof vi.fn>;
    requestDisplayMode: ReturnType<typeof vi.fn>;
    sendMessage: ReturnType<typeof vi.fn>;
    callServerTool?: ReturnType<typeof vi.fn>;
    updateModelContext: ReturnType<typeof vi.fn>;
  }>,
  mockConnectToolResult: {
    current: null as null | MockToolResult,
  },
  mockConnectToolResultAfterConnect: { current: false },
  mockConnectSuppressToolResult: { current: false },
  mockConnectToolResultTimers: new Set<ReturnType<typeof setTimeout>>(),
  mockInitialHostContext: {
    current: {
      availableDisplayModes: ["inline", "fullscreen"],
      displayMode: "inline",
    } as MockHostContext | undefined,
  },
  mockNativeHostCapabilities: {
    current: null as Record<string, unknown> | null,
  },
  mockReactRoots: [] as Array<Root>,
  mockServerToolHandler: {
    current: null as
      | null
      | ((
          request: unknown,
          options?: { signal?: AbortSignal },
        ) => Promise<unknown>),
  },
}));

export {
  mockAppInstances,
  mockConnectToolResult,
  mockConnectToolResultAfterConnect,
  mockConnectSuppressToolResult,
  mockInitialHostContext,
  mockNativeHostCapabilities,
  mockServerToolHandler,
};

vi.mock("react-dom/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-dom/client")>();
  return {
    ...actual,
    createRoot: (...args: Parameters<typeof actual.createRoot>) => {
      const root = actual.createRoot(...args);
      mockReactRoots.push(root);
      return root;
    },
  };
});

vi.mock("@modelcontextprotocol/ext-apps", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@modelcontextprotocol/ext-apps")>()),
  App: class MockApp {
    addEventListener = vi.fn(
      (event: string, handler: (context: MockHostContext) => void) => {
        if (event === "hostcontextchanged") {
          this.hostContextChanged = handler;
        }
      },
    );
    connect = vi.fn(async () => {
      if (mockConnectSuppressToolResult.current) return;
      if (mockConnectToolResult.current != null) {
        if (mockConnectToolResultAfterConnect.current) {
          const result = mockConnectToolResult.current;
          const timer = setTimeout(() => {
            mockConnectToolResultTimers.delete(timer);
            void this.ontoolresult?.(result);
          }, 0);
          mockConnectToolResultTimers.add(timer);
          return;
        }
        await this.ontoolresult?.(mockConnectToolResult.current);
      } else {
        await this.ontoolresult?.({ structuredContent: {} });
      }
    });
    getHostCapabilities = vi.fn(() => mockNativeHostCapabilities.current);
    getHostContext = vi.fn(() => mockInitialHostContext.current);
    hostContextChanged?: (context: MockHostContext) => void;
    info: { name: string; version: string };
    ontoolinput?: (input: { arguments?: unknown }) => Promise<void>;
    ontoolresult?: (result: MockToolResult) => Promise<void>;
    readServerResource = vi.fn();
    requestDisplayMode = vi.fn(
      async ({ mode }: { mode: "inline" | "fullscreen" }) => ({ mode }),
    );
    sendMessage = vi.fn().mockResolvedValue({});
    callServerTool =
      mockServerToolHandler.current == null
        ? undefined
        : vi.fn((request: unknown, options?: { signal?: AbortSignal }) =>
            mockServerToolHandler.current?.(request, options),
          );
    updateModelContext = vi.fn();

    constructor(info: { name: string; version: string }) {
      this.info = info;
      mockAppInstances.push(this);
    }
  },
}));

let originalDocumentTheme: string | null;
let originalDocumentStyle: string | null;

beforeEach(() => {
  originalDocumentTheme = document.documentElement.getAttribute("data-theme");
  originalDocumentStyle = document.documentElement.getAttribute("style");
});

afterEach(async () => {
  for (const timer of mockConnectToolResultTimers) {
    clearTimeout(timer);
  }
  mockConnectToolResultTimers.clear();
  await act(async () => {
    for (const root of mockReactRoots.splice(0).reverse()) {
      root.unmount();
    }
  });
  mockInitialHostContext.current = {
    availableDisplayModes: ["inline", "fullscreen"],
    displayMode: "inline",
  };
  if (originalDocumentTheme == null) {
    document.documentElement.removeAttribute("data-theme");
  } else {
    document.documentElement.setAttribute("data-theme", originalDocumentTheme);
  }
  if (originalDocumentStyle == null) {
    document.documentElement.removeAttribute("style");
  } else {
    document.documentElement.setAttribute("style", originalDocumentStyle);
  }
});
