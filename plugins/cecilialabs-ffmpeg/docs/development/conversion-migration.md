# Milestone 6 — Legacy Conversion Migration

| Legacy utility | v0.4.0 replacement | Important correction |
|---|---|---|
| `convert-all-mp4-in-folder-to-webm.sh` | `convert batch DIR --from mp4 --to webm` | Generic batch engine; VP9/Opus profile |
| `convert-all-mp4-in-folder-to-gif.sh` | `convert batch DIR --from mp4 --to gif` | Palette generated inline; no temporary palette PNG |
| `convert-all-mp4-in-folder-to-animated-webp.sh` | `convert batch DIR --from mp4 --to webp` | No external `webpmux` or temporary WebP frame sequence |
| `convert-all-webm-in-folder-to-gif.sh` | `convert batch DIR --from webm --to gif` | Same typed GIF profile as MP4 → GIF |
| `convert-all-webp-in-folder-to-png.sh` | `convert batch DIR --from webp --to png` | Portable directory selection; first frame is explicit |
| `convert-all-gif-in-folder-to-webm.sh` | `convert batch DIR --from gif --to webm` | **Legacy script did not actually create WebM; v0.4.0 fixes the semantics** |

## Legacy defects intentionally not reproduced

### Misnamed GIF → WebM script

The legacy `convert-all-gif-in-folder-to-webm.sh` generated a palette and then wrote `new_<name>.gif`. It therefore performed GIF → GIF processing despite its filename.

Milestone 6 treats the filename/intended operation as authoritative and implements a real GIF → VP9 WebM conversion.

### Hard-coded directories

Several scripts contain machine-specific paths such as `/home/.../Gifs/temp`. The toolkit accepts a positional directory and optional output directory instead.

### External WebP muxing

The animated-WebP Bash utility generated a temporary frame sequence and invoked `webpmux`. Milestone 6 uses FFmpeg's WebP encoder/muxer directly, eliminating both the external dependency and temporary sequence cleanup.

### Repeated conversion loops

Every legacy script separately implemented:

```text
cd / hard-coded directory
for file in *.ext
basename manipulation
ffmpeg invocation
```

Milestone 6 centralizes traversal, patterns, error policy, concurrency, output planning, progress, summaries, and JSON into one batch engine.
