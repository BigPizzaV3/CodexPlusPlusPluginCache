# Hardware Acceleration

FFmpeg Media Toolkit v1.2.0 adds typed hardware encoder selection with runtime verification and deterministic software fallback.

## Supported policy

Commands that support accelerated video encoding accept:

```text
--hardware software
--hardware auto
--hardware nvenc
--hardware qsv
--hardware vaapi
--hardware videotoolbox
```

Optional controls:

```text
--hardware-device <path>
--hardware-strict
```

The default remains:

```text
software
```

so existing v1 behavior is preserved unless hardware acceleration is requested explicitly.

## Supported codec/backend mappings

| Target codec | Software | NVENC | Quick Sync | VAAPI | VideoToolbox |
| --- | --- | --- | --- | --- | --- |
| H.264 | `libx264` | `h264_nvenc` | `h264_qsv` | `h264_vaapi` | `h264_videotoolbox` |
| VP9 | `libvpx-vp9` | — | `vp9_qsv` | `vp9_vaapi` | — |

The toolkit rejects or falls back from backend/codec combinations that are not mapped.

## Selection model

`--hardware auto` uses a platform-aware preference order, then validates each candidate:

```text
requested output codec
        ↓
FFmpeg reports compatible encoder?
        ↓
backend-specific device requirements satisfied?
        ↓
runtime probe succeeds?
        ↓ yes
select hardware encoder
        ↓ no
try next candidate
        ↓ none usable
software fallback
```

Current automatic preference order is:

- Linux: NVENC → Quick Sync → VAAPI → VideoToolbox where the target codec supports each backend;
- Windows: NVENC → Quick Sync → VideoToolbox → VAAPI where applicable;
- macOS: VideoToolbox → Quick Sync → NVENC → VAAPI where applicable.

Unsupported codec/backend pairs are skipped before runtime probing.

## Runtime verification

Environment capability discovery is not treated as proof that hardware is usable.

Before an actual accelerated encode, the toolkit executes a small FFmpeg runtime probe with the selected encoder. The probe uses a 256x256 synthetic frame rather than an ultra-small frame because some hardware encoders, including NVENC generations, enforce minimum frame dimensions. This catches common failures such as:

- missing GPU/device;
- missing or incompatible driver;
- inaccessible VAAPI render node;
- an encoder compiled into FFmpeg but unusable on the current machine;
- unsupported runtime device setup.

Successful and failed runtime probes are cached for the current process. Failed attempts retain a short FFmpeg diagnostic in structured hardware metadata so CLI and Skill-script callers can distinguish missing drivers/devices from encoder-parameter failures.

If no requested backend is usable, the default behavior is to fall back to the software encoder and emit:

```text
W_HARDWARE_SOFTWARE_FALLBACK
```

Use `--hardware-strict` when fallback is not acceptable.

## Dry-run behavior

A dry run never executes the mutating encode. Therefore it also does not execute the hardware runtime probe.

If FFmpeg reports a compatible hardware encoder, dry-run may plan that encoder and emit:

```text
W_HARDWARE_DRY_RUN_UNVERIFIED
```

This warning means the encoder is compiled/visible but has not been proven usable on the current device.

## VAAPI devices

On Linux, VAAPI selection attempts to discover the first `/dev/dri/renderD*` render node.

Override it explicitly when necessary:

```bash
cecilia-ffmpeg convert file input.mp4 \
  --to mp4 \
  --hardware vaapi \
  --hardware-device /dev/dri/renderD128
```

## Examples

Automatic H.264 selection:

```bash
cecilia-ffmpeg convert file input.webm \
  --to mp4 \
  --hardware auto
```

Explicit NVIDIA NVENC:

```bash
cecilia-ffmpeg convert file input.webm \
  --to mp4 \
  --hardware nvenc
```

Explicit Quick Sync for VP9:

```bash
cecilia-ffmpeg convert file input.mp4 \
  --to webm \
  --hardware qsv
```

Require hardware instead of falling back:

```bash
cecilia-ffmpeg video upscale input.mp4 \
  --resolution 1920x1080 \
  --hardware auto \
  --hardware-strict
```

The same policy is available to `video from-image`, `video upscale` /
`video restore`, single-file conversion, and batch conversion.

## Capability inspection

Inspect compile-time/runtime-visible capabilities with:

```bash
cecilia-ffmpeg doctor
cecilia-ffmpeg environment capabilities --json
```

Capability metadata includes encoder and decoder families for NVENC/NVDEC/CUVID, Quick Sync, VAAPI, VideoToolbox, CUDA, Vulkan, and OpenCL when reported by FFmpeg.

NVDEC/CUVID is currently surfaced for capability discovery and diagnostics. v1.2 automatic media-path selection concerns output encoding; it does not silently insert hardware decoding into filter graphs because that requires explicit upload/download and filter compatibility negotiation.

## Safety and compatibility

Hardware selection does not change these invariants:

- no implicit overwrite;
- FFprobe preflight where the domain already requires it;
- transactional output;
- post-operation FFprobe validation;
- stable JSON reports;
- the existing shared `runFFmpeg()` process boundary;
- software encoding remains the compatibility default.

The hardware report records requested policy, resolved backend, encoder, runtime-verification state, fallback state, device when applicable, and attempted candidates.
