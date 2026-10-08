# Unity Input System Guide

Use only when the Input System package is actively used.

## Inspect

- action maps
- generated wrappers
- `PlayerInput`
- control schemes
- rebinding
- local multiplayer
- UI Input Module

## Rules

- Reuse existing actions and maps.
- Do not subscribe repeatedly.
- Enable and disable maps deliberately.
- Keep callbacks lightweight.
- Route input intent into gameplay systems.
- Preserve rebinding support.
- Treat `.inputactions` edits as serialized changes.
