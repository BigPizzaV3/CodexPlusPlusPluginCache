# Project OS records

This directory stores repository-local working state for resumable engineering tasks. `AGENTS.md` routes Codex to the relevant records; it does not load every file for every request.

- `SYSTEM.json`: schema, Project OS release, mode, path mappings, capability packs, overlays and managed-guidance baselines.
- `WORKFLOW.md`: managed rules for intake, recovery and guarded closure.
- `requests.json`: user additions, routing and explicit resolutions.
- `CONTEXT.md`: durable project facts and verified commands.
- `STATE.md`: current checkpoint and next action.
- `plans/`: canonical execution registry, one-outcome Markdown plans and JSON acceptance contracts.
- `findings/`: concrete project defects and candidates.
- `evidence/`: sanitized linked verification.
- `knowledge/project/`: confirmed project-specific lessons.
- `knowledge/reusable/`: sanitized, reviewed and user-owned portable lessons.
- `packs/`: capability guidance selected from repository evidence. Language detection alone does not select behavior.

Do not put credentials, personal data, generated task diaries or application runtime assets here. `PROGRAM.md` exists only while an explicitly started multi-phase Program is active. `history/` is an optional tamper-evident archive whose indexed snapshots are verified by SHA-256.

Installing the Project OS skill, connecting this repository and opening a plan are separate actions. Ordinary engineering requests do not require `$project-os`; that prefix explicitly selects the skill for one message about the control plane. There is no central failure database, background service or automatic cross-repository synchronization. Reusable lessons move only through a reviewed import from another user-controlled repository or bundle. Files change only through an explicit edit or helper run.
