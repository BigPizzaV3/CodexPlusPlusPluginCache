# Workspace Contract

Career Command Center uses one user-selected workspace.

## Required files

- `Config/command_center_config.json`: profile, targets, CV preferences, and schedule.
- `State/cv_command_center_state.json`: active leads, archived leads, recently deleted records, and dedupe tombstones.
- `Evidence_Bank/CV_GENERATION_STANDARD.md`: mandatory CV strategy.
- `Evidence_Bank/Verified_Evidence_Ledger.md`: verified facts and boundaries.
- `Evidence_Bank/approved_evidence.json`: structured evidence IDs, claims, metrics, bullets, and boundaries.
- `Evidence_Bank/intake_answers.md`: user answers collected by the app.
- `Evidence_Bank/PERSONALIZED_QUESTION_STANDARD.md`: rules for source-specific follow-up questions.
- `Evidence_Bank/personalized_questions.json`: cited questions, user responses, and Codex review history.
- `Automation/automation_status.json`: latest run summary for the app.

## Directories

- `Documents/`: CVs, transcripts, certificates, recommendations, portfolio items, and other source documents.
- `Projects/`: project reports, source material, code exports, figures, and presentations.
- `Job_Postings/`: complete posting snapshots with source and verification timestamps.
- `Applications/`: one folder per promoted application package.
- `Logs/`: automation and quality reports.

## Lead lifecycle

Allowed statuses are `to_apply`, `monitor`, `applied`, `archived`, and `deleted`.

- `archived` remains in `leads` and must never return to an active queue unless the user restores it.
- `deleted_leads` holds recoverable recently deleted records.
- `lead_tombstones` holds minimal dedupe keys after deletion and permanent deletion.
- Never use `manual_check`. A verified lead is promoted; an unverified item is not added.
- Applied, archived, deleted, and tombstoned opportunities must not be rediscovered as new leads.

Unknown fields inside lead records must be preserved when state is updated.

## Personalized evidence questions

`personalized_questions.json` uses schema version 1 and must be updated through `scripts/question_cli.py` when Codex generates or reviews questions. The native app may update only response fields and lifecycle status when the user answers.

The app sets `audit_status` to `needs_refresh` when new documents or project material are imported, or when broad evidence answers change after an audit. Codex sets it to `current` through a successful question-generation pass. A current audit may legitimately contain zero questions.

Every generated question must cite at least one workspace-relative source path, locator, and short context. Active questions use `open`, `answered`, or `unable_to_verify`. Historical questions use `resolved`, `not_applicable`, or `superseded`.

- `open` requires a user response.
- `answered` and `unable_to_verify` require Codex review against the source files.
- `not_applicable` records the user's decision that the question does not apply.
- `resolved` records Codex's evidence decision and resulting evidence IDs when applicable.
- `superseded` retains audit history when a later generation no longer requires an unanswered question.

Do not build final role-family master CVs or activate recurring search automation while open questions or unreviewed responses remain. An `unable_to_verify` response is a valid evidence boundary and must never be treated as permission to infer the answer.

## Lead assessment schema

New and migrated lead records use `assessment_schema_version: 2` and five separate arrays:

- `match_strengths`: concrete, verified evidence that supports the opportunity fit.
- `fit_gaps`: capabilities or domain experience required by the role that the evidence bank does not currently demonstrate.
- `eligibility_constraints`: permit, location, language, travel, contract, schedule, or other practical conditions to confirm.
- `application_requirements`: transcripts, certificates, references, portfolio links, forms, deadlines, upload instructions, and other submission tasks.
- `search_notes`: source-verification or discovery context that is neither candidate fit nor an application task.

Fit scores measure evidence-to-role alignment. `application_requirements` and `search_notes` must never reduce the fit score or be presented as candidate weaknesses. Do not put submission logistics in `fit_gaps`. `rationale` and `concerns` are legacy compatibility fields only; new records must use the structured assessment arrays.
