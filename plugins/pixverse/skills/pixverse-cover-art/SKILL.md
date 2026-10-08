---
name: pixverse-cover-art
description: "Video thumbnail and YouTube cover: create a clear, compelling cover with controlled subject identity, mobile-readable composition and editable exact text."
---

# Video Covers

When this workflow generates images or video, apply `../../skills-shared/quality-policy.md`:
Sunburst 2K/high for images, Seedance 2.5 1080p with automatic prompt enhancement for video,
and a stopped upgrade/fallback choice for Free/Basic or model-entitlement rejection.


A cover makes one understandable promise about the video. Find that promise before decorating the frame.

Read `./references/thumbnail-recipes.md` before concept selection or prompts. It supplies
16 frameworks, at least five internal concept candidates, exact identity/reference roles,
the eleven-block prompt, text/split gates, emotion/take variation and surgical edits.
Default to a clean image; a headline or people-led concept needs the corresponding resolved
input. Do not pass a style-only thumbnail as an identity reference.

## Choose The Idea

Read the title or content summary and inspect supplied faces/products. Identify the evidence object or visible contrast that explains why someone would watch. Choose one central relationship: person and result, small and large, before and after, question and evidence, or a revealing detail.

Use a small number of concept descriptions when direction is open. Generate only the number of candidates requested or included in the approved plan. Do not invent sensational events or results absent from the content.

## Build The Image

1. Place the face or key object large enough to read at thumbnail size; preserve reference identity.
2. Limit competing elements. Use lighting, crop and contrast to direct attention.
3. Generate the required image plate. Keep title words and exact brand marks in a controlled text/vector layer when precision matters.
4. Export at the requested platform ratio. Review both full resolution and a roughly 120–160 pixel-wide preview.

## Prompt Example

“Preserve the supplied presenter’s face and glasses. She holds the real pocket projector at chest height, looking toward its small sharp projection on the wall. Waist-up framing on the right, a dark uncluttered wall on the left reserved for the exact title. Plausible warm room lighting, curious expression rather than exaggerated shock. Keep projector lens and buttons unchanged.”

## Check The Promise

Can a small image communicate the main relationship? Is the title readable and truthful? Are the face, product and essential detail intact? Deliver the finished image; a blank text plate alone is incomplete. Changing the title should usually only require layout and export. Do not claim improved click-through without an actual experiment.

## Execution

Read `../../skills-shared/production-brief.md` for reference roles, prompt construction and revisions.
For media execution, follow `../../skills-shared/cli-workflow.md`; load the gateway before manual
CLI commands or queue specs. Resolve the plugin root from this skill's installed path:
set `PVX="<absolute-plugin-root>/scripts/pvx"` and invoke `"${PVX}"` with the documented arguments.
Prompt-only work ends with the usable plan and prompts; it needs no account or generation calls.
