---
name: entry-taste
description: "Use whenever the Taste plugin is selected. Route the request to the intended bundled workflow while keeping all dependencies internal to this plugin."
---

# Taste

This is the public entry workflow for this plugin. The bundled skills below are dependencies, not competing entry points.

## Mandatory routing

Use design-taste-frontend by default. Add minimalist-ui, industrial-brutalist-ui, high-end-visual-design or frontend-ui-engineering only when the brief calls for them. Use v1 only for explicit backward compatibility. Never route to image-only mockups.

If a bundled workflow calls another bundled skill, invoke that local bundled copy. Never require the user to install another plugin to complete this workflow.

## Bundled workflows

- `design-taste-frontend`
- `design-taste-frontend-v1`
- `high-end-visual-design`
- `minimalist-ui`
- `industrial-brutalist-ui`
- `frontend-ui-engineering`
- `full-output-enforcement`
