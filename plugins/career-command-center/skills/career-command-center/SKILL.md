---
name: career-command-center
description: Install, set up, open, diagnose, or operate Career Command Center; manage its job and PhD search automation; audit career evidence; build role-family master CVs; tailor application packages; or sync app search and schedule settings with Codex. Use when the user mentions Career Command Center, targeted career search, the app's setup wizard, its application queue, or its recurring automation.
---

# Career Command Center

Use the bundled app for user input and lifecycle management. Use Codex for evidence auditing, web research, document generation, quality review, and scheduled runs.

`PLUGIN_ROOT` is the plugin directory containing this skill. Scripts live in `PLUGIN_ROOT/scripts`; references live in `PLUGIN_ROOT/references`.

## First Setup

1. Choose a workspace. Prefer the current Codex project when the user wants automation in that project; otherwise use `~/Documents/Career Command Center`.
2. Run:

```bash
python3 PLUGIN_ROOT/scripts/bootstrap_workspace.py WORKSPACE
python3 PLUGIN_ROOT/scripts/install_app.py --workspace WORKSPACE
```

3. Tell the user the app has opened and ask them to complete every wizard step. New setup is deliberately neutral: no role family, country, opportunity type, seniority, CV language, photo policy, or recurring schedule should be assumed. Do not register an automation before `onboarding_completed` is true.
4. When the user returns with `Finish Career Command Center setup`, run `doctor.py WORKSPACE` and read:
   - `Config/command_center_config.json`
   - `Evidence_Bank/intake_answers.md`
   - `references/CV_GENERATION_STANDARD.md`
   - `references/PERSONALIZED_QUESTION_STANDARD.md`
   - `references/WORKSPACE_CONTRACT.md`
5. If evidence blocks and approved masters are missing, begin the evidence foundation before scheduling:
   - Inventory and extract every CV, transcript, certificate, recommendation, report, and project file.
   - Write the verified portion of `Evidence_Bank/Verified_Evidence_Ledger.md` and structured `approved_evidence.json`, keeping unresolved claims out of approved evidence.
   - Identify only unresolved, high-impact gaps that satisfy the personalized-question standard. Do not repeat generic onboarding questions or ask for facts already stated clearly in a source.
   - Create a temporary generation payload and run `question_cli.py --workspace WORKSPACE generate --input PAYLOAD`. Every question must cite the source path, locator, and ambiguity that triggered it.
   - Run `question_cli.py --workspace WORKSPACE summary`.
   - Treat `audit_status: needs_refresh` exactly like a new evidence pass. Re-audit the newly imported or changed material and run question generation even when the result is an empty question list.
6. If the summary reports `needs_user_answer` greater than zero, tell the user that personalized questions are ready in the app's **Questions** workspace. Do not dump the same questionnaire into chat, build final master CVs, or activate automation yet. The app's **Review in Codex** action will bring the user back after responses are saved.
7. When the user asks to review saved evidence answers:
   - Read all `answered` and `unable_to_verify` questions and reopen every cited source.
   - Update the verified evidence ledger and `approved_evidence.json` only where the response and source support the claim. Record `unable_to_verify` as a boundary or exclusion.
   - Create a review payload and run `question_cli.py --workspace WORKSPACE review --input REVIEW_PAYLOAD` with a concise decision note and resulting evidence IDs for every reviewed item.
   - Generate a new cited question only when the response creates a material unresolved ambiguity. Resolve the original first; never silently rewrite an answered question.
   - Run the summary again. If questions remain open or answers await review, return the user to the Questions workspace and stop before master-CV generation.
8. Once no questions need an answer or Codex review, complete the evidence foundation:
   - If `inferRoleFamilies` is true, infer coherent role families from verified evidence and the user's stated direction. Otherwise use the explicit user categories.
   - Build coherent role-family master CVs using those evidence-supported families and the CV standard.
   - Render and visually inspect PDF and editable-source output.
   - Register approved master paths in both config and evidence JSON with `register_masters.py WORKSPACE --master FAMILY=PATH` (repeat `--master` for each family).
9. Run `state_cli.py --workspace WORKSPACE migrate-assessments`, then `doctor.py WORKSPACE --strict`. Resolve blockers and evidence-readiness warnings.
10. Run `render_automation_spec.py WORKSPACE`.
11. If its status is `ACTIVE`, use its full prompt and schedule to create or update the one existing Career Command Center automation with the Codex `automation_update` tool. Do not create a duplicate automation. The automation must target the Codex project containing `WORKSPACE`.
12. If its status is `PAUSED`, do not create an automation. Pause or delete a previously registered Career Command Center automation if one exists.
13. Only after the requested active or manual state is reflected in Codex, run:

```bash
python3 PLUGIN_ROOT/scripts/mark_automation_synced.py WORKSPACE --automation-id AUTOMATION_ID
```

## Open or Diagnose the App

- Open: `open ~/Applications/'Career Command Center.app'`.
- Reinstall or update: run `bootstrap_workspace.py WORKSPACE` first to add missing non-destructive workspace contracts, then run `install_app.py --workspace WORKSPACE`.
- Diagnose: run `doctor.py WORKSPACE`.
- Never overwrite user documents, evidence, lead state, or application packages during an app update.

## Sync Settings

The automation reads search countries, opportunity types, work arrangements, role families, thresholds, and exclusions from config on every run. Those edits do not require prompt rewriting.

Frequency, day, time, enabled state, and automation ID changes require synchronization:

1. Render a fresh spec.
2. Update the existing automation by ID.
3. Mark synchronized only after the tool succeeds.

## Run a Search Now

When asked to run now, read the current config and execute the rendered automation prompt in the current task. Do not alter the saved schedule. Use web research because active postings are time-sensitive.

Use `state_cli.py upsert` for every promoted lead and `state_cli.py record-run` at completion. Never directly rewrite state with string manipulation.

## User Control and Data Handling

- Treat the selected workspace as private career data. Read only files needed for the requested workflow and never publish or transmit them outside Codex without the user's explicit instruction.
- The companion app stores its state in the user's workspace and has no developer-operated backend or telemetry.
- Never submit an application, send a message, contact a recruiter, or accept legal terms on the user's behalf unless the user explicitly requests that specific external action and the active environment supports approval.
- Never fabricate employment facts, dates, skills, education, metrics, project ownership, publications, or language ability. Mark estimates and shared work honestly. Ask for clarification when a material claim cannot be verified.
- Put source-specific evidence questions in `personalized_questions.json` so the user can answer them in the app. Use chat questions only when the app queue is unavailable or the user explicitly prefers chat.
- Explain when a third-party job board, employer portal, or document converter will receive user data before using it.

## Lifecycle Rules

Read `references/WORKSPACE_CONTRACT.md` before state work.

- Never rediscover applied, archived, recently deleted, or tombstoned postings.
- Never create `manual_check`. Promote a verified opportunity or omit it.
- Archive is reversible.
- Delete is recoverable until permanent deletion.
- Permanent deletion retains a minimal dedupe tombstone.
- Never delete generated application files automatically.
- Preserve unknown lead fields.
- Write new assessments using `match_strengths`, `fit_gaps`, `eligibility_constraints`, `application_requirements`, and `search_notes` as defined in the workspace contract.
- Fit scores measure evidence alignment only. Application materials, deadlines, and submission logistics are never fit penalties.

## CV Rules

Read `references/CV_GENERATION_STANDARD.md` before evidence, master-CV, or package work.

- Build the verified evidence foundation before tailoring.
- Do not approve a master CV while personalized questions or unreviewed answers still block material claims.
- Start each tailored CV from one approved role-family master.
- Keep fixed facts and core accomplishments stable.
- Target through evidence choice and order, not visible fit commentary.
- Label estimates and shared contributions honestly.
- Record strategy version, base master, and evidence IDs in tailoring notes.
- Render and inspect all delivered documents; a package with a blocker is not ready.

## Support

For installation or behavior problems, consult `SUPPORT.md` in the plugin root. The public privacy policy and terms are in `PRIVACY.md` and `TERMS.md`.
