import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { build } from "esbuild";

const pluginDirectory = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const rawInputs = process.argv.slice(2);
const inputs = rawInputs[0] === "--" ? rawInputs.slice(1) : rawInputs;
if (inputs.length === 0) {
  process.stderr.write(
    "Usage: pnpm smoke:formats <local-path-or-https-url> [...]\n",
  );
  process.exitCode = 2;
} else {
  const parser = await loadParser();
  let failed = false;
  for (const input of inputs) {
    try {
      const contents = await readInput(input);
      const fileName = getFileName(input);
      const result = parser.smokeParse(contents, fileName);
      process.stdout.write(`${JSON.stringify({ input, ...result })}\n`);
      if (result.status !== "success") failed = true;
    } catch (error) {
      failed = true;
      process.stdout.write(
        `${JSON.stringify({
          input,
          message: error instanceof Error ? error.message : String(error),
          status: "error",
        })}\n`,
      );
    }
  }
  if (failed) process.exitCode = 1;
}

async function loadParser() {
  const result = await build({
    bundle: true,
    format: "esm",
    platform: "node",
    stdin: {
      contents: `
        import { classifySequenceArtifact } from "./src/biological-sequence-artifact-classifier.ts";
        import { isExplicitMsaFile } from "./src/msa/file-kind.ts";
        import { looksLikePir } from "./src/msa/formats/pir.ts";
        import { parseMsa } from "./src/msa/parser.ts";
        import { parseSequenceDocumentResult } from "./src/sequence/parser.ts";

        export function smokeParse(contents, fileName) {
          const classification = classifySequenceArtifact({ contents, fileName });
          const alignment = parseMsa(contents, fileName);
          const sequence = parseSequenceDocumentResult({ contents, fileName });
          const alignmentRequired =
            classification.suggestedViewer === "msa" ||
            (isExplicitMsaFile(fileName) &&
              !(looksLikePir(contents) && classification.alignment?.disposition === "not-alignment"));
          if (alignmentRequired) {
            return alignment.status === "success"
              ? {
                  columns: alignment.document.alignedLength,
                  format: alignment.document.format,
                  rows: alignment.document.rows.length,
                  status: "success",
                  viewer: "alignment",
                  warningCodes: [...new Set(alignment.document.warnings.map(({ code }) => code))],
                  warnings: alignment.document.warnings.length,
                }
              : { message: alignment.message, status: "error", viewer: "alignment" };
          }
          if (sequence.status === "success") {
            return {
              format: sequence.document.format,
              records: sequence.document.recordInventory?.totalCount ?? sequence.document.records.length,
              residues: sequence.document.fastqSummary?.totalBases ?? sequence.document.records.reduce((sum, record) => sum + record.length, 0),
              status: "success",
              viewer: "sequence",
              warningCodes: [...new Set(sequence.document.warnings.map(({ code }) => code))],
              warnings: sequence.document.warnings.length,
            };
          }
          if (alignment.status === "success") {
            return {
              columns: alignment.document.alignedLength,
              format: alignment.document.format,
              rows: alignment.document.rows.length,
              status: "success",
              viewer: "alignment",
              warningCodes: [...new Set(alignment.document.warnings.map(({ code }) => code))],
              warnings: alignment.document.warnings.length,
            };
          }
          return { message: sequence.message, status: "error", viewer: "sequence" };
        }
      `,
      loader: "ts",
      resolveDir: pluginDirectory,
      sourcefile: "manual-format-smoke-entry.ts",
    },
    write: false,
  });
  const javascript = result.outputFiles[0]?.text;
  if (javascript == null)
    throw new Error("Could not build parser smoke entry.");
  return await import(
    `data:text/javascript;base64,${Buffer.from(javascript).toString("base64")}`
  );
}

async function readInput(input) {
  if (/^https:\/\//i.test(input)) {
    const response = await fetch(input, {
      headers: { "user-agent": "openai-sequence-viewer-format-smoke" },
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} while reading ${input}`);
    }
    return await response.text();
  }
  return await readFile(path.resolve(input), "utf8");
}

function getFileName(input) {
  return /^https:\/\//i.test(input)
    ? path.basename(new URL(input).pathname)
    : path.basename(input);
}
