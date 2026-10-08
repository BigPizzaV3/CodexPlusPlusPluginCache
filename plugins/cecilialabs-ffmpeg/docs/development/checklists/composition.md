# Milestone 7 Checklist — Composition & Filter Graph Engine

**Version:** `0.5.0`

- [x] Add reusable `FilterGraphBuilder`.
- [x] Centralize video normalization for composition.
- [x] Normalize resolution, FPS, pixel format, timebase, and timestamps.
- [x] Implement `compose concat <inputs...>`.
- [x] Implement plain normalized concat.
- [x] Implement N-input `xfade` transition chains.
- [x] Compute cumulative xfade offsets from probed durations.
- [x] Implement audio `concat` / `acrossfade` policies.
- [x] Implement `compose transition <left> <right>`.
- [x] Implement portable built-in FFmpeg transition set.
- [x] Implement `compose slideshow <directory>` vertical-stack workflow.
- [x] Preserve legacy vertical-stack attribution in `legacy/`.
- [x] Remove `eval`/shell-string composition from migrated workflows.
- [x] Add CLI options and action registry bindings.
- [x] Add structured composition report schema.
- [x] Add unit, CLI, and integration test sources.
- [x] Add `verify:composition`.
- [x] Add docs and legacy migration guide.
- [x] Apply Milestone 6 `exactOptionalPropertyTypes` tuning fix.
- [x] Fix verifier-script Node globals for ESLint.
- [x] Remove unused `encodingArgs` import from `audio/attach.ts`.
- [x] Remove unused `path` import from `video/trim.ts`.
- [x] Avoid `no-control-regex` failure in ANSI stripping.
- [x] Remove obsolete unused path imports from `verify-foundation.mjs`.
- [x] Remove unnecessary quote escapes from `verify-conversion.mjs`.
- [x] Real FFmpeg smoke validation across mismatched resolution/FPS inputs.

- [x] Record validation output.
