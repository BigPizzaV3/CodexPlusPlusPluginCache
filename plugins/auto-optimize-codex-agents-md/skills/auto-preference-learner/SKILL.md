---
name: auto-preference-learner
description: Mine local Codex active and archived session history for durable user corrections, dissatisfaction, quality standards, communication preferences, and safety boundaries; then suggest or explicitly auto-apply scoped changes to project-root or global AGENTS.md managed blocks. Use when asked to optimize Codex behavior memory, review or withdraw learned AGENTS.md rules, run incremental daily AGENTS memory maintenance, or configure that maintenance as a scheduled task. Do not use to mine workflow Skills or rewrite unowned AGENTS.md content.
---
# Auto Preference Learner

Extract durable user corrections, acceptance standards, communication preferences, and safety boundaries from the user's active and archived Codex session history, then organize them as project or global rules in managed `AGENTS.md` blocks. Use user input and Assistant final answers as the primary material and produce a reviewable Suggest result first. Write only after the user accepts a Suggest or explicitly enables Auto mode; never promote Suggest to Auto. Do not use this Skill to export transcripts, mine workflow Skills, or modify unmanaged `AGENTS.md` content. When a broader request is legitimate but outside this Skill's purpose, explain the boundary and route that part to an appropriate capability instead of treating it as preference mining.

## What to Read

- For first-time or incremental mining, read `references/decision-policy.md` and `references/codex-session-fields.md`.
- To review an existing Suggest, read only the Suggest review and state sections of `references/decision-policy.md`.
- To configure a scheduled task, also read `references/scheduled-task-prompt.md`; create a task only when the user asks.
- On the first run, if no confirmed-Suggest commit preference exists, ask whether accepted project `AGENTS.md` changes should be committed automatically. Default to no and persist the choice.

## Workflow

1. For a scheduled run, execute `check_weekly_quota.py` first and stop unless `allowed` is `true`. Do not check quota for a manual run unless the user asks.
2. Run `scan_sessions.py` to discover active and archived JSONL, exclude explicit subagent sessions, and incrementally scan from cursors in state.
3. Run `build_conversation_records.py`. Keep only genuine user input, Assistant `final_answer`, trusted project roots, and source locations. Exclude injected context, commentary, reasoning, and tool activity.
4. Run `prepare_review_chunks.py` to split the source batch by project root, record count, and serialized size and create a manifest. Review every manifest chunk, produce project decisions for each, and merge them. Each project stays in one chunk unless a configured limit requires more. Chunks only bound model input; the source batch remains the unit of reconciliation, user authorization, and checkpointing.
5. Split multi-issue feedback into semantic atoms and compare them with current project and global rules, rejected candidates, and tombstones. Every project decision, including local no-op, must independently classify the atom's global disposition as `candidate`, `project-only`, or `already-global`. A record with no trusted project root may use a global decision, but its candidate must mark `explicit_global_intent: true` and still pass through the global aggregation stage. Every new record must be covered by trusted `evidence_refs`. If evidence is insufficient, use `search_transcript_evidence.py` to read the smallest relevant slice within that record's source lines, then replace the temporary `needs_evidence` with a final action.
6. After all project chunks are reviewed, run `aggregate_global_candidates.py prepare`. Review the resulting structured candidates together, including unresolved candidates carried from earlier runs, and disposition every candidate as `promote`, `keep`, `reject`, or `already-global`. Then run `aggregate_global_candidates.py finalize`. This cross-project aggregation is mandatory even when every project decision is a no-op; a project no-op is not a global no-op. Do not send raw transcripts into this global pass.
7. Run `reconcile_agents.py` on the finalized decisions. A project target must be the trusted root's `AGENTS.md`; the global target must be `$CODEX_HOME/AGENTS.md`.
8. If the plan contains errors or unresolved evidence, stop without calling apply or checkpointing. If nothing is worth persisting, cover the batch with specific no-op decisions; do not return an empty decisions array.
9. Run `apply_agents_update.py`. Suggest records the checkpoint, pending decisions, unresolved global candidates, and report without modifying a target. Only Auto or a user-confirmed Suggest may modify target files.

## Commands

Run from the Skill root. On Windows systems with non-ASCII paths, use `python -X utf8`. Store run artifacts under `$CODEX_HOME/auto-preference-learner/runs/<timestamp>/`; store long-lived `state.json`, `decisions.jsonl`, and `reports/` beside `runs/`.

```text
python -X utf8 scripts/check_weekly_quota.py --output <run>/quota.json
python -X utf8 scripts/scan_sessions.py --quota-result <run>/quota.json --state <state>/state.json --output <run>/manifest.json
python -X utf8 scripts/build_conversation_records.py --manifest <run>/manifest.json --state <state>/state.json --output <run>/batch.json
python -X utf8 scripts/prepare_review_chunks.py --batch <run>/batch.json --output-dir <run>/review
python -X utf8 scripts/aggregate_global_candidates.py prepare --decisions <run>/project-decisions.json --batch <run>/batch.json --state <state>/state.json --output <run>/global-candidates.json
python -X utf8 scripts/aggregate_global_candidates.py finalize --bundle <run>/global-candidates.json --global-review <run>/global-review.json --output <run>/decisions.json
python -X utf8 scripts/reconcile_agents.py --decisions <run>/decisions.json --batch <run>/batch.json --state <state>/state.json --mode suggest --quota-result <run>/quota.json --reasoning-effort high --output <run>/plan.json
python -X utf8 scripts/apply_agents_update.py --plan <run>/plan.json --batch <run>/batch.json --mode suggest --state-dir <state> --output <run>/result.json
```

For a manual run, omit the quota command and later `--quota-result` arguments. Pass `--since <ISO-date>` to the scanner when the user specifies a start date. Pass `--project-root <path>` only when the user explicitly authorizes an additional target project. `--model` records the actual model; it does not invoke or switch models.

When intermediate evidence is needed, run:

```text
python -X utf8 scripts/search_transcript_evidence.py --batch <run>/batch.json --record-id <R-id> --kinds <explicit-kinds> --line-start <n> --line-end <n> --output <run>/evidence.json
```

## Review and Apply

Show the user a concise reason, consecutive numeric choices, and the complete diff. Do not expose internal `decision_id` values. Accept natural-language acceptance, edits, rejection, or withdrawal.

```text
python -X utf8 scripts/apply_agents_update.py --plan <run>/plan.json --batch <run>/batch.json --mode confirmed-suggest --selection <number> --state-dir <state>
python -X utf8 scripts/apply_agents_update.py --plan <run>/plan.json --batch <run>/batch.json --mode suggest --reject-selection <number> --state-dir <state>
python -X utf8 scripts/apply_agents_update.py --set-confirmed-suggest-commit yes|no --state-dir <state>
```

Use `--all` only when the user explicitly accepts every proposed change. Follow `references/decision-policy.md` for edited acceptance, withdrawal, restoration, and Auto state rules. Pass `--mode auto` to both reconcile and apply for Auto; never reuse an old Suggest plan.

## Write Boundary

Manage only this block, preserving any UTF-8 BOM, newline style, and content outside it:

```md
<!-- auto-preference-learner:start -->
## Learned working preferences

- ...
<!-- auto-preference-learner:end -->
```

Stop if the target is a symbolic link, the markers are malformed, or the resulting file would exceed 32 KiB. A Git commit may contain only the target `AGENTS.md`. Do not checkpoint after a write or commit failure.
