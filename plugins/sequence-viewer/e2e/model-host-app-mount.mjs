import { createHash } from "node:crypto";
import { createServer } from "node:http";
import { lstat, readFile, realpath, stat } from "node:fs/promises";
import path from "node:path";

const APP_HTML_MAX_BYTES = 16 * 1_024 * 1_024;
const BRIDGE_REQUEST_MAX_BYTES = 280 * 1_024;
const MOUNT_TIMEOUT_MS = 30_000;

export async function createSequenceViewerAppMounter({
  client,
  runtimeRoot,
  screenshotPath,
}) {
  const validatedScreenshotPath =
    screenshotPath == null
      ? undefined
      : await validateScreenshotPath(screenshotPath, runtimeRoot);
  let activeMount;
  let activeMountPromise;
  let closing;

  return {
    async captureEvidence() {
      const mount =
        activeMount ?? (await activeMountPromise?.catch(() => undefined));
      await mount?.captureEvidence();
    },
    async close() {
      closing ??= (async () => {
        const mount =
          activeMount ?? (await activeMountPromise?.catch(() => undefined));
        await mount?.close();
      })();
      await closing;
    },
    async mountOpeningResult(request, result) {
      const opening = openingResult(request, result);
      if (opening == null) return;
      activeMountPromise ??= launchAppMount({
        client,
        opening,
        screenshotPath: validatedScreenshotPath,
      });
      activeMount = await activeMountPromise;
      if (activeMount.sessionId !== opening.sessionId) {
        throw new Error(
          "The qualification proxy permits exactly one mounted viewer session.",
        );
      }
      await activeMount.ready;
    },
    readEvidence() {
      return activeMount?.evidence;
    },
  };
}

export function openingResult(request, result) {
  const sessionId = result?.structuredContent?.viewerSessionId;
  const templateUri =
    result?._meta?.["openai/outputTemplate"] ??
    result?._meta?.ui?.resourceUri ??
    result?._meta?.["ui/resourceUri"];
  const primaryFile = result?._meta?.["openai/viewerFile"]?.primaryFile;
  if (
    result?.isError === true ||
    typeof sessionId !== "string" ||
    typeof templateUri !== "string" ||
    typeof primaryFile?.name !== "string" ||
    typeof primaryFile?.uri !== "string"
  ) {
    return undefined;
  }
  return {
    // Mount the exact opaque file capability returned by the bundled server.
    // The model's acquisition arguments do not contain a viewer file and must
    // never be reinterpreted as one by the qualification host.
    input: {
      file: {
        name: primaryFile.name,
        resourceUri: primaryFile.uri,
      },
    },
    result,
    sessionId,
    templateUri,
  };
}

async function launchAppMount({ client, opening, screenshotPath }) {
  const resource = await client.readResource({ uri: opening.templateUri });
  const appHtml = resource.contents
    .flatMap((content) => ("text" in content ? [content.text] : []))
    .join("\n");
  const appHtmlBytes = Buffer.byteLength(appHtml);
  if (appHtmlBytes === 0 || appHtmlBytes > APP_HTML_MAX_BYTES) {
    throw new Error(
      "The bundled MCP App HTML is empty or exceeds its mount budget.",
    );
  }

  const { chromium } = await import("@playwright/test");
  const browser = await chromium.launch({
    args: [
      "--disable-background-networking",
      "--disable-gpu",
      "--disable-gpu-compositing",
      "--disable-accelerated-video-decode",
      "--disable-accelerated-video-encode",
    ],
    headless: true,
    timeout: MOUNT_TIMEOUT_MS,
  });
  const context = await browser.newContext({
    serviceWorkers: "block",
    viewport: { height: 1_000, width: 1_440 },
  });
  const page = await context.newPage();
  page.setDefaultTimeout(MOUNT_TIMEOUT_MS);
  page.setDefaultNavigationTimeout(MOUNT_TIMEOUT_MS);
  const readyContext = deferred();
  const commandLoop = deferred();
  const evidence = {
    appResourceByteLength: appHtmlBytes,
    appResourceUri: opening.templateUri,
    capturedAt: null,
    captureCount: 0,
    fallbackRegistrationCount: 0,
    mountedAt: new Date().toISOString(),
    screenshotPath: null,
    screenshotSha256: null,
    viewerSessionId: opening.sessionId,
  };

  await page.exposeFunction("__sequenceViewerBridge", async (request) => {
    assertBridgeRequest(request);
    if (request.method === "resources/read") {
      return await client.readResource(request.params);
    }
    if (request.params.name === "sequence.wait_for_viewer_command") {
      commandLoop.resolve();
    }
    if (request.params.name === "sequence.register_viewer_session") {
      evidence.fallbackRegistrationCount += 1;
    }
    return await client.callTool(request.params, undefined, {
      timeout: 120_000,
    });
  });
  await page.exposeFunction("__sequenceViewerModelContext", async (params) => {
    if (params?.structuredContent?.viewerSessionId === opening.sessionId) {
      readyContext.resolve();
    }
  });
  page.on("console", (message) => {
    if (message.type() === "error") {
      process.stderr.write(`Mounted Sequence Viewer: ${message.text()}\n`);
    }
  });
  page.on("pageerror", (error) => {
    process.stderr.write(`Mounted Sequence Viewer: ${error.message}\n`);
  });

  const hostServer = createServer((request, response) => {
    const pathname = new URL(request.url ?? "/", "http://127.0.0.1").pathname;
    if (request.method !== "GET" && request.method !== "HEAD") {
      send(response, 405, "text/plain", "Method not allowed.");
      return;
    }
    if (pathname === "/") {
      send(
        response,
        200,
        "text/html; charset=utf-8",
        APP_HOST_HTML,
        request.method === "HEAD",
        HOST_CONTENT_SECURITY_POLICY,
      );
      return;
    }
    if (pathname === "/app") {
      send(
        response,
        200,
        "text/html;profile=mcp-app",
        appHtml,
        request.method === "HEAD",
        APP_CONTENT_SECURITY_POLICY,
      );
      return;
    }
    send(response, 404, "text/plain", "Not found.");
  });
  await listenLoopback(hostServer);
  const address = hostServer.address();
  if (address == null || typeof address === "string") {
    throw new Error("Could not bind the qualification MCP App host.");
  }
  const origin = `http://127.0.0.1:${address.port}`;
  await context.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.origin === origin || ["blob:", "data:"].includes(url.protocol)) {
      await route.continue();
    } else {
      await route.abort("blockedbyclient");
    }
  });

  let closing;
  let captureChain = Promise.resolve();
  const captureEvidence = async () => {
    if (screenshotPath == null) return;
    captureChain = captureChain.then(async () => {
      await page.screenshot({ fullPage: true, path: screenshotPath });
      evidence.capturedAt = new Date().toISOString();
      evidence.captureCount += 1;
      evidence.screenshotPath = screenshotPath;
      evidence.screenshotSha256 = createHash("sha256")
        .update(await readFile(screenshotPath))
        .digest("hex");
    });
    await captureChain;
  };
  const close = async () => {
    closing ??= (async () => {
      await context.close().catch(() => undefined);
      await browser.close().catch(() => undefined);
      await closeServer(hostServer);
    })();
    await closing;
  };
  const ready = (async () => {
    try {
      await page.goto(origin, { waitUntil: "domcontentloaded" });
      await page.evaluate(
        ({ input, result }) => window.mountSequenceViewerApp({ input, result }),
        { input: opening.input, result: opening.result },
      );
      await Promise.all([
        withTimeout(
          readyContext.promise,
          MOUNT_TIMEOUT_MS,
          "The mounted Sequence Viewer did not publish live model context.",
        ),
        withTimeout(
          commandLoop.promise,
          MOUNT_TIMEOUT_MS,
          "The mounted Sequence Viewer did not start its command loop.",
        ),
      ]);
      if (evidence.fallbackRegistrationCount !== 0) {
        throw new Error(
          "The mounted Sequence Viewer registered a fallback before adopting its opening session.",
        );
      }
      await captureEvidence();
      process.stderr.write(
        `Sequence Viewer qualification app mounted for session ${opening.sessionId}` +
          (evidence.screenshotPath == null
            ? ".\n"
            : `; screenshot ${evidence.screenshotPath} SHA-256 ${evidence.screenshotSha256}.\n`),
      );
    } catch (error) {
      await close();
      throw error;
    }
  })();

  return {
    captureEvidence,
    close,
    evidence,
    ready,
    sessionId: opening.sessionId,
  };
}

async function validateScreenshotPath(screenshotPath, runtimeRoot) {
  if (
    !path.isAbsolute(screenshotPath) ||
    path.extname(screenshotPath) !== ".png"
  ) {
    throw new Error(
      "The qualification screenshot path must be an absolute .png path.",
    );
  }
  const parent = await realpath(path.dirname(screenshotPath));
  if (!(await stat(parent)).isDirectory()) {
    throw new Error("The qualification screenshot parent must be a directory.");
  }
  const canonicalPath = path.join(parent, path.basename(screenshotPath));
  if (containsPath(runtimeRoot, canonicalPath)) {
    throw new Error(
      "The qualification screenshot may not be written into the runtime bundle.",
    );
  }
  try {
    await lstat(canonicalPath);
    throw new Error(
      "The qualification screenshot path must not already exist.",
    );
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
  return canonicalPath;
}

function assertBridgeRequest(request) {
  const byteLength = Buffer.byteLength(JSON.stringify(request));
  if (byteLength > BRIDGE_REQUEST_MAX_BYTES) {
    throw new Error("The mounted MCP App request exceeds the host envelope.");
  }
  if (
    request == null ||
    typeof request !== "object" ||
    !["resources/read", "tools/call"].includes(request.method) ||
    request.params == null ||
    typeof request.params !== "object"
  ) {
    throw new Error("The mounted MCP App sent an unsupported host request.");
  }
  if (
    request.method === "tools/call" &&
    (typeof request.params.name !== "string" ||
      request.params.arguments == null ||
      typeof request.params.arguments !== "object")
  ) {
    throw new Error("The mounted MCP App sent an invalid tool request.");
  }
  if (
    request.method === "resources/read" &&
    typeof request.params.uri !== "string"
  ) {
    throw new Error("The mounted MCP App sent an invalid resource request.");
  }
}

function listenLoopback(server) {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", reject);
      resolve();
    });
  });
}

function closeServer(server) {
  return new Promise((resolve) => server.close(() => resolve()));
}

function send(
  response,
  status,
  contentType,
  body,
  headOnly = false,
  contentSecurityPolicy = "default-src 'none'",
) {
  response.writeHead(status, {
    "cache-control": "no-store",
    "content-length": String(Buffer.byteLength(body)),
    "content-security-policy": contentSecurityPolicy,
    "content-type": contentType,
    "x-content-type-options": "nosniff",
  });
  response.end(headOnly ? undefined : body);
}

function deferred() {
  let resolve;
  const promise = new Promise((nextResolve) => {
    resolve = nextResolve;
  });
  return { promise, resolve };
}

function withTimeout(promise, timeoutMs, message) {
  let timeout;
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      timeout = setTimeout(() => reject(new Error(message)), timeoutMs);
    }),
  ]).finally(() => clearTimeout(timeout));
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

const APP_HOST_HTML = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Sequence Viewer qualification host</title>
    <style>html,body,iframe{border:0;height:100%;margin:0;width:100%}body{min-height:100vh}</style>
  </head>
  <body>
    <iframe id="viewer" title="Mounted Biological Sequence Viewer"></iframe>
    <script>
      let opening;
      let openingResultSent = false;
      let openingToolInputSent = false;
      const viewer = document.getElementById("viewer");
      window.mountSequenceViewerApp = (nextOpening) => {
        if (opening != null) throw new Error("A Sequence Viewer is already mounted.");
        opening = nextOpening;
        viewer.src = "/app";
      };
      window.addEventListener("message", (event) => {
        if (event.source !== viewer.contentWindow) return;
        const message = event.data;
        if (message?.jsonrpc !== "2.0" || message.method == null) return;
        if (message.id == null && message.method === "ui/notifications/initialized") {
          if (!openingToolInputSent) {
            openingToolInputSent = true;
            viewer.contentWindow.postMessage({
              jsonrpc: "2.0",
              method: "ui/notifications/tool-input",
              params: { arguments: opening.input },
            }, "*");
          }
          return;
        }
        if (message.id != null) void respond(message);
      });
      async function respond(message) {
        try {
          let result = {};
          if (message.method === "ui/initialize") {
            result = {
              protocolVersion: message.params?.protocolVersion ?? "2026-01-26",
              hostCapabilities: {
                message: { text: {} },
                updateModelContext: { text: {} },
              },
              hostContext: {
                availableDisplayModes: ["inline", "fullscreen"],
                displayMode: "inline",
              },
              hostInfo: { name: "Sequence Viewer qualification host", version: "1" },
            };
          } else if (["resources/read", "tools/call"].includes(message.method)) {
            result = await window.__sequenceViewerBridge({
              method: message.method,
              params: message.params,
            });
          } else if (message.method === "ui/update-model-context") {
            await window.__sequenceViewerModelContext(message.params);
            // A large input can still be parsing when initialized fires. Do
            // not publish the opening tool result (and its session) until the
            // mounted viewer has produced artifact context from tool input.
            // This mirrors an installed host's ordered input/result delivery
            // and prevents the command loop from racing the initial load.
            if (
              !openingResultSent &&
              message.params?.structuredContent?.viewer != null
            ) {
              openingResultSent = true;
              viewer.contentWindow.postMessage({
                jsonrpc: "2.0",
                method: "ui/notifications/tool-result",
                params: opening.result,
              }, "*");
            }
          } else if (message.method === "ui/request-display-mode") {
            result = { mode: message.params?.mode ?? "inline" };
          } else if (message.method === "ui/message") {
            result = { isError: false };
          }
          viewer.contentWindow.postMessage({ id: message.id, jsonrpc: "2.0", result }, "*");
        } catch (error) {
          viewer.contentWindow.postMessage({
            error: { code: -32000, message: error?.message ?? "Host error" },
            id: message.id,
            jsonrpc: "2.0",
          }, "*");
        }
      }
    </script>
  </body>
</html>`;

const HOST_CONTENT_SECURITY_POLICY =
  "default-src 'none'; frame-src 'self'; script-src 'unsafe-inline'; " +
  "style-src 'unsafe-inline'";
const APP_CONTENT_SECURITY_POLICY =
  "default-src 'none'; img-src blob: data:; " +
  "script-src 'unsafe-inline' blob:; style-src 'unsafe-inline'; " +
  "worker-src blob:";
