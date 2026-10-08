---
name: ffmpeg-environment
description: Inspect, validate, and troubleshoot FFmpeg/FFprobe installations, versions, codecs, filters, hardware backends, and media metadata. Use before media work when runtime capabilities are unknown, when a command depends on a codec/filter/accelerator, or when diagnosing environment-specific failures.
---

# FFmpeg Environment

Use this skill to establish what the local FFmpeg environment can actually do before choosing a media workflow.

## Activation scope

Use when the task involves environment readiness, FFmpeg/FFprobe discovery, version compatibility, codec/filter availability, hardware acceleration discovery, or media inspection with FFprobe.

## Do not use

Do not use this skill as the primary workflow for editing, audio processing, conversion, composition, streaming, or repair when the required environment facts are already known. Route those tasks to the corresponding domain skill.

## Required inputs

Collect only what is needed:

- the media path when probing a file;
- the required codec, encoder, decoder, filter, or hardware backend when capability-specific;
- explicit FFmpeg/FFprobe paths only when the user supplied or needs non-default binaries.

## Preflight workflow

1. Prefer the toolkit:
   `cecilia-ffmpeg doctor`.
2. For machine-readable capability data, use:
   `cecilia-ffmpeg environment capabilities --json`.
3. For version checks, use:
   `cecilia-ffmpeg environment version --json`.
4. For media inspection, use:
   `cecilia-ffmpeg probe <input> --json`.
5. Do not infer runtime support from package names or operating-system assumptions when the toolkit can inspect it directly.

## Toolkit surface selection

Use the highest-level toolkit surface available to the host:

1. Use the associated `scripts/inspect.mjs` entry point for supported inspection actions.
2. For `doctor`, version checks, and capability inspection, use the global `cecilia-ffmpeg` binary.
3. If the global binary is unavailable, use:
   `npm exec --yes --package=@cecilialabs/ffmpeg -- cecilia-ffmpeg <command>`.
4. Use native FFmpeg/FFprobe only when the toolkit lacks the required inspection or the user explicitly requests native syntax.

## Associated scripts

Use `scripts/inspect.mjs` for JSON-in/JSON-out inspection without shell
parsing. Set `input.action` to `doctor`, `capabilities`, `version`, or `probe`
and provide `input.input` for a media probe. The script uses the shared Skill
result envelope and keeps regular Chat in a planned state.

```bash
printf '%s\n' '{"context":"codex","input":{"action":"capabilities"}}' \
  | node skills/ffmpeg-environment/scripts/inspect.mjs
```

## Preferred toolkit commands

Prefer `@cecilialabs/ffmpeg` over ad-hoc shell parsing of `ffmpeg -version`, `-encoders`, `-filters`, or `ffprobe` output.

## Native FFmpeg fallback

Use native FFmpeg/FFprobe only when the toolkit does not expose the required inspection or the user explicitly requests the native invocation.

## Output expectations

Report observed facts separately from interpretation:

- resolved binary paths;
- parsed versions;
- capability counts or specific matched capabilities;
- relevant hardware backend compile support;
- normalized media stream metadata;
- any limitation that is compile-time-only rather than proof of usable hardware.

## Validation

For environment-dependent work, validate the exact required capability, not merely that FFmpeg launches.

For media work, use FFprobe-derived stream properties rather than filename extensions as the source of truth.

## Error recovery

- If FFmpeg or FFprobe is not found, confirm PATH or explicit binary overrides.
- If a capability is missing, do not invent an equivalent; choose a supported codec/filter or explain the installation/build requirement.
- If hardware support is reported but execution fails, distinguish compiled support from runtime device/driver availability.
- If probing fails, preserve the original error and avoid destructive media operations.

## Safety and determinism

Environment inspection should be read-only. Do not install packages, change PATH, or alter system configuration unless the user explicitly requests it.

Prefer JSON output for agent workflows and stable comparison.

## References

Read `references/environment-reference.md` for command details, capability interpretation, and troubleshooting patterns.
