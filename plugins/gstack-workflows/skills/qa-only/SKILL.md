---
name: qa-only
description: Run end-to-end QA and report findings without changing code.
---

# QA Only

Portable ChatGPT/Codex adaptation of the `qa-only` workflow from `garrytan/gstack`. Preserve the original job and safety intent while mapping execution to capabilities the current host actually exposes.

## When to use

Use this Skill when the user explicitly names `qa-only` or asks for the same job described above.

## Host contract

- Inspect repository or file evidence before making claims about the current state.
- Use host-native read, list, search, grep, patch, write, shell, browser, computer, and Python capabilities only when they actually exist.
- Never claim commands, tests, browser actions, device actions, file writes, Git operations, or external mutations that were not executed.
- Prefer read-only discovery before mutation.
- Respect repository instructions and preserve unrelated work.
- When the original native gstack runtime is available in Codex, it may be used as an implementation detail after inspecting the installed upstream Skill. Do not hard-code Claude-only paths as a requirement.

## Workflow

1. Define user journeys and expected outcomes.
2. Exercise them with actual host tools when available.
3. Record reproducible findings with evidence, severity, and likely impact.
4. Do not edit code or configuration.
5. Clearly mark checks that could not be executed on the current host.

## Completion

Return the decision, findings, changed artifacts if any, executed verification, skipped checks, and remaining blockers.
