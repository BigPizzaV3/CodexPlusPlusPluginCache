# Milestone 10 — Professional-Level Skills — Checklist

**Target:** `v0.8.0`  
**Status:** Implemented; local validation required before merge

## Skills

- [x] `ffmpeg-environment`
- [x] `ffmpeg-video-editing`
- [x] `ffmpeg-audio`
- [x] `ffmpeg-conversion`
- [x] `ffmpeg-composition`
- [x] `ffmpeg-streaming`
- [x] `ffmpeg-diagnostics`

## Required structure

- [x] Every skill has `SKILL.md`.
- [x] Every skill has YAML `name` and `description`.
- [x] Every skill has a `references/` directory with substantive reference material.
- [x] No placeholder skill remains.

## Professional workflow requirements

Every skill defines:

- [x] precise activation scope;
- [x] when not to use it;
- [x] required inputs;
- [x] inspection/preflight rules;
- [x] preferred toolkit commands;
- [x] native FFmpeg fallback rules;
- [x] output expectations;
- [x] validation steps;
- [x] error recovery;
- [x] safety rules;
- [x] deterministic behavior requirements.

## Core policy

- [x] Supported operations prefer `@cecilialabs/ffmpeg`.
- [x] Native FFmpeg is fallback-only unless explicitly requested.
- [x] Skills are independently useful without prior conversation context.
- [x] Domain boundaries route tasks to the correct skill instead of duplicating workflows.

## Quality

- [x] Added `test/skills/skills.test.ts`.
- [x] Added `scripts/verify-skills.mjs`.
- [x] Added `verify:skills` to `npm run validate`.
- [x] Updated skill index documentation.
- [x] Updated package/plugin version to `0.8.0`.
- [x] Updated README, roadmap, changelog, and project identity.
- [ ] Run `npm run validate` in the configured local Codex Environment before merge.

## Acceptance criterion

Each installed skill can guide an agent from task classification through preflight, toolkit execution, validation, and recovery without relying on conversation-specific knowledge.
