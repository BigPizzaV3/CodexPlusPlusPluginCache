# Flower Action Runtime Quick Rules

## Mental Model

The runtime controls a business action; it does not replace the domain service
that performs the work.

```text
UI / API / CLI / Batch / Scheduler / MCP / AI planner
-> ActionProposal
-> record proposal / create ActionRun
-> registry
-> input validation
-> policy
-> duplicate reservation
-> optional approval
-> policy revalidation
-> PreExecutionGuard
-> ActionExecutor dispatch
-> ActionRun + audit + ActionExecutionResult
```

The controller, listener, planner, or callback adapter must not call the
side-effect service through a parallel uncontrolled path.

## Keep Identity Dimensions Separate

```text
requestChannel  where the request entered: UI, API, MCP, scheduler, recovery
proposerType    who/what suggested it: user, AI planner, system, service
context.userId  execution principal whose authority is used
tenantId        isolation boundary
runId           one execution lifecycle
idempotencyKey  duplicate/retry grouping key
```

Do not use AI metadata, proposal reason, request channel, or callback payload as
authorization. Policy must use trusted host identity and resource data.

## Result Status Is Not Run Status

Caller-facing results:

```text
PENDING_APPROVAL  wait for an ApprovalDecision
ACCEPTED          dispatched; query/complete the Run later
SUCCEEDED         terminal success
CANCELLED         terminal cancellation
DENIED            policy/control denial
VALIDATION_FAILED caller must correct input
FAILED            execution/runtime failure
```

Persisted lifecycle also contains internal states such as `REQUESTED`,
`VALIDATING`, `POLICY_EVALUATED`, `RUNNING`, `WAITING_APPROVAL`,
`WAITING_EXTERNAL`, `EXPIRED`, and `RUNTIME_FAILED`.

Use the stable result `code` and `RetryDisposition`; keep `message` for humans.

## Pick The Execution Mode

```text
SynchronousActionExecutor finishes in the initiating call
AsyncActionExecutor     short in-process async work on a bounded host lane
DeferredActionExecutor externally owned queue/worker/callback work
```

Use `RunStore.noop()` only for purely synchronous demos/tests. Approval, async,
deferred completion, cancellation, and recovery need a queryable store.

## Safety Rules

- Approval is not permanent authorization. Re-evaluate policy before execution.
- Keep `PreExecutionGuard` quick, side-effect free, and based on current state.
- Persist `RUNNING + attemptToken` before the side effect begins.
- Accept completion only for `WAITING_EXTERNAL` with the matching attempt token.
- Make terminal methods idempotent: repeat calls return the stored result.
- CAS protects Run state, not external exactly-once effects, distributed work
  ownership, or leader election.
- Resolve, validate, and authorize before duplicate lookup. Still scope
  duplicates by at least `tenantId + actionId + idempotencyKey` and add
  principal/resource visibility when existing results are not shareable.
- Use `InMemoryDuplicateActionPolicy` only for one-JVM, restart-insensitive
  work. Configure a trusted `DuplicateVisibilityScopeResolver` when completed
  results are not tenant-wide. Use `JdbcDuplicateActionPolicy` or another
  shared owner-aware atomic policy for restart or multi-instance coordination.
- Keep `ActionRun`, duplicate reservation, and domain-effect truth distinct.
  Never steal an old `RUNNING` reservation by age alone; reconcile uncertain
  work. Preserve the first terminal duplicate result even when its retry
  disposition says a later explicit attempt may be meaningful.
- Classify failures explicitly. Unknown failures default to `MANUAL_REVIEW`;
  only known transient failures should use `AFTER_BACKOFF`.
- A terminal `CANCELLED` Run rejects later normal completion but does not prove
  that an external operation physically stopped.
