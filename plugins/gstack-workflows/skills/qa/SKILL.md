---
name: qa
description: Run end-to-end QA, fix authorized defects, and re-verify them when host tools permit.
---

# QA

Portable ChatGPT/Codex adaptation of the `qa` workflow from `garrytan/gstack`. Preserve the original job and safety intent while mapping execution to capabilities the current host actually exposes.

## When to use

Use this Skill when the user explicitly names `qa` or asks for the same job described above.

## Host contract

- Inspect repository or file evidence before making claims about the current state.
- Use host-native read, list, search, grep, patch, write, shell, browser, computer, and Python capabilities only when they actually exist.
- Never claim commands, tests, browser actions, device actions, file writes, Git operations, or external mutations that were not executed.
- Prefer read-only discovery before mutation.
- Respect repository instructions and preserve unrelated work.
- When the original native gstack runtime is available in Codex, it may be used as an implementation detail after inspecting the installed upstream Skill. Do not hard-code Claude-only paths as a requirement.

## Workflow

1. Define the user journeys and expected outcomes in scope.
2. Use real browser, app, or execution tools when the host exposes them.
3. Record reproducible failures with steps, evidence, and severity.
4. If fixes are authorized, make focused changes and re-run the failing path.
5. Run a small regression pass around each fix.
6. Never claim a click, browser session, screenshot, or test run that did not occur.

## Completion

Return the decision, findings, changed artifacts if any, executed verification, skipped checks, and remaining blockers.
