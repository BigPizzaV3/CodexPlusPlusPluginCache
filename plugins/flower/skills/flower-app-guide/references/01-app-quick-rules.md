# Flower Application Quick Rules

Read this before writing or editing application code that uses Flower.

## When To Use Flower

Use Flower when application work has multiple phases and should progress over
time or in response to events, timeouts, human decisions, or domain state
changes.

Do not use Flower to replace all domain logic. Use it to make long-running
application orchestration explicit and testable.

Use this distinction:

```text
Bloom/Kafka/domain events = notification that something happened
Flower                   = stateful orchestration across steps, waits, retry, and timeout
Domain database/store    = business source of truth
```

## Core Shape

Keep the application workflow readable:

```text
Engine -> Worker -> Flow -> Step -> StepResult
```

- A Flow represents one workflow instance, such as one order, task, session,
  transfer, game turn, or external operation.
- A Flow can also represent one active process, not one row. For example, a
  long-running station Flow can process many queued items while the items remain
  domain data.
- A Step represents one small phase of that Flow.
- A Step returns `stay`, `done`, `repeat`, `goTo`, `finish`, or `fail`.
- Use stable string step ids because they appear in logs, dumps, checkpoints,
  and admin views.
- Step instances are per-Flow state holders. Create fresh Step instances for
  each Flow; do not make production Step classes singleton Spring components.

## Runtime Rules

- Do not block a Worker tick with `Thread.sleep`, long HTTP calls, LLM calls,
  tool calls, or hidden scheduler loops.
- Do not call a Worker's manual tick method from a Step, Guard, listener, or
  callback already running on that Worker's tick thread.
- Put long or blocking work behind async APIs, bounded executors, external
  runtimes, or application services. Let the Step start it and observe its
  result.
- Prefer this internal cursor shape for long work:

```text
stepNo 0  = submit external/long-running work
stepNo 10 = observe persisted result/event/timeout
stepNo 20 = retry/backoff cursor when needed
```

A completed `Future` may be observed without blocking in a transient,
non-restartable Flow. It is not durable operation state. A durable or
restartable Flow must not keep its only completion handle in a Step field.

- Event callbacks should only signal or enqueue. The Step should decide on the
  next tick by checking domain state.
- Flower signals are wake-up hints, not business facts.
- The database or domain store should remain the source of truth.
- Choose Flower workers as execution lanes, not feature names. Do not add a new
  Worker just because a new button, flow, or AI harness exists. Create a
  separate Worker only for distinct blocking risk, priority, isolation,
  concurrency, or backpressure needs.
- Do not casually add application schedulers for workflow progression when the
  application already uses Flower. Periodic checks, monitors, retries, and
  delayed loops should usually be long-lived Flows that advance with `stepNo`,
  `ctx.startTimeout(...)`, domain state, and `StepResult.stay()`.
- External schedulers are allowed only as a narrow layer above Flower, such as
  starting the Flower runtime, submitting bootstrap/recovery Flows, bridging an
  external platform trigger, or checking that the orchestration runtime itself
  is alive. If a scheduler would own ordinary business workflow transitions,
  require explicit developer/owner approval and document why Flower should not
  own that progression.

## Domain Boundary Rules

- Controllers and listeners stay thin. Domain/application services own business
  invariants and mutations.
- Steps orchestrate those services. They should not reimplement business rules
  or infrastructure concerns that already belong to application services.
- Public clients should read durable resource state through normal query APIs.
  Do not expose Bloom or transient Flower signals as the public API contract.
- Submit Flower flows after the surrounding transaction commits when the flow
  depends on newly persisted domain state.

## Unsafe Blocking Request Response Contract

When a request asks to put HTTP, `Future.get()`, `Thread.sleep`, a busy loop, or
another unbounded wait inside a Worker/EventWorker tick:

1. Refuse the blocking mechanism explicitly and explain that it occupies the
   execution lane, stalls unrelated Flows, and creates backpressure.
   Put this consequence in the agent-authored response itself; reading or
   citing this rule is not a substitute.
2. Do not stop at the refusal or merely say that existing code is safer.
3. Give the complete replacement design: atomically dispatch the external work
   once with an idempotency/operation key, return promptly, and observe durable
   result state or a wake-up event on later ticks.
4. For a durable or restartable Flow, persist the outbound intent and operation
   lifecycle before or atomically with dispatch. Completion code writes the
   terminal result/failure before it signals. Recovery reuses and observes the
   same operation; it does not submit a second provider request merely because
   an in-memory `Future` was lost.
5. Include an explicit persisted cancellation or deadline path. For a durable
   expiry, persist the deadline criterion before entering the wait.
6. Preserve or add deterministic success, cancellation/deadline, duplicate
   tick/event, and restart-during-in-flight tests. For a dispatch-once contract,
   assert that the provider/business dispatch count remains one across restart;
   two calls with the same idempotency key are not proof of dispatch-once.
   Do not accept a request to remove or omit those tests.

The external request is possible in Java; only its placement and synchronous
waiting inside the Flower lane are unsafe.

## Durable Rules

- Durable Flower is checkpoint/resume, not replay.
- Durable Steps must be idempotent or guarded by domain state.
- Store durable deadlines and business facts in domain state, not only in
  volatile signals.
- Store durable external-operation intent, status, result/failure, and stable
  id in domain state or an outbox/operation store. `Future`, `CompletionStage`,
  callback handles, and Step fields are volatile coordination aids only.
- Use `ExecutionContext` for tenant/user/session/run/trace/correlation identity,
  not business policy or domain objects.
- Runtime recovery can be based on durable business state before full Flower
  persistence exists, but recovered flows must tolerate re-entry and duplicate
  transport commands.
- Embedded desktop or agent applications may keep domain tables and Flower
  checkpoint tables in one local SQLite file. The host application still owns
  the driver, schema migration, database path, and SQLite connection settings.
- A durable EventStep that waits must recreate its waits in `onRecover()`.
  Prefer exact event types or durable signal name/key correlation; predicate
  await lambdas are not checkpointable.
- Give finite EventStep waits a deadline and handle `onTimeout()` explicitly.
- Treat EventStep effects around checkpoints as at-least-once-capable. Use
  durable intent, a stable operation id, idempotent dispatch, and recovery
  reconciliation for important external work.

## Flower Check Suppression Gate

Do not treat `flower-check: no findings` as sufficient when
`FLOWER-CHECK-PARSE` reports fallback analysis. Fix parser compatibility or use
strict parsing in CI; parse diagnostics cannot be suppressed or baselined.

Do not treat a clean report as sufficient until you search the
changed workflow for suppression or ignore directives. Audit pre-existing
directives too; touching a workflow makes its active safety exceptions part of
the review scope.

Prefer removing the directive and using a Flower-native wait. Keep a wait-rule
suppression only when all of the following are true:

- the source states why the checker-recognized native alternative is
  incompatible or unsuitable for the selected persistence, semantics, or
  operational model;
- the wait has a cancellation, deadline/timeout, max-bound, or other terminal
  path appropriate to its semantics; durable controls live in persisted state,
  and a durable time-bounded wait has a previously persisted deadline; and
- deterministic tests cover the selected terminal control, duplicate
  delivery, and restart where recovery is supported.

A truly indefinite monitor can be the exception only when the suppression
documents its ownership, liveness, and shutdown model instead of merely calling
the wait intentional or unbounded.

Duplicate-delivery coverage means publishing or signaling the same logical
notification more than once and proving that side effects are not repeated and
the terminal domain/Flow state stays correct.

## Step Guard Rule

Use a Step Guard when a Step needs a quick pre-step decision before its
lifecycle starts. A Guard is checked at the Worker tick boundary before
`onEnter()` and before every `onTick()`.

Guard results mean:

- `pass`: enter/tick the Step normally.
- `hold`: keep the Flow on this Step and do not call `onEnter()` or `onTick()`
  on that tick. If the Step already entered earlier, it remains entered but
  paused.
- `goTo`: move to another Step. If the current Step already entered, it exits;
  otherwise it is skipped.
- `fail`: fail the Flow. If the current Step already entered, it exits during
  failure handling.

Good Guard use cases:

- a common prerequisite check before several Steps
- waiting until a condition becomes true before a Step is allowed to start
- redirecting to a fallback, handling, or cleanup Step
- fail-fast validation before side effects begin

Keep Guards quick, read-only, and non-blocking. Do not save, update, delete,
publish, send, submit, schedule, subscribe, signal, or cancel business work
from a Guard. If the check itself has phases, waits, side effects, retry, or
user-visible progress, model it as a normal Step instead of hiding that
workflow inside a Guard.

## AI-Agent Rules

- Prefer readable Flow builders and explicit Step classes over reflection or
  annotation magic.
- Keep application workflow code in a workflow/application layer, not buried in
  entities or random listeners.
- Add focused tests when changing behavior.
- Run the host application's relevant test/check command before finishing.
