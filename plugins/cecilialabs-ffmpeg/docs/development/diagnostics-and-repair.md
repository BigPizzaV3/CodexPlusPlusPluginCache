# Milestone 8 — Diagnostics & Repair

Milestone 8 turns FFprobe metadata and FFmpeg runtime messages into a typed diagnosis layer, then uses those observations to drive explicit repair workflows.

## Architecture

```text
media input
   │
   ├── FFprobe structural inspection
   │      ├── streams
   │      ├── codecs
   │      ├── frame rates
   │      ├── time bases
   │      ├── SAR / pixel format
   │      └── start timestamps
   │
   ├── FFmpeg read-only decode scan
   │      ├── corrupt packets
   │      ├── decode failures
   │      ├── PTS/DTS errors
   │      └── timestamp discontinuities
   │
   ├── optional supplied FFmpeg stderr log
   │      ├── stream mapping failures
   │      └── filter graph failures
   │
   └── optional deep freeze scan
          └── freezedetect intervals
```

Repairs run only after this read-only inspection.

## Diagnose

```bash
cecilia-ffmpeg diagnose ./broken.mp4
```

Deep freeze detection:

```bash
cecilia-ffmpeg diagnose ./broken.mp4 \
  --deep \
  --freeze-noise-db -50 \
  --freeze-duration 2
```

Merge an existing FFmpeg stderr log:

```bash
cecilia-ffmpeg diagnose ./broken.mp4 \
  --log ./ffmpeg-error.log \
  --json
```

The report distinguishes `info`, `warning`, and `error` findings rather than presenting every unusual media property as corruption.

## Timestamp repair

Re-encode for the strongest repair semantics:

```bash
cecilia-ffmpeg repair timestamps ./broken.mp4 \
  --mode reencode \
  --fps 30 \
  --output ./fixed.mp4
```

Container-level remux only:

```bash
cecilia-ffmpeg repair timestamps ./broken.mp4 \
  --mode remux \
  --output ./remuxed.mkv
```

`remux` is intentionally documented as limited: it may regenerate container timestamps but cannot repair invalid decoded frame timing.

## Normalize

```bash
cecilia-ffmpeg repair normalize ./source.mp4 \
  --width 1920 \
  --height 1080 \
  --fps 30 \
  --pixel-format yuv420p \
  --sample-rate 48000 \
  --channels 2 \
  --output ./normalized.mp4
```

The video normalization chain is intentionally explicit:

```text
scale
→ pad
→ setsar=1
→ fps
→ format
→ settb=AVTB
→ setpts=PTS-STARTPTS
→ CFR output timing
```

Audio normalization uses asynchronous resampling with `first_pts=0` and, where representable, an explicit mono/stereo layout.

## Safety model

- diagnosis is read-only;
- repair never writes over the input;
- output is staged to a sibling temporary file;
- overwrite requires `--overwrite`;
- successful output is FFprobed again;
- successful output is diagnosed again;
- auxiliary streams are never silently claimed to have been preserved when normalization drops them.
