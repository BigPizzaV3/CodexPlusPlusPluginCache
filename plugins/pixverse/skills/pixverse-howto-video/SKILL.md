---
name: pixverse-howto-video
description: "Product tutorial: show a specific product in a physically plausible sequence, with clear step labels and synchronized explanation."
---

# Product Tutorials

When this workflow generates images or video, apply `../../skills-shared/quality-policy.md`:
Sunburst 2K/high for images, Seedance 2.5 1080p with automatic prompt enhancement for video,
and a stopped upgrade/fallback choice for Free/Basic or model-entitlement rejection.


Teach a real operation so a viewer can repeat it. Each action must leave the product in a state that supports the next step.

Read `./references/production.md` and `../../skills-shared/ugc-production.md` before planning
the creator tutorial. The standard recipe requires four globally numbered steps per
4-15s clip, a four-panel board, mandatory refinement, persistent step headings and native
speech. Preserve these unless the user supplies a different exact procedure or explicitly
asks for a direct single-operation demonstration.

## Establish The Procedure

Use the supplied manual, approved instructions or directly observed product behavior. List the starting state, action, expected visible result and important caution for each step. Missing mechanics require source evidence; a model's plausible animation is not evidence.

Keep the procedure short enough to see. Break a complex motion at a real state boundary. Reuse the same product, creator/hands, work surface and orientation across shots. For precision, lock each shot's control frame and name the relevant button, connector, latch or fill line.

When a control frame must be the actual first frame, explicitly select image-to-video through
the gateway. General reference conditioning alone does not promise that starting state.

## Direct Each Step

Write the physical motion in order: which hand touches which part, in which direction, and when the expected result appears. Use close framing where the user must see a detail. Avoid a face blocking the procedure.

Example: “The reference lamp stands upright with its hinge at the supplied angle. The creator's right index finger presses and releases the single circular button on the base once; the lamp illuminates after the release. The left hand stays clear. Locked close-up showing finger, button and light head together. Keep the button position and base geometry unchanged. A quiet click and normal room ambience.”

Treat that action as an example only; do not assign these mechanics to a different product.

## Explain And Deliver

Write exact `Step N — Heading` labels (or the project's explicit language) into the board,
preserve them through refinement, and retain the matching label for the entire video cut.
Use the reference's em-dash typography, consistent font/position and global numbering.
Optional hook/subtitle overlays are separate. Repair illegible labels with a controlled
compositor; never quietly remove instructional text. Match narration to visible action.

At 12s, use four 3s steps. Reserve the final 0.5-1s of the last cut for a brief CTA unless
the brief excludes it; do not add a fifth step. The production reference defines caption
geometry, transitions, mechanics, reference order and specialized checks.

Check order, contact, actual operation, state continuity and label text. If the model cannot show a necessary mechanism accurately, use verified real footage or a clear controlled diagram and describe the limitation. Deliver a finished video whose instructions remain understandable at normal speed.

## Execution

Read `../../skills-shared/production-brief.md` for reference roles, prompt construction and revisions.
For media execution, follow `../../skills-shared/cli-workflow.md`; load the gateway before manual
CLI commands or queue specs. Resolve the plugin root from this skill's installed path:
set `PVX="<absolute-plugin-root>/scripts/pvx"` and invoke `"${PVX}"` with the documented arguments.
Prompt-only work ends with the usable plan and prompts; it needs no account or generation calls.
