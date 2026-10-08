---
name: entry-redesign
description: "Use whenever the Redesign plugin is selected. Route the request to the intended bundled workflow while keeping all dependencies internal to this plugin."
---

# Redesign

This is the public entry workflow for this plugin. The bundled skills below are dependencies, not competing entry points.

## Mandatory routing

Invoke redesign-existing-projects as the primary workflow. Use Taste and frontend engineering only as support. Preserve existing product behavior and constraints. This plugin implements; it is not an image-only concept generator.

If a bundled workflow calls another bundled skill, invoke that local bundled copy. Never require the user to install another plugin to complete this workflow.

## Bundled workflows

- `redesign-existing-projects`
- `design-taste-frontend`
- `high-end-visual-design`
- `frontend-ui-engineering`
- `full-output-enforcement`
