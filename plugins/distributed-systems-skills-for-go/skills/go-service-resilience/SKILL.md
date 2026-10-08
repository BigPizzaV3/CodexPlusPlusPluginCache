---
name: go-service-resilience
description: "Use for cross-service Go deadlines, retries, admission, shedding, and recovery. Do not use for commits, brokers, or local speed."
license: Apache-2.0
compatibility: "Go 1.24 or newer. Policies are transport-neutral; verify client and dependency behavior against repository versions."
---

# Go service resilience

Design remote calls so a small dependency failure does not become unbounded work. Timeouts, retries, queues, and concurrency limits form one feedback system; configuring them independently can amplify the outage they were meant to survive.

## Map the call path

Inspect the caller, transport, dependency contract, deployment topology, and existing resilience layer. Record:

1. the end-to-end latency or deadline objective;
2. every queue and attempt along the call graph;
3. which layer owns retries;
4. whether the operation is safe to replay and how identity is preserved;
5. maximum in-flight work and downstream capacity;
6. which failures are transient, permanent, overload, or ambiguous;
7. the fallback’s correctness and capacity cost.

Do not add retries before finding existing retries in clients, proxies, service meshes, jobs, and callers.

## Allocate one deadline budget

Propagate the caller’s context. Derive a shorter deadline only when this layer owns a sub-budget. Never extend the caller’s deadline by replacing the context.

Before each attempt, account for:

```text
remaining budget > queue wait + attempt bound + possible backoff + response margin
```

If not, fail without starting work the caller can no longer use. A transport timeout covers one phase; it does not replace an end-to-end deadline.

Use separate policies for interactive requests, batch work, and long-lived streams. “30 seconds everywhere” is not a resilience design.

## Decide whether retry is legal

Retry only if all conditions hold:

- the failure class is plausibly transient;
- the operation can be replayed with the same semantic identity;
- this layer is the designated retry owner;
- the dependency has capacity for retry traffic;
- attempts and elapsed time are bounded;
- the remaining caller budget can complete another useful attempt.

Application idempotency matters more than HTTP method names. A `GET` can trigger a broken side effect; a `POST` can be replay-safe under a durable idempotency contract.

Ambiguous outcomes require reconciliation or same-identity replay, not a new operation.

Read [references/retries.md](references/retries.md) for classification, backoff, jitter, and hedging. Treat every hedge as another live attempt inside one operation budget, and verify actual Go client support instead of assuming a cross-language service-config feature exists.

## Control amplification

If a five-deep call chain makes three total attempts at every layer, one user request can create up to 243 leaf attempts. If “retry three times” means three retries after the first attempt, the bound is 4^5 = 1,024. Prefer one retry owner near the layer that understands replay semantics and user budget.

Use exponential backoff with jitter to desynchronize callers, but remember:

- backoff does not reduce the first retry wave;
- a high retry cap still creates excess load;
- retrying overload responses can keep a dependency overloaded;
- unbounded queued retries consume memory and expire before execution.

Apply a retry budget or token limit so retries remain a controlled fraction of normal traffic. Observe attempts per original operation, not only raw request count.

## Bound concurrency and queues

Admission control should happen before allocating expensive state or spawning work. Choose a bound from dependency capacity and tolerated queue latency, then choose overload behavior:

- reject early and cheaply;
- shed lower-priority work;
- degrade optional work;
- queue only within an explicit memory and latency limit.

Separate concurrency pools only when isolation matches real failure domains. Per-dependency bulkheads can stop one slow dependency from consuming every worker, but too many pools strand capacity and complicate fairness.

Bound both logical operations and active dependency attempts. An operation-lifecycle permit bounds callers sleeping in backoff; an attempt permit bounds active dependency load and is released before backoff, then reacquired cancellation-aware. Holding scarce dependency capacity during sleep starves fresh work and recovery probes; releasing it without an operation bound creates unbounded sleepers.

Read [references/overload.md](references/overload.md) for load shedding, circuit behavior, and recovery. Read [references/overload-signals-and-scope.md](references/overload-signals-and-scope.md) when admission spans replicas, tenants, priorities, proxies, or protocol retry signals.

## Treat circuit breakers as state machines

A circuit breaker can reduce futile load, but it introduces shared state, thresholds, probes, and synchronized recovery. Add one only when simpler bounded concurrency, deadlines, and retry control are insufficient.

Define:

- which failures count;
- sample size and open threshold;
- open duration and probe concurrency;
- behavior for callers while open;
- how recovery avoids a thundering herd;
- per-instance versus shared scope.

Do not use a circuit breaker to hide incorrect timeouts or as a substitute for dependency health signals.

## Validate fallbacks

A fallback is another production path. Verify:

- its data freshness and consistency semantics;
- authorization and privacy equivalence;
- capacity during the same outage;
- whether it turns a hard failure into silently wrong data;
- how callers and telemetry distinguish degraded results.

Caches can be latency optimizations or capacity dependencies. A cache that all instances fall through simultaneously can make recovery worse. Define stampede control and stale-data policy explicitly.

## Preserve error semantics

Return errors that let the owning boundary decide:

- retryable versus permanent when the API intentionally exposes that contract;
- overload versus dependency unavailability;
- deadline exceeded versus caller cancellation;
- ambiguous outcome versus confirmed rejection.

Do not string-match error messages. Do not log at every layer. Include attempt metadata in telemetry without wrapping the same cause into an unreadable chain.

## Recovery and rollout

Design for recovery, not only steady failure:

- ramp traffic or probes so cold caches and reconnect storms do not re-trigger overload;
- randomize periodic work and reconnects;
- drain retry queues under a controlled rate;
- keep health checks cheap and separate readiness from liveness;
- test configuration changes because retry/timeout policy is production code.

## Finish with evidence

Within the request’s authority, test the feedback system:

- latency beyond the attempt and caller deadline;
- transient failure followed by recovery;
- permanent and ambiguous failures;
- partial dependency capacity and overload rejection;
- retry storms from many callers;
- fallback saturation and stale data;
- recovery with cold connections or caches.

Record attempts per operation, in-flight work, queue time, rejected work, dependency latency, and terminal outcomes. A passing unit test for a backoff function does not validate overload behavior.

## Output contract

For implementation, keep retry ownership, replay identity, deadline allocation, and capacity bounds close to the call. For review, give the amplification path or failure schedule and quantify the maximum attempts/in-flight work where possible. Do not prescribe circuit breakers or retries by default.
