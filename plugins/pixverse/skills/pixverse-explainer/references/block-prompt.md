# Block Prompt

One video request = one 10s block. Fill this template exactly; the finished text is the
prompt. Image and video prompts are English; only narration follows the film language.

## Shots per block

Turn the block's phrase→verb table (`./script.md` §5) into shots: normally one shot per
spoken phrase, **3–5 shots per block, each 1.8–4s**, with boundaries taken from the
measured phrase clock (`./production.md`). Without a measured take use an even grid:
4 shots of 2.5s by default, 3 for long processes, 5 for montage and data beats; Kids
uses 4. Whatever the count, every shot contains **two to four beats in sequence**, so
the picture changes about once a second. The template below shows the even 4-shot
grid; substitute the measured times. A shorter final block scales proportionally.

## Template

```
Style: {FORMULA}
Motion: {MOTION}; the look exactly matches the reference images.
PALETTE LOCK: {PALETTE LOCK line}.
One 10-second scene of {N} hard-cut shots. Stage every shot fresh from the references; never open on a reference image or show a sheet. Motion starts on frame 1. Figures act with their bodies, mouths closed.
REFERENCES: Image 1 = {STAGE} ({short desc}). Image 2 = {CAST A} ({desc}). Image 3 = {CAST B}. Image 4 = {PROP}.
SHOT 1 — 0.0s to 2.5s — {SIZE}, {one camera behavior}: {beat A}, then {beat B}, then {beat C}.
HARD CUT.
SHOT 2 — 2.5s to 5.0s — {DIFFERENT SIZE}, {camera}: {beats}.
HARD CUT.
SHOT 3 — 5.0s to 7.5s — {DIFFERENT SIZE}, {camera}: {beats, with the block's IMPACT beat}.
HARD CUT.
SHOT 4 — 7.5s to 10.0s — {DIFFERENT SIZE}, {camera}: {payoff beats}, easing into a settled frame that keeps breathing.
{N} shots, hard cuts at {times}, no dissolves, no fades. Continuous action inside every shot, a new change about every second.
AUDIO: {2–4 diegetic cues matched to named motions} over {room tone}. No voice, no narration, no music.
NEGATIVE: {the recipe's NEGATIVE line}.
```

Keep the whole prompt inside `../../../skills-shared/prompt-budgets.md` (5,000 characters;
3,000–3,500 is typical for four shots).
The FORMULA is pasted byte-identical from the film's `style-formula.txt` (the recipe's
formula unwrapped to one line with {ACCENT} filled in); if space is tight shorten beats,
never the formula.

## Action grammar

- **Beats are choreography.** Subject + physical verb + where it lands: "the panel
  drops onto the easel with a bounce", "glaze sheets stack one by one into a thick
  pile", "a giant hand pinches the painting and lifts it out of its frame". No style,
  colour or material adjectives in beats except the accent on the one popped element.
- **Stagger.** "A, then B, then C" is the most valuable phrase in a shot line. Nothing
  arrives at the same time as something else.
- **Land it.** snaps into place · stamps down · drops with a bounce · slides in and
  stops · tapes down · pops up · unrolls · fans out · flips over · stacks · multiplies
  into a row · gets circled · gets crossed out · is lifted away · walks off.
- **Accumulate.** Prefer processes that build visibly: a row filling figure by figure,
  a bar growing, a crowd rising row by row, a sketch filling in to a painting, a route
  drawing itself pin to pin. The end state differs plainly from the start state.
- **One camera behavior per shot**, named once: static · slow push-in · slow pull-back
  · gentle lateral drift · whip to the next element. Flat looks keep the camera frontal
  and change framing scale between shots (FULL STAGE / MEDIUM / CLOSE-UP / MACRO DETAIL);
  dimensional looks also change angle (low / high / lateral / top-down). Neighbouring
  shots never share a size. Over-the-shoulder only with a named figure in the shot.
- **Fill the frame.** State the hero's size when it matters: "the portrait fills the
  left half", "the stack rises to mid-frame". When smallness is the point, show it
  small in the wide shot and large in the close-up that follows.
- **One impact per block.** A slam, stamp, snap or collapse, named in its shot and
  echoed as one AUDIO cue. Aim for an accent roughly every three seconds.
- **Bind to the words.** Shot order follows phrase order, and each shot's window is the
  window where its phrase is spoken, from the measured phrase clock.
- **Settle, keep breathing.** The last shot eases into a clean final arrangement with
  small continuing motion, so the cut to the next block is clean.
- **No generated words.** Words like newspaper, poster, sign, book page or letter make
  the model invent lettering: write "printed sheets showing only the picture above rows
  of plain grey bars" instead. Text-like things are drawn as plain bars, blocks and marks;
  symbols such as arrows, ✓ ✗ ! $ are fine. The narrator and the caption layer carry
  the words. (Paper Diorama's single letterpress label is the one exception; its recipe
  gives the wording for that line.)

## References

Signature devices (the disc, marker strokes, the giant hand, stamps, extra crowd or
frame cutouts) are drawn from the FORMULA and need no image; a device may carry story
meaning (the disc as the sun). Order images stage → cast → props and describe each role
in the REFERENCES line. Use
only what this block shows, at most seven images; trim spare props before ever dropping
the stage or an on-screen figure. Retries keep the same images in the same order.

## Worked example (editorial look, accent mustard gold)

Line: "In sixteen thirty-seven one tulip bulb cost more than a house on the canal.
Buyers signed for bulbs still in the ground, then sold the paper that same afternoon."

```
Style: {FORMULA}
Motion: {MOTION}; the look exactly matches the reference images.
PALETTE LOCK: {PALETTE LOCK line}.
One 10-second scene of 4 hard-cut shots. Stage every shot fresh from the references; never open on a reference image or show a sheet. Motion starts on frame 1. Figures act with their bodies, mouths closed.
REFERENCES: Image 1 = MARKET STAGE (paper stage with a big balance scale and the disc). Image 2 = MERCHANT (cutout in a tall hat and ruff). Image 3 = TULIP BULB (the one gold-popped prop). Image 4 = CANAL HOUSE (tall gabled house cutout).
SHOT 1 — 0.0s to 2.5s — FULL STAGE, static: the scale drops in and bounces, then the tulip bulb lands on the left pan, then the pan sinks hard.
HARD CUT.
SHOT 2 — 2.5s to 5.0s — CLOSE-UP on the right pan, slow push-in: the canal house is lowered onto it by a giant hand, then the pan barely moves, then a marker circle draws around the heavier bulb side.
HARD CUT.
SHOT 3 — 5.0s to 7.5s — MEDIUM, static: three merchants pop up in a row, then a contract slip stamps down in the first one's hand, then the slip passes hand to hand along the row.
HARD CUT.
SHOT 4 — 7.5s to 10.0s — FULL STAGE, slow pull-back: the row of merchants multiplies across the stage, slips flicking between them faster and faster, while the bulb stays buried under a small soil mound at centre, easing into a settled frame that keeps breathing.
4 shots, hard cuts at 2.5s, 5.0s and 7.5s, no dissolves, no fades. Continuous action inside every shot, a new change about every second.
AUDIO: scale clank, paper stamp hit, quick paper flicks over quiet market air. No voice, no narration, no music.
NEGATIVE: {the recipe's NEGATIVE line}.
```

## Checklist before submitting a block

- FORMULA, MOTION and PALETTE LOCK pasted verbatim; accent named once and consistent.
- Every shot line has 2–4 staggered beats with landing verbs and one camera behavior.
- The shots stage this line's own nouns, in spoken order; the through-line is present.
- Neighbouring shots differ in size; the hero fills the frame; one impact beat.
- No style words, reasons, or "do not" sentences inside shot lines.
- AUDIO cues match named motions; NEGATIVE is the recipe's single line.
