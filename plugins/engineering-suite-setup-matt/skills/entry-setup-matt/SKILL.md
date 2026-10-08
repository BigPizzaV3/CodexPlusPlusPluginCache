---
name: entry-setup-matt
description: "Use whenever the SetupMatt plugin is selected. Route the request to the intended bundled workflow while keeping all dependencies internal to this plugin."
---

# SetupMatt

This is the public entry workflow for this plugin. The bundled skills below are dependencies, not competing entry points.

## Mandatory routing

Invoke setup-matt-pocock-skills. Triage is intentionally bundled so setup detects it and configures triage labels. Do not run triage unless separately requested.

If a bundled workflow calls another bundled skill, invoke that local bundled copy. Never require the user to install another plugin to complete this workflow.

## Bundled workflows

- `setup-matt-pocock-skills`
- `triage`
