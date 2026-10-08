# Cache Coherency Check

## Operation

Verify the selected invariant through bounded scenarios in an authorized environment. Do not turn verification into unrelated implementation. Return passed, failed or blocked, with actual evidence and any missing required scenario.

## Goal

Verify one cache coherency invariant through bounded write/read/invalidation/permission scenarios without broadening into performance tuning or unrelated refactors.

## Required input

Provide selected data/resource, expected freshness and authorization behavior, implementation summary or patch boundary, safe environment, fixtures, and repository-native commands.

## Scenarios

- Populate cache, update authoritative data, and verify invalidation or TTL behavior.
- Exercise stale read and recovery behavior.
- Verify tenant/identity/role/plan/locale cache key separation where relevant.
- Exercise concurrent writes, optimistic updates, rollback, or background refresh only when part of the selected boundary.
