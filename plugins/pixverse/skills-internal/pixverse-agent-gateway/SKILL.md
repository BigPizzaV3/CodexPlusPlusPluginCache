---
name: pixverse-agent-gateway
description: PixVerse CLI gateway skill for PixVerse Agent Plugin. Use before writing, validating, queuing, polling, or debugging `pixverse` commands, model ids, creation modes, task ids, account slots, asset info, or JSON queue specs.
---

# PixVerse Gateway

PixVerse CLI is the model supplier. You can use it directly, but for multi-task work prefer `pvx queue`.

Read `../../skills-shared/pixverse-cli-cheatsheet.md` for command forms and failure classes.
Read `../../skills-shared/pixverse-cli-1.4.0.md` for the minimum model/mode contract and `../../skills-shared/pixverse-cli-1.4.4.md` for H3 Max, current image/audio alternatives, when those model details matter. Read `../../skills-shared/pixverse-cli-1.4.5.md` for the latest Canvas/download delta.
Read `../../skills-shared/pixverse-cli-internal-1.4.0.md` for the reviewed local artifact identity and any serialization delta from the shared 1.4.0 baseline.
Read `../../skills-shared/capability-priority.md` before deciding among creation modes.
Read `../../skills-shared/model-routing.md` before choosing models when the user did not specify one.
Read `../../skills-shared/web-handoff.md` before OAuth, subscription, workspace-management, or Canvas
browser work.

For a non-obvious model/mode combination, run `"${PVX}" route recommend --kind <image|video> ... --format markdown` once before writing the queue. It captures the current high-quality spine and capability walls without a chain of help calls.

Before writing a manual Create command on either managed CLI channel, read
`"${PVX}" pixverse capabilities create <mode> --model <id> --json` when the model or parameter set is
not already established in this task. This lookup is offline and unauthenticated. Treat its required
fields, enums, ranges, units, media limits, and model-specific support as authoritative. Never rely on
Web UI coercion, and do not materialize optional defaults into a command unless the creative route
actually needs an explicit value. `create reference` always carries a prompt.

Apply `../../skills-shared/quality-policy.md` for image/video defaults, automatic Seedance prompt enhancement and membership choices.

For preset templates, read `template info` before composing the task. The queue
currently handles `create template` as video output; image-output templates need
separate receipt/polling support and must not be submitted through it. MiniApps
paid creation is likewise outside the queue; see the current capability review.

For animated faceless production, `pixverse-explainer` keeps this Seedance 2.5 1080p
default and submits its filled block template as the prompt; follow its
`../../skills/pixverse-explainer/references/model-route.md`. Gemini Omni Flash is an
on-request alternative there.

## Before Writing Commands

Resolve membership, then choose the creative control layer. Automatic route composition reads account/auth once and reuses that snapshot for preflight:

```bash
"${PVX}" route queue projects/<slug>/queue.json --project <slug> --kind <image|video> --membership-tier auto --prompt <prompt-or-file> --preflight --format markdown
```

Default to Sunburst 2K/high and Seedance 2.5 1080p. Free/Basic pauses for upgrade or explicit fallback consent; see the shared quality policy. Only accepted fallback uses Nano Banana 2 Lite 1080p and v6 540p.

| Need | Prefer |
|---|---|
| Explicitly accepted fallback visual lock, board, or still | `pixverse create image --model gemini-3.1-flash-lite --quality 1080p` |
| Explicitly accepted fallback video | compatible `pixverse create ... --model v6 --quality 540p`; do not add an image for a simple prompt-only clip |
| premium visual lock, product plate, character sheet, UI/text plate | `pixverse create image --model gpt-image-2.5-sunburst --quality 1440p --detail-level high` |
| premium simple prompt-only video preview | one direct Seedance 2.5 1080p video task; do not add an image |
| premium serious reference-heavy video | `pixverse create reference --model seedance-2.5` |
| premium 16–30s / automatic duration-framing / 10–30 image-reference shot | capability-gated `seedance-2.5`; no CLI audio toggle; preserve sound intent in the prompt and inspect output |
| explicitly selected FLUX 3 video | validate the video-only 5–20s contract from offline capabilities |
| explicitly selected MiniMax H3 Max | `minimax-h3-max` video/reference/two-frame transition; 5–15s; ≤12 mixed references; see the 1.4.4 review for framing and audio boundaries |
| explicitly selected Wan 3.0 | validate video/reference/two-frame transition parameters; audio-only reference is allowed |
| exact first frame to motion | image-to-video from a locked board |
| first and last frames are known | `pixverse create transition` |
| continue a successful clip | `pixverse create extend` |
| Canvas-bound edit or composition | read the Canvas skill, inspect runtime capabilities, then reuse graph assets through native nodes first |
| non-Canvas or explicitly local-only editorial need | download asset, then use local post tools |

`Canvas-bound` means Canvas is the selected target under the Canvas skill's activation boundary. An
old binding file or the fact that an asset came from PixVerse does not reclassify an ordinary queue or
local project; its existing local editorial route remains unchanged.

The global region is part of execution context. `PIXVERSE_REGION` overrides `--region`; use one region
for a queue or Canvas workflow. Guarded Canvas commands reject one-off region flags so graph,
account, approval, submission, and recovery cannot cross regional state.

Do not let edge capabilities distract from the stable spine. Saved folders, workspace, config defaults, template discovery, and subscribe/account commands are available when needed, but they are not ordinary creative routes.

## Canvas Routing

Canvas has a stricter shared-graph, concurrency, paid-mutation, and browser-handoff contract than
ordinary CLI or queue work. Before writing or running any Canvas command, read
`../pixverse-agent-canvas/SKILL.md`; that skill is the canonical Canvas operating playbook. Do not
apply the generic direct-command or queue confirmation rules below in place of its checkpoint,
edit-version, bound-plan authorization, reconciliation, or exact in-app-browser rules. Canvas preflight
resolves the existing `require` / `skip` settings; follow its returned policy and exact command rather
than adding an unconditional confirmation round or manually adding execution flags.

## Direct Commands

Before any direct `pixverse create` or paid queue, setup must be ready. Paid queue preflight and run enforce that gate internally, so do not call `setup status` separately on the normal fast path. If either returns `setup_required`, follow `skills-internal/pixverse-agent-setup/SKILL.md` and do not submit generation commands yet.

Use direct `pixverse create ... --json` only for help, docs, or explicitly non-paid inspection. For paid generation, including a single simple task, create a one-task queue spec so preflight confirmation and billing capture are enforced.

For a one-off automatic task, prefer account-aware `route queue`. Use manual `queue write` only after the model is explicitly selected or entitlement is already established:

```bash
"${PVX}" queue write projects/<slug>/queue.json --project <slug> --id <task-id> --label "<label>" --preflight --format markdown -- pixverse create image --model gpt-image-2.5-sunburst --quality 1440p --detail-level high --prompt "..."
```

For dependent multi-step queues, append tasks instead of hand-editing JSON:

```bash
"${PVX}" queue append projects/<slug>/queue.json --id film --label "Seedance reference film" --preflight --format markdown -- pixverse create reference --model seedance-2.5 --images "{{board.path}}" --prompt "..."
```

`queue append --reuse <project-slug>:<task-id>` (or `<manifest.jsonl>:<task-id>`) appends an accepted
asset from an earlier run instead of a create command; preflight counts it as reused with no charge
and `{{id.path}}` resolves from its recorded provider path. `queue append` merges explicit `--depends-on` values with placeholder references like `{{board.path}}` and rejects unknown dependencies before quote/run. For assets created by an earlier PixVerse queue task, always pass the provider media `path`, not its public `url`: the URL route downloads and re-uploads PixVerse's own file and can hit the 10 MB upload limit. Direct user assets may still be passed as local paths or external URLs. Old internal `{{board.url}}` placeholders are normalized to `.path` when a queue is loaded. Do not add a separate dimension probe to the normal path. If PixVerse explicitly rejects a generated image path for its image dimension or payload wall before returning a task id, the queue runner downloads that internal image into the project cache and retries once through PixVerse CLI's existing local-image auto-resize path.

`--preflight` folds queue mutation, setup gating, spec validation, balance lookup, preference lookup, and the generation confirmation into the same CLI call. For multi-task preparation, run all deterministic helper commands in one fail-fast host-tool call and add `--preflight` only to the final append.

Under the default automatic policy or an explicit skip preference, add `--run-if-allowed` to that final mutation. The CLI shows preflight on stderr and enters the normal queue-run gate in the same host call only when the preference permits it; otherwise it stops at confirmation. For a large batch, put `--deadline-seconds <whole-queue-budget>` (and any polling/heartbeat overrides) on the same mutation so fast-path execution keeps the intended run budget.

For a straightforward direct image/video route, `"${PVX}" route queue ... --preflight` composes one task. The extra board exists only under explicit `--mode board-to-video`; never infer it from a text-only final video. Do not use a combined board-to-video queue when a human/model must inspect and select the board before video.

For an already-designed multi-shot story, `"${PVX}" story queue ... --shot-reference <board> ... --membership-tier auto --preflight` composes ordered account-compatible reference shots from approved per-shot boards: Seedance 2.5 1080p for supported shots; v6 540p only after explicit fallback consent. It enforces each selected model's duration and reference limits. The optional shared `--board-prompt` path is a lower-control compact workflow, not the default for a serious film.

Use `"${PVX}" queue run <spec.json>` for multiple paid tasks, dependent image-to-video chains, or concurrency-limited work. Default automatic execution needs no `--confirmed`; add it only after batch approval when confirmation is enabled.

## Queue Spec Contract

```json
{
  "project": "project-slug",
  "tasks": [
    {
      "id": "board",
      "label": "visual board",
      "cmd": "pixverse create image --model gpt-image-2.5-sunburst --quality 1440p --detail-level high --aspect-ratio 9:16 --prompt \"...\""
    },
    {
      "id": "film",
      "label": "15s film",
      "depends_on": ["board"],
      "cmd": "pixverse create reference --model seedance-2.5 --quality 1080p --duration 15 --aspect-ratio 9:16 --images {{board.path}} --prompt \"...\""
    }
  ]
}
```

Use Seedance 2.5 at 1080p for both previews and finals; only an explicit user choice changes quality.

Validate only as much as the job needs. For a simple one-task generation or edit, write the queue and go straight to the paid-work preflight; do not spend minutes running route boards, graphs, dry-runs, or extra inspections.

```bash
"${PVX}" queue plan <spec.json>
"${PVX}" queue graph <spec.json>
"${PVX}" queue run <spec.json> --dry-run
```

`queue plan` validates the spec shape and that every task command is `pixverse create <kind> ...`; it also prints parsed `kind` and `media_type` for each task. Use it when you hand-edited JSON or see a likely syntax problem. Invalid specs return JSON with `error: invalid_queue_spec` so the agent can repair them before the preflight.

Use `queue graph` only when the queue has multiple references, dependencies, audio stems, or retries and a dependency view would materially help.

Run the paid-work preflight before paid work:

```bash
"${PVX}" quote queue <spec.json>
"${PVX}" quote queue <spec.json> --format markdown
```

The JSON output is best for agent parsing; `--format markdown` is a ready user-facing generation confirmation. It reports planned generation task/material counts, model ids, key parameters, prompt/text previews, login/membership, and balance state. Treat it as a paid-work confirmation sheet, not as a price estimate: exact credits are usually only knowable after generation.

Hard preflight blockers are user journeys, not retry signals:

- `authentication_required`: no generation started. Run `"${PVX}" pixverse auth login --json` as one
  long-lived call, open the emitted OAuth URL in the Codex in-app Browser, then run `"${PVX}" doctor`
  and preflight again.
- `membership_route_required`: no generation started. Stop, keep the premium plan, show the
  subscription link, and wait for upgrade or explicit fallback consent under
  `../../skills-shared/quality-policy.md`. Refresh account/entitlement after upgrade; only an
  accepted fallback permits rebuilding with v6 540p and Nano Banana 2 Lite 1080p. Preflight again.
- `membership_unknown`: verify `auth status`, `account info`, and `doctor`; keep the premium plan pending and do not spend yet.
- `insufficient_balance` or `balance_unknown`: stop paid work. When useful, let the user open the PixVerse main-site subscription page with:

```bash
"${PVX}" pixverse subscribe
```

If a submitted task later returns `membership_required`, stop new submissions and preserve that
class, completed assets and unresolved task IDs. Explain the account/model limitation, show the
subscription link, and wait for the user's upgrade/fallback choice under the shared quality policy.
Any replacement task needs a fresh preflight and the applicable paid approval.

Preflight notes are advisory unless they identify a true execution blocker such as missing login, empty/unknown balance, invalid queue syntax, unsupported required parameters, or missing user confirmation. Audio notes should not slow the run down: if the prompt already says "no music" or the user's intent is clear, keep the requested audio mode and proceed under the effective confirmation policy. Do not switch to `--no-audio`, rewrite the creative route, or run extra checks only to silence an audio note.

Default to automatic generation after preflight, including the first batch:

```bash
"${PVX}" queue run <spec.json> --status-interval 30
```

Use [generation confirmation](../../skills-shared/generation-confirmation.md) for
concise progress copy and optional confirmation. When the user asks to control cost or
confirm spending, set `require --project <slug>` before the next batch. Only effective
`require` waits for approval and uses `queue run --confirmed`. In that mode, offer
“Allow future generation”; on that reply set `skip --project <slug>`, re-preflight and continue.
Neither first generation nor missing prior receipts adds an approval gate.

A newer project choice acknowledges the current global setting; a later global choice
supersedes older project choices. Follow `requires_confirmation`, not raw global flags.
Do not write preferences simply to apply the default. Change global settings only for
an explicit request applying to all projects. Keep balance and CLI validity checks.

Retries are new paid work and require a fresh preflight. Bounded repairs within the
agreed deliverable use the same effective confirmation policy. Do not turn failures
into unlimited retries or resubmit an unresolved task.

After each planning or generation stage, expose what was recorded:

```bash
"${PVX}" project handoff <slug> --stage <stage-name> --format markdown
```

For the explicit Canvas target, follow the Canvas skill's **Cloud Preview And On-Demand Delivery**
contract. Default follow/reconcile and submission completion do not download, run local QA, or query
post-generation balances. A user-requested `--credits` report returns the verified balance delta as
`credits_consumed`, with source `account_balance_delta`; never match account-usage rows. Disclose
that unrelated spending since the pre-run snapshot can affect it. `--download` is independent of
`--credits`. A directory binding alone never changes ordinary queue `asset_ledger`, `invoice`, local
preview, or QA behavior below.

## Concurrency

`pvx queue` reads `pixverse account slots --json`. When slots are full, it waits instead of resubmitting. If the CLI returns a concurrency/queue error, wait and retry rather than changing the creative plan.

In the `1.4.0+` CLI baseline, process exit code `7` is `CONCURRENCY_LIMIT`. It is a wait state, not a reason to rewrite the prompt or fan out more submissions. Batch status checks with `--ids 123,456` or the equivalent space-separated positional ids.

If the create process itself times out before returning a task id, pvx records `unresolved / submit_timeout_unknown`, does not resubmit, and blocks dependent paid tasks. The request may already have reached PixVerse, so inspect account usage and the asset library before any manual retry; unlike `deadline_unresolved`, there is no task id available for ordinary `queue reconcile`.

Read-only timeouts are less destructive: a slots timeout falls back to one conservative slot, a status timeout leaves the paid task running for another check, an asset-info timeout still allows download by task id while omitting provider-path/cost details, and a reconcile timeout keeps the task pending. A local-preview download timeout leaves generation successful with a non-ready `local_preview_status`; retry that free download before QA instead of regenerating or showing the provider URL inline. None of these is evidence of generation failure.

## Progress Output

`pvx queue run` prints concise progress to stderr. It should surface:

- submitted task ids
- slot waits
- a studio heartbeat every `--status-interval` seconds; the default is 30 seconds so the host agent can keep the user informed
- `progress_percent` when PixVerse returns it
- otherwise status, status code, elapsed time, and task id
- overall ready/rendering/waiting/failed counts plus active human-readable asset labels
- task-level lines when provider state or percentage changes, without repeating one unchanged line per task on every heartbeat

When a task succeeds, `pvx queue` downloads it into `projects/<slug>/assets/<media-type>/<task-id>/`, emits `Local preview ready`, and returns an absolute `local_path`. Surface that local image/video immediately with the host's local-media syntax. The provider `path` remains an internal dependency value and the provider `url` remains audit/share metadata; neither is the Codex inline preview source. Billing reconciliation, deep QA, and final ledger assembly continue afterward and must not hide the local result.

Local downloads complete immediately when they are fast; the runner does not wait for a heartbeat interval before returning the file. If a download is still active, respond quickly at first, sample local byte growth to estimate recent network throughput, and adapt later heartbeats between roughly 3 and 30 seconds. Slow or stalled starts stay chatty; fast transfers and files already above 64/256 MiB progressively back off to avoid noisy updates. When asset info exposes total bytes, include percentage and ETA. Keep the ordinary generation/studio heartbeat at 30 seconds.

## Prompt Files

For long prompts, write them under `projects/<slug>/prompts/` and pass the file path to `--prompt`. The CLI treats a value as a file only when that file exists.

Use the local helper when you want the prompt saved and searchable:

```bash
"${PVX}" project prompt <slug> <name> --kind video --text "..."
"${PVX}" project prompt <slug> <name> --kind video --input ./draft-prompt.txt
```

## Do Not

- Do not run arbitrary shell through queue specs.
- Do not hide failed tasks; record them in the manifest.
- Do not drop user-provided subject references silently.
- Do not guess flags when a command can be checked with `pixverse <cmd> --help`.
- Preflight every paid queue. Default to automatic execution; wait for explicit batch approval only when effective policy is `require`.
- Do not use direct `pixverse create` to bypass preflight confirmation for paid work.
