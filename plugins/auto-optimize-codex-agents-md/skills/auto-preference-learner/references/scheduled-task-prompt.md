# Scheduled Task Configuration

## Purpose

Provide the execution prompt used when configuring a Codex scheduled task, including incremental scanning, project scoping, review, validation, and default Suggest behavior. Read and use this file only when the user explicitly asks to create or modify a scheduled task. It does not replace the normal manual workflow or define session fields or `AGENTS.md` decision policy.

## Before Creation

Create or update a scheduled task only when the user explicitly asks. Ask for the local run time and offer `Asia/Shanghai 10:00` as the default. Time is configuration, not a hard-coded script or core Skill behavior.

Create a standalone scheduled task so every run begins from a fixed prompt. Use local project mode so the run can access local Codex history and multiple historical projects. Do not use an isolated worktree because the task must update root `AGENTS.md` files in the projects' main checkouts. Set reasoning effort explicitly to `high`, not `xhigh`.

Choose the narrowest permissions that can read `$CODEX_HOME` and access historical project roots. If a product-level workspace cannot cover those paths, require the user to configure broader local file access explicitly. Even with broader platform permissions, deterministic scripts must still restrict writes to exact `AGENTS.md` files in trusted roots and to the optimizer state directory.

## Durable Prompt

```text
Use $auto-preference-learner to run the daily incremental AGENTS.md memory review in Suggest mode.

First run the bundled seven-day quota preflight. If the result is blocked or unknown, stop immediately and report only the reason. Otherwise scan active and archived local Codex sessions, build only unprocessed user/final-answer records, review every bounded chunk from the bundled chunk preparer, request only minimal transcript evidence when needed, reconcile the combined durable behavior-memory decisions with managed project-root and global AGENTS.md blocks, and record a reviewable Suggest report with complete diffs. Show reviewable choices only as consecutive numbers such as 1, 2, and 3; keep stable decision IDs internal. Do not modify any target AGENTS.md in Suggest mode. Never switch to Auto unless the user explicitly changes the mode.
```

## Runtime Requirements

- Keep the computer on, the ChatGPT desktop app running, and the relevant local paths available.
- Use a standalone run so each day's output appears as an independent scheduled finding.
- Keep the default mode as Suggest. Never switch based on run count, acceptance rate, or historical success.
- Record the actual model, reasoning effort, quota observation, record IDs, and report path for every run.
- Have the user review output quality for the first few runs. Changing the prompt or schedule must not change decision policy.
