# Video Workflows

## Trim

Remove from the beginning:

```bash
cecilia-ffmpeg video trim-start input.mp4 --seconds 4
```

Remove from the end:

```bash
cecilia-ffmpeg video trim-end input.mp4 --seconds 3
```

Extract a range:

```bash
cecilia-ffmpeg video trim input.mp4 --start 10 --duration 20
```

Modes:

- `auto`: toolkit chooses the appropriate path;
- `copy`: fast stream-copy behavior with keyframe limitations;
- `accurate`: re-encode for precise cuts.

## Speed

```bash
cecilia-ffmpeg video speed input.mp4 --factor 1.5
```

`--audio sync` retimes audio; `--audio drop` removes it.

## Create video from an image

```bash
cecilia-ffmpeg video from-image poster.jpg   --duration 8   --resolution 1920x1080   --fit contain   --background black   --to mp4
```

## Upscale / resize

Canonical command:

```bash
cecilia-ffmpeg video upscale input.mp4   --resolution 1920x1080   --profile balanced   --fit contain   --to mp4
```

`video restore` remains a compatibility alias.

Profiles:

- `balanced`: resize/normalize with conservative processing;
- `aggressive`: deinterlace/deblock/denoise/resize/sharpen pipeline.

Fit modes:

- `contain`: preserve all source content, pad remainder;
- `cover`: fill output, crop overflow;
- `stretch`: force exact dimensions.

## Hardware-accelerated encoding

`video from-image` and `video upscale` / `video restore` support:

```text
--hardware software|auto|nvenc|qsv|vaapi|videotoolbox
--hardware-device <path>
--hardware-strict
```

Example:

```bash
cecilia-ffmpeg video upscale input.mp4 \
  --resolution 1920x1080 \
  --hardware auto
```

The default remains software encoding. When hardware is requested, the toolkit verifies encoder visibility and runtime usability before selecting it; otherwise it falls back to software unless `--hardware-strict` is set.

See [Hardware acceleration](hardware-acceleration.md) for backend/codec mappings and dry-run semantics.

## Audio on video

Attach/replace:

```bash
cecilia-ffmpeg video attach-audio video.mp4 soundtrack.wav --mode replace
```

Add a silent track:

```bash
cecilia-ffmpeg video add-silence video.mp4
```

Legacy `audio attach` and `audio add-silence` aliases remain available before v1.

## Validation

File-producing video operations probe the result. Check duration, dimensions, FPS, pixel format, codec, and intended audio presence.
