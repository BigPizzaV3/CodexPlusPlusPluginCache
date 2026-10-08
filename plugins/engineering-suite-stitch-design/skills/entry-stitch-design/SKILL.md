---
name: entry-stitch-design
description: "Use whenever the StitchDesign plugin is selected. Route the request to the intended bundled workflow while keeping all dependencies internal to this plugin."
---

# StitchDesign

This is the public entry workflow for this plugin. The bundled skills below are dependencies, not competing entry points.

## Mandatory routing

Invoke stitch-design-taste and produce the Stitch-oriented design-system document requested by the skill. Do not substitute a generic frontend implementation workflow.

If a bundled workflow calls another bundled skill, invoke that local bundled copy. Never require the user to install another plugin to complete this workflow.

## Bundled workflows

- `stitch-design-taste`
