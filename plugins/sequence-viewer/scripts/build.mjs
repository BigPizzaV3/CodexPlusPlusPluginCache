import { readFile, readdir, rm, writeFile } from "node:fs/promises";
import { gunzipSync, gzipSync } from "node:zlib";

import { build } from "esbuild";
import { build as buildVite } from "vite";

await rm("dist", { force: true, recursive: true });
await Promise.all([
  buildView("styles", "src/views/styles.css"),
  buildView("app", "src/views/app.tsx"),
  build({
    bundle: true,
    entryPoints: ["src/server.ts"],
    format: "esm",
    outfile: "dist/server.mjs",
    platform: "node",
  }),
]);
await compressViewJavaScript();
await validateSingleAssetViewBuild();

function buildView(name, input) {
  return buildVite({
    build: {
      emptyOutDir: false,
      rolldownOptions: {
        input: { [name]: input },
        output: {
          codeSplitting: false,
        },
      },
    },
    configFile: "./vite.config.ts",
  });
}

async function compressViewJavaScript() {
  const appJavaScriptPath = "dist/views/app.js";
  const appJavaScript = await readFile(appJavaScriptPath);
  await writeFile(
    `${appJavaScriptPath}.gz`,
    gzipSync(appJavaScript, { level: 9 }),
  );
  await rm(appJavaScriptPath);
}

async function validateSingleAssetViewBuild() {
  const viewFiles = (await readdir("dist/views")).sort();
  const expectedViewFiles = ["app.js.gz", "styles.css"];
  if (JSON.stringify(viewFiles) !== JSON.stringify(expectedViewFiles)) {
    throw new Error(
      `Sequence MCP App view must remain a single JavaScript asset plus styles; expected ${expectedViewFiles.join(", ")}, got ${viewFiles.join(", ")}.`,
    );
  }

  const [appJavaScript, styles] = await Promise.all([
    readFile("dist/views/app.js.gz").then((contents) =>
      gunzipSync(contents).toString("utf8"),
    ),
    readFile("dist/views/styles.css", "utf8"),
  ]);
  if (appJavaScript.length === 0) {
    throw new Error("Sequence MCP App JavaScript is empty.");
  }
  assertNoRelativeViewAssetReferences(appJavaScript, "app.js");
  assertNoRelativeViewAssetReferences(styles, "styles.css");
}

function assertNoRelativeViewAssetReferences(contents, fileName) {
  const relativeAssetPatterns = [
    /\b(?:from|import)\s*(?:\(\s*)?["']\.\//,
    /new URL\(\s*["']\.\//,
    /url\(\s*["']?\.\//,
  ];
  if (relativeAssetPatterns.some((pattern) => pattern.test(contents))) {
    throw new Error(
      `Sequence MCP App ${fileName} references a relative asset, but the compressed application bundle must remain self-contained.`,
    );
  }
}
