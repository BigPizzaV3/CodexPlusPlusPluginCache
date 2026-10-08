# Multi-region failover authority

Regional failover is an authority and data transition, not a DNS operation. A control plane may route all new requests to region B while an isolated worker in region A still holds credentials, queued work, database connections, or access to an external side effect.

## Separate the decisions

Name distinct authorities for:

- traffic admission and service discovery;
- coordination membership and leader election;
- durable data completeness and the recoverable point;
- application writer ownership;
- irreversible external effects;
- operator declaration of disaster and any forced recovery.

Consensus can elect at most one leader for a term when its quorum assumptions hold. That does not make an application write from an old process harmless, nor does it fence a target outside the consensus state machine.

## Carry an application generation

Represent writer authority with a durable, ordered generation or fencing token. Capture it with the admitted operation and require every fenceable authoritative target to reject an older generation in the same conditional write that commits the effect. Do not compare only a regional flag, DNS answer, cached lease, or pre-write health check.

The generation must remain newer than every generation that an old region can present. Restoring a stale coordination snapshot or creating a new cluster can roll back counters or create a separate identity, so establish a new application generation through an authority that survives the disaster boundary before admitting work. A random cluster identifier distinguishes lineages but does not by itself order them for a target that must reject stale writes.

For a non-fenceable payment, email, or partner API, carry a stable operation identity across regions, route the command through a fenceable durable outbox when possible, and define duplicate detection and reconciliation. State the residual risk: infrastructure leader election cannot create exactly-once behavior at an external target that supports neither fencing nor idempotency.

## Promote only after evidence

A promotion state machine should make these phases explicit:

1. stop or quarantine admission to the old generation;
2. establish that the old writer is fenced at each authoritative target, or record why this cannot be proven;
3. measure replica or restore position and declare the accepted recovery-point loss;
4. form or recover the coordination quorum with an intentional membership and cluster identity;
5. allocate and publish the new application generation;
6. validate data, invalidate stale caches and watches, then admit new work;
7. reconcile commands and external effects spanning the cutover.

Health-check timeout is insufficient promotion evidence. Asynchronous replication means the reachable standby can be stale. Readiness must depend on authority and the accepted data point, not merely process liveness.

When an etcd snapshot is restored, it starts a new logical cluster and changes member and cluster identity. Restoring to an older revision can leave watch-based consumers with inconsistent caches; follow the product's documented integrity, revision-bump, compaction, and membership procedure. Do not use forced membership recovery while old members may still be alive.

## Treat failback as another migration

Do not reverse DNS and call it rollback. Failback needs a newer generation, a chosen data source, replication catch-up or rebuild, fencing of the current writer, mixed-version compatibility, external-effect reconciliation, and the same admission gates as promotion. Prefer remaining on the recovered region until these invariants are proven over an urgent second cutover.

Record trigger, decision authority, old and new generations, data positions, unreachable components, operator approvals, commands, evidence hashes, exceptions, and reconciliation results. Exercise loss of quorum, stale replica promotion, old-region recovery, snapshot rollback, delayed work, and failback as separate schedules.
