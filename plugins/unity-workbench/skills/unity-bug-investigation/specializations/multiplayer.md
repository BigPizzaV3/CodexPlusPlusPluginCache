# Multiplayer and Desync Bugs

## Inspect first

- networking framework
- topology
- state authority
- input authority
- spawn and despawn
- RPC direction
- replicated fields
- prediction and reconciliation
- late-join behavior
- tick timing

## Common causes

- writing state without authority
- duplicate local and network simulation
- RPC used for durable state
- missing late-join state
- non-deterministic resimulation side effect
- stale ownership
- object not registered
- client trusting local outcome

## Validation

- host or server
- owner
- non-owner
- observer
- late join
- disconnect
- respawn
- latency when relevant
