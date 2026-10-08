# Advanced CLI Workflow Reference

Detailed creative and execution guidance retained for multi-stage, reference-controlled,
manual, or unfamiliar workflows. Start with `./cli-workflow.md`; simple direct tasks
do not need this full reference. It is not a public skill or another routing stage.

For an explicitly selected Canvas target, follow
`../skills-internal/pixverse-agent-canvas/SKILL.md` and its **Cloud Preview And On-Demand Delivery**
contract instead. A directory binding alone does not activate Canvas rules.

For manual CLI commands or queue specs, read `../skills-internal/pixverse-agent-gateway/SKILL.md`.
Use `../skills-internal/pixverse-agent-project-memory/SKILL.md` when decisions or assets need
to carry forward. Read `../skills-internal/pixverse-agent-quality/SKILL.md` only for
user-requested QA or named checks required by the selected specialized workflow.
Ordinary image/video generation has no automatic QA stage. These are shared references,
not extra public routing stages.

Apply `./quality-policy.md` for image/video defaults, automatic Seedance prompt enhancement and membership choices.

## Scope And First Move

Codex's advantage here is local, patient creative reasoning. Use that advantage to understand the brief, choose the right PixVerse control layer, organize project memory, and build queues. Do not turn it into slow bureaucracy: simple tasks should still move quickly.

Default to Sunburst 2K/high and Seedance 2.5 1080p. Free/Basic pauses for upgrade or explicit fallback consent; see the shared quality policy. Only accepted fallback uses Nano Banana 2 Lite 1080p and v6 540p.

Do not turn that into a rigid duration rule. A short product/character shot may need a control image; a 30-second abstract loop may not. Classify the job by continuity risk, number of beats/shots, recurring cast or products, dialogue, exact visual locks, delivery stakes, and expected future revisions. Tell the user why it is being treated as a quick task or a production project.

After the first direct preview is visible, accept feedback without stopping the remaining requested work; ask only when a material creative choice is unresolved. Offer stronger control as optional remedies—opening frame, character/scene references, per-shot storyboard frames, transition keyframes, motion reference, or a multi-shot plan—and state the added time and paid stages.

For a serious film such as a 30-second character animation, use the cinematic film workflow: lock the character first, then scenes/look, then detailed per-shot storyboard frames, then video. For feature-length work such as a 90-minute film, build script and production bibles first, divide by act/reel/scene/shot, and quote/approve reusable assets and scene batches separately. Never materialize a whole long-form project as one giant queue.

For a continuation request, recover the likely project and its useful state in one call before loading raw history:

```bash
"${PVX}" project resume [title-or-slug-hint] --format markdown
```

Prepared `route queue` projects retain their compact route intent, so this resume call can show the latest task count, model chain, control layer, and reason before any paid run.

Use `project portfolio --format markdown` only when several projects may match. For a non-trivial or capability-sensitive route, `"${PVX}" route recommend --kind <image|video> ... --format markdown` gives a compact current default before you write the queue.

Read `./creative-orchestration.md` when the user wants planning or a non-trivial creative result. Keep a simple direct task on the selected workflow’s fast path.
Read `./web-handoff.md` before any PixVerse OAuth, subscription,
workspace-management, or Canvas browser action.


## Codex Latency And Conversation Budget

Treat host tool calls as expensive. A normal one-shot image or video should target two execution calls across the whole journey:

1. prepare the project/prompt/queue and preflight in one fail-fast host tool call
2. run the confirmed queue as one long-lived call, then deliver from its local paths and result ledger

Do not append automatic QA, media inspection or an extra handoff call to this ordinary path.

For the ordinary one-task fast path, prefer account-aware route composition over manually choosing a premium model:

```bash
"${PVX}" route queue projects/<slug>/queue.json --project <slug> --kind <image|video> --membership-tier auto --prompt "..." --preflight --format markdown
```

For a dependent queue, batch project initialization, prompt saves, `queue write`, and every `queue append` into one fail-fast shell invocation; put `--preflight --format markdown` on the final append. Do not make one host tool call per deterministic helper command.

When the user explicitly chooses an additional paid board and no judgment is needed between board and video, compose the advanced chain directly:

```bash
"${PVX}" route queue projects/<slug>/queue.json --project <slug> --kind video --intent final --mode board-to-video --board-prompt <board-prompt-or-file> --prompt <video-prompt-or-file> --preflight --format markdown
```

Add `--run-if-allowed` under the same stored-confirmation rules. This writes the Sunburst 2K/high board and Seedance dependency as one queue; keep manual `queue write`/`append` when references, prompts, or creative selection need inspection between stages.

The same builder handles reference-controlled stills: use `--kind image` and repeat `--reference` for one or more subject, product, character, or style anchors. It chooses `--image` versus `--images` and retains the Sunburst 2K/high defaults and explicit user-selected model controls in the generated queue.

Under the default automatic policy or an explicit skip preference, add `--run-if-allowed` to the final queue mutation. It prints the preflight first and continues into the normal queue-run gate within the same host-tool call. It never bypasses the preference gate: when confirmation is enabled, it returns the confirmation sheet and does not run.

Before a long call, tell the user what has started and what the next visible milestone is. When the host supports yielded/background command sessions, yield quickly, poll every 20–30 seconds, and translate CLI events into short human updates. Never leave an active user-facing generation silent for more than 45 seconds. Report meaning—what finished, what it unlocked, what is rendering now, and what comes next—not just raw status codes.

Treat a slow initial submission as real waiting too: the CLI will state that the same request remains in flight and has not been retried. Translate that reassurance instead of going silent or launching another paid command. When ordinary queue generation finishes, tell the user the media is ready and the final ledger is being refreshed. For an explicit Canvas target, follow the canonical Canvas contract: ready downstream generation does not wait for files or credits, and credit reporting is only performed on request.

## User Experience Tone

Media generation includes real waiting, so every update should repay attention. Pair reassurance with one concrete fact and one useful creative observation when available:

- cold: "task 123 is still Generating"
- useful: "The world board is ready and both story shots are now rendering from the same character anchor; the warm interior/cold lunar contrast survived cleanly"

When an asset completes, show it promptly and say what actually worked in it—composition, identity, product fidelity, motion, color, or story readability. Do not use empty praise, invent progress, or hide weak results. Emotional value comes from making the user feel accompanied, remembered, and creatively understood while keeping the evidence truthful.

## Creative Stance

- Treat skills as expert playbooks, not rails.
- Respect explicit user choices first: model, style, aspect, duration, count, flaws, and things to avoid.
- Preserve user-provided subject references in the generation chain unless the user clearly says they are only for explanation.
- Default to Sunburst 2K/high and Seedance 2.5 1080p. Free/Basic pauses for upgrade or explicit fallback consent; see the shared quality policy. Only accepted fallback uses Nano Banana 2 Lite 1080p and v6 540p.
- Use local artifacts when they help: route boards, storyboard tables, asset maps, queue specs, Mermaid canvases, QA ledgers, and project memory.
- Match the user's aesthetic target. Do not automatically beautify deliberately rough, historical, amateur, broken, or low-budget requests.

## Paid Work Gate

For Canvas, use the Canvas skill's bound `canvas paid preflight` flow and on-demand delivery rules,
not the queue preflight, local QA, or invoice instructions below. An explicit file request enables only
the necessary export/download and file checks, not automatic credit reporting. Its effective
`require` / `skip` configuration determines whether to wait for approval after showing the sheet;
execute its exact returned command and do not add a second confirmation or change stored preferences.

For ordinary queues, before every paid generation stage, run the queue preflight and show the user-facing quote: planned task counts, media types, model/mode, key params, prompt previews, editable queue path, and balance state. Keep the detailed sheet available; in automatic mode summarize the work and continue without a confirmation question. Do not present it as an exact credit estimate; exact credits are usually only knowable after generation.

```bash
"${PVX}" quote queue <queue.json>
"${PVX}" quote queue <queue.json> --format markdown
```

Default effective policy is `skip`, including the first batch: preflight, summarize and continue within the user's requested deliverable. Only effective `require` waits for approval after showing the concrete batch. Follow `./generation-confirmation.md` for cost-control requests and restoring automatic execution; a newer project choice can acknowledge the current global setting, and a later global choice supersedes older project choices.

Preflight also owns first-use account safety. If it reports `authentication_required`, explain that no
generation started, run `"${PVX}" pixverse auth login --json` as a long-lived call, open its emitted
authorization URL in the Codex in-app Browser, then run `"${PVX}" doctor`. If it reports
`membership_route_required` or a run returns `membership_required`, do not rewrite the prompt or retry
automatically. Show the clickable PixVerse subscription link and wait for upgrade or explicit
fallback choice under `./quality-policy.md`; only then prepare/re-preflight the selected route.
Never infer the `unrestricted-test` membership preference from a label—store it only
after the user explicitly confirms that special account capability.

This also applies to retries and fixes. A correction, audio rework, prompt rewrite, extra variant, failed-task replacement, or "rerun that better" request is still new paid generation if it creates new PixVerse media. Show a fresh preflight and follow the effective confirmation policy; an applicable project release covers bounded repairs within the agreed deliverable.

```bash
"${PVX}" queue run <queue.json>
```

When the user or a specialized workflow requests whole-project QA, run `"${PVX}" qa project <slug> --all-runs` once to inspect unique historical assets without rechecking idempotent reruns. Multiple generation batches alone do not enable QA.

Generation is automatic by default. When the user asks to control spending or confirm
before generating, record the project choice before the next batch:

```bash
"${PVX}" preferences quote-confirmation require --project <slug>
```

In that mode, show the batch and wait; use `queue run --confirmed` after approval.
“Allow future generation” restores `skip` for the project, with no first-generation or receipt
prerequisite. Set a global preference only when the user explicitly applies it globally.

When generated assets complete, wait only for `queue run` to download each one, then show its absolute `local_path` promptly with a role label. Use the local file for Codex image/video rendering; never use the provider URL as the inline preview source. Billing reconciliation continues in the running command after the first local preview is visible. Ordinary images and clips deliver directly; run QA only for a user request or named specialized-workflow checks. Final recaps must include an invoice-style ledger with task id, asset role, model/mode, status, local path, provider URL, and actual or observed credit cost when available.

For multi-stage production or a requested handoff, after planning, character lock, storyboard, control-asset, preview, render, and final stages, run and show:

```bash
"${PVX}" project handoff <slug> --stage <stage-name> --format markdown
```

The user should see editable plans/prompts/queues, learned memory, QA and billing audit files, generated assets, and deliverables. If their repeated preferences form a stable production method, update `workflow-profile.md` and offer to package it as a custom Codex skill only after they choose to do so.

Generated media and local project state belong under `projects/`.

