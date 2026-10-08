---
name: pixverse-ranking-video
description: "Ranking video: a host argues a tier list, top-N or comparison while an on-screen board keeps every verdict, with word-anchored reveals, karaoke captions, B-roll jokes and reveal sounds."
---

# Ranking Video

When this workflow generates images or video, apply `../../skills-shared/quality-policy.md`:
Sunburst 2K/high for images, Seedance 2.5 1080p with automatic prompt enhancement for video,
and a stopped upgrade/fallback choice for Free/Basic or model-entitlement rejection.

A ranking makes an argument through comparison. The board remembers earlier judgments while
the host, evidence and performance explain the next one. The picture is generated; the board,
captions, inserts and sounds are composed locally and land on the words that decide them.

## Installed Command

Before running helper commands, resolve the absolute plugin root from this `./SKILL.md` path: it is two directories above this skill directory and contains `.codex-plugin/plugin.json`. In every new shell session, set:

```bash
PVX="<absolute-plugin-root>/scripts/pvx"
```

Run helper commands through `"${PVX}"`. Do not assume the user's current working directory is the plugin checkout, and do not bypass the installed wrapper with a module invocation.

## Shape The Argument

Resolve the subjects, the verdict for each, the board type (tier rows, numbered column, top
three), the host and the tone. Preset entries can already occupy the board when the clip
opens; the spoken passages introduce the subjects being judged now. Each subject gets a
verdict line with a clear verdict word, a reason with comic or factual evidence, and an
optional insert that illustrates the joke or claim.

Write the script with `../../skills-shared/semantic-script.md`: a moment on each verdict word
(`@{tea-verdict!}D tier`), a selection around each explanation that an insert should cover,
cue breaks by reading phrase. Measure it; ranking lines read fast, so choose take durations
with a small margin.

## Produce The Material

- Host image: `../../skills-shared/prompt-kits.md` phone-capture kit, host toward one side,
  the board's region calm. Reuse a supplied person as the identity reference.
- Speaking take(s): `../pixverse-talking-head/SKILL.md` with the script's dialogue, one take
  per segment; keep attitude and eye contact in the prompt.
- Subject icons: supplied photographs or logos for real subjects (identifiers are never
  generated lookalikes); generated stills for fictional or generic subjects.
- Inserts: one Sunburst still per joke or claim with its own visual language; no board
  furniture in the picture.
- Sounds: builtin `pop`/`ding` reveal sounds are enough; add music through `../pixverse-audio/SKILL.md`
  when the brief wants a bed.

## Compose

Follow `../../skills-shared/word-timing.md` to align each take, then render one board state
per verdict with the `tier-board` or `ranked-column` component
(`../../skills-shared/graphics-components.md`) and bind states, inserts, captions, verdict
stamp and sounds in a plan (`../../skills-shared/anchored-composition.md`). The reference
plan in `./references/board-recipe.md` is the starting point.

## Check And Deliver

Sample the frames on each verdict word and each insert handoff. The board must change on
its word, remain readable at delivery size and never cover the host's face; inserts must
leave before the next claim. Deliver the video with the script, timeline, plan and graphics
so a new subject list or a new host is a re-run, not a rebuild
(`../pixverse-video-variants/SKILL.md`).

## Execution

Read `../../skills-shared/production-brief.md` for reference roles, prompt construction and revisions.
For media execution, follow `../../skills-shared/cli-workflow.md`; load the gateway before manual
CLI commands or queue specs. Local media, script, timeline and graphics commands spend no credits.
Prompt-only work ends with the usable plan and prompts; it needs no account or generation calls.
