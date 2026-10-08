# Lifecycle patterns

## Coordinated finite work

Use the repository’s existing error-group abstraction when available. The essential contract is:

- the parent owns the group;
- the first material failure cancels siblings;
- all goroutines return before the parent returns;
- cancellation caused by a sibling does not replace the primary error.

If using `golang.org/x/sync/errgroup`, remember that `SetLimit` bounds active goroutines but `Go` can block while admitting work. Do not hold a lock or scarce resource while calling it.

## Producer and consumer pipeline

A consumer may stop before a producer. Prevent a blocked send by either:

- keeping producer and consumer under one cancellation scope and selecting sends against cancellation; or
- draining the producer as part of an explicit protocol when work must complete.

Closing a downstream channel is the producing stage’s responsibility after every producer has stopped. When multiple producers share a channel, a coordinator that waits for all producers may close it; no individual producer has enough knowledge.

## Long-lived component

A component loop usually needs four states:

1. not started;
2. accepting work;
3. draining or stopping;
4. stopped.

Define which transitions are legal and how callers observe them. A closed `done` channel can broadcast completion, but it does not carry the terminal error; retain that error under synchronization or return it from `Run`.

Shutdown ordering follows ownership:

1. stop admission;
2. signal workers;
3. wait for owned work;
4. close resources after their users stop;
5. publish completion.

## Common counterexamples

- A goroutine that performs one non-blocking send to a process-owned metrics sink may not need a request context; adding one can incorrectly cancel telemetry with the request.
- A context-aware loop still leaks if it calls a blocking function that has no cancellation path.
- Waiting on a `WaitGroup` concurrently with an unsafe `Add` schedule can race with completion; establish all work before `Wait`, or use the repository’s Go-version-supported safer API.
- Recovering a panic changes failure behavior; do it only at an intentional isolation boundary, record the stack, and decide whether corrupted component state can safely continue.
