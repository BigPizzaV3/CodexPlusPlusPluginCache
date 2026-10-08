---
name: entry-design-system
description: "Use whenever the DesignSystem plugin is selected. Route the request to the intended bundled workflow while keeping all dependencies internal to this plugin."
---

# DesignSystem

This is the public entry workflow for this plugin. The bundled skills below are dependencies, not competing entry points.

## Mandatory routing

Invoke impeccable with exactly one of init, document, or extract. Infer which of those three the user wants; if genuinely ambiguous ask one concise question. Never route to other Impeccable commands from this plugin.

If a bundled workflow calls another bundled skill, invoke that local bundled copy. Never require the user to install another plugin to complete this workflow.

## Allowed Impeccable commands

Only route to: `init`, `document`, `extract`.

## Bundled workflows

- `impeccable`
