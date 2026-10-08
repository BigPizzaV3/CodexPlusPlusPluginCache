# FFmpeg Media Toolkit

**Release status:** `2.0.0` — release validation complete on `master`; npm
publication and the annotated tag remain pending final registry checks.

FFmpeg Media Toolkit is a TypeScript package, CLI, and Skills-based plugin for
deterministic FFmpeg/FFprobe workflows. It keeps media operations typed,
preflighted, transactional, and verifiable on the hosts that can execute
them.

## Architecture

The supported execution path is:

```text
user request
    ↓
execution-context check
    ↓
behavioral Skill
    ↓
domain Skill and associated script
    ↓
cecilia-ffmpeg / typed media runtime
    ↓
FFprobe preflight → FFmpeg execution → artifact verification
    ↓
structured result or guided recovery
```

The canonical CLI and the JSON-in/JSON-out Skill scripts use the same typed
domain functions and core process boundary. A host that cannot execute local
files receives a reproducible plan; it is never told that media was processed
without an observed, verified result.

## Identity and requirements

- **Plugin:** `cecilialabs-ffmpeg`
- **npm package:** `@cecilialabs/ffmpeg`
- **CLI:** `cecilia-ffmpeg`
- **Node.js:** `>=22`
- **FFmpeg/FFprobe:** `6.1` or newer
- **License:** MIT

FFmpeg builds differ in their codecs, filters, and hardware backends. Use the
toolkit's environment checks for the capability needed by the workflow instead
of treating an installed binary as proof that every encoder is usable.

## Documentation

These are the authoritative user and agent guides:

- [Getting started](docs/getting-started.md) — first check and first pipeline.
- [Installation](docs/installation.md) — global, local, and package-runner setup.
- [Agent workflows](docs/agent-workflows.md) — context, routing, scripts, CLI fallback, and result verification.
- [CLI reference](docs/cli-reference.md) — commands, options, and output behavior.
- [Declarative pipelines](docs/pipelines.md) — YAML, presets, dry-runs, and intermediate files.
- [Migration from Bash](docs/migration-from-bash.md) — semantic mapping for the 21 historical scripts.
- [Skill request examples](docs/skill-request-examples.md) — copy/paste JSON requests.

Domain guides cover [video](docs/video.md), [image](docs/image.md),
[audio](docs/audio.md), [conversion](docs/conversion.md),
[composition](docs/composition.md), [streaming](docs/streaming.md),
[diagnostics and repair](docs/diagnostics.md), [batch processing](docs/batch-processing.md),
[hardware acceleration](docs/hardware-acceleration.md), and
[platform support](docs/platform-support.md).

The [documentation index](docs/README.md) and
[development notes](docs/development/README.md) provide the complete map.

## Install and run

Recommended public installation:

```bash
npm install -g @cecilialabs/ffmpeg
cecilia-ffmpeg doctor
```

Without a global installation, name the executable explicitly:

```bash
npm exec --yes --package=@cecilialabs/ffmpeg -- cecilia-ffmpeg doctor
```

For a development checkout:

```bash
npm install
npm run setup:cli
cecilia-ffmpeg --help
```

`setup:cli` builds and links the checkout. It asks before changing shell
configuration and never installs system FFmpeg packages. See
[Installation](docs/installation.md) for the complete flow.

## Execution surface order

Use the highest-level surface available for the requested action:

```text
associated Skill script
        ↓ unavailable or unsupported action
global cecilia-ffmpeg
        ↓ unavailable
npm exec --yes --package=@cecilialabs/ffmpeg -- cecilia-ffmpeg ...
        ↓ toolkit capability is insufficient or native syntax is requested
native FFmpeg / FFprobe
```

Operational scripts accept one JSON request on stdin and emit one structured
result envelope on stdout. The request context controls whether the operation
may inspect files, execute scripts, install dependencies, or write media.

## CLI at a glance

The stable grammar includes:

```text
cecilia-ffmpeg doctor
cecilia-ffmpeg probe <input>
cecilia-ffmpeg environment <check|install|version|capabilities>
cecilia-ffmpeg video <action> ...
cecilia-ffmpeg audio <action> ...
cecilia-ffmpeg image <action> ...
cecilia-ffmpeg convert <file|batch> ...
cecilia-ffmpeg compose <concat|transition|slideshow> ...
cecilia-ffmpeg diagnose <input>
cecilia-ffmpeg repair <timestamps|normalize> <input>
cecilia-ffmpeg stream <camera|file> ...
cecilia-ffmpeg pipeline <file> <validate|print|run>
```

The complete command surface and global options are in the [CLI reference](docs/cli-reference.md).
Pipeline execution is namespaced under `pipeline`; there is no separate
top-level pipeline command.

## Safe media behavior

File-producing operations share these rules:

- FFprobe input inspection when stream properties affect correctness;
- destination and input/output collision checks before expensive work;
- no implicit overwrite;
- sibling temporary files and transactional finalization;
- structured warnings and error codes;
- FFprobe verification of the final artifact.

Use `--dry-run` to inspect a plan without running a mutating FFmpeg operation.
A dry-run or planned response is not a completed artifact. Use `--json` when a
caller needs one machine-readable result document on stdout; human progress
and diagnostics stay on stderr.

## Pipelines

```bash
cecilia-ffmpeg pipeline pipeline.yaml validate
cecilia-ffmpeg pipeline pipeline.yaml print
cecilia-ffmpeg pipeline pipeline.yaml run --dry-run
cecilia-ffmpeg pipeline pipeline.yaml run
```

Pipeline files validate against the v1 schema, expand local presets, resolve
relative paths from the pipeline file, preflight the final output, and execute
typed domain steps in order. Intermediate files are isolated and removed
unless `--keep-temp` is explicit. See [Declarative pipelines](docs/pipelines.md).

## Skills

The plugin ships ten Skills:

```text
ffmpeg-onboarding       environment and installation readiness
ffmpeg-workflow         natural-language routing and verified outcomes
ffmpeg-environment      versions, capabilities, and media inspection
ffmpeg-video-editing    trim, speed, image-to-video, and resize
ffmpeg-audio            tracks, silence, and telephony
ffmpeg-conversion       single-file and batch conversion
ffmpeg-composition      concat, transitions, and slideshows
ffmpeg-streaming        camera capture and network delivery
ffmpeg-diagnostics      diagnosis and observation-driven repair
ffmpeg-pipelines        YAML pipelines and reusable presets
```

See the [Skill catalog](docs/skill-catalog.md) for the activation boundaries,
associated scripts, references, and request examples. The [agent workflow
guide](docs/agent-workflows.md) explains how these Skills cooperate across
regular Chat, Work, Codex, IDE, and terminal contexts.

## Package and plugin distribution

The npm package contains the compiled CLI and library, Skills, documentation,
schemas, plugin metadata, and branding assets. Repository-only test, setup,
validation, and release helpers are not shipped in the tarball.

Check the package and manifest with:

```bash
npm run verify:plugin
npm run build
npm run verify:package
```

## Development validation

Install dependencies before running the repository checks:

```bash
npm install
```

The milestone gate is:

```bash
npm run validate
```

The publication-quality v2 gate is:

```bash
npm run validate:release
```

It adds the v2 release contract, clean npm tarball installation, package
inspection, and real environment/media/CLI/Skill smoke flows. A passing local
gate is evidence for this checkout only; it does not publish the package.

It starts with `verify:foundation`, which protects package identity, strict
TypeScript configuration, global CLI options, required repository files, and
the single process-execution boundary. It then runs the runtime, CLI, Skill,
documentation, distribution, typecheck, lint, test, build, and package gates.

Useful focused checks are:

```bash
npm run verify:foundation
npm run verify:docs
npm run verify:agent-workflows
npm run verify:skills
npm run verify:skill-scripts
npm run check
npm test
```

Current runtime capability checks and media fixtures are host-dependent. A
passing static or TypeScript check does not, by itself, prove that a particular
codec, hardware device, or media artifact works on another host.

## Project history and roadmap

The [roadmap](ROADMAP.md) records the agent-first migration and the remaining
release gate. The [changelog](CHANGELOG.md) separates current guidance from
historical release notes. Development notes retain durable architecture,
compatibility, and migration decisions; generated validation transcripts are
not treated as current execution instructions.
