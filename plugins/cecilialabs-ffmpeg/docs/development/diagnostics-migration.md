# Milestone 8 — Legacy migration

## `fix-freezes-and-blocks.sh`

Legacy command:

```bash
ffmpeg -fflags +genpts -i source-code-reference.mp4 \
  -map 0:v:0 -map 0:a? \
  -vf "fps=30,setpts=N/(30*TB)" \
  -af "aresample=async=1:first_pts=0" \
  -c:v libx264 -crf 18 -preset medium \
  -c:a aac -b:a 192k \
  -movflags +faststart \
  source-code-reference.cfr30.mp4
```

The original script encoded valuable operational knowledge, but it applied the same repair recipe regardless of the actual media defect.

Milestone 8 separates the workflow into:

```text
diagnose
   ↓
observed timing / decode / stream findings
   ↓
repair timestamps OR repair normalize
   ↓
FFprobe + diagnosis validation of the output
```

Equivalent explicit repair:

```bash
cecilia-ffmpeg repair timestamps ./source-code-reference.mp4 \
  --mode reencode \
  --fps 30 \
  --output ./source-code-reference.cfr30.mp4
```

For a full interoperability normalization:

```bash
cecilia-ffmpeg repair normalize ./source-code-reference.mp4 \
  --fps 30 \
  --pixel-format yuv420p \
  --sample-rate 48000 \
  --output ./source-code-reference.normalized.mp4
```

The Bash file remains in `legacy/bash/` only as historical migration evidence.
