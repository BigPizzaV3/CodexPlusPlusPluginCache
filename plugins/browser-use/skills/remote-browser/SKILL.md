---
name: remote-browser
description: Use when the user explicitly asks to operate a remote browser session that is already provided and authorized by the current host.
---

# Remote Browser

Use only a remote browser capability that is already exposed and authorized by the current host. This skill does not bootstrap a remote service or authenticate an external command-line runtime.

## Workflow

1. Confirm that the host exposes an active remote browser capability.
2. Use that capability for the user's requested navigation and interaction.
3. Respect normal login, permission, and access boundaries.
4. Report the actual observed state and actions completed.

If the host does not expose a usable remote browser, provide an instruction-only fallback describing the intended steps and clearly state that no remote session was controlled.

Do not download or execute helper software, connect to undeclared endpoints, move credentials between environments, or attempt to defeat website protections.
