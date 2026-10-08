import { cp, mkdir, readFile, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  assertQualificationBundleMatches,
  digestBundle,
  digestFileSha256,
} from "./bundle-digest.mjs";
import { generateThirdPartyNotices } from "./generate-third-party-notices.mjs";
import {
  assertQualificationSourceSnapshotMatches,
  digestTrackedPluginSource,
} from "./source-snapshot.mjs";
import { validatePublicBundle } from "./validate-public-bundle.mjs";
import { validateStarterQualification } from "./validate-starter-qualification.mjs";

export async function bundlePlugin({
  bundleRoot = bundleRootFromArgs(process.argv),
  qualificationMode = "enforce",
} = {}) {
  const enforceQualification = shouldValidateQualification(qualificationMode);
  const [manifest, starterContract] = await Promise.all([
    readJson(".codex-plugin/plugin.json"),
    readJson("starter-examples.json"),
  ]);
  let qualification;
  if (enforceQualification) {
    const [checkedQualification, reportMarkdown] = await Promise.all([
      readJson("lsc-109-qualification.json"),
      readFile("LSC_109_QUALIFICATION.md", "utf8"),
    ]);
    qualification = checkedQualification;
    validateStarterQualification({
      manifest,
      qualification,
      reportMarkdown,
      starterContract,
    });
  }

  await import("./build.mjs");
  await rm(bundleRoot, { force: true, recursive: true });
  await mkdir(bundleRoot, { recursive: true });
  await Promise.all(
    [
      ".codex-plugin",
      ".mcp.json",
      "CAPABILITY_MATRIX.md",
      "LICENSE",
      "STARTER_EXAMPLES.md",
      "assets",
      "dist",
      "skills",
      "starter-examples.json",
    ].map((entry) => cp(entry, path.join(bundleRoot, entry), { recursive: true })),
  );
  await Promise.all([
    cp("PUBLIC_README.md", path.join(bundleRoot, "README.md")),
    generateThirdPartyNotices(path.join(bundleRoot, "THIRD_PARTY_NOTICES.md")),
  ]);
  await validatePublicBundle(bundleRoot, "sequence-viewer");
  const generatedBundle = {
    ...(await digestBundle(bundleRoot)),
    manifestSha256: await digestFileSha256(
      path.join(bundleRoot, ".codex-plugin/plugin.json"),
    ),
    starterContractSha256: await digestFileSha256(
      path.join(bundleRoot, "starter-examples.json"),
    ),
  };
  assertQualificationBundleWhenRequired({
    generatedBundle,
    qualificationBundle: qualification?.environment?.bundle,
    qualificationMode,
  });
  if (enforceQualification) {
    assertQualificationSourceSnapshotMatches(
      await digestTrackedPluginSource(),
      qualification.environment.sourceBinding.submittedSourceSnapshot,
    );
  }
  return generatedBundle;
}

export function assertQualificationBundleWhenRequired({
  generatedBundle,
  qualificationBundle,
  qualificationMode,
}) {
  if (shouldValidateQualification(qualificationMode)) {
    assertQualificationBundleMatches(generatedBundle, qualificationBundle);
  }
}

export function shouldValidateQualification(qualificationMode) {
  if (!["enforce", "regenerate"].includes(qualificationMode)) {
    throw new Error(`Unsupported qualification mode: ${qualificationMode}`);
  }
  return qualificationMode === "enforce";
}

function bundleRootFromArgs(argv) {
  const outputDirArgIndex = argv.indexOf("--output-dir");
  const bundleRoot =
    outputDirArgIndex === -1
      ? path.join("bundle", "sequence-viewer")
      : argv[outputDirArgIndex + 1];
  if (bundleRoot == null || bundleRoot.trim() === "") {
    throw new Error("Missing --output-dir value");
  }
  return bundleRoot;
}

if (
  process.argv[1] != null &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  await bundlePlugin();
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}
