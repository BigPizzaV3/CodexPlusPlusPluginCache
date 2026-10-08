#!/usr/bin/env node

import { createHash, randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import {
  mkdir,
  readFile,
  realpath,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const DEFAULT_PORT = 47831;
const EVENTS = new Set([
  "attention",
  "decision",
  "question",
  "access",
  "browser_handoff",
  "approval",
  "blocked",
  "security_critical",
  "review",
  "complete",
  "summary",
]);
const URGENCIES = new Set(["normal", "important", "critical"]);

class AIHooterRequestError extends Error {
  constructor(message, kind, { cause, status } = {}) {
    super(message);
    this.name = "AIHooterRequestError";
    this.kind = kind;
    if (cause !== undefined) this.cause = cause;
    if (status !== undefined) this.status = status;
  }
}

function appPort() {
  const candidate = Number.parseInt(process.env.AI_HOOTER_PORT ?? "", 10);
  return Number.isInteger(candidate) && candidate > 0 && candidate <= 65535
    ? candidate
    : DEFAULT_PORT;
}

function tokenPath() {
  return (
    process.env.AI_HOOTER_TOKEN_PATH ??
    path.join(
      homedir(),
      "Library",
      "Application Support",
      "AI Hooter",
      "Codex",
      "pairing-token",
    )
  );
}

function authorizationDirectory() {
  return (
    process.env.AI_HOOTER_AUTH_DIR ??
    path.join(
      homedir(),
      "Library",
      "Application Support",
      "AI Hooter",
      "armed-projects",
    )
  );
}

function parseOptions(values) {
  const options = {};
  for (let index = 0; index < values.length; index += 1) {
    const key = values[index];
    if (!key.startsWith("--")) throw new Error(`Unexpected argument: ${key}`);
    const value = values[index + 1];
    if (value === undefined || value.startsWith("--")) {
      throw new Error(`Missing value for ${key}`);
    }
    options[key.slice(2)] = value;
    index += 1;
  }
  return options;
}

function requireOption(options, name) {
  const value = String(options[name] ?? "").trim();
  if (!value) throw new Error(`Missing required option --${name}`);
  return value;
}

function visibleCharacterCount(value) {
  if (typeof Intl.Segmenter === "function") {
    const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });
    return Array.from(segmenter.segment(value)).length;
  }
  return Array.from(value).length;
}

async function projectKey(cwdValue) {
  let canonicalCwd;
  try {
    canonicalCwd = await realpath(cwdValue);
  } catch {
    canonicalCwd = path.resolve(cwdValue);
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

async function savePrivateFile(destination, value) {
  const temporary = `${destination}.${process.pid}.${randomUUID()}.tmp`;
  await mkdir(path.dirname(destination), { recursive: true });
  await writeFile(temporary, value, { encoding: "utf8", mode: 0o600 });
  await rename(temporary, destination);
}

async function readPairingToken() {
  try {
    return (await readFile(tokenPath(), "utf8")).trim();
  } catch {
    return "";
  }
}

async function request(route, payload, { authenticated = true, timeout = 3_000 } = {}) {
  const headers = { "content-type": "application/json" };
  if (authenticated) {
    const token = await readPairingToken();
    if (!token) {
      throw new AIHooterRequestError(
        "AI Hooter is not paired. Ask Codex to pair with AI Hooter, then approve the local request in the Mac app.",
        "unpaired",
      );
    }
    headers["x-ai-hooter-token"] = token;
  }

  let response;
  try {
    response = await fetch(`http://127.0.0.1:${appPort()}${route}`, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(timeout),
    });
  } catch (error) {
    throw new AIHooterRequestError(
      "AI Hooter could not reach the local macOS app from this task. Retry once with Mac-local access; if that also fails, make sure AI Hooter is running.",
      "unreachable",
      { cause: error },
    );
  }

  const body = await response.text();
  if (!response.ok) {
    throw new AIHooterRequestError(
      `AI Hooter rejected the local request (${response.status}): ${body || "no details"}`,
      response.status === 401 ? "unauthorized" : "rejected",
      { status: response.status },
    );
  }
  try {
    return JSON.parse(body);
  } catch {
    return { accepted: true };
  }
}

async function pair() {
  const existingToken = await readPairingToken();
  if (existingToken) {
    try {
      await request("/v1/pair/status", {});
      return { paired: true, already_paired: true };
    } catch (error) {
      if (error instanceof AIHooterRequestError && error.kind === "unauthorized") {
        await rm(tokenPath(), { force: true });
      } else {
        throw error;
      }
    }
  }

  const result = await request(
    "/v1/pair/request",
    { request_id: randomUUID(), client_name: "Codex" },
    { authenticated: false, timeout: 95_000 },
  );
  const credential = String(result.credential ?? "").trim();
  if (result.paired !== true || credential.length < 32 || credential.length > 200) {
    throw new Error("AI Hooter did not return a valid local pairing credential.");
  }
  await savePrivateFile(tokenPath(), credential);
  return { paired: true, already_paired: false };
}

async function status() {
  const token = await readPairingToken();
  if (!token) return { paired: false };
  try {
    await request("/v1/pair/status", {});
    return { paired: true };
  } catch (error) {
    if (error instanceof AIHooterRequestError && error.kind === "unauthorized") {
      return { paired: false };
    }
    throw error;
  }
}

async function forget() {
  let appNotified = false;
  try {
    const result = await request("/v1/pair/forget", {});
    appNotified = result.forgotten === true || result.accepted !== false;
  } catch {
    // Removing the local credential remains correct while the app is offline.
  }
  await rm(tokenPath(), { force: true });
  return { forgotten: true, app_notified: appNotified };
}

function validateCall(options) {
  const event = requireOption(options, "event");
  const project = requireOption(options, "project");
  const summary = requireOption(options, "summary");
  const urgency = String(options.urgency ?? "normal");
  if (!EVENTS.has(event)) throw new Error(`Unknown event: ${event}`);
  if (!URGENCIES.has(urgency)) throw new Error(`Unknown urgency: ${urgency}`);
  if (project.length > 80) throw new Error("Project must be at most 80 characters.");
  if (event === "summary") {
    // Only this event speaks caller-supplied text. Ordinary event summaries
    // are dashboard metadata and must never block delivery based on length.
    const maximum = 700;
    if (visibleCharacterCount(summary) > maximum) {
      throw new Error(`Spoken summary must be at most ${maximum} characters.`);
    }
    const sentenceCount = summary
      .split(/[.!?]+(?:\s+|$)/u)
      .map((part) => part.trim())
      .filter(Boolean).length;
    if (sentenceCount > 4) {
      throw new Error("A spoken summary may contain at most four sentences.");
    }
  }
  return { event, project, summary, urgency };
}

async function call(options) {
  const payload = { hoot_id: randomUUID(), ...validateCall(options) };
  const result = await request("/v1/hoot", payload);
  return { accepted: result.accepted !== false, ...payload };
}

async function acknowledge(options) {
  const hootID = requireOption(options, "hoot-id");
  if (hootID.length > 100) throw new Error("hoot-id is too long.");
  const result = await request("/v1/acknowledge", { hoot_id: hootID });
  const acknowledged = result.acknowledged === true
    || (result.acknowledged === undefined && result.accepted !== false);
  if (!acknowledged) {
    throw new Error("AI Hooter did not find that exact pending Hoot ID.");
  }
  return { accepted: true, acknowledged: true, hoot_id: hootID };
}

async function arm(currentProjectKey) {
  const destination = path.join(authorizationDirectory(), `${currentProjectKey}.json`);
  await savePrivateFile(
    destination,
    JSON.stringify({ armed: true, armed_at: new Date().toISOString() }),
  );
  return { armed: true, scope: "project" };
}

async function disarm(currentProjectKey) {
  await rm(path.join(authorizationDirectory(), `${currentProjectKey}.json`), {
    force: true,
  });
  return { armed: false, scope: "project" };
}

async function main() {
  const command = String(process.argv[2] ?? "").trim();
  const options = parseOptions(process.argv.slice(3));
  const currentProjectKey = await projectKey(process.cwd());
  let result;

  switch (command) {
    case "pair":
      result = await pair();
      break;
    case "status":
      result = await status();
      break;
    case "forget":
      result = await forget();
      break;
    case "call":
      result = await call(options);
      break;
    case "acknowledge":
      result = await acknowledge(options);
      break;
    case "arm":
      result = await arm(currentProjectKey);
      break;
    case "disarm":
      result = await disarm(currentProjectKey);
      break;
    default:
      throw new Error(
        "Usage: hooter-cli.mjs <pair|status|forget|call|acknowledge|arm|disarm>",
      );
  }

  process.stdout.write(`${JSON.stringify({ ok: true, command, ...result })}\n`);
}

main().catch((error) => {
  process.stderr.write(
    `${JSON.stringify({
      ok: false,
      message: error instanceof Error ? error.message : String(error),
    })}\n`,
  );
  process.exitCode = 1;
});
