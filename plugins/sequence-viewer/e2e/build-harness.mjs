import { readFile, realpath, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { resolveSequenceViewerRuntimeRoot } from "./plugin-runtime-root.mjs";

const sourceRoot = await realpath(
  path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."),
);
const { runtimeRoot } = await resolveSequenceViewerRuntimeRoot(sourceRoot);
const { createSequenceViewerHtml } = await import(
  pathToFileURL(path.join(runtimeRoot, "dist/server.mjs")).href
);

const [appJavaScriptGzip, styles] = await Promise.all([
  readFile(path.join(runtimeRoot, "dist/views/app.js.gz")),
  readFile(path.join(runtimeRoot, "dist/views/styles.css"), "utf8"),
]);
await writeFile(
  path.join(sourceRoot, "e2e/generated-viewer.html"),
  createSequenceViewerHtml({
    appJavaScriptGzipBase64: appJavaScriptGzip.toString("base64"),
    styles,
  }),
);
