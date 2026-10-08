/** Small dependency-free utilities: ids, time, logging. */

import { randomUUID, createHash } from "node:crypto";

export function newId(prefix = ""): string {
  const id = randomUUID();
  return prefix ? `${prefix}_${id}` : id;
}

/** Deterministic id from stable inputs (e.g. path). */
export function stableId(prefix: string, ...parts: string[]): string {
  const h = createHash("sha1").update(parts.join("\u0000")).digest("hex").slice(0, 16);
  return `${prefix}_${h}`;
}

export function sha1(text: string): string {
  return createHash("sha1").update(text).digest("hex");
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function toEpoch(iso: string | undefined): number {
  if (!iso) return 0;
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : 0;
}

/** Format an ISO timestamp as HH:MM in a given IANA timezone. */
export function formatTime(iso: string, timezone = "UTC"): string {
  try {
    return new Intl.DateTimeFormat("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: timezone,
      hour12: false,
    }).format(new Date(iso));
  } catch {
    return iso.slice(11, 16);
  }
}

/** Format an ISO timestamp as a full date, e.g. "September 9, 2026". */
export function formatDate(iso: string, timezone = "UTC"): string {
  try {
    return new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      timeZone: timezone,
    }).format(new Date(iso));
  } catch {
    return iso.slice(0, 10);
  }
}

/** Return YYYY-MM-DD (local to timezone) used for day-grouping. */
export function dayKey(iso: string, timezone = "UTC"): string {
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      timeZone: timezone,
    }).format(new Date(iso));
    return parts;
  } catch {
    return iso.slice(0, 10);
  }
}

export type LogLevel = "debug" | "info" | "warn" | "error";

const LEVELS: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };

let currentLevel: LogLevel =
  (process.env.DEVRECAP_LOG_LEVEL as LogLevel) || "info";

export function setLogLevel(level: LogLevel): void {
  currentLevel = level;
}

/**
 * Structured logger. Emits JSON lines to stderr. Never log raw session content
 * or secrets — callers must pass already-safe fields only.
 */
export function log(level: LogLevel, msg: string, fields?: Record<string, unknown>): void {
  if (LEVELS[level] < LEVELS[currentLevel]) return;
  const line = JSON.stringify({ t: nowIso(), level, msg, ...fields });
  process.stderr.write(line + "\n");
}

export const logger = {
  debug: (m: string, f?: Record<string, unknown>) => log("debug", m, f),
  info: (m: string, f?: Record<string, unknown>) => log("info", m, f),
  warn: (m: string, f?: Record<string, unknown>) => log("warn", m, f),
  error: (m: string, f?: Record<string, unknown>) => log("error", m, f),
};

/** Jaccard similarity between two string sets (for file/word overlap). */
export function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}

export function basename(p: string): string {
  const norm = p.replace(/\\/g, "/").replace(/\/+$/, "");
  const idx = norm.lastIndexOf("/");
  return idx === -1 ? norm : norm.slice(idx + 1);
}
