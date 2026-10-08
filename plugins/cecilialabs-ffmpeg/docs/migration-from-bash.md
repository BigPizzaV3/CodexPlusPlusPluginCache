# Migration from Legacy Bash

The original shell utilities were historical behavioral references. They are no
longer a runtime or distribution surface; their stable identifiers and semantic
corrections remain documented here as a migration guide. The current test
suite validates typed domain operations directly and does not depend on the old
files.

## Current migration flow

For a migrated operation, route the request through the matching Skill and its
associated JSON script when the host can execute local files. Otherwise use the
canonical `cecilia-ffmpeg` command or the explicit npm package-runner form.
Always keep the typed input/output contract, output preflight, and final
FFprobe verification. The [Agent workflows](agent-workflows.md) guide defines
the context and result rules.

The old top-level pipeline action has no compatibility alias. Replace it with
`cecilia-ffmpeg pipeline <file> <validate|print|run>` and choose the action
explicitly.

## Migration principles

- replace shell interpolation with typed argument arrays;
- probe media instead of trusting filenames;
- use transactional output instead of in-place mutation;
- preserve explicit overwrite policy;
- return structured errors/reports;
- keep legacy semantic mistakes corrected rather than reproduced.

## Full legacy mapping

| Legacy script | Canonical toolkit equivalent | Notes |
|---|---|---|
| `add-audio-2-clip.sh` | `video attach-audio <video> <audio>` | `audio attach` remains a compatibility alias |
| `add-silence-2-clip.sh` | `video add-silence <video>` | `audio add-silence` remains a compatibility alias |
| `concat-all-mp4-in-folder-with-fade.sh` | `compose concat <inputs...> --transition fade` | normalization is automatic |
| `concat-clips.sh` | `compose transition <left> <right>` | supports native/custom transition catalog |
| `convert-all-gif-in-folder-to-webm.sh` | `convert batch <dir> --from gif --to webm` | generic batch engine |
| `convert-all-mp4-in-folder-to-animated-webp.sh` | `convert batch <dir> --from mp4 --to webp` | real animated WebP output |
| `convert-all-mp4-in-folder-to-gif.sh` | `convert batch <dir> --from mp4 --to gif` | palette-based GIF profile |
| `convert-all-mp4-in-folder-to-webm.sh` | `convert batch <dir> --from mp4 --to webm` | VP9/Opus profile |
| `convert-all-webm-in-folder-to-gif.sh` | `convert batch <dir> --from webm --to gif` | generic conversion profile |
| `convert-all-webp-in-folder-to-png.sh` | `convert batch <dir> --from webp --to png` | regression uses a decodable static WebP fixture |
| `convert-audio-to-gsm-ulaw.sh` | `audio telephony <input> --codec mulaw` | corrected: G.711 μ-law is not GSM |
| `create-clip-from-image.sh` | `video from-image <image>` | fit/background/output format are explicit |
| `create-silence-audio.sh` | `audio silence` | typed sample rate/channel controls |
| `crop-x-seconds-from-start.sh` | `video trim-start <input> --seconds <n>` | auto/copy/accurate modes |
| `fix-freezes-and-blocks.sh` | `diagnose` + `repair normalize` | repair is observation-driven |
| `increase-video-speed.sh` | `video speed <input> --factor <n>` | audio sync/drop policy |
| `remove-silence-noises.sh` | `audio remove-silence <input>` | audio-only safety model |
| `stack_vertical.sh` | `compose slideshow <dir> --style vertical-stack` | original scrolling behavior preserved |
| `stream-to-websocket.sh` | `stream camera ... --transport http --container mpegts` | historical name was misleading; it was HTTP MPEG-TS, not WebSocket |
| `upscale-video-to-fhd.sh` | `video upscale <input> --resolution 1920x1080` | explicit dimensions replace misleading labels |
| `upscale-video-to-hd.sh` | `video upscale <input> --resolution 1280x720` | explicit dimensions |

## Semantic corrections

### G.711 μ-law vs GSM

The legacy filename suggested a GSM/μ-law combination. The toolkit models them as distinct codecs.

### GIF → WebM

The migrated implementation produces actual WebM/VP9 rather than accidentally re-encoding back to GIF.

### “WebSocket” streaming

The legacy stream script wrote MPEG-TS to an HTTP URL. The toolkit models transport, muxer, encoding, and capture separately and does not claim direct WebSocket output.

### Upscale naming

The canonical command is `video upscale`. `video restore` is retained as a compatibility alias during the pre-v1 transition.

## Current validation

The domain integration suites validate the supported video, audio, conversion, composition, diagnostics, and streaming operations directly. The historical mapping above is documentation only and is not a runtime or test dependency.
