# Milestone 3 Checklist — Doctor, Capabilities & Media Probe

**Version:** `0.1.0-alpha.3`  
**Status:** Complete

## Environment inspection

- [x] `environment version` implemented.
- [x] FFmpeg path resolved through the Milestone 2 binary resolver.
- [x] FFprobe path resolved through the Milestone 2 binary resolver.
- [x] FFmpeg version normalized into a typed structure.
- [x] FFprobe version normalized into a typed structure.
- [x] Minimum supported FFmpeg boundary (`>= 6.1`) evaluated.
- [x] FFmpeg/FFprobe major/minor mismatch warning implemented.
- [x] `--dry-run` supported without spawning FFmpeg/FFprobe.

## Capabilities

- [x] `environment capabilities` implemented.
- [x] Codec enumeration and parsing.
- [x] Encoder enumeration and parsing.
- [x] Decoder enumeration and parsing.
- [x] Filter enumeration and parsing.
- [x] Hardware acceleration method enumeration.
- [x] NVENC compile/report detection.
- [x] VAAPI compile/report detection.
- [x] Intel QSV compile/report detection.
- [x] VideoToolbox compile/report detection.
- [x] CUDA/Vulkan/OpenCL method summaries.
- [x] Explicit distinction between compiled/reported support and actual device usability.
- [x] Full machine-readable capability objects available through `--json`.

## Doctor

- [x] `doctor` implemented.
- [x] Platform detection.
- [x] CPU architecture detection.
- [x] Node.js version reporting.
- [x] FFmpeg/FFprobe versions and paths included.
- [x] Capability counts included.
- [x] Hardware method/backend summary included.
- [x] Health status: `ok`, `warning`, `error`, or `planned`.
- [x] Unsupported FFmpeg produces environment exit status while retaining diagnostic data.

## Media probe

- [x] `probe <input>` implemented.
- [x] Input existence validation.
- [x] Regular-file validation.
- [x] Readability validation.
- [x] FFprobe invoked using structured argument arrays.
- [x] Canonical FFprobe JSON requested with `-show_format -show_streams`.
- [x] 16 MiB bounded JSON capture.
- [x] Invalid/truncated FFprobe JSON mapped to `E_PROBE_FAILED`.
- [x] Format metadata normalized.
- [x] Video streams normalized.
- [x] Audio streams normalized.
- [x] Subtitle/data/attachment/unknown streams retained.
- [x] Numeric FFprobe strings normalized to numbers when appropriate.
- [x] `MediaInfo` discriminated stream union tightened.
- [x] `specs/media-info.schema.json` added.
- [x] Probe `--dry-run` emits an invocation plan without executing FFprobe.

## CLI integration

- [x] Milestone-aware command action registry added.
- [x] Milestone 3 leaves replaced with real handlers.
- [x] Future milestone leaves remain safe placeholders.
- [x] Human-readable output implemented.
- [x] Stable JSON result envelopes preserved.
- [x] Runtime errors mapped through the shared typed error layer.
- [x] SIGINT/SIGTERM bridge used by implemented CLI actions.
- [x] `environment check` reports execution context, package/runtime readiness, and capabilities without mutation.
- [x] `environment install` requires explicit `--apply --authorize` and never mutates shell startup state; system FFmpeg package installation remains outside scope.

## Validation

- [x] New core/environment/media TypeScript sources pass strict compilation.
- [x] Full production source passes strict compilation against dependency interface shims in the assembly environment.
- [x] Real FFmpeg version inspection passed.
- [x] Real FFprobe version inspection passed.
- [x] Real codec/encoder/decoder/filter enumeration passed.
- [x] Real hardware acceleration enumeration passed.
- [x] Real doctor inspection passed.
- [x] Real audiovisual fixture generation passed.
- [x] Real FFprobe normalization of video + audio passed.
- [x] Dependency-free `verify:inspection` script added and passed.
- [x] Unit/integration test sources added for Vitest.

## Deferred intentionally

The following remain later-milestone concerns:

- mutating video operations — Milestone 4;
- audio processing — Milestone 5;
- conversion/batch — Milestone 6;
- composition/filter graphs — Milestone 7;
- diagnostics/repair — Milestone 8;
- streaming/capture — Milestone 9;
- automatic system package installation remains reserved pending an explicit cross-platform policy.


## Consolidated compatibility fixes

- [x] Parse FFmpeg 8.x two-character filter capability columns (`TS`, `..`, `.S`, `T.`).
- [x] Retain compatibility with three-character filter capability columns from older FFmpeg releases.
- [x] Ignore filter legend rows such as `T.. = Timeline support`.
- [x] Strip ANSI escape sequences before capability parsing.
- [x] Parse capability output from stdout and stderr.
- [x] Fix `Buffer<ArrayBuffer>` / `Buffer<ArrayBufferLike>` TypeScript incompatibility in `TailCapture`.
- [x] Add FFmpeg 8.0.1 regression fixture.
