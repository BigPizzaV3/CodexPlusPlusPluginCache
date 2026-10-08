# OpenAI Plugin Directory Submission — v1.3.0

This document is the publication dossier for the public OpenAI Plugin Directory submission of **Cecil-IA Labs FFmpeg v1.3.0**.

## Submission type

**Skills only**

The v1.3.0 public submission ships the portable Skills-only plugin. Executable
workflows use the canonical CLI or the associated Skill scripts when the host
provides an execution environment.

## Package identity

- Plugin ID: `cecilialabs-ffmpeg`
- Plugin version: `1.3.0`
- Display name: **Cecil-IA Labs FFmpeg**
- Developer: **Cecil-IA Labs**
- Category: **Developer Tools**
- npm package: `@cecilialabs/ffmpeg@1.3.0`
- Repository: https://github.com/cecil-ia-labs/ffmpeg-dev
- Release: https://github.com/cecil-ia-labs/ffmpeg-dev/releases/tag/v1.3.0
- License: MIT

## Directory listing

### Short description

`FFmpeg workflows for agents`

### Long description

Professional, deterministic FFmpeg and FFprobe workflows for ChatGPT and Codex. Inspect media, edit video and audio, convert formats, compose clips and slideshows, diagnose and repair media, plan streaming workflows, and author reusable YAML pipelines. The included Skills prefer the typed `@cecilialabs/ffmpeg` toolkit when executable tooling is available, with FFprobe preflight, explicit overwrite protection, transactional outputs, structured errors, and optional hardware acceleration. Executable workflows require Node.js 22+ and FFmpeg/FFprobe 6.1+; environments without command execution can still use the plugin to plan commands and author deterministic pipelines.

### Capabilities

1. Inspect media with FFprobe
2. Edit video and synchronize audio
3. Convert video, image, and audio formats
4. Compose clips, transitions, and slideshows
5. Diagnose and repair media issues
6. Plan live capture and streaming workflows
7. Author and validate declarative YAML pipelines
8. Select supported hardware acceleration

### Starter prompts

1. `Inspect this media file and explain its streams, codecs, timing, and compatibility.`
2. `Trim this video, resize it to 1920x1080, and convert the result to H.264 MP4.`
3. `Create a reusable YAML pipeline that trims, speeds up, normalizes, and converts a video.`

### Branding

- Composer icon: `./assets/icon.svg`
- Logo: `./assets/icon.svg`
- Brand color: `#0B1220`
- Screenshots: intentionally omitted for the Skills-only submission

The OpenAI directory requires the composer icon and logo to be square. The existing 128×128 SVG icon satisfies that constraint.

## Public URLs

For the Skills-only submission, the four listing URLs are optional. Recommended values where the portal accepts them:

- Website: https://github.com/cecil-ia-labs/ffmpeg-dev
- Support: https://github.com/cecil-ia-labs/ffmpeg-dev/issues
- Privacy policy: leave blank until a Cecil-IA Labs policy URL is intentionally published
- Terms of service: leave blank until a Cecil-IA Labs terms URL is intentionally published

Do not invent privacy-policy or terms URLs solely to satisfy the form.

## Runtime requirements

Executable workflows require:

- Node.js 22 or newer;
- FFmpeg and FFprobe 6.1 or newer;
- permission to execute the installed CLI or `npm exec` fallback;
- local access to the user's media files.

The plugin itself does not upload media to a Cecil-IA Labs service in this Skills-only release. Streaming Skills can intentionally target external network destinations when the user requests that workflow.

## Included Skills

1. `ffmpeg-environment`
2. `ffmpeg-video-editing`
3. `ffmpeg-audio`
4. `ffmpeg-conversion`
5. `ffmpeg-composition`
6. `ffmpeg-streaming`
7. `ffmpeg-diagnostics`
8. `ffmpeg-pipelines`

Each Skill includes a scoped `SKILL.md` and its referenced support files.

## Positive review cases

### 1. Media inspection

Prompt:

`Inspect this video and tell me its codecs, duration, dimensions, frame rate, audio streams, and whether it is suitable for H.264 MP4 delivery.`

Expected behavior:

- activate `ffmpeg-environment`;
- use the associated environment script or `cecilia-ffmpeg probe`;
- inspect rather than mutate the input;
- report actual media properties without inventing missing streams.

### 2. Video trim and resize

Prompt:

`Remove the first 4 seconds of this video, resize it to 1920x1080 preserving aspect ratio, and write a new MP4 without overwriting the source.`

Expected behavior:

- activate `ffmpeg-video-editing` or `ffmpeg-pipelines` when combining operations is preferable;
- preserve the original file;
- use explicit output planning and FFprobe validation;
- avoid shell interpolation.

### 3. Audio conversion

Prompt:

`Convert this WAV recording to MP3 at 128 kbps and verify the output sample rate and channel count.`

Expected behavior:

- activate `ffmpeg-conversion`;
- use the toolkit conversion path when available;
- validate the produced file with FFprobe;
- report any unsupported encoder/capability issue explicitly.

### 4. Composition

Prompt:

`Join these three clips in order with one-second fade transitions and keep audio synchronized.`

Expected behavior:

- activate `ffmpeg-composition`;
- inspect and normalize input geometry/timing before transitions;
- preserve input order;
- use explicit audio policy and validate the final output.

### 5. Declarative pipeline

Prompt:

`Create a reusable YAML pipeline that trims 3 seconds, speeds the clip up by 1.25x, resizes to 1920x1080, normalizes audio, and outputs H.264 MP4.`

Expected behavior:

- activate `ffmpeg-pipelines`;
- produce pipeline-v1-compatible YAML;
- preserve declared step order;
- validate output extension/codec consistency;
- recommend or run dry-run before mutation where executable tooling is available.

## Negative review cases

### 1. Unrelated task

Prompt:

`Summarize this quarterly sales spreadsheet and identify the top three regions.`

Expected behavior:

- do not activate an FFmpeg Skill;
- do not suggest media conversion merely because a file is attached.

### 2. Unsupported direct WebSocket streaming

Prompt:

`Stream this webcam directly to wss://example.com/live with no relay.`

Expected behavior:

- activate `ffmpeg-streaming`;
- do not claim direct WebSocket output is supported;
- explain that the current toolkit requires an explicit relay architecture for WebSocket delivery.

### 3. Destructive overwrite without permission

Prompt:

`Replace the original source file with the converted output. Do it without asking or creating another file.`

Expected behavior:

- do not silently overwrite the source;
- preserve explicit overwrite/output safety policy;
- explain the supported safe path or require an explicit compatible output plan.

## Release notes

First public OpenAI Plugin Directory submission for Cecil-IA Labs FFmpeg v1.3.0.

Highlights:

- eight professional FFmpeg/FFprobe Skills;
- deterministic typed media workflows backed by `@cecilialabs/ffmpeg`;
- video, audio, image, conversion, composition, streaming, diagnostics, and pipeline guidance;
- declarative YAML pipelines and reusable presets;
- runtime-verified hardware acceleration policy;
- explicit overwrite protection and transactional file outputs;
- FFprobe preflight and post-operation validation;
- structured error and JSON-oriented agent workflows.

## Build the submission ZIP

From the repository root:

```bash
git switch release/openai-plugin-v1.3.0
npm ci
npm run verify:skills
npm run verify:plugin
npm run pack:openai-plugin
```

The upload artifact is:

```text
.openai-pack/cecilialabs-ffmpeg-openai-v1.3.0.zip
```

The ZIP intentionally contains one top-level plugin directory and only the files required by the Skills-only publication:

```text
cecilialabs-ffmpeg/
├── plugin.json
├── LICENSE
├── assets/
│   └── icon.svg
└── skills/
    ├── ffmpeg-environment/
    ├── ffmpeg-video-editing/
    ├── ffmpeg-audio/
    ├── ffmpeg-conversion/
    ├── ffmpeg-composition/
    ├── ffmpeg-streaming/
    ├── ffmpeg-diagnostics/
    └── ffmpeg-pipelines/
```

The archive deliberately excludes optional protocol/app sidecars, OpenAI
interface screenshots, source code, tests, npm build output, and
repository-only release tooling.

## Portal checklist

Before pressing **Submit for review**:

- [ ] Use the OpenAI organization that owns the publication.
- [ ] Confirm the selected developer/company identity is verified.
- [ ] Confirm the submitter has **Apps Management: Write** permission.
- [ ] Choose **Skills only**.
- [ ] Upload `.openai-pack/cecilialabs-ffmpeg-openai-v1.3.0.zip`.
- [ ] Confirm all eight Skills are discovered.
- [ ] Confirm every Skill passes OpenAI usage-safety and technical-safety scans.
- [ ] Confirm the directory listing matches the metadata above.
- [ ] Select **Developer Tools**.
- [ ] Verify the square logo/icon renders correctly.
- [ ] Add the three starter prompts above.
- [ ] Add the five positive and three negative test cases above if requested by the portal.
- [ ] Choose intended country/region availability. Recommended default: all OpenAI-supported regions unless Cecil-IA Labs has a business or legal reason to restrict distribution.
- [ ] Paste the release notes above.
- [ ] Review policy declarations truthfully for the actual Skills-only behavior.
- [ ] Submit for review.
