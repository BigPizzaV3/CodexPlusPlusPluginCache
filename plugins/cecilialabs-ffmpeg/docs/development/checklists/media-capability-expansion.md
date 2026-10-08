# Milestone 13.5 — Media Capability Expansion & CLI Polish — Checklist

**Target:** `v0.9.8`  
**Status:** Implemented; local validation required before merge

## Conversion

- [x] JPEG/JPG source inference.
- [x] JPEG/JPG target output.
- [x] MP4 target output.
- [x] WAV target/source.
- [x] MP3 target/source.
- [x] AAC target/source.
- [x] M4A target/source.
- [x] FLAC target/source.
- [x] Opus target/source.
- [x] Ogg target/source.
- [x] Audio conversion works through both file and batch engines.
- [x] Audio-only targets explicitly drop video with a warning.
- [x] Expanded conversion JSON schemas.

## Image domain

- [x] `image convert <input>`.
- [x] `image extract <input>`.
- [x] PNG output.
- [x] JPEG/JPG output.
- [x] WebP output.
- [x] Timestamp selection for video frame extraction.
- [x] Image integration test.

## Fit semantics

- [x] Shared `contain`.
- [x] Shared `cover`.
- [x] Shared `stretch`.
- [x] Configurable padding background.
- [x] Conversion integration.
- [x] Image extraction integration.
- [x] Video from-image integration.
- [x] Video upscale integration.
- [x] Composition normalization integration.
- [x] Slideshow integration.

## Video taxonomy

- [x] Canonical `video upscale`.
- [x] Compatibility `video restore`.
- [x] Canonical `video attach-audio`.
- [x] Compatibility `audio attach`.
- [x] Canonical `video add-silence`.
- [x] Compatibility `audio add-silence`.
- [x] MP4/WebM output selection for applicable video operations.

## Composition

- [x] MP4/WebM output selection for concat and transition.
- [x] `zoomin` transition.
- [x] explicit custom `zoomout` transition.
- [x] Existing `distance` remains native FFmpeg behavior.
- [x] Slideshow `vertical-stack` style retained.
- [x] Slideshow `sequence` style added.
- [x] Sequence transitions.
- [x] Repeatable include/exclude patterns.
- [x] MP4/WebM/GIF/WebP slideshow output.
- [x] Slideshow fit/background controls.

## CLI polish

- [x] Brighter restrained human TTY colors.
- [x] `--no-color`.
- [x] `NO_COLOR`.
- [x] `FORCE_COLOR`.
- [x] JSON remains ANSI-free.
- [x] Non-TTY remains plain by default.

## Quality

- [x] Fit unit tests.
- [x] Expanded conversion tests.
- [x] Audio conversion integration tests.
- [x] Image extraction integration test.
- [x] Transition tests.
- [x] CLI capability tests.
- [x] Existing milestone verifiers updated for the expanded surface.
- [x] Added `verify:media-expansion`.
- [x] Package/plugin/project version advanced to `0.9.8`.
- [x] GitHub Actions remain deferred until alpha completion.
- [ ] Run `npm run validate` in the configured Local Environment before merge.

## Acceptance criterion

The public CLI surface required for v1 documentation is functionally complete enough that Milestone 14 can document it without immediately changing command taxonomy or core media-format capabilities.
