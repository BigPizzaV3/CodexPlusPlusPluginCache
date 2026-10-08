# Input Bugs

## Inspect first

- active input system
- action-map enable state
- duplicate subscriptions
- control schemes
- generated wrappers
- PlayerInput ownership
- UI and gameplay map transitions

## Common causes

- callback registered twice
- map left disabled
- competing action maps
- wrong local player
- lost focus
- rebinding mismatch
- input read in wrong update phase

## Validation

- keyboard
- controller
- enable and disable
- scene transitions
- UI versus gameplay
- local multiplayer
