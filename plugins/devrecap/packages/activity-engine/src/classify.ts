/**
 * Event classification layer (Activity Extraction V2).
 *
 * Before any activity is built, every RawEvent is classified into a small,
 * meaning-bearing vocabulary. The single most important job here is to separate
 * genuine developer-work evidence from Codex/session INFRASTRUCTURE NOISE so
 * that things like `<environment_context>`, injected instructions, SKILL.md
 * loading, session bootstrap/resume, and model/token metadata NEVER become
 * user-facing activities.
 *
 * This module is pure and deterministic (no AI). It looks only at the content
 * of the imported document.
 */

import type { RawEvent } from "@devrecap/shared";
import { extractContentText } from "@devrecap/codex-parser";

/** The classified kind of a raw event. */
export type EventClass =
  | "USER_INTENT" // a genuine user task/request/question
  | "ASSISTANT_SUMMARY" // assistant prose describing what it did/found
  | "FILE_READ" // a file was read/inspected (grep/cat/read tool)
  | "FILE_EDIT" // a file was written/edited/created/deleted
  | "COMMAND" // a shell command that isn't a test/git/edit/read
  | "COMMAND_RESULT" // output of a command
  | "TEST_RUN" // a test command was executed
  | "TEST_RESULT" // pass/fail output of a test
  | "ERROR" // an error/failure signal in output
  | "GIT_EVENT" // a git operation (commit/push/etc.)
  | "SYSTEM_CONTEXT" // environment_context / system / developer / skill instructions
  | "SESSION_METADATA" // session_meta / resume / bootstrap
  | "TOOL_METADATA" // tool definitions, turn_context, token/model info
  | "NOISE" // empty / structural / non-work chatter
  | "UNKNOWN"; // unrecognized (preserved as evidence, not work)

/** Sub-operation for file events (only meaningful when class is FILE_*). */
export type FileOp = "read" | "edit" | "create" | "delete" | "mention";

export interface ClassifiedEvent {
  raw: RawEvent;
  cls: EventClass;
  /** True if this event must never contribute to a user-facing activity. */
  noise: boolean;
}

// ---------------------------------------------------------------------------
// Detection dictionaries
// ---------------------------------------------------------------------------

/** Tools that unambiguously WRITE/EDIT/CREATE files. */
const EDIT_TOOLS = new Set([
  "apply_patch", "str_replace", "edit_file", "write_file", "fs_write",
  "create_file", "fs_append", "update_file", "delete_file", "remove_file",
  "multi_edit", "patch",
]);

/** Tools that only READ/INSPECT files or the workspace. */
const READ_TOOLS = new Set([
  "read_file", "read", "cat", "view", "view_image", "open_file",
  "grep_search", "grep", "file_search", "glob", "list_directory", "ls",
  "codebase_search", "search",
]);

/**
 * XML-ish / bracketed tags that Codex injects for system/context/instructions.
 * When a "user"-role message is actually one of these, it is SYSTEM_CONTEXT.
 */
const CONTEXT_TAG_RE =
  /^\s*<(environment_context|environments_instructions|user_instructions|user_info|system|developer|instructions|tools?|persona|skills?|memory|context|agents?)\b/i;

/** Content signatures that indicate injected instructions / skill loading. */
const SYSTEM_CONTENT_RE =
  /(<environment_context>|<\/environment_context>|<user_instructions>|<user_info>|<current_date>|<cwd>|<sandbox|<approval_policy|<network_access|you are a coding agent|you are codex|# instructions\b|## skill\b|skill\.md|AGENTS\.md|system prompt|developer message)/i;

/** Session bootstrap / resume markers. */
const SESSION_BOOTSTRAP_RE =
  /^\s*(codex resume|resuming session|session resumed|<session_start|bootstrap|new session started)\b/i;

/** Test-command detection. */
const TEST_RE =
  /\b(npm|pnpm|yarn|bun)\s+(run\s+)?test|(?:^|\s)(vitest|jest|pytest|rspec|mocha|ava|tap)\b|php\s+artisan\s+test|go\s+test|cargo\s+test|mvn\s+test|gradle\s+test|dotnet\s+test|\bctest\b/i;
/** Git-command detection. */
const GIT_RE = /(?:^|\s|;|&&)git\s+(\w+)/i;
/** Read-ish shell commands. */
const READ_CMD_RE =
  /^(?:\s*)(cat|less|more|head|tail|grep|rg|ag|find|ls|tree|sed\s+-n|awk|bat|stat|file|wc|diff|git\s+(?:log|status|diff|show|blame))\b/i;
/** Edit-ish shell commands (write redirection, in-place sed, tee, patch, mkdir/rm/mv/cp of files). */
const EDIT_CMD_RE =
  /\b(apply_patch)\b|(?:^|\s)sed\s+-i\b|(?:^|\s)tee\s+|>\s*[^\s|&]+\.\w+|(?:^|\s)(?:rm|mv|cp|mkdir|touch|chmod|chown)\s+/i;
/** Error/failure signal in command output. */
const ERROR_RE =
  /\b(error|exception|traceback|cannot find|module not found|no such file|permission denied|fatal|panic|segfault|unhandled|failed to)\b/i;
/** Pass/fail signals for tests. */
export const PASS_RE = /\b(\d+\s+passed|all tests? pass(ed)?|tests? passed|\bok\b|✓|PASS\b|build succeeded|success)\b/i;
export const FAIL_RE = /\b(\d+\s+(failed|failing)|tests? failed|✗|FAIL\b|assertion|not ok|build failed)\b/i;

// ---------------------------------------------------------------------------
// Classification
// ---------------------------------------------------------------------------

/**
 * Extract the shell command string from a tool-call / exec payload.
 * Handles the real Codex shapes:
 *  - function_call `shell`:        arguments = {"command": ["bash","-lc","…"]}
 *  - function_call `exec_command`: arguments = {"cmd": "git status", "workdir": …}
 *  - exec_command_end (event_msg): payload.command = ["/bin/bash","-lc","…"]
 */
export function commandOf(payload: Record<string, unknown>): string | undefined {
  // exec_command_end / CommandExecution carry the command directly on the
  // payload (string, argv array, or {program, args}).
  if (payload.command !== undefined && payload.arguments === undefined) {
    const n = normalizeCmd(payload.command);
    if (n) return n;
  }
  // CommandExecution variants: {program, args:[…]} or {argv:[…]}.
  if (payload.arguments === undefined) {
    if (typeof payload.program === "string") {
      const args = Array.isArray(payload.args) ? payload.args.map(String).join(" ") : "";
      const joined = `${payload.program} ${args}`.trim();
      if (joined) return joined;
    }
    if (Array.isArray(payload.argv)) {
      const n = normalizeCmd(payload.argv);
      if (n) return n;
    }
  }
  const args = payload.arguments;
  let obj: Record<string, unknown> | undefined;
  if (typeof args === "string") {
    try { obj = JSON.parse(args) as Record<string, unknown>; }
    catch { return args.trim() || undefined; }
  } else if (args && typeof args === "object") {
    obj = args as Record<string, unknown>;
  }
  if (obj) {
    // `cmd` (exec_command) or `command` (shell) — accept either.
    const c = obj.cmd ?? obj.command;
    const n = normalizeCmd(c);
    if (n) return n;
  }
  return undefined;
}

function normalizeCmd(cmd: unknown): string | undefined {
  if (typeof cmd === "string") return cmd.trim() || undefined;
  if (Array.isArray(cmd)) {
    const parts = cmd.map((c) => String(c));
    const dashLc = parts.findIndex((p) => p === "-lc" || p === "-c");
    if (dashLc >= 0 && parts[dashLc + 1]) return parts[dashLc + 1].trim();
    return parts.join(" ").trim() || undefined;
  }
  return undefined;
}

/** Slash-commands and TUI actions that are session control, not real intent. */
const SLASH_OR_TUI_RE = /^\s*\/(?:resume|new|clear|compact|model|help|quit|exit|init|status|approvals|mcp|review|undo|redo|diff|mode|reasoning)\b/i;

/** Read the message text from either an event_msg (payload.message) or a
 *  response_item message (payload.content array/string). */
export function messageTextOf(payload: Record<string, unknown>): string {
  if (typeof payload.message === "string") return payload.message;
  return extractContentText(payload.content);
}

/** Read command output from an exec_command_end / function_call_output payload. */
export function execOutputOf(payload: Record<string, unknown>): string {
  for (const key of ["aggregated_output", "formatted_output", "output", "stdout"]) {
    const v = payload[key];
    if (typeof v === "string" && v.trim()) return v;
  }
  const stderr = payload.stderr;
  return typeof stderr === "string" ? stderr : "";
}

// ---------------------------------------------------------------------------
// Unified `custom_tool_call` (exec / apply_patch)  —  { name, input, call_id }
// ---------------------------------------------------------------------------
//
// Modern Codex uses a single `custom_tool_call` response_item whose payload is
// { type, call_id, name, input } where `input` is a STRING (not JSON args).
// For `exec` this can be freeform / code-mode input, NOT always a plain shell
// command; for `apply_patch` it is a patch body. We parse conservatively:
// recognize a shell command when we safely can, recognize a patch body, and
// otherwise treat the call as generic tool-execution work (never NOISE).

/** Names of the unified custom tools we understand. */
const APPLY_PATCH_NAMES = new Set(["apply_patch", "applypatch", "patch"]);
const EXEC_NAMES = new Set(["exec", "shell", "bash", "container.exec", "local_shell", "run"]);

/** True if a string looks like a unified/apply_patch patch envelope. */
export function looksLikePatch(input: string): boolean {
  return /\*\*\*\s+(?:Begin Patch|Add File|Update File|Delete File)\b/.test(input) ||
    /^(?:diff --git |--- a\/|\+\+\+ b\/)/m.test(input);
}

/**
 * Best-effort shell command from a custom_tool_call `input` string. `input` may
 * be a JSON object ({"command":[…]}/{"cmd":"…"}), a shell one-liner, or code.
 * Returns a command string only when we can recognize one; otherwise undefined.
 * NEVER executed — DATA ONLY.
 */
export function customToolCommandOf(input: string): string | undefined {
  const s = input.trim();
  if (!s) return undefined;
  // 1) JSON-encoded args, e.g. {"command":["bash","-lc","…"]} or {"cmd":"…"}.
  if (s.startsWith("{")) {
    try {
      const obj = JSON.parse(s) as Record<string, unknown>;
      const c = normalizeCmd(obj.cmd ?? obj.command ?? obj.argv);
      if (c) return c;
    } catch { /* not JSON — fall through */ }
  }
  // 2) A single-line shell-looking command (avoid treating big code blocks as a
  //    command: only accept short, single-logical-line inputs).
  const firstLine = s.split(/\r?\n/)[0].trim();
  const isShortOneLiner = !s.includes("\n") && s.length <= 400;
  const looksShell = /^[\w./-]+(\s|$)/.test(firstLine) &&
    !/^(import|from|def|class|function|const|let|var|public|private|package|#include)\b/.test(firstLine);
  if (isShortOneLiner && looksShell) return firstLine;
  return undefined;
}

// ---------------------------------------------------------------------------
// Modern Codex `event_msg/item_completed` TurnItems
// ---------------------------------------------------------------------------
//
// Newer Codex rollouts persist completed TurnItems inside:
//   { "type": "event_msg", "payload": { "type": "item_completed", "item": {…} } }
// where `item.type` is a TurnItem kind (CommandExecution, FileChange,
// UserMessage, AgentMessage, Reasoning, Plan, McpToolCall, …). The item's
// meaningful fields (command, output, message, changes) live on `item`, not on
// the outer payload — so we surface a normalized VIEW of the item that the
// existing extractors (commandOf/messageTextOf/execOutputOf/file readers)
// understand, and classify by the item kind.

/** Canonical TurnItem kind, tolerant of casing/serialization variants. */
export type ItemKind =
  | "command_execution" | "file_change" | "user_message" | "agent_message"
  | "reasoning" | "plan" | "mcp_tool_call" | "web_search" | "other";

/** The nested item object of an item_completed event, if present. */
export function itemOf(payload: Record<string, unknown>): Record<string, unknown> | undefined {
  const item = payload.item;
  if (item && typeof item === "object") return item as Record<string, unknown>;
  return undefined;
}

/** Normalize a nested item's `type` to a canonical, casing-insensitive kind. */
export function itemKindOf(item: Record<string, unknown> | undefined): ItemKind {
  const t = typeof item?.type === "string" ? item.type : "";
  // snake_case-fold: "CommandExecution"/"commandExecution"/"command_execution"
  const k = t.replace(/([a-z0-9])([A-Z])/g, "$1_$2").replace(/[-\s]+/g, "_").toLowerCase();
  switch (k) {
    case "command_execution": case "commandexecution": case "exec_command": case "local_shell_call":
      return "command_execution";
    case "file_change": case "filechange": case "patch": case "apply_patch": case "file_update":
      return "file_change";
    case "user_message": case "usermessage": case "user":
      return "user_message";
    case "agent_message": case "agentmessage": case "assistant_message": case "assistant":
      return "agent_message";
    case "reasoning": case "agent_reasoning":
      return "reasoning";
    case "plan": case "plan_update": case "todo": case "todo_list":
      return "plan";
    case "mcp_tool_call": case "mcptoolcall": case "tool_call": case "custom_tool_call":
      return "mcp_tool_call";
    case "web_search": case "web_search_call": case "websearch":
      return "web_search";
    default:
      return "other";
  }
}

/**
 * A raw shape key that, for item_completed, includes the nested item kind, e.g.
 * "event_msg/item_completed/command_execution". Everything else uses the base
 * "rootType/payloadType". Types only — never content.
 */
export function nestedShapeKeyOf(raw: RawEvent): string {
  const base = rawShapeKey(raw);
  if (raw.rootType === "event_msg" && raw.payloadType === "item_completed") {
    const item = itemOf((raw.data ?? {}) as Record<string, unknown>);
    return `${base}/${itemKindOf(item)}`;
  }
  return base;
}

/**
 * For an item_completed event, return a VIEW payload whose fields sit where the
 * existing extractors expect them (command/output/exit_code/message/content/
 * arguments), so commandOf/messageTextOf/execOutputOf/filesFrom* work unchanged.
 * For any other event this returns the payload as-is.
 */
export function workPayloadOf(raw: RawEvent): Record<string, unknown> {
  const payload = (raw.data ?? {}) as Record<string, unknown>;
  if (!(raw.rootType === "event_msg" && raw.payloadType === "item_completed")) return payload;
  const item = itemOf(payload);
  if (!item) return payload;
  const kind = itemKindOf(item);
  if (kind === "command_execution" || kind === "mcp_tool_call" || kind === "web_search") {
    // Surface command + output/exit fields onto a flat view.
    const view: Record<string, unknown> = { ...item };
    // Some serializations nest under item.command as {command|cmd|program|argv}.
    if (view.command === undefined && view.cmd !== undefined) view.command = view.cmd;
    if (view.aggregated_output === undefined && typeof item.output === "string") view.aggregated_output = item.output;
    return view;
  }
  if (kind === "file_change") {
    return { ...item };
  }
  if (kind === "user_message" || kind === "agent_message" || kind === "reasoning" || kind === "plan") {
    // message may be a plain string, or nested content parts.
    return { ...item };
  }
  return item;
}

/** A single file change extracted from a FileChange TurnItem. */
export interface FileChangeEntry { path: string; op: FileOp; }

/** Map a change-kind string to a FileOp (create/delete/edit). */
function fileOpOfKind(kind: unknown): FileOp {
  const k = String(kind ?? "").toLowerCase();
  if (/(add|create|new)/.test(k)) return "create";
  if (/(delete|remove|unlink)/.test(k)) return "delete";
  return "edit";
}

/**
 * Extract changed paths + operation from a FileChange item view. Handles:
 *   { path, kind }
 *   { changes: [ { path, kind }, … ] }
 *   { changes: { "a/b.ts": "modified", … } }
 *   { files: [ "a/b.ts", … ] }
 * Paths are treated as DATA ONLY — never opened.
 */
export function fileChangesOf(payload: Record<string, unknown>): FileChangeEntry[] {
  const out: FileChangeEntry[] = [];
  const push = (p: unknown, kind?: unknown) => {
    if (typeof p === "string" && p.trim()) out.push({ path: p.trim(), op: fileOpOfKind(kind) });
  };
  if (typeof payload.path === "string") push(payload.path, payload.kind ?? payload.change_type ?? payload.status);
  const changes = payload.changes;
  if (Array.isArray(changes)) {
    for (const c of changes) {
      if (c && typeof c === "object") {
        const o = c as Record<string, unknown>;
        push(o.path ?? o.file ?? o.filename ?? o.target, o.kind ?? o.change_type ?? o.status ?? o.op);
      } else if (typeof c === "string") {
        push(c);
      }
    }
  } else if (changes && typeof changes === "object") {
    for (const [p, kind] of Object.entries(changes as Record<string, unknown>)) push(p, kind);
  }
  const files = payload.files;
  if (Array.isArray(files)) for (const f of files) push(f);
  return out;
}

/** Does a user-role message look like injected system/context noise? */
export function isSystemContextText(text: string): boolean {
  if (!text) return true; // empty user turn → noise
  if (SLASH_OR_TUI_RE.test(text)) return true; // /resume, /new, /clear, …
  if (CONTEXT_TAG_RE.test(text)) return true;
  if (SYSTEM_CONTENT_RE.test(text)) return true;
  if (SESSION_BOOTSTRAP_RE.test(text)) return true;
  return false;
}

/** Classify a single RawEvent. */
export function classifyRawEvent(raw: RawEvent): ClassifiedEvent {
  const payload = (raw.data ?? {}) as Record<string, unknown>;

  // --- session / tool metadata (root types) ---
  if (raw.rootType === "session_meta") return mk(raw, "SESSION_METADATA", true);
  if (raw.rootType === "turn_context") return mk(raw, "TOOL_METADATA", true);
  if (raw.rootType === "compacted") return mk(raw, "NOISE", true);

  // --- event_msg: NOT all noise. Real rollouts carry user & agent messages and
  //     command results here, alongside token/task metadata. ---
  if (raw.rootType === "event_msg") {
    const pt = raw.payloadType;
    if (pt === "user_message") {
      const text = messageTextOf(payload);
      if (isSystemContextText(text)) return mk(raw, "SYSTEM_CONTEXT", true);
      return mk(raw, "USER_INTENT", false);
    }
    if (pt === "agent_message" || pt === "agent_reasoning" || pt === "agent_reasoning_delta") {
      const text = messageTextOf(payload);
      return text.trim() ? mk(raw, "ASSISTANT_SUMMARY", false) : mk(raw, "NOISE", true);
    }
    // --- MODERN Codex: a completed TurnItem is nested under payload.item. ---
    // Classify by the nested item kind, not the outer "item_completed" wrapper.
    if (pt === "item_completed" || pt === "item_updated") {
      return classifyCompletedItem(raw, payload);
    }
    if (pt === "exec_command_end" || pt === "exec_command_output" || pt === "patch_apply_end") {
      // A command finished — classify by its result (test/error/plain).
      const output = execOutputOf(payload);
      const exit = typeof payload.exit_code === "number" ? payload.exit_code : undefined;
      if (FAIL_RE.test(output) || (exit !== undefined && exit !== 0 && ERROR_RE.test(output))) return mk(raw, "TEST_RESULT", false);
      if (PASS_RE.test(output)) return mk(raw, "TEST_RESULT", false);
      if (ERROR_RE.test(output) || (exit !== undefined && exit !== 0)) return mk(raw, "ERROR", false);
      return mk(raw, "COMMAND_RESULT", false);
    }
    if (pt === "exec_command_begin" || pt === "patch_apply_begin") {
      // Beginnings are paired with their _end; keep as low-value command markers.
      return mk(raw, "COMMAND", false);
    }
    // --- turn / session lifecycle: never a standalone activity ---
    // task_started / turn_started / thread_settings_applied are pure session
    // bootstrap/lifecycle → SESSION_METADATA noise.
    if (pt === "task_started" || pt === "turn_started" || pt === "thread_settings_applied") {
      return mk(raw, "SESSION_METADATA", true);
    }
    // turn_complete / task_complete are lifecycle/outcome markers — evidence of
    // an ending, not work in themselves. Kept as metadata noise (the activity's
    // status is decided from real work + assistant summaries, not this marker).
    if (pt === "turn_complete" || pt === "task_complete") {
      return mk(raw, "TOOL_METADATA", true);
    }
    // turn_aborted is a real failure/interruption signal. When it carries a
    // reason/message it is useful ERROR evidence for the surrounding task;
    // otherwise it is a bare lifecycle marker (noise).
    if (pt === "turn_aborted") {
      const reason = messageTextOf(payload) ||
        (typeof payload.reason === "string" ? payload.reason : "");
      return reason.trim() ? mk(raw, "ERROR", false) : mk(raw, "TOOL_METADATA", true);
    }
    // token_count, turn_diff, notification, model/usage metadata, and any other
    // event_msg variant: defensively treated as metadata noise. Unknown
    // event_msg types NEVER become work activities on their own.
    return mk(raw, "TOOL_METADATA", true);
  }

  // --- messages ---
  if (raw.rootType === "response_item" && raw.payloadType === "message") {
    const role = raw.role;
    const text = extractContentText(payload.content);
    if (role === "system" || role === "developer") return mk(raw, "SYSTEM_CONTEXT", true);
    if (role === "user") {
      if (isSystemContextText(text)) return mk(raw, "SYSTEM_CONTEXT", true);
      return mk(raw, "USER_INTENT", false);
    }
    // assistant (or tool) prose
    if (!text.trim()) return mk(raw, "NOISE", true);
    return mk(raw, "ASSISTANT_SUMMARY", false);
  }

  // --- reasoning summaries: kept as evidence but not work-bearing prose ---
  if (raw.rootType === "response_item" && raw.payloadType === "reasoning") {
    return mk(raw, "ASSISTANT_SUMMARY", false);
  }

  // --- function/tool calls ---
  if (
    raw.rootType === "response_item" &&
    (raw.payloadType === "function_call" ||
      raw.payloadType === "local_shell_call" ||
      raw.payloadType === "custom_tool_call")
  ) {
    const name = raw.toolName ?? "";
    if (EDIT_TOOLS.has(name)) return mk(raw, "FILE_EDIT", false);
    if (READ_TOOLS.has(name)) return mk(raw, "FILE_READ", false);

    // Unified custom_tool_call: payload = { name, input:string, call_id }.
    // `arguments` is absent, so commandOf() alone would drop it as NOISE.
    if (raw.payloadType === "custom_tool_call" && typeof payload.input === "string") {
      const input = payload.input;
      const lname = name.toLowerCase();
      // apply_patch tool (or a patch-looking body) is strong FILE_EDIT evidence.
      if (APPLY_PATCH_NAMES.has(lname) || looksLikePatch(input)) return mk(raw, "FILE_EDIT", false);
      // exec/shell: recognize a shell command conservatively; else it is still
      // real tool execution (COMMAND) — never NOISE.
      if (EXEC_NAMES.has(lname)) {
        const cmd = customToolCommandOf(input);
        if (cmd) {
          if (GIT_RE.test(cmd) && !READ_CMD_RE.test(cmd)) return mk(raw, "GIT_EVENT", false);
          if (TEST_RE.test(cmd)) return mk(raw, "TEST_RUN", false);
          if (EDIT_CMD_RE.test(cmd)) return mk(raw, "FILE_EDIT", false);
          if (READ_CMD_RE.test(cmd)) return mk(raw, "FILE_READ", false);
        }
        return mk(raw, "COMMAND", false);
      }
      // Any other named custom tool with input is tool-execution work.
      return mk(raw, "COMMAND", false);
    }

    const cmd = commandOf(payload) ?? "";
    if (!cmd) return mk(raw, "NOISE", true);
    if (GIT_RE.test(cmd) && !READ_CMD_RE.test(cmd)) return mk(raw, "GIT_EVENT", false);
    if (TEST_RE.test(cmd)) return mk(raw, "TEST_RUN", false);
    if (EDIT_CMD_RE.test(cmd)) return mk(raw, "FILE_EDIT", false);
    if (READ_CMD_RE.test(cmd)) return mk(raw, "FILE_READ", false);
    return mk(raw, "COMMAND", false);
  }

  // --- command / tool output ---
  if (
    raw.rootType === "response_item" &&
    (raw.payloadType === "function_call_output" ||
      raw.payloadType === "custom_tool_call_output")
  ) {
    const output = execOutputOf(payload);
    if (FAIL_RE.test(output)) return mk(raw, "TEST_RESULT", false);
    if (PASS_RE.test(output)) return mk(raw, "TEST_RESULT", false);
    if (ERROR_RE.test(output)) return mk(raw, "ERROR", false);
    return mk(raw, "COMMAND_RESULT", false);
  }

  // --- other response_item payload types (web_search_call, ghost_snapshot…) ---
  if (raw.rootType === "response_item") {
    if (raw.payloadType === "web_search_call") return mk(raw, "COMMAND", false);
    if (raw.payloadType === "ghost_snapshot") return mk(raw, "GIT_EVENT", true); // internal snapshot
    return mk(raw, "UNKNOWN", true);
  }

  // --- imported git-log events (from GitLogAdapter) ---
  if (raw.rootType === "git" && raw.payloadType === "git_commit") {
    return mk(raw, "GIT_EVENT", false);
  }

  // --- generic imported text ---
  if (raw.rootType === "generic" && raw.payloadType === "note") {
    const text = typeof payload.text === "string" ? payload.text : "";
    return mk(raw, text.trim() ? "USER_INTENT" : "NOISE", !text.trim());
  }

  return mk(raw, "UNKNOWN", true);
}

/**
 * Classify a modern `event_msg/item_completed` event by its nested TurnItem.
 * Reuses the SAME command/message semantics as function_call / message events.
 * Not every completed item is work — Reasoning/Plan are low-value, and unknown
 * item kinds stay noise so we never revert to "event = activity".
 */
function classifyCompletedItem(raw: RawEvent, payload: Record<string, unknown>): ClassifiedEvent {
  const item = itemOf(payload);
  if (!item) return mk(raw, "TOOL_METADATA", true); // malformed / empty wrapper
  const kind = itemKindOf(item);
  const view = workPayloadOf(raw); // fields surfaced at top level

  switch (kind) {
    case "user_message": {
      const text = messageTextOf(view);
      if (isSystemContextText(text)) return mk(raw, "SYSTEM_CONTEXT", true);
      return mk(raw, "USER_INTENT", false);
    }
    case "agent_message":
    case "reasoning": {
      const text = messageTextOf(view);
      return text.trim() ? mk(raw, "ASSISTANT_SUMMARY", false) : mk(raw, "NOISE", true);
    }
    case "file_change": {
      // Strong work evidence: a real file was created/edited/deleted.
      return fileChangesOf(view).length ? mk(raw, "FILE_EDIT", false) : mk(raw, "TOOL_METADATA", true);
    }
    case "command_execution":
    case "mcp_tool_call": {
      const cmd = commandOf(view) ?? "";
      const output = execOutputOf(view);
      const exit = typeof view.exit_code === "number" ? view.exit_code
        : typeof view.status === "string" && /fail|error/i.test(view.status) ? 1 : undefined;
      // Prefer the command's own semantics; fall back to output signals.
      if (cmd) {
        if (GIT_RE.test(cmd) && !READ_CMD_RE.test(cmd)) return mk(raw, "GIT_EVENT", false);
        if (TEST_RE.test(cmd)) {
          // A completed test carries its own result; route to TEST_RESULT so the
          // normalizer can read pass/fail (it also emits the run).
          return mk(raw, "TEST_RESULT", false);
        }
        if (EDIT_CMD_RE.test(cmd)) return mk(raw, "FILE_EDIT", false);
        if (READ_CMD_RE.test(cmd)) return mk(raw, "FILE_READ", false);
        // generic command: surface failures as error evidence.
        if (FAIL_RE.test(output) || (exit !== undefined && exit !== 0)) return mk(raw, "ERROR", false);
        return mk(raw, "COMMAND", false);
      }
      // No command string — classify by output only.
      if (FAIL_RE.test(output) || PASS_RE.test(output)) return mk(raw, "TEST_RESULT", false);
      if (ERROR_RE.test(output) || (exit !== undefined && exit !== 0)) return mk(raw, "ERROR", false);
      return output.trim() ? mk(raw, "COMMAND_RESULT", false) : mk(raw, "TOOL_METADATA", true);
    }
    case "web_search":
      return mk(raw, "COMMAND", false);
    case "plan":
      // A plan/todo update is process metadata, not a standalone activity.
      return mk(raw, "TOOL_METADATA", true);
    default:
      // Unknown TurnItem kind — preserved as evidence, never work on its own.
      return mk(raw, "TOOL_METADATA", true);
  }
}

function mk(raw: RawEvent, cls: EventClass, noise: boolean): ClassifiedEvent {
  return { raw, cls, noise };
}

/** A safe raw-shape key for diagnostics — "rootType/payloadType" (no content). */
export function rawShapeKey(raw: RawEvent): string {
  return raw.payloadType ? `${raw.rootType}/${raw.payloadType}` : raw.rootType;
}

/**
 * A sanitized SHAPE descriptor for a raw event — types only, never content,
 * commands, prompts, or secrets. For schema debugging.
 */
export function sampleShapeOf(raw: RawEvent): {
  rootType: string; payloadType?: string; itemType?: string; toolName?: string; contentTypes?: string[];
} {
  const payload = (raw.data ?? {}) as Record<string, unknown>;
  let contentTypes: string[] | undefined;
  if (Array.isArray(payload.content)) {
    const set = new Set<string>();
    for (const item of payload.content) {
      if (item && typeof item === "object" && typeof (item as { type?: string }).type === "string") {
        set.add((item as { type: string }).type);
      }
    }
    contentTypes = [...set];
  }
  // For modern item_completed events, surface the canonical nested item kind
  // (types only — never the item's content/command/message).
  let itemType: string | undefined;
  if (raw.rootType === "event_msg" && (raw.payloadType === "item_completed" || raw.payloadType === "item_updated")) {
    itemType = itemKindOf(itemOf(payload));
  }
  return { rootType: raw.rootType, payloadType: raw.payloadType, itemType, toolName: raw.toolName, contentTypes };
}
