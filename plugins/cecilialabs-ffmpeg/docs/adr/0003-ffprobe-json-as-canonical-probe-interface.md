# ADR 0003 — Use FFprobe JSON as the Canonical Media Inspection Interface

**Status:** Accepted  
**Date:** 2026-09-18

## Context

Media-domain commands need reliable stream, format, duration, frame-rate, timebase, codec, pixel-format, and audio metadata. Parsing FFmpeg's human-readable diagnostic output is unstable and mixes diagnostics with data.

## Decision

The toolkit will use FFprobe JSON as the canonical inspection source:

```text
ffprobe -v error -show_format -show_streams -of json <input>
```

Raw FFprobe JSON is converted immediately into toolkit-owned TypeScript contracts such as `MediaInfo`, `VideoStream`, and `AudioStream`.

Downstream operations should depend on the normalized contracts rather than FFprobe's raw field names.

## Consequences

### Positive

- deterministic machine-readable parsing;
- clear separation between external schema and internal domain schema;
- stable agent-facing output;
- numeric-string normalization in one location;
- downstream code is decoupled from FFprobe naming conventions;
- unit testing does not require subprocess output parsing everywhere.

### Tradeoffs

- the normalizer must be maintained when new fields become necessary;
- not every FFprobe field is retained in the first version;
- raw JSON remains useful for debugging but is not part of the public semantic contract.

## Rejected alternative

Parsing `ffmpeg -i` stderr was rejected because it is designed primarily for humans, can vary across versions/builds, and would require fragile textual heuristics.
