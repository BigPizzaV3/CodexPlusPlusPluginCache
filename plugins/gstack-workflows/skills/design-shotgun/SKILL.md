---
name: design-shotgun
description: Generate and compare several materially different design directions before selecting one.
---

# Design Shotgun

Portable ChatGPT/Codex adaptation of the `design-shotgun` workflow from `garrytan/gstack`. Preserve the original job and safety intent while mapping execution to capabilities the current host actually exposes.

## When to use

Use this Skill when the user explicitly names `design-shotgun` or asks for the same job described above.

## Host contract

- Inspect repository or file evidence before making claims about the current state.
- Use host-native read, list, search, grep, patch, write, shell, browser, computer, and Python capabilities only when they actually exist.
- Never claim commands, tests, browser actions, device actions, file writes, Git operations, or external mutations that were not executed.
- Prefer read-only discovery before mutation.
- Respect repository instructions and preserve unrelated work.
- When the original native gstack runtime is available in Codex, it may be used as an implementation detail after inspecting the installed upstream Skill. Do not hard-code Claude-only paths as a requirement.

## Workflow

1. Inspect existing product, brand, components, and implementation constraints.
2. Define the design job and the criteria that will decide between directions.
3. Produce materially different options rather than cosmetic variations.
4. Compare them against usability, consistency, accessibility, feasibility, and the stated goal.
5. Select a direction and turn it into concrete implementation guidance.
6. Do not claim visual or browser verification unless the host actually performed it.

## Completion

Return the decision, findings, changed artifacts if any, executed verification, skipped checks, and remaining blockers.
