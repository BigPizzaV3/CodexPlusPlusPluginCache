# Input Specialization

## Use when

Use for action maps, key bindings, controller support, touch, local multiplayer,
input buffering, rebinding, or player-command interpretation.

## Inspect first

- active input system
- action maps
- generated wrappers
- input abstraction
- control schemes
- local-player ownership
- UI input modules
- enable and disable flow

## Implementation rules

- Reuse existing action maps.
- Keep raw input outside domain logic.
- Subscribe and unsubscribe symmetrically.
- Avoid duplicate callbacks.
- Respect disabled gameplay states.
- Consider menus, cutscenes, death, loading, and pause.
- Preserve controller and keyboard navigation.
- Treat `.inputactions` edits as high impact.
- Do not hardcode bindings when rebinding exists.

## Validation

- keyboard or primary device
- controller when supported
- enable and disable
- repeated scene loads
- UI and gameplay action-map transitions
- local multiplayer ownership
