# Skill request examples

This page is the copy/paste request set for the Skills. The policy for choosing
an execution context, routing a request, and distinguishing a plan from a
verified artifact lives in [Agent workflows](agent-workflows.md). Start with
the user's desired result, select the narrowest Skill, and use its associated
script when the active host can execute local files. The scripts read one JSON
request from stdin and emit one JSON result envelope; the output contract is
[`skill-result-envelope.schema.json`](../specs/skill-result-envelope.schema.json).

## Routing by user intent

| User request | Skill | Associated script |
| --- | --- | --- |
| “Can this host encode H.264 with NVENC?” | `ffmpeg-onboarding` → `ffmpeg-environment` | `check.mjs` → `inspect.mjs` |
| “Trim this video and make a WebM.” | `ffmpeg-workflow` → `ffmpeg-video-editing` + `ffmpeg-conversion` | `run.mjs` in each domain |
| “Attach this WAV to the video.” | `ffmpeg-audio` | `skills/ffmpeg-audio/scripts/run.mjs` |
| “Convert every MP4 in this directory.” | `ffmpeg-conversion` | `skills/ffmpeg-conversion/scripts/run.mjs` |
| “Join these clips with a fade.” | `ffmpeg-composition` | `skills/ffmpeg-composition/scripts/run.mjs` |
| “Send this file to an SRT destination.” | `ffmpeg-streaming` | `skills/ffmpeg-streaming/scripts/run.mjs` |
| “Why does this file freeze?” | `ffmpeg-diagnostics` | `skills/ffmpeg-diagnostics/scripts/run.mjs` |
| “Create a reusable trim → resize → convert job.” | `ffmpeg-pipelines` | `skills/ffmpeg-pipelines/scripts/run.mjs` |

`ffmpeg-workflow` routes the intent; it does not claim execution or replace a
domain Skill. Use `ffmpeg-onboarding` first when execution context, binaries,
or required capabilities are unknown.

## Request envelope

The request is a JSON object. `context` may be `codex`, `chatgpt-work`,
`chatgpt-regular`, `ide`, `terminal`, or `unknown`; `input` contains the
operation-specific fields. A regular Chat request produces a plan and next
steps instead of accessing local media.

```json
{
  "context": "codex",
  "requestId": "example-video-001",
  "input": {
    "action": "trim-start",
    "input": "./media/source.mp4",
    "seconds": 5,
    "output": "./media/trimmed.mp4"
  }
}
```

Run the example from a built checkout:

```bash
printf '%s\n' '{"context":"codex","input":{"action":"trim-start","input":"./media/source.mp4","seconds":5,"output":"./media/trimmed.mp4"}}' \
  | node skills/ffmpeg-video-editing/scripts/run.mjs
```

## Environment inspection

Onboarding is read-only by default. Installation remains a separate action and
requires both explicit authorization fields described in
`skills/ffmpeg-onboarding/SKILL.md`.

```bash
printf '%s\n' '{"context":"codex","input":{}}' \
  | node skills/ffmpeg-onboarding/scripts/check.mjs

printf '%s\n' '{"context":"codex","input":{"action":"capabilities"}}' \
  | node skills/ffmpeg-environment/scripts/inspect.mjs

printf '%s\n' '{"context":"codex","input":{"action":"probe","input":"./media/source.mp4"}}' \
  | node skills/ffmpeg-environment/scripts/inspect.mjs
```

## Audio attachment

`ffmpeg-audio` uses `audioInput` for the second source. `input` and
`audioInput` are paths; `mode` is `replace` (default) or `append`; `videoMode`
is `auto`, `copy`, or `encode`; `pad` is boolean; and `output` is an optional
destination path. The response is completed only when `outputMedia` contains
the resulting streams.

```bash
printf '%s\n' '{"context":"codex","input":{"action":"attach","input":"./media/video.mp4","audioInput":"./media/voice.wav","mode":"replace","videoMode":"auto","pad":true,"output":"./media/video-with-audio.mp4"}}' \
  | node skills/ffmpeg-audio/scripts/run.mjs
```

## Video upscale or restore

`ffmpeg-video-editing` actions `upscale` and `restore` require `input`,
numeric positive `width` and `height`, and an optional `output`. Optional
fields are `profile` (`balanced` or `aggressive`), `fps`, `crf`, `preset`,
`fit`, `background`, and `to` (`mp4` or `webm`). `resolution` is a CLI
convenience flag; it is not a Skill JSON field.

```bash
printf '%s\n' '{"context":"codex","input":{"action":"upscale","input":"./media/source.mp4","width":1920,"height":1080,"profile":"balanced","to":"mp4","output":"./media/upscaled.mp4"}}' \
  | node skills/ffmpeg-video-editing/scripts/run.mjs
```

## Filtered batch conversion

`ffmpeg-conversion` action `batch` requires `directory`, `from`, and `to`.
`includes` and `excludes` are arrays of relative path patterns; they are not
the singular CLI flags. Optional fields include `recursive`, `parallelism`,
`failFast`, `preserveHierarchy`, `existing` (`error`, `skip`, or `replace`),
and `outputDirectory`.

```bash
printf '%s\n' '{"context":"codex","input":{"action":"batch","directory":"./media/clips","from":"mp4","to":"webm","recursive":true,"includes":["**/*.mp4"],"excludes":["**/draft-*.mp4"],"outputDirectory":"./media/converted","existing":"error"}}' \
  | node skills/ffmpeg-conversion/scripts/run.mjs
```

If any item fails, the envelope is `ok: false`, `status: "failed"`, and the
error code is `E_BATCH_PARTIAL_FAILURE` with exit code `7`. Do not announce the
output directory as verified from a partial report.

## Declarative pipeline

The pipeline script accepts a file, YAML text, or already parsed document and
uses the same typed pipeline schema as the CLI:

```bash
printf '%s\n' '{"context":"codex","input":{"action":"validate","file":"./pipeline.yaml"}}' \
  | node skills/ffmpeg-pipelines/scripts/run.mjs

printf '%s\n' '{"context":"codex","dryRun":true,"input":{"action":"run","file":"./pipeline.yaml"}}' \
  | node skills/ffmpeg-pipelines/scripts/run.mjs
```

The equivalent human-facing CLI remains:

```bash
cecilia-ffmpeg pipeline pipeline.yaml validate
cecilia-ffmpeg pipeline pipeline.yaml print
cecilia-ffmpeg pipeline pipeline.yaml run --dry-run
```

## Result handling

Treat `ok`, `status`, `warnings`, `error`, `next`, and `artifacts` as the
operational result. A planned or dry-run response is not a completed media
artifact. Only report a produced file after the envelope contains a completed
operation, `artifacts[].verified` is `true`, and the domain report includes the
expected FFprobe metadata. Pipeline validation is a structural report and
does not produce an artifact.
