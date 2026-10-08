# Milestone 7 — Composition & Filter Graph Engine

Milestone 7 introduces a reusable composition layer instead of embedding ad-hoc `-filter_complex` strings in individual scripts.

## Public commands

```bash
cecilia-ffmpeg compose concat <inputs...>
cecilia-ffmpeg compose transition <left> <right>
cecilia-ffmpeg compose slideshow <directory>
```

## Filter graph architecture

`FilterGraphBuilder` owns graph-chain assembly. Video normalization is centralized in `normalization.ts` and resolves a common width, height, FPS, pixel format, timebase, and zero-based timeline before `xfade`.

For FFmpeg 7.x compatibility, `setpts=PTS-STARTPTS` is intentionally applied **before** the `fps` filter. Applying `setpts` after `fps` can clear the negotiated constant frame-rate metadata and cause `xfade` to fail with `current rate of 1/0 is invalid`.

The normalized sequence is therefore:

```text
scale
→ pad
→ setpts=PTS-STARTPTS
→ fps
→ format=yuv420p
→ settb=AVTB
→ xfade/concat
```

This still satisfies the core invariant: all inputs reach `xfade` with matching geometry, constant frame rate, pixel format, timebase, and zero-based timestamps.

## Concat

`compose concat` accepts two or more inputs. Without a transition it uses FFmpeg's `concat` filter after normalization. With `--transition`, it builds an N-input `xfade` chain with cumulative offsets.

```bash
cecilia-ffmpeg compose concat a.mp4 b.mp4 c.mp4 \
  --transition fade \
  --transition-duration 1 \
  --fps 30 \
  --output final.mp4
```

Audio policy:

- `auto` preserves audio only when every input has audio;
- `preserve` requires audio on every input;
- `drop` produces video-only output.

Transitioned audio uses sequential `acrossfade`; non-transition concatenation uses the audio `concat` filter.

## Transition

`compose transition` composes exactly two videos via `xfade` and, when audio is preserved, `acrossfade`.

```bash
cecilia-ffmpeg compose transition left.mp4 right.mp4 \
  --transition dissolve \
  --duration 0.75 \
  --output result.mp4
```

Supported initial transitions are `fade`, `fadeblack`, `fadewhite`, `wipeleft`, `wiperight`, `slideup`, `slidedown`, `circleopen`, `circleclose`, `dissolve`, `pixelize`, and `distance`.

## Vertical-stack slideshow

The legacy Taner Sener script is migrated as a typed vertical-stack slideshow implementation. Image discovery is deterministic and supports JPEG, PNG, WebP, and BMP.

```bash
cecilia-ffmpeg compose slideshow ./images \
  --width 1280 \
  --height 720 \
  --duration 10 \
  --direction up \
  --output slideshow.mp4
```

The implementation no longer uses shell string concatenation or `eval`.
