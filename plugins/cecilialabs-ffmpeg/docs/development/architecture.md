# Architecture Specification

## 1. Product identity

| Concern | Decision |
|---|---|
| Product name | **FFmpeg Media Toolkit** |
| Plugin identifier | `ffmpeg-media-toolkit` |
| npm package | `@cecilialabs/ffmpeg` |
| Executable | `cecilia-ffmpeg` |
| Language | TypeScript |
| Runtime | Node.js |
| Media binaries | FFmpeg + FFprobe |
| Initial package model | Single npm package with internal modules |
| Agent execution | Skill-associated scripts and canonical CLI over the same core/domain library |

The npm scope assumes the Cecília Labs scope is available/owned at publication time. If registry ownership differs, only the distribution package name changes; CLI semantics and internal architecture remain stable.

## 2. Architectural layers

```text
┌─────────────────────────────────────────────┐
│ Interaction layer                           │
│ CLI / Skill scripts / package API          │
└──────────────────────┬──────────────────────┘
                       │
┌──────────────────────▼──────────────────────┐
│ Domain operations                           │
│ video / audio / conversion / composition   │
│ diagnostics / repair / streaming           │
└──────────────────────┬──────────────────────┘
                       │
┌──────────────────────▼──────────────────────┐
│ FFmpeg model                                │
│ arguments / codecs / filters / graphs      │
└──────────────────────┬──────────────────────┘
                       │
┌──────────────────────▼──────────────────────┐
│ Core runtime                                │
│ runner / probe / capabilities / progress   │
│ errors / cancellation / temporary files    │
└──────────────────────┬──────────────────────┘
                       │
             ┌─────────▼─────────┐
             │ ffmpeg / ffprobe  │
             └───────────────────┘
```

## 3. Non-negotiable invariants

1. **No `eval`.**
2. **No shell command construction for normal execution.**
3. FFmpeg/FFprobe receive a binary path plus `string[]` arguments.
4. Paths with whitespace or shell metacharacters must work without manual quoting.
5. Domain operations do not spawn processes directly.
6. CLI and Skill-associated scripts call the same domain functions.
7. Complex operations inspect inputs with FFprobe when stream properties affect correctness.
8. Machine-readable output has a stable envelope and is never mixed with decorated human text.
9. Output files are not silently overwritten.
10. Batch behavior is deterministic and produces an aggregate report.

## 4. Repository topology

The original foundation target has since grown into the current layout:

```text
ffmpeg-media-toolkit/
├── plugin.json
├── package.json
├── tsconfig.json
├── README.md
├── LICENSE
├── assets/
├── docs/
├── skills/
│   ├── ffmpeg-onboarding/
│   ├── ffmpeg-workflow/
│   ├── ffmpeg-environment/
│   ├── ffmpeg-video-editing/
│   ├── ffmpeg-audio/
│   ├── ffmpeg-conversion/
│   ├── ffmpeg-composition/
│   ├── ffmpeg-streaming/
│   ├── ffmpeg-diagnostics/
│   └── ffmpeg-pipelines/
├── src/
│   ├── cli.ts
│   ├── core/
│   ├── commands/
│   ├── domain/
│   ├── ffmpeg/
│   ├── schemas/
│   └── utils/
├── test/
│   ├── fixtures/
│   ├── unit/
│   └── integration/
└── specs/
```

## 5. Domain boundaries

### Environment

Binary discovery, installation guidance/automation, version checking, codec/filter/hardware capabilities.

### Video

Temporal editing, speed, image-to-video, scaling/restoration, video-only transformations.

### Audio

Audio attachment/replacement, silence generation/detection/removal, telephony codecs and channel/sample-rate transformations.

### Conversion

Single-file and batch container/codec/image animation conversion.

### Composition

Multi-input concat, transitions, slideshows and reusable filter-graph composition.

### Diagnostics & repair

FFprobe inspection, timebase/PTS/DTS/FPS problems, stream mapping, normalization and recoverable media defects.

### Streaming

Capture source, encoding, muxing, transport and destination are modeled independently.

## 6. Plugin packaging direction

The portable plugin uses a root `plugin.json` and a root `skills/` directory. Skills are grouped by user intent, not one skill per legacy script. Agent execution is provided by associated scripts and the canonical CLI.

## 7. Extension rule

A new operation should require only:

1. domain input/options type;
2. operation implementation producing one or more typed invocations;
3. CLI registration/adapter;
4. tests and documentation;
5. relevant Skill/reference update.

It must **not** require modifications to process spawning, JSON envelope semantics, common logging, global options, cancellation, or temporary-file policy.
