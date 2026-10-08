---
name: entry-grill-me
description: "Use whenever the GrillMe plugin is selected. Route the request to the intended bundled workflow while keeping all dependencies internal to this plugin."
---

# GrillMe

This is the public entry workflow for this plugin. The bundled skills below are dependencies, not competing entry points.

## Mandatory routing

For an explicit grill request use grill-with-docs when a working repository is available and grill-me otherwise. Use idea-refine for ideation and interview-me for intent discovery. Never implement final work from this plugin.

If a bundled workflow calls another bundled skill, invoke that local bundled copy. Never require the user to install another plugin to complete this workflow.

## Bundled workflows

- `grill-me`
- `grill-with-docs`
- `grilling`
- `domain-modeling`
- `idea-refine`
- `interview-me`
- `loop-me`
