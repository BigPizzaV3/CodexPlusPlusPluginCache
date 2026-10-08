# Gameplay Specialization

## Use when

Use for movement, combat, abilities, interactions, scoring, game rules, state
machines, inventory behavior, quests, enemies, and player-facing mechanics.

## Inspect first

- current gameplay owner
- movement or combat controller
- state machine
- input abstraction
- configuration pattern
- animation and VFX hooks
- networking authority
- save implications
- existing tests

## Design decisions

Determine:

- authoritative state owner
- activation conditions
- cancellation conditions
- cooldowns and timing
- failure behavior
- data versus runtime state
- interaction with pause
- interaction with death or disable
- multiplayer replication
- presentation feedback

## Implementation rules

- Keep rules separate from presentation when practical.
- Do not replace the existing controller for a small feature.
- Reuse current state and ability systems.
- Avoid duplicating authoritative state.
- Keep ability activation and completion explicit.
- Make repeated activation behavior clear.
- Reset pooled or respawned state correctly.
- Expose configuration through established project patterns.

## Validation

- expected activation
- blocked activation
- repeated activation
- cancellation
- scene reload
- death or disable
- multiplayer ownership when relevant
- Play Mode behavior
