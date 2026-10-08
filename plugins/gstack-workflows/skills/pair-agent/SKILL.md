---
name: pair-agent
description: Pair an authorized agent with native gstack browser access while preserving scope and revocation controls.
---

# Pair Agent

Portable ChatGPT/Codex adaptation of the `pair-agent` workflow from `garrytan/gstack`. Preserve the original job and safety intent while mapping execution to capabilities the current host actually exposes.

## When to use

Use this Skill when the user explicitly names `pair-agent` or asks for the same job described above.

## Host contract

- Inspect repository or file evidence before making claims about the current state.
- Use host-native read, list, search, grep, patch, write, shell, browser, computer, and Python capabilities only when they actually exist.
- Never claim commands, tests, browser actions, device actions, file writes, Git operations, or external mutations that were not executed.
- Prefer read-only discovery before mutation.
- Respect repository instructions and preserve unrelated work.
- When the original native gstack runtime is available in Codex, it may be used as an implementation detail after inspecting the installed upstream Skill. Do not hard-code Claude-only paths as a requirement.

## Workflow

1. Require a compatible local gstack browser runtime.
2. Treat cookies, authenticated tabs, tokens, pairing keys, and account sessions as sensitive.
3. Ask for explicit authorization before importing credentials, pairing agents, or changing grants.
4. Apply least privilege, scope limits, and revocation checks.
5. Do not print secrets or persist them in plugin files.

## Completion

Return the decision, findings, changed artifacts if any, executed verification, skipped checks, and remaining blockers.

## Surface note

This workflow is published for Codex discovery because its full behavior depends on a local runtime, device, browser session, or credential-aware command environment. ChatGPT can still discuss the workflow, but must not claim native execution.
