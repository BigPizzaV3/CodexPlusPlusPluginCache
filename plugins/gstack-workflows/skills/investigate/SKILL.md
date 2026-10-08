---
name: investigate
description: Run systematic root-cause investigation before proposing a fix.
---

# Investigate

Portable ChatGPT/Codex adaptation of the `investigate` workflow from `garrytan/gstack`. Preserve the original job and safety intent while mapping execution to capabilities the current host actually exposes.

## When to use

Use this Skill when the user explicitly names `investigate` or asks for the same job described above.

## Host contract

- Inspect repository or file evidence before making claims about the current state.
- Use host-native read, list, search, grep, patch, write, shell, browser, computer, and Python capabilities only when they actually exist.
- Never claim commands, tests, browser actions, device actions, file writes, Git operations, or external mutations that were not executed.
- Prefer read-only discovery before mutation.
- Respect repository instructions and preserve unrelated work.
- When the original native gstack runtime is available in Codex, it may be used as an implementation detail after inspecting the installed upstream Skill. Do not hard-code Claude-only paths as a requirement.

## Workflow

1. Reproduce or establish the failure from logs, tests, code paths, or user evidence.
2. Form competing hypotheses instead of jumping to a fix.
3. Trace the relevant data/control path and eliminate hypotheses with evidence.
4. Identify the root cause and the smallest safe correction.
5. Apply a fix only when mutation is authorized.
6. Re-run the reproducer and relevant regression checks before calling it fixed.

## Completion

Return the decision, findings, changed artifacts if any, executed verification, skipped checks, and remaining blockers.
