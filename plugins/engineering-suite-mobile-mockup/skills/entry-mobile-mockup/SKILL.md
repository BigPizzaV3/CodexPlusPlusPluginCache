---
name: entry-mobile-mockup
description: "Use whenever the MobileMockup plugin is selected. Route the request to the intended bundled workflow while keeping all dependencies internal to this plugin."
---

# MobileMockup

This is the public entry workflow for this plugin. The bundled skills below are dependencies, not competing entry points.

## Mandatory routing

Invoke imagegen-frontend-mobile. Generate mobile design images only and preserve its device framing and multi-screen consistency rules. Do not write application code.

If a bundled workflow calls another bundled skill, invoke that local bundled copy. Never require the user to install another plugin to complete this workflow.

## Bundled workflows

- `imagegen-frontend-mobile`
