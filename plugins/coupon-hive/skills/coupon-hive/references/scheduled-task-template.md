# Scheduled watch handoff

## Platform boundary

The skill does not contain a scheduler. A recurring watch exists only when the active host's recurrence capability returns a successful receipt. ChatGPT uses Scheduled Tasks; Codex uses separate automations. Scheduled Tasks are not supported inside a Custom GPT conversation; in that surface, give the user the reusable prompt below and explain that they must use a regular ChatGPT chat or a separate Codex automation.

Prefer a task attached to the same chat so prior results can support duplicate suppression. If the host can only create a standalone task, use the exact deterministic rendered prompt and embedded recurrence-core projection, and explain that cross-run memory may be limited.

## Preflight

Before asking the host to create or update a task:

1. manually run the search once and show representative output;
2. resolve and show the complete Watch Card, proposed create or update binding, host surface, single-line task title, prompt template ID, exact rendered prompt, prompt-content digest, requested compound lifecycle action, and every normalized actionable setting; compute and show the canonical approval digest described below;
3. state the cadence, timezone, quiet behavior, alert triggers, and stopping condition in plain language;
4. obtain the user's explicit confirmation of that Watch Card, exact host payload, proposed task and lifecycle actions, schedule, and digest, then create a confirmed WatchSpec by adding the confirmation and confirmed status required by the schema without changing any digest-bound value.

Do not interpret approval of the search as approval to schedule it.

## Semantic validation

Reject the handoff rather than silently repairing it unless all of these are true:

- status is confirmed and the confirmation records true user confirmation, its RFC 3339 timestamp, the exact normalized Watch Card summary the user approved, and the matching canonical approval digest;
- create has no existing task identifier, while update names the exact existing task returned by the host;
- `host_payload` identifies `chatgpt_plugin` or `codex_skill`, uses template `coupon-hive-recurring-v1`, has a single-line title beginning `Coupon Hive —`, binds the deterministic prompt's exact UTF-8 bytes, and names at most one compound pause or resume action;
- the timezone resolves as a real IANA name or UTC and the structured recurrence is hourly or less frequent; stricter account or workspace limits still apply;
- maximum queries and sources per run are explicit and within the schema caps;
- allowed and blocked merchant lists do not overlap after domain normalization;
- free_now_only accepts only free_now, and every accepted conditional offer type has the matching condition set true;
- weekly schedules name at least one weekday, daily and weekly schedules have a valid local time, monthly schedules use a day from 1 through 28, and hourly schedules use a minute from 0 through 59;
- non-hourly schedules set `minute` to null; quiet-hour bounds differ, and a fixed local run time is not inside them; hourly watches with quiet hours are rejected because this release cannot enforce that exclusion safely;
- a price-threshold event has an amount or percentage threshold and an expiry event has warning hours;
- timestamps are RFC 3339 with an offset, and any deadline or end is after the recorded confirmation;
- the schedule has an end date or maximum run count when the user's request is naturally finite;
- task titles and prompts contain no unnecessary sensitive information, and the title and rendered prompt passed to the host match the confirmed payload byte for byte.

### Canonical approval digest

Before confirmation, bind the exact Watch Card summary as `watch_card_summary` together with the proposed `task_binding`, `host_payload`, `query`, `scope`, `economics`, `accepted_offer_types`, `conditions`, `sources`, `schedule`, and `notification` objects. Serialize that object with UTF-8 JSON, keys sorted recursively, no extra whitespace, and non-ASCII characters preserved. Reject non-finite numbers. Show the resulting lowercase `sha256:` digest to the user. After the user confirms, add the separately validated confirmation flag and RFC 3339 timestamp and copy the unchanged digest into `confirmation.approved_spec_digest`.

The deterministic validator recomputes this digest. A mismatch fails closed. It also re-renders the recurring prompt and requires its exact UTF-8 content digest to equal `host_payload.recurring_prompt_sha256`. This derivation excludes confirmation, status, task title, lifecycle actions, and the prompt digest itself to avoid a cycle; those other host fields are still bound directly by the approval digest. Immediately before mutation, re-render and byte-compare the exact prompt passed to the host. The approval digest proves only that the displayed Watch Card and actionable fields were not changed afterward; it intentionally excludes confirmation metadata that cannot exist before the person confirms. It does not replace explicit user confirmation, the recorded confirmation time, the live pre-mutation end-time check, or a host mutation receipt.

Use one WatchSpec per independently scheduled target, threshold, or cadence. When multiple tasks are requested, validate and mutate them independently. If one succeeds and another fails, report each returned receipt, describe the partial state, and offer to roll back the successful task. Never hide an orphaned or partially updated watch.

For an update, resolve the exact existing task from a host-returned identifier or an unambiguous task listing. If more than one task could match, ask the user to choose; never create a replacement as a shortcut. A WatchSpec may bind one compound pause or resume after an update. Perform the update first and normalize its returned receipt; `validate_compound_update_receipt` must match the confirmed host surface, task ID, title, structured cadence, and timezone before the lifecycle call may run. Normalize the separate follow-up result and require `validate_compound_lifecycle_receipt` to match the same target, exact bound action, receipt order, success status, and expected paused or active final state. Preserve both receipts. Delete is never a compound WatchSpec action. When a compound request only partly succeeds, report which mutation receipts succeeded, which failed, and the remaining live state; offer a safe retry or restoration without duplicating the task.

Pause, resume, and delete are host lifecycle mutations, not WatchSpec task_binding actions. Do not rewrite a standalone action as create or update. For one standalone action, construct the separate object in [lifecycle-spec.schema.json](lifecycle-spec.schema.json), display its Lifecycle Card and canonical digest, and obtain new explicit confirmation. The digest binds the host surface, exact returned task ID, exact title, action, expected current state, expected final state, and card summary. Validate with `validate_watch_spec.py --lifecycle LIFECYCLE_SPEC.json`. Immediately before dispatch, re-list the task and require `validate_observed_lifecycle_target` to match its current ID, title, surface, observation time, and observed active or paused state to the confirmed precondition. Then run `prepare_authorized_lifecycle_plan` and `validate_lifecycle_dispatch_plan` before translating only that plan into the native host call. Normalize the result and require `validate_lifecycle_receipt` to match the same target, action, observation ordering, and final state. Never reuse search approval, schedule approval, or a prior lifecycle confirmation. Ask the host to translate a validated structured schedule into its supported recurrence format and use the host's validation result; do not hand-author an unvalidated RRULE.

Compute the LifecycleSpec digest over an object with exactly `mutation` and `lifecycle_card_summary`, using the same canonical UTF-8 JSON rules as a WatchSpec. Show that lowercase `sha256:` value before confirmation. Only after the user confirms may you add the confirmation flag, RFC 3339 time, copied digest, and confirmed status. Scope one LifecycleSpec confirmation to one intended host call and mark it consumed in retained conversation or host state. The stateless digest cannot by itself prove first use or prevent replay; a retry after an uncertain or failed result requires resolving current state and obtaining a new confirmation.

One confirmed WatchSpec likewise authorizes one create or update transaction. For an unknown, timed-out, or ambiguous create result, list and resolve the exact title and host receipt before doing anything else; never retry create blindly. For an update followed by pause or resume, do not run the lifecycle action if the update fails. If the update succeeds but the lifecycle action fails, report the partial live state and require a fresh confirmation before retrying or compensating; never auto-delete or auto-rollback.

Immediately before mutation, recheck that any `ends_at` is still in the future. An `ends_at` or `maximum_runs` stopping condition is valid for creation only when the host can bind it natively and the returned receipt confirms that bound. Do not rely on prompt memory as a run counter. If the host cannot enforce the requested stop, present the limitation and obtain a newly digested confirmation for an explicit indefinite schedule or create no task.

## Reusable task prompt

Template `coupon-hive-recurring-v1` is deterministic. Its normative renderer is `render_recurring_prompt` in [validate_watch_spec.py](../scripts/validate_watch_spec.py). It selects exactly one invocation string from `host_surface`: `the selected Coupon Hive Plugin` for ChatGPT or `$coupon-hive` for Codex. It then appends a canonical compact JSON projection containing only `schema_version`, `skill_version`, `query`, `scope`, `economics`, `accepted_offer_types`, `conditions`, `sources`, `schedule`, and `notification`, in that order before recursive key sorting. JSON uses UTF-8, preserved non-ASCII characters, sorted keys, comma/colon separators with no extra whitespace, and no non-finite numbers.

Select the Coupon Hive Plugin in ChatGPT before using the ChatGPT rendering; use the skill invocation in Codex. Do not assume either selector works on the other host.

Line endings are LF and the renderer's output is a versioned contract. Any normative wording, whitespace, invocation mapping, projection, or serialization change requires a new prompt template ID and skill version plus regenerated fixtures and a migration review; never silently change `coupon-hive-recurring-v1`.

Do not hand-edit, paraphrase, append state to, or replace the rendered prompt after confirmation. Re-render it immediately before mutation, require the exact `sha256:` content digest in `host_payload`, and pass the same string bytes to the host. Use `prepare_authorized_mutation_plan` and `validate_mutation_dispatch_plan` to compare the host-neutral surface, task action and ID, title, rendered prompt bytes, structured schedule, and compound lifecycle list. Translate that checked plan into host-native calls without semantic change; the host may translate only its structured schedule into a native recurrence representation, and its validation or mutation receipt must confirm the same cadence and timezone. Keep prior fingerprints in the task's attached chat or host state rather than editing the confirmed prompt. If the host would normalize or rewrite the body, fail closed and give the user the exact reusable text instead.

The rendered prompt tells the scheduled run to treat that JSON as its complete authority boundary, use only host-authorized public-web research, respect access controls, verify and timestamp first-party evidence, classify conditions, avoid all transactions and credential requests, and fail closed when the required skill, research, validation, or host receipt is unavailable. Stay quiet when nothing actionable changed unless the confirmed notification policy requests a digest. The checked renderer output—not a manually reconstructed example—is the prompt of record.

## Receipt and controls

After creation or update, report only values returned by the host:

- task name and identifier;
- cadence, timezone, and next run;
- notification behavior;
- where to update, pause, resume, or delete it.

Use a stable title beginning “Coupon Hive —”. Offer a discreet suffix rather than embedding a potentially sensitive product or service name.

If a create call fails or is unavailable, say “No recurring task was created,” preserve the prompt for reuse, and offer manual reruns. If an update, pause, resume, or delete fails, never use creation language: say which mutation was not applied and, if the host can establish it, that the existing task remains live in its last receipted state. Plugin removal does not necessarily remove tasks already created; remind the user to pause or delete those separately.
