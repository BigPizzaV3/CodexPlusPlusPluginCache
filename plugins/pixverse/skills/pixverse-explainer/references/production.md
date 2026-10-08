# Production

Mechanics for an animated narrated film built from 10s blocks. Picture Story, Kids
talking cast, song mode and long history change parts of this; see `./branches.md`.
Script comes from `./script.md`, block prompts from `./block-prompt.md`, the look from
the selected recipe, models from `./model-route.md`.

## Style key

One image, output aspect, Sunburst 2K/high. Prompt:

```
A clean STYLE SAMPLE in this exact look: {FORMULA} Subject: {one simple recognizable subject from this film, with one of the recipe's signature devices}. Balanced, attractive, the subject fills about half the frame height. No palette strip, no colour chips, no labels, no text, no watermark, no reference-sheet layout.
```

Attach the user's style donor when one exists ("take only the rendering style, palette
and surface of the input image, none of its subjects or lettering"). The key is a look
anchor for the roster, not a frame of the film. Glance at it once: if it missed the
medium or palette, fix the prompt and regenerate before building on it.

## Roster

Every image: Sunburst 2K/high, the style key attached as an image reference, FORMULA
pasted byte-identical. Generate the whole roster in one queue after the key.

- **Cast (2:3).** `Full-body character centered on a plain flat background with no disc,
  marker strokes or tape, in THIS EXACT style: {FORMULA} Character: {era, build, hair, clothes, one signature item,
  pose that shows their job}. No text, no watermark.` Distinct silhouettes. Real people
  are described by era, age and costume, never by name. The protagonist may carry the
  look's colour pop. Later-era variants attach the first version ("the same person, now
  older…").
- **Stage plates (output aspect).** `{Stage description} in THIS EXACT style:
  {FORMULA} Scene: {a few large furnishings, ONE named anchor object with its
  position}. No people. No text, no watermark.` Flat looks get flat stages (a paper
  field with an easel and a disc); dimensional looks get dressed sets. Plan enough
  stages that none carries more than two consecutive blocks — a 2-minute film wants
  4–6 — and give long-running stages a second arrangement.
- **Props (1:1 or the object's shape).** `A single isolated prop centered on a plain
  flat background with no disc, marker strokes or tape, in THIS EXACT style: {FORMULA} Object: {desc}. No hands, no scene,
  no other objects.` The through-line object always gets one. For a real artwork,
  document or place, attach a public-domain or user-supplied source image so the
  likeness is faithful; public-domain artworks and landmarks may be named in their own
  prop prompt.
- Stages hold furniture and the anchor; the through-line object lives only in its own
  prop image, so the two never disagree. A second arrangement of a stage attaches the
  first stage image.
- Save the unwrapped formula with its accent filled in as `style-formula.txt` and paste
  from that file everywhere.

Gate: every figure, place and object in the phrase→verb tables has a roster image (the
recipe's signature devices need none), and no block needs more than seven.

## Narration first, then blocks

Narration takes cost almost nothing and finish in seconds, so make them before the
block prompts and let the picture be cut to the voice.

- **Narration.** Use `../../pixverse-voiceover/SKILL.md` fixed-window mode: one locked
  voice, one take per block, speed 0.95–1.05 (never a slowed read), one delivery
  direction reused on every take. Target **8.2–9.6s of measured speech per 10s block**
  (this workflow's denser band replaces the voiceover recipe's default 7.8–9.5s and
  20–23 words), no internal pause of 0.8s or more. A short take means the line is
  thin: rewrite it denser and regenerate. An overlong take means trim words. Never
  time-stretch, never pad with filler. At most three attempts per line.
- **Phrase clock.** Run silence detection on each accepted take
  (`silencedetect=noise=-35dB:d=0.25`) and note where each phrase of the phrase→verb
  table starts. Add the 0.25s block offset. These times become the shot boundaries in
  the block prompt, so each action lands while its phrase is heard. Keep every shot
  between 1.8s and 4s; merge or split phrases to stay inside that.
- **Blocks.** One `create reference` request per block: 10s, the output aspect, the
  block's images in stage → cast → props order, the filled block template as prompt.
  When references are local files, pass JPEG copies about 1280–2048px on the long side
  (well under 1 MB each): several multi-megabyte PNG uploads can outlast the submission
  timeout. A submission that timed out without a task id is checked against
  `pixverse asset list` before it is resubmitted.
  Submit all blocks in one queue run. A proportional shorter request covers a
  non-multiple-of-10 ending.

## Check what came back

Look at each block once, with these named defects only:

- fewer shots than asked, or any stretch of about a second where nothing changes
  (scene detection at 0.3, or 0.15 for flat looks, plus your eyes);
- opening freeze or opening on a reference image;
- wrong medium or palette against the roster; a roster figure redesigned;
- generated lettering; speech or music in the clip's own audio;
- the line's decisive action missing.

A block with a named defect is regenerated once with that shot's beats spelled out
more concretely — more verbs, not more prohibitions. If the retry still falls short,
keep the better one and say so. Two generation failures at N shots may drop that block
to N−1. A completed block with no named defect is final.

## Assemble

- Probe the clips' fps and assemble at it. Each block keeps its full 10s; place the
  measured speech to start about 0.25s into its block. The film length is the requested
  length, never shortened to fit audio.
- Mix: narration at full level, the clips' own foley under it at about −18 dB, optional
  music bed lower still and ducked under speech, overall about −16 LUFS.
- Captions follow `../../pixverse-captions/SKILL.md`, timed from the final audio with
  the authored wording (digits may replace spelled-out numbers): at most 5 words or 32
  Latin characters per cue, 12–14 characters for Chinese, Japanese or Korean, one line,
  low in frame, in a plate that suits the look (a small paper label for paper looks).
- Exact on-screen labels such as a date or a name are edit layers made with
  `../../pixverse-motion-design/SKILL.md`; use them sparingly, in space the shot leaves
  open.
- Deliver one master, a clean no-caption version when asked, caption and timing files,
  and the sources list. Cover art only when it was part of the brief.

Final check: full decode, requested duration and resolution, every block and take
present in order, speech complete, captions legible, look and cast consistent.
