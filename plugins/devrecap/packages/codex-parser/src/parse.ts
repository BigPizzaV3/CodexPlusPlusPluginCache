/**
 * Codex JSONL parser (manual-import only).
 *
 * Parses the TEXT CONTENT of a Codex rollout file that the USER explicitly
 * imported. DevRecap never discovers, opens, or streams files from the user's
 * machine on its own — the content here has already been read from an uploaded
 * (and, if needed, decompressed) file.
 *
 * Design goals:
 *  - Never crash on a malformed line: skip it, count it, keep going.
 *  - Be defensive about Codex format drift: key on field presence, not a strict
 *    schema. Unknown record types are preserved verbatim as raw events with
 *    payloadType 'unknown' for future parser improvements.
 */

import type { RawEvent } from "@devrecap/shared";

export interface ParseResult {
  events: RawEvent[];
  malformed: number;
  sessionId?: string;
}

/** Extract text from Codex message content (array of parts OR plain string). */
export function extractContentText(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    const parts: string[] = [];
    for (const item of content) {
      if (typeof item === "string") {
        parts.push(item);
      } else if (item && typeof item === "object") {
        const o = item as Record<string, unknown>;
        // input_text / output_text / text variants
        if (typeof o.text === "string") parts.push(o.text);
        else if (typeof o.content === "string") parts.push(o.content);
      }
    }
    return parts.join("\n").trim();
  }
  return "";
}

/**
 * Convert a single parsed JSON record into a RawEvent. Returns undefined only
 * if the record is not an object (counted as malformed by the caller).
 */
export function recordToRawEvent(
  record: unknown,
  seq: number,
  rawLine: string,
): RawEvent | undefined {
  if (!record || typeof record !== "object") return undefined;
  const r = record as Record<string, unknown>;
  const rootType = typeof r.type === "string" ? r.type : "unknown";
  const ts =
    typeof r.timestamp === "string"
      ? r.timestamp
      : typeof r.ts === "string"
        ? r.ts
        : undefined;
  const payload = (r.payload ?? {}) as Record<string, unknown>;
  const payloadType =
    typeof payload.type === "string" ? payload.type : undefined;
  const role = typeof payload.role === "string" ? payload.role : undefined;
  const toolName = typeof payload.name === "string" ? payload.name : undefined;
  const cwd = typeof payload.cwd === "string" ? payload.cwd : undefined;
  const sessionId =
    rootType === "session_meta" && typeof payload.id === "string"
      ? payload.id
      : undefined;

  return {
    sessionId,
    seq,
    ts,
    rootType,
    payloadType,
    role,
    toolName,
    cwd,
    data: r.payload ?? r,
    raw: rawLine,
  };
}

/**
 * Parse Codex JSONL content into RawEvents. Each line is handled independently;
 * one malformed line never invalidates the rest of the import.
 */
export function parseCodexJsonl(content: string): ParseResult {
  const events: RawEvent[] = [];
  let malformed = 0;
  let sessionId: string | undefined;
  let seq = 0;

  const lines = content.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue; // blank line is not malformed
    const thisSeq = seq++;
    let parsed: unknown;
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      malformed++;
      continue;
    }
    const ev = recordToRawEvent(parsed, thisSeq, line);
    if (!ev) {
      malformed++;
      continue;
    }
    if (ev.sessionId && !sessionId) sessionId = ev.sessionId;
    events.push(ev);
  }
  if (sessionId) for (const e of events) if (!e.sessionId) e.sessionId = sessionId;
  return { events, malformed, sessionId };
}

/**
 * Parse a single JSON document that contains an ARRAY of Codex records (some
 * exports wrap the rollout in a JSON array rather than JSONL). Falls back to
 * treating the whole doc as one record if it isn't an array.
 */
export function parseCodexJsonArray(content: string): ParseResult {
  const events: RawEvent[] = [];
  let malformed = 0;
  let sessionId: string | undefined;
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    return { events, malformed: 1, sessionId };
  }
  const records = Array.isArray(parsed)
    ? parsed
    : Array.isArray((parsed as Record<string, unknown>)?.items)
      ? ((parsed as Record<string, unknown>).items as unknown[])
      : [parsed];
  let seq = 0;
  for (const rec of records) {
    const ev = recordToRawEvent(rec, seq++, JSON.stringify(rec));
    if (!ev) {
      malformed++;
      continue;
    }
    if (ev.sessionId && !sessionId) sessionId = ev.sessionId;
    events.push(ev);
  }
  if (sessionId) for (const e of events) if (!e.sessionId) e.sessionId = sessionId;
  return { events, malformed, sessionId };
}
