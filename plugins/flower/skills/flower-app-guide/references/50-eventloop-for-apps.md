# Eventloop For Applications

Use this when an application workload is mostly waiting for external responses:
LLM responses, tool results, external callbacks, human decisions, or
deadline-based continuations.

## Choose The Right Runtime

Use ordinary `flower-core` tick-driven Flows when:

- the app can cheaply tick active Flows
- waiting is simple domain state or event checks
- deterministic manual ticks are enough

Consider `flower-eventloop` when:

- a Step mainly declares what event/deadline should wake it
- there may be many idle waits
- LLM/tool/external/human responses arrive asynchronously
- event-driven wakeup is clearer than repeated `stay()` checks

## Mental Model

```text
flower-core      : Worker -> Flow -> Step
flower-eventloop : EventWorker -> EventFlow -> EventStep
```

Do not mix the two models inside one Step. Pick the runtime that matches the
workflow and keep the application code readable.

## App Rules

- Start long LLM/tool/HTTP work outside the event-loop thread.
- Use the event-loop runtime's `runAsync` or `thenRunAsync` boundary for work
  that would otherwise block a callback.
- Publish a completion event when the external work finishes.
- Use correlation keys so the right EventFlow receives the result.
- Use deadlines for waits that can expire.
- Treat event payloads as notifications; durable truth should still be
  recoverable from application state when persistence matters.

## Durable Event Waits

- Override `onRecover(...)` for every durable EventStep that can await.
- Recreate pending waits during recovery without repeating one-shot effects.
- Prefer exact event waits or signal name/key correlation.
- Do not use predicate-based event waits in durable EventFlows; predicate
  lambdas are not represented in the checkpoint format.
- Give finite external waits a deadline and make `onTimeout(...)` choose an
  explicit failure, fallback, or retry route.

## Durable Effect Boundary

For `await(...).thenRun(...)` or `thenPublish(...)`, Flower saves the await
checkpoint before running the effect. A crash in that gap can recover the wait
without having dispatched the effect. For a transition result, the effect runs
before the next or terminal checkpoint, so a crash can recover the earlier
position after the effect already happened.

Do not treat either ordering as exactly-once execution. For important external
work, persist durable intent and a stable operation id, make dispatch
idempotent, and reconcile the persisted operation on recovery. Recreate the
wait without blindly repeating a one-shot effect.

## Bloom

Bloom can be the event bus that carries application events. It is not the
event-loop dispatcher itself. Use adapters where appropriate.
