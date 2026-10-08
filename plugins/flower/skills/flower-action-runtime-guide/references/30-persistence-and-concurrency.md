# Persistence And Concurrency

## Contents

- [ActionRun Is Lifecycle Truth](#actionrun-is-lifecycle-truth)
- [RunStore Contract](#runstore-contract)
- [Duplicate Scope](#duplicate-scope)
- [Duplicate Policy Selection](#duplicate-policy-selection)
- [JDBC CAS](#jdbc-cas)
- [What CAS Does Not Solve](#what-cas-does-not-solve)
- [Recovery](#recovery)

## ActionRun Is Lifecycle Truth

`ActionRun` records the governed lifecycle, including the proposal identity,
status, result, version, timing, and deferred-attempt information. Treat it as
the source of truth for status queries, recovery, completion, and cancellation.
Flower checkpoints, queue messages, futures, and callback payloads may help
orchestrate work, but none of them replaces the run record.

Record every externally meaningful transition in the selected `RunStore`,
including approval waiting, dispatch acceptance, `WAITING_EXTERNAL`, terminal
completion, cancellation, and failure. A transition that must survive restart
or be visible to another process must not exist only in memory.

## RunStore Contract

A durable `RunStore` implementation must provide these invariants:

- `create` fails when the run id already exists.
- `find(String runId)` returns the current committed state as an
  `Optional<ActionRun>`.
- `compareAndSet(expected, updated)` succeeds only when the stored run has the
  expected id and version and the update advances exactly one version.
- No public unconditional update, upsert, or force-overwrite operation is used
  in the runtime path.
- Returned run objects cannot be mutated behind the store's back.

Do not add a convenient `update(run)` method. It silently bypasses the version
invariant and allows management scripts or host code to overwrite a concurrent
completion. If exceptional repair tooling is unavoidable, keep it outside the
runtime SPI, protect it operationally, and record a separate audit trail.

`RunStore.noop()` is acceptable only for small synchronous demonstrations. Do
not use it for approval, async, deferred, callbacks, cancellation, status
queries, restart recovery, or multiple runtime instances.

## Duplicate Scope

The 0.3 pipeline resolves, validates, and authorizes the current request before
duplicate reservation or `RETURN_EXISTING`. Scope a durable reservation by at
least:

```text
tenantId + actionId + idempotencyKey
```

All 0.3 duplicate-policy operations receive the trusted execution context, so
terminal bookkeeping retains the same tenant scope as reservation. Add principal
or resource-visibility scope when returning an existing result could expose
data across actors. A global unique constraint on `idempotencyKey` alone is not
tenant safe.

## Duplicate Policy Selection

Use `InMemoryDuplicateActionPolicy` for concurrent duplicate suppression only
when one JVM owns the runtime and losing all reservations/results on restart is
acceptable. Its per-scope state is owner-aware and atomic in `0.3.3`, but the
map is unbounded and does not coordinate another process.

Use `JdbcDuplicateActionPolicy` when duplicate reservations must survive
restart or coordinate multiple runtime instances. It stores a separate
`action_duplicate` reservation/result index. Apply the matching fresh schema or
additive migration from `db/action_duplicate/` through the host's migration
system; no schema is applied automatically.

Keep these truths distinct:

```text
ActionRun         one governed request lifecycle and attempt
action_duplicate  owner and first result for one logical operation scope
domain store      whether the business side effect actually committed
```

The duplicate owner is the trusted unique `runId`. Only that owner may complete
or release `RUNNING`; stale or repeated calls must not alter a newer owner or a
completed result. Preserve the first terminal result, including failures. A
`RetryDisposition` may permit a later explicitly governed attempt, but it does
not erase or automatically retry the same logical reservation.

Do not implement automatic TTL or lease takeover of an old `RUNNING` duplicate
row. Age alone cannot prove that the earlier external effect stopped. Reconcile
the matching `ActionRun`, domain state, and external operation before an
explicit audited repair or release.

## JDBC CAS

The decisive JDBC transition should be one atomic statement equivalent to:

```sql
UPDATE action_run
SET ..., version = ?
WHERE run_id = ? AND version = ?
```

Exactly one contender may update a given version. A zero update count means the
caller lost the race or used stale state and must reload the stored run before
deciding its response.

Ship explicit schema or migration resources for every supported database.
Apply a new migration rather than editing a migration that users may already
have applied. Verify H2 behavior for fast tests and run native PostgreSQL and
MySQL integration tests before claiming production support for those dialects.

## What CAS Does Not Solve

CAS prevents stale state overwrites. It does not by itself provide worker
leasing, queue acknowledgement, outbox delivery, exactly-once side effects, or
recovery ownership. External effects still need idempotency, and distributed
workers may need claim/lease semantics supplied by their queue or job system.

CAS also does not atomically join `ActionRun` persistence to an external queue
or remote side effect. Use an outbox or an idempotent deterministic dispatch
protocol and reconcile the crash window between external acceptance and
`WAITING_EXTERNAL` persistence.

## Recovery

On startup or scheduled reconciliation, query non-terminal runs and handle
them by state:

- approval-waiting runs remain waiting unless the approval source has a durable
  decision to resume;
- `WAITING_EXTERNAL` runs reconcile with their recorded operation and attempt;
- abandoned in-process work is failed or redispatched only under an explicit
  idempotent recovery policy;
- terminal runs are never executed again.

Recovery must use the same runtime controls and CAS transitions as the normal
path. It must not patch database rows directly.
