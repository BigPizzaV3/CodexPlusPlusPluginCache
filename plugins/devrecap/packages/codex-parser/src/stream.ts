/**
 * Streaming Codex JSONL parser (file-based, memory-bounded).
 *
 * Reads a rollout file line-by-line via a Node stream so only a small window of
 * the source is in memory at once — the whole file is never loaded into a
 * single Buffer/string. Optionally pipes through gunzip for `.gz` inputs.
 *
 * A malformed line increments a counter and records a small diagnostic (line
 * number + short excerpt) without aborting the import. Unknown record types are
 * preserved as raw events (rootType 'unknown'). A caller-provided `onEvent`
 * callback receives each parsed RawEvent so events can be persisted in batches
 * instead of accumulated in memory.
 */

import { createReadStream } from "node:fs";
import { createGunzip } from "node:zlib";
import { createInterface } from "node:readline";
import type { RawEvent } from "@devrecap/shared";
import { recordToRawEvent } from "./parse.ts";

export interface StreamParseOptions {
  gunzip?: boolean;
  /** Called for each valid RawEvent. Keep this cheap; batch inside it. */
  onEvent: (ev: RawEvent) => void;
  /** Abort if decompressed/read bytes exceed this (zip/gz bomb guard). */
  maxBytes?: number;
}

export interface StreamParseResult {
  events: number;
  malformed: number;
  sessionId?: string;
  bytesRead: number;
  /** Up to a few sample diagnostics for malformed lines (line#, excerpt). */
  malformedSamples: { line: number; excerpt: string }[];
  truncated?: boolean;
}

const MAX_MALFORMED_SAMPLES = 20;
const MAX_LINE_CHARS = 5 * 1024 * 1024; // a single JSONL line above 5MB is suspect

export async function parseCodexJsonlStream(
  filePath: string,
  opts: StreamParseOptions,
): Promise<StreamParseResult> {
  const result: StreamParseResult = {
    events: 0, malformed: 0, bytesRead: 0, malformedSamples: [],
  };
  let seq = 0;
  let lineNo = 0;
  let sessionId: string | undefined;
  let aborted = false;

  await new Promise<void>((resolve, reject) => {
    const fileStream = createReadStream(filePath);
    fileStream.on("data", (chunk: Buffer | string) => {
      result.bytesRead += Buffer.byteLength(chunk as Buffer);
    });
    const input = opts.gunzip
      ? fileStream.pipe(createGunzip())
      : fileStream;

    // When gunzipping, count decompressed bytes for the maxBytes guard.
    let decompressedBytes = 0;
    const rl = createInterface({ input, crlfDelay: Infinity });

    const finish = (err?: Error) => {
      rl.removeAllListeners();
      if (err) reject(err);
      else resolve();
    };

    rl.on("line", (line) => {
      if (aborted) return;
      lineNo++;
      if (opts.gunzip) {
        decompressedBytes += Buffer.byteLength(line) + 1;
        if (opts.maxBytes && decompressedBytes > opts.maxBytes) {
          aborted = true;
          result.truncated = true;
          rl.close();
          input.destroy?.();
          fileStream.destroy();
          return;
        }
      }
      const trimmed = line.trim();
      if (!trimmed) return; // blank line — not malformed
      if (trimmed.length > MAX_LINE_CHARS) {
        recordMalformed(result, lineNo, trimmed);
        return;
      }
      let parsed: unknown;
      try {
        parsed = JSON.parse(trimmed);
      } catch {
        recordMalformed(result, lineNo, trimmed);
        return;
      }
      const ev = recordToRawEvent(parsed, seq++, line);
      if (!ev) {
        recordMalformed(result, lineNo, trimmed);
        return;
      }
      if (ev.sessionId && !sessionId) sessionId = ev.sessionId;
      result.events++;
      opts.onEvent(ev);
    });
    rl.on("close", () => finish());
    fileStream.on("error", (e) => finish(e as Error));
    input.on("error", (e) => finish(e as Error));
  });

  result.sessionId = sessionId;
  return result;
}

function recordMalformed(result: StreamParseResult, line: number, text: string): void {
  result.malformed++;
  if (result.malformedSamples.length < MAX_MALFORMED_SAMPLES) {
    result.malformedSamples.push({ line, excerpt: text.slice(0, 120) });
  }
}
