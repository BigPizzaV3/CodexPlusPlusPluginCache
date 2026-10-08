---
name: pixverse-setup
description: "PixVerse setup: repair CLI or FFmpeg dependencies, authenticate and diagnose account readiness when setup blocks the requested workflow."
---

# PixVerse Setup

Use this when the user asks to install, authenticate, diagnose, check balance, inspect slots, fix PixVerse CLI problems, or understand command/queue syntax.

## Installed Command

Before running helper commands, resolve the absolute plugin root from this `SKILL.md` path: it is two directories above this skill directory and contains `.codex-plugin/plugin.json`. In every new shell session, set:

```bash
PVX="<absolute-plugin-root>/scripts/pvx"
```

Run helper commands through `"${PVX}"`. Do not assume the user's current working directory is the plugin checkout, and do not bypass the installed wrapper with a module invocation.

Read the internal playbooks that match the issue:

- first-run setup, dependencies, login, FFmpeg, doctor: `../../skills-internal/pixverse-agent-setup/SKILL.md`
- command forms, model ids, queue specs, task polling, CLI errors: `../../skills-internal/pixverse-agent-gateway/SKILL.md`
- Canvas binding, graph sync/mutation, paid reconciliation, browser handoff: `../../skills-internal/pixverse-agent-canvas/SKILL.md`
- project bootstrap after setup is ready: `../../skills-internal/pixverse-agent-project-memory/SKILL.md`

Read `../../skills-shared/web-handoff.md` before any OAuth, subscription, workspace-management, or
Canvas browser action. Every plugin web destination uses the Codex in-app Browser by default.

The latest reviewed npm release is `1.4.5` (reviewed 2026-09-22). `1.4.0` is the compatibility floor, not an install pin. Refresh the online runtime with `"${PVX}" bootstrap --yes` when the user asks to update or when installing/replacing this plugin. A global CLI upgrade does not refresh this private runtime. Read `../../skills-shared/pixverse-cli-1.4.5.md` for the current CLI changes.

## Setup Gate

PixVerse Agent Plugin `1.3.2` requires `pixverse>=1.4.0` and Node.js `>=22.12.0` on both managed channels, and never uses a global `pixverse` package. Setup reports `pixverse_cli_channel`: the online plugin installs npm `latest` in its private stable runtime, while the local plugin installs only the internal ZIP bundled with that plugin into a separate internal runtime. A local package is rejected if its bundled CLI declares a different Node engine.

Start with cached readiness:

```bash
"${PVX}" setup status
```

If status is missing or blocked, refresh checks:

```bash
"${PVX}" doctor
```

If doctor reports the managed CLI missing or below minimum, or when installing/updating the plugin, refresh it in one call:

```bash
"${PVX}" bootstrap --yes
```

On the online channel, this installs `pixverse@latest` when absent and refreshes an existing supported version. On the internal channel, it verifies, extracts, dependency-installs, smoke-tests, and activates the bundled internal ZIP. A matching internal runtime is reused only after its install metadata, package/capabilities, dependencies, entrypoints, and smoke test still pass; otherwise bootstrap rebuilds it from the ZIP. Internal installation never falls back to npm latest, and a failed update preserves the previously active internal CLI.

Doctor probe timeouts are returned as structured blocked checks and cached with next steps; they must not surface as Python tracebacks or be mistaken for missing binaries. Retry doctor after checking connectivity, and only start paid work once auth and slot capacity are readable.

Upgrading the plugin/CLI (including replacing a same-version package) must preserve existing CLI
credentials and reuse the Codex IAB profile. Do not run login/logout or clear authorization solely
because the version changed; an expired or revoked session still follows the normal login flow.

If PixVerse auth is missing:

```bash
"${PVX}" pixverse auth login --json
"${PVX}" doctor
```

Run login as one long-lived call. The wrapper forces JSON mode, preventing PixVerse CLI from opening
the system browser. As soon as stderr emits `Authorize at: <url>`, open that exact URL in the Codex
in-app Browser and keep the login process alive while the user authorizes. Never ask them to paste
account tokens. After completion, `doctor` refreshes cached auth/readiness. If the URL is not emitted or
login remains false, run `"${PVX}" pixverse auth status --json`, check connectivity, and retry login once
rather than attempting paid work. Use `--open-system` only after an explicit user request.

Use the wrapper for realpath-safe CLI calls:

```bash
"${PVX}" pixverse --version
"${PVX}" pixverse auth status --json
```

## Canvas Setup Routing

Canvas setup, login, account, balance, membership, and active-workspace failures still use the setup
gates in this skill. For project binding, graph checkpoints, guarded mutations, paid node generation,
credit reconciliation, and browser handoff, read
`../../skills-internal/pixverse-agent-canvas/SKILL.md`; that is the canonical Canvas playbook.
Canvas Browser login and PixVerse CLI authentication are separate sessions.

## Balance And Slots

Before paid generation or queue planning:

```bash
"${PVX}" billing snapshot
"${PVX}" quote queue <queue.json>
```

After setup, generation proceeds automatically after preflight by default, including the first batch. Only effective `require` waits for batch approval. If the user asks to control spending, enable project confirmation; “Allow future generation” restores automatic execution. Follow `../../skills-shared/generation-confirmation.md`.

The same preflight reports login and membership. Follow `../../skills-shared/quality-policy.md`:
Free/Basic must stop and choose upgrade or fallback; any model-entitlement rejection also
pauses generation. Show the clickable subscription/recharge link, then wait for the user's
choice. Upgrade is followed by a live recheck; fallback consent enables v6 540p / Nano Banana
2 Lite 1080p with a fresh preflight. Obtain the subscription URL using:

```bash
"${PVX}" pixverse subscribe
```

Do not call `subscribe` without the user's intent. It returns a structured handoff that must be opened
in the Codex in-app Browser; it does not open the system browser by default. If a user explicitly
confirms that their displayed Free/Basic account is an unrestricted internal test account, record the
local exception with `"${PVX}" preferences membership-routing unrestricted-test`; never infer or offer
that override to ordinary users. It changes model routing only—login, balance, quote, and approval
gates remain active.
