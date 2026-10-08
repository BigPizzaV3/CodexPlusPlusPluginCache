---
name: codex
description: Provide a second-opinion code or plan review using available Codex reasoning and workspace evidence.
---

# Codex

Portable ChatGPT/Codex adaptation of the `codex` workflow from `garrytan/gstack`. Preserve the original job and safety intent while mapping execution to capabilities the current host actually exposes.

## When to use

Use this Skill when the user explicitly names `codex` or asks for the same job described above.

## Host contract

- Inspect repository or file evidence before making claims about the current state.
- Use host-native read, list, search, grep, patch, write, shell, browser, computer, and Python capabilities only when they actually exist.
- Never claim commands, tests, browser actions, device actions, file writes, Git operations, or external mutations that were not executed.
- Prefer read-only discovery before mutation.
- Respect repository instructions and preserve unrelated work.
- When the original native gstack runtime is available in Codex, it may be used as an implementation detail after inspecting the installed upstream Skill. Do not hard-code Claude-only paths as a requirement.

## Workflow

1. Read the change, diff, plan, or code in scope.
2. Trace affected paths and identify behavior changes and blast radius.
3. Validate suspected findings against code, tests, contracts, and runtime evidence when available.
4. Report only actionable findings with severity, location, evidence, and consequence.
5. Separate confirmed defects from open questions.
6. Do not modify reviewed code unless the user separately asks for fixes.

## Completion

Return the decision, findings, changed artifacts if any, executed verification, skipped checks, and remaining blockers.

## Boundary

This skill is a review role, not an external model dependency. Use the current Codex/ChatGPT host reasoning and available workspace evidence. Do not claim that a second remote model was called unless a real tool did so.
