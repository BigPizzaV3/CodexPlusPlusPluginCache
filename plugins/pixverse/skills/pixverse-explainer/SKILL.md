---
name: pixverse-explainer
description: "Explainer video: turn a topic, article or script into a complete narrated film, including editorial documentary motion graphics, animated explanations, history, kids and picture stories, in any consistent non-photoreal look."
---

# Explainer Videos

A faceless narrated film is a fast, concrete story told twice at once: the narrator
says it and the picture acts it out, phrase by phrase, in one locked look. Run the
phases below in order. Each phase names the one file that holds its templates; open it
when the phase says so and fill the templates in rather than inventing new structure.

## Golden Rules

1. **Story, not essay.** People, objects, dates and numbers doing things. "A silk
   merchant ordered a portrait of his wife. Leonardo never delivered it." beats
   "Fame can grow from an absence." Abstract nouns belong in neither voice nor picture.
2. **Every spoken phrase gets a visible verb.** While the narrator says it, something
   on screen does it: a figure walks off with the panel, glaze sheets stack, a hand
   lifts the painting out of its frame, a crowd grows row by row.
3. **A shot is a process, never a pose.** Motion starts on frame one and the picture
   reaches a new state about every second. Elements enter staggered, land with weight,
   and the next thing is already arriving. Nothing sits still for a full second.
4. **Fill the frame.** The hero subject occupies a third to two thirds of frame
   height. Small props lost in empty paper read as a slide deck.
5. **Use actors.** Figures in the film's look perform the story with their bodies,
   mouths closed; the narrator does the talking. A giant hand, a stamp, a crowd are
   actors too. Diagrams appear when the story reaches a quantity or comparison.
6. **One look, pasted not paraphrased.** Take the selected style's FORMULA from its
   recipe file and paste it byte-identical into every image and video prompt. Style
   words live only there; shot lines are pure choreography.
7. **Compose from the roster.** Every block references its stage, cast and props
   images. Never animate from the style key alone.
8. **Prompts say what happens.** Write positive, visible instructions. Keep exclusions
   to the single NEGATIVE line of the block template. No commentary, no reasons, no
   "this shows that…" inside a prompt.
9. **Narration is brisk and fills the film.** Natural TTS speed (0.95–1.05, never a
   slowed read), each block's line filling 8.2–9.6s of its 10s window.
10. **Words on screen come from the edit.** Generated video carries no letters or
    digits; captions and exact labels are burned in afterwards.

## Pipeline

**Phase 0 — Resolve the brief.** Topic, language, duration, aspect (16:9 default),
channel, look, captions, music, cover. Use what the user gave; pick sensible defaults
for the rest, state them in one line and continue. `./references/channels-and-formats.md`
maps channels; Kids, talking cast, song, stills and 10-minute history load
`./references/branches.md`. Model route: `./references/model-route.md`.

**Phase 1 — Script.** Open `./references/script.md`. Research, pick the through-line,
write the block lines, run its rewrite pass. Gate: every line passes the phrase→verb
test and the word budget.

**Phase 2 — Look.** `./references/style-grammar.md` indexes the recipes; open the one
selected recipe and copy its FORMULA, MOTION token and PALETTE LOCK, locking the accent
colour. Generate one style key. Gate: the key shows the look on a real subject.

**Phase 3 — Roster.** Follow the roster section of `./references/production.md`:
cast, stage plates, props, each generated with the style key attached and the FORMULA
pasted. Gate: every noun the script puts on screen has an image.

**Phase 4 — Narration.** Follow `./references/production.md`: generate one take per
block with the locked voice, measure it, and read off the phrase clock. Gate: every
take fills its window.

**Phase 5 — Block prompts and generation.** Open `./references/block-prompt.md`. Fill
its template once per 10s block with shot boundaries from the phrase clock, run its
checklist, submit all blocks in one queue.

**Phase 6 — Assemble.** Follow `./references/production.md`: check the blocks for the
named defects, assemble, mix, burn captions. Deliver one film plus caption/timing files
and sources.

Prompt-only requests deliver the script with its phrase→verb tables, roster prompts,
block prompts on an even shot grid and estimated caption cues in one document, with no
generation and without the Execution section below. A narrow request for one still or one clip uses the
simpler direct route.

## Execution

Read `../../skills-shared/production-brief.md` for reference roles and revisions.
For media execution follow `../../skills-shared/cli-workflow.md`; load the gateway before
manual CLI commands or queue specs. Resolve the plugin root from this skill's installed
path: set `PVX="<absolute-plugin-root>/scripts/pvx"` and invoke `"${PVX}"`. The block
template in this skill already is the finished Seedance prompt; pass it through prompt
enhancement unchanged.
