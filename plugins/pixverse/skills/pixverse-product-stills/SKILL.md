---
name: pixverse-product-stills
description: "Product photography: create product-led studio, lifestyle or still try-on images from references while preserving shape, materials, color and branding."
---

# Product Stills

When this workflow generates images or video, apply `../../skills-shared/quality-policy.md`:
Sunburst 2K/high for images, Seedance 2.5 1080p with automatic prompt enhancement for video,
and a stopped upgrade/fallback choice for Free/Basic or model-entitlement rejection.


Give each image a use: identifying the item, showing a feature, establishing scale or placing it in a believable setting.

Read `./references/shoot-recipes.md` before prompting. It defines ten modes, mode-specific
composition, three typography cases, multi-view identity chaining and targeted refinement.
Default an unspecified ordinary shoot to three distinct variants; preserve explicit count.
Do not reduce carousels or ad packs to unrelated studio images.

## Build The Shoot

1. Inspect the item before choosing a scene. Record the label, silhouette, material, moving parts and visible dimensions. Use the supplied image as a product reference, not just a mood cue.
2. Choose the requested number of compositions, or the recipe's three-variant default for
   an unspecified shoot. A carousel/ad pack needs its ordered outline before images.
3. Assign framing, surface, light and background. Reserve copy space only when requested;
   otherwise let the composition use the frame. Keep one product anchor across the set.
4. Use image reference generation through the account-compatible image route. For an invented product, establish an accepted design before producing dependent views.
5. Inspect every output for item fidelity. Finish exact labels or copy with a controlled layer when needed.

## Useful Choices

| Purpose | Art direction | What must hold |
|---|---|---|
| Catalog | Neutral background, readable contour, contact shadow | Entire item, true color, no extra packaging |
| Lifestyle | A specific plausible place and activity | Scale, real use, product remains visible |
| In-hand | A believable grip, clear fingers and supported weight | Correct grasp, hands and item proportions |
| Hero/banner | One dominant silhouette with copy space | Brand shape and crop-safe framing |
| Detail | Isolate the actual seam, connector, surface or mechanism | No invented feature |
| Static try-on | Accepted wearer and exact wearable placement | Pattern, fastening and body intersections |
| Collection | Distinct reference for each item, planned arrangement | Item count and identity |
| Concept/restyle | Change only the requested design or setting | Separate real product facts from concept changes |

For an effect-led brief, read only the matching family in `../pixverse-visual-recipes/references/image-directions.md`.

## Prompt Example

“Use the supplied moss-green insulated cup as the exact product. On a pale oak work desk, show its handle to camera-right and its closed black lid. Window light from camera-left produces a soft contact shadow. Eye-level three-quarter framing, cup occupying the left half, uncluttered space at right. Preserve the printed 350 ml mark, handle opening and matte coating. No extra straw or invented logo.”

## Deliver

Export the requested image set with purpose-based names. Compare labels, closures and color across the set. A failed angle does not invalidate the other accepted images.

## Execution

Read `../../skills-shared/production-brief.md` for reference roles, prompt construction and revisions.
For media execution, follow `../../skills-shared/cli-workflow.md`; load the gateway before manual
CLI commands or queue specs. Resolve the plugin root from this skill's installed path:
set `PVX="<absolute-plugin-root>/scripts/pvx"` and invoke `"${PVX}"` with the documented arguments.
Prompt-only work ends with the usable plan and prompts; it needs no account or generation calls.
