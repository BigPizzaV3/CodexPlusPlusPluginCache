# Declarative Pipelines & Presets

The pipeline format composes existing typed media operations without
introducing a second FFmpeg execution engine. Use it for ordered or reusable
workflows; use a domain command for one simple operation. The [Agent
workflows](agent-workflows.md) guide explains how to choose the pipeline Skill
and how planned, running, and completed results differ.

## Validate, inspect, and run a pipeline

```bash
cecilia-ffmpeg pipeline pipeline.yaml validate
cecilia-ffmpeg pipeline pipeline.yaml print
cecilia-ffmpeg pipeline pipeline.yaml run
```

`validate` checks the document and its output contract, while `print` emits the
normalized expanded plan without executing media operations. `run` validates
again before execution. Relative `input`, `output.path`, and preset references
are resolved from the pipeline file directory.

The equivalent Skill-associated request is:

```bash
printf '%s\n' '{"context":"codex","input":{"action":"validate","file":"pipeline.yaml"}}' \
  | node skills/ffmpeg-pipelines/scripts/run.mjs
```

From a repository checkout, run `npm run build` first so the script can use the
compiled toolkit. A regular ChatGPT request returns a plan rather than reading
the pipeline file locally.

An inline pipeline uses the same typed schema and can be chained without a
temporary YAML file:

```bash
cecilia-ffmpeg pipeline \
  --step trim --input example.mp4 --trim-start 2 --output example.trim.mp4 \
  --step convert --input example.trim.mp4 --to webm --output example.webm \
  run
```

Each `--step` starts one supported step block. Inputs and outputs must chain in
order; the CLI converts the blocks into the same `PipelineDocument` used by a
file pipeline before validation or execution.

## Pipeline v1

```yaml
version: 1

input: source.mp4

steps:
  - trim:
      start: 4

  - speed:
      factor: 1.25
      audio: sync

  - audio:
      normalize: true
      sampleRate: 48000
      channels: 2

  - resize:
      width: 1920
      height: 1080
      fit: contain
      to: mp4
      hardware: auto

output:
  path: final.mp4
  codec: h264
```

Supported executable steps:

| Step | Domain reused | Purpose |
| --- | --- | --- |
| `trim` | video trim | remove a prefix or extract a range |
| `speed` | video speed | change playback speed and optionally sync audio |
| `resize` | video upscale | resize/fit with profile and hardware options |
| `normalize` | repair normalize | normalize video/audio properties |
| `audio.normalize` | repair normalize | roadmap-compatible audio normalization form |
| `convert` | conversion | change output media format/container |

Every operation delegates to the existing typed domain function and therefore keeps the same FFprobe preflight, output transaction, structured errors, hardware policy, and output validation behavior.

## Trim semantics

Remove the first four seconds:

```yaml
- trim:
    start: 4
```

Extract an explicit range:

```yaml
- trim:
    start: 4
    end: 12
```

or:

```yaml
- trim:
    start: 4
    duration: 8
```

Optional mode:

```yaml
mode: auto # auto | copy | accurate
```

## Named presets

Presets are local reusable step groups:

```yaml
input: source.mp4

presets:
  social-1080:
    - resize:
        width: 1920
        height: 1080
        fit: contain
        hardware: auto

steps:
  - trim:
      start: 2

  - preset: social-1080

output:
  path: social.mp4
  codec: h264
```

Presets may reference other presets. Unknown references and recursive cycles are rejected before execution.

## Conversion step

```yaml
- convert:
    to: webm
    width: 1280
    height: 720
    audioBitrate: 128k
    hardware: auto
```

The same conversion formats exposed by `convert file` are accepted.

## Hardware-aware resize

```yaml
- resize:
    width: 1920
    height: 1080
    profile: balanced
    hardware: auto
    hardwareStrict: false
```

Hardware selection reuses the v1.2 runtime-probed selector. Hardware policy applies to the specific step that declares it. For example, if a WebM input is resized to an intermediate WebM file, `hardware: auto` evaluates VP9 backends and will not choose H.264 NVENC. When the final target is MP4/H.264 and hardware encoding is desired, make the hardware-aware resize/conversion the final encoding step or declare `to: mp4` explicitly.

## Output contract

```yaml
output:
  path: final.mp4
  codec: h264
```

`codec` is optional, but when provided it is a validation assertion:

- `h264` requires an H.264-compatible output extension;
- `vp9` requires WebM;
- the final `convert.to` or `resize.to` must agree with the output extension.

Contradictory declarations fail before the first media mutation. The resolved final output path is also preflighted before any intermediate workspace or media step is started: when the destination already exists and overwrite is not explicit, the pipeline returns `E_IO_OUTPUT_EXISTS` immediately instead of performing expensive preceding steps. Statically impossible transitions, such as `convert.to: mp3` followed by `resize`, are rejected before execution because the preceding step no longer produces video. The final step is rendered into the isolated workspace, probed, and checked against a declared `output.codec` before it is promoted to the requested destination; a failed assertion therefore leaves the previous destination unchanged and removes the rejected staged file.

## Pipeline safety limits

To keep agent-generated jobs deterministic and bounded:

- preset nesting is limited to 32 levels;
- expanded executable pipelines are limited to 256 concrete steps;
- the final output path may not equal the original pipeline input path, even when overwrite is enabled;
- preset cycles and unknown references are rejected before execution.

These limits apply after named-preset expansion and are enforced by the typed pipeline engine.

## Intermediate artifacts

Actual multi-step runs use an isolated temporary workspace:

```text
input
  -> step-001-...
  -> step-002-...
  -> ...
  -> final output
```

Intermediate files are removed automatically after success or failure. If a
final codec or media assertion fails, the rejected final candidate remains only
in the temporary workspace (when `--keep-temp` is enabled); the requested
destination is not published. Correct the codec/step contract and retry, or
inspect the preserved workspace before cleaning it up.

Use:

```bash
cecilia-ffmpeg pipeline pipeline.yaml run --keep-temp
```

to preserve the workspace for debugging. The structured report includes the workspace path when it is preserved.

## Dry-run

```bash
cecilia-ffmpeg pipeline pipeline.yaml run --dry-run
```

Pipeline dry-run validates the structural and statically knowable parts of a
pipeline:

- YAML syntax;
- schema;
- input readability;
- preset expansion;
- output/codec consistency;
- statically executable step order and known media-kind transitions.

It does not execute FFmpeg, probe intermediate media, or prove that an
input-specific filter/codec will work. Runtime-only compatibility and final
media properties are validated only during actual execution, so a dry-run
cannot authorize announcing an artifact.

Dry-run is a planning state. It is not evidence that a final media artifact
exists, and it must not be reported as completed execution.

## Output override

The document output can be overridden from the CLI:

```bash
cecilia-ffmpeg pipeline pipeline.yaml run --output ./alternate.mp4
```

The override is still checked against the declared output codec/final target.

## JSON output

```bash
cecilia-ffmpeg pipeline pipeline.yaml run --json
```

The pipeline report includes:

- pipeline file;
- resolved source/final output;
- planned/executed state;
- expanded step count;
- per-step kind/input/output;
- per-step invocation and duration when executed;
- aggregated warnings;
- final FFprobe media information.

## Machine-readable schema

The npm package includes the JSON Schema representation of pipeline v1:

```text
specs/pipeline.schema.json
```

Editors, agents, and external validators may use this schema for static authoring assistance. Runtime execution still validates the parsed YAML with the canonical Zod schema before expanding presets or touching media.
