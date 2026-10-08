---
name: entry-to-tickets
description: "Use whenever the ToTickets plugin is selected. Route the request to the intended bundled workflow while keeping all dependencies internal to this plugin."
---

# ToTickets

This is the public entry workflow for this plugin. The bundled skills below are dependencies, not competing entry points.

## Mandatory routing

Invoke to-tickets. Preserve its vertical-slice and blocking-edge rules. Use bundled domain and codebase references as needed and setup only when tracker conventions are missing.

If a bundled workflow calls another bundled skill, invoke that local bundled copy. Never require the user to install another plugin to complete this workflow.

## Bundled workflows

- `to-tickets`
- `domain-modeling`
- `codebase-design`
- `setup-matt-pocock-skills`
