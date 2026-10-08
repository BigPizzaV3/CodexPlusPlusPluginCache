# Reference Baseline

Architecture decisions were checked against current upstream documentation on **2026-09-18**.

## OpenAI Agent Plugins / Skills

- Portable plugins use a root `plugin.json` and can contain root `skills/`, assets and hooks.
- Skills are grouped around clear user goals and may include `references/`, `assets/` and deterministic `scripts/`.
- A Skills-only plugin is a supported distribution shape.

References:

- https://developers.openai.com/plugins/build/plugins
- https://developers.openai.com/plugins/build/skills
- https://developers.openai.com/docs/build-skills
- https://developers.openai.com/plugins/concepts/plugins

## Node.js

As of 2026-09-18:

- Node.js 26 is Current.
- Node.js 24 is LTS.
- Node.js 22 is LTS.

Reference:

- https://nodejs.org/en/about/previous-releases

## FFmpeg

As of 2026-09-18, the FFmpeg download page lists **FFmpeg 9.0.1** as the latest stable release from the 9.0 branch. Maintained older branches remain useful for compatibility testing.

Reference:

- https://ffmpeg.org/download.html

## Design principle

Version support does not imply every FFmpeg build contains every encoder/filter. Runtime capability detection remains mandatory for optional filters, external libraries and hardware acceleration.
