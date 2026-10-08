import {
  App,
  applyDocumentTheme,
  applyHostFonts,
  applyHostStyleVariables,
} from "@modelcontextprotocol/ext-apps/app-with-deps";
import { AppLogger } from "@oai/first-party-plugin-bridge/logging";

export type ToolArguments = Record<string, unknown>;
export type ToolPayload = Record<string, unknown>;

export interface InlineSnapshot {
  input?: ToolArguments;
  payload?: ToolPayload;
  error?: string;
  cancelled?: string;
}

type SnapshotListener = (snapshot: InlineSnapshot) => void;

export class InlineMcpClient {
  private readonly app: App;
  readonly logger: Pick<AppLogger, "error" | "warn">;

  private connectPromise?: Promise<void>;
  private snapshot: InlineSnapshot = {};
  private readonly listeners = new Set<SnapshotListener>();

  constructor(
    app = new App(
      { name: "NGS Run Review", version: "0.1.0" },
      {},
      { autoResize: true },
    ),
    logger: Pick<AppLogger, "error" | "warn"> = new AppLogger(app, "run-review"),
  ) {
    this.app = app;
    this.logger = logger;
    this.app.ontoolinput = ({ arguments: input }) => {
      this.update({ input: input ?? {} });
    };
    this.app.ontoolresult = (result) => {
      if (result.isError) {
        const error = new Error(toolErrorMessage(result));
        this.logger.warn("NGS run review tool returned an error");
        this.update({ error: error.message, payload: undefined });
        return;
      }
      if (!isRecord(result.structuredContent)) {
        this.logger.error("NGS run review tool returned invalid structured content");
        this.update({ error: "The tool did not return structured content.", payload: undefined });
        return;
      }
      this.update({ payload: result.structuredContent, error: undefined });
    };
    this.app.ontoolcancelled = ({ reason }) => {
      this.update({ cancelled: reason ?? "The tool call was cancelled." });
    };
    this.app.onhostcontextchanged = (context) => applyHostContext(context);
  }

  connect() {
    if (!this.connectPromise) {
      this.connectPromise = this.app.connect()
        .then(() => {
          applyHostContext(this.app.getHostContext());
        })
        .catch((error: unknown) => {
          this.logger.error("Failed to connect NGS run review app", {
            errorName: error instanceof Error ? error.name : typeof error,
          });
          this.connectPromise = undefined;
          throw error;
        });
    }
    return this.connectPromise;
  }

  subscribe(listener: SnapshotListener) {
    this.listeners.add(listener);
    listener(this.snapshot);
    return () => {
      this.listeners.delete(listener);
    };
  }

  async call(name: string, arguments_: ToolArguments): Promise<ToolPayload> {
    await this.connect();
    let result: Awaited<ReturnType<App["callServerTool"]>>;
    try {
      result = await this.app.callServerTool({ name, arguments: arguments_ });
    } catch (error) {
      this.logger.error("MCP tool request failed", {
        errorName: error instanceof Error ? error.name : typeof error,
        tool: name,
      });
      throw error;
    }
    if (result.isError) {
      const error = new Error(toolErrorMessage(result));
      this.logger.warn("MCP tool request failed", { tool: name });
      throw error;
    }
    if (!isRecord(result.structuredContent)) {
      const error = new Error(`${name} did not return structured content.`);
      this.logger.error("MCP tool returned invalid structured content", {
        tool: name,
      });
      throw error;
    }
    return result.structuredContent;
  }

  private update(update: Partial<InlineSnapshot>) {
    this.snapshot = { ...this.snapshot, ...update };
    for (const listener of this.listeners) listener(this.snapshot);
  }
}

function applyHostContext(context: ReturnType<App["getHostContext"]>) {
  if (!context) return;
  if (context.theme) applyDocumentTheme(context.theme);
  if (context.styles?.variables) applyHostStyleVariables(context.styles.variables);
  if (context.styles?.css?.fonts) applyHostFonts(context.styles.css.fonts);
}

function toolErrorMessage(result: { content?: unknown }) {
  if (!Array.isArray(result.content)) return "MCP tool call failed.";
  const text = result.content.find(
    (item) => isRecord(item) && item.type === "text" && typeof item.text === "string",
  );
  return isRecord(text) && typeof text.text === "string" ? text.text : "MCP tool call failed.";
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}
