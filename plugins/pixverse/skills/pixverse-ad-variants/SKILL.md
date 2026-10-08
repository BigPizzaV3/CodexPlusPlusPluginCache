---
name: pixverse-ad-variants
description: "Ad variations (Ad Multiplier): make ordered independent edits of one supplied ad, including person, wardrobe, product and background changes while preserving source performance, timing, untargeted text and audio. Also adapt an ad for new products, audiences or languages."
---

# Ad Variants

When this workflow generates images or video, apply `../../skills-shared/quality-policy.md`:
Sunburst 2K/high for images, Seedance 2.5 1080p with automatic prompt enhancement for video,
and a stopped upgrade/fallback choice for Free/Basic or model-entitlement rejection.


Start every variant from the same accepted source. Define what may change and what must survive before choosing an editing route.

For a similar ad with a new product, use the reference information already obtained by Codex
and continue with `../pixverse-product-video/SKILL.md`. Source-preserving edits below need
usable source footage. Codex chooses reference acquisition and understanding independently;
this plugin takes over the requested adaptation or edit.

For look changes that keep the motion, `../pixverse-video-restyle/SKILL.md` owns the route;
for versions of a project this plugin generated, `../pixverse-video-variants/SKILL.md` reuses
accepted assets. Read `./references/source-preserving.md` for the complete source-preserving variant recipe:
one 4–30s source, ordered reference mappings, full-look replacement, exact protected text,
timed operations, original-audio restoration and measured final checks. Keep its protected
properties in every prompt; a visually similar remake is not an equivalent result.

## Make A Change Sheet

Inspect the full supplied video, its duration, aspect, cuts, soundtrack, speech and visible text. For each requested variant record the source, one target change, protected elements and acceptance checks. Preserve the user's ordering and count. An open brief can start with textual options; do not generate an unrequested pack.

Distinguish local editorial changes from visual regeneration:

- Title, crop, speed, grade, mix or existing-asset arrangement: use `../pixverse-video-editing/SKILL.md`.
- Subject, wardrobe or scene replacement: evaluate current modify/reference-edit capabilities through the gateway and account-aware route.
- Motion transfer: use a route explicitly supporting motion reference; do not claim it preserves the original scene, voice or edit.

A candidate generation route is not proof of exact preservation. If a requirement exceeds current model limits, explain the affected requirement and propose a smaller edit or source-preserving composition before paid work.

For Seedance 2.5 source edits, the current route is `create reference --task-type edit`
with the original video in `--videos`, `--duration auto`, `--aspect-ratio auto` and
`--quality 1080p`. Verify the offline capability through the gateway before composing
the queue. Ordinary reference generation and `create modify` are not interchangeable
with this edit route. The CLI has no Seedance audio toggle; preserve original audio at
export. Follow the concrete prompt and finishing references linked from the source recipe.

## Prompt Example

"Use the original clip's standing presenter, actions and camera framing as the reference. Change only the wall behind her to a pale blue plaster wall under the same daylight direction. Keep her face, clothes, hand actions and product unchanged. Retain the visible sequence without adding a cut."

Keep soundtrack reuse as an explicit edit requirement outside the generation prompt; the prompt alone cannot guarantee it. Each variant binds the original source, never the preceding generated variant.

## Compare And Deliver

Compare source and result at cut boundaries, difficult motions and text moments. Check full duration, frame composition, face/product fidelity and temporal behavior. Where authorized and synchronization still matches, reuse the original audio and exact overlays deterministically. Changed lip motion can invalidate reuse of the original speech.

Deliver the requested variants with a compact change sheet. Report any preservation failure instead of silently replacing “same motion/timing” with “similar style.” Repair only the rejected version.

## Execution

Read `../../skills-shared/production-brief.md` for reference roles, prompt construction and revisions.
For media execution, follow `../../skills-shared/cli-workflow.md`; load the gateway before manual
CLI commands or queue specs. Resolve the plugin root from this skill's installed path:
set `PVX="<absolute-plugin-root>/scripts/pvx"` and invoke `"${PVX}"` with the documented arguments.
Prompt-only work ends with the usable plan and prompts; it needs no account or generation calls.
