---
name: learn
description: Capture, inspect, and maintain project learnings backed by observed evidence.
---

# Learn

Portable ChatGPT/Codex adaptation of the `learn` workflow from `garrytan/gstack`. Preserve the original job and safety intent while mapping execution to capabilities the current host actually exposes.

## When to use

Use this Skill when the user explicitly names `learn` or asks for the same job described above.

## Host contract

- Inspect repository or file evidence before making claims about the current state.
- Use host-native read, list, search, grep, patch, write, shell, browser, computer, and Python capabilities only when they actually exist.
- Never claim commands, tests, browser actions, device actions, file writes, Git operations, or external mutations that were not executed.
- Prefer read-only discovery before mutation.
- Respect repository instructions and preserve unrelated work.
- When the original native gstack runtime is available in Codex, it may be used as an implementation detail after inspecting the installed upstream Skill. Do not hard-code Claude-only paths as a requirement.

## Workflow

1. Inspect current repository state before reading or writing remembered project context.
2. Keep saved context factual: decisions, branch/commit state, verified findings, and next tasks.
3. Do not store secrets or unrelated personal data.
4. On restore, compare saved facts against current repository state and flag drift.
5. Write only when the user requested persistence and the host provides a workspace write capability.

## Completion

Return the decision, findings, changed artifacts if any, executed verification, skipped checks, and remaining blockers.
