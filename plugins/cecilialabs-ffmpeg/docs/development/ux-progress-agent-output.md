# Milestone 13 — UX, Progress & Agent-Friendly Output

Milestone 13 makes long-running FFmpeg operations observable without forcing humans or agents to parse FFmpeg's decorated terminal statistics.

## Output contract

The CLI has two deliberately separate presentation paths.

### Human mode

Human results continue to use readable command-specific summaries on stdout. Live progress is written to stderr so it never corrupts result text or redirected output.

TTY terminals receive a single updating line such as:

```text
clip.mp4 | 67% | frame 2411 | 100.0 fps | 3.70x | ETA 00:00:12
```

Non-TTY stderr avoids terminal escape sequences and emits coarse percentage checkpoints instead.

Human errors include the stable toolkit code:

```text
error [E_MEDIA_INCOMPATIBLE]: Input media is incompatible with this operation.
```

Use `--no-progress` to suppress the live human display. Progress collection remains available to the result envelope.

Human stdout/stderr uses restrained ANSI color only when attached to a TTY. `--no-color` disables it explicitly; `NO_COLOR` and `FORCE_COLOR` are also honored. JSON output is never colorized.

### Agent / JSON mode

```bash
cecilia-ffmpeg video speed input.mp4 --factor 2 --json
```

`--json` emits one JSON result envelope on stdout. It does not emit decorated progress lines. When FFmpeg progress was available, the envelope includes:

```json
{
  "schemaVersion": "1.0",
  "ok": true,
  "progress": {
    "completedRuns": 1,
    "runs": [
      {
        "runId": "ffmpeg-1",
        "state": "end",
        "estimated": true,
        "source": "/media/input.mp4",
        "totalSeconds": 67.16,
        "processedSeconds": 67.16,
        "percentage": 100,
        "frame": 2015,
        "fps": 108.4,
        "speedMultiplier": 3.7,
        "etaSeconds": 0
      }
    ]
  }
}
```

Agents therefore consume typed fields and never need to scrape human CLI text.

## Runtime progress source

When a CLI action enters the shared execution wrapper, an async-scoped progress observer is installed. Any `runFFmpeg()` call made inside that operation automatically gains:

```text
-progress pipe:1
-nostats
```

The existing safe child-process runtime remains unchanged: argument arrays, `shell: false`, bounded capture, cancellation, and structured FFmpeg errors still apply.

Library callers that do not establish a progress observer receive the previous FFmpeg invocation unchanged.

## Metrics

FFmpeg `-progress` key/value records provide:

- processed frame count;
- processing FPS;
- output timestamp;
- speed multiplier;
- completion state.

The toolkit derives:

- processed seconds;
- percentage complete;
- estimated remaining time.

## Duration estimation

Percentage and ETA require a target duration. The estimator uses the strongest available signal in this order:

1. an explicit output `-t` duration;
2. an explicit output `-to` range;
3. FFprobe durations registered during normal operation preflight;
4. composition estimates derived from multiple probed inputs minus xfade overlap.

Speed transformations detect `setpts=PTS/<factor>` and adjust the expected output duration. Trim-start operations subtract their seek offset.

Probe-derived/composition totals are marked `estimated: true`. Explicit output durations are marked `estimated: false`.

Operations with no bounded duration, such as a live camera stream, can still report frames/FPS/speed but intentionally omit percentage and ETA.

## Multiple FFmpeg runs

Some high-level commands execute more than one FFmpeg process, and batch conversions can execute several concurrently. The JSON envelope therefore exposes an array of run summaries instead of pretending the command has one global media timeline.

Each run receives a stable operation-local identifier:

```text
ffmpeg-1
ffmpeg-2
...
```

## stdout / stderr rules

| Mode | stdout | stderr |
|---|---|---|
| human | final human result | live progress, warnings, errors |
| human + `--no-progress` | final human result | warnings, errors |
| `--quiet` | suppressed | errors |
| `--json` | one JSON result envelope | no human progress |
| `--verbose` | normal result channel | diagnostic runtime details |

This separation is part of the public agent-facing contract.

## Validation

Milestone 13 adds unit tests for parsing, duration estimation, human rendering, progress scoping, envelope serialization, and a real FFmpeg integration test that verifies `-progress` events reach a structured observer.

Run:

```bash
npm run verify:ux
npm run validate
```
