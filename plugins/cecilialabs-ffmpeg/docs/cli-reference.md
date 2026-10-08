# CLI Reference

The CLI is the canonical command surface after the host and required
capabilities are known. For context detection, associated scripts, and the
distinction between a plan and a verified artifact, see [Agent workflows](agent-workflows.md).

## Global options

```text
--output <path>       explicit destination for single-file commands
--overwrite           allow replacing an existing destination
--dry-run             validate/render the intended invocation without executing FFmpeg
--json                emit the stable JSON result envelope on stdout
--quiet               suppress non-error human output
--verbose             emit diagnostic details to stderr
--no-progress         suppress live human progress
--no-color            disable ANSI color and friendly semantic decoration
--ffmpeg-path <path>  override FFmpeg binary resolution
--ffprobe-path <path> override FFprobe binary resolution
--keep-temp           preserve temporary/intermediate artifacts
```

## Output preflight

Commands that produce local files resolve and validate their destination before expensive media processing begins.

- an existing destination fails with `E_IO_OUTPUT_EXISTS` unless `--overwrite` is explicit;
- input/output path collisions are rejected before mutation;
- explicit `--output` paths are checked by the common CLI action preflight;
- domain operations repeat the check after resolving command-specific/default output paths, so package API and Skill-script callers receive the same protection;
- `convert batch --existing error` validates all planned destinations before starting workers;
- pipeline output is validated before any intermediate workspace or step execution.

Streaming commands are excluded from file-existence preflight because their `--url` value is a transport destination rather than a local output file.

## Pipelines

```text
pipeline <file> <validate|print|run>
pipeline [inline options] <run>
```

Validate, print, or execute a v1 declarative YAML pipeline. Inline pipelines
use repeated `--step` blocks and converge to the same typed document. Supported
steps are `trim`, `speed`, `resize`, `normalize`, `audio.normalize`, `convert`,
and named `preset` references.

Pipeline execution is namespaced under `pipeline`; the old top-level pipeline
action is not a compatibility alias.

Global `--dry-run`, `--json`, `--overwrite`, `--keep-temp`, binary overrides,
and `--output` apply to pipeline execution.

See [Declarative pipelines & presets](pipelines.md).

## Inspection

### `doctor`

Inspect FFmpeg/FFprobe paths, versions, codecs, encoders, decoders, filters, protocols, and hardware-related capabilities.

### `probe <input>`

Normalize FFprobe metadata into typed media information.

### `environment capabilities`

Machine-readable environment capability inspection.

### `environment version`

Normalized FFmpeg/FFprobe version information.

### `environment check`

Read-only onboarding check for the execution context, Node.js/npm, toolkit
resolution, FFmpeg/FFprobe versions, capabilities, and an optional output
path. It does not install packages or edit shell state:

```bash
cecilia-ffmpeg environment check --json
cecilia-ffmpeg environment check --context chatgpt-regular --json
```

### `environment install [scope]`

Plan or explicitly run the toolkit npm installation flow. The scope is
`global`, `local`, or `npm-exec`; the default is `npm-exec`:

```bash
cecilia-ffmpeg environment install local --json
cecilia-ffmpeg environment install local --apply --authorize --json
```

`--apply --authorize` is required before npm runs. The flow never installs
system FFmpeg packages and never edits shell startup files. Run
`environment check --json` again after an applied install.

## Video

```text
video trim-start <input> --seconds <n> [--mode auto|copy|accurate]
video trim-end <input> --seconds <n> [--mode auto|copy|accurate]
video trim <input> [--start <n>] [--end <n>|--duration <n>] [--mode ...]
video speed <input> --factor <n> [--audio sync|drop]
video from-image <input> [--duration 5] [--resolution WxH] [--fps 30] [--hardware <mode>]
video upscale <input> --resolution WxH [--profile balanced|aggressive] [--hardware <mode>]
video attach-audio <video> <audio> [--mode replace|append]
video add-silence <video> [--replace-existing]
```

`video restore` is retained as a compatibility alias for `video upscale`.

Visual geometry options where exposed:

```text
--fit contain|cover|stretch
--background <color>
--to mp4|webm
```

## Image

```text
image convert <input> --to png|jpeg|jpg|webp|gif
image extract <input> [--at <seconds>] [--to png|jpeg|jpg|webp]
```

Image commands support optional width/height, fit/background, and quality controls.

## Audio

```text
audio silence
audio detect-silence <input>
audio remove-silence <input>
audio telephony <input> --codec mulaw|alaw|gsm|pcm
```

Compatibility aliases remain:

```text
audio attach <video> <audio>
audio add-silence <video>
```

The canonical video-domain forms are `video attach-audio` and `video add-silence`.

## Conversion

```text
convert file <input> --to <format>
convert batch <directory> --from <format> --to <format>
```

Formats:

```text
video: mp4, webm
image: gif, webp, png, jpeg/jpg
audio: wav, mp3, aac, m4a, flac, opus, ogg
```

Tuning options include FPS, dimensions, fit/background, WebP quality, GIF palette/loop, audio bitrate, sample rate, and channels.

For MP4/H.264 and WebM/VP9 video targets:

```text
--hardware software|auto|nvenc|qsv|vaapi|videotoolbox
--hardware-device <path>
--hardware-strict
```

The same hardware options are exposed by `video from-image` and `video upscale` / `video restore`.

## Composition

```text
compose concat <inputs...>
compose transition <left> <right>
compose slideshow <directory>
```

Transitions:

```text
fade fadeblack fadewhite wipeleft wiperight slideup slidedown
circleopen circleclose dissolve pixelize distance zoomin zoomout
```

Concat/transition support normalization, fit/background, audio policy, and MP4/WebM output.

Slideshow supports `vertical-stack` and `sequence` styles; sequence mode can use transitions. Include/exclude patterns are repeatable. Outputs: MP4, WebM, GIF, WebP.

## Diagnostics & repair

```text
diagnose <input> [--deep] [--log <path>]
repair timestamps <input> [--mode remux|reencode] [--fps <fps>]
repair normalize <input> [--width ...] [--height ...] [--fps ...]
```

## Streaming

```text
stream camera --device <device> --url <url>
stream file <input> --url <url>
```

Direct transports: HTTP(S), RTMP(S), RTSP, SRT, UDP, TCP.

Direct WebSocket output is intentionally unsupported. Use an explicit relay when a browser/WebSocket consumer is required.

## Exit/output model

Human final results use stdout; progress/warnings/errors use stderr.

Agent mode:

```bash
cecilia-ffmpeg ... --json
```

emits one stable JSON result envelope on stdout.

`--dry-run` and an onboarding plan are planning states, not completed media
operations. A file-producing command is complete only when the output passes
the operation's final FFprobe validation. Streaming commands report transport
and process state instead of claiming a local file artifact.
