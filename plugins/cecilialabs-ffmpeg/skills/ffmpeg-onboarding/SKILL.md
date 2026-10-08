---
name: ffmpeg-onboarding
description: Inspect and prepare an FFmpeg execution environment, routing capability checks and explicit installation guidance across ChatGPT, Work, Codex, and IDE hosts. Use before media work when the execution context or runtime availability is unknown.
---

# FFmpeg Onboarding

## Activation scope

Use this Skill when the host, Node.js/npm runtime, FFmpeg/FFprobe
installation, toolkit CLI, codec/filter support, or hardware capability is
unknown or needs explicit verification before media work.

Use it first when a user asks whether the current environment can execute a
workflow, requests installation guidance, or reports that a command works on
one host but not another.

## Do not use

Do not use this Skill as the primary workflow for editing, conversion,
composition, streaming, diagnosis, or pipeline authoring once the required
environment facts are known. Hand off to the matching domain Skill or to
ffmpeg-workflow.

Do not claim that a command ran when the host only supports copy/paste
instructions.

## Required inputs

Collect only what is needed:

- the execution context, if known;
- the requested media operation or required capability;
- the operating system and shell only when installation or command syntax
  depends on them;
- explicit authorization before installing packages or changing PATH/system
  configuration.

## Preflight

1. Identify which execution context is actually available. Do not infer local
   file or shell access from the conversation alone.
2. Inspect Node.js, npm, FFmpeg, FFprobe, and cecilia-ffmpeg without mutation.
3. Prefer toolkit capability and version inspection over parsing ad-hoc
   FFmpeg output.
4. Separate observed facts from recommendations and installation steps.
5. After an authorized installation, repeat the same checks and report the
   resolved executable paths and versions.

The onboarding script can complete the diagnostic while leaving the host
unready. Use `output.status` as the readiness decision: only `ready` permits
the next media Skill. `warning` or `blocked` requires the listed remediation
and a new check; the outer envelope uses `status: "needs-input"` for those
states and exposes the same warnings at the top level.

## Toolkit surface selection

Use the highest-level executable surface available:

1. use a Skill-associated script when the requested onboarding action exists;
2. otherwise use the global cecilia-ffmpeg binary;
3. otherwise use the explicit npm package-runner fallback below;
4. use native FFmpeg/FFprobe only when the toolkit lacks the required
   inspection or the user explicitly requests native commands.

This Skill is script/CLI-first and does not require a network service or an
alternate agent protocol.

## Associated scripts

From a checkout or installed package, send one JSON request on stdin and keep
the single JSON response as the source of truth:

    printf '%s\n' '{"context":"codex","input":{}}' | node skills/ffmpeg-onboarding/scripts/check.mjs

Plan an installation without changing anything:

    printf '%s\n' '{"context":"codex","input":{"scope":"local"}}' | node skills/ffmpeg-onboarding/scripts/install.mjs

An installation is only applied when the request contains both
`input.apply: true` and `input.authorized: true`. Supported scopes are
`global`, `local`, and `npm-exec`. The scripts never edit shell startup files,
interpolate shell commands, or claim that FFmpeg is ready from npm status alone.

## Preferred toolkit commands

For a read-only baseline, use:

    cecilia-ffmpeg doctor
    cecilia-ffmpeg environment check --json
    cecilia-ffmpeg environment version --json
    cecilia-ffmpeg environment capabilities --json

If the global binary is unavailable, use:

    npm exec --yes --package=@cecilialabs/ffmpeg -- cecilia-ffmpeg doctor

Use cecilia-ffmpeg probe INPUT --json when media metadata is part of the
readiness decision.

## Native FFmpeg fallback

Use native FFmpeg or FFprobe only when the required capability is not exposed
by the toolkit or the user explicitly asks for native syntax. Preserve the
observed error and do not silently substitute a different codec, filter, or
hardware path.

## Output expectations

Report:

- the execution context and whether it was observed or assumed;
- resolved paths for Node.js, npm, FFmpeg, FFprobe, and the toolkit CLI;
- versions and the exact capability relevant to the requested workflow;
- installation actions that were performed versus commands the user must run;
- the next domain Skill or workflow step.

## Validation

Validate the capability that the requested media workflow actually needs.
The existence of an executable alone does not prove codec, filter, device, or
hardware usability. After installation, repeat the checks from the same host.

## Error recovery

- If a binary is missing, distinguish PATH resolution from installation.
- If the toolkit is unavailable, use the explicit package-runner fallback and
  preserve its error output.
- If a codec/filter is missing, choose a supported workflow or explain the
  required FFmpeg build; do not invent an equivalent.
- If hardware is compiled in but runtime probing fails, report those as
  separate facts and fall back only when the user permits it.
- If the host cannot execute commands, stop at a reproducible guided flow.

## Safety and determinism

Environment inspection is read-only. Installation, shell startup changes,
package-manager actions, and device configuration require explicit
authorization. Never expose credentials or ask a regular chat host to expose
local media through a public domain or proxy.

## References

See references/execution-contexts.md for context routing, installation
boundaries, and result-reporting examples.
