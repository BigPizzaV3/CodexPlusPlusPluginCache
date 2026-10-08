---
name: retro
description: Produce a retrospective from repository evidence, delivery outcomes, and recorded learnings.
---

# Retro

Portable ChatGPT/Codex adaptation of the `retro` workflow from `garrytan/gstack`. Preserve the original job and safety intent while mapping execution to capabilities the current host actually exposes.

## When to use

Use this Skill when the user explicitly names `retro` or asks for the same job described above.

## Host contract

- Inspect repository or file evidence before making claims about the current state.
- Use host-native read, list, search, grep, patch, write, shell, browser, computer, and Python capabilities only when they actually exist.
- Never claim commands, tests, browser actions, device actions, file writes, Git operations, or external mutations that were not executed.
- Prefer read-only discovery before mutation.
- Respect repository instructions and preserve unrelated work.
- When the original native gstack runtime is available in Codex, it may be used as an implementation detail after inspecting the installed upstream Skill. Do not hard-code Claude-only paths as a requirement.

## Workflow

1. Gather the evidence relevant to the period or work being analyzed.
2. Separate observed outcomes from interpretation.
3. Identify recurring friction, successful patterns, and unresolved issues.
4. Produce specific follow-up actions tied to evidence.
5. Do not invent activity metrics that are not present in the source data.

## Completion

Return the decision, findings, changed artifacts if any, executed verification, skipped checks, and remaining blockers.
