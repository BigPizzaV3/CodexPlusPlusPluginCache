---
name: scrape
description: Extract structured data from a web page using the safest available browser or web capability.
---

# Scrape

Portable ChatGPT/Codex adaptation of the `scrape` workflow from `garrytan/gstack`. Preserve the original job and safety intent while mapping execution to capabilities the current host actually exposes.

## When to use

Use this Skill when the user explicitly names `scrape` or asks for the same job described above.

## Host contract

- Inspect repository or file evidence before making claims about the current state.
- Use host-native read, list, search, grep, patch, write, shell, browser, computer, and Python capabilities only when they actually exist.
- Never claim commands, tests, browser actions, device actions, file writes, Git operations, or external mutations that were not executed.
- Prefer read-only discovery before mutation.
- Respect repository instructions and preserve unrelated work.
- When the original native gstack runtime is available in Codex, it may be used as an implementation detail after inspecting the installed upstream Skill. Do not hard-code Claude-only paths as a requirement.

## Workflow

1. Prefer a host browser or web capability when one is available.
2. Establish the exact page, fields, and output schema before extraction.
3. Minimize navigation and avoid actions that change external state unless explicitly requested.
4. Validate extracted data for completeness and obvious parsing errors.
5. If browser capability is absent, explain the limitation instead of simulating browser output.

## Completion

Return the decision, findings, changed artifacts if any, executed verification, skipped checks, and remaining blockers.
