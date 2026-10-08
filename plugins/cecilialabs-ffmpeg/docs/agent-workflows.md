# Agent Workflows

Use this guide when an assistant, IDE, terminal agent, or automation must
inspect the environment, choose a media operation, execute it, or explain why
execution is not available. The same typed runtime is shared by the CLI,
Skill-associated scripts, and package API.

## Start with the execution context

Do not infer local file or shell access from the product name. Establish what
the current host can actually inspect, execute, install, and write.

| Context | Inspect files | Execute scripts | Install dependencies | Safe result |
| --- | ---: | ---: | ---: | --- |
| ChatGPT regular | No local access assumed | No | No | Copy/paste flow and an explicit plan |
| ChatGPT Work | When an environment is attached | When exposed by that environment | Only through an explicit workflow | Observed facts, execution, and verification |
| Codex | Yes in the authorized workspace | Yes | Yes within scope and authorization | Run the associated script and verify outputs |
| IDE or terminal agent | Host-dependent | Host-dependent | Only with explicit authorization | Detect first, then use the same contract |
| Unknown | Unknown | Unknown | No assumption | Ask for the missing environment facts |

For regular ChatGPT, a plan or command is not proof that a file was inspected
or created. A completed artifact may be reported only after an executable host
has run the operation and its result has been verified.

## The workflow

```text
execution context
        ↓
onboarding and capability check
        ↓
behavioral or domain Skill selection
        ↓
input/output preflight
        ↓
associated script or canonical CLI
        ↓
FFprobe verification and structured result
```

Use `ffmpeg-onboarding` first when the host, binaries, or required codec,
filter, or hardware capability is unknown. Use `ffmpeg-workflow` when a
natural-language request needs classification, multiple domain Skills, or a
reusable pipeline.

## Route the request

| User intent | Skill | Associated script | Expected result |
| --- | --- | --- | --- |
| Check Node.js, FFmpeg, FFprobe, or hardware | `ffmpeg-onboarding` → `ffmpeg-environment` | `check.mjs` → `inspect.mjs` | Readiness or capability report |
| Trim, speed, resize, or create video from an image | `ffmpeg-video-editing` | `scripts/run.mjs` | Verified video artifact |
| Attach audio, generate silence, or transcode telephony audio | `ffmpeg-audio` | `scripts/run.mjs` | Verified audio/video artifact |
| Convert one file or a directory | `ffmpeg-conversion` | `scripts/run.mjs` | Verified converted file or batch report |
| Join clips, add transitions, or create a slideshow | `ffmpeg-composition` | `scripts/run.mjs` | Verified composed artifact |
| Capture a camera or deliver a stream | `ffmpeg-streaming` | `scripts/run.mjs` | Validated stream plan or live result |
| Explain or repair a damaged file | `ffmpeg-diagnostics` | `scripts/run.mjs` | Diagnosis or verified repair |
| Chain supported operations or author reusable YAML | `ffmpeg-pipelines` | `scripts/run.mjs` | Validated pipeline and artifacts |

Select the narrowest Skill that matches the desired result. Do not choose a
Skill only because a filename contains a matching word; FFprobe metadata and
the requested output contract are the source of truth.

## Use the associated script

Every operational Skill exposes a JSON-in/JSON-out entry point. Send one JSON
object on stdin and treat the one JSON result envelope on stdout as the source
of truth. The envelope distinguishes planned work, completed work, warnings,
errors, next steps, and artifacts.

From a built repository checkout:

```bash
npm run build

printf '%s\n' '{"context":"codex","input":{}}' \
  | node skills/ffmpeg-onboarding/scripts/check.mjs

printf '%s\n' '{"context":"codex","input":{"action":"capabilities"}}' \
  | node skills/ffmpeg-environment/scripts/inspect.mjs

printf '%s\n' '{"context":"codex","input":{"action":"trim-start","input":"clip.mp4","seconds":5,"output":"clip.trimmed.mp4"}}' \
  | node skills/ffmpeg-video-editing/scripts/run.mjs
```

Use the matching installed-package Skill path when the package is being run
from an installed plugin. Do not construct a generic shell runner around the
scripts or interpolate user input into a command.

An installed plugin and an installed npm runtime are separate surfaces. The
plugin host discovers the ten Skills from `plugin.json`; the associated script
then imports the bundled `dist/` runtime from the extracted plugin root. Use
the plugin host's import/upload flow for activation, then run the onboarding
Skill from that same extracted package to confirm discovery and execution.

For a regular ChatGPT request, use the same request shape with
`"context":"chatgpt-regular"`. The script returns a plan and next command;
it does not pretend to inspect local media.

## CLI fallback order

When the associated script is unavailable or does not expose the requested
action, use the following order:

1. the global `cecilia-ffmpeg` executable;
2. the explicit package-runner fallback;
3. native FFmpeg/FFprobe only when the toolkit cannot represent the operation
   or the user explicitly requests native syntax.

Global installation:

```bash
npm install -g @cecilialabs/ffmpeg
cecilia-ffmpeg doctor
```

Without a global installation:

```bash
npm exec --yes --package=@cecilialabs/ffmpeg -- cecilia-ffmpeg doctor
```

The public CLI grammar is documented in the [CLI reference](cli-reference.md).
Pipeline work uses `pipeline <file> <validate|print|run>`; there is no separate
top-level pipeline action.

## Preflight, plans, and completed work

Before a file-producing operation:

- inspect inputs with FFprobe when streams, timing, codec, dimensions, or audio
  layout affect correctness;
- resolve and validate the destination before expensive media work;
- reject input/output collisions and implicit overwrites;
- use `--dry-run` when the user wants a plan or when a pipeline should be
  inspected before mutation.

A plan or dry-run is not a completed media operation. After execution, verify
that the output exists, is non-empty, is readable by FFprobe, and satisfies the
requested codec, stream, timing, dimension, or container contract. Streaming
operations return a transport/execution result rather than a local file
artifact.

For a Skill envelope, the completion decision is:

- `status: "completed"` and `ok: true` mean the operation completed;
- `status: "planned"` means no media mutation occurred;
- `status: "needs-input"` means the diagnostic ran but its result does not
  authorize the next operation;
- `status: "failed"` and `ok: false` mean the requested operation must not be
  announced as successful;
- `artifacts[].verified: true` is only evidence for a produced artifact when
  the envelope is completed and the domain output includes FFprobe metadata.

Pipeline `validate`/`print` responses never create artifacts. A batch with one
or more failed items returns `E_BATCH_PARTIAL_FAILURE`, `status: "failed"`,
`ok: false`, and exit code `7`; successful outputs may remain available and
the failure details identify the failed items.

For onboarding specifically, the diagnostic envelope can complete with
`status: "needs-input"`. Execution is authorized only when `output.status` is
exactly `"ready"`; `"warning"` and `"blocked"` require the listed remediation
and a new check.

See [the pipeline guide](pipelines.md) for YAML validation, preset expansion,
intermediate workspaces, and final codec assertions.

## Installation and write boundaries

Environment inspection is read-only. Installation, package-manager actions,
shell startup changes, PATH changes, device configuration, and media writes
need explicit authorization from the active host and user workflow.

The onboarding installer can plan `global`, `local`, or `npm-exec` package
installation. It executes only when both the request and the host authorize
the change, and it reports a readiness check afterward. It does not install
system FFmpeg packages or edit shell startup files.

## Long operations and recovery

Keep the distinction between these states:

- `planned`: the host cannot execute or the request asked for a dry-run;
- `running`: execution has started and progress may be available;
- `completed`: the result and any file artifact passed verification;
- `failed`: the structured error identifies the failed step and recovery path;
- `cancelled`: the operation stopped without claiming a completed artifact.

For a failure, preserve the source and useful temporary evidence, inspect the
structured error and stderr details, correct the specific input or capability,
and retry only after the contract changes. Use `--keep-temp` when intermediate
pipeline state is needed for diagnosis. Do not report success because FFmpeg
returned exit code zero without checking the final media properties.

## Related references

- [Getting started](getting-started.md) — first environment check and pipeline.
- [Installation](installation.md) — global, local, and package-runner setup.
- [CLI reference](cli-reference.md) — commands, options, and output behavior.
- [Declarative pipelines](pipelines.md) — reusable multi-step workflows.
- [Migration from Bash](migration-from-bash.md) — semantic mapping and safety corrections.
- [Skill request examples](skill-request-examples.md) — copy/paste JSON examples.
- [Skill catalog](skill-catalog.md) — all Skills, scripts, and references.
