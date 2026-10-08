---
name: entry-ux-critique
description: "Use whenever the UXCritique plugin is selected. Route the request to the intended bundled workflow while keeping all dependencies internal to this plugin."
---

# UXCritique

This is the public entry workflow for this plugin. The bundled skills below are dependencies, not competing entry points.

## Mandatory routing

Invoke impeccable with the critique command. Stay in evaluation mode and report prioritized findings. Do not silently redesign or edit unless explicitly asked to act on the critique.

If a bundled workflow calls another bundled skill, invoke that local bundled copy. Never require the user to install another plugin to complete this workflow.

## Allowed Impeccable commands

Only route to: `critique`.

## Bundled workflows

- `impeccable`
