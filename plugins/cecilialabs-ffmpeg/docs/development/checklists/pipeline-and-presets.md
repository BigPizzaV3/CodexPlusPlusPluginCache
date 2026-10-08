# Pipeline & Preset System — Completion Checklist

**Target:** `v1.3.0`  
**Status:** ✅ Released 2026-09-20

## Schema and parser

- [x] YAML pipeline v1 schema.
- [x] Direct runtime YAML parser dependency.
- [x] Relative pipeline-file path semantics.
- [x] Typed public pipeline contracts.
- [x] Structured YAML/schema errors.

## Execution

- [x] Trim steps.
- [x] Speed steps.
- [x] Resize steps.
- [x] General normalization.
- [x] Roadmap-compatible `audio.normalize`.
- [x] Conversion steps.
- [x] Real sequential intermediate artifacts.
- [x] Isolated temporary workspace.
- [x] `--keep-temp` support.
- [x] Pipeline-level dry-run.
- [x] Aggregated structured warnings and final media probe.

## Presets and validation

- [x] Local named presets.
- [x] Nested presets.
- [x] Missing-preset rejection.
- [x] Preset cycle detection.
- [x] Output codec/extension validation.
- [x] Final convert/resize target validation.
- [x] Final FFprobe codec assertion validation.
- [x] Reject final-output/original-input collisions.
- [x] Bound preset nesting to 32 levels.
- [x] Bound expanded pipelines to 256 concrete steps.

## Public surfaces

- [x] Package API.
- [x] `cecilia-ffmpeg pipeline <file> <validate|print|run>`.
- [x] Inline `cecilia-ffmpeg pipeline --step ... run` parsing.
- [x] Human output.
- [x] JSON output through stable CLI envelope.
- [x] Dedicated `ffmpeg-pipelines` Skill.
- [x] Skill catalog updated to 8 Skills.
- [x] Public pipeline documentation.

## Architecture

- [x] Reuse typed media domains.
- [x] No pipeline child-process boundary.
- [x] Existing transactional output safety preserved per step.
- [x] Hardware-aware resize/conversion reuse v1.2 selector.
- [x] Eager output preflight before expensive local file-producing work.
- [x] Common CLI explicit-output hook plus domain-level default-output protection.
- [x] Batch planned-output preflight before workers start.

## Validation

- [x] Pipeline unit test sources.
- [x] Pipeline FFmpeg integration test sources.
- [x] `verify:pipeline`.
- [x] `verify:output-preflight`.
- [x] Pipeline layers wired into test-suite verification.
- [x] Run `npm run verify:pipeline`.
- [x] Run `npm run check`.
- [x] Run `npm run test`.
- [x] Run `npm run validate`.
- [x] Run `npm run validate:release`.
- [x] Run a real CLI pipeline smoke test through `scripts/smoke-release.mjs`.
