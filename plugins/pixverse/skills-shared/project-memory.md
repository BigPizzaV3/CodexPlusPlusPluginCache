# Project Memory

PixVerse Agent Plugin memory is local and inspectable. It lives under `projects/<slug>/`.

Use it as a local studio operating system, not a diary. Memory should make the next creative decision faster, more accurate, and more consistent.

For an explicitly selected Canvas target, follow **Cloud Preview And On-Demand Delivery** in
`../skills-internal/pixverse-agent-canvas/SKILL.md`. Use `--surface canvas` on project resume, portfolio,
and handoff. Store cloud project/node/asset references, known run IDs, stage, and useful decisions;
local media is optional. Do not restore queue ledgers or automatically download, run local QA, or
query credits to resume Canvas. Report local-only plans separately. Queue/local-path and invoice
examples below retain their ordinary non-Canvas scope; a binding alone does not change that scope.

## Write

Use:

```bash
"${PVX}" project init <slug> --title "<title>"
"${PVX}" project resume [title-or-slug-hint] --format markdown
"${PVX}" project portfolio --format markdown
"${PVX}" project remember <slug> "<fact>" --kind decision
"${PVX}" project prefer <slug> "<preference>" --category visual-motif
"${PVX}" project search <slug> "<query>"
"${PVX}" project ledger <slug> --format markdown
"${PVX}" project handoff <slug> --stage <stage-name> --format markdown
"${PVX}" project prompt <slug> <name> --kind video --text "..."
"${PVX}" project scaffold <slug> storyboard-table
```

## What Belongs In Notebook

- selected creative direction
- rejected directions and why
- generated asset mapping: "shot 2 = task id + absolute local path + provider URL"
- subject identity locks
- product packaging / logo constraints
- user feedback on a specific version
- current delivery target
- open questions that block the next paid render
- model/mode decisions and why they were chosen
- failed or weak assets that should not be repeated
- reusable prompt fragments, reference ordering, and continuity anchors
- final asset ledger entries

## What Belongs In Preferences

Only durable cross-project tendencies:

- "usually prefers quiet luxury"
- "dislikes fake UI overlays"
- "wants Chinese copy in final recaps"
- "likes 2.39:1 cinematic framing"

Do not store one-off choices as preferences.

## Read Before Acting

For ongoing projects, recover the likely project, stage, recent assets, compact memory, and next action in one call:

```bash
"${PVX}" project resume [title-or-slug-hint] --format markdown
```

If the user says “continue”, “same project”, “the earlier one”, or gives a fuzzy project title, use this before acting.

Resume stage is latest-run aware: an older QA report or deliverable must not make a newer generation look checked or delivered, and idempotent reruns must not duplicate project asset or credit totals.

If several projects may match, inspect the compact portfolio:

```bash
"${PVX}" project portfolio --format markdown
```

Use `project summary <slug>` only when the compact resume is insufficient and a deep raw event trace is genuinely needed.

If the user asks about an earlier asset, rejection, prompt, final cut, audio issue, task id, or visual direction, search before relying on memory:

```bash
"${PVX}" project search <slug> "<asset, task id, style, rejection, or cue>"
```

Search covers the notebook, manifest, root queue/spec JSON, development notes, prompts, subtitles, and QA reports.

If the user asks what was generated or how credits were spent, render the stored project ledger:

```bash
"${PVX}" project ledger <slug> --format markdown
```

For substantial prompts, save a prompt file instead of leaving the full text only in chat or shell history:

```bash
"${PVX}" project prompt <slug> <name> --kind video --text "..."
```

## Useful Local Artifacts

Create these only when they reduce ambiguity or help continuation:

| Artifact | Use |
|---|---|
| `development/brief.md` | user goal, target platform, constraints, accepted assumptions |
| `development/route-board.md` | 2-4 creative routes with model/mode/cost/risk |
| `development/storyboard-table.md` | production locks, character/scene continuity, full shot controls, visual timeline, paid gates |
| `development/character-bible.md` | identity, wardrobe/props, movement, voice, emotional states, negative constraints |
| `development/scene-bible.md` | geography, lighting, palette/materials, recurring objects, sound, spatial continuity |
| `development/workflow-profile.md` | user defaults, approval policy, preferred stages, advanced-control triggers, custom-skill candidate |
| `development/asset-map.md` | asset roles, source, task id/path, status, used-by |
| `development/prompt-ledger.md` | prompt versions, what changed, what worked |
| `development/sound-cue-sheet.md` | promised audio, generated SFX/ambience, music, and replacement notes |
| `development/production-canvas.md` | Mermaid dependency graph across refs, queue, QA, and delivery |
| `quality/<asset>-qa.md` | user-intent QA, technical QA, retry decision |

Markdown tables and Mermaid graphs are enough. Do not build a separate runtime.

Use `"${PVX}" project scaffold <slug> <artifact>` to create these templates. Supported artifacts: `brief`, `route-board`, `storyboard-table`, `character-bible`, `scene-bible`, `workflow-profile`, `asset-map`, `prompt-ledger`, `sound-cue-sheet`, and `production-canvas`.

At the end of each stage, render the complete inspectable file handoff:

```bash
"${PVX}" project handoff <slug> --stage <planning|character-lock|storyboard|control-assets|preview|render|final> --format markdown
```

If the same workflow repeats and the user wants it reusable, update `workflow-profile.md` and offer to turn it into a custom skill. Do not create or install that skill without the user's approval.

## Asset Map Minimum

For each important asset, capture:

- role label: hero board, character sheet, product plate, shot 2, BGM, final cut
- source: user upload, PixVerse task, local edit, external file
- task id, URL, or local path
- model, mode, and major params when known
- status: selected, reference, weak, rejected, final
- one-line visual note and why it matters

## Mermaid Canvas

For multi-step work, a dependency graph helps Codex and the user see the pipeline:

```mermaid
flowchart LR
  "Product Plate" --> "Seedance Reference Video"
  "Storyboard Frame" --> "Seedance Reference Video"
  "Voice Track" --> "Final Edit"
  "Seedance Reference Video" --> "Final Edit"
```

Use this when there are multiple references, shots, audio stems, or retries.

For a queue spec, render the dependency graph directly:

```bash
"${PVX}" queue graph projects/<slug>/queue.json
```
