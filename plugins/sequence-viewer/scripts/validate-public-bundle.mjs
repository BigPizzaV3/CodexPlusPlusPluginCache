import { access, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  validateSequenceViewerExamplePrompts,
} from "./validate-example-prompts.mjs";

const REQUIRED_PATHS = [
  ".codex-plugin/plugin.json",
  ".mcp.json",
  "LICENSE",
  "README.md",
  "STARTER_EXAMPLES.md",
  "THIRD_PARTY_NOTICES.md",
  "assets/icon.png",
  "assets/logo.png",
  "dist/server.mjs",
  "dist/views/app.js.gz",
  "dist/views/styles.css",
  "skills",
  "starter-examples.json",
];
const PUBLIC_EXAMPLE_TOOL_NAME = "sequence.acquire_public_example";
const CHAT_OPEN_TOOL_NAME = "sequence.open_from_chat";
const REMOVED_FASTQ_EXAMPLE_TOOL_NAME = "sequence.open_fastq_example";
const FORBIDDEN_ROOT_ENTRIES = new Set([
  "PUBLIC_README.md",
  "node_modules",
  "package.json",
  "pnpm-lock.yaml",
  "scripts",
  "smoke-fixtures",
  "src",
]);
const FORBIDDEN_TEXT = [
  "/Users/",
  "file:../../lib/js",
  "openai-internal",
  "row-privacy-policy",
  "row-terms-of-use",
];
const MARKETPLACE_SHORT_DESCRIPTION =
  "Inspect, analyze, and compare biological sequences and alignments in Codex.";

export async function validatePublicBundle(bundleRoot, expectedName) {
  await Promise.all(
    REQUIRED_PATHS.map((entry) => access(path.join(bundleRoot, entry))),
  );

  const rootEntries = await readdir(bundleRoot);
  const forbiddenEntries = rootEntries.filter((entry) =>
    FORBIDDEN_ROOT_ENTRIES.has(entry),
  );
  assert(
    forbiddenEntries.length === 0,
    `Public bundle contains source-only root entries: ${forbiddenEntries.join(", ")}`,
  );

  const manifest = JSON.parse(
    await readFile(path.join(bundleRoot, ".codex-plugin/plugin.json"), "utf8"),
  );
  assert(manifest.name === expectedName, `Expected manifest name ${expectedName}`);
  assert(manifest.author?.name === "OpenAI", "Manifest must identify OpenAI as author");
  assert(manifest.homepage === "https://openai.com/", "Manifest homepage must be public");
  assert(
    manifest.repository === "https://github.com/openai/plugins",
    "Manifest repository must point at the public plugin repository",
  );
  assert(manifest.license === "MIT", "Manifest must declare the public license");
  assert(
    manifest.interface?.shortDescription === MARKETPLACE_SHORT_DESCRIPTION,
    `Manifest shortDescription must be: ${MARKETPLACE_SHORT_DESCRIPTION}`,
  );
  assert(
    manifest.interface?.privacyPolicyURL ===
      "https://openai.com/policies/privacy-policy/",
    "Manifest must use the public privacy policy",
  );
  assert(
    manifest.interface?.termsOfServiceURL ===
      "https://openai.com/policies/terms-of-use/",
    "Manifest must use the public terms of use",
  );
  const [viewerSkill, starterContractText, runbook, publicReadme] =
    await Promise.all([
      readFile(
        path.join(bundleRoot, "skills/biological-sequence-viewer/SKILL.md"),
        "utf8",
      ),
      readFile(path.join(bundleRoot, "starter-examples.json"), "utf8"),
      readFile(path.join(bundleRoot, "STARTER_EXAMPLES.md"), "utf8"),
      readFile(path.join(bundleRoot, "README.md"), "utf8"),
    ]);
  const starterContract = JSON.parse(starterContractText);
  validateSequenceViewerExamplePrompts(manifest, viewerSkill, starterContract, {
    publicReadme,
    runbook,
  });

  const mcpConfig = JSON.parse(
    await readFile(path.join(bundleRoot, ".mcp.json"), "utf8"),
  );
  const serverConfig = mcpConfig.mcpServers?.[expectedName];
  assert(serverConfig?.command === "node", "MCP server must use the Node runtime");
  assert(
    Array.isArray(serverConfig?.args) &&
      serverConfig.args.includes("./dist/server.mjs"),
    "MCP server must run the bundled server entrypoint",
  );

  for (const sourceOnlyReference of [
    "codex-plugin-skill-authoring",
    "pnpm install",
    "scripts/build.mjs",
    "src/",
  ]) {
    assert(
      !publicReadme.includes(sourceOnlyReference),
      `Public README contains source-only guidance: ${sourceOnlyReference}`,
    );
  }

  const [serverBundle, sequenceViewerSkill] = await Promise.all([
    readFile(path.join(bundleRoot, "dist/server.mjs"), "utf8"),
    readFile(
      path.join(
        bundleRoot,
        "skills/biological-sequence-viewer/SKILL.md",
      ),
      "utf8",
    ),
  ]);
  validateBundledStarterToolSurface(serverBundle, sequenceViewerSkill);
  assert(
    serverBundle.includes("uniprot-human-ras-sv1") &&
      serverBundle.includes("https://rest.uniprot.org/uniprotkb/") &&
      serverBundle.includes("builtin-center-star"),
    "Bundled server must include the bounded reviewed UniProt RAS alignment route",
  );
  for (const [label, contents] of [
    ["server", serverBundle],
    ["skill", sequenceViewerSkill],
    ["manifest", JSON.stringify(manifest)],
    ["README", publicReadme],
    ["starter contract", starterContractText],
    ["starter runbook", runbook],
  ]) {
    assert(
      !contents.includes(REMOVED_FASTQ_EXAMPLE_TOOL_NAME) &&
        !/bundled sample FASTQ/iu.test(contents),
      `Bundled ${label} still exposes the removed synthetic FASTQ starter`,
    );
  }

  const notices = await readFile(
    path.join(bundleRoot, "THIRD_PARTY_NOTICES.md"),
    "utf8",
  );
  assert(
    notices.startsWith("# Third-Party Notices"),
    "Third-party notices were not generated",
  );

  for (const filePath of await listFiles(bundleRoot)) {
    const contents = await readFile(filePath);
    for (const forbidden of FORBIDDEN_TEXT) {
      assert(
        !contents.includes(forbidden),
        `${path.relative(bundleRoot, filePath)} contains private or internal-only text: ${forbidden}`,
      );
    }
  }
}

export function validateBundledStarterToolSurface(
  serverBundle,
  sequenceViewerSkill,
) {
  assert(
    serverBundle.includes(PUBLIC_EXAMPLE_TOOL_NAME),
    "Bundled server must retain optional root-authorized public example acquisition",
  );
  assert(
    serverBundle.includes(CHAT_OPEN_TOOL_NAME),
    "Bundled server must expose absolute-path chat opening for Codex-acquired examples",
  );
  assert(
    sequenceViewerSkill.includes(CHAT_OPEN_TOOL_NAME),
    "Bundled skill must route Codex-acquired starters through chat opening",
  );
}

async function listFiles(root) {
  const files = [];
  for (const entry of await readdir(root, { withFileTypes: true })) {
    const entryPath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listFiles(entryPath)));
      continue;
    }

    if (entry.isFile()) {
      files.push(entryPath);
    }
  }
  return files;
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const currentFilePath = fileURLToPath(import.meta.url);
if (
  process.argv[1] != null &&
  path.resolve(process.argv[1]) === currentFilePath
) {
  const bundleArgIndex = process.argv.indexOf("--bundle-dir");
  const pluginArgIndex = process.argv.indexOf("--plugin");
  const bundleRoot = process.argv[bundleArgIndex + 1];
  const expectedName = process.argv[pluginArgIndex + 1];
  if (
    bundleArgIndex === -1 ||
    pluginArgIndex === -1 ||
    bundleRoot == null ||
    expectedName == null
  ) {
    throw new Error(
      "Usage: node validate-public-bundle.mjs --bundle-dir <path> --plugin <name>",
    );
  }
  await validatePublicBundle(bundleRoot, expectedName);
}
