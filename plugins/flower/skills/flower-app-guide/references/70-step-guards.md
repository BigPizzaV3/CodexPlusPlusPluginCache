# Step Guards

Use this when a Step needs a quick pre-step decision before it is allowed to
enter or tick.

## Mental Model

A Guard is not a Step. It has no lifecycle. It is checked at the Worker tick
boundary before the guarded Step's `onEnter()` and before every `onTick()`.

```text
Worker tick
-> create/current StepRuntime
-> Guard.check(ctx)
-> pass? enter/tick Step
-> hold/goTo/fail? Step does not enter or tick on that tick
```

This makes Guard the Flower replacement for a pre-check layer such as
`PreCheckSeq`: a small decision point before Step execution, not another
workflow container.

## Results

- `GuardResult.pass()`: allow the Step lifecycle to proceed.
- `GuardResult.hold()`: keep the Flow on the current Step and try again on a
  later tick. If the Step has not entered yet, it still will not enter. If it
  entered on an earlier tick, it remains entered but does not tick.
- `GuardResult.goTo(stepId)`: move to another Step. If the current Step already
  entered, it exits; otherwise it is skipped.
- `GuardResult.fail(cause)`: fail the Flow. If the current Step already
  entered, it exits during failure handling.

## Good Uses

Use Guards for quick checks that should consistently run before a Step starts:

- common preconditions
- runtime readiness checks
- domain-state conditions that decide whether a Step may start
- redirecting to a fallback, handling, or cleanup Step
- fail-fast checks before a side effect begins

Example shape:

```java
Flow.builder("operation", operationId)
        .step("start-work", new StartWorkStep(service), ctx ->
                service.canStart(operationId)
                        ? GuardResult.pass()
                        : GuardResult.hold())
        .step("handle-blocked", new HandleBlockedStep(service))
        .build();
```

Prefer this ownership split:

```text
normal Step or application service -> records a blocking/readiness state
Guard                            -> reads that state and returns hold/pass/goTo/fail
separate handling Step            -> performs any user-visible or side-effect work
```

The Guard should not create that blocking state as its main job. It should read
the current state and make a quick routing decision.

## Boundaries

Keep Guards quick, deterministic, and non-blocking.

Avoid in Guards:

- long HTTP calls
- sleeps or polling loops
- direct LLM/tool/provider calls
- persistence writes or external state mutation
- event publication, dispatch, subscription, signaling, or cancellation
- multi-step logic that needs retry, timeout, or progress visibility

Guard-owned bookkeeping, such as a small in-memory attempt counter, is
acceptable. Business or externally visible state changes are not. Record those
changes in a Step or application service invoked by a Step, then let the Guard
read the resulting state.

If the check needs its own phases, waiting, retry, timeout, or side effects,
make it a Step. Guards decide whether a Step may start; Steps own workflow
progression.

## Relation To StepResult

Guard decisions happen before Step execution. `StepResult` decisions happen
after `onTick()`.

Use a Guard when the Step should not be allowed to execute on this tick. Use
`StepResult.stay()` when the Step itself has started and owns the wait
internally.
