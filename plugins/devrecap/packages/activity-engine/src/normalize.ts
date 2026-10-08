/**
 * Normalizer (Activity Extraction V2): RawEvent[] → NormalizedEvent[].
 *
 * Runs the event CLASSIFIER first, then maps only meaningful events into a
 * small work vocabulary. Infrastructure NOISE (environment_context, injected
 * instructions, SKILL.md loading, session bootstrap/resume, model/token
 * metadata) is dropped here and never reaches the activity engine.
 *
 * File involvement is tracked with a `fileOp`:
 *   - edit/create/delete  → real work (from write/edit tools & edit commands)
 *   - read                → inspection (grep/cat/read tools & read commands)
 *   - mention             → merely named in prose (NEVER counted as work)
 */

import type { NormalizedEvent, RawEvent, FileOp } from "@devrecap/shared";
import { toEpoch } from "@devrecap/shared";
import { extractContentText } from "@devrecap/codex-parser";
import {
  classifyRawEvent, commandOf, messageTextOf, execOutputOf, PASS_RE, FAIL_RE,
  workPayloadOf, fileChangesOf, customToolCommandOf, looksLikePatch,
} from "./classify.ts";

const FILE_PATH_RE = /(?:^|[\s"'(=,\[])((?:\.{0,2}\/)?(?:[\w.@-]+\/)+[\w.@-]+\.\w{1,8})/g;
const BARE_FILE_RE = /\b([\w.@-]+\.\w{1,8})\b/g;

/** Parse a Codex shell function_call's `arguments` to a command string. */
export function extractShellCommand(args: unknown): string | undefined {
  return commandOf({ arguments: args });
}

/** Extract candidate file paths mentioned in a string (path-like tokens). */
export function extractFilePaths(text: string): string[] {
  const found = new Set<string>();
  let m: RegExpExecArray | null;
  FILE_PATH_RE.lastIndex = 0;
  while ((m = FILE_PATH_RE.exec(text)) !== null) {
    const p = m[1];
    if (p && !p.startsWith("http")) found.add(p);
  }
  return [...found];
}

/** Files touched by an edit/read tool call — read from its arguments. */
function filesFromToolArgs(payload: Record<string, unknown>): string[] {
  const args = payload.arguments;
  let obj: Record<string, unknown> | undefined;
  if (typeof args === "string") {
    try { obj = JSON.parse(args) as Record<string, unknown>; } catch { obj = undefined; }
  } else if (args && typeof args === "object") {
    obj = args as Record<string, unknown>;
  }
  const paths = new Set<string>();
  if (obj) {
    for (const key of ["path", "file", "filename", "target_file", "targetFile", "file_path", "filePath", "targetPath"]) {
      const v = obj[key];
      if (typeof v === "string" && v.trim()) paths.add(v.trim());
    }
    // apply_patch style: extract paths from the patch text
    for (const key of ["input", "patch", "diff", "content"]) {
      const v = obj[key];
      if (typeof v === "string") for (const p of extractPatchPaths(v)) paths.add(p);
    }
  }
  if (paths.size === 0) {
    // fall back to path-like tokens in the raw arguments JSON
    for (const p of extractFilePaths(typeof args === "string" ? args : JSON.stringify(args ?? ""))) paths.add(p);
  }
  return [...paths];
}

/** Pull affected paths out of an apply_patch / unified-diff body. */
function extractPatchPaths(patch: string): string[] {
  const out = new Set<string>();
  const re = /(?:\*\*\*\s+(?:Update|Add|Delete)\s+File:\s*|^\+\+\+\s+b\/|^---\s+a\/|^diff --git a\/)([^\s]+)/gim;
  let m: RegExpExecArray | null;
  while ((m = re.exec(patch)) !== null) {
    const p = m[1].replace(/^b\//, "").replace(/^a\//, "").trim();
    if (p && p !== "/dev/null") out.add(p);
  }
  return [...out];
}

/** Files targeted by a read/edit shell command (best-effort). */
function filesFromCommand(cmd: string): string[] {
  const paths = new Set<string>();
  for (const p of extractFilePaths(cmd)) paths.add(p);
  if (paths.size === 0) {
    // bare filenames like "package.json" without a directory
    let m: RegExpExecArray | null;
    BARE_FILE_RE.lastIndex = 0;
    while ((m = BARE_FILE_RE.exec(cmd)) !== null) {
      if (!/^(https?|www)\b/.test(m[1])) paths.add(m[1]);
    }
  }
  return [...paths];
}

/**
 * Determine the file operation for an edit-classified command.
 * `rm`/`del` → delete, `touch`/`mkdir`/`cp` new target → create, else edit.
 */
function editOpForCommand(cmd: string): FileOp {
  if (/(?:^|\s)(rm|del|unlink)\s+/i.test(cmd)) return "delete";
  if (/(?:^|\s)(touch|mkdir)\s+/i.test(cmd)) return "create";
  return "edit";
}

/** True when this raw event is a unified custom_tool_call ({name,input}). */
function isCustomToolCall(raw: RawEvent): boolean {
  return raw.payloadType === "custom_tool_call" && typeof (raw.data as Record<string, unknown> | undefined)?.input === "string";
}

/** Significance rank of a git subcommand (a real commit/push outranks a
 *  leading `add`/`status` in a chained command line). */
const GIT_SUB_RANK: Record<string, number> = {
  commit: 6, push: 5, pull: 5, add: 4, reset: 4, restore: 4,
  switch: 3, checkout: 3, branch: 3, stash: 2, diff: 1,
  status: 0, log: 0, show: 0, fetch: 3,
};
/** The most significant git subcommand across a (possibly chained) command. */
function dominantGitSub(cmd: string): string | undefined {
  const re = /git\s+(\w+)/gi;
  let m: RegExpExecArray | null;
  let best: string | undefined;
  let bestRank = -1;
  while ((m = re.exec(cmd)) !== null) {
    const sub = m[1].toLowerCase();
    const rank = GIT_SUB_RANK[sub] ?? 1;
    if (rank > bestRank) { bestRank = rank; best = sub; }
  }
  return best;
}

/** The tool call_id from a payload (custom_tool_call / *_output), if present. */
function callIdOf(payload: Record<string, unknown>): string | undefined {
  const id = payload.call_id ?? payload.callId ?? payload.id;
  return typeof id === "string" && id.trim() ? id : undefined;
}

/**
 * Resolve a command string for a work event, accounting for the unified
 * custom_tool_call `input` (string) in addition to the legacy args/command
 * shapes handled by commandOf(). Returns undefined for apply_patch-style input.
 */
function cmdOfEvent(raw: RawEvent, payload: Record<string, unknown>): string | undefined {
  if (isCustomToolCall(raw)) {
    const input = String(payload.input ?? "");
    if (looksLikePatch(input)) return undefined; // patch → handled as files, not a command
    return customToolCommandOf(input);
  }
  return commandOf(payload);
}

/**
 * Files for a FILE_EDIT event, accounting for custom_tool_call apply_patch
 * input (patch body) as well as legacy tool args / edit commands.
 */
function editFilesOf(raw: RawEvent, payload: Record<string, unknown>, cmd: string | undefined): string[] {
  if (isCustomToolCall(raw)) {
    const input = String(payload.input ?? "");
    if (looksLikePatch(input)) return extractPatchPaths(input);
    return cmd ? filesFromCommand(cmd) : [];
  }
  return cmd ? filesFromCommand(cmd) : filesFromToolArgs(payload);
}

/**
 * Stateful streaming normalizer — memory-bounded and classification-driven.
 * Emits NormalizedEvents via a callback; the only cross-event state is a
 * reference to the most recent test_run so its result output can flip pass/fail.
 */
export class StreamingNormalizer {
  private emit: (n: NormalizedEvent) => void;
  private pendingTest: NormalizedEvent | undefined;
  /** Recently-emitted work events keyed by tool call_id, so a later
   *  custom_tool_call_output can flip its paired call's pass/fail. Bounded. */
  private byCallId = new Map<string, NormalizedEvent>();
  private static CALLID_CAP = 256;
  /** Signature ("kind|command|firstFile") + epoch of the last emitted command
   *  work event, to drop a duplicate representation of the SAME execution that
   *  appears both as a custom_tool_call and an item_completed/CommandExecution. */
  private lastWorkSig = "";
  private lastWorkTs = 0;
  private static DUP_WORK_WINDOW_MS = 2_000;

  constructor(emit: (n: NormalizedEvent) => void) {
    this.emit = emit;
  }

  /** Emit a work event and, if it carries a call_id, track it (bounded map)
   *  so a later custom_tool_call_output can flip its pass/fail. Also drops a
   *  duplicate representation of the SAME execution (custom_tool_call AND
   *  item_completed/CommandExecution) by (kind|command|firstFile) + near time. */
  private emitTracked(n: NormalizedEvent): void {
    const sig = `${n.kind}|${(n.command ?? "").trim()}|${(n.files && n.files[0]) ?? ""}`;
    // Only dedup when there is a real command/file signature (not empty).
    if ((n.command || (n.files && n.files.length)) &&
        sig === this.lastWorkSig &&
        this.lastWorkTs > 0 && Math.abs(n.tsEpoch - this.lastWorkTs) <= StreamingNormalizer.DUP_WORK_WINDOW_MS) {
      // Same execution seen twice (two serializations) — keep the first only.
      return;
    }
    this.lastWorkSig = sig;
    this.lastWorkTs = n.tsEpoch;
    if (n.callId) {
      if (this.byCallId.size >= StreamingNormalizer.CALLID_CAP) {
        const first = this.byCallId.keys().next().value;
        if (first !== undefined) this.byCallId.delete(first);
      }
      this.byCallId.set(n.callId, n);
    }
    this.emit(n);
  }

  /** Find the previously-emitted work event a result payload belongs to,
   *  correlating by the shared tool call_id. */
  private pairedByCallId(payload: Record<string, unknown>): NormalizedEvent | undefined {
    const id = callIdOf(payload);
    return id ? this.byCallId.get(id) : undefined;
  }

  push(raw: RawEvent): void {
    const { cls, noise } = classifyRawEvent(raw);
    if (noise) return; // infrastructure noise never becomes work

    const ts = raw.ts ?? "";
    const sessionId = raw.sessionId;
    const cwd = raw.cwd;
    // For modern event_msg/item_completed events this returns the nested item's
    // fields surfaced at the top level, so every extractor below (commandOf /
    // messageTextOf / execOutputOf / filesFromToolArgs) works unchanged. For all
    // other events it is exactly raw.data.
    const payload = workPayloadOf(raw);
    const base = { sessionId, ts, tsEpoch: toEpoch(ts), cwd, rawEventSeq: raw.seq };

    switch (cls) {
      case "USER_INTENT": {
        const text =
          raw.rootType === "generic"
            ? String((payload as { text?: string }).text ?? "")
            : messageTextOf(payload);
        if (!text.trim()) return;
        this.emit({ ...base, kind: "user_request", text });
        return;
      }
      case "ASSISTANT_SUMMARY": {
        const text = messageTextOf(payload) || String(payload.text ?? "");
        if (!text.trim()) return;
        // File paths named in prose are MENTIONS only — never work evidence.
        this.emit({ ...base, kind: "assistant_action", text, files: extractFilePaths(text), fileOp: "mention" });
        return;
      }
      case "FILE_EDIT": {
        // Modern FileChange TurnItem: structured {path, kind} changes. Emit one
        // file_edit per change-op group so create/edit/delete are distinguished.
        const changes = fileChangesOf(payload);
        if (changes.length) {
          for (const op of ["create", "edit", "delete"] as FileOp[]) {
            const files = changes.filter((c) => c.op === op).map((c) => c.path);
            if (files.length) this.emit({ ...base, kind: "file_edit", files, fileOp: op });
          }
          return;
        }
        // Legacy tool/command OR unified custom_tool_call apply_patch input.
        const cmd = cmdOfEvent(raw, payload);
        const files = editFilesOf(raw, payload, cmd);
        const fileOp = cmd ? editOpForCommand(cmd) : "edit";
        this.emitTracked({ ...base, kind: "file_edit", command: cmd, files, fileOp, callId: callIdOf(payload) });
        return;
      }
      case "FILE_READ": {
        const cmd = cmdOfEvent(raw, payload);
        const files = cmd ? filesFromCommand(cmd) : filesFromToolArgs(payload);
        this.emitTracked({ ...base, kind: "file_read", command: cmd, files, fileOp: "read", callId: callIdOf(payload) });
        return;
      }
      case "TEST_RUN": {
        const cmd = cmdOfEvent(raw, payload);
        const norm: NormalizedEvent = { ...base, kind: "test_run", command: cmd, files: cmd ? filesFromCommand(cmd) : [], callId: callIdOf(payload) };
        this.pendingTest = norm;
        this.emitTracked(norm);
        return;
      }
      case "GIT_EVENT": {
        // From a git command or an imported git_commit.
        if (raw.rootType === "git") {
          const commit = payload as { message?: string; files?: string[] };
          this.emit({ ...base, kind: "git_op", gitOp: "commit", text: commit.message, files: Array.isArray(commit.files) ? commit.files : [] });
        } else {
          const cmd = cmdOfEvent(raw, payload) ?? "";
          // A shell line may CHAIN several git subcommands (e.g.
          // "git add -A && git commit -m …"). Record the most significant one
          // so a real commit is never lost behind a leading "git add".
          const op = dominantGitSub(cmd);
          this.emitTracked({ ...base, kind: "git_op", gitOp: op, command: cmd, files: filesFromCommand(cmd), callId: callIdOf(payload) });
        }
        return;
      }
      case "COMMAND": {
        const cmd = cmdOfEvent(raw, payload) ?? String(payload.action ?? "");
        // A named custom_tool_call is real tool execution even when we can't
        // recover a literal command string — record it as work evidence.
        const isTool = isCustomToolCall(raw);
        if (!cmd && !isTool) return;
        this.emitTracked({ ...base, kind: "shell_command", command: cmd || undefined, files: [], callId: callIdOf(payload) });
        return;
      }
      case "TEST_RESULT": {
        const output = execOutputOf(payload);
        const passed = PASS_RE.test(output) && !FAIL_RE.test(output) ? true
          : FAIL_RE.test(output) ? false : undefined;
        // Prefer correlating by call_id (custom_tool_call_output → its call).
        const paired = this.pairedByCallId(payload);
        if (paired) {
          if (passed !== undefined) paired.passed = passed;
        } else if (this.pendingTest) {
          if (passed !== undefined) this.pendingTest.passed = passed;
          this.pendingTest = undefined;
        }
        return; // a result flips its command/test; never a standalone activity
      }
      case "ERROR": {
        const output = execOutputOf(payload);
        // If this output correlates to a known tool call, mark that call failed
        // instead of emitting a free-floating error (keeps evidence attached).
        const paired = this.pairedByCallId(payload);
        if (paired) { paired.passed = false; return; }
        this.emit({ ...base, kind: "error", text: firstLine(output) });
        return;
      }
      case "COMMAND_RESULT": {
        // Output of a command. Not a standalone activity, but when it correlates
        // to a tool call by call_id it can still carry a pass/fail signal.
        const output = execOutputOf(payload);
        const paired = this.pairedByCallId(payload);
        if (paired) {
          if (PASS_RE.test(output) && !FAIL_RE.test(output)) paired.passed = true;
          else if (FAIL_RE.test(output)) paired.passed = false;
        }
        return;
      }
      default:
        return; // SYSTEM_CONTEXT/SESSION_METADATA/TOOL_METADATA/NOISE/UNKNOWN
    }
  }
}

/** Batch API: normalize a whole array. Thin wrapper over StreamingNormalizer. */
export function normalizeEvents(events: RawEvent[]): NormalizedEvent[] {
  const out: NormalizedEvent[] = [];
  const n = new StreamingNormalizer((ne) => out.push(ne));
  for (const ev of events) n.push(ev);
  return out;
}

function firstLine(s: string): string {
  const line = s.split(/\r?\n/).find((l) => l.trim());
  return (line ?? s).slice(0, 240);
}
