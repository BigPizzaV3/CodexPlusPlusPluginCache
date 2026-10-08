# Gameplay and State Bugs

## Inspect first

- authoritative state owner
- state transitions
- activation and cancellation rules
- timers
- reset behavior
- save and network state
- presentation-derived state

## Common causes

- duplicate state ownership
- invalid transition
- stale cached state
- missing reset
- frame-dependent timing
- animation driving gameplay authority
- pooled reuse without reset

## Validation

- expected path
- blocked path
- repeated activation
- cancel and interrupt
- death and respawn
- scene reload
- pooled reuse
