---
name: entry-debug
description: "Use whenever the Debug plugin is selected. Route the request to the intended bundled workflow while keeping all dependencies internal to this plugin."
---

# Debug

This is the public entry workflow for this plugin. The bundled skills below are dependencies, not competing entry points.

## Mandatory routing

Use diagnosing-bugs for hard bugs flakes or regressions and debugging-and-error-recovery for general systematic diagnosis. Fix behavior with TDD. Use browser or performance tooling only when evidence points there and resolving-merge-conflicts only during an active conflict.

If a bundled workflow calls another bundled skill, invoke that local bundled copy. Never require the user to install another plugin to complete this workflow.

## Bundled workflows

- `diagnosing-bugs`
- `debugging-and-error-recovery`
- `tdd`
- `test-driven-development`
- `codebase-design`
- `browser-testing-with-devtools`
- `resolving-merge-conflicts`
- `performance-optimization`
