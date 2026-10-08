/**
 * Codex import adapter (manual-import only).
 *
 * Consumes the CONTENT of a user-provided Codex export and produces RawEvents.
 * It does not discover, open, watch, or connect to anything — it is handed the
 * already-read text by the import orchestrator.
 */

import type { RawEvent } from "@devrecap/shared";
import { parseCodexJsonl, parseCodexJsonArray } from "./parse.ts";
import type { ParseResult } from "./parse.ts";

export interface ImportSourceAdapter {
  readonly kind: string;
  /** Cheap heuristic: does this adapter recognize the content? (0..1) */
  detect(content: string, filename: string): number;
  /** Parse recognized content into raw events. */
  parseContent(content: string): ParseResult;
}

/** Detect whether content looks like Codex rollout JSONL/JSON. */
export function looksLikeCodex(content: string, filename = ""): number {
  const head = content.slice(0, 4000);
  let score = 0;
  if (/rollout-/i.test(filename)) score += 0.4;
  if (/"type"\s*:\s*"session_meta"/.test(head)) score += 0.5;
  if (/"type"\s*:\s*"response_item"/.test(head)) score += 0.3;
  if (/"payload"\s*:/.test(head)) score += 0.2;
  if (/"cli_version"|"turn_context"|"function_call"/.test(head)) score += 0.2;
  return Math.min(score, 1);
}

export class CodexExportAdapter implements ImportSourceAdapter {
  readonly kind = "codex" as const;
  detect(content: string, filename: string): number {
    return looksLikeCodex(content, filename);
  }
  parseContent(content: string): ParseResult {
    const trimmed = content.trimStart();
    // A leading '[' or '{' with no newline-delimited objects → JSON array/doc.
    if (trimmed.startsWith("[")) return parseCodexJsonArray(content);
    // JSONL is the common case; if it yields nothing, try JSON array fallback.
    const jsonl = parseCodexJsonl(content);
    if (jsonl.events.length === 0 && trimmed.startsWith("{") && !content.includes("\n{")) {
      return parseCodexJsonArray(content);
    }
    return jsonl;
  }
}

export {
  parseCodexJsonl,
  parseCodexJsonArray,
  extractContentText,
  recordToRawEvent,
} from "./parse.ts";
export type { ParseResult } from "./parse.ts";
export { parseCodexJsonlStream } from "./stream.ts";
export type { StreamParseOptions, StreamParseResult } from "./stream.ts";
