/**
 * File-type detection for imported files.
 *
 * Detection uses (a) the filename extension and (b) magic bytes, never the
 * filesystem. Returns a coarse `fileType` used to decide decompression; the
 * *format* (codex/git-log/generic) is decided later by content-based adapters.
 */

export type FileType = "jsonl" | "json" | "gz" | "zip" | "txt" | "unknown";

const GZIP_MAGIC = [0x1f, 0x8b];
const ZIP_MAGIC = [0x50, 0x4b, 0x03, 0x04]; // "PK\x03\x04"

export function detectFileType(filename: string, bytes: Uint8Array): FileType {
  // Magic bytes win over extension (a .txt that is really gzip, etc.).
  if (bytes.length >= 2 && bytes[0] === GZIP_MAGIC[0] && bytes[1] === GZIP_MAGIC[1]) {
    return "gz";
  }
  if (
    bytes.length >= 4 &&
    bytes[0] === ZIP_MAGIC[0] && bytes[1] === ZIP_MAGIC[1] &&
    bytes[2] === ZIP_MAGIC[2] && bytes[3] === ZIP_MAGIC[3]
  ) {
    return "zip";
  }
  const lower = filename.toLowerCase();
  if (lower.endsWith(".jsonl")) return "jsonl";
  if (lower.endsWith(".ndjson")) return "jsonl";
  if (lower.endsWith(".json")) return "json";
  if (lower.endsWith(".gz")) return "gz";
  if (lower.endsWith(".zip")) return "zip";
  if (lower.endsWith(".txt") || lower.endsWith(".log")) return "txt";
  return "unknown";
}

/** True if a member/name looks like a Codex rollout file. */
export function isRolloutName(name: string): boolean {
  return /rollout-.*\.jsonl(\.gz)?$/i.test(name);
}
