# Testing

## Contents

- [Pipeline Tests](#pipeline-tests)
- [Backend Parity](#backend-parity)
- [Real Concurrency Tests](#real-concurrency-tests)
- [Persistence And Recovery Tests](#persistence-and-recovery-tests)

## Pipeline Tests

Cover at least:

- unknown action and invalid input;
- policy allowed and denied;
- approval not required, pending, approved, rejected, and expired;
- changed policy or invalid input after approval;
- pre-execution guard rejection immediately before dispatch;
- duplicate idempotency behavior;
- when policy has a denied-principal boundary, after an authorized request
  completes, a retry for the same tenant, action, idempotency key, and resource
  when applicable under a denied execution principal is rejected without
  receiving cached output/result or protected run/resource data and without
  another domain side effect;
- when the action or result is resource-bound, same-tenant/action/key reuse for
  resource B by a request otherwise valid and authorized for B does not return
  resource A's cached result or protected data;
- same idempotency key across different tenants and actions without result
  leakage;
- stable result code and retry disposition;
- conservative default failure plus every explicit failure factory;
- synchronous, async success/failure, and deferred dispatch;
- valid, stale, forged, duplicate, and cross-tenant completion callbacks;
- cancellation before dispatch, while waiting externally, and after terminal
  completion;
- external cancellation-hook failure remains distinguishable from confirmed
  domain cancellation;
- audit events for every important decision and transition.

## Backend Parity

Run equivalent scenarios through direct and Flower backends. Compare control
decisions, persisted statuses, result codes, and audit semantics. Backend
selection must not weaken validation, policy, approval revalidation, or guards.

## Real Concurrency Tests

Two sequential CAS calls from one test thread prove stale-version rejection;
they do not exercise contention. Add real concurrency tests using a bounded
thread pool, barriers or latches, and deterministic timeouts.

For each race, start all contenders from the same stored version and assert:

- exactly one transition wins;
- the stored version advances once for the contested transition;
- all losers observe a consistent terminal result;
- no unexpected exception, deadlock, or timeout occurs;
- the domain completion or cancellation hook is invoked no more than intended.

Exercise complete-versus-complete, cancel-versus-cancel, and
complete-versus-cancel. For JDBC, use separate connections and, when the host
can have multiple instances, two runtime objects sharing the same database.
Repeat the focused concurrency class enough times to catch accidental timing
dependencies, but coordinate starts with barriers rather than sleeps.

For a stateful built-in or custom `DuplicateActionPolicy` that claims
concurrent duplicate suppression and caches or finalizes reservations, also
exercise reserve-versus-complete on the same scope. Run both contenders through the
Action Runtime and registered executor. Use a test decorator or hook to place
barriers immediately before the atomic reserve/complete transitions; never wait
while holding the per-scope lock. Assert exactly one
`DuplicateActionDecisionType.ACCEPT` reservation, one executor invocation and
domain side effect, no terminal overwrite, and no deadlock or timeout. During
the race the duplicate may receive the documented in-progress denial or the
original result; every later duplicate must return the unchanged original
cached terminal result. Sequential calls cannot prove this property. A direct
policy-only test with a synthetic result proves state-machine behavior, not the
one-side-effect runtime contract, and does not replace the full-pipeline race.

Exercise reservation ownership and ABA sequences as well. Reserve as owner A,
release A, reserve as owner B, then deliver a delayed or repeated
`complete()`/`release()` from A. A third reserve must still observe B as the
current owner and must not be accepted. Complete B and prove that every later
duplicate returns B's stable terminal result. Repeat with the stale operation
racing the new reserve, using barriers or latches rather than sleeps. This
requires owner-aware state, normally keyed to trusted `runId`; a scope-only
running flag cannot prove the contract.

Do not collapse visibility and concurrency into one generic "duplicate" test.
Keep named tests for each applicable property: denied-principal cached-result
replay, authorized cross-resource reuse, the full-pipeline
reserve-versus-complete race, and policy-level ownership/ABA behavior. Record
why a principal/resource/race case is N/A when that boundary or stateful
concurrency claim is genuinely absent; do not invent one. Before reporting
completion, point each applicable duplicate-safety claim to its specific test
and assertion.

For `JdbcDuplicateActionPolicy`, use separate connections and policy/runtime
instances against the same database. Cover concurrent unique reservation,
restart-visible completed results, stable first terminal result, stale-owner
completion/release ABA sequences, denied-principal replay, and cross-resource
visibility separation. H2 is fast feedback; when claiming the shipped native
database contract, run the opt-in `native-database-tests` profile against real
PostgreSQL and MySQL rather than replacing it with `JdbcTemplate` mocks.

## Persistence And Recovery Tests

Test create uniqueness, CAS version rules, serialization of every field,
schema migrations, restart recovery, stale attempt tokens, and terminal-run
idempotency. H2 is useful for fast feedback but does not replace native database
tests for dialect, locking, and transaction behavior.

For deferred dispatch, inject failure after the external system accepts a
deterministic operation id but before `WAITING_EXTERNAL` is stored. Prove that
reconciliation finds or safely classifies the orphan without issuing a second
non-idempotent side effect.
