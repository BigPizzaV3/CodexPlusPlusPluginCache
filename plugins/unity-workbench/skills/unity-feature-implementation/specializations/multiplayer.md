# Multiplayer Specialization

## Use when

Use for replicated state, RPCs, ownership, authority, prediction, spawning,
despawning, matchmaking, lobbies, reconnects, and multi-peer behavior.

## Inspect first

- active networking framework
- authority model
- input authority
- state authority
- spawn registration
- simulation loop
- RPC conventions
- late-join behavior
- disconnect behavior
- existing multiplayer tests

## Design decisions

Determine:

- who may initiate
- who validates
- who owns state
- what must replicate
- event versus state synchronization
- prediction requirements
- reconciliation requirements
- late-join state
- disconnect and despawn behavior

## Implementation rules

- Follow project framework patterns.
- Do not trust client-provided outcomes in authoritative systems.
- Avoid per-frame RPCs.
- Do not synchronize derived state unnecessarily.
- Keep cosmetic effects separate from authoritative rules.
- Preserve network tick semantics.
- Reset networked objects correctly on despawn.
- Avoid local-only assumptions in shared code.

## Validation

- host or server behavior
- owning client
- non-owning observer
- at least two peers when possible
- late join
- disconnect
- repeated spawn and despawn
- authority rejection paths
