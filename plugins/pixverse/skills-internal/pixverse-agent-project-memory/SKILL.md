---
name: pixverse-agent-project-memory
description: Local project notebook and preference discipline for PixVerse Agent Plugin. Use when continuing a project, recording generated assets, remembering user choices, tracking rejections, or making the agent feel progressively better tuned.
---

# Project Memory

Read `../../skills-shared/project-memory.md`.

## Canvas Scope

For an explicitly selected Canvas target, use the Canvas skill's **Cloud Preview And On-Demand
Delivery** contract in `../pixverse-agent-canvas/SKILL.md`. Add `--surface canvas` to resume, portfolio,
and handoff. Recover cloud nodes, run receipts, creative decisions, stage, and remaining work without
automatically downloading, running local QA, or querying credits. Keep project/node/asset references
and run/confirmation IDs when known; no local media path is required for cloud assets. Local plans
remain distinct from synced cloud nodes. The queue ledger and mandatory local-path guidance below
apply to ordinary queues, not Canvas. Explicit Canvas file delivery still requires actual exports;
credit reporting is separately requested. A directory binding alone does not select Canvas.

## Rule

Every useful creative decision, selected asset, rejected route, and material failure gets recorded locally when it can improve the next step.

The user should feel remembered without project management being hidden. Record useful state quietly while working, then show the inspectable file handoff for multi-stage production or when requested. Ordinary image/video generation delivers from the existing result without a mandatory extra handoff.

## Project Setup

```bash
"${PVX}" project init <slug> --title "<title>"
"${PVX}" project resume [title-or-slug-hint] --format markdown
"${PVX}" project portfolio --format markdown
"${PVX}" project search <slug> "<query>"
"${PVX}" project ledger <slug> --format markdown
"${PVX}" project handoff <slug> --stage <stage-name> --format markdown
"${PVX}" project prompt <slug> <name> --kind video --text "..."
"${PVX}" project scaffold <slug> storyboard-table
```

## Record Decisions

```bash
"${PVX}" project remember <slug> "<decision>" --kind decision
"${PVX}" project remember <slug> "<asset mapping>" --kind asset
"${PVX}" project remember <slug> "<rejection>" --kind rejection
```

## Record Preferences

Only durable tendencies:

```bash
"${PVX}" project prefer <slug> "<preference>" --category visual-motif
```

For project confirmation preferences, follow [generation confirmation](../../skills-shared/generation-confirmation.md).
When the user says “Allow future generation”, record the explicit current-project choice with the
dedicated helper instead of burying it in a notebook or asking again:

```bash
"${PVX}" preferences quote-confirmation skip --project <slug>
```

Generation defaults to automatic execution without writing a preference. If the user
asks to control spending or confirm every batch, record `require --project <slug>`
before the next submission. Apply a global setting only for an explicit global request.
A new project choice acknowledges the current global setting; a later global change
supersedes older project choices. No first-generation gate applies.

## Asset Entry Minimum

Record:

- role label: "hero board", "shot 2", "BGM", "final cut"
- task id, absolute local path, and provider URL
- model and major params when known
- status: selected, rejected, needs revision, final
- one-line visual note
- reference role: identity anchor, product plate, storyboard frame, style reference, audio reference, raw material, or negative example

## Project Artifacts

For complex work, keep lightweight files under `projects/<slug>/development/`:

- `brief.md`
- `route-board.md`
- `storyboard-table.md`
- `character-bible.md`
- `scene-bible.md`
- `workflow-profile.md`
- `asset-map.md`
- `prompt-ledger.md`
- `sound-cue-sheet.md`
- `production-canvas.md`

Use these to think, not to perform ceremony. A one-shot task may only need notebook entries and a final ledger.

Create them quickly with:

```bash
"${PVX}" project scaffold <slug> brief
"${PVX}" project scaffold <slug> route-board
"${PVX}" project scaffold <slug> storyboard-table
"${PVX}" project scaffold <slug> character-bible
"${PVX}" project scaffold <slug> scene-bible
"${PVX}" project scaffold <slug> workflow-profile
"${PVX}" project scaffold <slug> asset-map
"${PVX}" project scaffold <slug> prompt-ledger
"${PVX}" project scaffold <slug> sound-cue-sheet
"${PVX}" project scaffold <slug> production-canvas
"${PVX}" project handoff <slug> --stage storyboard --format markdown
```

## Read Before Continuing

When the user says "continue", names the project, or asks to revise an earlier output, run:

```bash
"${PVX}" project resume [title-or-slug-hint] --format markdown
```

This compactly returns the likely project, production stage, useful memory, latest assets, unresolved work, and one recommended next action. It accepts a fuzzy title or slug fragment. Use `project portfolio --format markdown` when multiple projects may match; reserve `project summary` for deep raw trace inspection.

Queues created by `route queue` carry compact route intent. For a prepared-but-unrun project, resume surfaces the latest queue by modification time plus its task count, model chain, control layer, intent, and route reason; do not reopen raw queue JSON merely to rediscover those facts.

If the user refers to a specific asset, rejected version, previous style, task id, audio issue, or final file, search before guessing:

```bash
"${PVX}" project search <slug> "<asset, task id, style, rejection, or cue>"
```

Search covers notebook, manifest, root queue/spec JSON, development notes, prompts, subtitles, and QA reports.

If the user asks what was generated, what each asset cost, or needs a final recap after context has moved on:

```bash
"${PVX}" project ledger <slug> --format markdown
```

For prompts worth reusing, auditing, or comparing later, save them as project prompt files:

```bash
"${PVX}" project prompt <slug> <name> --kind video --text "..."
```
