# Diagnostics & Repair

Diagnosis is observation-first. Repair is selected from actual media properties and FFmpeg evidence rather than blind re-encoding.

## Diagnose

```bash
cecilia-ffmpeg diagnose broken.mp4 --json
```

Optional deeper freeze detection:

```bash
cecilia-ffmpeg diagnose broken.mp4   --deep   --freeze-noise-db -50   --freeze-duration 2
```

Merge an existing FFmpeg stderr log:

```bash
cecilia-ffmpeg diagnose broken.mp4 --log ffmpeg-error.log
```

Diagnostic domains include:

- PTS/DTS and non-monotonic timestamps;
- CFR/VFR and FPS mismatches;
- timebase differences;
- SAR/DAR and pixel format;
- codec/container compatibility;
- missing streams;
- broken stream mapping;
- filter graph failures;
- corrupt packets/decoding evidence;
- frozen frames.

## Timestamp repair

```bash
cecilia-ffmpeg repair timestamps input.mp4 --mode reencode
```

Modes:

- `remux`: avoid re-encoding when the defect permits it;
- `reencode`: rebuild the media timeline more aggressively.

Optional `--fps` can force CFR when re-encoding.

## Normalize

```bash
cecilia-ffmpeg repair normalize input.mp4   --width 1920   --height 1080   --fps 30   --pixel-format yuv420p   --sample-rate 48000   --channels 2
```

## Validation

After repair, probe and diagnose the output again. FFmpeg exit code 0 alone is not sufficient evidence that the original defect was corrected.
