# Reviewed workflow

0. Complete first-use media setup BEFORE touching a source: run `setup --check --json`. Missing/unusable FFmpeg or FFprobe means pause and present the browser/terminal routes in `references/ffmpeg-setup.md`; the user installs personally, then rechecks. Only an explicit user opt-out permits `setup --basic`. Installation consent is never file-operation consent. Check the actual local/remote execution environment.
1. Select one exact source root and an existing report directory outside it. Identify backups, cloud-managed folders, project references and other exclusions. Add `.tidyguardianignore` before inventory.
2. Run `catalog`. Use `catalog.json` for planning; `catalog.csv` and `skipped.csv` are human reports. Read skipped/errors before treating the inventory as complete. `--media-dates` explicitly enables local media metadata inspection.
3. Run `plan-move`, `duplicates`, or `cleanup-metadata`. Each generates a fresh `plan.json`, `candidates.csv`, `review.html` and receipt. Planning never grants execution permission.
4. Open the offline review page. Filter, inspect retained copies, select exact rows and export `selection.json`. The export cannot change source files and is not an approval token.
5. Run `apply-plan --plan ... --selection ... --output-dir ...` without `--execute`. Resolve any stale state or collision by regenerating and reviewing a plan, not by overriding validation.
6. Have the user personally run the same command with `--execute` in an interactive terminal. Each action type requires its own exact confirmation. Never approve on behalf of the user or interpret a broad cleanup request as permission to quarantine.
7. Keep the unique run's plan, selection, receipt and journal. Stop on interruption or error. Some approved operations may already have completed; the program never silently expands the batch or performs destructive rollback.
8. For reversal or interrupted-move recovery, run `restore-plan --journal ... --output-dir ...`, review the fresh plan and apply with a separate RESTORE confirmation. Changed files, occupied original locations and uncertain states require manual review.

## v1 migration

Legacy `apply-move`, `delete-verified` and `cleanup-metadata --execute` fail before reading inputs or modifying source files. Without `--execute`, legacy CSV import commands generate new reviewed plans only. `delete-verified` now proposes reversible quarantine. Do not restore direct deletion to preserve script compatibility.

## What this workflow intentionally does not do

No permanent deletion, automatic purge, directory removal, project/package splitting, cross-filesystem copy/delete, Windows mutation or scheduled execution. All automation should stop at reports until a genuine trusted approval surface is integrated.
