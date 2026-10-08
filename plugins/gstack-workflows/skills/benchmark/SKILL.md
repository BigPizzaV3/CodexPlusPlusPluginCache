---
name: benchmark
description: Measure performance and compare against a known baseline using available execution or browser tools.
---

# Benchmark

Portable ChatGPT/Codex adaptation of the `benchmark` workflow from `garrytan/gstack`. Preserve the original job and safety intent while mapping execution to capabilities the current host actually exposes.

## When to use

Use this Skill when the user explicitly names `benchmark` or asks for the same job described above.

## Host contract

- Inspect repository or file evidence before making claims about the current state.
- Use host-native read, list, search, grep, patch, write, shell, browser, computer, and Python capabilities only when they actually exist.
- Never claim commands, tests, browser actions, device actions, file writes, Git operations, or external mutations that were not executed.
- Prefer read-only discovery before mutation.
- Respect repository instructions and preserve unrelated work.
- When the original native gstack runtime is available in Codex, it may be used as an implementation detail after inspecting the installed upstream Skill. Do not hard-code Claude-only paths as a requirement.

## Workflow

1. Define the metric, workload, environment, and baseline before measuring.
2. Run the same bounded workload for each comparison target.
3. Record execution conditions and raw evidence.
4. Compare results without hiding variance or failed runs.
5. Do not claim benchmark numbers unless they were actually measured.

## Completion

Return the decision, findings, changed artifacts if any, executed verification, skipped checks, and remaining blockers.
