---
name: entry-prototype
description: "Use whenever the Prototype plugin is selected. Route the request to the intended bundled workflow while keeping all dependencies internal to this plugin."
---

# Prototype

This is the public entry workflow for this plugin. The bundled skills below are dependencies, not competing entry points.

## Mandatory routing

Invoke prototype. Keep it throwaway and focused on answering the concrete design question rather than becoming production code.

If a bundled workflow calls another bundled skill, invoke that local bundled copy. Never require the user to install another plugin to complete this workflow.

## Bundled workflows

- `prototype`
