# Pipeline v1 Reference

## Document

```yaml
version: 1
input: source.mp4

presets:
  social:
    - resize:
        width: 1080
        height: 1080
    - convert:
        to: mp4

steps:
  - trim:
      start: 2
  - preset: social

output:
  path: final.mp4
  codec: h264
```

`version` defaults to `1`.

## Steps

### trim

```yaml
- trim:
    start: 4
    duration: 8
    mode: auto
```

Use either `end` or `duration`, not both. A lone positive `start` means remove that prefix.

### speed

```yaml
- speed:
    factor: 1.25
    audio: sync
```

`audio` is `sync` or `drop`.

### resize

```yaml
- resize:
    width: 1920
    height: 1080
    fit: contain
    background: black
    profile: balanced
    hardware: auto
```

Optional fields include `fps`, `crf`, encoder `preset`, `to`, `hardwareDevice`, and `hardwareStrict`.

### normalize

```yaml
- normalize:
    width: 1920
    height: 1080
    fps: 30
    pixelFormat: yuv420p
    sampleRate: 48000
    channels: 2
```

### audio.normalize

Roadmap-compatible shorthand:

```yaml
- audio:
    normalize: true
    sampleRate: 48000
    channels: 2
```

This delegates to the existing normalization domain and therefore normalizes the primary media streams as one deterministic operation.

### convert

```yaml
- convert:
    to: webm
    width: 1280
    height: 720
    hardware: auto
```

Supported target vocabulary matches `convert file`: MP4, WebM, GIF, WebP, PNG, JPEG, WAV, MP3, AAC, M4A, FLAC, Opus, and Ogg.

### preset

```yaml
- preset: social
```

Presets may nest. Unknown references and cycles are rejected.

## Output

```yaml
output:
  path: final.webm
  codec: vp9
```

`codec` is optional and acts as a consistency assertion. `h264` maps to H.264-compatible output containers; `vp9` requires WebM.

## Execution surfaces

CLI:

```bash
cecilia-ffmpeg pipeline pipeline.yaml run
```

Package API:

```ts
import { loadPipelineFile, executePipeline } from "@cecilialabs/ffmpeg";
```
