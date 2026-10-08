# Milestone 8 — Diagnostics & Repair — Checklist

**Target:** `v0.6.0`  
**Status:** Complete

## Diagnostics

- [x] Implement `diagnose <input>`.
- [x] Add FFprobe-based structural analysis.
- [x] Add read-only FFmpeg decode scan.
- [x] Detect missing audio/video streams.
- [x] Detect multiple audio/video streams.
- [x] Detect invalid time bases.
- [x] Detect negative stream start times.
- [x] Detect likely VFR / frame-rate inconsistency.
- [x] Detect non-square pixels.
- [x] Report pixel-format interoperability concerns.
- [x] Detect definite WebM codec mismatches.
- [x] Parse non-monotonic DTS/timestamp errors.
- [x] Parse PTS/DTS errors.
- [x] Parse corrupt/decode failures.
- [x] Parse stream-mapping failures.
- [x] Parse filter-graph failures.
- [x] Add optional `--log` FFmpeg stderr analysis.
- [x] Add optional deep freeze detection with `freezedetect`.
- [x] Return typed structured diagnostic reports.

## Repair

- [x] Implement `repair timestamps <input>`.
- [x] Add `remux` and `reencode` modes.
- [x] Generate presentation timestamps with `+genpts`.
- [x] Normalize negative timestamps.
- [x] Normalize audio clock with `aresample=async=1:first_pts=0`.
- [x] Support explicit CFR output FPS.
- [x] Implement `repair normalize <input>`.
- [x] Normalize resolution while preserving aspect ratio.
- [x] Normalize SAR to 1:1.
- [x] Normalize frame rate/CFR.
- [x] Normalize pixel format.
- [x] Normalize video time base / PTS.
- [x] Normalize audio sample rate/channel layout.
- [x] Use transactional sibling output.
- [x] Re-probe and re-diagnose repaired output.
- [x] Do not overwrite without explicit permission.

## Validation

- [x] Unit tests for FFmpeg diagnostic log parsing.
- [x] Unit tests for freeze interval parsing.
- [x] Real-media integration test source.
- [x] Repair integration test source.
- [x] CLI registration test source.
- [x] Diagnostic report JSON Schema.
- [x] Strict TypeScript compilation of the diagnostics domain using local Node typings.
- [x] Real FFmpeg/FFprobe smoke validation of diagnose, timestamp repair, and normalization.
- [x] Output re-probed after repair.
- [ ] Full `npm run validate` in the assembly sandbox (npm registry access timed out).

## Local Codex Environment

- [x] Add ChatGPT Desktop / Codex Local Environment instructions.
- [x] Add cross-project `codex:setup` npm script.
- [x] Add non-destructive `codex:cleanup` npm script.
- [x] Document recommended Build / Type Check / Lint / Test / Validate / Doctor actions.
- [x] Document Local vs Worktree workflow.
- [x] Document `.worktreeinclude` for ignored local files.
