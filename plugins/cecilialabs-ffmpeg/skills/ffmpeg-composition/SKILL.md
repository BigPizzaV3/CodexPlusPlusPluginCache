---
name: ffmpeg-composition
description: Compose multiple media inputs with concatenation, xfade transitions, audio crossfades, normalization, and image slideshows. Use when two or more visual sources must become one timeline.
---

# FFmpeg Composition

Use this skill for multi-source video/image timeline construction.

## Activation scope

Use for:

- concatenating multiple clips;
- adding transitions between clips;
- composing two clips with a specific transition;
- image slideshows in vertical-stack or sequence style;
- sequence slideshows with transitions/include/exclude selection;
- `zoomin` and explicit custom `zoomout` transitions;
- workflows requiring normalization before `xfade`.

## Do not use

Do not use for single-file edits or repair. Do not choose non-standard filters such as `gltransition` unless environment capabilities confirm them and the toolkit path is insufficient.

## Required inputs

Identify:

- ordered inputs;
- transition type and duration;
- target dimensions/FPS;
- audio policy;
- slideshow duration/style/direction, transition, include/exclude patterns, and output format where relevant.

## Preflight

Probe every media input. Before transitions, normalize properties that FFmpeg requires to agree: scale/pad geometry, PTS, FPS, pixel format, and time base.

## Toolkit surface selection

Use the highest-level toolkit surface available to the host:

1. Use the associated `scripts/run.mjs` entry point for supported composition actions.
2. For explicit transition commands, slideshows, or other composition capabilities, use `cecilia-ffmpeg`.
3. If the global binary is unavailable, use:
   `npm exec --yes --package=@cecilialabs/ffmpeg -- cecilia-ffmpeg <command>`.
4. Use native FFmpeg only for unsupported composition graphs or an explicit native-command request.

## Associated scripts

Use `scripts/run.mjs` with `input.action` `concat`, `transition`, or
`slideshow`. Provide ordered `inputs` for concatenation, `left`/`right` for a
transition, or `directory` for a slideshow. The script preserves the typed
normalization and audio policy before execution.

```bash
printf '%s\n' '{"context":"codex","input":{"action":"concat","inputs":["one.mp4","two.mp4"],"transition":"fade","output":"joined.mp4"}}' \
  | node skills/ffmpeg-composition/scripts/run.mjs
```

## Preferred toolkit commands

```bash
cecilia-ffmpeg compose concat <inputs...>
cecilia-ffmpeg compose concat <inputs...> --transition fade
cecilia-ffmpeg compose transition <left> <right>
cecilia-ffmpeg compose slideshow <directory>
cecilia-ffmpeg compose slideshow <directory> --style sequence --transition zoomin
```

For supported operations, prefer the toolkit surface selected above over constructing arbitrary FFmpeg shell commands.

## Native FFmpeg fallback

Use native FFmpeg only for unsupported composition graphs or user-requested native syntax. Retain the same normalization discipline before `xfade`.

## Output expectations

Return a single deterministic output with explicit warnings when audio cannot be preserved automatically.

## Validation

Probe the final file and verify:

- expected total duration;
- target dimensions/FPS/pixel format;
- audio presence;
- transition completion without filter reinitialization/timebase errors.

## Error recovery

- For timebase/FPS mismatch, normalize before transition instead of retrying the same graph.
- For missing audio on one input, use an explicit audio policy rather than constructing an invalid `acrossfade`.
- For unsupported transition filters, select a native `xfade` transition or inspect capabilities.

## Safety and determinism

Preserve input order. Do not use `eval` or shell-expanded filter graphs. Keep normalization explicit and repeatable.

## References

Read `references/composition-reference.md` for normalization order and transition guidance.
