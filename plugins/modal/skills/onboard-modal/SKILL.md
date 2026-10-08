---
name: onboard-modal
description: Install, upgrade, detect, and authenticate the Modal Python SDK and CLI on a local Codex Desktop host using Codex's bundled Python runtime, then install Modal's CLI-generated skill globally. Use when Modal is missing, `modal` is not on PATH, credentials or profiles are not configured, authentication fails, the global Modal skill is missing, or the user asks to set up Modal before running or deploying workloads.
---

# Set up Modal

Prepare the current local Codex Desktop host and install Modal's official CLI-generated skill globally. Keep credential entry in Modal's own interactive flow.

## Check for an existing Modal installation

Do this before discovering Python or installing anything:

1. Run `command -v modal`.
2. If it returns an executable, run `modal --version`.
3. If `modal --version` succeeds, preserve the existing installation. Skip both **Discover Codex Python** and **Install the CLI**, inspect `modal --help` plus any relevant subcommand help, and continue with **Install the Modal skill**.
4. If the executable is absent or broken, continue with **Discover Codex Python**.

## Discover Codex Python

1. Check whether `CODEX_PYTHON` is already set to an executable path with `test -n "${CODEX_PYTHON:-}" && test -x "$CODEX_PYTHON"`. If that succeeds, run `"$CODEX_PYTHON" --version` and preserve the existing value.
2. If `CODEX_PYTHON` is unset or invalid, invoke the Codex dynamic tool named `load_workspace_dependencies` through the tool-calling interface. This is not a shell command: never type or run `load_workspace_dependencies` in a terminal.
3. Read the `Python executable` path from the tool result, substitute it into the assignment below, and run the assignment and checks in the shell:

```bash
export CODEX_PYTHON='/exact/path/from/tool-result'
test -x "$CODEX_PYTHON"
"$CODEX_PYTHON" --version
```

Never execute the placeholder path literally. Shell tool calls may start fresh shells, so re-export the same verified value at the start of any later shell invocation before using `"$CODEX_PYTHON"`. If the Codex tool is unavailable or reports that the bundled runtime is unavailable, explain that this onboarding skill requires a local Codex Desktop thread with workspace dependencies enabled, then stop. Do not fall back to another Python installation.

After `CODEX_PYTHON` is verified, run `"$CODEX_PYTHON" -m modal --version`. If that succeeds, Modal is already installed in the bundled Python user site: skip **Install the CLI**, inspect `"$CODEX_PYTHON" -m modal --help` plus any relevant subcommand help, and continue with **Install the Modal skill**. Only continue to installation if this module check fails.

## Install the CLI

Only reach this section after both the existing `modal` executable check and the `"$CODEX_PYTHON" -m modal` check fail.

Installing packages changes the host. Explain the selected method and obtain any approval required by the execution environment before running it.

Use Codex's bundled Python interpreter to install Modal into the user's Python site directory:

```bash
"$CODEX_PYTHON" -m pip install --user --upgrade modal
```

The bundled runtime is managed and replaced by Codex updates. Always use `--user`; never install packages into the bundled runtime itself, use `sudo pip`, or modify a project's environment or lockfile as part of host onboarding. Do not fall back to `uv`, `pipx`, system Python, or a project package manager.

After installation, run `modal --version`. If the user-site scripts directory is not on `PATH`, use `"$CODEX_PYTHON" -m modal` for the current task and explain the `PATH` limitation. Do not edit shell startup files unless the user asks.

## Install the Modal skill

After `modal --version` succeeds, explain that this step writes generated skill files under the user's home directory and obtain any approval required by the execution environment. Then run:

```bash
modal skills install --global
```

Do not copy or vendor the generated skill or its documentation into this plugin. If the executable is unavailable but the module invocation works, run `"$CODEX_PYTHON" -m modal skills install --global` instead.

After installation, verify that `~/.agents/skills/modal/SKILL.md` exists. If the newly installed skill is not available in the current Codex task, tell the user to start a new task or refresh skill discovery before using it.

## Allow Modal network access in Codex

Modal CLI commands that authenticate, inspect, or mutate cloud state require external network access. In a Codex execution environment with restricted egress, browser authentication may succeed while a later CLI API command remains blocked. Use Codex's normal network approval or escalation mechanism for Modal API commands when required. If an API-backed command stalls because egress is blocked, stop it and retry after access is approved; do not treat blocked egress as invalid credentials or bypass the network policy.

## Authenticate

1. Run `modal token info` first. If it succeeds, preserve the existing credentials.
2. If credentials are missing, run `modal setup`. If the executable is unavailable but the module works, run `"$CODEX_PYTHON" -m modal setup`.
3. Tell the user that Modal will open or print a browser URL and that they must complete the sign-in themselves. Pause while that human interaction is required.
4. For adding a token to another profile through an authenticated browser session, use `modal token new --verify --activate` and add `--profile NAME` only when the user names the profile.

Do not ask the user to paste a token secret into chat. Do not place token IDs or secrets in command arguments, logs, source files, plugin files, or final responses. Avoid `modal token set --token-secret ...`; if manual token entry is unavoidable, let the user enter it directly into Modal's interactive prompt.

## Verify configuration

After the browser flow completes, run:

```bash
modal token info
modal profile current
modal app list --json
```

Treat successful read-only commands as verification. If the executable remains unavailable, invoke each command through `"$CODEX_PYTHON" -m modal`. Do not create, deploy, or stop an App merely to test authentication.

For multiple workspaces or profiles, inspect `modal profile list`, then use `modal profile activate PROFILE` only after confirming the intended workspace with the user. Use an explicit Modal environment for later mutations when the workspace has more than one environment.

## Hand off

Report the CLI version, whether the global Modal skill was installed, the active profile or workspace, and whether the read-only verification succeeded. Do not reproduce credential values. Then continue with the globally installed `modal` skill for workload implementation, execution, deployment, or debugging.
