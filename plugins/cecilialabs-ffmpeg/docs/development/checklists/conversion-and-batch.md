# Milestone 6 Checklist — Media Conversion & Batch Engine

**Target:** `v0.4.0`  
**Status:** ✅ Complete

## Single-file conversion

- [x] Real `convert file <input>` CLI action.
- [x] Explicit `--to` target format.
- [x] Optional `--from` source assertion.
- [x] FFprobe preflight before conversion.
- [x] Transactional temporary output and final promotion.
- [x] Final FFprobe output validation.
- [x] `--dry-run` plans inspect the source but do not execute FFmpeg.
- [x] Structured human and JSON reports.
- [x] Audio-drop warnings for GIF, animated WebP, and PNG targets.

## Initial conversion matrix

- [x] MP4 → WebM.
- [x] MP4 → GIF.
- [x] MP4 → animated WebP.
- [x] WebM → GIF.
- [x] WebP → PNG.
- [x] GIF → WebM.
- [x] Legacy `convert-all-gif-in-folder-to-webm.sh` semantics corrected to produce WebM instead of another GIF.
- [x] Animated WebP no longer depends on external `webpmux`.

## Generic batch engine

- [x] Extension/format filtering.
- [x] Optional recursive traversal.
- [x] Repeatable include patterns.
- [x] Repeatable exclude patterns.
- [x] Deterministic discovery ordering.
- [x] Configurable parallelism (`1..32`).
- [x] Continue-on-error default behavior.
- [x] Explicit fail-fast mode.
- [x] Configurable output directory.
- [x] Hierarchy preservation by default.
- [x] Flattened output mode.
- [x] Output-collision detection before execution.
- [x] Existing-output strategies: `error`, `skip`, `replace`.
- [x] Progress callback and human CLI progress.
- [x] Summary counts: discovered, attempted, succeeded, failed, skipped.
- [x] Stable JSON report.
- [x] Partial-failure exit code `7` while preserving the batch report.
- [x] Empty selections fail with `E_BATCH_EMPTY_SELECTION`.

## Quality controls

- [x] Generic conversion profile layer; no per-format Bash loops.
- [x] Glob matcher supports `*`, `?`, and `**` without adding an npm dependency.
- [x] GIF palette generation is performed inline inside FFmpeg.
- [x] WebM defaults to VP9 + Opus when audio is present.
- [x] WebP → PNG intentionally selects the first frame.
- [x] Typed source, target, batch, progress, item, and report contracts.
- [x] Conversion JSON schemas added.
- [x] Unit test sources for profiles and glob matching.
- [x] Unit test source for batch discovery.
- [x] CLI option tests.
- [x] Real-media integration test source for all six conversion routes.
- [x] Real-media integration test source for recursive batch + existing-output skip.
- [x] Dependency-free `verify:conversion` smoke verifier.
- [x] Strict TypeScript source and test trees checked in the assembly environment using temporary dependency interface shims.
- [x] Real FFmpeg/FFprobe smoke validation completed for all six conversion routes and generic batch execution.

## Validation limitation

- [ ] `npm test` executed in the assembly environment.

The npm registry was not reachable from the assembly environment, so the real Vitest runtime could not be installed there. The complete test sources are included and type-check successfully; run `npm test` in the consumer/development environment where dependencies are available.
