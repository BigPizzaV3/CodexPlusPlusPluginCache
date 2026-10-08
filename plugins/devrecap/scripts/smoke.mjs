/**
 * Dependency-free server health smoke test (used by CI and locally).
 *
 * Boots the DevRecap server as a child process against a throwaway data dir +
 * in-memory-ish SQLite file, polls GET /api/health until it responds OK, then
 * exits 0. Any failure (server crash, timeout, non-OK health) exits non-zero.
 * Cross-platform: no shell-isms, only Node built-ins.
 */
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = mkdtempSync(join(tmpdir(), "devrecap-smoke-"));
const port = 3799;
const base = `http://127.0.0.1:${port}`;

const env = {
  ...process.env,
  PORT: String(port),
  DEVRECAP_HOST: "127.0.0.1",
  DEVRECAP_DATA: dataDir,
  DEVRECAP_DB: join(dataDir, "smoke.db"),
  DEVRECAP_LOG_LEVEL: "warn",
};

const server = spawn(process.execPath, [join(root, "apps/server/src/index.ts")], {
  env, stdio: ["ignore", "inherit", "inherit"],
});

let done = false;
function finish(code, msg) {
  if (done) return;
  done = true;
  if (msg) process.stdout.write(`${msg}\n`);
  try { server.kill(); } catch { /* ignore */ }
  try { rmSync(dataDir, { recursive: true, force: true }); } catch { /* ignore */ }
  process.exit(code);
}

server.on("exit", (code) => { if (!done) finish(1, `server exited early (code ${code})`); });

async function poll() {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${base}/api/health`);
      if (res.ok) {
        const body = await res.json();
        if (body && body.ok) return finish(0, `smoke OK: /api/health responded ${JSON.stringify(body)}`);
      }
    } catch { /* server not up yet */ }
    await new Promise((r) => setTimeout(r, 500));
  }
  finish(1, "smoke FAILED: /api/health did not become healthy within 30s");
}

poll();
