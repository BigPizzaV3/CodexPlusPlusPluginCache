# Flow And Step Authoring

Use this when writing application Flows and Steps.

## Recommended Application Shape

Keep Flower code in an application/workflow layer:

```text
api               REST/Kafka input
domain            aggregate, status, store/repository, domain service
event             plain domain/runtime event records
workflow.factory  Flow composition and Step construction
workflow.step     production Step classes
workflow.worker   application handles for named Flower workers
config/infra      DB, Kafka/Bloom adapter, Flower Engine config, listeners
```

The exact package names can differ. The important rule is that Flower should
coordinate domain work without replacing the domain model.

## Flow Design

- Use `Flow.builder(flowType, flowKey)` with stable ids.
- Let `flowType` describe the kind of workflow, such as `order` or
  `task-review`.
- Let `flowKey` identify the specific domain instance. If tenant-local ids can
  collide, make the key globally unique in the host application.
- Build Flows through a factory so dependencies and domain ids are explicit.
- Model the active process, not every table row by reflex. If the domain has a
  long-lived station, zone, monitor, or control loop that processes many items,
  one Flow for that process may be better than one Flow per item.
- Validate user-selected or AI-selected step lists before building a custom
  Flow. Reject unknown step ids and enforce required ordering/first/last steps
  in application code.
- Use `DuplicatePolicy.REJECT` when duplicate submissions are errors. Use
  `DuplicatePolicy.REPLACE` only when replacing the active orchestration for the
  same flow key is intentional.

Example shape:

```java
Flow createOrderFlow(String orderId) {
    return Flow.builder("order", orderId)
            .step("accept", new AcceptOrderStep(orderService))
            .step("payment", new WaitPaymentStep(orderRepository))
            .step("fulfill", new FulfillOrderStep(warehouseService))
            .build();
}
```

## Worker Lane Design

Flower Workers are execution lanes, not feature names. Choose a lane by
execution character:

- Shared lane: steps submit work and later observe event or domain state. A
  transient, non-restartable Flow may also observe an in-process future.
- Separate lane: slow external IO, blocking legacy library, CPU-heavy work,
  distinct priority, or distinct concurrency/backpressure policy.
- Bounded executor: unavoidable blocking bridge work that must not occupy the
  Flower worker tick thread.

Do not create a new Worker for every new Flow, AI harness, button, endpoint, or
chat command.

Do not invoke a Worker's manual tick method from code already executing on that
Worker's tick thread. A nested tick can execute sibling Flows and checkpoint
effects twice; Flower `0.1.3` rejects this re-entry. Tests and host control code
must drive ticks from outside the Worker execution callback.

For periodic or monitoring workflows, prefer one Worker lane for the execution
class and many Flows inside it. Each Flow can keep its own cadence with
`stepNo`, timeouts, and `stay()`:

```text
monitor-a flow
  stepNo 0   run lightweight check
  stepNo 100 wait until next due time
  goTo stepNo 0

monitor-b flow
  stepNo 0   run lightweight check
  stepNo 100 wait until its own next due time
  goTo stepNo 0
```

The Worker interval can be short enough to tick responsive Flows, while each
Flow owns its own due time. Avoid creating one Worker per monitor, one Worker
per polling cadence, or one scheduler per workflow unless there is a clear
isolation reason.

## Scheduler Boundary

When Flower owns a workflow, an external scheduler should not also own the same
workflow progression. Keep progression in Flow/Step code so state, timeout,
retry, and tests stay visible in one model.

Acceptable scheduler-like boundaries are narrow:

- bootstrap the Flower runtime
- submit startup recovery or seed Flows
- supervise the Flower runtime from above
- bridge an external platform trigger into a Flow submission

Avoid:

- `@Scheduled` methods that poll business state and mutate workflow state
- cron jobs that duplicate Step retry/backoff logic
- timer callbacks that decide business transitions outside Flow/Step code
- separate scheduler loops for each monitor when one Worker lane can tick many
  monitor Flows

If one of these shapes is truly necessary, get explicit developer/owner
approval and record the reason. The usual valid reasons are runtime supervision,
integration with an external scheduler/platform, startup recovery, or an
isolation requirement that cannot be represented cleanly as a Flower Flow.

## Step Model

- Keep Steps small and named after a phase.
- Dependencies should be constructor-injected services or repositories.
- If a Step needs many services, group them in a user-owned `Deps` object.
- Use `onEnter` to start, subscribe, or initialize.
- Use `onTick` to check domain state and return a transition.
- Use `onExit` to clean local resources if needed.
- `goTo("step-id")` completes the current Step lifecycle, including `onExit`,
  before entering the target Step. Do not rely on a jump to skip cleanup.
- Create fresh Step instances for every new Flow. Steps may hold subscriptions,
  local signal state, timeouts, attempts, or stepNo-driven cursors. A pending
  future may be held only when the Flow is explicitly transient and
  non-restartable.
- Treat every Step field as volatile in a durable or restartable Flow. Persist
  the operation id, lifecycle state, result/failure, and deadline as applicable;
  on recovery, query or reattach to that same operation. Never dispatch the
  provider/business operation again merely because a Step-local future is
  absent.
- The same Step instances may be reused inside one Flow loop with `goTo`, as
  long as Step reset/enter behavior is correct.
- Use a Step Guard only for a quick pre-step decision. A Guard runs before
  `onEnter()` and before every `onTick()`; `hold`, `goTo`, and `fail` prevent
  `onTick()` on that tick and may prevent first entry when the Step has not
  entered yet.

Avoid:

- giant Steps that contain an entire business process
- hidden sleeps or polling loops
- direct background thread creation inside Steps
- reflection-based Step discovery as the default app pattern
- singleton Step beans in Spring production code
- abstract Step base classes created only to remove a few lines of duplicate
  try/catch

## StepResult Guidance

- `stay()`: condition is not ready yet.
- `done()`: this phase is complete.
- `repeat()`: reset and retry this Step from the beginning.
- `goTo("step-id")`: jump to a named step for explicit branching.
- `finish()`: Flow is complete before declared steps are exhausted.
- `fail(cause)`: Flow failed and should be visible as failed.

Use `stepNo` only as a tiny cursor inside one Step. If it starts representing
business states, split the workflow into named Steps.

Prefer this `stepNo` pattern for durable or restartable async work:

```text
0  persist operation identity/intent, then start or continue that operation
10 observe persisted ACK/lifecycle/result, event, or durable deadline
20 transition on persisted completion/failure or apply the explicit retry policy
30 optional later backoff/recovery cursor for the same operation
```

For a transient, non-restartable Flow only, a Step may submit a future and
observe it on later ticks. Call `join()` or `get()` only after
`future.isDone()` is true; otherwise return `StepResult.stay()`. Do not use that
pattern as the completion channel for a durable or restartable Flow.

## Transaction Boundary

When a REST or service command persists domain state and then submits a Flow,
submit after commit if the Flow reads that new state:

```text
create domain row in transaction
register afterCommit callback
submit Flow to Worker
return resource id/status to caller
```

This avoids a Worker tick reading state that the request transaction has not
committed yet.
