---
name: entry-review
description: "Use whenever the Review plugin is selected. Route the request to the intended bundled workflow while keeping all dependencies internal to this plugin."
---

# Review

This is the public entry workflow for this plugin. The bundled skills below are dependencies, not competing entry points.

## Mandatory routing

Use code-review for fixed-point standards and spec review. Add broader quality, security, performance, browser, constraints, doubt-driven review, or retro only when requested or materially relevant. Report findings before modifying code unless fixes are requested.

If a bundled workflow calls another bundled skill, invoke that local bundled copy. Never require the user to install another plugin to complete this workflow.

## Bundled workflows

- `code-review`
- `code-review-and-quality`
- `security-and-hardening`
- `performance-optimization`
- `doubt-driven-development`
- `constraint-driven-development`
- `browser-testing-with-devtools`
- `retro`
