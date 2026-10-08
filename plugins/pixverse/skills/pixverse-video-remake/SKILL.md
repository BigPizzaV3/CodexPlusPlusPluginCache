---
name: pixverse-video-remake
description: "Reference remake: rebuild a supplied or linked video as your own version with a new person, product, wording, language or platform, keeping the structure, timing relationships and graphics that made the original work."
---

# Video Remake

When this workflow generates images or video, apply `../../skills-shared/quality-policy.md`:
Sunburst 2K/high for images, Seedance 2.5 1080p with automatic prompt enhancement for video,
and a stopped upgrade/fallback choice for Free/Basic or model-entitlement rejection.

Start from the reference the user supplied (a file or a link) and the change they want:
their face, their product, a new audience, another language, another aspect. The result is
an original, editable production that keeps the reference's working relationships, not a copy
of its pixels.

## Installed Command

Before running helper commands, resolve the absolute plugin root from this `./SKILL.md` path: it is two directories above this skill directory and contains `.codex-plugin/plugin.json`. In every new shell session, set:

```bash
PVX="<absolute-plugin-root>/scripts/pvx"
```

Run helper commands through `"${PVX}"`. Do not assume the user's current working directory is the plugin checkout, and do not bypass the installed wrapper with a module invocation.

## Read The Reference

Follow `../../skills-shared/reference-breakdown.md`: get the file (`media fetch` for a link
when `yt-dlp` is installed, otherwise ask for the file), probe it, transcribe its speech,
make word-labelled contact sheets, and write `ANALYSIS.md` and `TIMELINE.md` under
`projects/<slug>/reference/`. Explain what the piece does for the viewer and which visual
and sound systems carry it: host performance, captions, board or list, B-roll, stickers,
titles, music. Name what each event responds to (a word, a claim, a reveal), because those
relationships are what the remake preserves when the seconds change.

Share the reading before generating: a short whole-piece explanation, the systems you will
keep, adapt or replace, and open questions about the user's material. Routine progress
needs no approval; a material creative choice does.

## Transform The Roles

Write the target `Brief` (what the user wants) and `Treatment` (how the new piece works) in
the project notes. Then apply `./references/transformation-lenses.md`: change the person,
product, wording, language, platform or style across every place that role appears. A
product is a prop, a screen, a claim and the closing call to action; a presenter is also the
voice, the lifestyle B-roll subject and the face inside a sticker. Preserve the purpose of an
action while giving it a form that fits the new body, product and platform.

## Rebuild The Structure

1. Write the new script with `../../skills-shared/semantic-script.md`: cue breaks where the
   reference's captions breathed, selections where its B-roll covered explanations, moments
   where its board or stickers landed. Measure each segment before choosing take durations.
2. Generate material with the matching workflows: host image and speaking takes through
   `../pixverse-talking-head/SKILL.md` (or `../pixverse-podcast-clip/SKILL.md`,
   `../pixverse-street-interview/SKILL.md` for those formats), B-roll stills with
   `../pixverse-create-image/SKILL.md`, montages through Seedance reference video,
   product identity from supplied photos. Use `../../skills-shared/prompt-kits.md` wording.
   Real people, logos and screens come from supplied assets, never lookalikes.
3. Align the takes and render with `../../skills-shared/word-timing.md` and
   `../../skills-shared/anchored-composition.md`; rebuild boards, stickers and titles as
   `../../skills-shared/graphics-components.md` states bound to the new anchors. Reuse the
   reference's music only when the user owns it; otherwise generate or supply a bed.

Keep the reference file, notes and evidence in the project. They are not delivered; the new
video and its editable script, timeline, plan and graphics are.

## Finish And Vary

Watch the finished file against the reference's relationships: does the reveal land on its
word, does the board keep its state, is the caption readable, does the music yield to speech?
Fix the script or plan and re-render before regenerating any take. For a family of versions
(new host, new product, new language, new aspect) continue with
`../pixverse-video-variants/SKILL.md`, which reuses every accepted asset.

## Execution

Read `../../skills-shared/production-brief.md` for reference roles, prompt construction and revisions.
For media execution, follow `../../skills-shared/cli-workflow.md`; load the gateway before manual
CLI commands or queue specs. Local media, script, timeline and graphics commands spend no credits.
Prompt-only work ends with the usable plan and prompts; it needs no account or generation calls.
