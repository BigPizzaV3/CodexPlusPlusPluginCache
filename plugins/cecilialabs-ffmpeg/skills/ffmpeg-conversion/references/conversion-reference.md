# Conversion Reference

## Initial profile matrix

| Input | Output | Notes |
|---|---|---|
| MP4 | WebM | VP9 + Opus when audio exists |
| MP4 | GIF | palette-based animation profile |
| MP4 | animated WebP | native FFmpeg WebP workflow |
| WebM | GIF | palette-based animation profile |
| WebP | PNG | still-image conversion |
| GIF | WebM | VP9 WebM |

## Batch controls

Prefer a generic batch plan with:

- recursive traversal when requested;
- source extension filtering;
- include/exclude patterns;
- bounded parallelism;
- fail-fast or continue-on-error;
- deterministic output directory;
- preserve hierarchy or explicit flatten;
- collision detection;
- existing output strategy;
- structured summary.

The legacy `convert-all-gif-in-folder-to-webm.sh` was semantically incorrect; the toolkit's GIF → WebM profile produces actual WebM.
