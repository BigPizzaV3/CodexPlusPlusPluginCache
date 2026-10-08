# Progress Contract

Users should feel the agent is working, not hiding.

## Before Paid Work

For a selected Canvas target, use the Canvas skill's `canvas paid preflight` instead of the queue
commands below. Show its sheet and follow its effective `require` / `skip` policy; do not add an
unconditional approval round or change the user's stored settings. Its bound-plan and recovery guards
remain mandatory in both modes.

Run the local preflight check first:

```bash
"${PVX}" quote queue <queue.json>
"${PVX}" quote queue <queue.json> --format markdown
```

Then say briefly:

- whether this is a direct task, controlled shot, short-film production, or long-form batch, and why
- what will be generated
- how many paid PixVerse generation tasks/materials are planned
- which model and key parameters each task will use
- the displayed membership and effective account route (Free/Basic pauses for upgrade or explicit fallback consent)
- whether the account balance is readable and non-empty
- whether it is exploration or final render
- what will be checked after

Do not quote an exact price; the real credit charge is usually only available after generation. If
login is missing, say clearly that nothing started, run `"${PVX}" pixverse auth login --json`, open its
emitted OAuth URL in Codex IAB according to `web-handoff.md`, then run `doctor`. If balance is empty or
unknown, stop and offer the structured subscription IAB handoff from `"${PVX}" pixverse subscribe`
when the user wants to recharge or upgrade.

On Free/Basic or any model-entitlement rejection, stop new submissions and show the clickable
subscription/recharge link. Wait for upgrade or explicit fallback choice under `./quality-policy.md`.
After upgrade refresh account/entitlement and balance; after fallback consent prepare v6 540p /
Nano Banana 2 Lite 1080p and show a fresh preflight. Preserve completed assets and unknown task IDs.
An unrestricted test-account override requires an explicit user statement and preserves all other gates.

Keep the preflight lightweight. For a straightforward one-task edit or generation, do not build route boards, dependency graphs, or dry-run loops unless they reveal a real blocker. Mention advisory notes compactly, but do not let them delay generation.

Retries, fixes, reworks, failed-task replacements, audio repairs, and extra variants follow the same rule. If the next step creates new PixVerse media and can spend credits, show a fresh preflight and follow the effective confirmation policy. Automatic execution covers bounded repairs within the agreed deliverable; failures do not authorize unlimited retries.

Example:

```text
I will make three image territories first, then use the strongest as the video anchor. That submits three image generation tasks now; video waits until the visual route is clear. Your account balance is readable and non-empty.
```

Default effective policy is `skip`: after preflight, continue immediately with
`"${PVX}" queue run <queue.json>`. This includes the first batch and later stages.
Use `./generation-confirmation.md` for concise progress copy. No confirmation reply or
previous generation receipt is needed. Avoid repeating a billing form at every stage.

If the user asks to control spending or confirm each batch, record `require` for the
project before submitting. Only then show the prepared batch and wait for explicit
approval before `queue run --confirmed`. Offer “Allow future generation” to restore automatic
execution. A newer project choice acknowledges the current global setting; a later
global choice supersedes older project choices. Follow the effective policy.

Empty balance, login failure, invalid parameters, unresolved submissions and other
hard execution blockers still stop the run. Respect the user's budget and project scope.

## During Waits

For long tasks, give timely, useful updates. Host-tool round trips are often slower than the local CLI itself, so keep the queue inside one long-lived yielded/background command instead of repeatedly launching status commands. When the host supports it, yield promptly and poll the same command session every 20–30 seconds.

Never leave an active user-facing generation silent for more than 45 seconds. A useful update explains creative movement, not only provider state:

- "Submitted 2 video tasks; I will keep this same session alive and update you at the next useful milestone."
- "Video slot is full, waiting rather than resubmitting."
- "shot_01 still Generating, code 10; elapsed 1m30s; task 123..."
- "The board is done; using it as the reference for the film render."
- "Two of five assets are ready; the finished world board has unlocked both story shots."

Do not spam per-second logs. The CLI should emit task-level lines only when provider state or progress percentage changes; a 30-second studio heartbeat owns repeated no-change reassurance. Translate its overall ready/rendering/waiting/failed counts into natural commentary. If the CLI returns `progress_percent`, show it; otherwise show status, elapsed time, asset role, and task id only when useful. Report generation success from a terminal provider result; claim visual or technical QA only when it was requested and actually performed.

The initial paid submission is also a wait state. If PixVerse has not returned a task id within the feedback interval, say that the same request is still in flight and that no duplicate retry was sent. If the submission itself times out, report the structured `submit_timeout_unknown` state: no task id was returned, provider receipt and credits are unknown, no duplicate retry was sent, and dependent paid tasks were stopped. Never turn that uncertainty into a traceback or an automatic retry. After generation succeeds, `queue run` downloads the asset and emits `Local preview ready` with an absolute `local_path`. Show the primary image/video from that local file immediately, before deep QA, credit attribution, ledger reconciliation, or packaging. Provider URLs are audit/share metadata and must not be used as Codex inline preview sources. If the free download fails, report it and retry the free localization rather than running QA or regenerating.

For a Canvas paid batch, use one bounded `canvas paid follow` call rather than repeated host-tool status
commands. It may keep running after emitting the first `Canvas node ready` line; show the Canvas preview
immediately, then continue waiting on the same process for the remaining nodes. A terminal node is ready
for preview and downstream work even when audit attribution is incomplete. The Canvas skill's
**Cloud Preview And On-Demand Delivery** contract applies only to an explicitly selected Canvas target:
no automatic download, local QA, or post-generation balance refresh, including after success. Use
`--download` and `--credits` only for the respective explicit user request. Unrequested work is
`not_requested`; unverified technical properties are `not_checked`. Treat dependency `BLOCKED` as
nonterminal while an upstream followed node is still running. For requested downloads only, retry a
failed free localization at most three times; never substitute an arbitrary historical task ID or
regenerate the media to repair a download. IAB failure means return the Canvas link, not auto-download.

A fast asset download should return immediately without waiting for a scheduled update. Only when it remains active should the CLI emit an early follow-up, measure local byte growth and recent throughput, then adapt later download heartbeats from a few seconds up to 30 seconds. Slow or stalled starts need reassurance; fast transfers and already-large files should back off to avoid noisy updates. Include percentage and ETA only when a trustworthy total byte count is available. This download cadence is separate from the 30-second generation/studio heartbeat.

Make the wait feel accompanied, not merely monitored. When there is evidence, include one perceptive observation about the finished board, image, motion, identity, palette, or story beat. Avoid empty enthusiasm and never claim quality before inspection; truthful specificity creates more emotional value than generic praise.

## Host-Tool Call Budget

For a straightforward non-Canvas one-shot generation, target two host-tool execution calls:

1. one fail-fast preparation call ending in `queue write --preflight` or `queue append --preflight`
2. one long-lived `queue run` call after confirmation; deliver directly from its local paths and returned ledger

Ordinary image/video generation does not automatically read QA playbooks, inspect media, or run QA commands. User-requested QA and specialized-workflow checks remain available; use `qa project <slug> --all-runs` only when that inspection scope is requested.

Do not call `setup status` before ordinary preflight; preflight already enforces it. Do not split project init, prompt writes, queue mutation, and preflight into separate host calls unless model judgment or user input is genuinely needed between them.

Under the default automatic policy or an explicit skip preference, `--run-if-allowed` can combine the prepare and generate transactions. It must still print the checked task count and balance first, and it must stop instead of running when confirmation remains required.

## After Work

Recap:

- what succeeded
- where the asset is
- requested quality checks and their results, if any; do not add an automatic QA recap
- any weak, failed, or rejected assets that influenced the result
- what you recommend next

For multi-stage production or an explicit handoff request, after every meaningful stage also show `"${PVX}" project handoff <slug> --stage <stage-name> --format markdown` so the user can inspect and edit plans, prompts, queues, memory, QA/audit records, media, and deliverables.

For Canvas work, accompany that handoff with `Stage N/M`, an explicit statement of whether the requested
final deliverable is finished, the remaining stages, and the next paid task count. Distinguish cloud
Canvas nodes from local-only plans and explicitly requested download copies. Pass `--surface canvas` and the handoff's structured
stage options so this status is persisted rather than supplied only as surrounding prose.

Keep CLI command details in project memory unless the user wants the exact technical trace.
