# Isolation and ambiguity

## Read Committed

Separate statements can observe different committed snapshots. A read-check-write invariant can race even though each statement is inside one transaction. Conditional writes, locks, or stronger isolation may be required.

## Serializable

Successful transactions behave like some serial order, but applications must handle serialization failure by replaying the complete transaction. It does not include remote side effects.

## Commit ambiguity

If the client loses the connection during commit, the server may have committed. Use a stable operation record or authoritative read to determine the outcome. A new identity can duplicate the effect.

## Cache

Invalidation messages can be lost, delayed, duplicated, or reordered. Version values or fetch from the source of truth when stale data would violate an invariant.
