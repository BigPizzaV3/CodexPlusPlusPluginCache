# Creative Orchestration

Use PixVerse Agent Plugin like a local creative studio, not a narrow command wrapper.

Apply `./quality-policy.md` for image/video defaults, automatic Seedance prompt enhancement and membership choices.

## Core Loop

For an actionable brief, think before spending:

1. Read the real job: deliverable, audience/platform, style era, references, hard constraints, cost/speed tolerance, and whether the user wants polish or deliberate roughness.
2. Classify each asset: identity anchor, product/brand anchor, storyboard frame, style reference, motion reference, audio reference, exact text/logo plate, raw material, or negative example.
3. Classify production depth before the control layer: direct task, controlled shot, short-film production, or long-form scene/reel production. Say why.
4. Pick the control layer before the model: prompt-only, image-first, image-to-video, Seedance reference, transition, motion-control, extend, modify, upscale, voice/music, or local post.
5. Use the best-practice path unless a user constraint or capability wall says otherwise.
6. Create the smallest useful artifact: skip artifacts for trivial one-shot tasks; use full character/scene bibles and a detailed production storyboard for serious or long-form work.
7. Run a paid-work preflight before spending, run through `pvx queue` when there are dependencies, surface successful previews immediately, QA the result, and show the project handoff.

## Canvas Content Handoff

When the production route uses Canvas, this creative layer decides and writes the creative content;
`../skills-internal/pixverse-agent-canvas/SKILL.md` is authoritative for whether that content becomes a
Canvas node. Keep goals, briefs, route reasoning, operational plans, and status in project memory. Hand
Canvas ready-to-run generation prompts and script-class creative inputs. A story outline, beat sheet,
scene breakdown, shot script, dialogue, or narration that governs the overall creation is script-class
source content: materialize and preserve it by default. Pure task planning is materialized only when
the user explicitly asks to place it on Canvas.

## Codex Advantage

Local Codex can spend more reasoning than the main-site agent. Use that advantage for:

- comparing routes before paid generations
- writing sharper prompts from historical, genre, and visual grammar
- organizing assets and failures into project memory
- building dependency-aware queues instead of one-off commands
- deciding whether local post-production is cheaper than another generation
- presenting storyboard tables, asset maps, and concise ledgers when they help the user decide

Do not turn that extra thinking into friction. If the request is simple and the best path is obvious, act quickly.

## Best-Practice Spine

Default to the stable spine unless the brief says otherwise:

- Generate the requested medium directly for a simple prompt-only job; never add a board only because video quality matters.
- GPT Image 2.5 Sunburst at 1440p/high for final stills, all image edits/refinements and explicitly chosen character, scene, look, product, or per-shot control assets. Other image models require an explicit user choice or the shared fallback decision.
- Seedance 2.5 for the video spine.
- `seedance-2.5` for lightweight drafts, previews, simple social clips, and cost-sensitive work.
- `seedance-2.5` for serious output, strong reference following, product/brand/automotive hero work, and official production playbooks.
- Reference assets must stay in the chain when they define the requested subject. Do not silently degrade a reference task into pure text-to-video.

## Freedom And Rigidity

Keep these levels separate:

| Rule type | Examples | Rigidity |
|---|---|---|
| Explicit user WHAT | model, aspect ratio, duration, count, style, roughness, "do not use X" | highest unless impossible |
| Craft locks | preserve uploaded subject, product identity, exact plate, multi-reference control | high; retry or equivalent fallback |
| Taste defaults | direct preview for simple work; controlled staged production when continuity risk is real | strong defaults, but overridable |

## Calibration Examples

Use examples like these to keep the agent specific instead of generic:

| User brief | Think this way | Likely route |
|---|---|---|
| 1970s American road-film look | translate the era into production grammar: practical locations, period cars/signage, New Hollywood naturalism, grain, heat shimmer, restrained acting, car-mounted or handheld camera; avoid modern glossy "cinematic" polish | board or storyboard frame first, then Seedance 2.5/reference |
| intentionally bad composition or shaky footage | preserve the flaw as the target; QA should not "fix" off-balance framing, awkward crop, or amateur movement unless it becomes random failure | prompt-only or I2V with explicit controlled imperfection |
| warm 3D kitten-and-puppy family trailer | design trailer beats, character appeal, pacing, and shot variety; do not let "cute" collapse into one static scene | storyboard/boards, then Seedance 2.5 for hero shots; use SFX/ambience only or separate music according to brief |
| product hero commercial | product identity is the hard lock; exact packaging and final packshot matter more than abstract mood | gpt-image board/product plate -> Seedance 2.5 reference |
| native UGC ad | credibility and platform grammar matter more than polish; phone framing, imperfect timing, and direct benefit beats can be intentional | Seedance 2.5 for hook tests, Seedance 2.5 reference if product fidelity matters |

Do not reuse the same prestige-film filter across unrelated briefs. The right "high quality" version of a request depends on the user's aesthetic target, even when that target is rough, historical, funny, cheap, or deliberately wrong.

## Ask Or Act

Ask only when the missing answer changes cost, format, legality, or a hard creative direction. Otherwise infer, state the assumption briefly, and proceed.

For complex or expensive work, present a compact route board before quote. For a 30-second character animation, lock character -> scene/look -> individual shot boards -> video. For a 90-minute film, lock script/bibles -> acts/reels/scenes -> per-scene boards/animatics -> bounded video batches.

| Route | Why it fits | Model/mode | Credit-spend shape | Risk |
|---|---|---|---|---|

For simple work, one sentence about the planned generation is enough; follow the effective confirmation policy without adding a review stop.
