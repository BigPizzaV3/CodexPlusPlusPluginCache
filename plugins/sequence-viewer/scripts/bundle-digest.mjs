import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { readdir, stat } from "node:fs/promises";
import path from "node:path";

export const BUNDLE_DIGEST_ALGORITHM =
  "sha256(sorted relativePath NUL byteLength NUL fileSha256 LF)";

export async function digestBundle(root) {
  const files = await listRelativeFiles(root);
  const aggregate = createHash("sha256");
  let byteLength = 0;
  for (const relativePath of files) {
    const absolutePath = path.join(root, ...relativePath.split("/"));
    const fileStat = await stat(absolutePath);
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
    digestAlgorithm: BUNDLE_DIGEST_ALGORITHM,
    fileCount: files.length,
    sha256: aggregate.digest("hex"),
  };
}

export async function digestFileSha256(filePath) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(filePath)) hash.update(chunk);
  return hash.digest("hex");
}

export function assertQualificationBundleMatches(actual, expected) {
  for (const field of [
    "byteLength",
    "fileCount",
    "manifestSha256",
    "sha256",
    "starterContractSha256",
  ]) {
    if (actual?.[field] !== expected?.[field]) {
      throw new Error(
        `Generated bundle ${field} does not match the checked LSC-109 qualification.`,
      );
    }
  }
}

export async function listRelativeFiles(root, prefix = "") {
  const directory = path.join(root, ...prefix.split("/").filter(Boolean));
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isSymbolicLink()) {
      throw new Error(`Qualification bundles may not contain links: ${relativePath}`);
    } else if (entry.isDirectory()) {
      files.push(...(await listRelativeFiles(root, relativePath)));
    } else if (entry.isFile()) {
      files.push(relativePath);
    }
  }
  return files.sort(compareStrings);
}

function compareStrings(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}
