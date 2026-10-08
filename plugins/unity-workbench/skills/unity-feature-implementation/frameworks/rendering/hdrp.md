# High Definition Render Pipeline Guide

Use only when the project actively uses HDRP.

## Inspect

- HDRP version
- pipeline assets
- custom passes
- volume profiles
- ray tracing or path tracing
- shader graph targets

## Rules

- Match HDRP package version.
- Preserve volume and custom-pass ordering.
- Consider high-end hardware requirements.
- Avoid casual changes to shared HDRP assets.
- Validate platform and graphics API support.
