---
name: ffmpeg-conversion
description: Convert individual media files or directory batches using typed FFmpeg profiles, deterministic output planning, filtering, concurrency, and structured reports. Use when the primary goal is format/container/image-animation conversion.
---

# FFmpeg Conversion

Use this skill for supported single-file and batch format conversions.

## Activation scope

Use for:

- video conversion between MP4/WebM and supported animation targets;
- image conversion among GIF, WebP, PNG, and JPEG/JPG;
- audio conversion among WAV, MP3, AAC, M4A, FLAC, Opus, and Ogg;
- extracting an audio-only target from media that contains video;
- directory batch conversions with selection and output policies.

## Do not use

Do not use conversion as a substitute for composition, repair, or editing when format change is incidental. Use the corresponding domain skill first.

## Required inputs

Identify:

- source file or directory;
- source format for batch selection;
- target format;
- output directory/path;
- recursion, include/exclude patterns, concurrency, and existing-output policy when batching.

## Preflight

Probe source media when encoding decisions depend on audio/video presence. In batches, discover the selection before conversion and surface empty selections or output collisions explicitly.

## Toolkit surface selection

Use the highest-level toolkit surface available to the host:

1. Use the associated `scripts/run.mjs` entry point for supported conversion actions.
2. For directory batch conversion, use the global `cecilia-ffmpeg` binary.
3. If the global binary is unavailable, use:
   `npm exec --yes --package=@cecilialabs/ffmpeg -- cecilia-ffmpeg <command>`.
4. Use native FFmpeg only for unsupported format pairs or an explicit native-command request.

For MP4/H.264 and WebM/VP9 targets, the CLI and associated script also accept the current hardware policy introduced in v1.2: `software`, `auto`, `nvenc`, `qsv`, `vaapi`, or `videotoolbox` where codec/backend support exists.

## Associated scripts

Use `scripts/run.mjs` with `input.action` `file` or `batch`. File requests
require `input` and `to`; batch requests require `directory`, `from`, and
`to`. Include selection, concurrency, and existing-output policy in the JSON
request instead of reproducing traversal in a shell loop.

```bash
printf '%s\n' '{"context":"codex","input":{"action":"file","input":"clip.mp4","to":"webm","output":"clip.webm"}}' \
  | node skills/ffmpeg-conversion/scripts/run.mjs
```

## Preferred toolkit commands

```bash
cecilia-ffmpeg convert file <input> --to <format>
cecilia-ffmpeg convert batch <directory> --from <format> --to <format>
```

Prefer toolkit profiles over ad-hoc per-file shell loops.

For supported operations, prefer the toolkit surface selected above over constructing arbitrary FFmpeg shell commands.

## Native FFmpeg fallback

Use native FFmpeg only for unsupported format pairs or explicitly requested native syntax. Do not duplicate batch traversal logic in shell; keep selection/output planning deterministic.

## Output expectations

Batch reports should distinguish discovered, attempted, succeeded, failed, and skipped items. File output should be probed after conversion.

## Validation

Verify target codec/container/image/audio format, stream presence, dimensions/FPS or sample-rate/channel properties where relevant, and all requested batch items.

## Error recovery

- On partial batch failure, preserve successful outputs and report failed items.
- Resolve output collisions before execution.
- Use `existing=skip|replace|error` intentionally.
- If a target encoder is missing, inspect environment capabilities rather than silently switching formats.

## Safety and determinism

No implicit overwrite. No shared temporary wildcard files. Preserve directory hierarchy unless flattening was explicitly requested.

## References

Read `references/conversion-reference.md` for supported profiles and batch planning.
