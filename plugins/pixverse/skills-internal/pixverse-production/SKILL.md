---
name: pixverse-production
description: Internal production-depth, model-route and planning reference for existing PixVerse workflows. Read only when a selected workflow needs additional scope classification or production scaffolds.
---

# PixVerse Production

Use this when the selected public workflow needs additional production planning. It is not a mandatory router for ordinary generation.

For an explicitly selected PixVerse Canvas project or node, enter `../../skills/pixverse-canvas/SKILL.md`
before the generic production planning below. Do not load this router merely as a prerequisite for
Canvas; use its creative playbooks later only when the Canvas work actually needs them.

Apply `../../skills-shared/quality-policy.md` for image/video defaults, automatic Seedance prompt enhancement and membership choices.

## Installed Command

Before running helper commands, resolve the absolute plugin root from this `SKILL.md` path: it is two directories above this skill directory and contains `.codex-plugin/plugin.json`. In every new shell session, set:

```bash
PVX="<absolute-plugin-root>/scripts/pvx"
```

Run helper commands through `"${PVX}"`. Do not assume the user's current working directory is the plugin checkout, and do not bypass the installed wrapper with a module invocation.

The user-facing production workflows live under `../../skills/`. This internal reference preserves the shared planning guidance without adding another public selection step.

Read:

- `../../skills-shared/creative-orchestration.md`
- `../../skills-shared/capability-priority.md`

## Default Creative Spine

Resolve account membership before selecting the spine. `route queue --membership-tier auto --preflight` and `story queue --membership-tier auto --preflight` combine this check with queue preparation; reuse their route instead of hard-coding a model first.

Apply `../../skills-shared/quality-policy.md`: Sunburst 2K/high for all stills and control
assets; Seedance 2.5 1080p for drafts and final shots. Apply the prompt-enhancement skill
before every Seedance prompt/preflight. Alternative models are deliberate user choices.

Free/Basic and any model-entitlement rejection pause for upgrade or explicit fallback.
Only after consent use Nano Banana 2 Lite 1080p and v6 540p, preserving the production's
references and checking its reduced capability limits. Keep login/balance/approval gates.

Keep supplied references and the requested medium. Simple videos do not acquire an
extra paid board automatically; continuity work still needs separately approved control stages.
Never feed a contact sheet or panel grid as a locked opening frame. Seedance 2.5 can use
one as a semantic storyboard reference, but separate ordered shot images provide stronger
frame control. Apply the prompt-enhancement skill's storyboard/keyframe guidance.

## Dynamic Scope Classifier

Choose the least elaborate chain that still clears the quality bar. Duration is evidence, not the only rule.

| Job shape | Default production depth |
|---|---|
| 5–8s, one shot/beat, no continuity or exact-identity lock | one direct video preview |
| short but exact product/character/first-frame fidelity matters | establish the minimum required control asset, then one video |
| 20–90s, recurring character, multiple scenes, dialogue, branded delivery, animation, trailer, or clear revision cycle | film bible, character/scene/look locks, detailed shot table, individual storyboard frames, then video by planned stage |
| episodic or feature-length work such as a 90-minute film | script/version lock, act/reel/scene breakdown, character and scene bibles, mood/look development, scene-level storyboards/animatics, then independently quoted scene or reel batches |

Explain the classification in one or two sentences so the user can see why the proposed chain is proportionate. A 30-second pig-themed animation is a real continuity project: establish the pig character, scene language, and per-shot boards before motion. A 30-second abstract background may still be a simple direct or split-video job.

For serious work, the production storyboard must include timecode, scene, character state/action, framing/lens, camera path, lighting/palette, transition, dialogue/SFX/music cue, control assets, paid stage, and approval status, plus character and scene bibles and a Mermaid timeline.

For a non-obvious route, get the compact default before building the queue:

```bash
"${PVX}" route recommend --kind image --intent final --format markdown
"${PVX}" route recommend --kind video --intent final --references <count> --duration <seconds> --format markdown
"${PVX}" route queue projects/<slug>/queue.json --project <slug> --kind video --intent final --mode board-to-video --board-prompt <board-prompt-or-file> --prompt <video-prompt-or-file> --preflight --format markdown
```

Use `route queue` only when the chain can run without a visual selection checkpoint. If model comparison or board selection matters, generate the boards first and inspect them before video.

For a designed 20–60 second story whose character/scene locks and individual shot boards are already approved, compose the ordered account-compatible shots in one call:

```bash
"${PVX}" story queue projects/<slug>/story.json --project <slug> --shot <shot-1-prompt-or-file> --shot <shot-2-prompt-or-file> --shot <shot-3-prompt-or-file> --shot-reference <shot-1-board> --shot-reference <shot-2-board> --shot-reference <shot-3-board> --reference <character-or-world-lock> --target-duration 30 --music-prompt <instrumental-score-prompt-or-file> --audio --preflight --format markdown
```

## Media Router

- still image, visual board, poster, key visual, product still, UI still: `../../skills/pixverse-create-image/SKILL.md`
- moving image, text-to-video, image-to-video, reference, transition, extend, modify, upscale: `../../skills/pixverse-create-video/SKILL.md`
- voice, narration, music, BGM, SFX, audio overlay: `../../skills/pixverse-audio/SKILL.md`

Read `../pixverse-agent-gateway/SKILL.md` before writing PixVerse CLI commands or queue specs.

## When To Think More

Use extra local reasoning for ambiguous, high-value, multi-asset, or style-sensitive work:

- compare 2-4 routes before paid generation
- build a storyboard table or asset map
- decide whether image-first, reference, transition, extend, or local post is the right control layer
- record decisions, rejected routes, and selected assets in project memory

Useful scaffolds:

```bash
"${PVX}" project scaffold <slug> route-board
"${PVX}" project scaffold <slug> storyboard-table
"${PVX}" project scaffold <slug> character-bible
"${PVX}" project scaffold <slug> scene-bible
"${PVX}" project scaffold <slug> workflow-profile
"${PVX}" project scaffold <slug> production-canvas
"${PVX}" project handoff <slug> --stage storyboard --format markdown
```

Skip that overhead for an obvious one-shot request.

## Production Playbooks

Keep the user's already-selected public workflow primary. The table below is a broad starting
point; specialized product, narration, graphics and web deliverables are listed in
`../../skills/pixverse-studio/SKILL.md`. Consult that catalog only if the appropriate workflow
is unresolved. Do not downgrade a specific request to a generic image/video task.

| Brief shape | Public workflow |
|---|---|
| product ad, brand film, ecommerce launch, hero product board | `../../skills/pixverse-product-video/SKILL.md` |
| creator-led ad, hook test, TikTok/Reels/Shorts style demo | `../../skills/pixverse-ugc-video/SKILL.md` |
| MV, lyric video, dance, performance, visual album loop | `../../skills/pixverse-music-video/SKILL.md` |
| trailer, emotional scene, myth, gag short, mood-led story | `../../skills/pixverse-cinematic-story/SKILL.md` |
| vertical micro-drama, CEO/revenge/romance/cliffhanger | `../../skills/pixverse-short-drama/SKILL.md` |
| game teaser, combat showcase, RPG/world concept | `../../skills/pixverse-game-trailer/SKILL.md` |
| recurring characters, props, identity anchors, continuity sheets | `../../skills/pixverse-character-sheet/SKILL.md` |
| reference remake, restyle of existing footage | `../../skills/pixverse-video-remake/SKILL.md`, `../../skills/pixverse-video-restyle/SKILL.md` |
| ranking board, podcast, street interview, talking head | `../../skills/pixverse-ranking-video/SKILL.md`, `../../skills/pixverse-podcast-clip/SKILL.md`, `../../skills/pixverse-street-interview/SKILL.md`, `../../skills/pixverse-talking-head/SKILL.md` |
| variants, localization | `../../skills/pixverse-video-variants/SKILL.md`, `../../skills/pixverse-video-translate/SKILL.md` |

## Entry Point Rule

Expose existing user-result workflows directly under `../../skills/`. Keep model/CLI mechanics,
project memory and QA references internal. A mode or style that shares one workflow contract
belongs in that workflow's references, not another routing layer.
