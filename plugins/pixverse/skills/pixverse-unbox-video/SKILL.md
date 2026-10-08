---
name: pixverse-unbox-video
description: "Unboxing video: build a believable package-opening sequence whose reveal leads to the actual product, with consistent hands, packaging and sound."
---

# Unboxing Video

When this workflow generates images or video, apply `../../skills-shared/quality-policy.md`:
Sunburst 2K/high for images, Seedance 2.5 1080p with automatic prompt enhancement for video,
and a stopped upgrade/fallback choice for Free/Basic or model-entitlement rejection.


Make the reveal follow the package's real construction. Read `./references/production.md`
before the board or prompt: the four-part arc, opening branches, timing, performance,
hand allocation and closing transition are core production rules.

## Establish The States

Inspect the outer package, opening mechanism, inner tray and verified contents. The standard
arc begins with a closed package. If only an open reference exists, reconstruct a closed
state only when the visible parts support it; otherwise resolve missing evidence. Preserve
an explicit already-open brief, but do not silently choose it for a requested full unboxing.

Use four active 9:16 slots on a 21:9 board: PACKED → REVEAL → PRODUCT-FOCUS → SATISFACTION.
Create and refine the board, then use clean board + creator + product for the video.
One package in cut 1; its correct opening ends that cut. The product emerges in cut 2;
the package may remain at an edge there, then disappears for cuts 3–4. One product and
two explicitly assigned hands; don't re-open or re-pack between beats.

Use a visible creator by default, preserving an explicit hands-only request. Default POV is
fixed → fixed → fixed close-up → selfie. For 12s, allocate 3 / 3.5 / 2.5 / 3 seconds.
Write four timed Cut sections. Usually there are three hard cuts; on an eligible closing
clip the reference requires one continuous Pick-Up instead of the final boundary.

## Write The Performance

Each cut describes one distinct action in motion, real grip/weight, at least five small
observable changes and its exact dialogue/sound. First sound within .4s; natural anticipation,
one real reveal peak, detail observation, satisfied resolution. Keep mouths unobstructed
for visible speech. No slow-lift/slow-rotate/long-hold default. The reference supplies
the package-specific mechanics and caption/ending rules; do not substitute a generic box.

If a long opening exceeds a credible short shot, divide it at a real state change. Do not cover impossible package motion with a rapid cut and claim the demonstration was checked.

## Finish

Check hands, lid geometry, contents count, insert and the reveal's clarity. Preserve native package sounds when useful. For a reaction line, keep spoken experience fictional or user-supplied instead of asserting a real testimonial. Add captions only when requested. Deliver the completed edit; repair only the broken state or transition.

## Execution

Read `../../skills-shared/production-brief.md` for reference roles, prompt construction and revisions.
For media execution, follow `../../skills-shared/cli-workflow.md`; load the gateway before manual
CLI commands or queue specs. Resolve the plugin root from this skill's installed path:
set `PVX="<absolute-plugin-root>/scripts/pvx"` and invoke `"${PVX}"` with the documented arguments.
Prompt-only work ends with the usable plan and prompts; it needs no account or generation calls.
