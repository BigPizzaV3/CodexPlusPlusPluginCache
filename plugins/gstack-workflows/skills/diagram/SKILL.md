---
name: diagram
description: Create a technical diagram from a textual description and return editable source when the host supports artifacts.
---

# Diagram

Portable ChatGPT/Codex adaptation of the `diagram` workflow from `garrytan/gstack`. Preserve the original job and safety intent while mapping execution to capabilities the current host actually exposes.

## When to use

Use this Skill when the user explicitly names `diagram` or asks for the same job described above.

## Host contract

- Inspect repository or file evidence before making claims about the current state.
- Use host-native read, list, search, grep, patch, write, shell, browser, computer, and Python capabilities only when they actually exist.
- Never claim commands, tests, browser actions, device actions, file writes, Git operations, or external mutations that were not executed.
- Prefer read-only discovery before mutation.
- Respect repository instructions and preserve unrelated work.
- When the original native gstack runtime is available in Codex, it may be used as an implementation detail after inspecting the installed upstream Skill. Do not hard-code Claude-only paths as a requirement.

## Workflow

1. Confirm the source content and required output format.
2. Use the host artifact or Python capability when available.
3. Generate the actual artifact rather than only describing how to make it.
4. Verify that the output opens/parses and return the resulting file reference.
5. If the required artifact tool is unavailable, state that limitation clearly.

## Completion

Return the decision, findings, changed artifacts if any, executed verification, skipped checks, and remaining blockers.
