# Scheduling

Test one manual search before scheduling it. Treat the automation handoff as a required milestone, not optional closing copy.

During the readiness receipt, set the expectation once:

> After this first search, I’ll ask whether you want me to make it a daily or weekday Scheduled task.

At the end of the first completed manual search that returns at least one exact verified role, proactively use this visually separate invitation in the same response—even when every role is Maybe or Skip:

> Want me to make this search automatic? I can create a Scheduled Career Centre task here to run daily or on weekdays. Reply with the cadence, time and timezone (for example, “Weekdays at 8:00 AM Perth time”); I’ll keep the current role limit unless you change it.

If the user proceeds to an application pack without accepting, declining or creating a schedule, repeat the invitation once after the first completed pack. This is the recovery gate for a missed or ignored first-search offer. Do not repeat after an explicit decline or when a schedule already exists.

Do not ask the user to configure automation during first-time setup; the readiness sentence is expectation-setting only. If the user accepts, confirm only missing details:

- cadence and local timezone;
- preferred run time;
- maximum displayed roles, default five;
- application packs on request by default.

Never auto-submit. Never tell the user to upload the plugin ZIP every day. It is installed once.

`Do not create a schedule` means no schedule may be created; it does not suppress this invitation because the invitation changes no external state. Suppress the invitation only when the user explicitly says not to mention, offer or discuss recurring searches. Before sending the search response, silently verify that the invitation is present once, after the mentor verdict and role details. Do not bury it inside role details.

## Acceptance handling

ChatGPT Work and Codex tasks can create or update Scheduled tasks, and Scheduled tasks can use installed plugins and skills. Therefore:

1. If cadence, time or timezone is missing, ask only for the missing value.
2. When cadence, time, timezone and role limit are known and the user has accepted, create the Scheduled task immediately with the host scheduling capability. Do not add another confirmation round.
3. Prefer scheduled work returning to the current Career Centre task so it can use that task's existing context.
4. After creation, show a compact receipt: task name, cadence, timezone, role limit, destination, application-pack boundary and manual-submission boundary.
5. If the user asked for a preview, show the exact saved prompt and schedule but do not create anything.

If the current ChatGPT surface cannot create Scheduled work, do not imply success. Give this copy-ready fallback and one route:

> Open **Work**, return to this Career Centre task if available, and paste: `Create a Scheduled task from this task. On [daily/weekday cadence] at [time] [timezone], use Career Centre and the Career Passport available here to run my calibrated role search. Return at most [role limit] verified roles with exact posting URLs, salary context and Apply/Maybe/Skip decisions. Reconcile roles already reviewed in this task. Do not create application packs automatically and never submit an application.`

As a second fallback, direct the user to **Scheduled** in the left sidebar, then **New task**, and give the same prompt. Keep the fallback to one short instruction block.

## ChatGPT Work default: current-task context

Create the schedule from the existing Career Centre Work task and return each run to that task. The task can use its existing conversation context, uploaded files, installed skills and plugins. Keep the latest Career Passport attached or otherwise available to the task and include durable search instructions in the scheduled prompt.

Use `destination: continuing_task` and `continuity_mode: task_context` when this route is available. The prompt must invoke Career Centre explicitly, preserve exact-link, salary, evidence and no-submit rules, and reconcile the task's role history before browsing. Do not claim cross-account or unrelated-chat memory.

Recommended default:

> On weekdays at 8:00 AM local time, use Career Centre in this task and the latest Career Passport available here to run the calibrated role search. Return at most five verified roles with exact links, salary context and Apply/Maybe/Skip decisions. Reconcile earlier reviewed and applied roles before browsing. Do not create application packs automatically and never submit an application.

## Optional Indeed discovery extension

Automation is the primary next action. Only after the user has created, declined or deferred the schedule may ChatGPT optionally suggest the official Indeed plugin for broader discovery when it is relevant to the user's market. Use:

> Want a broader Indeed discovery pass as well? Install Indeed, then try: `@Indeed find me roles matching [target titles] in [location] above [salary if relevant]`. Bring promising links back here and I’ll verify the exact posting, salary, employment type and fit before you apply.

Do not treat Indeed results as verified roles. The exact employer or authorised-recruiter posting remains the source of truth.

## Standalone fallback: snapshot-backed alert

Use a standalone scheduled task only when the user wants independent runs or the host cannot return to the current task. Embed a compact, evidence-safe Passport snapshot, suppress duplicates against that snapshot and within the current run, and disclose that later standalone runs may repeat a role because they do not necessarily receive state written by an earlier run. Use `destination: scheduled_result_task` and `continuity_mode: snapshot_only`.

## Verified persistent mode

Use `verified_persistent` only when every run can demonstrably load the latest valid Passport and save the updated Passport where the next run will receive it. If either operation fails, return `BLOCKED` with one recovery action instead of silently resetting state.

Store confirmed schedule settings under the Passport's optional `automation` object. When code execution is available, run `python scripts/build_schedule_prompt.py <Career_Passport.json>` and save the output in the host schedule. After creation, show a short receipt with cadence/timezone, result limit, document/submission boundary and continuity mode. Review the first few runs and recalibrate sources or gates if results are weak.
