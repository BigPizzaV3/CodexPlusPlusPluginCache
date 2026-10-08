# Scriptwriter

The failure mode of a faceless script is a list: fact, fact, fact. The second failure is
an essay: claims about ideas with nothing to look at. Write a story whose every phrase
can be acted out by things on screen.

## 1. Research targets (factual topics)

Search before writing; do not script from memory. You are done when you hold:

- the **hook fact** — the most surprising concrete thing about the topic;
- **3–5 concretes** — named people, dates, places, quantities, comparisons;
- the **turn** — the fact that changes what the viewer assumed;
- **physical specifics** the picture can stage (what was it made of, who carried it,
  where did it hang, how many, how long).

Cross-check every spoken number against a second source. Keep the source URLs for
delivery. Myths and fiction skip research and say they are myths.

## 2. Through-line

Name ONE physical thing that is on screen in every block (not necessarily every shot)
and changes state each time:
a painting that is ordered → carried off → stolen → returned; a stack that grows until
it blocks a door; a map filling with pins; a fuse burning down. It gets its own prop
image in the roster so it never morphs. The last block resolves it.

## 3. Arc

- **Hook — cold open.** First sentence ≤8 words, the raw surprising fact, stated flat.
  No greeting, no "in this video", no windup. A sharp question is legal; hold its answer
  for the payoff.
- **Build — escalating evidence.** One idea per block, each anchored to a concrete.
  Reorder test: if two build blocks can swap without loss, you listed; make each one
  bigger, stranger or more specific than the last.
- **Turn.** Usually the second-to-last block. It must change what the viewer believed
  two blocks ago; a summary is not a turn.
- **Payoff.** Land the answer, then a kicker that echoes the hook's image or number
  with new meaning. The through-line resolves here.

**Short films.** Two or three blocks (20–30s) run hook → turn → payoff, with the build
folded into the hook block; build blocks and the reorder test start at four blocks.

Tone by channel: Explainer — casual second person, deadpan, dry wit. History — witty
storyteller, understatement. Kids — warm host, question first. Myth — hushed, unhurried.

## 4. Line craft

- One narration line per 10s block, sized to fill it: **25–28 English words** on the
  default voice engine (measured about 2.9 words per second at speed 0.95–1.05; Kids
  uses the shorter budget in `./branches.md`), at most three short sentences or two flowing ones, comma-light. Other
  languages and engines: size to about 9 seconds of natural speech and let the first
  measured take correct the budget. Mandarin starts at **38–43 Han characters** per
  block, with a cold-open sentence of at most 12 characters. Spell out numbers the way they are said.
- Sentences are subject–verb–object with a physical verb: ordered, carried, stacked,
  lifted, walked out, printed, queued. Replace "became a symbol of" with what someone
  actually did.
- No phrase of five or more words repeats between blocks.

## 5. Phrase → verb table (do this for every block before any prompt)

Split the line into 3–5 phrases in spoken order. Beside each phrase write the one
visible action that happens while it is heard, using only roster nouns:

| Spoken phrase | Visible action |
| --- | --- |
| A silk merchant ordered a portrait of his wife | the wife figure slides onto the stool; an arrow draws from her to the blank panel |
| Leonardo took the job in fifteen-oh-three | the painter's brush sweeps; the sketch fills in to the finished portrait |
| and never delivered it | he lifts the panel off the easel and walks out of frame; the easel stands empty |

Rules for the right-hand column: it names things and physical verbs only; it changes
the picture's state; consecutive actions are different kinds of motion (enter, build,
remove, multiply, connect, strike). A phrase with no stageable action is a phrase to
rewrite. Dates and numbers are staged as things (pages torn off, rows of figures, bars,
✓ and ✗) while the voice and captions carry the digits. Keep a block's phrases roughly
equal in spoken length so an even shot grid still lands near the words. This table becomes the block's shots in `./block-prompt.md`.

## 6. Rewrite pass

1. Does the first sentence work with zero context, in ≤8 words?
2. Is every number and name traceable to the research?
3. One idea per block?
4. Do the build blocks fail the reorder test?
5. Does the turn surprise?
6. Does the kicker echo the hook and resolve the through-line?
7. Is every line inside its word budget and free of abstract-noun subjects?
8. Does every phrase have a visible action, and does the through-line appear in every
   block's table?

## 7. Manifest

Save `script_manifest.json`: topic, channel, language, duration, aspect, look, accent,
style formula, through-line {name, asset, states, resolution}, sources, and ordered
blocks {n, arc_role, vo_line, stage, assets_used, through_line_state, phrase_table}.
`vo_line` holds only the spoken words. A prompt-only delivery folds the manifest's
contents into the deliverable instead of saving a file. For films of 60s or more, show the full block
script as a progress note and keep going.
