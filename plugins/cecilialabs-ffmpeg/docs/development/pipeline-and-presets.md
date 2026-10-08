# Pipeline & Preset System

The pipeline layer is a declarative orchestration layer above the existing
typed media domains. It is exposed through the namespaced CLI and the
`ffmpeg-pipelines` Skill script.

## Boundary

```text
pipeline.yaml
    |
    v
js-yaml parser
    |
    v
Zod pipeline v1 schema
    |
    v
preset expansion
    |
    v
output contract validation
    |
    v
pipeline executor
    |
    +--> trimVideoStart/trimVideoRange
    +--> changeVideoSpeed
    +--> upscaleVideo
    +--> normalizeMedia
    +--> convertFile
            |
            v
existing core FFmpeg/FFprobe runtime
```

The pipeline layer never imports `node:child_process` and never shells out to the CLI.

The public grammar is:

```text
cecilia-ffmpeg pipeline <file> <validate|print|run>
```

The associated script accepts the same action set and delegates to the same
typed parser, validation, preflight, and executor.

## Relative paths

The pipeline file directory is the declarative job root. Relative `input` and `output.path` values resolve from that directory. CLI `--output` is resolved by the CLI before it reaches the executor.

## Intermediate media

Actual multi-step jobs allocate one `TemporaryWorkspace`. Every non-final step receives a unique output path in that workspace. Domain functions still use their own transactional sibling temp files for each individual transform.

The workspace is removed in `finally` unless `keepTemp` is explicit.

## Dry-run

Domain dry-runs cannot be chained because a later step would need an intermediate file that was intentionally not created. Pipeline dry-run therefore operates one level higher: it validates the source, schema, preset expansion, output contract, and ordered step plan without invoking mutating domain operations.

## Presets

Presets are local named arrays of pipeline steps. Expansion is recursive and deterministic. A recursion stack detects cycles before execution.

## Output contract

`output.codec` is an optional assertion. The validator also checks the final `convert.to` / `resize.to` against the final extension.

## Public API

The package root exports the full `src/pipeline/` API, including parser, schemas, preset expansion, validation, and execution.
