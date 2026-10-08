# Testing With Flower Testkit

Use this when testing application Flows.

## Goal

Prefer deterministic tests over scheduler threads, sleeps, and real clocks.

Use:

- `Engine.attach()`, not `engine.start()`
- explicit ticks
- manual clock advancement
- in-memory events
- fake checkpoint stores
- no scheduler threads in ordinary unit tests
- no sleeps

## Harness Shape

`FlowTestHarness` bundles the setup most app tests need:

```text
FlowTestHarness
  Engine
  Worker
  ManualClock
  InMemoryEventBus
  RecordingFlowerListener
  FakeCheckpointStore
```

Example style:

```java
FlowTestHarness harness = FlowTestHarness.create();

harness.submit(flow)
        .tick()
        .assertFlow("order", "ORD-1")
        .isRunning()
        .currentStepIs("payment");
```

Publish events through the harness and tick again:

```java
harness.publish(new PaymentApproved("ORD-1"))
        .tick()
        .assertFlow("order", "ORD-1")
        .isFinished();
```

## Durable Recovery Tests

For durable Flows, restart the harness with the same fake checkpoint store,
recover through the same factory map, and assert that the current step and
execution identity survive.

Test the behavior the application needs:

- submit and reach waiting step
- checkpoint exists
- restart and recover
- same `tenantId`, `runId`, and `traceId`, plus `userId`, `sessionId`, and
  `correlationId` when the application supplied them
- next tick continues from the expected step

Use the testkit identity assertions such as `tenantIdIs(...)`,
`userIdIs(...)`, `runIdIs(...)`, and `traceIdIs(...)`; do not treat a
`runId`-only assertion as proof that the full execution identity survived
recovery. Flower `0.1.3` has no dedicated `sessionIdIs(...)` or
`correlationIdIs(...)`; inspect `executionContext()` when those values were
supplied, or compare it with the complete expected context.

Apply the identity checklist independently in every test that recreates a
harness, Engine, Worker, factory, Flow, or Step graph. Check at the first
observable post-recovery point. With `FlowTestHarness`, recovered Flows enter
the pending queue, so make the first identity assertion immediately after the
first deterministic `tick()` following `recover(...)` or `recoverAll(...)`,
not before that tick. When a terminal snapshot is retained, check again after
completion or failure. Cover every recovered wait and every success,
deadline/timeout, cancellation, and duplicate-delivery recovery path; a
complete identity assertion in one test never substitutes for missing
assertions in another.

## Source-Derived Test Cases

For event and wait flows, test:

- callback/event delivery only sets a signal or persists a fact
- domain mutation happens from `onTick`
- the same logical event or signal can be delivered twice without repeating a
  business side effect or corrupting the terminal domain/Flow state
- timeout path fails or retries visibly
- no test needs `Thread.sleep`

Do not substitute repeated worker ticks for duplicate-delivery coverage.
Publish or signal the same logical notification more than once.

For durable expiry specifically, also test:

- the deadline value is persisted before the waiting Step
- a tick immediately before the deadline remains waiting
- a tick exactly at or after the deadline takes the explicit expiry branch
- restart at the wait preserves the same deadline and does not resubmit work

When a workflow has more than one suppressed wait, keep an explicit
suppression-to-test map and exercise recovery from each supported wait state.
A restart test from a later Step does not prove recovery for an earlier
suppressed Step. Preserve existing suppression-specific tests when extending
the workflow.

Calling a domain `expire...()` method directly proves a persisted cancellation
or terminal transition only. It does not prove clock-driven deadline behavior.

For transient, non-restartable worker-lane async work, test:

- submit step moves to a waiting `stepNo`
- unfinished future/event returns `stay()`
- completed future is joined only after completion
- cancellation or reset cancels pending futures when applicable
- queue saturation or executor rejection becomes an observable failure

For durable or restartable external work, do not use a Step-local future as the
result channel. Test instead that:

- operation intent/id and lifecycle state are persisted before or atomically
  with dispatch
- async completion persists result/failure before it signals the Flow
- restart while the operation is in flight recovers the same operation
- repeated ticks and recovery do not submit a second provider/business request
  for a dispatch-once contract
- the recovered Step reaches terminal state from the persisted result or event

Two provider calls with the same idempotency key may demonstrate idempotent
effects, but they do not demonstrate dispatch-once.

For workflows with application checks or confirmations, test the chosen controls:

- invalid or unsupported commands stop before side effects
- authorization/validation failures prevent the side-effect service call
- confirmation or cancellation pauses/stops at the expected Step
- exceptions become visible failed results
- observable results distinguish skipped, waiting, failed, and succeeded states
