# Built-in Render Pipeline Guide

Use only when the project actively uses the Built-in Render Pipeline.

## Rules

- Do not use URP or HDRP-only APIs.
- Validate surface shader and replacement shader compatibility.
- Consider forward versus deferred rendering.
- Preserve Graphics Settings and shader inclusion.
- Check target-platform shader support.
