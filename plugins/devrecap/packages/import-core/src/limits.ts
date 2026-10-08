/**
 * Documented, configurable safety limits for the import pipeline.
 *
 * All limits are enforced while STREAMING (during upload / decompression /
 * archive expansion) so a hostile or accidentally-huge file cannot exhaust
 * memory or disk before being rejected. Override any limit via environment
 * variables (useful for power users with genuinely large histories).
 *
 * Rationale for the defaults:
 * - Codex rollout files are usually a few KB–low MB; whole-history exports or
 *   zips can reach tens of MB. 200 MB uploaded / 1 GB decompressed leaves
 *   generous head-room while still stopping zip-bombs and runaway inputs.
 */

function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

const MB = 1024 * 1024;

/** Max bytes accepted for a single uploaded file (enforced mid-stream). */
export const MAX_UPLOAD_BYTES = envInt("DEVRECAP_MAX_UPLOAD_BYTES", 200 * MB);

/** Max total bytes produced by decompressing one uploaded file (gz or zip). */
export const MAX_DECOMPRESSED_BYTES = envInt("DEVRECAP_MAX_DECOMPRESSED_BYTES", 1024 * MB);

/** Max number of entries allowed inside a single ZIP archive. */
export const MAX_ARCHIVE_ENTRIES = envInt("DEVRECAP_MAX_ARCHIVE_ENTRIES", 10_000);

/** Max total uncompressed bytes across all entries of a ZIP archive. */
export const MAX_UNCOMPRESSED_BYTES = envInt("DEVRECAP_MAX_UNCOMPRESSED_BYTES", 1024 * MB);

/** Max uncompressed bytes for any single archive entry. */
export const MAX_SINGLE_ENTRY_BYTES = envInt("DEVRECAP_MAX_SINGLE_ENTRY_BYTES", 512 * MB);

/**
 * Max allowed uncompressed:compressed ratio for a single entry. Legitimate text
 * (JSONL) rarely exceeds ~20–50x; a ratio far above this is a zip-bomb signal.
 * Only enforced for entries above `RATIO_MIN_COMPRESSED_BYTES` so tiny entries
 * (whose ratio is noisy) are not falsely rejected.
 */
export const MAX_COMPRESSION_RATIO = envInt("DEVRECAP_MAX_COMPRESSION_RATIO", 200);
export const RATIO_MIN_COMPRESSED_BYTES = envInt("DEVRECAP_RATIO_MIN_COMPRESSED_BYTES", 4096);

/** Max nesting depth for archives-inside-archives (e.g. .gz inside .zip). */
export const MAX_NESTING_DEPTH = envInt("DEVRECAP_MAX_NESTING_DEPTH", 3);

/** Max bytes of a decompressed member kept in memory as text (small members). */
export const MAX_TEXT_MEMBER_BYTES = envInt("DEVRECAP_MAX_TEXT_MEMBER_BYTES", 64 * MB);

/** Human-readable byte formatting for error messages. */
export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < MB) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * MB) return `${(n / MB).toFixed(1)} MB`;
  return `${(n / (1024 * MB)).toFixed(1)} GB`;
}

/** Error thrown when a documented safety limit is exceeded. Carries a reason. */
export class ImportLimitError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "ImportLimitError";
    this.code = code;
  }
}
