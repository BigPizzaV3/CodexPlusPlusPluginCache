# Diagnostics Reference

## Issue-to-action guide

| Observation | Preferred next action |
|---|---|
| Non-monotonic DTS / timestamp discontinuity | `repair timestamps` |
| Variable or inconsistent frame timing | `repair normalize --fps ...` |
| SAR/pixel-format interoperability problem | `repair normalize` |
| Missing stream / mapping error | Probe and correct stream policy |
| Filter reinitialization / timebase mismatch | Normalize inputs before rebuilding the graph |
| Frozen frames | `diagnose --deep` then repair only if the root cause is identified |
| Corrupt packets / decode errors | Preserve evidence; re-encode may conceal but cannot reconstruct missing source data |

## Normalize pipeline

Video normalization uses explicit geometry, square-pixel normalization, FPS/pixel-format normalization, timebase/PTS reset, and explicit output timing. Audio normalization uses asynchronous resampling with a defined first PTS when required.

## Repair principle

```text
observe
→ classify
→ choose repair
→ execute transactionally
→ FFprobe
→ diagnose again
```

Do not collapse this into “re-encode everything”.
