# Hardware Acceleration Architecture

Milestone 17 adds a typed hardware-encoder policy without creating a second FFmpeg execution path.

## Architecture

```text
CLI / Skill scripts / package API
        |
        v
hardware policy
software | auto | explicit backend
        |
        v
FFmpeg capability inspection
        |
        v
codec/backend compatibility mapping
        |
        v
runtime encoder probe
        |
        +--> usable ----> hardware encoder plan
        |
        +--> unusable --> next candidate / software fallback
                               |
                               v
                       existing runFFmpeg()
```

The invariant remains unchanged: only the existing core runtime executes FFmpeg processes.

## Supported encoder mappings

H.264:

- software: `libx264`
- NVIDIA: `h264_nvenc`
- Intel Quick Sync: `h264_qsv`
- VAAPI: `h264_vaapi`
- VideoToolbox: `h264_videotoolbox`

VP9:

- software: `libvpx-vp9`
- Intel Quick Sync: `vp9_qsv`
- VAAPI: `vp9_vaapi`

Unsupported backend/codec pairs are eliminated before runtime probing.

## Selection semantics

`software` is the compatibility default and preserves the v1.0/v1.1 behavior.

`auto` applies platform-aware candidate ordering. Explicit backends inspect only the requested backend.

For non-dry-run execution, a tiny FFmpeg encode is used as the runtime usability probe. A compiled encoder is not considered usable until that probe succeeds.

When no hardware candidate succeeds:

- normal mode emits `W_HARDWARE_SOFTWARE_FALLBACK` and selects software;
- strict mode raises `E_CAPABILITY_ENCODER_MISSING`.

Dry-run never executes the hardware probe. If a compiled encoder is selected for planning it emits `W_HARDWARE_DRY_RUN_UNVERIFIED`.

## Backend-specific planning

VAAPI requires an explicit device or a discovered Linux `/dev/dri/renderD*` node and appends `format=nv12,hwupload` to the filter chain.

Quick Sync uses NV12-compatible output filtering and backend-specific quality controls.

NVENC and VideoToolbox use backend-specific encoder options while preserving the existing audio/container policy.

## Decode capability metadata

Environment inspection now reports decoder-family metadata alongside encoders, including NVDEC/CUVID discovery.

v1.2 does not automatically inject hardware decoders into arbitrary filter graphs. Doing so safely requires explicit hardware-frame upload/download negotiation and filter compatibility checks; capability discovery is separated from encode-path selection.

## Public surfaces

Hardware policy is available through:

- TypeScript `HardwareRuntimeOptions`;
- `convert file`;
- `convert batch`;
- `video from-image`;
- `video upscale` / `video restore`;

## Validation

```bash
npm run verify:hardware
npm test
npm run validate
npm run validate:release
```

Tests cover backend/codec mapping, platform preference order, backend-specific argument construction, typed conversion-plan integration, actual FFmpeg capability discovery, and deterministic fallback planning.
