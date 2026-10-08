---
name: sync-gbrain
description: Refresh gbrain project context only when the native local runtime is available and the user authorizes the sync.
---

# Sync Gbrain

Portable ChatGPT/Codex adaptation of the `sync-gbrain` workflow from `garrytan/gstack`. Preserve the original job and safety intent while mapping execution to capabilities the current host actually exposes.

## When to use

Use this Skill when the user explicitly names `sync-gbrain` or asks for the same job described above.

## Host contract

- Inspect repository or file evidence before making claims about the current state.
- Use host-native read, list, search, grep, patch, write, shell, browser, computer, and Python capabilities only when they actually exist.
- Never claim commands, tests, browser actions, device actions, file writes, Git operations, or external mutations that were not executed.
- Prefer read-only discovery before mutation.
- Respect repository instructions and preserve unrelated work.
- When the original native gstack runtime is available in Codex, it may be used as an implementation detail after inspecting the installed upstream Skill. Do not hard-code Claude-only paths as a requirement.

## Workflow

1. Detect whether a compatible native gstack installation and local shell are actually available.
2. If available, inspect its current version/configuration before changing it.
3. Require explicit user authorization for installation, update, credential, or sync mutations.
4. Follow the upstream runtime workflow where available.
5. If unavailable, provide the portable alternative or stop with a clear capability limitation.

## Completion

Return the decision, findings, changed artifacts if any, executed verification, skipped checks, and remaining blockers.

## Surface note

This workflow is published for Codex discovery because its full behavior depends on a local runtime, device, browser session, or credential-aware command environment. ChatGPT can still discuss the workflow, but must not claim native execution.
