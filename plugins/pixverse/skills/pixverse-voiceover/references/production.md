# Narration Modes And Measured Delivery

Ordinary TTS is a direct take; do not impose the specialized retries below on every read.
Native UGC/host speech stays in its video workflow. Select the matching mode before audio
generation. Use real returned voice IDs and actual model capabilities, not source-platform
voice pairs, removed scripts, markup or rate flags copied into another engine.

## Fixed Video Windows

One numbered line maps to one fixed window. Lock voice ID, model, language and a single
delivery direction in the project record; reread that record for every submission.
Mood changes wording/performance, not voice identity. Preserve ordering and accepted takes.

This recipe targets 7.8–9.5s of speech in a 10s block, initially around 20–23 English
words (17–21 for animated children's delivery), no more than two sentences and little
punctuation. These are starting targets, not a claim that PixVerse TTS shares ElevenLabs'
calibration. Measure on the actual engine; localize unspaced languages by spoken duration.
If the engine supports timed delivery markup, express immediate onset and the window;
otherwise keep direction out of spoken text and use only verified controls.

Measure the voiced interval, internal silence and delivery rate, not total file duration.
For this 10s recipe, internal gaps ≥0.8s and speech faster than roughly 2.9 English words/s
require inspection/correction. Exclude real provider padding; inspect and repair an actual
tail click without blindly trimming a phoneme. Preserve the requested silence when it is
part of a performance instead of misclassifying it as failure.

Too long: shorten an editable clause; too short: add real information; pause-heavy: use
one flowing phrase. Never pad with filler, time-stretch, pitch-shift or cut speech to pass.
Locked copy cannot be rewritten without user authorization; use the agreed window/content
tradeoff. Limit to three attempts per failed line; a third duration attempt needs changed
copy. After a retry the 7.2–7.8s soft band can be disclosed; outside 7.2–9.5s remains a
failure for this recipe, scaled for shorter final windows. Do not promote the nearest
failed take. Accepted indices are immutable; regenerate only failing indices.

## Continuous Story Read

Keep a whole script or a few large paragraph-aligned chunks in one locked voice and
verbatim delivery direction. Read actual prompt-length limits; chunk below them without
splitting sentences. Source limits such as 2048 characters are not universal CLI values.
Join accepted chunks in order, losslessly only when formats match. Check seams, timbre,
garbling and unintended internal pauses; no per-line fixed-window gate in this mode.

The requested duration is a script-length target, not a reason to vary TTS speed. Generate
naturally, measure, and if editable copy misses the accepted range, estimate a revised
word budget as old_words × target_time / measured_time. One initial read plus at most two
changed-text duration corrections. Do not resubmit identical wording to chase duration;
same-text retries are for real provider/voice defects. After the limit, report the closest
clean read and exact miss rather than claiming a pass. Visuals follow its actual clock.

## Existing Video + Photo → On-Screen Narrator

This distinct mode preserves the base video's picture and full duration, with a moving
photo-derived narrator composited over it. A static portrait or audio-only file does not
satisfy the request. Preserve supplied script sentence order; otherwise transcribe the
base audio. Resolve real supported portrait animation, timing-preserving revoice if an
exact selected timbre is required, and clean compositor/matte capability before spending.
Reference conditioning is not equivalent to voice-change. If a required service is absent,
report that specific gap and prepare an explicit alternative; never fake its completion.

Source planning uses ceil(base_duration/10) blocks, one 10s talking take per block and
31–35 English words/full block, proportionally fewer in a partial last window. Confirm
that the selected engine can articulate that pace. A final partial block is trimmed only
after its words fit the real window; do not pad/loop base footage. A locked script that
cannot fit requires a content/range decision, not omitted sentences or a rushed take.

Create one identity-preserving portrait on uniform chroma green with clean hair edges,
no spill or beautification. Each take starts already speaking, fixed camera, small head/
shoulder gestures, exact new words once, no text or background changes. Use supported
voice conversion only when needed to meet the selected-voice contract; unrelated TTS
under moving lips is not a repair. Composite the moving presenter in a safe corner without
covering evidence. If cutout edges fail, use an honest designed badge instead of claiming
a clean cutout. Preserve base audio components that can be retained; explain a necessary
replacement when original speech/music are inseparable. Do not silently discard the mix.

Verify every block, opaque presenter, clean edges, complete script and final duration
within 0.1s of the base. Preserve all successful blocks. Deliver the actual narrated video
with voice, coverage, position/style and audio-treatment record. Captions are opt-in.
