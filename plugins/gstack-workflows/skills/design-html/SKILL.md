---
name: design-html
description: Create production-oriented HTML and CSS from an approved design direction.
---

# Design HTML

Portable ChatGPT/Codex adaptation of the `design-html` workflow from `garrytan/gstack`. Preserve the original job and safety intent while mapping execution to capabilities the current host actually exposes.

## When to use

Use this Skill when the user explicitly names `design-html` or asks for the same job described above.

## Host contract

- Inspect repository or file evidence before making claims about the current state.
- Use host-native read, list, search, grep, patch, write, shell, browser, computer, and Python capabilities only when they actually exist.
- Never claim commands, tests, browser actions, device actions, file writes, Git operations, or external mutations that were not executed.
- Prefer read-only discovery before mutation.
- Respect repository instructions and preserve unrelated work.
- When the original native gstack runtime is available in Codex, it may be used as an implementation detail after inspecting the installed upstream Skill. Do not hard-code Claude-only paths as a requirement.

## Workflow

1. Inspect repository instructions and the existing implementation pattern.
2. Confirm the requested behavior and scope.
3. Make the smallest coherent implementation that fits existing conventions.
4. Preserve unrelated work and avoid broad rewrites without need.
5. Run the closest relevant checks available on the host.
6. Report changed files, verification evidence, and remaining limitations.

## Completion

Return the decision, findings, changed artifacts if any, executed verification, skipped checks, and remaining blockers.
