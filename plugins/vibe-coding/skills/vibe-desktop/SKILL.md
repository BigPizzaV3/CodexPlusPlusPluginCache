---
name: vibe-desktop
description: "Audit, fix or verify browser extensions or desktop applications: IPC/messaging, permission boundaries, local storage, reload/update, native integration and packaging."
---

# Desktop & extensions

Read [the shared workflow](../../references/workflow.md) once per task, then the one recipe matching the requested operation and boundary. Do not load every recipe. The user's request controls scope and whether edits are allowed.

## Recipes

| Recipe | Operation |
|---|---|
| [Browser Extension Audit](references/browser-extension-audit.md) | audit |
| [Browser Extension Polish](references/browser-extension-polish.md) | implement |
| [Desktop App Audit](references/desktop-app-audit.md) | audit |
| [Desktop App Polish](references/desktop-app-polish.md) | implement |
| [Local Client Runtime Security Check](references/local-client-runtime-security-check.md) | check |

For an explicit multi-stage request, follow the necessary stages without discarding requested work. For a single stage, deliver that result and stop. Use [the catalog](../../references/catalog.md) only if the requested boundary belongs elsewhere.
