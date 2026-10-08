# Physics and Movement Bugs

## Inspect first

- Rigidbody, CharacterController, or custom controller
- Update versus FixedUpdate
- transform writes
- collision mode
- grounded logic
- slopes
- moving platforms
- time scale
- network simulation

## Common causes

- frame-dependent movement
- transform writes on dynamic Rigidbody
- conflicting movement owners
- stale grounded state
- wrong collision layer
- physics query timing
- multiple fixed steps
- root motion conflict

## Validation

- different frame rates
- slopes and edges
- moving platforms
- collisions
- pause
- scene reload
- network peers when relevant
