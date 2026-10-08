---
name: skillify
description: Convert a proven repeatable workflow into a reusable Skill with clear triggers and checks.
---

# Skillify

Portable ChatGPT/Codex adaptation of the `skillify` workflow from `garrytan/gstack`. Preserve the original job and safety intent while mapping execution to capabilities the current host actually exposes.

## When to use

Use this Skill when the user explicitly names `skillify` or asks for the same job described above.

## Host contract

- Inspect repository or file evidence before making claims about the current state.
- Use host-native read, list, search, grep, patch, write, shell, browser, computer, and Python capabilities only when they actually exist.
- Never claim commands, tests, browser actions, device actions, file writes, Git operations, or external mutations that were not executed.
- Prefer read-only discovery before mutation.
- Respect repository instructions and preserve unrelated work.
- When the original native gstack runtime is available in Codex, it may be used as an implementation detail after inspecting the installed upstream Skill. Do not hard-code Claude-only paths as a requirement.

## Workflow

1. Start from a workflow that has been observed or clearly specified.
2. Define a narrow trigger, user job, inputs, outputs, stop conditions, and mutation boundary.
3. Map operations to host capabilities rather than hard-coded proprietary tool names.
4. Add verification and negative routing cases.
5. Package the result using the current Agent Skills contract and validate the files.

## Completion

Return the decision, findings, changed artifacts if any, executed verification, skipped checks, and remaining blockers.
