---
name: ffmpeg-pipelines
description: Design, validate, and execute deterministic Cecil-IA Labs FFmpeg Media Toolkit YAML pipelines and reusable presets across multiple media operations.
---

# FFmpeg Declarative Pipelines

## Activation scope

Use this skill when a task requires two or more supported media transformations to be expressed or executed as one declarative workflow, when reusable named presets are useful, or when an agent should produce a deterministic YAML job instead of a sequence of ad-hoc shell commands.

Typical requests include:

- trim then resize then convert;
- apply the same resize/format preset to multiple jobs;
- author or review a `pipeline.yaml`;
- execute a pipeline through the associated script or CLI;
- inspect a pipeline with dry-run before media mutation.

## Do not use

Do not use this skill for:

- one simple operation that already maps directly to a single toolkit command/tool;
- live streaming workflows;
- arbitrary FFmpeg filter graphs not represented by the pipeline v1 schema;
- hidden shell scripting inside YAML;
- remote pipeline files that have not been made available to the local toolkit filesystem.

## Required inputs

Resolve or ask for:

1. the input media path;
2. the ordered transformations;
3. the final output path;
4. any explicit final codec assertion;
5. whether reusable presets are desired;
6. overwrite policy;
7. hardware policy when resize/conversion should use acceleration.

When editing an existing pipeline, preserve its explicit ordering and relative-path semantics unless the user asks for a structural change.

## Preflight

Before execution:

1. validate YAML syntax and the pipeline v1 schema;
2. resolve the input relative to the pipeline file directory;
3. expand all preset references;
4. reject missing presets and recursive preset cycles;
5. validate final output extension/codec consistency;
6. use dry-run when the user wants inspection before mutation.

Do not assume that an FFmpeg encoder being compiled means it is usable. Hardware-aware steps inherit the toolkit runtime-probe policy.

## Toolkit surface selection

Use the highest-level toolkit surface available:

1. Use the associated `scripts/run.mjs` entry point for supported pipeline actions.
2. Otherwise use the namespaced `cecilia-ffmpeg pipeline <file> <action>` command.
3. If the global binary is unavailable, use:
   `npm exec --yes --package=@cecilialabs/ffmpeg -- cecilia-ffmpeg pipeline <file> <action>`.
4. Use individual toolkit tools/commands only when the user explicitly wants step-by-step execution rather than a pipeline.
5. Use native FFmpeg only when pipeline v1 cannot represent the required operation or the user explicitly requests native syntax.

## Associated scripts

Use `scripts/run.mjs` with `input.action` `validate`, `print`, or `run` and
provide `input.file`, `input.text`, or a parsed `input.document`. It uses the
same schema, preset expansion, output preflight, and execution functions as
the namespaced CLI. Set top-level `dryRun: true` for a plan without mutation.

Dry-run validates schema, output contracts, and statically knowable step
transitions only. It does not execute FFmpeg or prove input-specific codec,
filter, timing, or intermediate-media compatibility. A dry-run response is
`status: "planned"` and never authorizes announcing an artifact.

```bash
printf '%s\n' '{"context":"codex","input":{"action":"validate","file":"pipeline.yaml"}}' \
  | node skills/ffmpeg-pipelines/scripts/run.mjs
```

## Preferred toolkit commands

Validate a file:

```bash
cecilia-ffmpeg pipeline pipeline.yaml validate
```

Print the normalized plan:

```bash
cecilia-ffmpeg pipeline pipeline.yaml print
```

Validate and plan immediately before execution:

```bash
cecilia-ffmpeg pipeline pipeline.yaml run --dry-run
```

Execute:

```bash
cecilia-ffmpeg pipeline pipeline.yaml run
```

Agent-readable result:

```bash
cecilia-ffmpeg pipeline pipeline.yaml run --json
```

Preserve intermediate artifacts for debugging:

```bash
cecilia-ffmpeg pipeline pipeline.yaml run --keep-temp
```

Inline pipelines use the same typed schema and step ordering without a YAML
file:

```bash
cecilia-ffmpeg pipeline \
  --step trim --input example.mp4 --trim-start 2 --output example.trim.mp4 \
  --step convert --input example.trim.mp4 --to webm --output example.webm \
  run
```

Without a global install:

```bash
npm exec --yes --package=@cecilialabs/ffmpeg -- cecilia-ffmpeg pipeline pipeline.yaml run
```

## Native FFmpeg fallback

Use native FFmpeg only when the declarative schema lacks the required capability. Do not translate a valid toolkit pipeline into an arbitrary shell command merely because FFmpeg can perform the same operations.

If fallback is required, explain which pipeline limitation forced the fallback and keep shell interpolation out of generated commands.

## Output expectations

A valid pipeline must produce or plan:

- one resolved source;
- one final destination;
- an expanded executable step sequence;
- deterministic intermediate ordering;
- structured per-step warnings/details;
- final FFprobe media information after actual execution.

Relative media paths are relative to the pipeline file directory. Intermediate artifacts are isolated and cleaned automatically unless `--keep-temp` / `keep_temp=true` is explicit.

## Validation

After authoring a pipeline:

1. use `pipeline <file> validate` for schema and output-contract validation;
2. use `pipeline <file> print` to inspect the expanded normalized plan;
3. run `pipeline <file> run --dry-run` when practical;
4. confirm preset expansion order;
5. verify final extension and declared codec agree;
6. after execution, inspect the final structured report or FFprobe metadata;
7. verify hardware-aware steps resolved the intended backend when hardware was requested.

## Error recovery

For schema errors, fix the reported field path rather than loosening validation.

For missing presets, either define the preset or replace the reference with concrete steps.

For preset cycles, break the recursive reference chain.

For final-output conflicts, align `output.path`, `output.codec`, and the final `convert.to` or `resize.to`.

For media-domain failures, inspect the failing step's structured details and retry only after correcting that specific operation.

## Safety and determinism

- Never hide shell commands inside the YAML document.
- Never overwrite final output unless overwrite is explicit.
- Preserve declared step order.
- Do not silently remove steps when a preset expands.
- Treat pipeline dry-run as planning/validation only; it does not fabricate intermediate media.
- Keep temporary artifacts only when explicitly requested.
- Preserve the shared toolkit process boundary; pipeline execution must reuse typed domain functions.

## References

See [references/pipeline-schema.md](references/pipeline-schema.md).
