---
name: entry-plan
description: "Use whenever the Plan plugin is selected. Route the request to the intended bundled workflow while keeping all dependencies internal to this plugin."
---

# Plan

This is the public entry workflow for this plugin. The bundled skills below are dependencies, not competing entry points.

## Mandatory routing

Stay in planning. Use planning-and-task-breakdown for clear requirements, spec-driven-development when significant work lacks a spec, documentation-and-adrs for durable decisions, and doubt-driven-development for explicit adversarial validation. Do not implement.

If a bundled workflow calls another bundled skill, invoke that local bundled copy. Never require the user to install another plugin to complete this workflow.

## Bundled workflows

- `planning-and-task-breakdown`
- `spec-driven-development`
- `documentation-and-adrs`
- `doubt-driven-development`
