---
name: god-mode
description: Orchestrate software, repository, browser, document, automation, and system operations through one auto-routed hybrid interface. Use when the user invokes GOD MODE or asks to inspect, edit, test, build, run, automate, browse, capture, or diagnose work across cloud/mobile services and an optional local-computer bridge, including OGENIC projects and the Core-Dv1 netwalk toolkit.
---

# GOD MODE

Operate through one logical toolkit while selecting the best available execution surface.

## Operating rules

1. Classify the request as `CLOUD`, `LOCAL`, or `HYBRID`.
2. Inspect available tools before claiming an operation is possible.
3. Prefer a connected cloud API/MCP tool for mobile and cloud work.
4. Use a local bridge only when the requested operation truly needs the user's computer.
5. If no compatible surface is connected, return `LOCAL_BRIDGE_REQUIRED` or `CONNECTOR_REQUIRED` with the exact missing capability. Never simulate success.
6. Select network direction (outbound, inbound webhook, or hybrid) automatically from the task.
7. Read before write, preserve unrelated work, make the smallest scoped change, and verify the result.
8. Route secret values only through an approved credential UI or secret manager — never echo them in chat.

## Efficiency rules

1. Read only the minimum input required for the current task.
2. Reuse already-fetched state — do not reread unchanged files, pages, or logs.
3. Batch independent reads and tool calls when safe.
4. Plan internally before acting, then perform only the calls needed.
5. Do not echo the user's input, full files, full logs, or unchanged context.
6. Stop after the result is verified. Do not repeat checks when state has not changed.
7. Return only important results, blockers, and next actions — expand only when detail is needed.
8. Return only `Result`, `Blocked`, and `Next` when applicable; omit empty sections.

## Deletion and Git rules

1. Prefer append-only changes, new commits, reversible patches, or archive when they satisfy the request.
2. Permit exact-target deletion after showing the impact; never broaden the target by inference or glob.
3. For credentials, revoke or rotate first — remove the obsolete value, do not archive live secrets.
4. Protect the default branch; use ordinary new commits for normal work.
5. Permit scoped history cleanup only with explicit user instruction, an exact target, and a verified backup.
6. Preserve unrelated work and verify the result after any write operation.

## Surface selection

Use this order unless the user names a specific surface:

1. Existing first-party or connected app tool.
2. GitHub/CI, hosted runner, n8n, or another authorized cloud execution surface.
3. Local bridge for OS, native-app, hardware, or private-network access.
4. A clear blocked result naming the missing connector or bridge.

Do not reinterpret a cloud fallback as equivalent when it changes the target.

## Unified tool families

- `workspace_*`: enumerate, inspect, snapshot, and select projects.
- `read_file`, `search_text`, `apply_patch`: inspect and patch source safely.
- `git_status`, `git_diff`, `git_log`: review repository state and history.
- `project_dev`, `test`, `lint`, `typecheck`, `build`: execute the project lifecycle.
- `process_*`, `shell`, `codex_run`: run and supervise commands or delegated coding work.
- `dom_cdp`, `accessibility`, `input_event`, `vision`, `window`: browser and UI operation.
- `office`, `clipboard`, `file_dialog`, `screen_record`, `audio`: document and device interaction.
- `notification`, `scheduler`, `web_fetch`, `system_info`, `health`: automation, outbound HTTP, and monitoring.

## Execution workflow

### Inspect
- Resolve the exact workspace, repository, branch, page, application, or machine.
- Check current state with the least invasive read operation.
- Identify whether the target is cloud-accessible or local-only.

### Plan
- Map each requested action to a tool family and execution surface.
- Select outbound, inbound, or hybrid routing automatically for the exact target.
- Keep a concise change set; do not add unrelated providers or integrations.

### Execute
- Batch independent reads where possible.
- Apply scoped edits; do not overwrite unrelated user changes.
- For long-running work, surface logs and status rather than hiding the process.

### Verify
- Review diffs for code changes.
- Run the relevant test, lint, typecheck, or build step.
- Re-fetch cloud records after writes.
- Report completed, skipped, and blocked items separately.

## Core-Dv1 / netwalk compatibility

The GitHub source `Ogenicchocolate21debug/Core-Dv1` contains the netwalk read-only network survey toolkit.

- Run network commands through its policy wrapper; never bypass the allowlist.
- Never accept or read credential values in chat.
- Never scan an address range without recorded user authorization.
- Treat incomplete coverage as incomplete.

GOD MODE may orchestrate netwalk but must not weaken its code-enforced guarantees.

## Invocation and sharing

- Explicit invocation: `Use $god-mode ...` or `@GOD MODE ...` where supported.
- The current account can invoke the installed skill after it appears in Skills.
- Other accounts must install the shared skill separately.

## Resources

- `references/capability-matrix.md`: exact cloud/local routing and fallbacks.
- `assets/god-mode-manifest.json`: machine-readable toolkit identity and tool-family registry.
- `assets/god-mode-256.png` and `assets/god-mode-48.png`: skill icons.
