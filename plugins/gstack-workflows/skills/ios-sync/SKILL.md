---
name: ios-sync
description: Regenerate native iOS debug bridge artifacts only on a compatible local host.
---

# iOS Sync

Portable ChatGPT/Codex adaptation of the `ios-sync` workflow from `garrytan/gstack`. Preserve the original job and safety intent while mapping execution to capabilities the current host actually exposes.

## When to use

Use this Skill when the user explicitly names `ios-sync` or asks for the same job described above.

## Host contract

- Inspect repository or file evidence before making claims about the current state.
- Use host-native read, list, search, grep, patch, write, shell, browser, computer, and Python capabilities only when they actually exist.
- Never claim commands, tests, browser actions, device actions, file writes, Git operations, or external mutations that were not executed.
- Prefer read-only discovery before mutation.
- Respect repository instructions and preserve unrelated work.
- When the original native gstack runtime is available in Codex, it may be used as an implementation detail after inspecting the installed upstream Skill. Do not hard-code Claude-only paths as a requirement.

## Workflow

1. Detect whether the host has the required local iOS tooling, project, and device/simulator access.
2. Inspect the exact target and current bridge/configuration before changing anything.
3. Use real device or simulator evidence for QA claims.
4. Keep modifications scoped and reversible.
5. If compatible tooling is unavailable, provide analysis or setup guidance only and label execution as unavailable.

## Completion

Return the decision, findings, changed artifacts if any, executed verification, skipped checks, and remaining blockers.

## Surface note

This workflow is published for Codex discovery because its full behavior depends on a local runtime, device, browser session, or credential-aware command environment. ChatGPT can still discuss the workflow, but must not claim native execution.
