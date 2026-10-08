---
name: pixverse-seedance-prompt-enhance
description: "Seedance 2.5 prompt enhancement: turn a brief and its reference assets into a ready-to-use video prompt. Apply automatically before Seedance 2.5 generation, reference, edit, extension or first/last-frame work; also supports prompt-only requests."
---

# Enhance Seedance 2.5 Prompts

Write the enhanced prompt yourself before queue or Canvas preflight. This is local creative
work, with no generation or external enhancer call. A prompt-only request ends with the
prompt. When supporting another workflow, return to it with the final prompt and parameters;
use `../../skills-shared/quality-policy.md` for defaults and account handling.

Based on the [official Seedance 2.5 prompt guide](https://docs.byteplus.com/en/docs/ModelArk/2607689),
reviewed 2026-09-15. Read `./references/modes.md` for the relevant mode. Examples here are
original plugin examples; the guide's API examples are not PixVerse CLI command contracts.

## Installed Command

Prompt enhancement itself needs no shell. If the calling workflow needs helper commands,
resolve the absolute plugin root two directories above this skill directory; it contains
`.codex-plugin/plugin.json`. In each new shell session set:

```bash
PVX="<absolute-plugin-root>/scripts/pvx"
```

Run helpers through `"${PVX}"`; do not assume the user's current working directory is the plugin checkout.

## Preserve The Request

Keep the user's subject, identity, product, story outcome, style, language, dialogue,
exact on-screen text, reference order, duration and sound requirements. An intentionally
rough or quiet clip stays that way. Do not invent extra scenes, people, claims, music,
dialogue, logos or paid control assets to make a prompt seem richer. If the user asks for
an exact verbatim prompt, pass it through and explain only material capability conflicts.

Resolve contradictions that the brief or assets already answer. Ask only when a remaining
choice materially changes the result. Do not describe unseen reference details as observed.
Use one coherent action for a simple shot; a longer prompt is not inherently better.

## Build The Prompt

1. Identify the task: new video, semantic reference, locked opening/end frame, edit, or
   extension. State which source is being edited/extended and which sources merely guide it.
2. Map supplied assets by type and actual upload order: `Image 1`, `Video 1`, `Audio 1`.
   Give each a specific purpose: identity, product shape, lighting, camera motion, voice,
   storyboard or keyframe. Bind a speaker's image and voice together. Do not rely on names
   printed inside a reference image or invent references that are absent from the command.
3. Establish the premise in one sentence: subject, setting, event, style and camera intent.
4. Describe the visible progression. For ordinary multiple beats, use contiguous time
   ranges covering the requested duration, or numbered shots where timing is flexible.
   Preserve a specialized recipe's fractional-second cut schedule, exact shot count,
   hard-cut/continuous-transition rules and word allocation. Integer rounding must never
   collapse its cuts or lengthen holds. Request-duration parameter constraints are separate
   from the creative shot timestamps inside the prompt.
   Give each beat achievable action, expression, framing and camera behavior. Allocate
   realistic time for exact speech; do not schedule every rapid movement by timestamp.
5. Specify only useful continuity constraints: identity, geometry, wardrobe, environment,
   exposure/color and motion direction. Explain unusual camera terms through their visible
   effect. Name the timing and mechanism of an intended transition.
6. State the sound plan: speaker and exact words, language and delivery, ambience, foley,
   music presence/absence. Prefer positive visual instructions; use direct “no subtitles”,
   “no BGM” or “no audio” constraints when requested.

For accurate references, refer to their intended properties without redundantly inventing
new descriptions that fight them. For general action, describe the overall behavior and a
few distinctive moments instead of an exhaustive list of gestures.

## Match The Actual Gateway

Default to `seedance-2.5`, 1080p. Its current Create modes are `video`, `reference` and
two-frame `transition`; editing and extension use **reference** with `--task-type edit`
or `--task-type extend`, not `create modify/extend --model seedance-2.5`.

Resolve required flags, frame roles and media arrays from the installed capability source.
For a new video with image references, use the default task type and avoid accidental
edit/extension trigger wording. The current integration advertises `--task-type reference`
in offline capabilities, but live image-only requests with that field returned HTTP 400;
the default route was accepted. Do not add the optional field for this path. Map locked inputs through `--image` or
ordered transition images, not merely prompt prose. Canvas uses its own live adapter.

The BytePlus API's `adaptive`, `duration=-1`, `content.role`, and `output_format` are not
literal PixVerse flags. For an edit, current CLI reference controls use `--aspect-ratio auto`
and `--duration auto`; extension uses auto framing and the requested continuation duration.
Use MOV only when the active gateway actually exposes it; renaming an MP4 is not MOV output.

Seedance 2.5 has no CLI audio, multi-shot or off-peak switch. Keep sound and intended cuts
in the prompt; never add `--audio`, `--no-audio`, `--multi-shot` or `--off-peak`. If guaranteed
silence is required, the calling workflow must remove audio at export. This skill does not
add automatic media QA or paid retries.

## Return And Check Before Preflight

Return the final usable prompt, the asset-role map if references exist, and any material
parameter constraint. For production, save prompts under `projects/<slug>/prompts/` using
the caller's existing project workflow. Put the enhanced text/file in the actual queue
command or Canvas source node before showing its confirmation sheet.

Check locally that every asset index exists, the timeline has no gaps/overlaps, dialogue
is preserved, the action fits the duration, and the prompt matches the selected mode.
Apply [gateway prompt budgets](../../skills-shared/prompt-budgets.md) to the actual
submitted text. Compress repeated language while preserving every specialized shot,
time range, action, hand role, speech allocation and cut marker; keep the full plan.
Prompt review is not media QA. Do not rewrite a prompt after approval without a fresh
preflight; do not treat an account entitlement failure as a reason to enhance/retry.
