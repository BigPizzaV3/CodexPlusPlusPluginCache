---
name: entry-brand-kit
description: "Use whenever the BrandKit plugin is selected. Route the request to the intended bundled workflow while keeping all dependencies internal to this plugin."
---

# BrandKit

This is the public entry workflow for this plugin. The bundled skills below are dependencies, not competing entry points.

## Mandatory routing

Invoke brandkit and stay within brand and identity generation rather than turning the request into general frontend implementation.

If a bundled workflow calls another bundled skill, invoke that local bundled copy. Never require the user to install another plugin to complete this workflow.

## Bundled workflows

- `brandkit`
