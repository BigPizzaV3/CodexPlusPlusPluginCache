---
name: canary
description: Run post-deploy checks and surface regressions after a release.
---

# Canary

Portable ChatGPT/Codex adaptation of the `canary` workflow from `garrytan/gstack`. Preserve the original job and safety intent while mapping execution to capabilities the current host actually exposes.

## When to use

Use this Skill when the user explicitly names `canary` or asks for the same job described above.

## Host contract

- Inspect repository or file evidence before making claims about the current state.
- Use host-native read, list, search, grep, patch, write, shell, browser, computer, and Python capabilities only when they actually exist.
- Never claim commands, tests, browser actions, device actions, file writes, Git operations, or external mutations that were not executed.
- Prefer read-only discovery before mutation.
- Respect repository instructions and preserve unrelated work.
- When the original native gstack runtime is available in Codex, it may be used as an implementation detail after inspecting the installed upstream Skill. Do not hard-code Claude-only paths as a requirement.

## Workflow

1. Inspect current configuration and operational state.
2. Identify provider-specific facts from repository evidence rather than guessing.
3. Prefer reversible changes and preserve existing deployment conventions.
4. Execute checks only through available host tools.
5. Report what changed, what was observed, and what still needs a compatible runtime.

## Completion

Return the decision, findings, changed artifacts if any, executed verification, skipped checks, and remaining blockers.
