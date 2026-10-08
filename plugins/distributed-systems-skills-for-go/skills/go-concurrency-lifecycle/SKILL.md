---
name: go-concurrency-lifecycle
description: "Use for in-process Go concurrency ownership, cancellation, races, leaks, synchronization, and bounds. Do not use for broker semantics."
license: Apache-2.0
compatibility: "Go 1.24 or newer. Guidance targets the stable Go 1.25 and 1.26 families and degrades to older repository versions when required."
---

# Go concurrency lifecycle

Make concurrent code explain who owns each goroutine, what can block it, and how it terminates. Treat channels, mutexes, atomics, and contexts as tools with different contracts—not as a hierarchy of idiomatic preference.

## Establish the contract

Inspect the call path and repository conventions before proposing a pattern. Write down only the invariants relevant to the change:

1. **Ownership:** which component starts the goroutine and waits for or stops it?
2. **Lifetime:** is it request-scoped, operation-scoped, component-scoped, or process-scoped?
3. **Termination:** enumerate every blocking point and the event that releases it.
4. **Failure:** where does an error go, and which sibling work should it cancel?
5. **Capacity:** what bounds goroutines, queued work, memory, and downstream concurrency?
6. **State:** which data is shared, and what establishes happens-before ordering?

Do not add concurrency until the expected latency or ownership benefit justifies the extra state space.

## Choose the synchronization mechanism

Choose from the invariant, not a slogan:

| Need | Default starting point |
| --- | --- |
| Protect a small in-memory invariant | `sync.Mutex` guarding the data |
| Publish independent read-mostly snapshots | immutable value plus `atomic.Pointer` |
| Transfer ownership or coordinate a stream | channel with documented producer and close owner |
| Wait for a fixed set of goroutines | `sync.WaitGroup` or an existing repository error group |
| Cancel work derived from an operation | propagated `context.Context` |
| Bound parallel calls | fixed worker count or semaphore acquired before spawning |

Channels do not make shared state disappear. Mutexes do not make lifecycle disappear. A buffer is capacity, not correctness.

Read [references/synchronization.md](references/synchronization.md) when selecting between mutexes, atomics, and channels or when proving publication safety.

## Design the lifecycle

### Operation-scoped work

- Accept the caller’s context; do not replace it with `context.Background()`.
- Derive cancellation only when this layer owns the shorter lifetime, and call the cancel function.
- Start sibling goroutines only after defining how the first failure affects the others.
- Wait before returning if the goroutines access operation-owned memory or resources.
- Preserve the primary error; do not turn expected cancellation of siblings into the reported cause.

### Component-scoped work

- Make `Start`/`Run` and `Stop`/context ownership visible at the component boundary.
- Decide whether repeated start or stop is invalid, idempotent, or supported; encode that state.
- Reject new work before draining accepted work during shutdown.
- Bound shutdown with the caller’s deadline, but do not silently abandon resource owners.

### Detached work

Detached work is valid only when its lifetime, failure reporting, and resource ownership are intentionally process-scoped. A context is not automatically required for a short, non-blocking goroutine; conversely, passing a context does not prevent a leak if blocking operations ignore it.

Read [references/lifecycles.md](references/lifecycles.md) for worker, pipeline, and shutdown patterns. Read [references/supervision-and-failure.md](references/supervision-and-failure.md) when goroutines can fail, panic, cancel siblings, or outlive the caller.

## Bound work before spawning

Prefer admission control before goroutine creation. If the caller owns the operation or must observe failure, join the work and propagate its error; a detached goroutine is valid only under the process-owned contract above. This fragment demonstrates admission only, not a complete request-scoped lifecycle:

```go
select {
case slots <- struct{}{}:
case <-ctx.Done():
    return ctx.Err()
}

go func() {
    defer func() { <-slots }()
    process(ctx, item)
}()
```

If a goroutine is created first and then waits for a slot, overload still creates unbounded goroutines. If the caller must observe admission failure, return it synchronously rather than hiding it in the goroutine.

For a queue, state the overload policy: block, reject, shed oldest/newest, or persist elsewhere. Never infer safety from an arbitrary buffer size.

## Review shared state

For every mutable value reachable by multiple goroutines:

- identify all readers and writers;
- name the lock, channel transfer, atomic operation, or immutable publication that orders them;
- keep the protected invariant adjacent to its synchronization field;
- do not copy values containing synchronization primitives;
- do not call unknown or blocking code while holding a lock unless the invariant requires it and the latency is bounded;
- consider compound invariants—a collection of individually atomic fields can still be inconsistent.

Treat the race detector as runtime evidence over executed paths, not as a proof that unexecuted paths are safe.

## Review channels as protocols

For each channel, record:

- producer set and consumer set;
- who closes it, if anyone;
- whether close means end-of-stream, cancellation, or broadcast;
- whether a send or receive can remain blocked after a peer exits;
- the capacity rationale and overload behavior.

Only a sender with exclusive knowledge that no future send can occur should close a channel. Many channels never need closing because their lifetime is bounded by the owning object.

## Diagnose before changing

- **Race:** start from the reported accesses and find the missing ordering edge.
- **Deadlock:** capture goroutine states; map locks and channel waits as a wait-for graph.
- **Leak:** compare goroutine profiles across steady load and after shutdown; locate the first blocking frame owned by the application.
- **Throughput collapse:** measure queueing, contention, scheduler delay, and downstream saturation before changing worker counts.

Go 1.27’s announced goroutine leak profile is prerelease as of this skill version. Do not prescribe it for stable toolchains until the repository adopts a released version.

## Finish with evidence

Within the authority of the request:

1. inspect the diff for every new `go`, channel, mutex, atomic, and `WaitGroup` operation;
2. exercise cancellation, early consumer exit, error, overload, and shutdown paths;
3. run focused tests under `-race` when the environment supports it;
4. use deterministic synchronization or `testing/synctest` on Go 1.25+ rather than timing sleeps;
5. report what was not exercised and why.

Do not claim race freedom, leak freedom, or deadlock freedom solely because a test passed.

## Output contract

For implementation, make ownership and termination legible in the code without architecture ceremony. For review, report concrete findings with the violated invariant, failure schedule, and smallest sufficient correction. Do not produce a generic concurrency checklist when the code has no concurrent path.
