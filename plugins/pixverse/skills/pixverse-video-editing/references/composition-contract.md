# Reproducible FFmpeg Composition

Use this for layered local edits and assembly. Ordinary trims use the fast route in
`./local-editing.md`. Keep original media immutable, and store the FFmpeg command or
filter graph, source list, timing data and any supplied fonts alongside the output.
Inspect the existing edit before changing only the requested layers or ranges.

## Sources, Time And Audio

Map every source file to its source in/out and timeline placement. Derived phrase
start is master start + source phrase time - source in. A replacement take invalidates
its transcript, trim and later anchors; recompute affected timing only.

Picture and audio are separate streams. Explicitly map the intended audio once. Retain
accepted sound for picture-only repairs and protect first/final phonemes at trims.
Do not assume that overlaying a video automatically keeps or mixes its audio.

## Layers And Local Operations

Use FFmpeg's supported filters for crop/contain/pad, translation/scale, fades, image
and video overlays, masks, text, captions, cuts and transitions. Inspect the installed
filter help when required by an unfamiliar effect. Use actual font files/glyphs for
exact text and ASS/SRT for measured subtitles. Complex in-scene motion is generated
through the appropriate PixVerse workflow, then used as a normal video source.

Preserve full assets with contain when required; cover crops and stretch changes
geometry. Keep overlay bounds, origin, stacking order and active interval explicit.
One expression owns each animated property. Read
`../../pixverse-motion-design/references/timeline-craft.md` for frame timing and curves.
Use real supplied screenshots or prepared image layers for diagrams/comparisons;
keep factual values and exact labels in controlled text overlays.

A comparison must visibly expose its difference; a subtraction must remove the
intended element. Keep these visible actions aligned with measured spoken anchors.
A screenshot pan does not demonstrate a click or result absent from the supplied
recording. Avoid decoration that obscures a face, product, screen evidence or words.

## Export And Revision

Normalize dimensions, pixel format, frame rate and timebase for concatenation or
transitions. Include overlap in duration calculations. Inspect fonts and bounds after
rendering, not only in the filter expression. Use actual frame geometry for safe
placement; keep masks and backing plates free of unintended hard seams.

Probe the encoded result with ffprobe. Inspect changed ranges and endpoints for
clipping, gaps, black frames, source timing, text readability and audio tails. Verify
any requested transparency/codec property on the real file. Keep checks proportional
to the edit and the selected workflow's required review.

Deliver the encoded media and, when requested, the source list, timing and FFmpeg
render files needed to repeat the edit. Make text, color and timing revisions locally;
accepted generated media is reused rather than regenerated.
