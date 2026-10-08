# Milestone 4 — Legacy Bash Migration

| Legacy utility | v0.2.0 command | Migration notes |
|---|---|---|
| `crop-x-seconds-from-start.sh` | `video trim-start` | Replaces hard-coded `40`, filenames and `cd`; adds `auto/copy/accurate` semantics. |
| `increase-video-speed.sh` | `video speed` | Replaces folder loop and fixed `2.5`; audio can now remain synchronized instead of being unconditionally removed. |
| `create-clip-from-image.sh` | `video from-image` | Removes `eval`, fixed filenames and fixed duration; resolution/FPS are explicit. |
| `upscale-video-to-hd.sh` | `video restore` | Removes misleading `HD=720x404`; target resolution is explicit. |
| `upscale-video-to-fhd.sh` | `video restore` | Removes misleading `FHD=1280x720`; target resolution is explicit. |

The Bash files remain under `legacy/bash/` as provenance and regression context. They are not runtime dependencies.
