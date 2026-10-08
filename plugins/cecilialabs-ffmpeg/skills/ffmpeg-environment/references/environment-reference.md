# Environment Reference

## Toolkit commands

| Need | Command |
|---|---|
| Overall readiness | `cecilia-ffmpeg doctor` |
| Versions | `cecilia-ffmpeg environment version --json` |
| Codecs/encoders/filters/hardware | `cecilia-ffmpeg environment capabilities --json` |
| File metadata | `cecilia-ffmpeg probe <input> --json` |

Global overrides:

```bash
--ffmpeg-path /custom/bin/ffmpeg
--ffprobe-path /custom/bin/ffprobe
--verbose
--json
```

## Interpretation rules

- Encoder availability means the FFmpeg build exposes that encoder; it does not guarantee hardware or driver availability.
- NVENC/VAAPI/QSV/VideoToolbox compile support must not be described as a successful device test.
- FFprobe stream metadata is authoritative for codec, dimensions, sample rate, channel count, frame-rate strings, and time base.
- Extension/container names are hints, not proof of stream codec compatibility.

## Troubleshooting sequence

```text
doctor
  ↓
versions
  ↓
capabilities
  ↓
probe target media
  ↓
run the domain operation
```

When reporting a failure, preserve the toolkit error code and the smallest useful stderr tail.
