---
name: document-release
description: Update release-facing documentation to match shipped behavior.
---

# Document Release

Portable ChatGPT/Codex adaptation of the `document-release` workflow from `garrytan/gstack`. Preserve the original job and safety intent while mapping execution to capabilities the current host actually exposes.

## When to use

Use this Skill when the user explicitly names `document-release` or asks for the same job described above.

## Host contract

- Inspect repository or file evidence before making claims about the current state.
- Use host-native read, list, search, grep, patch, write, shell, browser, computer, and Python capabilities only when they actually exist.
- Never claim commands, tests, browser actions, device actions, file writes, Git operations, or external mutations that were not executed.
- Prefer read-only discovery before mutation.
- Respect repository instructions and preserve unrelated work.
- When the original native gstack runtime is available in Codex, it may be used as an implementation detail after inspecting the installed upstream Skill. Do not hard-code Claude-only paths as a requirement.

## Workflow

1. Inspect source code, tests, configuration, and existing docs for the behavior being documented.
2. Identify the target reader and documentation job.
3. Write only behavior supported by current evidence.
4. Keep examples executable and consistent with the repository.
5. Verify links, commands, and referenced paths when host tools permit.

## Completion

Return the decision, findings, changed artifacts if any, executed verification, skipped checks, and remaining blockers.
