# Idempotency & Concurrency Audit

## Operation

Inspect the named boundary and report supported findings. Do not edit product code. Include concrete evidence, impact, the owning source, one remediation direction and a meaningful validation route. Severity follows actual impact, not a category example.

## Goal and scope

Audit one operation for duplicate execution, races, lost updates, lock/lease ownership, ordering, and stale completion.

## Domain invariants

- The logical operation has a stable identity and a defined duplicate result across retries/processes.
- Read-check-write transitions are atomic, versioned, serialized, or otherwise protected at the authoritative store.
- Locks/leases have bounded lifetime, fencing or stale-owner rejection, and do not span slow external work without design evidence.
- Parallelism preserves required ordering and cannot apply stale completion over newer state.

## Audit method

1. Map operation identity, mutable state, critical sections, side effects, acknowledgement, and retry sources.
2. Construct simultaneous, duplicate, delayed, timeout-after-success, crash, lease-expiry, and stale-worker interleavings.
3. Inspect database constraints/transactions, compare-and-set/version fields, distributed lock semantics, and consumer ordering.
4. Distinguish idempotent effect from deduplicated request and document retention window.

## Priority model

- **P0:** outage, data loss, duplicate irreversible effect, tenant breach, deadlock, request collapse, or runaway cost.
- **P1:** a hot-path reliability, consistency, concurrency, or performance defect with clear impact.
- **P2:** a lower-risk but concrete scaling, diagnosability, or secondary-path issue.
