---
name: entry-build
description: "Use whenever the Build plugin is selected. Route the request to the intended bundled workflow while keeping all dependencies internal to this plugin."
---

# Build

This is the public entry workflow for this plugin. The bundled skills below are dependencies, not competing entry points.

## Mandatory routing

Default to implement for specs tickets or defined work and follow its tdd and code-review calls. Use codebase-design when TDD needs seam vocabulary and Addy implementation helpers only when their concern is present. Do not start an open-ended grill.

If a bundled workflow calls another bundled skill, invoke that local bundled copy. Never require the user to install another plugin to complete this workflow.

## Bundled workflows

- `implement`
- `implement-spec`
- `tdd`
- `code-review`
- `codebase-design`
- `source-driven-development`
- `incremental-implementation`
- `test-driven-development`
- `api-and-interface-design`
- `git-workflow-and-versioning`
