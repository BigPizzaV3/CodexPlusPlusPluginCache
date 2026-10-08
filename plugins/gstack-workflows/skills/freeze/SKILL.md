---
name: freeze
description: Restrict requested edits to an explicitly named directory or scope.
---

# Freeze

Portable ChatGPT/Codex adaptation of the `freeze` workflow from `garrytan/gstack`. Preserve the original job and safety intent while mapping execution to capabilities the current host actually exposes.

## When to use

Use this Skill when the user explicitly names `freeze` or asks for the same job described above.

## Host contract

- Inspect repository or file evidence before making claims about the current state.
- Use host-native read, list, search, grep, patch, write, shell, browser, computer, and Python capabilities only when they actually exist.
- Never claim commands, tests, browser actions, device actions, file writes, Git operations, or external mutations that were not executed.
- Prefer read-only discovery before mutation.
- Respect repository instructions and preserve unrelated work.
- When the original native gstack runtime is available in Codex, it may be used as an implementation detail after inspecting the installed upstream Skill. Do not hard-code Claude-only paths as a requirement.

## Workflow

1. Establish the exact allowed scope and operation before mutation.
2. Detect destructive, irreversible, credential, production, database, history-rewrite, or broad-delete actions.
3. Require explicit confirmation for materially risky actions.
4. Keep edits inside the agreed scope and stop on scope ambiguity.
5. Verify the resulting state when the host provides the needed tools.

## Completion

Return the decision, findings, changed artifacts if any, executed verification, skipped checks, and remaining blockers.
