import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdtempSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const hookPath = join(repoRoot, "hooks", "track-session.sh");
const manifest = JSON.parse(readFileSync(join(repoRoot, ".codex-plugin", "plugin.json"), "utf8"));
const hooksConfig = JSON.parse(readFileSync(join(repoRoot, "hooks", "hooks.json"), "utf8"));
const tmpHome = mkdtempSync(join(tmpdir(), "quarryfi-codex-hook-"));
const projectRoot = join(tmpHome, "work", 'client-"a');
const projectDir = join(projectRoot, "app");
const configDir = join(tmpHome, ".quarryfi");
const binDir = join(tmpHome, "bin");
const captureDir = join(tmpHome, "captures");
const packagedPluginRoot = join(tmpHome, "marketplace-package");

assertSupportedCodexHooks();
assertRootHookBundleIsDiscoverable();
assertHookCommandsUsePluginRoot();
assertProductionHostname();
assertPublicRuntimeDetection();

try {
  mkdirSync(projectDir, { recursive: true });
  mkdirSync(configDir, { recursive: true });
  mkdirSync(binDir, { recursive: true });
  mkdirSync(captureDir, { recursive: true });
  writeFileSync(join(projectDir, "package.json"), "{}\n");
  writeFileSync(join(projectDir, 'service-"quoted.test.ts'), "export const privateValue = 'never transmit me';\n");
  execFileSync("git", ["init", "-q", projectDir]);
  execFileSync("git", ["-C", projectDir, "config", "user.email", "tracker-test@quarryfi.test"]);
  execFileSync("git", ["-C", projectDir, "config", "user.name", "QuarryFi Tracker Test"]);
  execFileSync("git", ["-C", projectDir, "add", "package.json"]);
  execFileSync("git", ["-C", projectDir, "commit", "-qm", "test fixture"]);
  execFileSync("git", ["-C", projectDir, "checkout", "-qb", 'feature/"privacy']);
  execFileSync("git", ["-C", projectDir, "remote", "add", "origin", "git@github.com:QuarryFi/private-example.git"]);

  installFakeCurl();
  writeFileSync(
    join(configDir, "config.json"),
    JSON.stringify({
      profiles: [
        { name: 'Client "A"', api_key: "qf_client_a", api_url: "https://capture.invalid", projects: [projectRoot] },
        { name: "Catch All", api_key: "qf_catch_all", api_url: "http://127.0.0.1:9999", projects: [] },
        { name: "Other Client", api_key: "qf_other", projects: [join(tmpHome, "other")] },
      ],
    }, null, 2),
    { mode: 0o600 },
  );

  runHook(["UserPromptSubmit", projectDir, 'ci-"session']);
  assertTimerIdentityVersioned();
  let requests = readCapturedRequests();
  assert.equal(requests.length, 2);
  assert.deepEqual(
    requests.map((request) => request.authorization).sort(),
    ["Authorization: Bearer qf_catch_all", "Authorization: Bearer qf_client_a"],
  );
  assertSafeRequests(requests, 'ci-"session', "javascript");

  clearCaptures();
  runManifestHook({
    eventName: "UserPromptSubmit",
    cwd: projectDir,
    sessionId: 'manifest-"session',
    filePath: join(projectDir, 'service-"quoted.test.ts'),
  });
  requests = readCapturedRequests();
  assert.equal(requests.length, 2, "manifest hook must run from a project cwd");
  assertSafeRequests(requests, 'manifest-"session', "typescript");
  for (const request of requests) {
    assert.equal(request.payload.heartbeats[0].activity_kind, "test");
    assert.equal(request.payload.heartbeats[0].language, "typescript");
  }

  clearCaptures();
  installNonExecutableMarketplaceFixture();
  runManifestHook({
    eventName: "UserPromptSubmit",
    cwd: join(projectRoot, "marketplace-app"),
    sessionId: "marketplace-mode-session",
    filePath: join(projectRoot, "marketplace-app", "package.json"),
    pluginRoot: packagedPluginRoot,
  });
  requests = readCapturedRequests();
  assert.equal(requests.length, 2, "marketplace hook must run when archive strips executable bits");

  assertIdleTimerExpires();

  console.log("Codex tracker privacy and lifecycle regression passed.");
} finally {
  try {
    runHook(["Stop", projectDir, "cleanup-session"]);
  } catch {
    // Best-effort timer cleanup; the temporary HOME is removed below.
  }
  stopHookTimers();
  rmSync(tmpHome, { recursive: true, force: true });
}

function installFakeCurl() {
  const fakeCurl = join(binDir, "curl");
  writeFileSync(fakeCurl, `#!/bin/sh
capture=$(mktemp "$QF_CAPTURE_DIR/request.XXXXXX") || exit 1
printf '%s\n' "$@" > "$capture.args"
payload=''
authorization=''
url=''
while [ "$#" -gt 0 ]; do
  case "$1" in
    -d)
      shift
      payload="$1"
      ;;
    -H)
      shift
      case "$1" in Authorization:*) authorization="$1" ;; esac
      ;;
    http://*|https://*) url="$1" ;;
  esac
  shift
done
printf '%s' "$payload" > "$capture.payload"
printf '%s' "$authorization" > "$capture.authorization"
printf '%s' "$url" > "$capture.url"
printf '204'
`);
  chmodSync(fakeCurl, 0o755);
}

function runHook(args) {
  execFileSync("bash", [hookPath, ...args], {
    cwd: projectDir,
    env: testEnv(),
    stdio: ["ignore", "ignore", "pipe"],
  });
}

function runManifestHook({ eventName, cwd, sessionId, filePath, pluginRoot = repoRoot }) {
  const command = hooksConfig.hooks[eventName][0].hooks[0].command;
  mkdirSync(cwd, { recursive: true });
  execFileSync("bash", ["-c", command], {
    cwd,
    env: testEnv({ pluginRoot }),
    input: JSON.stringify({
      hook_event_name: eventName,
      cwd,
      session_id: sessionId,
      tool_input: { file_path: filePath },
    }),
    stdio: ["pipe", "ignore", "pipe"],
  });
}

function testEnv({ pluginRoot = repoRoot } = {}) {
  return {
    ...process.env,
    HOME: tmpHome,
    PATH: `${binDir}:${process.env.PATH}`,
    QF_CAPTURE_DIR: captureDir,
    CODEX_CLIENT: "app",
    PLUGIN_ROOT: pluginRoot,
  };
}

function installNonExecutableMarketplaceFixture() {
  mkdirSync(join(packagedPluginRoot, "hooks"), { recursive: true });
  mkdirSync(join(packagedPluginRoot, ".codex-plugin"), { recursive: true });
  copyFileSync(hookPath, join(packagedPluginRoot, "hooks", "track-session.sh"));
  copyFileSync(
    join(repoRoot, ".codex-plugin", "plugin.json"),
    join(packagedPluginRoot, ".codex-plugin", "plugin.json"),
  );
  chmodSync(join(packagedPluginRoot, "hooks", "track-session.sh"), 0o644);
}

function readCapturedRequests() {
  return readdirSync(captureDir)
    .filter((name) => name.endsWith(".payload"))
    .sort()
    .map((name) => {
      const base = join(captureDir, name.slice(0, -".payload".length));
      return {
        args: readFileSync(`${base}.args`, "utf8"),
        authorization: readFileSync(`${base}.authorization`, "utf8"),
        url: readFileSync(`${base}.url`, "utf8"),
        payload: JSON.parse(readFileSync(`${base}.payload`, "utf8")),
      };
    });
}

function clearCaptures() {
  for (const name of readdirSync(captureDir)) rmSync(join(captureDir, name));
}

function assertSafeRequests(requests, expectedSessionId, expectedLanguage) {
  for (const request of requests) {
    assert.equal(request.url, "https://quarryfi.com/api/heartbeat");
    assert.match(request.args, /--proto\n=https/);
    assert.match(request.args, /--tlsv1\.2/);
    assert.ok(!request.args.includes("capture.invalid"));
    assert.ok(!request.args.includes("127.0.0.1"));
    assert.equal(request.payload.client.plugin_version, manifest.version);
    assert.equal(request.payload.client.hook_mode, "event_plus_timer");
    assert.match(request.payload.client.runtime_channel, /^codex_/);
    assert.equal(request.payload.client.host_app, "codex_app");

    const [heartbeat] = request.payload.heartbeats;
    assert.equal(heartbeat.source, "codex");
    assert.equal(heartbeat.event, "heartbeat");
    assert.equal(heartbeat.session_id, expectedSessionId);
    assert.equal(heartbeat.project_name, "app");
    assert.equal(heartbeat.language, expectedLanguage);
    assert.equal(heartbeat.branch, 'feature/"privacy');
    assert.match(heartbeat.head_sha, /^[a-f0-9]{40}$/);
    assert.match(heartbeat.repo_fingerprint, /^[a-f0-9]{64}$/);
    assert.equal(heartbeat.changed_file_count, 0);
    for (const forbidden of ["source_code", "diff", "prompt", "command", "file_path", "remote_url"]) {
      assert.equal(forbidden in heartbeat, false, `heartbeat must not include ${forbidden}`);
    }
    assert.ok(!JSON.stringify(request.payload).includes("privateValue"));
    assert.ok(!JSON.stringify(request.payload).includes(tmpHome));
  }
}

function assertSupportedCodexHooks() {
  const supportedEvents = new Set([
    "PreToolUse", "PermissionRequest", "PostToolUse", "PreCompact", "PostCompact",
    "UserPromptSubmit", "SubagentStart", "SubagentStop", "SessionStart", "Stop",
  ]);
  for (const eventName of Object.keys(hooksConfig.hooks ?? {})) {
    assert.ok(supportedEvents.has(eventName), `${eventName} is not a supported Codex hook event`);
  }
  const postToolUseGroups = hooksConfig.hooks?.PostToolUse ?? [];
  assert.ok(postToolUseGroups.length > 0, "PostToolUse hook must be registered");
  assert.ok(postToolUseGroups.some((group) => group.matcher === "*" || group.matcher === undefined));
}

function assertRootHookBundleIsDiscoverable() {
  assert.equal("hooks" in manifest, false, "plugin.json must stay inside the accepted ingestion schema");
  assert.equal(existsSync(join(repoRoot, "hooks", "hooks.json")), true, "default hook bundle must exist");
  assert.equal(existsSync(join(repoRoot, "hooks.json")), false, "legacy root hook bundle must not be duplicated");
}

function assertPublicRuntimeDetection() {
  const hook = readFileSync(hookPath, "utf8");
  assert.match(hook, /openai-curated-remote/);
  assert.match(hook, /codex_public_directory_cache/);
}

function assertHookCommandsUsePluginRoot() {
  for (const [eventName, groups] of Object.entries(hooksConfig.hooks ?? {})) {
    for (const group of groups) {
      for (const hook of group.hooks ?? []) {
        assert.match(
          hook.command,
          /^bash "\$PLUGIN_ROOT\/hooks\/track-session\.sh" /,
          `${eventName} must use PLUGIN_ROOT through bash`,
        );
      }
    }
  }
}

function assertProductionHostname() {
  const retiredHostname = "quarryfi.smashedstudiosllc.workers.dev";
  for (const relativePath of [
    ".codex-plugin/plugin.json", "hooks/track-session.sh", "setup.sh", "skills/quarryfi-status/SKILL.md",
  ]) {
    const contents = readFileSync(join(repoRoot, relativePath), "utf8");
    assert.ok(!contents.includes(retiredHostname), `${relativePath} must not use the retired hostname`);
  }
}

function assertIdleTimerExpires() {
  const hash = createHash("sha256").update(projectDir).digest("hex").slice(0, 12);
  const stateDir = join(configDir, `session-codex-${hash}`);
  mkdirSync(stateDir, { recursive: true });
  writeFileSync(join(stateDir, "session_id"), "idle-session");
  writeFileSync(join(stateDir, "last_activity"), "0");

  execFileSync("bash", [hookPath, "__timer_loop", projectDir, "idle-session"], {
    cwd: projectDir,
    env: testEnv(),
    stdio: ["ignore", "ignore", "pipe"],
    timeout: 2_000,
  });

  assert.equal(existsSync(join(stateDir, "timer.pid")), false, "idle timer must remove its PID file");
  const audit = readFileSync(join(configDir, "audit.log"), "utf8");
  assert.match(audit, /timer_expired:idle/);
}

function assertTimerIdentityVersioned() {
  const hash = createHash("sha256").update(projectDir).digest("hex").slice(0, 12);
  const pidFile = join(configDir, `session-codex-${hash}`, "timer.pid");
  assert.match(readFileSync(pidFile, "utf8"), /^\d+\|[a-f0-9]{12}$/);
}

function stopHookTimers() {
  try {
    for (const entry of readdirSync(configDir)) {
      const pidFile = join(configDir, entry, "timer.pid");
      if (!entry.startsWith("session-codex-") || !existsSync(pidFile)) continue;
      const pid = Number.parseInt(readFileSync(pidFile, "utf8").split("|", 1)[0], 10);
      if (Number.isInteger(pid) && pid > 0) {
        try { process.kill(pid, "SIGTERM"); } catch { /* Timer may already be gone. */ }
      }
    }
  } catch {
    // Best-effort cleanup only.
  }
}
