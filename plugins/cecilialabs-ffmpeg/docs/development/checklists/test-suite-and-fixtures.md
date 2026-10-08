# Test Suite & Media Fixtures — Checklist

**Target:** `v0.9.5`  
**Status:** Implemented; local validation required before merge

## Test layers

- [x] Unit tests.
- [x] Integration tests.
- [x] CLI tests.
- [x] FFmpeg integration tests.
- [x] Fixture-based regression tests.
- [x] Static verifier confirms all five layers remain present.

## Fixture matrix

- [x] MP4 H.264 + AAC.
- [x] MP4 H.265/HEVC + AAC.
- [x] WebM VP9 + Opus.
- [x] GIF.
- [x] Static WebP for decode/conversion regression.
- [x] Animated WebP for animation-container regression.
- [x] PNG.
- [x] JPEG.
- [x] MP3.
- [x] AAC.
- [x] WAV PCM.
- [x] G.711 μ-law.
- [x] Multiple CFR frame rates.
- [x] VFR timestamps.
- [x] Missing audio.
- [x] Missing video.
- [x] Different video timebases.
- [x] Different resolutions.
- [x] Different pixel formats.
- [x] Silence-pattern audio regression fixture.

## Fixture behavior

- [x] Media binaries are generated reproducibly instead of committed.
- [x] Generated fixture directory is Git-ignored.
- [x] Manifest defines expected media properties.
- [x] FFprobe verifies codec/stream/dimension/timing/audio properties.
- [x] VFR is verified from actual frame timestamp deltas.
- [x] GIF requires multiple decoded frames; animated WebP requires `ANIM` plus multiple `ANMF` chunks to accommodate FFprobe 7.1 limitations.
- [x] Missing required encoders fail explicitly.

## Tooling

- [x] `fixtures:generate`.
- [x] `fixtures:clean`.
- [x] `verify:fixtures`.
- [x] `verify:test-suite`.
- [x] Both verifiers added to `npm run validate`.
- [x] Package/plugin/project version advanced to `0.9.5`.
- [x] README, roadmap, changelog, fixture docs, and M12 docs updated.
- [x] GitHub Actions remain intentionally deferred until alpha completion.
- [ ] Run `npm run validate` in the configured Local Environment before merge.

## Acceptance criterion

Current domain integration tests cover the supported media operations, and fixture regressions verify actual media properties with FFprobe rather than only checking that files were created.
