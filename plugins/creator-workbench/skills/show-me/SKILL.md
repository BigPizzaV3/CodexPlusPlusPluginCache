---
name: show-me
description: Render visual plans, comparisons, option boards, reports, layouts, and dashboards instead of describing them only in prose. Use when the user says show me, wants to see options, asks what something looks like, or needs a visual decision surface.
---

# Show Me

A visual handoff should be an artifact, not a paragraph describing the artifact.

## When to use HTML

Use self-contained HTML for:
- plans and roadmaps
- comparisons
- option boards
- layouts and wireframes
- reports and dashboards
- session handoffs that benefit from visual structure

Keep paste-target content as plain text:
- social posts
- newsletter bodies
- config
- instructions
- code snippets intended for another tool

## SHOW mode

Create one self-contained HTML file:
- UTF-8
- inline CSS
- no CDN
- no external fonts
- no network dependency

If the host can preview or open the file, do so and verify the rendered result when possible. If it cannot, return the artifact link and clearly state that opening was not verified.

## PICK mode

When the user needs to choose between visual directions, prefer at least three genuinely different options.

Before rendering, describe each option in one sentence. If the same sentence fits two options, they are not meaningfully different.

Each option should name the design device or structural argument, not only a cosmetic difference.

## Visual QA

Inspect the artifact yourself using available preview or screenshot tools when possible.

Do not claim the user saw a browser tab just because a file was generated or an open command exited successfully.

## Completion

Lead with the result. Keep prose around the render short. Give one immediate next decision when a decision is required.

## Creator Workspace handoff

Consume already-verified content from the relevant creation or analytics skill. Do not use visual rendering to hide missing evidence.
