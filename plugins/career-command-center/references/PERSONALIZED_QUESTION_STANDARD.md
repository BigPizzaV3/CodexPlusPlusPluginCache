# Personalized Evidence Question Standard

Career Command Center uses personalized questions to close material evidence gaps after Codex has read the user's CVs, transcripts, project files, and initial intake answers. These questions are not a second generic questionnaire.

## Purpose

Generate a question only when its answer could materially improve evidence accuracy, project depth, role-family selection, or CV wording. A useful answer should change at least one of:

- an approved evidence claim or boundary;
- a measured, estimated, or excluded metric;
- the user's personal ownership within shared work;
- a project result, engineering decision, or technical method;
- chronology or contradiction handling;
- an important search or eligibility constraint.

Do not ask for information already stated clearly in a source. Do not ask low-value biographical questions, repeat the broad onboarding prompts, or ask the user to narrate an entire project.

## Required question shape

The canonical file is `Evidence_Bank/personalized_questions.json`, with `version: 1`, an `audit_status`, and a `questions` array. Generate and update it through `scripts/question_cli.py`.

`audit_status` is `not_started` before the first audit, `current` after a successful generation pass, and `needs_refresh` after the app imports new source material or saves changed background answers. A new generation pass must clear `source_change_note` and set the audit status to `current`, even when no questions are needed.

Every generated question requires:

- `id`: stable lower-case identifier using letters, numbers, dots, underscores, or hyphens;
- `priority`: `critical`, `high`, or `medium`;
- `category`: `metric`, `ownership`, `outcome`, `method`, `timeline`, `contradiction`, `eligibility`, `direction`, or `other`;
- `question`: one direct, answerable question ending with a question mark;
- `why_it_matters`: a concrete explanation of what the answer can change;
- `source_refs`: at least one workspace-relative source reference;
- `related_evidence_ids`: existing evidence IDs when applicable.

Each source reference requires:

- `path`: workspace-relative file path with no `..` segment;
- `label`: concise human-readable source name;
- `locator`: page, section, slide, worksheet, filename, code area, or another useful locator;
- `context`: a short paraphrase of the ambiguity that triggered the question.

Never place a suggested answer in `context` or `why_it_matters`.

## Priorities

- `critical`: unresolved contradiction, authorship boundary, eligibility fact, or metric that would make a material CV claim unsafe.
- `high`: missing result, method, ownership detail, or chronology that substantially limits a strong experience or project.
- `medium`: useful specificity that can improve selection or wording but does not block truthful CV generation.

Use `critical` sparingly. The initial audit should normally contain no more than 12 active questions. A later audit should ask only genuinely necessary follow-ups.

## Wording rules

- Ask about one issue at a time.
- Name the project, role, or source detail that created the question.
- Prefer an ordinary human sentence over audit language.
- State the ambiguity without implying that a stronger answer is expected.
- Allow `unable_to_verify` to be a complete and useful response.
- Do not ask the user to invent a KPI, reconstruct unavailable data, or claim team work as individual work.

Good:

> The Logitech report describes a possible 50% reduction in configuration time. Was that figure measured against a baseline, estimated from the workflow, or proposed as a target?

Bad:

> Tell me more about your Logitech project and its impact.

## Lifecycle

Question statuses are:

- `open`: needs a user response;
- `answered`: response saved and awaiting Codex review;
- `unable_to_verify`: user cannot support the requested detail and Codex must record the boundary;
- `not_applicable`: user confirms the question does not apply;
- `resolved`: Codex reviewed the response and updated or excluded evidence;
- `superseded`: a later audit no longer requires the question.

Codex must review `answered` and `unable_to_verify` responses before building final role-family masters. For each reviewed response, update the verified evidence ledger and `approved_evidence.json` as appropriate, then record a concise `review_note` and any resulting `related_evidence_ids` through `question_cli.py review`.

If a response creates a new material ambiguity, resolve the original question and generate one new cited follow-up. Do not silently rewrite an answered question.
