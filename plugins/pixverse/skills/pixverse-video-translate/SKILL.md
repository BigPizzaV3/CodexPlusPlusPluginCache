---
name: pixverse-video-translate
description: "Video localization: deliver the same video in another language with a rewritten script, native or narrated speech, re-timed captions and graphics, and typography that fits the target script."
---

# Video Localization

When this workflow generates images or video, apply `../../skills-shared/quality-policy.md`:
Sunburst 2K/high for images, Seedance 2.5 1080p with automatic prompt enhancement for video,
and a stopped upgrade/fallback choice for Free/Basic or model-entitlement rejection.

The same piece in another language, not a subtitle pass. The script is rewritten for the
target audience, the performance is spoken in that language, and captions, boards, labels
and sounds re-flow to the new words because they are bound to script anchors.

## Installed Command

Before running helper commands, resolve the absolute plugin root from this `./SKILL.md` path: it is two directories above this skill directory and contains `.codex-plugin/plugin.json`. In every new shell session, set:

```bash
PVX="<absolute-plugin-root>/scripts/pvx"
```

Run helper commands through `"${PVX}"`. Do not assume the user's current working directory is the plugin checkout, and do not bypass the installed wrapper with a module invocation.

## Translate The Meaning

Rewrite with `../../skills-shared/semantic-script.md`, keeping the same segments and anchor
names so the plan needs no change. Translate punchlines and claims for effect, not word by
word; keep numbers, names and product terms exact with `<shown|said>` readings. Cue breaks
follow the target language's reading rhythm: Chinese and Japanese phrases by meaning without
spaces, Spanish and German with longer phrases and fewer, larger cues. Measure the new
segments; translations change length, so re-choose take durations.

## Produce The Speech

- **Native speech** (default when a person is on camera): regenerate each take through
  `../pixverse-talking-head/SKILL.md` with the same host image and a voice reference in the
  target language (`create voice` with a matching preset and `--language`).
- **Narration over existing picture**: keep the accepted takes muted, generate narration with
  `../pixverse-voiceover/SKILL.md`, and align it as an audio take so anchors come from the
  narration. In the render plan use `base: {"media": "<absolute original video path>",
  "mute": true}` and an `audio` layer pointing to the narration with `during: "program"`.
  Recut or explicitly extend the picture to the measured narration duration before export;
  a longer narration does not automatically extend the original picture.
- **Dubbing an existing recording**: only when the user accepts that lips will not match;
  otherwise choose native regeneration.

Reuse everything that does not speak through `../pixverse-video-variants/SKILL.md`.

## Re-flow And Typeset

Rebuild the timeline with `--language <code>` (`../../skills-shared/word-timing.md`), then
re-render the plan (`../../skills-shared/anchored-composition.md`). Captions pick a CJK face
automatically; check glyph coverage and line length for the target script, and pass
`--size`/`--margin-v` when a longer language needs it. Re-render labels, stickers and board
text with the translated strings (`../../skills-shared/graphics-components.md`). Read
`./references/language-notes.md` for per-language caption and timing rules.

Deliver one file per language with its script, timeline and plan. Sample the same anchors in
every language to confirm reveals still land on the right words.

## Execution

Read `../../skills-shared/production-brief.md` for reference roles, prompt construction and revisions.
For media execution, follow `../../skills-shared/cli-workflow.md`; load the gateway before manual
CLI commands or queue specs. Local media, script, timeline and graphics commands spend no credits.
Prompt-only work ends with the usable plan and prompts; it needs no account or generation calls.
