// The single entry every Codex hook invokes, with the event name as argv[2]
// and the hook JSON on stdin. Must never throw to the IDE: the CLI bootstrap
// below always exits 0. Everything vendor-specific lives here as one Dialect
// table; runHook (hook-core.ts) owns the shared engine.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import { runHook } from "./hook-core.js";
import { DEFAULT_BASE_URL } from "./connect.js";
import { codexHome, promotePendingConfig } from "./codex-connect.js";
function stringField(payload, key) {
    const value = payload[key];
    return typeof value === "string" && value !== "" ? value : null;
}
const CONNECT_COMMAND = /^(?:\/|\$)trinity-connect(?:\s|$)/;
function suppressedSessionFile(dataDir, sessionId) {
    return join(dataDir, "suppressed-sessions", `codex-${encodeURIComponent(sessionId)}`);
}
function suppressConnectSession(dataDir, event, payload) {
    const sessionId = stringField(payload, "session_id");
    const prompt = stringField(payload, "prompt");
    if (event === "UserPromptSubmit" && prompt !== null && CONNECT_COMMAND.test(prompt.trimStart())) {
        if (sessionId !== null) {
            const file = suppressedSessionFile(dataDir, sessionId);
            try {
                mkdirSync(dirname(file), { recursive: true, mode: 0o700 });
                writeFileSync(file, "", { mode: 0o600 });
            }
            catch (error) {
                if (!(error instanceof Error))
                    throw error;
            }
        }
        return true;
    }
    if (sessionId === null)
        return false;
    try {
        readFileSync(suppressedSessionFile(dataDir, sessionId));
        return true;
    }
    catch (error) {
        if (error instanceof Error)
            return false;
        throw error;
    }
}
// What leaves the machine is an ALLOWLIST, never a strip list (see
// claude-hook.ts's own comment for the rationale). Every key below was
// observed on a real captured hook stream (codex-cli 0.149.0-alpha.4.3,
// test/testdata/codex_session.jsonl). Neither tool-body field the vendor
// carries (tool_input on PreToolUse/PostToolUse, tool_response on
// PostToolUse) is ever forwarded, under any event.
const ALLOW_EVERY_EVENT = ["hook_event_name", "session_id", "turn_id", "permission_mode"];
const ALLOW_PER_EVENT = {
    SessionStart: ["source", "model"],
    // The prompt text and the assistant reply are the capture contract (spec
    // §4.4): forwarded whole, exactly like claude_code's.
    UserPromptSubmit: ["prompt"],
    PreToolUse: ["tool_name", "tool_use_id"],
    PostToolUse: ["tool_name", "tool_use_id"],
    Stop: ["stop_hook_active", "last_assistant_message"],
    SessionEnd: ["reason"],
};
export const codexDialect = {
    tool: "codex",
    sessionId: (_event, payload) => stringField(payload, "session_id"),
    cwd: (_event, payload) => stringField(payload, "cwd"),
    // The observed correlation field (C2.0): a turn-scoped event's own
    // turn_id, never a turn IDENTITY — hook-core mints the actual turn key,
    // correlated by this vendor id.
    vendorTurnId: (_event, payload) => stringField(payload, "turn_id"),
    isPromptSubmit: (event) => event === "UserPromptSubmit",
    isSessionStart: (event) => event === "SessionStart",
    drainsOn: (event) => event === "Stop" || event === "SessionEnd",
    suppress: suppressConnectSession,
    allow: (event) => [...ALLOW_EVERY_EVENT, ...(ALLOW_PER_EVENT[event] ?? [])],
    drainInline: true,
    // The proven official env var (C2.0) for hook COMMANDS. TRINITY_CAPTURE_DATA
    // overrides it for the documented fallback (an installer-managed
    // user-level hooks stanza outside the plugin layer, README's "Fallback"
    // section) where PLUGIN_DATA may not exist at all.
    dataDir: (env) => env.TRINITY_CAPTURE_DATA ?? env.PLUGIN_DATA ?? null,
};
async function cli() {
    const eventName = process.argv[2];
    if (!eventName)
        return;
    const stdin = readFileSync(0, "utf8");
    // The connect skill's shell command has no PLUGIN_DATA (C2.0); this hook
    // COMMAND does, so it's the one that promotes a pending pairing on its
    // way through — cheap when nothing is pending, and best-effort: a
    // promotion failure must never surface to the IDE.
    if (eventName === "PostToolUse") {
        try {
            const dataDir = codexDialect.dataDir(process.env);
            if (dataDir) {
                await promotePendingConfig(codexHome(process.env), dataDir, process.env.TRINITY_BASE_URL ?? DEFAULT_BASE_URL);
            }
        }
        catch (error) {
            if (!(error instanceof Error))
                throw error;
        }
    }
    await runHook(codexDialect, eventName, stdin, process.env);
}
const isMainModule = process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMainModule) {
    cli()
        .catch(() => { })
        .finally(() => process.exit(0));
}
