import { createHash, randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { createReadStream, createWriteStream } from "node:fs";
import {
  access,
  mkdir,
  readFile,
  readdir,
  realpath,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { execFile as execFileCallback } from "node:child_process";

import {
  BUNDLE_DIGEST_ALGORITHM,
  digestBundle,
  listRelativeFiles,
} from "./bundle-digest.mjs";
import { digestTrackedPluginSource } from "./source-snapshot.mjs";

const execFile = promisify(execFileCallback);
const pluginRoot = await realpath(
  path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."),
);
const outputRoot = path.join(
  pluginRoot,
  "output/playwright/lsc-109-qualification",
);
const examplesRoot = path.join(outputRoot, "examples");
const failuresRoot = path.join(outputRoot, "failures");
const workspaceRoot = path.join(outputRoot, "workspace");
const qualificationPath = path.join(outputRoot, "qualification-run.json");
const playwrightLogPath = path.join(outputRoot, "playwright.log");
const playwrightResultsRoot = path.join(outputRoot, "test-results");
const startedAt = new Date();
const runId = randomUUID();

process.chdir(pluginRoot);
if (process.env.SEQUENCE_VIEWER_QUALIFICATION_ALLOW_DIRTY !== "1") {
  await assertCleanGitWorktree();
}
await rm(outputRoot, { force: true, recursive: true });
await Promise.all([
  mkdir(examplesRoot, { recursive: true }),
  mkdir(failuresRoot, { recursive: true }),
  mkdir(workspaceRoot, { recursive: true }),
]);
if ((await readdir(workspaceRoot)).length !== 0) {
  throw new Error("The starter qualification workspace is not empty.");
}

const { bundlePlugin } = await import("./bundle.mjs");
await bundlePlugin({ qualificationMode: "regenerate" });
const bundleRoot = await realpath(path.join(pluginRoot, "bundle/sequence-viewer"));
const [
  bundle,
  commit,
  tree,
  submittedSourceSnapshot,
  manifestText,
  starterContractText,
] = await Promise.all([
  digestBundle(bundleRoot),
  gitRevision("HEAD"),
  gitRevision("HEAD^{tree}"),
  digestTrackedPluginSource(),
  readFile(path.join(bundleRoot, ".codex-plugin/plugin.json"), "utf8"),
  readFile(path.join(bundleRoot, "starter-examples.json"), "utf8"),
]);
const manifest = JSON.parse(manifestText);
const starterContract = JSON.parse(starterContractText);
if (manifest.name !== "sequence-viewer") {
  throw new Error("The qualification bundle is not Sequence Viewer.");
}
if (manifest.version !== starterContract.pluginVersion) {
  throw new Error("The qualification bundle has inconsistent plugin versions.");
}

const model = metadataValue(
  "SEQUENCE_VIEWER_QUALIFICATION_MODEL",
  process.env.CODEX_MODEL ?? "not-recorded",
);
const reasoning = metadataValue(
  "SEQUENCE_VIEWER_QUALIFICATION_REASONING",
  process.env.CODEX_MODEL_REASONING_EFFORT ?? "not-recorded",
);
const optionalSkills = metadataValue(
  "SEQUENCE_VIEWER_QUALIFICATION_OPTIONAL_SKILLS",
  "none (official-endpoint fallback lane)",
);
const qualificationEnvironment = {
  SEQUENCE_VIEWER_QUALIFICATION_BUNDLE_BYTES: String(bundle.byteLength),
  SEQUENCE_VIEWER_QUALIFICATION_BUNDLE_FILE_COUNT: String(bundle.fileCount),
  SEQUENCE_VIEWER_QUALIFICATION_BUNDLE_SHA256: bundle.sha256,
  SEQUENCE_VIEWER_QUALIFICATION_COMMIT: commit,
  SEQUENCE_VIEWER_QUALIFICATION_MODEL: model,
  SEQUENCE_VIEWER_QUALIFICATION_OPTIONAL_SKILLS: optionalSkills,
  SEQUENCE_VIEWER_QUALIFICATION_OUTPUT_ROOT: outputRoot,
  SEQUENCE_VIEWER_QUALIFICATION_REASONING: reasoning,
  SEQUENCE_VIEWER_QUALIFICATION_TREE: tree,
};
const playwrightCli = path.join(
  pluginRoot,
  "node_modules/@playwright/test/cli.js",
);
await access(playwrightCli).catch(() => {
  throw new Error(
    "Playwright is not installed. Run pnpm install --frozen-lockfile first.",
  );
});

const playwrightExitCode = await runPlaywright(
  playwrightCli,
  {
    ...process.env,
    ...qualificationEnvironment,
    SEQUENCE_VIEWER_E2E_FAULT_INJECTION: "1",
    SEQUENCE_VIEWER_E2E_PLUGIN_ROOT: bundleRoot,
    SEQUENCE_VIEWER_E2E_SKIP_BUILD: "1",
    SEQUENCE_VIEWER_PUBLIC_EXAMPLES_EVIDENCE_ROOT: workspaceRoot,
    SEQUENCE_VIEWER_PUBLIC_STARTER_E2E: "1",
    SEQUENCE_VIEWER_PUBLIC_STARTER_FAILURE_E2E: "1",
  },
  playwrightLogPath,
);
const [playwrightLog, playwrightTraces] = await Promise.all([
  digestEvidenceFile(playwrightLogPath),
  collectPlaywrightTraces(playwrightResultsRoot),
]);
const exampleFiles = (await readdir(examplesRoot, { withFileTypes: true }))
  .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
  .map((entry) => entry.name)
  .sort(compareStrings);
const examples = await Promise.all(
  exampleFiles.map(async (name) => ({
    evidenceFile: `examples/${name}`,
    ...(await readJson(path.join(examplesRoot, name))),
  })),
);
const failureFiles = (await readdir(failuresRoot, { withFileTypes: true }))
  .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
  .map((entry) => entry.name)
  .sort(compareStrings);
const failureScenarios = await Promise.all(
  failureFiles.map(async (name) => ({
    evidenceFile: `failures/${name}`,
    ...(await readJson(path.join(failuresRoot, name))),
  })),
);
const expectedFailureScenarios = [
  "accession-missing",
  "deterministic-subset-failure",
  "malformed-database-response",
  "network-unavailable",
  "optional-skill-unavailable-fallback",
  "output-collision",
  "output-quota-failure",
  "oversized-source-or-analysis-budget",
  "payload-format-mismatch",
  "rate-limit",
  "viewer-retry-remount",
];
const exampleOrder = new Map(
  starterContract.examples.map(({ id }, index) => [id, index]),
);
examples.sort((left, right) => {
  const leftId = left.exampleId ?? left.id;
  const rightId = right.exampleId ?? right.id;
  const leftOrder = exampleOrder.get(leftId) ?? Number.MAX_SAFE_INTEGER;
  const rightOrder = exampleOrder.get(rightId) ?? Number.MAX_SAFE_INTEGER;
  return (
    leftOrder - rightOrder ||
    compareStrings(
      String(leftId ?? left.evidenceFile),
      String(rightId ?? right.evidenceFile),
    )
  );
});

const expectedExampleIds = starterContract.examples.map(({ id }) => id);
const observedExampleIds = examples
  .map((example) => example.exampleId ?? example.id)
  .filter((id) => typeof id === "string");
const errors = [];
if (playwrightExitCode !== 0) {
  errors.push(`Playwright exited with status ${playwrightExitCode}.`);
}
if (JSON.stringify(observedExampleIds) !== JSON.stringify(expectedExampleIds)) {
  errors.push(
    `Expected qualification evidence for ${expectedExampleIds.join(", ")}; observed ${observedExampleIds.join(", ") || "none"}.`,
  );
}
if (
  JSON.stringify(
    failureScenarios.map(({ requirement }) => requirement).sort(compareStrings),
  ) !== JSON.stringify(expectedFailureScenarios)
) {
  errors.push(
    `Expected bundle-backed failure evidence for ${expectedFailureScenarios.join(", ")}; observed ${failureScenarios.map(({ requirement }) => requirement).join(", ") || "none"}.`,
  );
}
if (
  failureScenarios.some(
    ({ assertions, status }) =>
      status !== "passed" ||
      assertions?.actionableResult !== true ||
      assertions?.noBundledFallback !== true ||
      assertions?.noMisleadingArtifact !== true ||
      assertions?.noMisleadingViewer !== true,
  )
) {
  errors.push(
    "Every bundle-backed failure scenario must pass its actionable, no-fallback, no-misleading-state assertions.",
  );
}
for (const evidenceKind of ["log", "screenshot", "trace"]) {
  const hashes = failureScenarios.map(
    ({ evidence }) => evidence?.[evidenceKind]?.sha256,
  );
  if (
    hashes.some((hash) => !/^[a-f0-9]{64}$/u.test(hash ?? "")) ||
    new Set(hashes).size !== failureScenarios.length
  ) {
    errors.push(
      `Bundle-backed failure ${evidenceKind} evidence must have a distinct SHA-256 for every scenario.`,
    );
  }
}

const completedAt = new Date();
const qualification = {
  schemaVersion: 1,
  runId,
  status: errors.length === 0 ? "passed" : "failed",
  plugin: { name: manifest.name, version: manifest.version },
  source: {
    executionRevision: { commitSha: commit, treeSha: tree },
    submittedSourceSnapshot,
  },
  bundle: {
    byteLength: bundle.byteLength,
    digestAlgorithm: BUNDLE_DIGEST_ALGORITHM,
    fileCount: bundle.fileCount,
    manifestSha256: sha256(manifestText),
    sha256: bundle.sha256,
    starterContractSha256: sha256(starterContractText),
  },
  environment: {
    architecture: process.arch,
    model,
    node: process.version,
    operatingSystem: `${os.type()} ${os.release()}`,
    optionalSkills,
    platform: process.platform,
    reasoning,
  },
  execution: {
    completedAt: completedAt.toISOString(),
    durationMs: completedAt.getTime() - startedAt.getTime(),
    playwrightExitCode,
    playwrightLog,
    playwrightTraces,
    startedAt: startedAt.toISOString(),
    workspaceInitiallyEmpty: true,
    workspaceRelativePath: "workspace",
  },
  examples,
  failureScenarios,
  errors,
};
await writeFile(qualificationPath, `${JSON.stringify(qualification, null, 2)}\n`);
process.stdout.write(`Starter qualification report: ${qualificationPath}\n`);
if (errors.length > 0) process.exitCode = 1;

async function runPlaywright(playwrightCliPath, environment, logPath) {
  const log = createWriteStream(logPath, { flags: "wx" });
  const child = spawn(
    process.execPath,
    [
      playwrightCliPath,
      "test",
      "public-starter-evidence.spec.ts",
      "public-starter-failure-evidence.spec.ts",
      "--config=playwright.config.ts",
    ],
    {
      cwd: pluginRoot,
      env: environment,
      stdio: ["inherit", "pipe", "pipe"],
    },
  );
  child.stdout.pipe(process.stdout, { end: false });
  child.stdout.pipe(log, { end: false });
  child.stderr.pipe(process.stderr, { end: false });
  child.stderr.pipe(log, { end: false });
  return await new Promise((resolve, reject) => {
    const fail = (error) => {
      log.destroy();
      reject(error);
    };
    child.once("error", fail);
    log.once("error", (error) => {
      child.kill();
      reject(error);
    });
    child.once("close", (code, signal) => {
      if (signal != null) {
        fail(new Error(`Playwright was terminated by ${signal}.`));
        return;
      }
      log.end(() => resolve(code ?? 1));
    });
  });
}

async function collectPlaywrightTraces(resultsRoot) {
  const traceFiles = await listFilesIfPresent(resultsRoot);
  return await Promise.all(
    traceFiles
      .filter((relativePath) => path.posix.basename(relativePath) === "trace.zip")
      .map(async (relativePath) =>
        await digestEvidenceFile(
          path.join(resultsRoot, ...relativePath.split("/")),
        ),
      ),
  );
}

async function digestEvidenceFile(filePath) {
  const fileStat = await stat(filePath);
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(filePath)) hash.update(chunk);
  return {
    byteLength: fileStat.size,
    relativePath: path.relative(outputRoot, filePath).split(path.sep).join("/"),
    sha256: hash.digest("hex"),
  };
}

async function listFilesIfPresent(root) {
  try {
    await access(root);
  } catch (error) {
    if (error?.code === "ENOENT") return [];
    throw error;
  }
  return await listRelativeFiles(root);
}

async function gitRevision(revision) {
  const { stdout } = await execFile("git", ["rev-parse", revision], {
    cwd: pluginRoot,
    encoding: "utf8",
  });
  const value = stdout.trim();
  if (!/^[a-f0-9]{40}$/u.test(value)) {
    throw new Error(`Git returned an invalid revision for ${revision}.`);
  }
  return value;
}

async function assertCleanGitWorktree() {
  const { stdout } = await execFile(
    "git",
    ["status", "--porcelain=v1", "--untracked-files=all", "--", "."],
    { cwd: pluginRoot, encoding: "utf8" },
  );
  if (stdout.trim() !== "") {
    throw new Error(
      "Starter qualification requires a clean committed Sequence Viewer worktree. Commit the runtime before qualifying, or set SEQUENCE_VIEWER_QUALIFICATION_ALLOW_DIRTY=1 only for a non-recorded developer iteration.",
    );
  }
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

function metadataValue(name, fallback) {
  const value = process.env[name]?.trim();
  return value == null || value === "" ? fallback : value;
}

function compareStrings(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}
