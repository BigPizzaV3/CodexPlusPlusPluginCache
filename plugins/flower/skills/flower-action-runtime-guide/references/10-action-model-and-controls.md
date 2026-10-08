# Action Model And Control Boundary

## Model A Request As A Proposal

An entry point may request a side effect, but it must not perform that side
effect directly. Convert REST, UI, MCP, scheduler, batch, and AI planner input
into an `ActionProposal`, then let the registered action pipeline decide
whether execution is allowed.

Use a stable action id such as `document.publish` or `invoice.cancel`. Register
one `ActionDefinition` for that id and keep the actual domain mutation inside
its registered executor.

## Keep Identities Separate

Do not compress these values into one generic actor string:

| Concern | Meaning |
| --- | --- |
| Request channel | Where the request entered: UI, API, MCP, scheduler, batch, or another adapter |
| Proposer type | Who proposed it: human, agent, system, or service |
| Execution principal | The authenticated identity whose authority is evaluated |
| Tenant or office | The data-ownership boundary used by policy and persistence |
| Run id | The unique lifecycle identity of this request |
| Idempotency key | The logical operation key used to collapse transport retries |

Derive authenticated identity and tenant data from trusted host context. Never
trust an AI-generated payload or an arbitrary callback body for these values.

## Required Control Order

The 0.3 initial pipeline uses this order:

```text
record proposal / create ActionRun
  -> registry resolution
  -> input validation
  -> policy evaluation
  -> duplicate reservation
  -> optional approval request
  -> pre-execution guard
  -> executor dispatch
  -> result persistence and audit
```

Registry resolution, validation, and policy run before duplicate reservation.
An invalid or unauthorized request therefore cannot obtain a cached result via
`RETURN_EXISTING`. A production duplicate policy must still scope keys by at
least `tenantId + actionId + idempotencyKey`. If a stored result is not safely
visible to every authorized principal in that tenant, add principal/resource
scope or reject the duplicate without returning the result. Never use a global
`idempotencyKey` alone.

Reservation, completion, and release must also form one atomic state machine
per duplicate scope. A policy that reads a completed-result map and later adds
to a separate running set has a completion race: the original can publish its
result and remove its reservation between those operations, allowing the
duplicate to be accepted and later overwrite the terminal result. Use a single
lock or atomic map transition for in-process policies and durable
uniqueness/CAS for production policies. A reserve concurrent with completion
must return either an in-progress decision or the stored result, never a new
acceptance.

In `0.3.3`, `InMemoryDuplicateActionPolicy` implements that owner-aware atomic
state machine for concurrent callers inside one JVM. It stores the reservation
owner from trusted `runId`; a repeated reserve does not return another
`ACCEPT`, and stale completion/release cannot replace the first terminal result
or remove a newer owner. It remains non-durable and unbounded, so use
`JdbcDuplicateActionPolicy` or another shared durable policy for restart or
multi-process coordination.

Both shipped policies always include `tenantId + actionId + idempotencyKey`.
Their default visibility scope is tenant-wide. When a cached result is
principal-restricted or resource-bound, configure a stable
`DuplicateVisibilityScopeResolver` from trusted host identity or canonical
resource context. Do not use an arbitrary action payload, AI output, or
unverified callback field as the visibility authority.

Approval resume does not reserve again; it keeps the original reservation and
uses this order:

```text
registry resolution
  -> input validation
  -> policy re-evaluation
  -> pre-execution guard
  -> executor dispatch
  -> result persistence and audit
```

Approval is not a permanent authorization grant. Between proposal and approval,
the tenant, resource, role, account state, or action definition may have
changed. On approval resume, resolve the definition again, validate again,
evaluate policy again, and run `PreExecutionGuard` immediately before dispatch.

Use `PreExecutionGuard` for last-moment facts that must be true at the side
effect boundary, such as resource version, current ownership, account lock, or
an external safety condition. Keep durable business invariants in the domain
service as well.

## Results Are A Machine Contract

Use `ActionExecutionStatus` for the broad outcome and
`ActionExecutionResult.code()` for a stable, machine-readable reason. Use
`RetryDisposition` to tell callers whether retrying is meaningful. Human
messages are for operators and users; clients must not parse them to make
workflow decisions.

Examples of useful result-code families include validation rejection, policy
denial, approval pending or rejected, duplicate request, dispatch failure,
external timeout, stale attempt, cancellation, and domain-specific rejection.
Keep codes stable across wording and localization changes.

Unknown execution failures are not safely retryable because a side effect may
already have occurred. Prefer the explicit factories:

```text
retryableFailure    AFTER_BACKOFF
correctableFailure  AFTER_CORRECTION
permanentFailure    NEVER
manualReviewFailure MANUAL_REVIEW
```

## Audit And Trace

Audit the proposal, every control decision, approval transition, dispatch,
completion, cancellation, and failure with the run id and tenant boundary.
Trace data helps diagnose execution; audit data explains who requested what,
which controls decided it, and what terminal result was recorded. Do not treat
ordinary application logs as the durable audit record.
