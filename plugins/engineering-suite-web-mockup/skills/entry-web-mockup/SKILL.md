---
name: entry-web-mockup
description: "Use whenever the WebMockup plugin is selected. Route the request to the intended bundled workflow while keeping all dependencies internal to this plugin."
---

# WebMockup

This is the public entry workflow for this plugin. The bundled skills below are dependencies, not competing entry points.

## Mandatory routing

Invoke imagegen-frontend-web. Follow its one-image-per-section rule and remain image-output-only; do not implement the website from this plugin.

If a bundled workflow calls another bundled skill, invoke that local bundled copy. Never require the user to install another plugin to complete this workflow.

## Bundled workflows

- `imagegen-frontend-web`
