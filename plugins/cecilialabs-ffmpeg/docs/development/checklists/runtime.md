# Milestone 2 Checklist — FFmpeg Core Runtime

**Version:** `0.1.0-alpha.2`  
**Status:** Complete

## Deliverables

- [x] Binary discovery.
- [x] Explicit binary override.
- [x] `FFMPEG_PATH` / `FFPROBE_PATH` environment overrides.
- [x] FFmpeg execution.
- [x] FFprobe execution.
- [x] Safe argument-array execution.
- [x] `shell: false` enforced.
- [x] No `eval`.
- [x] No `exec`/`execFile`.
- [x] Exit-code handling.
- [x] Signal handling.
- [x] stdout capture.
- [x] stderr capture.
- [x] Bounded capture buffers with truncation markers.
- [x] Structured execution result.
- [x] Temporary-file/workspace management.
- [x] Path traversal protection for temporary workspace.
- [x] Core `--dry-run` behavior.
- [x] JSON execution schema updated.
- [x] AbortSignal cancellation support.
- [x] SIGINT/SIGTERM → grace → SIGKILL termination strategy.
- [x] Execution timing.
- [x] Verbose command rendering.
- [x] Incremental FFmpeg progress parser.
- [x] Binary-version parser foundation.
- [x] Typed runtime error mapping.
- [x] Core runtime exported from package API.
- [x] Unit/integration test sources created.
- [x] Dependency-free runtime verifier created.
- [x] ADR documenting native `spawn` boundary.
- [x] Strict TypeScript compilation of core passed.
- [x] Real FFmpeg/FFprobe smoke execution passed.

## Runtime boundary invariant

Only this production module may execute child processes:

```text
src/core/command-result.ts
```

All domain code must route through:

```text
runFFmpeg()
runFFprobe()
```

## Deferred intentionally

The following remain Milestone 3 concerns:

- user-facing `doctor` implementation;
- user-facing `probe` implementation;
- FFmpeg minimum-version enforcement;
- encoder/decoder/filter enumeration;
- hardware-acceleration discovery;
- normalized media metadata objects.
