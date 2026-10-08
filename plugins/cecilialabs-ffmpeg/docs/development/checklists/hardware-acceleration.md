# Advanced Hardware Acceleration — Completion Checklist

**Target:** `v1.2.0`  
**Status:** ✅ Implementation and validation complete; ready for merge

## Core policy

- [x] Preserve software encoding as the default.
- [x] Add `software|auto|nvenc|qsv|vaapi|videotoolbox` policy.
- [x] Add backend/codec compatibility mapping.
- [x] Add platform-aware automatic preference order.
- [x] Add actual FFmpeg runtime usability probe.
- [x] Cache successful/failed runtime probes per process.
- [x] Add deterministic software fallback warning.
- [x] Add strict hardware-required mode.
- [x] Keep all FFmpeg execution behind the existing core runtime.

## Backends

- [x] H.264 NVENC.
- [x] H.264 Quick Sync.
- [x] H.264 VAAPI.
- [x] H.264 VideoToolbox.
- [x] VP9 Quick Sync.
- [x] VP9 VAAPI.
- [x] NVDEC/CUVID capability discovery.
- [x] Encoder and decoder lists in environment hardware metadata.
- [x] Document that automatic decoder insertion is not enabled in v1.2.

## Surfaces

- [x] TypeScript hardware API.
- [x] `convert file`.
- [x] `convert batch`.
- [x] `video from-image`.
- [x] `video upscale` / `video restore`.
- [x] Human reports expose requested/resolved encoder and fallback state.
- [x] Structured reports include hardware selection details.

## Documentation & Skills

- [x] Replace the ambiguous multi-bin package-runner shorthand with an
  explicit CLI executable.
- [x] Make global `cecilia-ffmpeg` the canonical public example.
- [x] Document explicit `npm exec --package ... -- cecilia-ffmpeg` fallback.
- [x] Make all seven Skills script/CLI-aware.
- [x] Preserve global CLI and npm-exec fallbacks.
- [x] Document hardware policy in public CLI/video/conversion docs.

## Tests and release gates

- [x] Hardware selector unit tests.
- [x] FFmpeg-backed hardware planning integration tests.
- [x] Add `verify:hardware`.
- [x] Add hardware layers to test-suite verification.
- [x] Extend plugin metadata/schema.
- [x] Advance package/plugin/runtime/contract to `1.2.0`.
- [x] Run `npm run check`.
- [x] Run `npm run test`.
- [x] Run `npm run validate`.
- [x] Run `npm run validate:release`.
- [x] Exercise `--hardware auto` on available local hardware.


## Hardware smoke evidence

Validated on Linux with an NVIDIA GeForce RTX 4060 (8 GB), NVIDIA driver 595.91.07 and CUDA 13.2 visibility.

- FFmpeg reports `h264_nvenc`, `hevc_nvenc`, and `av1_nvenc`.
- The initial 64x64 synthetic NVENC probe exposed a real false-negative edge case because the encoder rejected dimensions below its supported minimum.
- The runtime probe was corrected to a 256x256 synthetic frame and regression-guarded.
- Direct `h264_nvenc` probe succeeds with exit code 0.
- Real `cecilia-ffmpeg convert file ... --hardware auto` resolves to `nvenc`.
- The actual conversion command uses `-c:v h264_nvenc -preset p4 -cq 23 -b:v 0`.
- Structured JSON reports `requested=auto`, `resolved=nvenc`, `runtimeVerified=true`, `fallback=false`, and a successful NVENC attempt.
- Hardware probe failures retain a short FFmpeg diagnostic for CLI and Skill-script consumers.
