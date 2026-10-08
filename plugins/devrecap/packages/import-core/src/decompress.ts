/**
 * Decompression of imported archives — no external binaries, no npm deps.
 *
 * - `.gz`  → node:zlib.gunzipSync (buffer) / createGunzip (stream, see storage)
 * - `.zip` → parse the End Of Central Directory + Central Directory ourselves,
 *            then inflate each entry (STORE=0 raw copy, DEFLATE=8 via
 *            node:zlib.inflateRawSync). Portable to Windows/WSL/Linux.
 *
 * SECURITY: imported archives are UNTRUSTED. `unzip` enforces the documented
 * safety limits (entry count, total/single uncompressed size, compression
 * ratio) and rejects unsafe entries (ZIP-slip path traversal, absolute paths,
 * encrypted entries) with a clear, structured reason. An entry can never be
 * written outside DevRecap's own storage because names are validated here and
 * the caller only ever joins sanitized relative names under its import dir.
 */

import { gunzipSync, inflateRawSync } from "node:zlib";
import { logger } from "@devrecap/shared";
import {
  MAX_ARCHIVE_ENTRIES, MAX_UNCOMPRESSED_BYTES, MAX_SINGLE_ENTRY_BYTES,
  MAX_COMPRESSION_RATIO, RATIO_MIN_COMPRESSED_BYTES, formatBytes, ImportLimitError,
} from "./limits.ts";

export interface MemberFile {
  name: string;
  bytes: Buffer;
}

export interface UnzipResult {
  members: MemberFile[];
  /** Entries skipped for a non-fatal reason (encrypted, unsupported method). */
  skipped: { name: string; reason: string }[];
}

export function gunzip(bytes: Buffer): Buffer {
  return gunzipSync(bytes);
}

// --- ZIP parsing -----------------------------------------------------------

const EOCD_SIG = 0x06054b50; // End of central directory
const CDH_SIG = 0x02014b50; // Central directory file header
const LFH_SIG = 0x04034b50; // Local file header
const GP_ENCRYPTED = 0x0001; // general-purpose bit flag: entry is encrypted

/**
 * Reject unsafe archive member names: ZIP-slip (`..`), absolute paths, and
 * Windows drive/UNC paths. Returns a normalized POSIX relative name, or null if
 * the entry must be rejected.
 */
export function safeArchiveName(rawName: string): string | null {
  if (!rawName) return null;
  const name = rawName.replace(/\\/g, "/");
  if (name.startsWith("/")) return null; // absolute POSIX path
  if (/^[a-zA-Z]:/.test(name)) return null; // Windows drive path
  if (name.startsWith("//") || name.startsWith("\\\\")) return null; // UNC
  const segments = name.split("/");
  if (segments.some((s) => s === "..")) return null; // path traversal
  // strip any leading "./" noise; keep the rest as a relative path
  const normalized = segments.filter((s) => s && s !== ".").join("/");
  return normalized || null;
}

/**
 * Extract entries from a ZIP buffer with safety limits.
 * Throws ImportLimitError when a hard limit is violated (bomb / too large).
 * Skips (non-fatally) directory entries, hidden/mac-fork files, encrypted
 * entries, and unsupported compression methods.
 */
export function unzip(buf: Buffer): UnzipResult {
  const eocd = findEOCD(buf);
  if (eocd < 0) {
    logger.warn("unzip: EOCD not found; not a valid zip");
    return { members: [], skipped: [{ name: "(archive)", reason: "not a valid ZIP (no end-of-central-directory record)" }] };
  }
  const cdCount = buf.readUInt16LE(eocd + 10);
  if (cdCount > MAX_ARCHIVE_ENTRIES) {
    throw new ImportLimitError(
      "MAX_ARCHIVE_ENTRIES",
      `Archive rejected: it declares ${cdCount} entries, exceeding the configured limit of ${MAX_ARCHIVE_ENTRIES}.`,
    );
  }
  let cdOffset = buf.readUInt32LE(eocd + 16);

  const members: MemberFile[] = [];
  const skipped: { name: string; reason: string }[] = [];
  let totalUncompressed = 0;

  for (let i = 0; i < cdCount; i++) {
    if (cdOffset + 46 > buf.length) break;
    if (buf.readUInt32LE(cdOffset) !== CDH_SIG) break;

    const flags = buf.readUInt16LE(cdOffset + 8);
    const method = buf.readUInt16LE(cdOffset + 10);
    const compSize = buf.readUInt32LE(cdOffset + 20);
    const uncompSize = buf.readUInt32LE(cdOffset + 24);
    const nameLen = buf.readUInt16LE(cdOffset + 28);
    const extraLen = buf.readUInt16LE(cdOffset + 30);
    const commentLen = buf.readUInt16LE(cdOffset + 32);
    const localHeaderOffset = buf.readUInt32LE(cdOffset + 42);
    const rawName = buf.toString("utf8", cdOffset + 46, cdOffset + 46 + nameLen);
    cdOffset += 46 + nameLen + extraLen + commentLen;

    if (rawName.endsWith("/")) continue; // directory entry

    const safeName = safeArchiveName(rawName);
    if (!safeName) {
      throw new ImportLimitError(
        "ZIP_SLIP",
        `Archive rejected: entry "${rawName}" uses an unsafe path (absolute path or "..") that could escape the import directory.`,
      );
    }
    if (safeName.startsWith("__MACOSX/") || safeName.split("/").some((s) => s.startsWith("."))) {
      continue; // macOS resource forks / hidden files — skip quietly
    }

    if ((flags & GP_ENCRYPTED) !== 0) {
      skipped.push({ name: safeName, reason: "entry is encrypted (password-protected); DevRecap does not decrypt archives" });
      continue;
    }

    // Per-entry uncompressed size limit (from the central directory header).
    if (uncompSize > MAX_SINGLE_ENTRY_BYTES) {
      throw new ImportLimitError(
        "MAX_SINGLE_ENTRY_BYTES",
        `Archive rejected: entry "${safeName}" would expand to ${formatBytes(uncompSize)}, exceeding the per-entry limit of ${formatBytes(MAX_SINGLE_ENTRY_BYTES)}.`,
      );
    }
    // Compression-ratio bomb detection (only for non-trivial entries).
    if (compSize >= RATIO_MIN_COMPRESSED_BYTES && uncompSize / Math.max(compSize, 1) > MAX_COMPRESSION_RATIO) {
      throw new ImportLimitError(
        "MAX_COMPRESSION_RATIO",
        `Archive rejected: entry "${safeName}" has a suspicious compression ratio (${Math.round(uncompSize / compSize)}x), exceeding the limit of ${MAX_COMPRESSION_RATIO}x (possible zip-bomb).`,
      );
    }
    totalUncompressed += uncompSize;
    if (totalUncompressed > MAX_UNCOMPRESSED_BYTES) {
      throw new ImportLimitError(
        "MAX_UNCOMPRESSED_BYTES",
        `Archive rejected because its expanded size exceeds the configured ${formatBytes(MAX_UNCOMPRESSED_BYTES)} safety limit.`,
      );
    }

    let data: Buffer | undefined;
    try {
      data = readLocalEntry(buf, localHeaderOffset, method, compSize);
    } catch (e) {
      skipped.push({ name: safeName, reason: `could not inflate entry: ${String(e)}` });
      continue;
    }
    if (!data) {
      skipped.push({ name: safeName, reason: `unsupported compression method ${method}` });
      continue;
    }
    // Guard against a local header understating size (decompressed > limit).
    if (data.length > MAX_SINGLE_ENTRY_BYTES) {
      throw new ImportLimitError(
        "MAX_SINGLE_ENTRY_BYTES",
        `Archive rejected: entry "${safeName}" expanded to ${formatBytes(data.length)}, exceeding the per-entry limit of ${formatBytes(MAX_SINGLE_ENTRY_BYTES)}.`,
      );
    }
    members.push({ name: safeName, bytes: data });
  }
  return { members, skipped };
}

function findEOCD(buf: Buffer): number {
  const min = Math.max(0, buf.length - (22 + 0xffff));
  for (let i = buf.length - 22; i >= min; i--) {
    if (buf.readUInt32LE(i) === EOCD_SIG) return i;
  }
  return -1;
}

function readLocalEntry(
  buf: Buffer,
  localOffset: number,
  methodFromCD: number,
  compSizeFromCD: number,
): Buffer | undefined {
  if (localOffset + 30 > buf.length || buf.readUInt32LE(localOffset) !== LFH_SIG) return undefined;
  const method = buf.readUInt16LE(localOffset + 8);
  const compSize = buf.readUInt32LE(localOffset + 18) || compSizeFromCD;
  const nameLen = buf.readUInt16LE(localOffset + 26);
  const extraLen = buf.readUInt16LE(localOffset + 28);
  const dataStart = localOffset + 30 + nameLen + extraLen;
  const dataEnd = dataStart + compSize;
  if (dataEnd > buf.length) return undefined;
  const raw = buf.subarray(dataStart, dataEnd);
  const m = method || methodFromCD;
  if (m === 0) return Buffer.from(raw); // stored
  if (m === 8) return inflateRawSync(raw); // deflate
  return undefined;
}
