---
name: browse
description: Drive the native gstack browser when available; otherwise use host browser capabilities without pretending gstack is running.
---

# Browse

Portable ChatGPT/Codex adaptation of the `browse` workflow from `garrytan/gstack`. Preserve the original job and safety intent while mapping execution to capabilities the current host actually exposes.

## When to use

Use this Skill when the user explicitly names `browse` or asks for the same job described above.

## Host contract

- Inspect repository or file evidence before making claims about the current state.
- Use host-native read, list, search, grep, patch, write, shell, browser, computer, and Python capabilities only when they actually exist.
- Never claim commands, tests, browser actions, device actions, file writes, Git operations, or external mutations that were not executed.
- Prefer read-only discovery before mutation.
- Respect repository instructions and preserve unrelated work.
- When the original native gstack runtime is available in Codex, it may be used as an implementation detail after inspecting the installed upstream Skill. Do not hard-code Claude-only paths as a requirement.

## Workflow

1. Detect a compatible local gstack browser runtime and shell before invoking native commands.
2. If present, follow the installed upstream gstack browser Skill and its safety controls.
3. If absent but the host has another browser capability, perform the user job with that capability and state that it is not the native gstack browser.
4. If neither exists, stop rather than fabricate browser execution.

## Completion

Return the decision, findings, changed artifacts if any, executed verification, skipped checks, and remaining blockers.

## Native bridge

On Codex, if a compatible original gstack runtime is installed and shell access exists, prefer its current `/browse` instructions. Otherwise use the host browser capability as the portable fallback.
