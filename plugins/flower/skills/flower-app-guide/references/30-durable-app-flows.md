# Durable Application Flows

Use this when application workflows need checkpoint/resume after restart.

## Mental Model

Flower durable mode stores where a Flow should resume. It does not replay every
event or serialize the whole Java object graph.

In many applications, especially before Flower-native persistence is enabled,
runtime recovery can be based on durable business state:

```text
DB business state = source of truth
Flower runtime state = recoverable orchestration state
```

Application responsibilities:

- rebuild a fresh Flow through a factory
- make side effects idempotent
- store business facts in the domain database
- apply JDBC schema or migrations explicitly when using JDBC persistence
- coordinate multi-process recovery if several JVMs share the same store

## What Flower Stores

Flower stores:

- `flowType`
- `flowKey`
- state
- current step id
- current `stepNo`
- current step entered flag
- persistence mode
- worker name
- updated time
- definition version
- `ExecutionContext`

Flower does not store:

- the complete Java object graph
- arbitrary Step/domain object state
- event history for deterministic replay
- exactly-once side-effect execution history
- distributed workflow ownership across JVMs

## Authoring Durable Steps

Declare recovery policy for durable steps. Use idempotent re-entry when
`onEnter` can safely run again. Use resume-only behavior when initial entry and
recovery setup differ.

Do not keep crucial business state only in Step fields. After recovery, the app
should be able to rebuild the Flow and decide from domain state.

If the Flow dispatches external commands, make command re-entry safe:

- persist the business operation id, outbound intent, lifecycle state, and
  terminal result/failure outside the Step
- never use an empty or lost Step-local `Future` as the reason to submit the
  provider/business operation again
- recreate subscriptions, queries, or transport attachments for the same
  persisted operation when recovery requires them
- match ACK/COMPLETE/FAIL events by current command id when available
- check domain completion first before dispatching another command
- use stable flow keys so duplicate submission policy can protect single-flight
  work

The transport layer may retry delivery with the same stable idempotency key,
but that retry policy belongs to the durable dispatcher/outbox and must not be
presented as exactly-once execution. When the application contract says
dispatch once, a restart test must keep the provider/business dispatch count at
one rather than accepting two calls with the same key.

## ExecutionContext

Use `ExecutionContext` for execution identity:

- tenant id
- user id
- session id
- run id
- trace id
- correlation id

Do not use it for:

- domain objects
- application decisions
- permissions
- confirmation state
- external-operation state
- arbitrary metadata maps

Keep every supplied identity value during recovery, not only `runId`. Every
recovery scenario must independently prove its own `tenantId`, `userId`,
`sessionId`, `runId`, `traceId`, and `correlationId` values where supplied.
This includes recovery from each supported wait state and recovery on success,
deadline/timeout, cancellation, and duplicate-delivery paths. Evidence from
one test does not cover another recovery path.

## Durable Waits

Signals are in-memory wake-up hints. Durable Step decisions should be based on
domain state that can be checked again after restart.

Do not rely on volatile signal payloads as the source of truth for durable
recovery.

For a long-lived deadline, persist the exact deadline (or another deterministic
expiry criterion) in domain state before entering the wait. Recovered Steps
must compare the current/injected clock with that stored value. Do not replace
this with `StepContext.startTimeout(...)`, and do not claim deadline coverage
when a test merely mutates the status to expired without exercising a stored
criterion.

For a durable `EventFlow`, an awaiting `EventStep` must override
`onRecover(...)` and recreate only its pending waits. Do not repeat one-shot
effects such as an external request when rebuilding those waits. Exact event
type waits, signal name/key waits, and deadlines can be checkpointed;
predicate-based event lambdas cannot.

## Embedded SQLite

Flower `0.1.3` provides SQLite dialects and schemas for both core and
event-loop checkpoint stores. A desktop or locally installed agent application
may use one `DataSource` and one SQLite file for its domain tables and Flower
checkpoint tables.

The host application remains responsible for:

- adding the SQLite JDBC driver
- choosing a local database path
- applying the core schema, event-loop schema, or both
- configuring WAL mode and a busy timeout
- keeping transactions short and coordinating recovery if more than one
  process can open the same database

Flower does not create the SQLite tables automatically. SQLite is a good fit
for a single local application process; sharing the file does not provide
distributed Flow ownership.

## Decision And Confirmation State

Confirmation, cancellation, quota, permission, and workflow-stage decisions are
application state when the host application needs them. Store durable decisions
in domain/application tables and verify them before performing side effects.

Do not encode business authority only in:

- AI output
- chat message metadata
- action payload fields
- `ExecutionContext`
- transient Flower signals

If a rejected/paused operation later becomes allowed, resubmit or resume through
the same host-application checks rather than bypassing them with a special
backdoor path.
