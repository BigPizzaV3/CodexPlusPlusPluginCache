---
name: pixverse-talking-head
description: "Talking head: one person speaks a script straight to camera as reusable A-roll, with a locked identity, a consistent voice, measured durations and word timing delivered for captions and graphics."
---

# Talking Head

When this workflow generates images or video, apply `../../skills-shared/quality-policy.md`:
Sunburst 2K/high for images, Seedance 2.5 1080p with automatic prompt enhancement for video,
and a stopped upgrade/fallback choice for Free/Basic or model-entitlement rejection.

Produce the spoken performance itself: a person delivers exact words to camera with a stable
identity and voice, in takes sized to the script. The output is A-roll plus measured word
times, ready for captions, boards, inserts and stickers in other workflows, or delivered as
is. Creator ads with products use `../pixverse-ugc-video/SKILL.md`; full hosted episodes use
`../pixverse-presenter/SKILL.md`.

## Installed Command

Before running helper commands, resolve the absolute plugin root from this `./SKILL.md` path: it is two directories above this skill directory and contains `.codex-plugin/plugin.json`. In every new shell session, set:

```bash
PVX="<absolute-plugin-root>/scripts/pvx"
```

Run helper commands through `"${PVX}"`. Do not assume the user's current working directory is the plugin checkout, and do not bypass the installed wrapper with a module invocation.

## Lock Words, Person, Voice

Write or accept the script in `../../skills-shared/semantic-script.md` form: segments per
take, cue breaks, pronunciation for names and numbers. Measure each segment
(`"${PVX}" script measure ... --rounding ceil`) and pick a supported duration with a small
margin; natural takes add pauses.

Identity: a supplied portrait or an accepted generated image from the phone-capture kit
(`../../skills-shared/prompt-kits.md`), seated or standing where the brief needs, with calm
space where graphics will go. Voice: one short TTS reference line (`create voice`, a preset
that fits the person) reused on every take as an `--audios` reference. Record image, voice
and wardrobe in project memory so later segments and variants keep them.

## Generate Takes

Seedance 2.5 `create reference` per segment through the gateway: host image, voice
reference, the speaking-take kit with the segment's `dialogue` projection as the exact
words, one physical beat per phrase, composition stability and camera axis chosen for the
format. No captions, on-screen text or music in the take. Submit segments as one queue;
each is independent, so a retake replaces only its own segment.

## Measure And Deliver

Build the timeline (`../../skills-shared/word-timing.md`) as soon as takes download. Check
alignment confidence, unmatched words and extra ASR words. Listen to flagged passages:
correct the transcript if recognition is wrong; only a verified skipped or added spoken
word calls for a retake of that segment under the effective generation policy. Deliver the takes, the timeline JSON and, when asked, captions
(`"${PVX}" timeline captions ... --style clean|karaoke`) or a finished composition through
`../../skills-shared/anchored-composition.md`. Read `./references/performance.md` for
delivery direction and multi-take continuity.

## Execution

Read `../../skills-shared/production-brief.md` for reference roles, prompt construction and revisions.
For media execution, follow `../../skills-shared/cli-workflow.md`; load the gateway before manual
CLI commands or queue specs. Local media, script, timeline and graphics commands spend no credits.
Prompt-only work ends with the usable plan and prompts; it needs no account or generation calls.
