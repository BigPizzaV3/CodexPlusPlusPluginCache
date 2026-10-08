# Host Integration

## Keep Adapters Thin

REST controllers, MCP tools, schedulers, message listeners, and AI planners
should authenticate input, construct an `ActionProposal`, invoke the runtime,
and map the returned result. They must not call the domain mutation directly.

Keep the domain operation in an application/domain service called by the
registered executor. This preserves one side-effect boundary regardless of how
many request channels exist.

Use one host-owned proposal factory or governed-action service to populate the
verbose proposal identity consistently. Prefer `ActionProposal.builder(...)`
at that boundary; do not let controllers, bots, and schedulers independently
invent request channel, proposer type, principal, tenant, and idempotency
semantics. On 0.3, populate request channel and proposer type explicitly;
the legacy origin field has been removed.

## Build Trusted Context

Resolve principal, roles, tenant or office, and request channel from trusted
host infrastructure. The proposer type may describe an AI or system proposer,
but it does not grant authority. Policy evaluates the execution principal and
current resource facts.

Create a unique run id for each accepted request. Reuse an idempotency key for
retries of the same logical operation. Do not reuse the run id as the
idempotency key or create a second run for a duplicate callback.

Scope duplicate storage and SQL uniqueness by at least tenant, action id, and
idempotency key. Add principal/resource visibility when returning an existing
result. In 0.3, policy runs before duplicate lookup, so an unauthorized request
cannot read a cached result; the storage scope remains necessary for tenant
isolation and correct idempotency.

## Persistence And Transactions

Use a queryable `RunStore` when a result can outlive the request.
`InMemoryRunStore` may be sufficient for same-JVM local/test use, but use a
shared durable store when a result can outlive the process, multiple instances
must observe it, or production deferred/recovery behavior depends on it. When
using JDBC persistence, apply the runtime's database migrations through the
host's migration system and confirm the schema owner and tenant isolation
policy.

If an executor changes domain state and emits an event, use the host's normal
transactional outbox or after-commit mechanism. The runtime cannot make an
arbitrary database mutation and external message globally atomic.

Expose status by reading the stored `ActionRun`; do not infer completion
from HTTP connection state, a local future, or a queue message alone.

Classify every failure with a stable code and explicit retry disposition. Use
`AFTER_BACKOFF` only for a known transient condition. Use `MANUAL_REVIEW` when
the executor may have produced a side effect before the failure became visible.

## Deferred Callback Boundary

Authenticate callbacks independently of the original request. Resolve the
tenant from trusted callback credentials or stored run ownership, then verify
run id, attempt token, external operation identity, and terminal result shape.
Invoke the runtime completion API and return its consistent stored outcome.

Rate-limit callbacks and record rejected attempts without leaking whether a
run exists in another tenant. Do not accept a caller-supplied tenant id as
sufficient authorization.

For deferred dispatch, derive a deterministic operation id, make enqueue/send
idempotent, and reconcile old `RUNNING` as well as `WAITING_EXTERNAL` Runs. Use
a transactional outbox where the host must atomically connect its database to
queue delivery.

Do not render every runtime `CANCELLED` result as confirmed external
cancellation. Preserve cancellation codes, warning output, and
`MANUAL_REVIEW` so operators can distinguish “runtime closed” from “remote work
confirmed stopped”.

## Operational Readiness

Provide metrics for proposals, control rejections, approval latency, dispatch
latency, waiting runs, terminal outcomes, CAS conflicts, stale callbacks,
executor saturation, and recovery actions. Alert on growing non-terminal age
and repeated reconciliation failures.

When the host already uses Flower's common observation pipeline, optionally
add `flower-action-runtime-observability` and adapt Action audit events into a
host-owned `FlowerObservationSink`. Keep the authoritative `AuditSink` record;
the observation adapter is a payload-light operational projection and excludes
reasons, messages, action output, arbitrary metadata, principals, tenants, and
users by default. Do not add this module merely to obtain ordinary Action audit
history.
