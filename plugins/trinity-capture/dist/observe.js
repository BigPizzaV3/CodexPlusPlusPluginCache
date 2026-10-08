// Deterministic Git metadata the server can never inspect directly (spec
// §4.2): bounded, local, no network I/O.
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { realpathSync } from "node:fs";
import { relative } from "node:path";
const MAX_CHANGED_FILES = 200;
function git(cwd, args) {
    try {
        return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
    }
    catch {
        return null;
    }
}
export function gitRemoteOf(cwd) {
    return git(cwd, ["remote", "get-url", "origin"]);
}
export function repoRelativeCwd(cwd) {
    const top = git(cwd, ["rev-parse", "--show-toplevel"]);
    if (!top)
        return "";
    // git resolves symlinks in --show-toplevel; match that so a cwd reached
    // through a symlinked path (e.g. macOS's /var -> /private/var) still
    // resolves to "." instead of a spurious "../../..." chain.
    let resolvedCwd = cwd;
    try {
        resolvedCwd = realpathSync(cwd);
    }
    catch {
        resolvedCwd = cwd;
    }
    const rel = relative(top, resolvedCwd);
    return rel === "" ? "." : rel;
}
export function workspaceObserved(cwd) {
    const branch = git(cwd, ["rev-parse", "--abbrev-ref", "HEAD"]);
    if (branch === null)
        return null; // outside a repo
    const headSha = git(cwd, ["rev-parse", "HEAD"]);
    const statusOut = git(cwd, ["status", "--porcelain"]) ?? "";
    const changedFiles = statusOut === ""
        ? []
        : statusOut.split("\n").slice(0, MAX_CHANGED_FILES).map((line) => line.slice(3));
    const shortstat = git(cwd, ["diff", "--shortstat"]) ?? "";
    const addMatch = shortstat.match(/(\d+) insertion/);
    const delMatch = shortstat.match(/(\d+) deletion/);
    return {
        captureEventId: randomUUID(),
        tool: "claude_code",
        kind: "workspace.observed",
        externalSessionId: "",
        repo: "",
        repoCwd: "",
        occurredAt: new Date().toISOString(),
        payload: {
            branch,
            branches: [branch],
            head_sha: headSha,
            dirty: statusOut !== "",
            diffstat_add: addMatch ? Number(addMatch[1]) : 0,
            diffstat_del: delMatch ? Number(delMatch[1]) : 0,
            changed_files: changedFiles,
        },
    };
}
