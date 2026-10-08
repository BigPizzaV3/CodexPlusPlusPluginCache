# Milestone 6 — Media Conversion & Batch Engine

Milestone 6 replaces six independent Bash conversion loops with one typed conversion domain and one reusable batch scheduler.

## Architecture

```text
CLI / package API
      ↓
conversion profiles
      ↓
convertFile()
      ↓
FFprobe preflight
      ↓
prepareOutputTransaction()
      ↓
runFFmpeg()
      ↓
FFprobe output validation

convertBatch()
      ↓
discovery + filtering
      ↓
output planning / collision validation
      ↓
concurrency scheduler
      ↓
convertFile() for every selected item
      ↓
batch summary / JSON report
```

The batch engine does not implement media conversion itself. It delegates every item to the exact same `convertFile()` path used by single-file conversion.

## Supported conversion routes

| Source | Target | Main implementation |
|---|---|---|
| MP4 | WebM | VP9 + optional Opus |
| MP4 | GIF | inline palette generation + paletteuse |
| MP4 | animated WebP | FFmpeg `libwebp` + WebP muxer |
| WebM | GIF | inline palette generation + paletteuse |
| WebP | PNG | first frame to PNG |
| GIF | WebM | VP9, audio disabled |

Unsupported pairs fail before FFmpeg execution with `E_OPERATION_UNSUPPORTED`.

## Single-file CLI

```bash
cecilia-ffmpeg convert file ./clip.mp4 --to webm
```

```bash
cecilia-ffmpeg convert file ./clip.mp4 \
  --to gif \
  --fps 12 \
  --width 720 \
  --max-colors 192
```

```bash
cecilia-ffmpeg convert file ./clip.mp4 \
  --to webp \
  --fps 10 \
  --quality 82 \
  --loop 0
```

Conversion-specific tuning controls are optional. Target defaults are deterministic and live in `src/conversion/profiles.ts`.

## Batch CLI

```bash
cecilia-ffmpeg convert batch ./clips \
  --from mp4 \
  --to webm
```

Recursive selection with filters:

```bash
cecilia-ffmpeg convert batch ./clips \
  --from mp4 \
  --to gif \
  --recursive \
  --include '**/episode-*.mp4' \
  --exclude '**/draft-*' \
  --parallelism 4 \
  --output-dir ./converted
```

## Selection semantics

1. Files are first restricted by the explicit `--from` extension/format.
2. Non-recursive traversal is the default to preserve legacy folder-script expectations.
3. `--recursive` enables nested traversal.
4. Repeatable `--include` patterns are ORed together.
5. Repeatable `--exclude` patterns are ORed together and applied after inclusion.
6. Discovery is sorted deterministically by relative path.

The dependency-free matcher supports:

- `*` — characters within one path segment;
- `?` — one character within one segment;
- `**` — any number of nested segments.

## Output planning

With no `--output-dir`, converted files are created beside their inputs.

With an output directory, the relative hierarchy is preserved by default:

```text
input/
├── one.mp4
└── nested/
    └── two.mp4

output/
├── one.webm
└── nested/
    └── two.webm
```

`--no-preserve-hierarchy` flattens the outputs. Before execution, the engine detects duplicate output paths caused by flattening or duplicate basenames and fails with `E_CONFIG_CONFLICT` rather than racing two FFmpeg processes against the same file.

## Existing-output strategy

```text
error    fail the item (default)
skip     record a skipped item and continue
replace  replace transactionally
```

The global `--overwrite` option maps to `replace` when `--existing` is not specified.

## Failure modes

The default is **continue-on-error**. Every item is attempted and the final report contains all failures.

```bash
--fail-fast
```

stops scheduling new items after the first failure. Items that had already started may finish; remaining unscheduled items are reported as skipped with reason `fail-fast`.

Batch partial failure does not discard the report. The CLI emits the report and sets exit code `7` (`E_BATCH_PARTIAL_FAILURE`).

## Parallelism

`--parallelism` accepts `1..32` and defaults to `2`.

Parallelism controls the number of files converted concurrently. Each file still uses the common core runtime and transactional output path.

## Dry run

A dry run performs read-only source inspection so the plan can correctly account for streams such as audio, but does not execute the mutating FFmpeg conversion:

```bash
cecilia-ffmpeg --dry-run --json convert file ./clip.mp4 --to webm
```

For batch jobs, every selected item is planned through `convertFile()` and appears in the batch report.

## Agent-friendly JSON

`convert file --json` returns the standard result envelope whose `data` is a `ConversionReport`.

`convert batch --json` returns a `BatchConversionReport`, including:

```text
discovered
attempted
succeeded
failed
skipped
items[]
startedAt
finishedAt
durationMs
```

Each batch item includes the input, relative path, intended output, status, warnings, and structured error when applicable.
