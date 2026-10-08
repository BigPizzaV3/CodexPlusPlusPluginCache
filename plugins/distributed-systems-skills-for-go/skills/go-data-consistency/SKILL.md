---
name: go-data-consistency
description: "Use for Go transaction, cache, migration, and DB/broker consistency. Do not use for broker ACK or replay."
license: Apache-2.0
compatibility: "Go 1.24 or newer; database, driver, and cache semantics must be verified against deployed versions."
---

# Go data consistency

Start from the invariant and legal concurrent outcomes. A transaction is a correctness boundary, not a repository convenience.

## Define the durable unit

Identify reads that justify writes, constraints, isolation behavior, transaction owner, external effects, idempotency identity, and what a caller sees when commit outcome is unknown. Keep all statements protecting one invariant on the same transaction handle.

## Enforce close to state

Prefer unique, foreign-key, check, exclusion, or conditional-write constraints where the database can enforce the invariant atomically. Use row locks, advisory locks, optimistic versions, or serializable isolation only after naming the anomaly they prevent. Isolation labels differ across engines.

After `BeginTx`, use the transaction handle exclusively. Defer rollback as cleanup, return commit errors, close rows, check iteration errors, propagate context, and remember `sql.DB` is a concurrent pool whose limits can queue and time out callers.

## Retry and ambiguity

Replay the whole transaction from fresh reads only for stable retryable error classes, within a bounded budget, with external side effects excluded or independently idempotent. A connection failure during commit can leave the outcome unknown. Resolve by durable operation identity or reconciliation; never report a definite rollback without evidence.

## Cache consistency

State whether the cache is authoritative, derived, or optional. Define invalidation/order behavior, stale-read tolerance, stampede control, and recovery after cache loss. A version embedded only in the cached value cannot reveal that the authoritative version advanced. Write-through is safe only if it participates in the authoritative commit. For correctness-dependent reads, use authoritative reads, a reader-visible generation check, or durable ordered propagation such as transactional outbox/CDC; do not rely on best-effort invalidation.

## Migrations

Use expand, mixed-version deployment, bounded restartable backfill, switchover, and delayed contract. Verify old writer/new reader, new writer/old reader, rollback, and partial progress.

Treat backfill progress as resumability metadata, not completeness proof. Partition by a stable key, update conditionally so a stale batch cannot overwrite a newer write, validate the authoritative rows before cutover, and remove the old representation only after old binaries, queued work, consumers, and rollback paths can no longer use it. Verify engine-version lock, rewrite, and failed-DDL behavior before choosing an online mechanism.

## Revisioned projections

For a derived cache or controller built from snapshot plus watch, bind a consistent snapshot revision to a watch starting at the following revision. Apply the source's atomic revision unit before advancing the local checkpoint. Treat cancellation, compaction, and restored-cluster lineage as explicit resynchronization states; build and catch up a private replacement generation before publishing it. Read [references/revisioned-watch-resync.md](references/revisioned-watch-resync.md) for the etcd-specific evidence and portable procedure.

Read [references/isolation-and-ambiguity.md](references/isolation-and-ambiguity.md) for transaction counterexamples, [references/online-changes.md](references/online-changes.md) for expand/backfill/cutover failure schedules, and [references/replica-read-authority.md](references/replica-read-authority.md) when correctness depends on asynchronous replica visibility or failover. For cursor APIs over changing or replicated data, read [references/pagination-under-mutation.md](references/pagination-under-mutation.md) and choose explicitly between live traversal and stable-snapshot semantics.

## Output contract

Name the invariant, transaction boundary, permitted anomalies, and ambiguous-outcome policy. For review, show the violating interleaving and smallest repair.
