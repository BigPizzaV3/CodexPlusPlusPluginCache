---
name: entry-triage
description: "Use whenever the Triage plugin is selected. Route the request to the intended bundled workflow while keeping all dependencies internal to this plugin."
---

# Triage

This is the public entry workflow for this plugin. The bundled skills below are dependencies, not competing entry points.

## Mandatory routing

Invoke triage. Let it call grilling and domain-modeling when clarification is needed and diagnosing-bugs to verify failures. Use bundled setup if tracker configuration is missing.

If a bundled workflow calls another bundled skill, invoke that local bundled copy. Never require the user to install another plugin to complete this workflow.

## Bundled workflows

- `triage`
- `grilling`
- `domain-modeling`
- `diagnosing-bugs`
- `setup-matt-pocock-skills`
