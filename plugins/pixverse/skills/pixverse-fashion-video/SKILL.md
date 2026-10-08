---
name: pixverse-fashion-video
description: "Try-on video: show clothing or wearable accessories on a consistent person, with fit, material and movement tied to supplied references."
---

# Fashion Video

When this workflow generates images or video, apply `../../skills-shared/quality-policy.md`:
Sunburst 2K/high for images, Seedance 2.5 1080p with automatic prompt enhancement for video,
and a stopped upgrade/fallback choice for Free/Basic or model-entitlement rejection.


Show how a specific item sits and moves on the same wearer. For the standard creator try-on,
read `./references/production.md` before designing boards or video prompts. Its eight-shot
structure, garment states, speech split and timing are part of this workflow's result.

## Plan The Wear

Inspect the wearable reference: front/back, pattern, seams, length, closure, logo and material. Inspect the chosen wearer reference or establish one consistent adult creator. Do not infer unseen construction, body measurements or fit guarantees.

Plan 4–15 second clips with eight active beats per board: pre-wear, wearing, front pose,
hand-free texture, turn, different hand-free detail, styled pose in another room, final look.
The bag/pre-wear outfit exists only in board 1 slot 1; a hard cut performs the change, with
no dressing or bag extraction on camera. Slot 2 includes one natural twirl. Later boards
follow home tour, outdoor, home reflection and continuation roles from the reference.

Use a sequential 21:9 eight-panel board and its required realism refinement, then condition
video on the clean board, accepted creator and product. Cuts 1/2/3/5/7/8 use visible native
speech; 4/6 use the same voice over hand-free macros. Write all eight timed Cut sections
and seven hard-cut boundaries, except the reference's narrowly defined camera Pick-Up.

## Timing And Overrides

For 12 seconds the cut lengths are 1.5 / 1.75 / 1.5 / 1.25 / 1.5 / 1.25 / 1.75 / 1.5.
The reference contains the other durations, body/hand staging, loop and quality rules.
Keep a fixed camera alive with the person's movement; do not default to an uncut slow walk.
Explicit single-shot editorial, silent, location or director instructions can override this
standard UGC treatment. Preserve that decision rather than calling the adapted result the
unchanged eight-beat recipe. Do not invent a real creator's ownership or experience.

## Finish

Cut around complete actions rather than hiding every difficult moment. Add exact size/material copy as a deterministic layer only when supplied. Check face continuity, pattern, hem, fastener, body intersections and realistic hand contact. Deliver the finished video and keep accepted shots when repairing one garment defect.

## Execution

Read `../../skills-shared/production-brief.md` for reference roles, prompt construction and revisions.
For media execution, follow `../../skills-shared/cli-workflow.md`; load the gateway before manual
CLI commands or queue specs. Resolve the plugin root from this skill's installed path:
set `PVX="<absolute-plugin-root>/scripts/pvx"` and invoke `"${PVX}"` with the documented arguments.
Prompt-only work ends with the usable plan and prompts; it needs no account or generation calls.
