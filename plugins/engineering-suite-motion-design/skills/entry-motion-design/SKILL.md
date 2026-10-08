---
name: entry-motion-design
description: "Use whenever the MotionDesign plugin is selected. Route the request to the intended bundled workflow while keeping all dependencies internal to this plugin."
---

# MotionDesign

This is the public entry workflow for this plugin. The bundled skills below are dependencies, not competing entry points.

## Mandatory routing

Invoke gpt-taste as the primary workflow and preserve its GSAP motion composition and pre-flight requirements. Use frontend engineering only to keep the result production-safe.

If a bundled workflow calls another bundled skill, invoke that local bundled copy. Never require the user to install another plugin to complete this workflow.

## Bundled workflows

- `gpt-taste`
- `frontend-ui-engineering`
- `high-end-visual-design`
- `full-output-enforcement`
