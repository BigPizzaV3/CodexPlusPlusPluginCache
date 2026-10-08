# Getting Started

**Cecil-IA Labs · FFmpeg Media Toolkit**

FFmpeg Media Toolkit exposes deterministic FFmpeg/FFprobe workflows through a
typed TypeScript package, the `cecilia-ffmpeg` CLI, and portable
Skill-associated scripts.

If an assistant is choosing between a plan, a script, and the CLI, start with
[Agent workflows](agent-workflows.md). This page is the shortest path from an
installed toolkit to a first verified operation.

## Requirements

- Node.js 22+
- FFmpeg 6.1+
- FFprobe available alongside FFmpeg

Recommended runtime:

- Node.js 24 LTS
- a recent FFmpeg build with the encoders/filters required by your workflow

## Choose how to run the CLI

Recommended global installation:

```bash
npm install -g @cecilialabs/ffmpeg
cecilia-ffmpeg doctor
```

Run without installing globally by naming the CLI binary explicitly:

```bash
npm exec --yes --package=@cecilialabs/ffmpeg -- cecilia-ffmpeg doctor
```

All examples below assume the recommended global installation.

Development checkout:

```bash
npm install
npm run setup:cli
cecilia-ffmpeg doctor
```

`setup:cli` builds and links the local checkout. It only offers to update `~/.bashrc` when the npm global bin directory is not already in `PATH`, and it always asks before changing the shell configuration.

## First checks

```bash
cecilia-ffmpeg environment check --json
cecilia-ffmpeg doctor
cecilia-ffmpeg environment version --json
cecilia-ffmpeg probe ./media/input.mp4 --json
```

Agents that can execute scripts may use the onboarding Skill directly from a
built checkout or installed package:

```bash
npm run build
printf '%s\n' '{"context":"codex","input":{}}' | node skills/ffmpeg-onboarding/scripts/check.mjs
```

Regular Chat cannot inspect the local host. In that context, copy the printed
check command to a Work/Codex/IDE/terminal environment and return its JSON
result before claiming that the runtime or a media file is ready.

Use `doctor` before codec/filter-sensitive work. Use `probe` before transforms
where stream presence, duration, dimensions, FPS, or timestamps matter. A
successful check reports readiness; it does not prove that a future media
operation will succeed until that operation's output is verified.

## First pipeline

Create `pipeline.yaml`:

```yaml
input: ./media/input.mp4
steps:
  - trim:
      start: 2
  - resize:
      width: 1280
      height: 720
output:
  path: ./media/output.mp4
  codec: h264
```

Plan it:

```bash
cecilia-ffmpeg pipeline pipeline.yaml validate
cecilia-ffmpeg pipeline pipeline.yaml print
cecilia-ffmpeg pipeline pipeline.yaml run --dry-run
```

Execute it:

```bash
cecilia-ffmpeg pipeline pipeline.yaml run
```

## Human vs agent output

Human TTY output uses semantic color and icons:

```text
🎬 video upscale
📥 Input: ./clip.mp4
📦 Output: ./clip.upscale-1920x1080.mp4
📐 Resolution: 1920x1080
✅ Result: h264, 1920x1080
```

Progress can look like:

```text
🎬 clip.mp4 | ▶️ 67% | 🎞️ 2411 frames | ⚡ 100.0 fps | 🚀 3.70x | ⌛ ETA 00:00:12
```

`--json` always emits a machine-readable result envelope without ANSI decoration or human progress text.

`--no-color`, `NO_COLOR`, and `FORCE_COLOR` control human color output. Non-TTY progress remains plain.

## Safe defaults

- no shell interpolation;
- no implicit overwrite;
- eager output-path preflight before expensive file-producing work;
- transactional file output;
- `--dry-run` for plan inspection;
- FFprobe validation after file-producing operations;
- structured error codes;
- typed progress summaries.

Do not treat a plan or dry-run as a produced file. Report a completed artifact
only after the command or associated script returns success and the final file
passes FFprobe checks.

## Next

- [Installation](installation.md)
- [Agent workflows](agent-workflows.md)
- [CLI Reference](cli-reference.md)
- [Declarative Pipelines & Presets](pipelines.md)
- [Video](video.md)
- [Image](image.md)
- [Audio](audio.md)
- [Conversion](conversion.md)
- [Composition](composition.md)
- [Streaming](streaming.md)
- [Diagnostics](diagnostics.md)
- [Batch Processing](batch-processing.md)
- [Migration from Bash](migration-from-bash.md)
- [Skill request examples](skill-request-examples.md)
