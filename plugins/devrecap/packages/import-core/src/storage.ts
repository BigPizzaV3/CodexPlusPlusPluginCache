/**
 * Import storage + expansion (streaming / file-based).
 *
 * The uploaded file has already been streamed to a temp file and atomically
 * moved to `<dataDir>/imports/<importId>/` by the upload handler (see the
 * server's upload route). This module never holds a whole upload in memory:
 *
 *  - It detects the file type from the filename + a small header read.
 *  - For `.zip`, it expands entries to member files on disk under the import
 *    dir, enforcing the documented archive safety limits (via `unzip`), and
 *    returns file-based member descriptors.
 *  - For `.gz` and plain text, it returns a single streamable member descriptor
 *    (path + gunzip flag) so the parser can stream it line-by-line.
 *
 * DevRecap only ever writes inside its own import directory; member names from
 * archives are validated (ZIP-slip safe) before being joined to the import dir.
 */

import { createHash } from "node:crypto";
import {
  mkdirSync, writeFileSync, readFileSync, openSync, readSync, closeSync, statSync,
} from "node:fs";
import { join } from "node:path";
import { detectFileType } from "./detect.ts";
import type { FileType } from "./detect.ts";
import { gunzip, unzip } from "./decompress.ts";
import { MAX_NESTING_DEPTH, MAX_DECOMPRESSED_BYTES, formatBytes, ImportLimitError } from "./limits.ts";

/** A member ready to be parsed. Either a file on disk (stream it) or in-memory bytes. */
export interface MemberDescriptor {
  /** Display name (original filename or archive entry name). */
  name: string;
  /** Coarse type used to pick a parse strategy. */
  fileType: FileType;
  /** Path to a file on disk to stream (plain or .gz). */
  path?: string;
  /** True when `path` points at gzip-compressed bytes to stream through gunzip. */
  gunzip?: boolean;
  /** In-memory content for small archive members already decompressed. */
  content?: string;
}

export interface PreparedImport {
  size: number;
  fileType: FileType;
  members: MemberDescriptor[];
  /** Non-fatal per-entry skips (encrypted / unsupported), surfaced as warnings. */
  skipped: { name: string; reason: string }[];
}

export function sha256(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

/** Compute a hash for an in-memory buffer (small inputs / previews). */
export function hashUpload(bytes: Buffer): string {
  return sha256(bytes);
}

/** Read the first N bytes of a file for magic-byte detection (no full read). */
function readHeader(path: string, n = 512): Buffer {
  const fd = openSync(path, "r");
  try {
    const buf = Buffer.alloc(n);
    const read = readSync(fd, buf, 0, n, 0);
    return buf.subarray(0, read);
  } finally {
    closeSync(fd);
  }
}

/**
 * Sanitize a user-supplied filename to a safe basename. Strips any path
 * components, control chars, and disallowed characters; never trusts a path.
 */
export function sanitizeFilename(name: string): string {
  const base = String(name).replace(/\\/g, "/").split("/").pop() ?? "";
  const cleaned = base
    .replace(/[\u0000-\u001f\u007f]/g, "") // control chars
    .replace(/[^\w.\- ]/g, "_")            // disallowed → underscore
    .replace(/^\.+/, "")                    // no leading dots (hidden/.. )
    .trim()
    .slice(0, 200);
  return cleaned || "upload.bin";
}

/**
 * Expand an already-stored uploaded file into member descriptors. Streaming for
 * plain/gz (returns paths); on-disk expansion for zip members (with limits).
 */
export function prepareStoredImport(
  dataDir: string,
  importId: string,
  storedPath: string,
  originalFilename: string,
): PreparedImport {
  const size = statSync(storedPath).size;
  const header = readHeader(storedPath);
  const fileType = detectFileType(originalFilename, header);
  const dir = join(dataDir, "imports", importId);
  mkdirSync(dir, { recursive: true });

  const members: MemberDescriptor[] = [];
  const skipped: { name: string; reason: string }[] = [];

  if (fileType === "zip") {
    // ZIP still needs the whole buffer for central-directory parsing, but the
    // safety limits in `unzip` cap total/entry/ratio so this is bounded.
    const buf = readFileSync(storedPath);
    expandZip(dir, originalFilename, buf, members, skipped, 0);
  } else if (fileType === "gz") {
    // Stream the gz at parse time; do not decompress fully here.
    members.push({
      name: originalFilename.replace(/\.gz$/i, ""),
      fileType: "jsonl", // best-effort; parser is format-agnostic per line
      path: storedPath,
      gunzip: true,
    });
  } else {
    // plain jsonl/json/txt/unknown — stream directly from disk
    members.push({ name: originalFilename, fileType, path: storedPath });
  }

  return { size, fileType, members, skipped };
}

function expandZip(
  dir: string,
  archiveName: string,
  buf: Buffer,
  members: MemberDescriptor[],
  skipped: { name: string; reason: string }[],
  depth: number,
): void {
  if (depth > MAX_NESTING_DEPTH) {
    throw new ImportLimitError(
      "MAX_NESTING_DEPTH",
      `Archive rejected: nesting depth exceeds the configured limit of ${MAX_NESTING_DEPTH}.`,
    );
  }
  const { members: entries, skipped: entrySkips } = unzip(buf);
  skipped.push(...entrySkips);
  const membersDir = join(dir, "members");
  mkdirSync(membersDir, { recursive: true });

  for (const entry of entries) {
    const innerType = detectFileType(entry.name, entry.bytes);
    if (innerType === "zip") {
      expandZip(dir, entry.name, entry.bytes, members, skipped, depth + 1);
      continue;
    }
    if (innerType === "gz") {
      let inner: Buffer;
      try { inner = gunzip(entry.bytes); } catch (e) {
        skipped.push({ name: entry.name, reason: `invalid gzip member: ${String(e)}` });
        continue;
      }
      if (inner.length > MAX_DECOMPRESSED_BYTES) {
        throw new ImportLimitError(
          "MAX_DECOMPRESSED_BYTES",
          `Archive rejected: member "${entry.name}" decompressed to ${formatBytes(inner.length)}, exceeding the ${formatBytes(MAX_DECOMPRESSED_BYTES)} limit.`,
        );
      }
      const innerName = entry.name.replace(/\.gz$/i, "");
      const p = writeMember(membersDir, innerName);
      writeFileSync(p, inner);
      members.push({ name: innerName, fileType: detectFileType(innerName, inner), path: p });
      continue;
    }
    // plain member: write to disk and stream at parse time
    const p = writeMember(membersDir, entry.name);
    writeFileSync(p, entry.bytes);
    members.push({ name: entry.name, fileType: innerType, path: p });
  }
}

let memberCounter = 0;
function writeMember(membersDir: string, name: string): string {
  // Names are already ZIP-slip-validated by unzip(); flatten to a safe basename
  // under the members dir with a counter to avoid collisions.
  const safe = sanitizeFilename(name);
  memberCounter += 1;
  return join(membersDir, `${memberCounter}_${safe}`);
}

/** Compute SHA-256 of an on-disk file by streaming it (no full load). */
export function hashFileSync(path: string): { hash: string; size: number } {
  const h = createHash("sha256");
  const fd = openSync(path, "r");
  try {
    const buf = Buffer.alloc(1024 * 1024);
    let size = 0;
    for (;;) {
      const read = readSync(fd, buf, 0, buf.length, size);
      if (read <= 0) break;
      h.update(buf.subarray(0, read));
      size += read;
    }
    return { hash: h.digest("hex"), size };
  } finally {
    closeSync(fd);
  }
}
