---
name: entry-ponytail
description: "Use whenever the Ponytail plugin is selected. Route the request to the intended bundled workflow while keeping all dependencies internal to this plugin."
---

# Ponytail

This is the public entry workflow for this plugin. The bundled skills below are dependencies, not competing entry points.

## Mandatory routing

Choose the exact Ponytail mode from intent: ponytail, ponytail-review, ponytail-audit, ponytail-debt, ponytail-gain, or ponytail-help. Use code-simplification only as an auxiliary clarity pass.

If a bundled workflow calls another bundled skill, invoke that local bundled copy. Never require the user to install another plugin to complete this workflow.

## Bundled workflows

- `ponytail`
- `ponytail-audit`
- `ponytail-debt`
- `ponytail-gain`
- `ponytail-help`
- `ponytail-review`
- `code-simplification`
