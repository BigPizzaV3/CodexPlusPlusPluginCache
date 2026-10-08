# Video Editing Reference

## Trim modes

| Mode | Use |
|---|---|
| `copy` | Fast, no re-encode; cuts may depend on keyframes |
| `accurate` | Deterministic temporal cut with re-encode |
| `auto` | Toolkit-selected safe behavior |

Prefer `accurate` when frame-level timing matters.

## Speed

When audio exists and must remain synchronized, video PTS and audio tempo must be adjusted together. Do not emulate a speed change by video-only `setpts` unless audio is intentionally dropped.

## Restore

Use explicit resolution semantics. Avoid misleading labels such as “FHD” for non-1920×1080 targets.

## Validation checklist

- output exists and is non-empty;
- requested duration/range is achieved within codec/container tolerance;
- target dimensions are correct;
- audio presence matches policy;
- output is probeable;
- no unexpected stream was dropped.
