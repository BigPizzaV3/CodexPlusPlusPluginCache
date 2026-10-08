# Milestone 13 — UX, Progress & Agent-Friendly Output — Checklist

**Target:** `v0.9.7`  
**Status:** Implemented; local validation required before merge

## Progress runtime

- [x] FFmpeg `-progress pipe:1` integration.
- [x] `-nostats` prevents decorated FFmpeg stats from becoming the machine progress source.
- [x] Incremental key/value progress parser.
- [x] Processed frame count.
- [x] Processing FPS.
- [x] Speed multiplier.
- [x] Processed output time.
- [x] Percentage complete when total duration is known.
- [x] ETA when duration and speed are known.
- [x] Completion state.
- [x] Progress instrumentation is scoped to CLI operations and does not change ordinary library calls.

## Duration model

- [x] Explicit `-t` duration.
- [x] Explicit `-to` duration.
- [x] FFprobe duration registration.
- [x] Trim seek adjustment.
- [x] Speed-factor adjustment.
- [x] Multi-input composition estimate with xfade overlap.
- [x] Unbounded/live operations omit percentage and ETA rather than fabricating them.
- [x] Estimated versus explicit totals are distinguished.

## Human UX

- [x] TTY single-line progress.
- [x] Non-TTY coarse progress without ANSI escape sequences.
- [x] Human progress goes to stderr.
- [x] Final human result remains on stdout.
- [x] `--no-progress` suppresses live progress.
- [x] `--quiet` suppresses normal human output/progress.
- [x] Human errors include stable toolkit error codes.
- [x] Restrained TTY color for human stdout/warnings/errors.
- [x] `--no-color`, `NO_COLOR`, and `FORCE_COLOR` support.
- [x] JSON/non-TTY output remains free of ANSI color.

## Agent output

- [x] `--json` emits one result envelope on stdout.
- [x] JSON mode suppresses human progress rendering.
- [x] Result envelope exposes structured progress summaries.
- [x] Multiple FFmpeg runs are represented separately.
- [x] Output-envelope JSON Schema includes progress.
- [x] Agents do not need to scrape decorated CLI text.

## Quality

- [x] Progress parser/derivation tests.
- [x] Progress duration-estimator tests.
- [x] Async progress-context test.
- [x] Human progress-renderer tests.
- [x] Real FFmpeg structured-progress integration test.
- [x] Result-envelope regression updated.
- [x] Global option/help regression updated.
- [x] Added `verify:ux`.
- [x] Added `verify:ux` to `npm run validate`.
- [x] Package/plugin/project version advanced to `0.9.7`.
- [x] README, roadmap, changelog, output schema, docs, and contracts updated.
- [x] GitHub Actions remain intentionally deferred until alpha completion.
- [ ] Run `npm run validate` in the configured Local Environment before merge.

## Acceptance criterion

Machine consumers receive stable structured fields for success, failure, and FFmpeg progress; they never need to parse terminal decoration or human progress text.
