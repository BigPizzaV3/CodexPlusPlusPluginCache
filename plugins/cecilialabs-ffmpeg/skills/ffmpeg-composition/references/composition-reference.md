# Composition Reference

## Validated transition normalization

For `xfade`, use the toolkit's validated ordering:

```text
scale
→ pad
→ setpts=PTS-STARTPTS
→ fps
→ format=yuv420p
→ settb=AVTB
→ xfade
```

This ordering avoids known failures where the filter sees an invalid constant frame-rate state.

## Audio policy

- `auto`: preserve/crossfade when compatible inputs all contain audio; otherwise produce video-only with warning.
- `preserve`: require compatible audio.
- `drop`: intentionally omit audio.

## Native transitions

Prefer standard `xfade` transitions such as fade, dissolve, wipes, slides, circle open/close, pixelize, or distance.

Treat `gltransition` as an optional non-standard capability, never as a default dependency.
