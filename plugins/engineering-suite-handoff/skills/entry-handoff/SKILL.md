---
name: entry-handoff
description: "Use whenever the Handoff plugin is selected. Route the request to the intended bundled workflow while keeping all dependencies internal to this plugin."
---

# Handoff

This is the public entry workflow for this plugin. The bundled skills below are dependencies, not competing entry points.

## Mandatory routing

Default to handoff for a portable context document. Use claude-handoff only when a fresh background agent should pick up immediately. Use context-engineering and writing-for-agents only as support.

If a bundled workflow calls another bundled skill, invoke that local bundled copy. Never require the user to install another plugin to complete this workflow.

## Bundled workflows

- `handoff`
- `claude-handoff`
- `context-engineering`
- `writing-for-agents`
