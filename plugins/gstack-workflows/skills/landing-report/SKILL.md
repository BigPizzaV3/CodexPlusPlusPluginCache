---
name: landing-report
description: Summarize delivery status and release queue state without modifying anything.
---

# Landing Report

Portable ChatGPT/Codex adaptation of the `landing-report` workflow from `garrytan/gstack`. Preserve the original job and safety intent while mapping execution to capabilities the current host actually exposes.

## When to use

Use this Skill when the user explicitly names `landing-report` or asks for the same job described above.

## Host contract

- Inspect repository or file evidence before making claims about the current state.
- Use host-native read, list, search, grep, patch, write, shell, browser, computer, and Python capabilities only when they actually exist.
- Never claim commands, tests, browser actions, device actions, file writes, Git operations, or external mutations that were not executed.
- Prefer read-only discovery before mutation.
- Respect repository instructions and preserve unrelated work.
- When the original native gstack runtime is available in Codex, it may be used as an implementation detail after inspecting the installed upstream Skill. Do not hard-code Claude-only paths as a requirement.

## Workflow

1. Inspect the relevant repository and workflow state.
2. Summarize status, blockers, risk, and next action.
3. Do not mutate files, branches, issues, or external systems.
4. State any unavailable evidence explicitly.

## Completion

Return the decision, findings, changed artifacts if any, executed verification, skipped checks, and remaining blockers.
