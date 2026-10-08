# OpenXR Guide

Use only when OpenXR is actively configured.

## Inspect

- enabled feature groups
- interaction profiles
- platform-specific extensions
- loader configuration
- supported runtimes

## Rules

- Avoid vendor-specific assumptions unless required.
- Validate enabled interaction profiles.
- Preserve platform-specific feature settings.
- Handle unsupported extensions gracefully.
- Test against the target runtime or device when possible.
