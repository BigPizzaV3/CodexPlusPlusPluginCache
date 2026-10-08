import { createHash } from "node:crypto";
import { execFile as execFileCallback } from "node:child_process";
import { createReadStream } from "node:fs";
import { lstat, realpath } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

const execFile = promisify(execFileCallback);

export const SOURCE_SNAPSHOT_DIGEST_ALGORITHM =
  "sha256(sorted tracked relativePath NUL byteLength NUL fileSha256 LF)";
export const SOURCE_SNAPSHOT_EXCLUDED_EVIDENCE_FILES = Object.freeze([
  "LSC_109_QUALIFICATION.md",
  "lsc-109-qualification.json",
]);

export async function digestTrackedPluginSource(root = ".") {
  const canonicalRoot = await realpath(root);
  const { stdout } = await execFile(
    "git",
    ["-C", canonicalRoot, "ls-files", "--cached", "-z", "--", "."],
    { encoding: "utf8", maxBuffer: 8 * 1_024 * 1_024 },
  );
  const excluded = new Set(SOURCE_SNAPSHOT_EXCLUDED_EVIDENCE_FILES);
  const trackedFiles = stdout
    .split("\0")
    .filter(Boolean)
    .filter((relativePath) => !excluded.has(relativePath));
  if (trackedFiles.length === 0) {
    throw new Error("The qualification source snapshot has no tracked files.");
  }
  return digestPluginSourceFiles(canonicalRoot, trackedFiles);
}

export async function digestPluginSourceFiles(root, relativePaths) {
  const files = [...new Set(relativePaths)].sort(compareStrings);
  const aggregate = createHash("sha256");
  let byteLength = 0;
  for (const relativePath of files) {
    assertSafeRelativePath(relativePath);
    const absolutePath = path.join(root, ...relativePath.split("/"));
    const fileStat = await lstat(absolutePath);
    if (!fileStat.isFile() || fileStat.isSymbolicLink()) {
      throw new Error(
        `Qualification source snapshots require regular tracked files: ${relativePath}`,
      );
    }
    const fileHash = createHash("sha256");
    for await (const chunk of createReadStream(absolutePath)) {
      fileHash.update(chunk);
    }
    byteLength += fileStat.size;
    aggregate.update(relativePath, "utf8");
    aggregate.update("\0");
    aggregate.update(String(fileStat.size), "utf8");
    aggregate.update("\0");
    aggregate.update(fileHash.digest("hex"), "utf8");
    aggregate.update("\n");
  }
  return {
    byteLength,
    digestAlgorithm: SOURCE_SNAPSHOT_DIGEST_ALGORITHM,
    excludedEvidenceFiles: [
      ...SOURCE_SNAPSHOT_EXCLUDED_EVIDENCE_FILES,
    ],
    fileCount: files.length,
    kind: "tracked-plugin-source",
    sha256: aggregate.digest("hex"),
  };
}

export function assertQualificationSourceSnapshotMatches(actual, expected) {
  for (const field of [
    "kind",
    "digestAlgorithm",
    "byteLength",
    "fileCount",
    "sha256",
  ]) {
    if (actual?.[field] !== expected?.[field]) {
      throw new Error(
        `Tracked plugin source ${field} does not match the checked LSC-109 qualification.`,
      );
    }
  }
  if (
    JSON.stringify(actual.excludedEvidenceFiles) !==
      JSON.stringify(SOURCE_SNAPSHOT_EXCLUDED_EVIDENCE_FILES) ||
    JSON.stringify(expected.excludedEvidenceFiles) !==
      JSON.stringify(SOURCE_SNAPSHOT_EXCLUDED_EVIDENCE_FILES)
  ) {
    throw new Error(
      "The LSC-109 source snapshot may exclude only its two self-referential evidence files.",
    );
  }
}

function assertSafeRelativePath(relativePath) {
  if (
    typeof relativePath !== "string" ||
    relativePath.length === 0 ||
    relativePath.includes("\\") ||
    path.posix.isAbsolute(relativePath) ||
    path.posix.normalize(relativePath) !== relativePath ||
    relativePath === ".." ||
    relativePath.startsWith("../")
  ) {
    throw new Error(`Invalid tracked source path: ${relativePath}`);
  }
}

function compareStrings(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}
