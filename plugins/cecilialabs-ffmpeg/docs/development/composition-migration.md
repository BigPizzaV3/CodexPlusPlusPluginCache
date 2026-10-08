# Milestone 7 — Legacy composition migration

| Legacy script | New operation | Notes |
|---|---|---|
| `concat-all-mp4-in-folder-with-fade.sh` | `compose concat ... --transition fade` | Keeps the important scale/pad/FPS/pixel-format/timebase normalization and adds typed audio handling. |
| `concat-clips.sh` | `compose transition <left> <right>` | Replaces `eval` and the optional/non-portable `gltransition` dependency with built-in FFmpeg `xfade` transitions. |
| `stack_vertical.sh` | `compose slideshow <directory>` | Preserves the vertical-stack visual model while replacing dynamic shell command construction with typed argument arrays and filter-graph construction. |

## Intentional changes

`gltransition` is not a standard filter in many FFmpeg distributions, so the first portable release uses built-in `xfade`. A future optional capability layer may expose `gltransition` only when `doctor` confirms that filter is compiled into the installed FFmpeg.

The original vertical-stack script is preserved under `legacy/bash/` with its attribution and MIT notice. The new TypeScript implementation is a clean migration of the workflow rather than execution of that shell script.
