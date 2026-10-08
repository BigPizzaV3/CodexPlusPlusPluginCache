---
name: pixverse-presenter
description: "AI presenter: make an episode led by one consistent on-screen presenter, with measured speech, supporting shots and a finished edit."
---

# Presenter Episodes

When this workflow generates images or video, apply `../../skills-shared/quality-policy.md`:
Sunburst 2K/high for images, Seedance 2.5 1080p with automatic prompt enhancement for video,
and a stopped upgrade/fallback choice for Free/Basic or model-entitlement rejection.


Keep the same host recognizable across an episode while giving the explanation enough visual variety.

Read `./references/episode.md` before script splitting, prompt authoring or production.
It defines casting/bootstrap, three physical cameras, speech-derived durations, the full
voice/performance prompt, supporting-media choices, measured phrase anchors and editable
assembly. These requirements are part of a complete episode; generic calm delivery is
not an adequate substitute. A standalone avatar clip follows its narrower user brief.

## Lock The Host And Script

Use the supplied accepted image/video avatar. If no host exists, establish a concrete appearance and accept a reference before producing many dependent shots. Record face, hair, wardrobe, set and reference roles in project memory. A reference pack provides conditioning; it does not train a persistent identity model.

Write or accept the full spoken script. Divide it into coherent speaking sections with pronunciation notes. For a recurring program, preserve the host references and episode style while updating content and required factual sources.

## Plan The Performance

Choose which passages need the host on camera and which need evidence, screen capture or explanatory cutaways. Make per-shot control frames for the host's important camera positions. Avoid asking one long generation to preserve an entire episode.

For visible speech, request the accepted words in native speech shots or use an actually available supported sync service. Audio-reference conditioning is not a guarantee of identical voice. Replacing a talking clip's soundtrack with new TTS is not a lip-sync solution.

Use reaction and listening shots only where appropriate. Keep camera position, eye line and set coherent, and let natural pauses create edit points.

## Timing And Prompt Contract

Calculate each job from its actual spoken copy plus a 0.4s onset/closing allowance,
rounded up within supported limits. Chinese requires a spoken-duration estimate.
No per-cut time buffer or default long silent ending. Change physical viewpoint and
shot size at meaningful phrase transitions; do not add a cut quota. Write reference
lock, numbered physical shots, VOICE & MANNER, REALISM LAYER, exact dialogue once per
shot, semantic cut cues and a brief natural landing. The image fixes appearance, not
a frozen body pose. Keep overlay instructions in the edit plan.

## Complete The Episode

Edit accepted speaking sections and supporting visuals into the full script order. Check word accuracy, pronunciation, lip sync, voice consistency, face, wardrobe and transitions. Use captions only when requested or included in the plan. If exact speech is not achieved, identify the affected take and choose a supported repair through a new preflight when needed.

Deliver the completed episode and an episode record with host/reference IDs, accepted take IDs and reusable style choices. A series request is planned and approved in manageable episode batches.

## Execution

Read `../../skills-shared/production-brief.md` for reference roles, prompt construction and revisions.
For media execution, follow `../../skills-shared/cli-workflow.md`; load the gateway before manual
CLI commands or queue specs. Resolve the plugin root from this skill's installed path:
set `PVX="<absolute-plugin-root>/scripts/pvx"` and invoke `"${PVX}"` with the documented arguments.
Prompt-only work ends with the usable plan and prompts; it needs no account or generation calls.
