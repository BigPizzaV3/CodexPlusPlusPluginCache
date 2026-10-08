---
name: ffmpeg-video-editing
description: Perform deterministic video trimming, speed changes, still-image video creation, resizing, restoration, and normalization with FFmpeg. Use for temporal edits and single-video transformations that do not primarily require multi-source composition.
---

# FFmpeg Video Editing

Use this skill for typed single-video editing operations.

## Activation scope

Use for:

- removing time from the start or end;
- extracting a temporal range;
- changing playback speed;
- creating video from a still image;
- resizing/upscaling/restoration;
- normalizing a video for downstream processing.

## Do not use

Do not use for multi-input transitions or slideshows; use `ffmpeg-composition`. Do not use for audio-first tasks; use `ffmpeg-audio`. Do not use repair commands when the primary problem is malformed timestamps or decoding errors; use `ffmpeg-diagnostics`.

## Required inputs

Identify:

- input file;
- desired temporal range or speed factor;
- output path when the default is unsuitable;
- whether audio must be preserved, retimed, or dropped;
- target resolution/profile and fit mode for upscale work.

## Preflight

1. Probe the input before operations where duration, audio presence, codec, or dimensions affect the plan.
2. Use `--dry-run` when the user wants to inspect the FFmpeg invocation first.
3. Preserve audio unless the requested operation or explicit policy says otherwise.

## Toolkit surface selection

Use the highest-level toolkit surface available to the host:

1. Use the associated `scripts/run.mjs` entry point for supported video actions.
2. For speed changes, still-image video creation, trim-start/trim-end convenience commands, or other supported video operations, use `cecilia-ffmpeg`.
3. If the global binary is unavailable, use:
   `npm exec --yes --package=@cecilialabs/ffmpeg -- cecilia-ffmpeg <command>`.
4. Use native FFmpeg only for unsupported transforms or an explicit native-command request.

## Associated scripts

Use `scripts/run.mjs` with `input.action` set to `trim-start`, `trim-end`,
`trim`, `speed`, `from-image`, `restore`, or `upscale`. Common fields include
`input`, `output`, `overwrite`, and the operation-specific fields for the
selected action. The script calls the typed video domain directly and returns
the shared result envelope.

```bash
printf '%s\n' '{"context":"codex","input":{"action":"trim-start","input":"clip.mp4","seconds":5,"output":"clip.trimmed.mp4"}}' \
  | node skills/ffmpeg-video-editing/scripts/run.mjs
```

## Preferred toolkit commands

```bash
cecilia-ffmpeg video trim-start <input> --seconds <n>
cecilia-ffmpeg video trim-end <input> --seconds <n>
cecilia-ffmpeg video trim <input> --start <n> --end <n>
cecilia-ffmpeg video speed <input> --factor <n>
cecilia-ffmpeg video from-image <image> --duration <n>
cecilia-ffmpeg video upscale <input> --resolution <WxH>
cecilia-ffmpeg video attach-audio <video> <audio>
cecilia-ffmpeg video add-silence <video>
```

Prefer the toolkit over constructing arbitrary shell commands for supported operations.

For supported operations, prefer the toolkit surface selected above over constructing arbitrary FFmpeg shell commands.

## Native FFmpeg fallback

Use native FFmpeg only for unsupported transforms or when explicitly requested. Preserve the toolkit's design principles: argument arrays, explicit mapping, explicit overwrite behavior, and probe-driven decisions.

## Output expectations

A successful file-producing operation should have:

- a deterministic destination;
- explicit overwrite policy;
- a non-empty finalized file;
- FFprobe validation after transformation;
- structured warnings for copy-mode/keyframe limitations.

## Validation

Probe the result and verify the properties relevant to the request: duration, dimensions, FPS, codec, pixel format, and audio presence.

## Error recovery

- If copy trim is inaccurate, switch to accurate re-encode mode.
- If speed change causes audio issues, use the toolkit's audio tempo policy rather than changing video PTS alone.
- If upscale output is incompatible with the target workflow, normalize to explicit dimensions/FPS/pixel format/fit. `video restore` remains a compatibility alias.
- If decoding/timestamp errors appear, hand off to `ffmpeg-diagnostics`.

## Safety and determinism

Never silently overwrite an existing file. Never replace an input file in place. Prefer transactional output and explicit `--overwrite`.

## References

Read `references/video-editing-reference.md` for mode selection and validation guidance.
