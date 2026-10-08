# Events And Waits In Applications

Use this when an application Flow waits for Kafka events, domain events,
callbacks, confirmations, timeouts, or Bloom events.

## Main Rule

An event means "something happened." The Step decides whether the Flow can move
forward.

```text
External event -> persist/update domain fact -> publish/signal Flower
Flower Step    -> check domain fact on tick -> return StepResult
```

For in-process Bloom integration:

```text
Bloom = event delivery inside a runtime/module
Flower = orchestration over time, retry, timeout, and step transitions
```

## Callback Rule

Event callbacks should only:

- call `ctx.signal(...)`
- enqueue a small payload
- publish a wake-up event

They should not:

- mutate Step fields unsafely from arbitrary threads
- complete the Flow directly
- do long IO or business work
- call blocking APIs
- treat the payload as durable truth unless it has been persisted elsewhere

## Kafka Or Domain Event Pattern

In a Kafka listener or domain event handler:

1. Save the business fact in the domain store.
2. Publish the event to Flower's `EventBus`.
3. Let the waiting Step check the domain store on the next tick.

Inside the Step:

```java
@Override
protected void onEnter(StepContext ctx) {
    ctx.subscribe(PaymentApproved.class, event -> {
        if (event.orderId().equals(ctx.flowId().flowKey())) {
            ctx.signal("payment-approved");
        }
    });
}

@Override
protected StepResult onTick(StepContext ctx) {
    if (orders.isPaymentApproved(ctx.flowId().flowKey())) {
        return StepResult.done();
    }
    return StepResult.stay();
}
```

The signal wakes or marks the Step. The domain store decides truth.

## Command/Ack/Complete Pattern

When a Step dispatches work to an external runtime, model the lifecycle
explicitly instead of blocking:

```text
stepNo 0  persist operation intent/id, dispatch, and start ACK timeout
stepNo 10 wait ACK event, failure event, completion event, or timeout
stepNo 20 wait completion/failure event or timeout
stepNo 30 retry backoff before creating a fresh command
```

Transport command rows, WebSocket messages, Kafka offsets, or one-time URLs are
not usually the business source of truth. Persist the business result in the
domain table. A recovered Flow may recreate a subscription, query, or transport
attachment for the same persisted business operation; it must not initiate a
second provider/business operation merely because an in-memory handle was lost.
If the delivery layer retries, it reuses the stable idempotency key and records
the attempt outside the Step; do not describe at-least-once transport delivery
as exactly-once dispatch.

## Durable Async Handle Rule

An in-process `Future` or `CompletionStage` can be observed after completion in
a transient Flow. It is not a durable result channel.

For durable or restartable external work:

1. persist an operation/outbox record and stable id before dispatch;
2. let a dispatcher or application service own the asynchronous handle;
3. persist success, failure, cancellation, or retry state before signaling;
4. let `onTick` read that persisted lifecycle record; and
5. on recovery, reuse/query the same operation rather than calling the provider
   again because a Step field is empty.

A Step-local future plus a persisted idempotency key is not sufficient. It can
lose the only completion result and cause duplicate provider requests after
restart.

## User Input And Confirmation Waits

Treat user input, confirmation, and similar decisions as durable host
application state when the workflow must survive restarts or later inspection.
A Step may signal on the callback, but the next tick should verify the persisted
decision and its scope. Do not let a transient signal or payload field alone
become the authority for a business side effect.

## Timeouts

For transient Flows, `ctx.startTimeout(...)` can model a runtime timeout.

For durable Flows, store deadlines in domain state and check them in `onTick`.
Do not depend only on volatile timeout state across restarts.

### Durable Deadline Contract

For a durable wait that can expire, persist the deadline criterion before the
Flow starts waiting. A useful domain record contains:

```text
operation/idempotency key
submission state and attempt
deadline epoch millis (or equivalent durable instant)
cancellation state
terminal result/failure state
```

On every later tick, evaluate persisted state in this order:

1. terminal success/failure
2. explicit persisted cancellation
3. injected/current time greater than or equal to the persisted deadline
4. otherwise `stay()`

Persisting only `EXPIRED` after an external caller decides to expire the work
does not prove a durable deadline. A test that directly calls an `expire...()`
method is a cancellation/state-transition test, not a deadline test. For an
expiry requirement, drive an injected/manual clock just before and exactly at
the stored deadline and include a restart at the waiting step.

## Bloom

If the application already uses Bloom, use the Flower Bloom adapter so Flower
Steps can subscribe to the same in-JVM event stream. Keep Bloom as the event
bus and Flower as the orchestration runtime.

Bloom is not a public client contract. UI/API clients should poll or subscribe
to normal persisted resource state such as job status, result records,
confirmations, or operation status.
