# Milestone 13.5 — Media Capability Expansion & CLI Polish

Milestone 13.5 closes the remaining public-CLI gaps discovered during hands-on use before the documentation freeze.

## Canonical command taxonomy

The canonical video commands are now:

```text
video upscale <input>
video attach-audio <video> <audio>
video add-silence <video>
```

Compatibility aliases remain available during the pre-v1 transition:

```text
video restore <input>
audio attach <video> <audio>
audio add-silence <video>
```

The aliases execute the same typed domain implementations. They are retained so existing scripts are not broken immediately before v1.

## Image domain

A first-class `image` command group is now available.

Image-to-image conversion:

```bash
cecilia-ffmpeg image convert photo.jpg --to png
cecilia-ffmpeg image convert artwork.png --to webp --quality 85
```

Video-to-image extraction:

```bash
cecilia-ffmpeg image extract clip.mp4 --at 12.5 --to jpeg
```

Image output supports PNG, JPEG/JPG aliases, and WebP. `image convert` also supports GIF for animated image workflows.

## Unified fit semantics

Visual transforms share the same geometry vocabulary:

| Mode | Semantics |
|---|---|
| `contain` | preserve the entire source; pad the remainder |
| `cover` | fill the target completely; crop overflow |
| `stretch` | force the exact dimensions, allowing aspect-ratio distortion |

`--background` controls padding for `contain`.

The shared implementation is used by conversion, image extraction, video-from-image, video upscale, concat/transition normalization, and slideshow rendering.

## Expanded conversion formats

`convert file` and `convert batch` now share a broader media format model:

```text
video: mp4, webm
image: gif, webp, png, jpeg/jpg
audio: wav, mp3, aac, m4a, flac, opus, ogg
```

Examples:

```bash
cecilia-ffmpeg convert file input.webm --to mp4
cecilia-ffmpeg convert file photo.png --to jpeg
cecilia-ffmpeg convert file call.wav --to mp3 --audio-bitrate 128k
cecilia-ffmpeg convert file meeting.mp4 --to wav
cecilia-ffmpeg convert batch ./calls --from wav --to flac
```

Audio-only targets explicitly drop video with a structured warning. Visual targets require a visual stream.

## Video output format

Commands that produce video can select MP4 or WebM when the operation supports both:

```bash
cecilia-ffmpeg video from-image image.jpg --to webm
cecilia-ffmpeg video upscale source.mp4 --resolution 1920x1080 --to mp4
cecilia-ffmpeg compose concat a.webm b.webm --to mp4
```

## Transition catalog

The existing FFmpeg transition set remains available. Milestone 13.5 adds:

- `zoomin` — native FFmpeg xfade transition;
- `zoomout` — explicit custom xfade expression, not an alias for dissolve.

`distance` remains the FFmpeg-native `distance` transition. No attempt is made to rename or silently substitute it if its visual appearance resembles another transition for particular source material.

## Slideshow styles

`compose slideshow` now supports two styles.

### Vertical stack

This preserves the original migrated scrolling model:

```bash
cecilia-ffmpeg compose slideshow ./images   --style vertical-stack   --direction up
```

### Sequence

A conventional image sequence can use transitions:

```bash
cecilia-ffmpeg compose slideshow ./images   --style sequence   --transition zoomin   --transition-duration 0.8   --duration 15   --to mp4
```

Selection is deterministic and accepts repeatable include/exclude patterns:

```bash
--include "*.jpg" --include "*.png" --exclude "*-draft.*"
```

Supported slideshow outputs are MP4, WebM, GIF, and animated WebP.

## CLI color

Human TTY output uses a brighter but still restrained palette:

- command/operation headers: bright cyan;
- successful output/result: bright green;
- media details: bright magenta;
- warnings: bright yellow;
- errors: bright red;
- long FFmpeg command lines: dimmed.

`--no-color`, `NO_COLOR`, and `FORCE_COLOR` remain supported. JSON and ordinary non-TTY output remain ANSI-free.

## Extensibility after v1

The toolkit is intentionally designed to continue absorbing proven FFmpeg workflows after v1. New scripts can be treated as behavioral references and migrated through the same process:

```text
known-good script
  ↓
typed contract
  ↓
argument builder / filter graph
  ↓
CLI + package API
  ↓
fixtures and regression tests
  ↓
Skill/docs
```

The legacy shell script does not become a runtime dependency.

This is the intended path for future workflows such as telephony-call audio enhancement profiles.

## Validation

Run:

```bash
npm run verify:media-expansion
npm run validate
```
