# Batch Processing

`convert batch` applies the same typed `convertFile()` conversion logic to a discovered directory selection.

## Basic batch

```bash
cecilia-ffmpeg convert batch ./clips   --from mp4   --to webm
```

## Selection

```bash
cecilia-ffmpeg convert batch ./media   --from wav   --to flac   --recursive   --include "calls/**/*.wav"   --exclude "**/*-raw.wav"
```

`--include` and `--exclude` are repeatable.

## Concurrency

```bash
--parallelism 4
```

The batch engine bounds concurrent conversions; it does not generate shell loops.

## Failure behavior

```text
--fail-fast
--continue-on-error
```

Fail-fast stops scheduling new work after the first failure. Continue-on-error allows independent items to continue and reports failures in the final batch result.

## Output layout

```text
--output-dir <directory>
--no-preserve-hierarchy
--existing error|skip|replace
```

By default, hierarchy is preserved.

## Hardware policy

Video batches targeting MP4 or WebM can use the same encoder policy as single-file conversion:

```bash
cecilia-ffmpeg convert batch ./clips \
  --from mp4 \
  --to webm \
  --hardware auto
```

Each item uses the shared hardware selector and software fallback policy. Use `--hardware-strict` when a hardware path is mandatory.

## Progress & reporting

Human mode emits per-item batch progress and FFmpeg progress. JSON mode emits one final structured batch report including discovered, attempted, succeeded, failed, skipped, duration, and per-item results.

## Safety

Use `--existing replace` deliberately. Do not combine the global single-file `--output` option with batch conversion; use `--output-dir`.
