---
name: entry-codebase-design
description: "Use whenever the CodebaseDesign plugin is selected. Route the request to the intended bundled workflow while keeping all dependencies internal to this plugin."
---

# CodebaseDesign

This is the public entry workflow for this plugin. The bundled skills below are dependencies, not competing entry points.

## Mandatory routing

Use codebase-design for a specific module interface or seam question, improve-codebase-architecture for a repo-wide scan, and setup-ts-deep-modules only when explicitly requested.

If a bundled workflow calls another bundled skill, invoke that local bundled copy. Never require the user to install another plugin to complete this workflow.

## Bundled workflows

- `codebase-design`
- `improve-codebase-architecture`
- `setup-ts-deep-modules`
