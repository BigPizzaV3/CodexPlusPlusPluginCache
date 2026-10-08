# Test Suite & Media Fixtures

The test suite provides explicit domain coverage and a reproducible media-fixture matrix for the stable v2 release line.

## Test layers

```text
unit
integration
CLI
FFmpeg integration
fixture-based regression
```

The repository contains unit, integration, CLI, and FFmpeg-backed tests. The suite formalizes those layers and adds fixture-property regression for current media operations.

## Reproducible fixtures

Binary media is generated locally rather than committed to Git.

```bash
npm run fixtures:generate
```

The generator materializes `test/fixtures/generated/` from deterministic FFmpeg recipes. The directory is Git-ignored.

The authoritative fixture contract is:

```text
test/fixtures/manifest.json
```

It specifies the expected codec, dimensions, pixel format, frame rate, timebase, sample rate, channel count, stream absence/presence, and special traits such as VFR.

## Fixture matrix

Coverage includes:

```text
MP4 H.264 + AAC
MP4 H.265/HEVC + AAC
WebM VP9 + Opus
GIF
static WebP
animated WebP
PNG
JPEG
MP3
AAC
WAV PCM
G.711 μ-law
24 fps CFR
30 fps CFR
VFR
missing audio
missing video
1/1000 timebase
1/90000 timebase
160×90 resolution
320×180 resolution
yuv420p
yuv444p
speech-like audio with silence intervals
```

## FFprobe is the oracle

`npm run verify:fixtures` regenerates the fixture set with `--force`, probes every output with FFprobe, and compares actual stream properties with the manifest.

For VFR, verification additionally reads frame timestamps and requires at least two distinct positive timestamp deltas. GIF requires multiple decoded frames. Animated WebP is validated through its RIFF `ANIM`/`ANMF` chunks because FFprobe 7.1 may identify the WebP codec while reporting zero decoded frame geometry for animated files.

The WebP → PNG conversion path intentionally uses the **static WebP** fixture. FFmpeg/FFprobe 7.1.x can identify an animated WebP container while its native decoder fails to expose a decodable first frame. Animated WebP remains covered independently as a container/animation regression so this compatibility limitation is not hidden.

File existence alone is never considered a successful regression result.

## Commands

```bash
npm run fixtures:generate
npm run verify:fixtures
npm run verify:test-suite
npm test
npm run fixtures:clean
```

The full release gate remains:

```bash
npm run validate
```

`validate` verifies the test topology and fixture matrix before TypeScript/lint/Vitest/build/package verification.

## Environment note

The fixture matrix intentionally uses CPU/reference encoders that make codec expectations deterministic. Missing required encoders fail with a capability-specific message rather than silently changing the fixture codec.
