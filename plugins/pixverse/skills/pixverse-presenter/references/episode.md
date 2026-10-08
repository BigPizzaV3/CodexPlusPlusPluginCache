# Complete Presenter Episode

Use this for a finished hosted episode. A standalone avatar clip stays a direct video
request. Preserve supplied copy, accepted identity and the user's explicit format. Default
episode format is 16:9, conventional physical cameras, one cover and a measured final edit.
Use `../../pixverse-video-script/SKILL.md` only for new copy; supporting graphics and assembly
use the motion-design and video-editing skills. No special source-platform runtime is needed.

## Resolve The Real Dependencies

Before spending on a full episode, establish a usable native speech route, reference roles,
local editing/rendering, visual inspection and word-timestamp transcription/listening.
Check actual tool/library support rather than inventing helper executables. A missing
required timing or render capability must be resolved before generating a whole episode.
If music is requested, resolve a real supplied or supported generated instrumental track;
speech generation cannot synthesize a music bed. An optional absent bed need not block voice.

Resolve topic/script, language, duration, host and visual direction together. Style can be
Auto (including delegated/no-questions work), a named style from
`../../../skills-shared/motion-styles.md`, or the user's own direction. Preserve an existing
choice; ask only for an unresolved material selection. Auto still means authored motion.

## Identity And Casting

Use an accepted image keyframe or complete video avatar. A video avatar remains a video
reference; an extracted still is for inspection, not a replacement for its motion/voice.
Use its usable audio as the sole voice identity without a competing written timbre/accent.
A silent avatar needs a separately resolved voice direction. References condition output;
they do not train a persistent identity model or guarantee exact voice reproduction.

A readable user photo can bootstrap identity: lock the person from the photo, resolve
whether to keep or replace the room, and make one frontal speaking clip with the actual
opening words. If the room changes, create an empty room reference instead of hoping prose
will replace it. The accepted bootstrap is host-001, not a disposable test to regenerate.
Subsequent shots use the accepted complete avatar. Preserve clothing unless changed by the
brief. Do not redescribe a supplied face from imagination.

When casting from scratch, choose topic-appropriate age, appearance and clothing without a
generic default persona. Separate garment color from seat and wall; keep background scale
readable, a neutral closed-mouth still and an uncluttered working surface where necessary.
Offer actual candidates only when casting is unresolved; delegated choice can select and
record one. Keep identity, room, wardrobe and optional handled-object references distinct.
An object reference follows the host; only stage handling when the camera crop includes hands.

## Script Duration And Physical Cameras

Keep one canonical full spoken draft and original locked copy. New prose starts around
150 English words/minute, adjusted to language and brief. For each job, count its actual
spoken words once, expanding numbers/abbreviations for timing only:

`duration = max(4, ceil(60 * spoken_words / chosen_WPM + intentional_silence + 0.4))`

Intentional silence normally equals zero. Ordinary rhythm is included in the chosen pace;
do not add a buffer per camera cut. Unspaced languages require a spoken-duration estimate,
not whitespace counting. Respect the current model's actual duration range/step; the source
planning envelope is 4–30s. Split overflow at semantic boundaries instead of clamping it.
Do not allocate 15s to every short sentence or use slow delivery to fill excess duration.

Maintain a physical camera map:

| Camera | View | Default size/crop |
| --- | --- | --- |
| A | Frontal single at eye level | Medium, waist-up |
| B | Specified anatomical left/right cheek three-quarter, nearer cheek/shoulder named | Medium-close, chest-up |
| C | Specified near-profile accent at eye level | Close, head-and-shoulders |

Name subject position, actual viewpoint, vertical angle, size, crop and movement in every
shot. For seated speech, keep knees/lap/lower legs out. Adjacent shots change both horizontal
viewpoint and at least one size step. A body turn, digital crop, punch-in or zoom is not a
physical camera change. Standard cameras are locked from the first frame; creative mode
allows a specifically motivated move. Do not invent unseen distinctive set objects.

Choose up to three setups inside a job at meaningful transitions: claim→proof, question→
answer, contrast, next item, payoff. No mechanical A/B/C cycle, fixed cut interval or quota.
A multi-beat block stays one shot only for an explicit or concrete performance reason.
At a job seam, compare outgoing and incoming cameras; A→B | B→A repeats B and needs repair
before submission. Explicit single-camera direction and a one-shot bootstrap take precedence.

## Full Provider Prompt Structure

Every job is self-contained; planning IDs stay outside the prompt. Use this order:

1. Reference declaration: image owns character+location; bootstrap photo owns character
   only; complete video owns character/location/performance and voice only when audible.
2. Continuity: image fixes appearance, not a held pose; gestures/posture continue naturally.
   State exact shot/cut count. Each hard cut changes physical view immediately; no orbit
   between locked setups. Keep the host's chair/place/facing direction consistent.
3. `VOICE & MANNER`: without voice media, select one coherent physical delivery direction.
   Bright/speed-led speech compresses connective words with clear stresses; weight-led
   speech uses controlled falling pitch and a clean landing. Name the actual anchor words.
   A reveal can have one earned intake/drop; do not add dramatic pauses to every sentence.
   With an audio-bearing reference, preserve that voice and speak only the new dialogue.
4. `REALISM LAYER`: repeat the same recording character: breaths following meaning, quiet
   mouth/fabric/contact sounds, natural blinks, room floor/early reflections, clear words.
5. `DIALOG`: one numbered SHOT label per setup, with physical viewpoint, SIZE, CROP,
   COMPOSITION, MOVEMENT and PERFORMANCE, followed by its exact quoted spoken segment.
   Concatenated segments reconstruct the whole assigned copy exactly once and in order.
   Give gestures an onset, emphasis and release on verbatim phrases; use face/shoulder
   motion in close crops, hands only where visible. Fixed camera does not freeze the host.
6. Phrase-anchored immediate cut cues and a pacing note: maintain conversational delivery,
   finish the last word, settle briefly with room tone; no prolonged hold, slowed speech
   or repeated words. Keep numeric WPM and timing calculations out of provider prose.
7. Technical exclusions: no baked captions, graphics, screens, lower thirds or unrelated
   music. Graphical space planning belongs in the edit, not literal generation instructions.

Use the actual gateway's reference syntax, model spelling and supported native-audio
fields; keep creative camera labels separate from executable PixVerse parameters.
Apply Seedance enhancement while preserving this structure, exact copy and semantic cuts.

## Supporting Pictures And Meaningful Motion

For each host job consider its strongest concrete still/video candidate before choosing
graphics. Record candidate content, information gained (appearance/action/space/process/
atmosphere/evidence), verbatim anchor and use/reject reason. A deliberately weak stock
candidate does not justify turning the episode into text cards. Ranking real subjects
requires showing those subjects when appearance is the information. No asset quota.

Use authentic supplied/sourced material when authenticity is evidence; use generated
illustrations for conceptual/atmospheric beats. Record source URLs and keep factual proof
distinct from illustration. Never make up real UI, documents or results. Every generated
asset has a selected use; no paid orphan alternatives. Keep actual product-control plates
separate from supporting-picture assets.

For each treatment define information states, spoken anchors, entry/hold/exit, camera
geometry and picture/audio ownership:

- ON-CAMERA: host performance is primary, support annotates it.
- VISUAL: evidence or action becomes the visual subject while host narration continues.
- PLAYBACK: inserted media owns picture and audio, normally between complete host jobs.

Host remains meaningfully present under narration by default. Give evidence full-screen
space when detail/action or explicit direction warrants it; record why. Preserve selected
imagery through motion authoring. Related items develop a comparison/ranking/timeline
state instead of resetting the same reveal with new copy. A subtraction must remove an
object; a comparison must expose a difference. Do not let decoration obscure the host.

## Measure, Assemble, Inspect

Retain source IDs, selected takes, parameters, source bytes and word transcripts. Probe
actual media and compare audible words with the script. Correct ASR spelling/number errors
from audio without rewriting copy or regenerating valid footage. Trim only verified idle
head/tail, protecting first/final phonemes and intentional internal pauses. Never freeze
footage, cut speech or time-stretch to force a target.

For each retained source span: kept = out−in; master start is preceding kept durations
plus actual PLAYBACK inserts. A phrase maps to `master_start + source_time − source_in`.
Track occurrence numbers for repeated phrases. Inserts inside a source need two measured
spans; overlays under speech add no duration. Replacing a take invalidates its transcript,
trims, anchors and later placements; recompute affected entries only.

Build a reproducible 24fps FFmpeg edit from original sources and measured trims (explicit
user format wins). Save the source list, timing data and filter graph. Show the usable host-only cut, then continue adding graphics in the same
project; never use that flattened preview as the final source. Bind motion to real phrase
times and inspect safe geometry on actual footage. Include one cover unless declined;
its pending job does not block the episode. Mix a real bed once, duck it under speech and
honor playback ownership; do not pad picture to match music.

Inspect actual encoded frames, transitions and listening samples: complete words, camera
changes, continuous live host, readable states, no flashes/gaps/frozen layers, clear speech
at hook/dense passages/playback seams/ending, and clean music joins. Fix observed failures
in one pass and review affected ranges. A valid MP4 is not a creative review. Preserve
unchecked status when a modality is unavailable.

Deliver the master, available cover and editable project with its needed sources/fonts,
measured duration, selection/anchor records and real limitations. No fictional editor or
publish link. Existing-episode edits change only the selected segment and affected seams.
Prompt-only output includes the full script, camera map, complete per-job prompts, timing
estimates and planned support/edit stages, with ungenerated/unmeasured status explicit.
