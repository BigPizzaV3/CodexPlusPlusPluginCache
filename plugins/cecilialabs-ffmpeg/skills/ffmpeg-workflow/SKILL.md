---
name: ffmpeg-workflow
description: Translate natural-language media requests into validated FFmpeg Media Toolkit workflows, selecting domain Skills, preflighting inputs and outputs, and reporting only verified artifacts. Use for edit, convert, compose, stream, diagnose, or multi-step requests.
---

# FFmpeg Workflow

## Activation scope

Use this Skill when a user describes a media outcome in natural language and
the assistant must classify it, choose one or more domain Skills, order
preflight and execution, or report a resulting artifact.

Use ffmpeg-onboarding first when the execution context or required runtime
capability is unknown.

## Do not use

Do not use this Skill for pure environment installation or capability
discovery, which belongs to ffmpeg-onboarding. Do not use it to invent a
capability, hide a shell command inside a pipeline, or claim an artifact that
was not verified on the active host.

## Required inputs

Resolve or ask for:

- source media paths or an explicit capture source;
- the desired output and acceptable format/codec constraints;
- ordered operations and whether the request is a reusable pipeline;
- overwrite, dry-run, and temporary-artifact policy;
- execution context and authorization for writes or installation;
- hardware policy when acceleration is requested.

Make safe assumptions only when they do not change the media contract. State
the assumption before execution.

## Preflight

1. Classify the request with references/request-routing.md.
2. Select the smallest set of domain Skills needed.
3. Probe inputs when stream, timing, codec, dimensions, or audio layout matter.
4. Validate output paths, extension/codec compatibility, overwrite policy, and
   input/output collisions before expensive work.
5. Use dry-run for pipelines or whenever the user asks for a plan first.
6. Execute in declared order and preserve structured progress/errors.
7. Probe the final artifact and report it only after validation succeeds.

## Toolkit surface selection

Use the highest-level surface available:

1. use the associated Skill script when the requested workflow has one;
2. otherwise use the canonical cecilia-ffmpeg CLI and typed domain runtime;
3. use the explicit npm package-runner fallback below when the global CLI is
   unavailable;
4. use native FFmpeg only when the toolkit cannot represent the operation or
   the user explicitly requests native syntax.

The target architecture is script/Skill-first and does not require a network
service or an alternate agent protocol to make a workflow run.

## Associated scripts

This behavioral Skill delegates executable work to the selected domain Skill's
`scripts/run.mjs` entry point. Use `ffmpeg-onboarding/scripts/check.mjs` first
when the host or required capability is unknown; do not create a generic shell
runner in this routing layer.

## Request routing and associated scripts

Start from the user's desired outcome and route to the smallest domain Skill;
use this Skill to coordinate multiple domains, not to hide a generic shell
runner. The canonical request examples are in
[`../../docs/skill-request-examples.md`](../../docs/skill-request-examples.md).

When execution is available, invoke the selected domain's `scripts/run.mjs`
with one JSON request. Use `ffmpeg-onboarding/scripts/check.mjs` and
`ffmpeg-environment/scripts/inspect.mjs` before routing when the host or
required capability is unknown. Use `ffmpeg-pipelines/scripts/run.mjs` only
for ordered/reusable workflows or when the user explicitly asks for a
pipeline.

## Preferred toolkit commands

For a single operation, use the matching documented cecilia-ffmpeg command,
for example:

    cecilia-ffmpeg video trim INPUT --start 00:00:05 --end 00:00:20 --output OUTPUT

For pipelines, validate, inspect, and execute with:

    cecilia-ffmpeg pipeline pipeline.yaml validate
    cecilia-ffmpeg pipeline pipeline.yaml print
    cecilia-ffmpeg pipeline pipeline.yaml run --dry-run
    cecilia-ffmpeg pipeline pipeline.yaml run

If the global binary is unavailable:

    npm exec --yes --package=@cecilialabs/ffmpeg -- cecilia-ffmpeg pipeline pipeline.yaml run --dry-run

## Native FFmpeg fallback

Use native syntax only when a required operation is outside the typed toolkit
or the user explicitly asks for it. Explain the limitation, keep arguments
explicit, and preserve the same input/output and overwrite safety.

## Output expectations

Return:

- the selected domain Skill(s) and why they match;
- the exact command or associated script used, when execution is available;
- preflight facts and assumptions;
- structured execution status and warnings;
- the verified final path and relevant FFprobe properties;
- a clear distinction between a plan, a command supplied to the user, and a
  completed artifact.

## Validation

After authoring a workflow, parse and validate it. When practical, run a
dry-run before mutation. After execution, inspect the final artifact with
FFprobe and verify the requested codec, streams, timing, dimensions, and
container contract. For long jobs, report progress and preserve resumable
state when the associated script supports it.

## Error recovery

- For an ambiguous request, ask only for the missing media contract.
- For a missing capability, route to a supported domain or explain the
  limitation rather than substituting silently.
- For an output collision or overwrite rejection, ask for an explicit policy.
- For a failed step, report its structured details and retry only after the
  specific input, option, or capability is corrected.
- Preserve source media and temporary artifacts unless cleanup is safe and
  authorized.

## Safety and determinism

Never overwrite a source or final artifact without explicit policy. Never
embed arbitrary shell interpolation in declarative workflow files. Preserve
step order, resolve relative paths from the workflow file, use transactional
outputs, and do not report success from a dry-run.

## References

See references/request-routing.md for request classification and domain-Skill
selection examples.
