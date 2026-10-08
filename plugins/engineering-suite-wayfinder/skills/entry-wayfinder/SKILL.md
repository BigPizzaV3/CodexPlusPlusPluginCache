---
name: entry-wayfinder
description: "Use whenever the Wayfinder plugin is selected. Route the request to the intended bundled workflow while keeping all dependencies internal to this plugin."
---

# Wayfinder

This is the public entry workflow for this plugin. The bundled skills below are dependencies, not competing entry points.

## Mandatory routing

Invoke wayfinder as the primary workflow. Let it call bundled grilling, domain-modeling, research, prototype and handoff exactly as written. Use bundled setup only if tracker configuration is missing. Do not shortcut into Build.

If a bundled workflow calls another bundled skill, invoke that local bundled copy. Never require the user to install another plugin to complete this workflow.

## Bundled workflows

- `wayfinder`
- `grilling`
- `domain-modeling`
- `research`
- `prototype`
- `handoff`
- `setup-matt-pocock-skills`
