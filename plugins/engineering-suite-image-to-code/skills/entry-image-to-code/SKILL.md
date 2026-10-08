---
name: entry-image-to-code
description: "Use whenever the ImageToCode plugin is selected. Route the request to the intended bundled workflow while keeping all dependencies internal to this plugin."
---

# ImageToCode

This is the public entry workflow for this plugin. The bundled skills below are dependencies, not competing entry points.

## Mandatory routing

Invoke image-to-code as the primary workflow. Use Taste and frontend engineering only as supporting references. Preserve the image-first analysis requirement rather than jumping straight to generic code.

If a bundled workflow calls another bundled skill, invoke that local bundled copy. Never require the user to install another plugin to complete this workflow.

## Bundled workflows

- `image-to-code`
- `design-taste-frontend`
- `frontend-ui-engineering`
- `full-output-enforcement`
