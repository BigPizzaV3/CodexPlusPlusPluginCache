---
name: go-distributed-coordination
description: "Use for Go cross-process ownership, leases, fencing, failover, sagas, and recovery. Do not use for local mutexes."
license: Apache-2.0
compatibility: "Go 1.24 or newer; coordination guarantees are specific to the deployed service and client version."
---

# Go distributed coordination

A lease is time-bounded evidence, not permanent ownership. A paused or partitioned former owner can resume after a successor takes over.

## Define the safety property

Identify the resource, operations requiring exclusion or order, authoritative store, owner identity, lease duration, clock assumptions, renewal path, takeover rule, and irreversible effects. Decide whether the requirement is safety, liveness, or both.

## Fence stale owners

For irreversible writes, obtain a monotonically increasing fencing token and make the authoritative store reject effects from older tokens. A lease check performed before the write is insufficient when the holder can pause between check and effect.

Use storage-level compare-and-swap, version predicates, or transaction constraints where possible. Process-local mutexes and leader flags cannot coordinate replicas.

If the target cannot compare fencing tokens—such as some payment, email, or filesystem effects—a lease alone cannot guarantee exclusion. Use target-enforced stable idempotency, route the effect through a fenceable authoritative outbox, or state the weaker guarantee and duplicate-recovery requirement explicitly.

## Design lease lifecycle

Bound acquisition and renewal; propagate cancellation; stop admission before expiry; treat renewal uncertainty as loss of authority; make release best-effort rather than the sole takeover mechanism. Observe lease age, renewal latency, token, owner, failed fences, and takeover count without high-cardinality leakage.

When ownership depends on timestamps or survives serialization/restart, read [references/time-and-authority.md](references/time-and-authority.md). Go's monotonic reading protects elapsed comparisons only inside one process; it is not serialized and cannot establish cross-replica authority.

## Sagas and compensation

Persist each workflow transition and command identity. Make steps and compensations idempotent. Compensation is a new business action, not rollback: it can fail, race with late success, or be legally impossible. Define forward recovery, manual exception handling, and terminal evidence.

Read [references/fencing-and-sagas.md](references/fencing-and-sagas.md) for failure schedules.

For regional writer promotion, coordination-cluster recovery, or failback, read [references/multi-region-failover.md](references/multi-region-failover.md). Routing a request to one region is not proof that every old writer and external effect has lost authority.

## Output contract

State the stale-owner schedule, authoritative fence, takeover behavior, and recovery path. Do not prescribe distributed locks when a local constraint or partitioned owner is sufficient.
