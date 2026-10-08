# FFmpeg Media Toolkit Skills

The package installs ten Skills: two behavioral Skills for context and routing,
and eight domain Skills for concrete media operations. The public execution
flow is documented in [Agent workflows](agent-workflows.md); this page is the
catalog and the compact script map.

## Catalog

| Skill | Use it for | Associated entry point | Reference |
|---|---|---|---|
| [ffmpeg-onboarding](../skills/ffmpeg-onboarding/SKILL.md) | Context, readiness, and explicit installation | `scripts/check.mjs`, `scripts/install.mjs` | [execution contexts](../skills/ffmpeg-onboarding/references/execution-contexts.md) |
| [ffmpeg-workflow](../skills/ffmpeg-workflow/SKILL.md) | Natural-language routing and verified outcomes | routes to a domain script | [request routing](../skills/ffmpeg-workflow/references/request-routing.md) |
| [ffmpeg-environment](../skills/ffmpeg-environment/SKILL.md) | Versions, capabilities, and media inspection | `scripts/inspect.mjs` | [environment reference](../skills/ffmpeg-environment/references/environment-reference.md) |
| [ffmpeg-video-editing](../skills/ffmpeg-video-editing/SKILL.md) | Trim, speed, image-to-video, and resize | `scripts/run.mjs` | [video reference](../skills/ffmpeg-video-editing/references/video-editing-reference.md) |
| [ffmpeg-audio](../skills/ffmpeg-audio/SKILL.md) | Tracks, silence, and telephony | `scripts/run.mjs` | [audio reference](../skills/ffmpeg-audio/references/audio-reference.md) |
| [ffmpeg-conversion](../skills/ffmpeg-conversion/SKILL.md) | Single-file and batch conversion | `scripts/run.mjs` | [conversion reference](../skills/ffmpeg-conversion/references/conversion-reference.md) |
| [ffmpeg-composition](../skills/ffmpeg-composition/SKILL.md) | Concatenation, transitions, and slideshows | `scripts/run.mjs` | [composition reference](../skills/ffmpeg-composition/references/composition-reference.md) |
| [ffmpeg-streaming](../skills/ffmpeg-streaming/SKILL.md) | Camera capture and network delivery | `scripts/run.mjs` | [streaming reference](../skills/ffmpeg-streaming/references/streaming-reference.md) |
| [ffmpeg-diagnostics](../skills/ffmpeg-diagnostics/SKILL.md) | Diagnosis and observation-driven repair | `scripts/run.mjs` | [diagnostics reference](../skills/ffmpeg-diagnostics/references/diagnostics-reference.md) |
| [ffmpeg-pipelines](../skills/ffmpeg-pipelines/SKILL.md) | YAML pipelines and reusable presets | `scripts/run.mjs` | [pipeline schema](../skills/ffmpeg-pipelines/references/pipeline-schema.md) |

## Shared execution policy

For supported operations, use this order:

```text
Skill-associated script
        ↓ unavailable or unsupported action
global cecilia-ffmpeg binary
        ↓ unavailable
npm exec --yes --package=@cecilialabs/ffmpeg -- cecilia-ffmpeg ...
        ↓ unsupported capability or explicit native request
native FFmpeg / FFprobe
```

All Skills require explicit input/output intent, probe-driven decisions when
media properties matter, deterministic behavior, and validation of produced
artifacts. A plan or dry-run must not be presented as a completed operation.

## Script contract

Operational scripts accept one JSON object on stdin and emit one result
envelope on stdout. The envelope carries `ok`, `status`, `warnings`, `error`,
`next`, and `artifacts` fields as applicable. `chatgpt-regular` requests return
plans because regular Chat has no assumed local filesystem or shell access.

From a built checkout:

```bash
npm run build
printf '%s\n' '{"context":"codex","input":{"action":"capabilities"}}' \
  | node skills/ffmpeg-environment/scripts/inspect.mjs
```

Domain action names and request examples are collected in
[Skill request examples](skill-request-examples.md). For pipeline authoring and
execution, use the namespaced CLI grammar:

```bash
cecilia-ffmpeg pipeline pipeline.yaml validate
cecilia-ffmpeg pipeline pipeline.yaml run --dry-run
```

The scripts call typed domain functions directly. They do not construct shell
commands from user input, and they return a planned result when the active
context cannot execute scripts.
