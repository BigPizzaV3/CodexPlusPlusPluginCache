# FFmpeg Timeline Craft

Use generated or supplied image/video layers with an FFmpeg filter graph. Keep source
media, exact text, timing and the reproducible render command in the project. For a
selected visual direction read `../../../skills-shared/motion-styles.md` and express
that look through generated assets and the supported local filters.

For music-led work, first read `./beat-sync.md`. Use its accepted audio excerpt and
absolute landing frames as the timing source; fast pacing is the workflow default.
Do not replace a measured event plan with evenly spaced fades.

## Time And Ownership

Record source in/out, master placement and each overlay's start/end. Use one stated
frame rate; a layer is active on [start,end). Frame n occurs at n/fps. Entrance,
readable hold and exit need separate intervals, with the last required state visible
before the end of the rendered range. Trim and reset timestamps before concatenation.

Only one expression owns a layer's position, scale or opacity at a time. Combine its
entrance and exit into that expression or sequential filter stages. Keep picture and
audio ownership separate; map accepted audio once and protect speech at every join.
For a progress value, clamp (t-start)/(end-start) to 0..1 and derive coupled positions
from it. Preserve exact endpoints, nonnegative scale and opacity in 0..1.

## Concrete Local Operations

Inspect `ffmpeg -filters` and targeted filter help before composing an unfamiliar
operation. Use supported `trim`, `setpts`, `scale`, `crop`, `pad`, `overlay`, `fade`,
`drawtext`, `drawbox`, `subtitles`, `concat` or `xfade` filters as appropriate.
Normalize size, pixel format, frame rate and timebase before transitions. Keep
transition overlap in the total-duration calculation. A retained source file remains
immutable; build revisions from that file rather than repeatedly encoding a preview.

Normalize the actual color matrix/range and its encoding tags as well. Generated video
and local color/graphic sources can differ; concatenation with copied streams may
reinterpret a later segment using the first stream's tags. Convert to one intended
color space (for example BT.709) before tagging/encoding; changing tags alone is not
a color conversion. Check a saturated graphic and a source-footage frame after joining.

Use `drawtext` with an actual font file and exact literal content for titles/labels;
use text files when quoting could change characters. Measured captions follow the
captions skill. Keep type large enough to read, retain chosen line breaks and test
required glyphs. A supplied logo image stays geometrically unchanged: contain-fit,
translate or reveal it through supported alpha/mask operations.

Image/video layers can pan, scale, fade or move at planned times. Complex motion
inside a character, environment or object belongs in the generated footage prompt.
Independent parts require actual separate assets; one flat poster does not contain
movable layers. A screen pan shows only the supplied screenshot's existing content.

## Example: Fast Six-Second Opener

Illustrative only: a verified 150 BPM track with its first beat at zero. Recalculate
times for the actual audio; preserve required copy and allow its reading time.

| Time | Layer | Action |
|---|---|---|
| 0–0.8 | Hero image and short hook | Active opening; word/scale impact at 0.4s |
| 0.8–2.4 | Detail crops and exact type | Primary changes on 0.4s beats; brief readable settles |
| 2.4–4.0 | Alternate composition | Phrase change, directional wipe and selective half-beat pickup |
| 4.0–4.8 | Hero return | Two-beat payoff leading into the identity |
| 4.8–6.0 | Supplied logo and closing copy | Land together, unchanged logo geometry, readable three-beat hold |

A lower third, comparison, word emphasis or end card uses the same explicit media,
text and timing records. Diagram labels and values stay factual; a highlight must
land on its intended element. Prefer a small number of meaningful motions.

## Render And Revise

Render a short difficult range first when the composition warrants it. Inspect
encoded start/end frames, transition boundaries, text bounds, layer order, actual
size/fps and audio joins. Deliver the video and, when requested, the FFmpeg command,
filter graph, source list and timing data needed to reproduce the edit.

Revise text, color or timing locally. Do not regenerate an accepted background for
a title change. Generate new media only when its visual content must change.
