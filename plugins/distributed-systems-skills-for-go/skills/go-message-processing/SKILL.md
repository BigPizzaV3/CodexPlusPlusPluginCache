---
name: go-message-processing
description: "Use for Go broker delivery, ACK, replay, ordering, poison recovery, outbox, or inbox. Do not use for in-process channels."
license: Apache-2.0
compatibility: "Go 1.24 or newer. Broker guarantees and client APIs are version-specific and must be verified against the deployed system."
---

# Go message processing

Assume delivery can be duplicated, delayed, reordered, and interrupted at every boundary unless the deployed broker contract proves otherwise. “Exactly once” is scoped; it does not automatically make a database mutation, payment call, or email happen once.

## Model the state machine

Choose the relevant path before loading details: producer contract, consumer effect, or outbox relay. Inspect consumer groups, retry/dead-letter policy, claiming, and acknowledgment only for consuming paths; inspect publication state and relay ownership for a producer/outbox path. In either case inspect the broker and client version, schema, database transaction path, and stable identity. A consuming path uses a state machine such as:

```text
received -> admitted -> claimed/deduplicated -> effect committed -> acknowledged
```

For each transition, ask what happens if the process crashes immediately before and after it. State:

1. the stable message or operation identity;
2. the semantic payload fingerprint associated with that identity;
3. the ordering key and where ordering is guaranteed;
4. the durable effect and its transaction boundary;
5. when acknowledgment becomes safe;
6. retry limits, delay, and poison-message destination;
7. concurrency, memory, and downstream capacity bounds.

Do not start from a library callback signature; start from these failure semantics.

## Choose the delivery contract

### At-most-once

Acknowledge before the effect or accept loss on crash. Use only when loss is cheaper than duplication and that trade-off is explicit.

### At-least-once

Perform the effect before acknowledgment. Crash between effect and acknowledgment causes redelivery, so the effect must be idempotent or deduplicated durably.

### Broker “exactly once”

Name its boundary. It may cover producer records, broker offsets, a region, or one transaction API while excluding external databases and services. Preserve application-level idempotency whenever the effect escapes that boundary.

Read [references/delivery-and-ordering.md](references/delivery-and-ordering.md) for broker guarantees, ordering, and acknowledgment trade-offs.

## Make processing durably idempotent

For a local SQL effect, prefer one transaction that:

1. inserts or claims the message identity under a unique constraint;
2. verifies an existing identity has the same semantic fingerprint;
3. applies the domain state transition conditionally;
4. records the terminal result needed for replay;
5. commits before acknowledgment.

On duplicate identity with the same fingerprint, return the recorded outcome or no-op according to the protocol. On the same identity with a different fingerprint, reject and alert; silently treating it as the original operation can apply the wrong command.

An in-memory cache, local mutex, or process-local singleflight can reduce duplicate concurrent work but cannot provide durable deduplication across crashes, replicas, or retention windows.

Use `go-data-consistency` for isolation and commit ambiguity inside this unit.

## Coordinate database state and publication

If one operation changes database state and publishes an event, two independent commits create a gap:

- database commits, publish fails: state exists without event;
- publish succeeds, database rolls back: event describes nonexistent state.

Use a transactional outbox when the database is the source of truth:

1. write domain state and an outbox row in one transaction;
2. relay committed rows with stable event identities;
3. make relay publication retryable;
4. mark progress without assuming publish acknowledgment is infallible;
5. keep consumers idempotent because the relay can republish.

Use an inbox/deduplication record for inbound effects when the same local transaction can guard processing.

Read [references/outbox-and-inbox.md](references/outbox-and-inbox.md) for relay and retention decisions.

For initial loads, replica rebuilds, or change-data-capture bootstrap, read [references/cdc-snapshot-handoff.md](references/cdc-snapshot-handoff.md). A table scan and a later stream position do not form a safe cutover unless one source-consistent boundary prevents gaps and resolves snapshot/stream collisions.

## Acknowledge from the owner

The component that knows the durable outcome owns acknowledgment. Do not acknowledge merely because a callback returned or a message entered an in-memory worker queue.

Verify client-library concurrency rules:

- whether acknowledgments must occur on the poll/receive goroutine;
- whether processing can outlive a lease and how it is extended;
- whether cancellation stops fetching, processing, or both;
- whether partition revocation waits for or fences in-flight work;
- whether one failed item can block a batch acknowledgment.

If acknowledgment result itself can fail, retain enough durable processing state to handle redelivery.

For cumulative offsets, track completion per partition and commit only through the highest contiguous completed offset; later completion must never skip unfinished lower offsets. On rebalance, stop admission and either drain within the revocation budget or fence unfinished ownership before committing progress.

For consumer-group assignment, revocation, or cooperative rebalance changes, read [references/rebalance-ownership.md](references/rebalance-ownership.md). Bind every worker and completion frontier to one assignment generation; a stale worker must not advance a successor's progress or perform an unfenced effect merely because it was admitted earlier.

## Preserve ordering only where needed

Global ordering is expensive and often unavailable. Define the business key whose events must be serialized, such as account ID or aggregate ID. Then verify:

- the producer assigns the same key consistently;
- the broker orders within the documented scope;
- the consumer does not reintroduce reordering through parallel workers;
- retries of one key do not unnecessarily block unrelated keys;
- sequence/version checks detect stale or missing transitions when required.

Ordering does not replace idempotency: the same event can appear twice in order.

## Bound concurrency and apply backpressure

Bound before accepting more work than can be safely retained:

- maximum in-flight messages and bytes;
- per-key concurrency when ordering matters;
- downstream database and RPC capacity;
- lease/visibility deadline relative to processing latency;
- shutdown drain time.

Pausing broker fetch is often safer than accumulating an unbounded Go channel. A large prefetch can cause synchronized lease expiry and redelivery during slowdown.

Use `go-concurrency-lifecycle` for in-process ownership and `go-service-resilience` for downstream attempt policy.

## Handle poison and terminal failures

Classify failures:

- **transient:** bounded retry with backoff and jitter;
- **permanent input/schema:** quarantine or dead-letter with diagnostic context;
- **business rejection:** record a terminal outcome, usually do not retry unchanged;
- **dependency ambiguity:** reconcile using operation identity before replay;
- **systemic overload:** reduce admission; do not accelerate retries.

Dead-lettering is not resolution. Record original identity, schema/version, failure class, attempt count, timestamps, and safe diagnostic context. Provide a replay process that preserves or intentionally replaces identity and cannot bypass current validation.

For quarantine evidence, ordering impact, retention, access control, and bounded redrive, read [references/poison-and-redrive.md](references/poison-and-redrive.md). Broker-assigned identity and enqueue time may change during redrive; preserve the application identity needed for deduplication and audit.

## Schema and compatibility

Treat messages as public persisted contracts:

- include an explicit event type and schema/version strategy;
- prefer additive evolution while old producers and consumers coexist;
- distinguish absent from zero when semantics require it;
- retain unknown fields only when the encoding and compatibility contract support it;
- do not couple business behavior to Go struct names or package paths;
- make replay of historical events part of compatibility review.

## Finish with failure injection

Within the request’s authority, exercise crashes or injected errors:

- before and after durable effect commit;
- before, during, and after acknowledgment;
- duplicate delivery concurrently across replicas;
- same identity with conflicting payload;
- out-of-order and missing sequence;
- poison message and dead-letter failure;
- shutdown with in-flight work;
- downstream overload and lease expiry.

Do not claim exactly-once business effects from a happy-path integration test. State the broker guarantee, application guarantee, effect boundary, and untested crash points separately.

## Output contract

For implementation, make the state machine and durable identity visible. For review, describe the crash point or interleaving that violates the business invariant and the minimum durable correction. Avoid broker-specific code until repository dependencies identify the broker and version.
