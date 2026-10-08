# Platform & Runtime Support Policy

## 1. Node.js

### Minimum

```text
Node.js >= 22.0.0
```

### Test policy

- Node.js 22 LTS: compatibility line.
- Node.js 24 LTS: primary/recommended line for development and releases.
- Node.js 26 Current: forward-compatibility CI while it remains Current.

As of 2026-09-18, Node.js 24 and 22 are LTS lines and Node.js 26 is Current.

## 2. FFmpeg

### Minimum supported family

```text
FFmpeg >= 6.1
FFprobe from the same installation/family
```

### Recommended

Use a currently maintained FFmpeg release. As of 2026-09-18, FFmpeg 9.0.1 is the latest stable release listed by the FFmpeg project.

### Compatibility test matrix

The project should exercise representative tests against:

- 6.1.x — minimum compatibility boundary;
- 7.1.x — compatibility line;
- 8.1.x — compatibility line;
- 9.x — primary/current line.

Specific filters, encoders and hardware acceleration are **build capabilities**, not assumptions derived only from version. Commands must query capabilities and fail with `E_CAPABILITY_*` when required functionality is missing.

## 3. Operating systems

| Platform | v0.x tier | v1.0 target | Notes |
|---|---|---|---|
| Linux x64 | Tier 1 | Tier 1 | Primary development target |
| Linux arm64 | Tier 1 | Tier 1 | No architecture-specific shell assumptions |
| macOS arm64 | Tier 2 | Tier 1 | VideoToolbox capabilities vary |
| macOS x64 | Tier 2 | Tier 1 | Best-effort until CI coverage is complete |
| Windows x64 | Tier 2 | Tier 1 | Must run without Bash/Unix path assumptions |
| Windows arm64 | Experimental | Tier 2 | Depends on Node/FFmpeg distribution availability |

## 4. Platform-neutral rules

- Use Node filesystem/path APIs.
- Do not invoke `bash`, `awk`, `find`, `rm`, `touch`, `sed`, or `eval` for core behavior.
- Use argument arrays with shell disabled.
- Device capture is platform-specific and must live behind capture adapters.
- Package-manager installation is platform-specific and requires explicit user authorization.

## 5. External binaries

Core dependency:

```text
ffmpeg
ffprobe
```

Additional binaries such as `webpmux` are **not** mandatory dependencies. Operations should prefer FFmpeg-native functionality when equivalent and robust; otherwise they must declare an optional capability/dependency explicitly.
