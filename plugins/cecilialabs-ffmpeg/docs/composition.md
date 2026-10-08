# Composition

Composition combines multiple visual sources on one output timeline.

## Concat

```bash
cecilia-ffmpeg compose concat   intro.mp4 body.webm outro.mp4   --transition fade   --transition-duration 0.75   --fit contain   --background black   --to mp4
```

Without a transition, inputs are normalized and concatenated. With a transition, the toolkit uses FFmpeg xfade and, when appropriate, audio crossfade.

## Pair transition

```bash
cecilia-ffmpeg compose transition left.mp4 right.mp4   --transition zoomin   --duration 1   --to webm
```

Available transition names:

```text
fade
fadeblack
fadewhite
wipeleft
wiperight
slideup
slidedown
circleopen
circleclose
dissolve
pixelize
distance
zoomin
zoomout
```

`distance` is FFmpeg's native transition. `zoomout` is an explicit custom xfade expression rather than an alias for dissolve.

## Normalization before xfade

The toolkit normalizes incompatible source properties before transition:

```text
scale / fit
→ pad or crop
→ reset timestamps
→ FPS
→ pixel format
→ timebase
→ xfade
```

This prevents common failures where input timebases or frame rates differ.

## Slideshow: vertical stack

```bash
cecilia-ffmpeg compose slideshow ./images   --style vertical-stack   --direction up   --duration 12   --to mp4
```

The original migrated `stack_vertical.sh` behavior is preserved as the default slideshow style.

## Slideshow: sequence

```bash
cecilia-ffmpeg compose slideshow ./images   --style sequence   --transition zoomin   --transition-duration 0.8   --duration 15   --include "*.jpg"   --include "*.png"   --exclude "*-draft.*"   --fit contain   --to webm
```

Sequence outputs: MP4, WebM, GIF, animated WebP.

## Audio policy

Concat and pair-transition commands support:

```text
--audio auto
--audio preserve
--audio drop
```

Use an explicit policy when source audio layouts differ or an input has no audio.
