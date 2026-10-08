# Milestone 4 Checklist — Video Editing Operations

**Target:** `v0.2.0`  
**Status:** ✅ Complete

## Commands

- [x] `video trim-start <input>`
- [x] `video trim-end <input>`
- [x] `video trim <input>`
- [x] `video speed <input>`
- [x] `video from-image <input>`
- [x] `video restore <input>`

## Trim

- [x] `auto`, `copy`, and `accurate` modes.
- [x] `auto` resolves to deterministic accurate trimming in v0.2.0.
- [x] Stream-copy mode emits a keyframe-accuracy warning.
- [x] Start, end, and range validation use normalized FFprobe metadata.
- [x] `trim-end` derives retained duration from FFprobe rather than guessing timestamps.
- [x] Range trimming supports `--start` plus exactly one of `--end` / `--duration`.

## Video speed

- [x] Positive playback factors.
- [x] `setpts` video timing.
- [x] Synchronized audio by default.
- [x] Safe chained `atempo` stages for factors outside 0.5–2.0.
- [x] Explicit `--audio drop` mode.

## Still image → video

- [x] Configurable duration.
- [x] Configurable resolution.
- [x] Configurable FPS.
- [x] Aspect-ratio-preserving scale + pad.
- [x] Configurable pixel format.

## Restore / resize

- [x] Explicit `WIDTHxHEIGHT` semantics.
- [x] `balanced` profile.
- [x] `aggressive` profile based on the useful portions of the legacy restoration scripts.
- [x] Explicit CRF/preset overrides.
- [x] Optional output FPS.
- [x] Audio preserved when present.
- [x] Legacy misleading HD/FHD names are not reproduced.

## Output safety

- [x] No shell interpolation.
- [x] Paths containing spaces supported through argument-array execution.
- [x] Input/output path collision rejected.
- [x] Existing output rejected unless `--overwrite` is supplied.
- [x] FFmpeg writes to a unique sibling temporary file.
- [x] Final output is renamed only after successful FFmpeg execution and non-empty-file validation.
- [x] Failed temporary output is cleaned up unless `--keep-temp` is explicitly requested.
- [x] Final outputs are re-probed with FFprobe.

## Encoding

- [x] MP4/M4V/MOV/MKV H.264 + AAC profile.
- [x] WebM VP9 + Opus profile.
- [x] Unsupported video output extensions fail explicitly.

## Migration coverage

- [x] `crop-x-seconds-from-start.sh` → `video trim-start`.
- [x] `increase-video-speed.sh` → `video speed`.
- [x] `create-clip-from-image.sh` → `video from-image`.
- [x] `upscale-video-to-hd.sh` → `video restore`.
- [x] `upscale-video-to-fhd.sh` → `video restore`.

## Tests & validation

- [x] Unit tests for `atempo`, restore filters, and deterministic output naming.
- [x] CLI option tests added.
- [x] Integration tests cover all six video operations.
- [x] Real FFmpeg/FFprobe smoke validation performed during assembly.
- [x] Real outputs verified with normalized FFprobe metadata.
- [x] Production source strict-TypeScript compilation verified with dependency interface shims in the assembly environment.

## Acceptance criterion

> Every operation supports paths containing spaces and does not depend on Bash syntax.

**Result:** satisfied.
