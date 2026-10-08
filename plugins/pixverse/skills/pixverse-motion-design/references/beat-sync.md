# Music-Led Motion Timing

Use for music-led motion design. Fast is the default; an explicit slow or silent choice
takes precedence. Codex uses available host audio/media tools; this is not a new runtime
or a plugin video-understanding service.

## Lock The Actual Audio

Select the track and excerpt before committing visual rhythm. Keep the original file
immutable; record its path, excerpt in/out and placement on the master timeline. Use
ffprobe for streams/duration and FFmpeg for decoding. Neither metadata nor a music
generation prompt measures BPM. Example analysis decode, preserving playback speed:

```bash
ffmpeg -i input.mp4 -map 0:a:0 -vn -ac 1 -ar 22050 analysis.wav
```

For absent music, follow the audio workflow's preflight and supported model contract.
Request a clear pulse, then analyze the returned track. Preserve explicit music choices;
do not replace or accelerate supplied slow music to satisfy a fast visual default.
Faster subdivisions can work over a slower pulse. For a silent brief, label the plan
visual timing and make no measured-BPM claim.

## Measure Tempo, Phase And Accents

Use available beat/onset analysis, then check candidate markers against the waveform
and sound. Librosa is one optional host-side tool, not a plugin dependency:

```python
# Only in an environment where librosa is available.
import librosa
import numpy as np

y, sr = librosa.load("analysis.wav", sr=22050)
hop = 128
envelope = librosa.onset.onset_strength(y=y, sr=sr, hop_length=hop)
tempo, beat_frames = librosa.beat.beat_track(
    onset_envelope=envelope, sr=sr, hop_length=hop, trim=False
)
beat_times = librosa.frames_to_time(beat_frames, sr=sr, hop_length=hop)
onset_times = librosa.onset.onset_detect(
    onset_envelope=envelope, sr=sr, hop_length=hop, units="time"
)
bpm_candidate = float(np.asarray(tempo).reshape(-1)[0])
```

The [beat tracker](https://librosa.org/doc/0.11.0/generated/librosa.beat.beat_track.html)
estimates tempo and beat locations; [onset detection](https://librosa.org/doc/0.11.0/generated/librosa.onset.onset_detect.html)
locates attacks. Neither establishes bar-one downbeats, musical phrases or correct
editorial emphasis. Check half/double-tempo alternatives (for example 80/160 BPM),
leading silence, offbeat snares and subdivisions. A strong attack may be off the main
beat. Short clips, sustained music and speech can be ambiguous.

Without an analysis library, inspect a decoded waveform and mark repeated attacks
manually, or use another available local signal-analysis method. State the method and
uncertainty; package installation is not a mandatory step. If ambiguity remains, label
the grid provisional and use verified attacks directly. Ask only if a missing track
or unresolved musical choice materially changes the result.

For steady music, estimate `period = 60 / BPM` and fit its phase to several attacks
across the excerpt. Validate near the beginning, middle and end. For changing tempo,
use measured timestamps/section maps rather than extending one BPM across the piece.
Keep measured onsets, inferred beats and selected accents distinct. Do not invent
beats for silence; no returned beat/onset is evidence of a reliable pulse by itself.

## Turn Music Into A Frame Timeline

For an audio excerpt starting at `source_in`, placed at `master_in`:

```text
master_anchor = source_anchor - source_in + master_in
landing_frame = round(master_anchor * fps)
landing_time = landing_frame / fps
```

Discard events outside the excerpt. Convert each absolute timestamp independently;
never repeatedly add a rounded frames-per-beat value. Fractional FPS and BPM usually
produce alternating frame counts between beats, preventing cumulative drift. Record
the rounding convention; use the same master timebase for audio and picture.

Save `beat-map.json`: source identity, source/master offsets, sample rate, FPS, analysis
method, BPM candidates/selected editing pulse, uncertainty, measured onsets, selected
anchors and their final frames. A track change requires a new map and dependent plan.

Save `edit-plan.csv` or JSON with one row per intentional visible event:

| Field | Purpose |
|---|---|
| Anchor / source time / master time / frame | Audible event owning the landing |
| Evidence | Measured attack, inferred beat, phrase cue or visual-only event |
| Source asset / in / out | What appears, preserving the original for revisions |
| Action and impact state | Cut, word swap, scale punch, wipe landing, shape change |
| Entrance / landing / readable hold / exit | Separate anticipation from arrival |
| Exact copy / palette / layer | Information and visual hierarchy |

Example: a verified 150 BPM pulse starting at master 0.2s has anchors at 0.2, 0.6,
1.0 and 1.4s: frames 12, 36, 60 and 84 at 60 FPS. A six-frame entrance landing at
frame 36 begins at frame 30. A cut on frame 36 shows its new picture at frame 36.
These are illustrative values; recalculate for the actual track.

## Fast Pacing With Phrases

Useful starting points for an energetic 8–12s opener are a visible accent each beat,
brief half-beat pickups around builds and two-beat holds for important copy. At
120–160 BPM, changes often fall around 0.19–0.5s apart, with deliberate longer holds.
This is a planning range, not a cut quota; very fast music can use a half-time edit.

- **Hook:** show a strong subject or short word immediately. Land an accent within
  the first beat; avoid a long dark lead or leisurely logo fade.
- **Development:** alternate related motion families—hard cut/word replacement,
  scale impact, directional wipe, shape or palette change. Pair direction and meaning:
  a push travels forward; a release opens space. Each word need not require a new asset.
- **Phrase turn:** change composition or motif on a selected musical accent. A pickup
  may anticipate it; the main impact still lands on its anchor.
- **Payoff:** resolve into the message, often with a readable two-to-four-beat hold.
  Retain subtle motion only when it supports the composition.

Use brief attacks and quick settles, with reading time between impacts. A slow fade
starting on a beat still feels late. Equal-duration slides, one endless background
zoom, constant shaking and repeated full-frame strobes are weak substitutes for
choreography. Palette changes can mark selected accents without flashing every subdivision.

Short kinetic type can change each beat; sentences need several beats. Preserve
contrast, hierarchy, required copy and logo geometry. Silent diagrams and measured
captions keep their own needs. For an explicit slow version, use longer two-to-eight-beat
phrases and gentler movement, retaining important reveals on verified sound anchors.

## Generate Only The Needed Ingredients

Specify source roles and usable motion: active openings, object/camera direction,
clear scale changes and any source-shot boundaries. Measured cues can inform the video
prompt; a model's requested BPM/cut schedule is not a frame-accurate edit. Keep exact
copy and primary beat landings in FFmpeg.

Reuse useful sources for multiple crops/cutaways where content allows; do not generate
a paid asset per beat. Keep handles around impacts. Preserve natural subject motion
and audio pitch; global speed-up is not the default cure for a dull edit. First move
the edit, choose another source range or add an appropriate graphic impact locally.

For Seedance audio reference, verify the current mode's requirements including visual
inputs. Do not upload audio alone to an unsupported route or invent an audio switch.
At export map the accepted music master once and omit unwanted generated audio.

## Focused Acceptance Check

These checks apply to this music-led deliverable, not every generation workflow:

1. Compare **rendered** cut/impact frames with selected audible anchors near the
   beginning, middle and end, plus the hardest transition. A useful local-edit target
   is within one output frame after rounding. Report checked event count and actual
   error; planned timestamps alone do not verify the render.
2. Check normal-speed playback with sound: visible response, clear hook, phrase turn
   and payoff. An automated score cannot establish that it feels good. If listening
   is unavailable, disclose that and report only waveform/frame evidence checked.
3. Inspect the densest text at delivery scale, logo geometry, cut boundaries, first
   and last frames, decoded duration/FPS/size, and final audio joins. Check for drift,
   clipped copy, unexpected silence and duplicated music.

Fix editorial timing locally from original assets. Necessary new paid sources require
fresh preflight under the effective confirmation policy. Keep the audio map, edit plan,
source list, prompts and render command in the project for later revisions.
