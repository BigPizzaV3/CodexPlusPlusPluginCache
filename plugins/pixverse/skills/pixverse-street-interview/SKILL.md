---
name: pixverse-street-interview
description: "Street interview: a question-and-answer encounter on location with interviewer, guest and shared views, timed reveals such as an answer strip or emoji board, reaction cuts and readable captions per speaker."
---

# Street Interview

When this workflow generates images or video, apply `../../skills-shared/quality-policy.md`:
Sunburst 2K/high for images, Seedance 2.5 1080p with automatic prompt enhancement for video,
and a stopped upgrade/fallback choice for Free/Basic or model-entitlement rejection.

A motivated encounter: someone stops someone, asks a question, and the answers arrive as
reveals the audience collects. The picture alternates interviewer, guest and shared views;
an answer strip or emoji board fills in on the spoken words; captions identify speakers.

## Installed Command

Before running helper commands, resolve the absolute plugin root from this `./SKILL.md` path: it is two directories above this skill directory and contains `.codex-plugin/plugin.json`. In every new shell session, set:

```bash
PVX="<absolute-plugin-root>/scripts/pvx"
```

Run helper commands through `"${PVX}"`. Do not assume the user's current working directory is the plugin checkout, and do not bypass the installed wrapper with a module invocation.

## Set Up The Encounter

Resolve the location, the interviewer (often off-camera or a mic-holding hand), the guest,
the question and the list of answers. Give the encounter a reason: something the guest has
or did that makes the question worth asking. Generate the guest's location portrait with the
phone-capture kit (`../../skills-shared/prompt-kits.md`), then complementary views: a
two-shot over the interviewer's shoulder, a tighter guest view for answers, an environment
view that shows the motivating detail. Real places and people come from supplied material.

## Script The Reveals

Use `../../skills-shared/semantic-script.md`: `ASKER:` and `GUEST:` turns, a moment on each
answer word (`@{rule-one!}Manifest.`), selections around the guest's explanations for
reaction cuts, cue breaks that isolate the answer words so captions land them alone. Measure
segments; keep each answer in its own 5–8 second take so a retake never touches accepted ones.

## Generate

Seedance 2.5 reference takes through the gateway with the guest image, the two-shot image
for shared views and a voice reference per speaker. Direct the physical exchange: the mic
enters from the interviewer's side, the guest looks slightly off-lens toward the asker,
reactions are small and quick. Handheld energy is welcome; keep the guest's framing region
stable so the strip and captions have a home.

## Compose

Align (`../../skills-shared/word-timing.md`) and render with a plan
(`../../skills-shared/anchored-composition.md`): a `reveal-strip` component whose states
reveal one slot per answer moment, `ding` or `pop` sounds on the same moments, captions with
`role_colors` per speaker, an environment still cut in on the motivating detail, a final
`label` summarizing the answers if the format wants it. Read `./references/reveal-board.md`
for the strip and reaction timing.

Check that each slot reveals on its word, reaction cuts return before the next answer, and
captions never cover the strip. Deliver the clip with script, timeline, plan and graphics;
new guests, languages or answer sets are variants (`../pixverse-video-variants/SKILL.md`).

## Execution

Read `../../skills-shared/production-brief.md` for reference roles, prompt construction and revisions.
For media execution, follow `../../skills-shared/cli-workflow.md`; load the gateway before manual
CLI commands or queue specs. Local media, script, timeline and graphics commands spend no credits.
Prompt-only work ends with the usable plan and prompts; it needs no account or generation calls.
