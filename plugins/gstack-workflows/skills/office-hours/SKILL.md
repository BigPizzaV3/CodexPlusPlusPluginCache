---
name: office-hours
description: Reframe a product idea before implementation begins.
---

# Office Hours

Portable ChatGPT/Codex adaptation of the `office-hours` workflow from `garrytan/gstack`. Preserve the original job and safety intent while mapping execution to capabilities the current host actually exposes.

## When to use

Use this Skill when the user explicitly names `office-hours` or asks for the same job described above.

## Host contract

- Inspect repository or file evidence before making claims about the current state.
- Use host-native read, list, search, grep, patch, write, shell, browser, computer, and Python capabilities only when they actually exist.
- Never claim commands, tests, browser actions, device actions, file writes, Git operations, or external mutations that were not executed.
- Prefer read-only discovery before mutation.
- Respect repository instructions and preserve unrelated work.
- When the original native gstack runtime is available in Codex, it may be used as an implementation detail after inspecting the installed upstream Skill. Do not hard-code Claude-only paths as a requirement.

## Workflow

1. Inspect the request and relevant repository evidence before judging the plan.
2. State the objective, user outcome, constraints, and assumptions.
3. Challenge the proposal from the skill's named lens and identify missing decisions.
4. Compare meaningful alternatives when the choice is not obvious.
5. Produce a concrete recommendation with acceptance criteria, risks, and verification steps.
6. Stop before implementation unless the user also asked to build.

## Completion

Return the decision, findings, changed artifacts if any, executed verification, skipped checks, and remaining blockers.
