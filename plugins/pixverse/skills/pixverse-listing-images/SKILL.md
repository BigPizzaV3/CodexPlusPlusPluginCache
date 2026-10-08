---
name: pixverse-listing-images
description: "Listing graphics: create a coordinated set of product cards with accurate specifications, exact editable text and consistent product identity."
---

# Listing Images

When this workflow generates images or video, apply `../../skills-shared/quality-policy.md`:
Sunburst 2K/high for images, Seedance 2.5 1080p with automatic prompt enhancement for video,
and a stopped upgrade/fallback choice for Free/Basic or model-entitlement rejection.


Turn verified product information into a readable image sequence. The image sequence should answer the buyer's questions in a useful order.

Read `./references/listing-bundles.md` for main / product-images / A+ / full-set requests.
Their default counts are 1 / 6 / 8 / 13, with exact ordered module roles; custom subsets
keep the user's list. Reuse an accepted main image. Check current official marketplace
rules when the user requests a submission-ready listing.

## Assemble The Page

- Extract item name, approved claims, specifications, variants and usage from supplied material. Missing numbers stay missing; do not invent performance, price or customer experience.
- Assign a purpose to each requested card: identification, visible feature, dimensions, comparison, operation or care. Avoid repeating the same sales sentence on every card.
- Use supplied photography or `../pixverse-product-stills/SKILL.md` for missing product plates. Generate cards with Sunburst; use FFmpeg text/graphic overlays for exact labels, units or supplied diagram layers when needed.
- Generate backgrounds or scene plates only where they improve the explanation. Product mechanics and chart relationships should come from facts.
- Render final images at the requested channel dimensions. If dimensions are unspecified, use a practical draft size and record it; verify current platform requirements before promising submission compliance.

## Layout Decisions

Use a clear reading order: heading, evidence, supporting detail. A specification card needs alignment and units; a comparison needs the same scale and attributes on both sides; a tutorial needs action order. Keep all items within safe crop areas. Test the text at a realistic phone viewing size.

## Prompt Boundary

The image prompt describes product, composition, surface, lighting and reserved copy space. Keep the exact copy in a separate layout layer. For example: “Reference the supplied compact kettle without changing its spout, handle or 0.8 L marking. Three-quarter view on a neutral background, product in the right 55 percent, evenly lit metal with controlled reflections. Leave the left column plain for a separate specification layout.”

## Deliver And Revise

Deliver completed card images, plus FFmpeg overlay sources when requested. Check every number and unit against the input. Updating a specification changes its text/layout and only images whose visual content depends on that fact.

## Execution

Read `../../skills-shared/production-brief.md` for reference roles, prompt construction and revisions.
For media execution, follow `../../skills-shared/cli-workflow.md`; load the gateway before manual
CLI commands or queue specs. Resolve the plugin root from this skill's installed path:
set `PVX="<absolute-plugin-root>/scripts/pvx"` and invoke `"${PVX}"` with the documented arguments.
Prompt-only work ends with the usable plan and prompts; it needs no account or generation calls.
