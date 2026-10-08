# Legacy Input Manager Guide

Use only when first-party code actively uses `UnityEngine.Input`.

## Rules

- Reuse existing axis and button names.
- Avoid inventing new names without updating project settings.
- Keep polling localized to input-facing components.
- Do not read input from domain logic.
- Consider migration constraints if both input systems are active.
