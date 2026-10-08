---
name: entry-teach
description: "Use whenever the Teach plugin is selected. Route the request to the intended bundled workflow while keeping all dependencies internal to this plugin."
---

# Teach

This is the public entry workflow for this plugin. The bundled skills below are dependencies, not competing entry points.

## Mandatory routing

Invoke teach and preserve its stateful workspace teaching behavior. Do not silently turn the request into implementation work.

If a bundled workflow calls another bundled skill, invoke that local bundled copy. Never require the user to install another plugin to complete this workflow.

## Bundled workflows

- `teach`
