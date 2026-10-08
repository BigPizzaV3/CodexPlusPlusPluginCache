# Photon Fusion Debugging

## Inspect

- topology
- `NetworkRunner`
- state authority
- input authority
- simulation callbacks
- networked properties
- RPCs
- prediction and resimulation
- spawn and despawn

## Common defects

- authoritative simulation in ordinary `Update`
- side effects repeated during resimulation
- input not supplied for a tick
- state written without authority
- RPC used instead of durable state
- visual state confused with simulation state

## Evidence

Record runner, tick, authority, object ID, and resimulation state.

## Validation

Use at least owner and observer. Include latency or resimulation when relevant.
