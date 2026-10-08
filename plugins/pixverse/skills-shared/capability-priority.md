# PixVerse Capability Priority

PixVerse CLI capabilities are atomic, but they are not equal-weight creative choices. Use this priority map to stay fast and accurate while preserving advanced options.

Apply `./quality-policy.md` for image/video defaults, automatic Seedance prompt enhancement and membership choices.

## Priority Tiers

| Tier | Capabilities | Agent stance |
|---|---|---|
| Primary creative spine | GPT Image 2.5 Sunburst 2K/high stills and image edits; Seedance 2.5 video; Seedance reference; image-to-video from locked boards; `pvx queue`; smart project resume; QA | Think of these first for most serious visual work |
| Core support | setup/account/slots, quote, task status/wait, asset upload/download/info, upscale, local ffmpeg/subtitles | Use to make the spine reliable |
| Conditional modes | transition, motion-control, extend, modify, voice, music, template generation | Use when the brief or source assets specifically call for them |
| Management/edge | saved folders, workspace switch, config defaults, template discovery, subscribe | Know they exist, but do not surface in ordinary creative decisions |

## High-Signal Defaults

- Visual uncertainty or product/character/UI fidelity: make still boards first.
- User provided subject/reference materials: route them into image reference, Seedance reference, or I2V. Do not replace them with pure prompt interpretation.
- Serious product, brand, automotive, or hero video: GPT Image 2.5 Sunburst 2K/high board/plate/storyboard -> `seedance-2.5` reference.
- Fast social draft or early exploration: `seedance-2.5` at 1080p remains the default.
- Use `seedance-2.5` when the reviewed normalized capability domain is present and the shot needs 16–30 seconds, automatic framing/duration, or more than nine image references, or the user selects it. The CLI omits the audio toggle; keep sound in the prompt and inspect the result. This is not evidence that native audio is unsupported.
- FLUX 3 and Wan 3.0 are reviewed internal capability additions, not automatic routing replacements. Use them when the user selects them or their declared mode/parameter strengths solve a named need, then validate the exact offline Create contract.
- Multi-shot continuity: image-side asset sheets and storyboard frames before video.
- Existing good clip that only needs more time: extend instead of regenerating.
- First and last states are known: transition instead of generic video.
- Exact text/logo/UI: create a locked image plate; do not rely on video text generation.
- Inside a Canvas-bound project, executable graph-native editing nodes outrank local FFmpeg when they
  satisfy the requested result. Reuse existing graph assets; local post is a fallback for unsupported
  requirements or an explicitly requested local deliverable. This priority does not change any
  non-Canvas editing, queue, download, or delivery route.

## Fallback Rules

Fallbacks should preserve control:

- Reference failure: keep the same reference intent; adjust prompt, asset order, storyboard frame, or compatible model. Do not silently drop references.
- Model/parameter wall: choose a model that supports the requested aspect, duration, quality, or mode.
- Subject drift: strengthen identity anchors or move control earlier to image/reference.
- Weak but usable result: disclose and keep it unless it misses a hard constraint.
- Hard failure: retry after preflight confirmation rules, with a bounded attempt budget.

## Edge Capability Discipline

Use edge functions when they solve a named problem:

- saved folders: organize a long-running cloud asset set
- workspace: team/account context needs switching
- template: the user wants a platform effect, meme format, or template-driven style
- config defaults: user asks to change recurring CLI defaults
- subscribe/account: setup, balance, or billing issue

Do not make the user or agent choose among these during normal video ideation.
