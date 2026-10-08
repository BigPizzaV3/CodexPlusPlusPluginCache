# Professional Skills

The current package ships ten portable Skills: two behavioral Skills for
context/routing and eight domain Skills for concrete media operations.

## Skill architecture

```text
user intent
   ↓
skill activation boundary
   ↓
required-input check
   ↓
probe / environment preflight
   ↓
preferred @cecilialabs/ffmpeg command
   ↓
execution
   ↓
validation
   ↓
error recovery or native fallback
```

The skills are intentionally domain-oriented rather than one skill per CLI command. This keeps activation precise while preserving enough context to choose between related operations.

## Installed Skills

| Skill | Owns |
|---|---|
| ffmpeg-onboarding | execution context, readiness, installation guidance |
| ffmpeg-workflow | natural-language routing, preflight, artifact verification |
| ffmpeg-environment | doctor, versions, capabilities, probe |
| ffmpeg-video-editing | trim, speed, image-to-video, restore |
| ffmpeg-audio | attach, silence, silence detection/removal, telephony |
| ffmpeg-conversion | file and batch format conversion |
| ffmpeg-composition | concat, transitions, slideshow |
| ffmpeg-streaming | camera/file capture and transport planning |
| ffmpeg-diagnostics | diagnose, timestamp repair, normalization repair |
| ffmpeg-pipelines | YAML pipelines, presets, validation, execution |

## Portable skill contract

Each `SKILL.md` uses minimal portable front matter:

```yaml
---
name: skill-name
description: concise activation description
---
```

The body contains explicit workflow sections rather than assuming hidden prompt context.

## Toolkit-first policy

The Skills now select among equivalent toolkit surfaces instead of assuming a single command runner:

```text
associated Skill script
        ↓ unavailable or unsupported action
cecilia-ffmpeg global binary
        ↓ unavailable
npm exec --yes --package=@cecilialabs/ffmpeg -- cecilia-ffmpeg ...
        ↓ unsupported capability / explicit native request
native FFmpeg
```

The package exposes one canonical executable, `cecilia-ffmpeg`. The explicit
`npm exec --yes --package=@cecilialabs/ffmpeg -- cecilia-ffmpeg ...` form keeps
package-runner usage deterministic.

Native FFmpeg remains available when the toolkit has no matching capability or when the user explicitly requests native FFmpeg syntax.

This avoids duplicating the toolkit's tested argument-building, output safety, probe normalization, hardware policy, and error taxonomy in free-form shell commands.

## Context economy

Reference material is kept under each skill's `references/` directory. The main skill body carries the workflow and decision boundaries; detailed domain matrices live in references and can be loaded only when needed.

## Validation

`scripts/verify-skills.mjs` verifies all ten Skill roots, required workflow
sections, toolkit-first policy, and referenced documentation. The associated
script catalog is checked by `verify:skill-scripts`, while context and routing
guidance is checked by `verify:agent-workflows`.
