# Milestone 5 Checklist — Audio Processing

**Target:** `v0.3.0`  
**Status:** ✅ Complete

## Commands

- [x] `audio attach <video> <audio>`
- [x] `audio silence`
- [x] `audio add-silence <video>`
- [x] `audio detect-silence <input>`
- [x] `audio remove-silence <input>`
- [x] `audio telephony <input>`

## Audio attach / replacement

- [x] Replace mode.
- [x] Append mode for an additional audio stream.
- [x] Attached audio padding enabled by default.
- [x] Explicit `--no-pad` behavior.
- [x] Video `auto`, `copy`, and `encode` handling.
- [x] Container-aware AAC / Opus audio codec choice.
- [x] Output duration bounded to the source-video duration when FFprobe reports it.

## Silence generation / silent tracks

- [x] Generate finite silence with configurable duration.
- [x] Configurable sample rate.
- [x] Configurable channel count.
- [x] Common channel-layout inference for mono, stereo, 5.1, and 7.1.
- [x] Explicit channel-layout override.
- [x] Add silence to video with video stream-copy when compatible.
- [x] Refuse to destroy existing video audio implicitly.
- [x] Explicit `--replace-existing` escape hatch.

## Silence analysis

- [x] FFmpeg `silencedetect` execution.
- [x] Typed `SilenceInterval { start, end, duration }` parser.
- [x] Configurable dB threshold.
- [x] Configurable minimum duration.
- [x] Total silence duration calculation.
- [x] Non-silent duration calculation when media duration is known.
- [x] Stable JSON-compatible structured result.

## Silence removal

- [x] FFmpeg `silenceremove` implementation.
- [x] Configurable threshold.
- [x] Configurable minimum duration.
- [x] Configurable amount of silence retained around cuts.
- [x] Audio output selected by file extension.
- [x] Audio-only safety boundary for Milestone 5.
- [x] Audiovisual timeline mutation rejected rather than silently desynchronizing video.

## Telephony

- [x] G.711 μ-law / PCMU modeled as `pcm_mulaw`.
- [x] G.711 A-law / PCMA modeled as `pcm_alaw`.
- [x] GSM modeled separately using `libgsm` + raw GSM container.
- [x] PCM modeled separately as `pcm_s16le`.
- [x] Explicit codec, container, sample-rate, channel-count and sample-format semantics.
- [x] Codec/container compatibility validation.
- [x] GSM constrained to 8000 Hz mono.
- [x] Raw μ-law, A-law, GSM, and signed-16-bit muxers supported.
- [x] Explicit output-extension/container conflict detection.

## Output safety

- [x] No `eval`.
- [x] No shell interpolation.
- [x] Paths containing spaces are supported.
- [x] Input/output collision protection.
- [x] Existing outputs require `--overwrite`.
- [x] Unique sibling temporary output.
- [x] Final output promotion only after successful FFmpeg execution.
- [x] Final outputs are re-probed with FFprobe.
- [x] Temporary cleanup honors `--keep-temp`.

## Migration coverage

- [x] `add-audio-2-clip.sh` → `audio attach`.
- [x] `add-silence-2-clip.sh` → `audio add-silence`.
- [x] `create-silence-audio.sh` → `audio silence`.
- [x] `remove-silence-noises.sh` → `audio detect-silence` + `audio remove-silence`.
- [x] `convert-audio-to-gsm-ulaw.sh` → `audio telephony` with explicit, non-conflated codec/container semantics.

## Tests & validation

- [x] Unit tests for silence parser, `silenceremove` builder, and telephony profile semantics.
- [x] CLI option tests.
- [x] Integration-test source for all Milestone 5 domains.
- [x] Real FFmpeg/FFprobe smoke validation performed during assembly.
- [x] G.711 μ-law output verified as `pcm_mulaw`, 8000 Hz, mono.
- [x] GSM output verified separately as codec `gsm`.
- [x] Real silence detection found the expected intervals.
- [x] Real silence removal reduced fixture duration.
- [x] Milestone 5 core source passed strict TypeScript compilation.
- [x] Full production source passed strict TypeScript build validation using dependency interface shims in the assembly environment.

## Acceptance criterion

> The implementation must not conflate GSM containers/codecs with G.711 μ-law.

**Result:** satisfied. G.711 μ-law resolves to `pcm_mulaw`; GSM resolves to `libgsm`/`gsm`, with independent container and validation rules.
