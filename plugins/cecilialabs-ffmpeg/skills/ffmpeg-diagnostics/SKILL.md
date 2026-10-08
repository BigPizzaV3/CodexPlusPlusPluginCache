---
name: ffmpeg-diagnostics
description: Diagnose FFmpeg media failures and apply observation-driven timestamp or normalization repairs. Use for corrupt packets, decode errors, malformed timestamps, CFR/VFR issues, timebase mismatches, stream mapping failures, filter graph errors, freezes, and compatibility problems.
---

# FFmpeg Diagnostics

Use this skill when the media or FFmpeg operation is failing and the defect must be identified before repair.

## Activation scope

Use for:

- PTS/DTS or non-monotonic timestamp errors;
- timebase/FPS/CFR/VFR problems;
- corrupt packets or decode errors;
- stream mapping failures;
- filter graph reinitialization failures;
- frozen frames;
- unexpected missing streams;
- codec/container/pixel-format compatibility issues.

## Do not use

Do not apply repair profiles blindly to healthy media. Do not use a generic re-encode as the first response when the toolkit can diagnose the observed defect.

## Required inputs

Collect:

- failing media path;
- FFmpeg stderr/log when available;
- whether deeper freeze detection is needed;
- desired output constraints if repair is requested.

## Preflight workflow

1. Run:
   `cecilia-ffmpeg diagnose <input> --json`.
2. If the user supplied an FFmpeg log, include it with `--log`.
3. Use `--deep` only when freeze analysis is relevant.
4. Choose a repair based on observed issues.

## Toolkit surface selection

Use the highest-level toolkit surface available to the host:

1. Use the associated `scripts/run.mjs` entry point for supported diagnostic and repair actions.
2. For `repair timestamps` and `repair normalize`, use the global `cecilia-ffmpeg` binary.
3. If the global binary is unavailable, use:
   `npm exec --yes --package=@cecilialabs/ffmpeg -- cecilia-ffmpeg <command>`.
4. Use native FFmpeg only for unsupported repair cases or an explicit native-command request.

## Associated scripts

Use `scripts/run.mjs` with `input.action` `diagnose`, `repair-timestamps`, or
`repair-normalize`. Diagnosis accepts an optional log path and deep freeze
scan settings; repair actions keep the output transactional and return
before/after issue sets.

```bash
printf '%s\n' '{"context":"codex","input":{"action":"diagnose","input":"broken.mp4","deep":true}}' \
  | node skills/ffmpeg-diagnostics/scripts/run.mjs
```

## Preferred toolkit commands

```bash
cecilia-ffmpeg diagnose <input>
cecilia-ffmpeg repair timestamps <input>
cecilia-ffmpeg repair normalize <input>
```

For supported operations, prefer the toolkit surface selected above over constructing arbitrary FFmpeg shell commands.

## Native FFmpeg fallback

Use native FFmpeg only for unsupported repair cases or when explicitly requested. Preserve the diagnosis and explain what the fallback is intended to fix.

## Output expectations

Diagnostics should identify issue codes/severity and supporting observations. Repair reports should include before/after diagnostics when execution completes.

## Validation

After repair:

1. FFprobe the output.
2. Re-run diagnosis.
3. Verify requested normalized properties.
4. Do not declare success solely because FFmpeg returned exit code 0.

## Error recovery

- Non-monotonic timestamps: prefer timestamp repair/normalization.
- FPS/timebase mismatch: normalize timing before composition.
- Filter graph error: inspect input properties and filter requirements rather than repeatedly re-running.
- Stream mapping error: verify actual streams with FFprobe.
- Corrupt decode: preserve evidence and avoid misleading “fixed” claims when source damage remains.

## Safety and determinism

Repairs write to a new transactional output. Never overwrite the source implicitly. Diagnosis is read-only.

## References

Read `references/diagnostics-reference.md` for issue-to-action mapping.
