---
name: cso
description: Perform an evidence-backed security review using OWASP and STRIDE-oriented checks.
---

# CSO

Portable ChatGPT/Codex adaptation of the `cso` workflow from `garrytan/gstack`. Preserve the original job and safety intent while mapping execution to capabilities the current host actually exposes.

## When to use

Use this Skill when the user explicitly names `cso` or asks for the same job described above.

## Host contract

- Inspect repository or file evidence before making claims about the current state.
- Use host-native read, list, search, grep, patch, write, shell, browser, computer, and Python capabilities only when they actually exist.
- Never claim commands, tests, browser actions, device actions, file writes, Git operations, or external mutations that were not executed.
- Prefer read-only discovery before mutation.
- Respect repository instructions and preserve unrelated work.
- When the original native gstack runtime is available in Codex, it may be used as an implementation detail after inspecting the installed upstream Skill. Do not hard-code Claude-only paths as a requirement.

## Workflow

1. Establish assets, trust boundaries, inputs, privileged actions, and likely attackers.
2. Inspect the in-scope code and configuration for concrete weaknesses.
3. Use OWASP and STRIDE as coverage aids, not as a checklist substitute for evidence.
4. Validate exploitability and impact before assigning severity.
5. Recommend specific remediations and verification steps.
6. Do not change code unless the user separately requests remediation.

## Completion

Return the decision, findings, changed artifacts if any, executed verification, skipped checks, and remaining blockers.
