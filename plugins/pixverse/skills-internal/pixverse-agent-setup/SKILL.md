---
name: pixverse-agent-setup
description: "Set up PixVerse Agent Plugin: dependency checks, PixVerse CLI installation, ffmpeg availability, auth login, account slots, project bootstrap, and first-run troubleshooting."
---

# PixVerse Agent Plugin Setup

Use this when setup/login is the active problem, when `pixverse` is missing, when preflight reports `setup_required` or `authentication_required`, or when the user asks to initialize the project. Ordinary generation preflight already enforces readiness, so do not invoke this as a separate first-use delay when nothing is failing.

Read `../../skills-shared/web-handoff.md` before OAuth, subscription, workspace-management, or Canvas
browser work. These pages use the Codex in-app Browser by default.

The latest reviewed npm release is `1.4.5` (reviewed 2026-09-22). `1.4.0` is the compatibility floor, not an install pin. Refresh the online runtime with `"${PVX}" bootstrap --yes` when the user asks to update or when installing/replacing this plugin. A global CLI upgrade does not refresh this private runtime. Read `../../skills-shared/pixverse-cli-1.4.5.md` for the current CLI changes.

## Setup Gate

When setup is being diagnosed, read the cached readiness file:

```bash
"${PVX}" setup status
```

`setup status` reads the channel-specific local state written by `doctor`: `setup-state.json` for the online channel and `setup-state.internal.json` for the internal channel, under `~/.pixverse-agent-plugin/` or `$PIXVERSE_AGENT_HOME`. If `ready` is false, stop paid production work and guide setup. Queue planning and editable storyboards may still be prepared without spending; do not install dependencies mid-run while generating.

## Fast Path

```bash
"${PVX}" setup status
"${PVX}" doctor
# Only when login is needed, not as part of a version upgrade:
"${PVX}" pixverse auth login --json
"${PVX}" doctor
```

If dependencies are missing:

```bash
"${PVX}" bootstrap
"${PVX}" bootstrap --yes
```

Only use `--yes` when installing through ordinary package managers is acceptable in this local environment.

Plugin `1.3.2` requires `pixverse>=1.4.0` and never mutates the user's global npm package. Read the `pixverse_cli_channel` field from setup/doctor output. On `online`, bootstrap keeps the existing behavior: install or refresh npm `latest` under the stable private runtime. On `internal`, bootstrap verifies the ZIP bundled with the local plugin, extracts it into an isolated version/hash directory, installs production dependencies, smoke-tests it, and atomically activates it. An internal failure never falls back to npm latest or replaces the previous active internal version. Follow bootstrap with `"${PVX}" doctor`.

If a binary, auth, or slots probe times out, `doctor` records `error: timeout`, writes a blocked setup state, and gives the normal login/doctor next steps instead of throwing a traceback. Treat that as unknown connectivity/readiness, not proof that the binary is absent.

## Requirements

Upgrades and same-version package replacements update program files only: preserve user credentials
outside the versioned runtime, reuse the existing IAB profile, and never force login or clear auth
because of a version change. Normal login and authorization checks otherwise remain unchanged.

- Node.js `>=22.12.0` for both online and local builds; the local packager rejects a bundled CLI with a different `engines.node` requirement
- npm
- PixVerse CLI `>=1.4.0`, from npm `latest` on online builds or the bundled ZIP on local builds
- ffmpeg and ffprobe
- Pillow for graphics and contact sheets; bootstrap installs it automatically in the private Python runtime when missing, as do rendering commands on first use
- logged-in PixVerse account

## User Handoff

If login is needed, ask the user to complete:

```bash
"${PVX}" pixverse auth login --json
"${PVX}" doctor
```

Keep the login command running. Its early stderr line contains the complete OAuth authorization URL;
open that URL in the Codex in-app Browser, let the user authorize there, then wait for the original
process to finish. JSON mode suppresses the CLI's system-browser opener. Do not ask for account tokens.
`doctor` refreshes the local setup state afterward. System-browser opening is an explicit
`--open-system` opt-in only.

After login, read `../../skills-shared/quality-policy.md`: Free/Basic stops for an explicit
upgrade/fallback choice and a clickable subscription link. Model-entitlement rejection also
stops paid-tier accounts. After upgrade recheck the premium route; only after fallback consent
prepare v6 540p / Nano Banana 2 Lite 1080p and show a fresh preflight.

Only after setup succeeds, create or identify a project folder:

```bash
"${PVX}" project init <slug> --title "<title>"
```

Then continue directly with the public workflow matching the requested result.
