#!/usr/bin/env node

import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { readFile, realpath } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

async function readStandardInput() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString("utf8");
}

function authorizationPath(projectKey) {
  const directory =
    process.env.AI_HOOTER_AUTH_DIR ??
    path.join(
      homedir(),
      "Library",
      "Application Support",
      "AI Hooter",
      "armed-projects",
    );
  return path.join(directory, `${projectKey}.json`);
}

async function projectKey(cwdValue) {
  const rawCwd = String(cwdValue ?? "").trim();
  if (!rawCwd) return null;

  let canonicalCwd;
  try {
    canonicalCwd = await realpath(rawCwd);
  } catch {
    canonicalCwd = path.resolve(rawCwd);
  }

  let identity = canonicalCwd;
  try {
    const { stdout } = await execFileAsync(
      "git",
      [
        "-C",
        canonicalCwd,
        "rev-parse",
        "--path-format=absolute",
        "--git-common-dir",
      ],
      { timeout: 1_000, windowsHide: true },
    );
    const commonDirectory = stdout.trim();
    if (commonDirectory) {
      identity = path.isAbsolute(commonDirectory)
        ? commonDirectory
        : path.resolve(canonicalCwd, commonDirectory);
    }
  } catch {
    // Non-Git projects use their canonical working directory as identity.
  }

  return createHash("sha256").update(identity).digest("hex");
}

async function main() {
  let input;
  try {
    input = JSON.parse(await readStandardInput());
  } catch {
    return;
  }

  const currentProjectKey = await projectKey(input.cwd);
  if (!currentProjectKey) return;

  try {
    const authorization = JSON.parse(
      await readFile(authorizationPath(currentProjectKey), "utf8"),
    );
    if (authorization.armed !== true) return;
  } catch {
    return;
  }

  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "SessionStart",
        additionalContext:
          "AI Hooter project authorization: The user explicitly granted persistent permission to use AI Hooter when genuine human attention is needed in this project. Treat this task as armed without asking again. Use the bundled helper exactly as described in the ai-hooter skill. Run every helper command that contacts the Mac app with Mac-local or localhost access on the first attempt; do not first try it inside the restricted task sandbox. If a prior hoot ID is remembered when the user returns, acknowledge that exact ID with Mac-local access as the first tool action before commentary, analysis, planning, other tools, edits, tests, or a response. Hoot at the attention boundary, never while autonomous work remains: finish all edits, commands, tests, and verification first; make the hoot the final tool action; then immediately send the completed response or fully prepared request. Do not hoot for routine progress, do not repeat the same condition, never include sensitive data in a summary, and never carry this authorization into another project.",
      },
    }),
  );
}

main().catch(() => {});
