---
name: pixverse-voiceover
description: "Voiceover: produce natural narration or explicitly timed takes, preserving pronunciation, voice continuity and measured timing for editing."
---

# Voiceover

When this workflow generates images or video, apply `../../skills-shared/quality-policy.md`:
Sunburst 2K/high for images, Seedance 2.5 1080p with automatic prompt enhancement for video,
and a stopped upgrade/fallback choice for Free/Basic or model-entitlement rejection.


Start with the words, their pronunciation and the listening context. Fit the delivery to the meaning before optimizing duration.

Read `./references/production.md` for fixed-window takes, a continuous measured story read,
or an existing video plus photo becoming an on-screen narrator. These are distinct modes
with different timing/retry contracts; ordinary TTS and native UGC speech do not inherit
them automatically. Preserve voice locks and accepted takes; report missing revoice or
compositing capability instead of substituting a static portrait.

## Make The Takes

- Preserve the accepted text and speaker language. Choose a voice using the current CLI voice catalog; use real returned IDs. A stored voice ID is not evidence of voice-cloning support.
- Split at natural thought or breath boundaries. Keep continuous passages together when tone matters; one subtitle per TTS request is only useful for a deliberately timed take list.
- Use the voice model's actual supported controls for speed, emotion or style. Send the spoken text separately from nonspoken direction; do not accidentally speak labels such as “pause” unless the engine supports an established markup syntax.
- Submit via the existing paid queue contract. Measure returned duration and listen for word errors, clipped ends and unnatural pauses.
- If a time window is strict, record its bounds and actual voiced interval. Use the
  selected mode's content/duration correction; never time-stretch or cut speech to fit.
  A separately requested speed effect is an explicit edit, not a narration repair.

## Cue Example

Spoken text: “Open the lid, then press the button on the side.”
Direction: reassuring instructional delivery; a natural breath after “lid”; pronounce every action clearly. Keep this direction outside the literal TTS text when the selected model has no markup/control for it.

## Use With Video

Actual audio determines caption and edit timing. Use `../pixverse-captions/SKILL.md` when burned captions are requested. New narration over an on-camera speaker requires verified sync capability or a new native speech shot; do not silently replace the audio beneath old lip motion.

## Deliver

Provide the audio, exact spoken text, measured timing and take identifiers. Only repair failed takes. Avoid introducing a separate narration task where an accepted native video soundtrack already meets the brief.

## Execution

Read `../../skills-shared/production-brief.md` for reference roles, prompt construction and revisions.
For media execution, follow `../../skills-shared/cli-workflow.md`; load the gateway before manual
CLI commands or queue specs. Resolve the plugin root from this skill's installed path:
set `PVX="<absolute-plugin-root>/scripts/pvx"` and invoke `"${PVX}"` with the documented arguments.
Prompt-only work ends with the usable plan and prompts; it needs no account or generation calls.
