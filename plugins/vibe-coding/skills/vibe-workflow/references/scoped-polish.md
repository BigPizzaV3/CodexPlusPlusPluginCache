# Scoped Polish

## Operation

Implement the requested coherent change at the owning source and update directly affected consumers. An earlier audit is optional when the user and repository already establish the target. Validate the changed behavior, then stop when the requested scope is complete.

## Goal

Implement one selected finding in a narrowly specified domain using explicitly supplied invariants and repository-native validation.

## Scope selection

Supply one complete audit result or an equivalent task definition, plus the applicable domain invariants and repository-native validation. Do not select another finding or infer an undocumented platform guarantee.

Ground the target in exact repository evidence. Stop rather than substitute a different improvement when the owner, invariant, or safe validation boundary cannot be established.

## Change rules

Implement the smallest complete owner-layer slice. Synchronize directly affected producers, consumers, state transitions, schemas/config, generated artifacts, tests, operations, and rollback. Preserve existing architecture and public behavior outside the selected invariant. Record unavailable external gates exactly.
