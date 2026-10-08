---
name: pixverse-visual-recipes
description: "Visual effects: apply a selected image treatment or short motion recipe to the user's subject through original prompts and suitable PixVerse routes."
---

# Visual Recipes

When this workflow generates images or video, apply `../../skills-shared/quality-policy.md`:
Sunburst 2K/high for images, Seedance 2.5 1080p with automatic prompt enhancement for video,
and a stopped upgrade/fallback choice for Free/Basic or model-entitlement rejection.


Translate the requested effect into a small set of physical choices. A recipe guides art direction; it is not a hidden model capability or an executable slash command.

Read `./references/execution.md` for selected treatment/preset resolution, browsing
versus execution, exact inputs, one submission and ordered result continuation.

## Choose The Treatment

First retain the requested medium, count, aspect, duration and reference. Select only a relevant family:

- Named product image treatment: `./references/preset-images.md`
  (45 recipes, one image and exact composition/text rules).
- Named product motion treatment: `./references/preset-motion.md`
  (18 recipes, required prepared start frame followed by a silent 6-second video by default).

- Image composition, lighting, material effects and everyday scenes: `./references/image-directions.md`.
- Camera movement, object rotation, lighting change and moving materials: `./references/motion-directions.md`.
- Exact product information or comparison: `../pixverse-listing-images/SKILL.md`.
- Content-linked thumbnail or cover: `../pixverse-cover-art/SKILL.md`.

Use the family to decide subject placement, a specific change, reference needs and likely failure. Combine effects only if the combined action remains legible within the requested duration. A free short motion brief stays a direct video task unless subject precision requires a control image. A selected product motion recipe requires its named starting-plate stage; do not drop it under the general simplicity rule.

## Form The Prompt

Describe the source object and what must remain recognizable. Specify the camera or material behavior with a clear start and finish. For motion, distinguish camera travel, object motion and light motion. Add intended sound in plain language. Keep technical model flags outside the prompt.

Example: “The reference ceramic speaker remains stationary on a charcoal surface. Start with a dim rim outlining its left edge. Over six seconds a broad soft light travels from left to right, revealing the woven front grille and the two top controls. The camera holds the same low three-quarter view throughout. Keep the body shape, control count and reference mark intact. Quiet room ambience; no speech or music.”

This example is a direction to adapt, not a stock prompt to append to every request.

## Add A New Direction

Add an original row to the appropriate reference with five useful parts: user effect, composition/action, required evidence, failure check and cheapest repair. Give a new top-level skill only to a distinct deliverable that needs its own decisions. Keep examples self-authored and model-independent. Do not invent provider preset IDs.

Verify the visible effect against the request. A camera orbit is not proof that the object rotated; a plausible back view is not an accurate unseen product design. If complete geometric fidelity matters, require matching product views and keep unsupported unseen details unresolved.

## Execution

Read `../../skills-shared/production-brief.md` for reference roles, prompt construction and revisions.
For media execution, follow `../../skills-shared/cli-workflow.md`; load the gateway before manual
CLI commands or queue specs. Resolve the plugin root from this skill's installed path:
set `PVX="<absolute-plugin-root>/scripts/pvx"` and invoke `"${PVX}"` with the documented arguments.
Prompt-only work ends with the usable plan and prompts; it needs no account or generation calls.
