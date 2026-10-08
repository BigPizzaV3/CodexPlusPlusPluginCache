---
name: pixverse-create-video
description: "Video generation: create a clip from a prompt or reference through PixVerse. Handle requested duration, motion and sound; simple clips start directly with video."
---

# Create Videos

## Installed Command

Before running helper commands, resolve the absolute plugin root from this `./SKILL.md` path: it is two directories above this skill directory and contains `.codex-plugin/plugin.json`. In every new shell session, set:

```bash
PVX="<absolute-plugin-root>/scripts/pvx"
```

Run helper commands through `"${PVX}"`. Do not assume the user's current working directory is the plugin checkout, and do not bypass the installed wrapper with a module invocation.

## CLI Execution

Apply `../../skills-shared/quality-policy.md` to all generated images/videos: Sunburst 2K/high,
Seedance 2.5 1080p with automatic prompt enhancement, and an explicit upgrade/fallback
choice for Free/Basic or model-entitlement rejection.

For an explicitly selected Canvas project or node, read
`../../skills-internal/pixverse-agent-canvas/SKILL.md` first and follow its Canvas
preflight and delivery contract; the ordinary queue/local route below does not replace it.

For ordinary creation or editing, read `../../skills-shared/cli-workflow.md` before
executing this workflow. It contains the existing account-aware routing, paid-work
confirmation, progress, preview and project-handoff rules. Studio and Production are
not prerequisites. The shared account, confirmation and direct-medium rules govern the
examples and defaults below. Read the gateway only when writing manual CLI commands or queue specs.
Creation command examples below are queue-task fragments, not permission to submit paid
`pixverse create` commands directly.

Read this when the user wants a moving-image result. Ordinary single clips deliver directly after generation and download, without automatic playback inspection, frame sampling, audio checks or QA commands. Checks below apply only when a selected specialized production workflow explicitly needs them or the user requests review.

For a simple prompt-only clip, use the shared contract's direct `route queue` fast path.
Load these references only when the brief needs them:

- `../../skills-shared/capability-priority.md`: exact control assets, motion/reference modes
- `../../skills-shared/model-routing.md`: custom models, unfamiliar parameters or comparison
- `../../skills-shared/prompt-craft.md`: complex action, composition or prompt repair

For sketch-at-timestamp edits, generative reframing, reference-driven ad inputs or
other non-model workflows, read `../../skills-shared/extended-capabilities.md`.
Preserve a selected specialist workflow’s shot/board/voice recipe over generic
production-depth advice below.

## Choose Route

For an explicitly requested MiniMax H3 Max or other alternate model, read
`../../skills-shared/pixverse-cli-1.4.4.md`, then author a capability-checked manual
queue. H3 Max supports video/reference/two-frame transition, with distinct framing
rules and at most 12 mixed references; it has no generated-audio control.

Use Seedance 2.5 at 1080p for all supported video modes. Apply `../../skills-internal/pixverse-seedance-prompt-enhance/SKILL.md` before preflight. Free/Basic must stop for the subscription/fallback choice; only an accepted fallback uses v6 540p. Preserve the requested mode and references, and explain any capability conflict.

| User intent | Route |
|---|---|
| single simple lightweight prompt-only clip | direct video; Seedance 2.5 1080p; v6 540p only after fallback consent; no hidden image task |
| serious/high-fidelity single clip without identity lock | Seedance 2.5 1080p; v6 540p only after fallback consent |
| short clip with exact character/product/opening-frame lock | explicitly approved account-compatible image/plate, then v6 or Seedance 2.5 video/reference |
| style/identity uncertain | image board first, then video |
| user uploaded subject/product/character | image-to-video or Seedance reference; do not drop the asset |
| multiple subjects need consistency | `pixverse create reference` |
| first/last frame transformation | `pixverse create transition` |
| motion follows a reference video | Seedance `create reference --task-type reference`; assign the video's motion role |
| continue an existing clip | Seedance reference `--task-type extend` |
| change an existing clip | Seedance reference `--task-type edit` |
| improve resolution | `pixverse create upscale` |
| stitch clips/subtitle/BGM | `../pixverse-video-editing/SKILL.md` |

## Pick Production Skill

- product/brand/ecommerce: `../pixverse-product-video/SKILL.md`
- creator/social ad: `../pixverse-ugc-video/SKILL.md`
- music/dance/lyrics/performance: `../pixverse-music-video/SKILL.md`
- narrative/trailer/story scene: `../pixverse-cinematic-story/SKILL.md`
- vertical short drama: `../pixverse-short-drama/SKILL.md`
- game teaser: `../pixverse-game-trailer/SKILL.md`
- recurring cast/props: `../pixverse-character-sheet/SKILL.md`

## Default Work Shape

Classify dynamically before routing:

- Quick task: usually one shot/beat, no recurring identity, no exact plate, low revision stakes. Generate the requested medium directly.
- Controlled shot: short can still be serious when product, character, exact first frame, UI/text, or brand fidelity matters. Add only the necessary explicit control asset.
- Short-film project: multiple scenes/beats, recurring cast, animation, dialogue, trailer/advertising delivery, or revision workflow. Lock character, scene/look, and individual shot boards before motion.
- Long-form project: episodic or feature-length. Lock script and bibles, then divide into acts/reels/scenes/shots and independently approved scene batches.

For serious work:

1. clarify only if a missing choice changes cost or format
2. classify user assets as identity, product, storyboard, style, motion, audio, or raw material
3. plan 2-4 creative routes when aesthetics are open
4. generate still control assets only after their own quote and approval
5. show and approve character/look assets before per-shot boards; show boards before video
6. render video from the approved per-shot route
7. surface each successful preview immediately; perform QA only when this specialized workflow names required checks, then record memory and hand off project files

## Model Bias

- Use `seedance-2.5` at 1080p for drafts and final video, with the prompt-enhancement skill.
- Use its `video`, `reference` or two-frame `transition` contract as appropriate. Edits and
  extensions use `create reference --task-type edit|extend`; motion references also use reference.
- Preserve the reference chain on creative failure. Account failures stop for user choice.
- After explicit fallback consent, use `v6` at 540p only within its supported modes/limits.
- Seedance 2.5 has no CLI audio, multi-shot or off-peak flags. Put sound/cuts in the prompt.
  A guaranteed silent export requires removing its audio track through the editing workflow.
- Ordinary generation still delivers directly; enhancement does not add automatic media QA.

Read `../../skills-shared/exploration-patterns.md` when the user wants "cool", "surprising", "not generic", or "like this reference".
