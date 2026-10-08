# Channels and Select Patterns

Channels transfer ownership. The first question to answer is "who owns this channel?" — the owner is the only one allowed to close it.

## Direction at Boundaries

State direction in function signatures so the compiler enforces ownership:

```go
// Producer owns out; closes it when done.
func produce(out chan<- Job) {
    defer close(out)
    for _, j := range source { out <- j }
}

// Consumer drains in; never closes it.
func consume(in <-chan Job) {
    for j := range in { handle(j) }
}
```

A function that both reads and writes (a pipeline stage) takes `<-chan In, chan<- Out` and owns the output channel.

## Pipelines

```go
func stage1(ctx context.Context) <-chan int {
    out := make(chan int)
    go func() {
        defer close(out)
        for i := 0; i < 100; i++ {
            select {
            case <-ctx.Done():
                return
            case out <- i:
            }
        }
    }()
    return out
}
```

Two invariants:

1. The function that creates the channel returns it and is the only writer.
2. The writing goroutine always `select`s on `ctx.Done()` so it can be told to stop.

## Fan-out / fan-in

`errgroup` is usually the cleanest implementation, but the channel version is worth knowing:

```go
func fanOut(ctx context.Context, in <-chan Job, workers int) <-chan Result {
    out := make(chan Result)
    var wg sync.WaitGroup
    wg.Add(workers)
    for i := 0; i < workers; i++ {
        go func() {
            defer wg.Done()
            for j := range in {
                select {
                case <-ctx.Done(): return
                case out <- process(j):
                }
            }
        }()
    }
    go func() { wg.Wait(); close(out) }()
    return out
}
```

A separate goroutine waits for all workers and closes the output. That is the only place `close(out)` runs.

## Broadcast with `close`

Closing a channel is a broadcast — every receiver gets the zero value immediately. Use this for "stop" signals:

```go
done := make(chan struct{})
go worker(done)
go worker(done)
close(done) // both workers unblock
```

For request cancellation, prefer `context.Context` over a hand-rolled `done` channel.

## Non-blocking send / receive

`default` makes a `select` non-blocking. Use sparingly — usually it indicates dropping data:

```go
select {
case events <- e:
    // sent
default:
    metrics.Dropped.Inc()
}
```

Document why dropping is acceptable. If it isn't, you need backpressure or a bigger buffer (with the same justification rule as before).

## Closing rules

- Senders close. Closing from the receiver side panics on the next send.
- Closing a closed channel panics. Use `sync.Once` if multiple goroutines could trigger shutdown.
- Sending on a closed channel panics. Receivers see `v, ok := <-ch` where `ok` is `false`.
- It is safe (and idiomatic) to range over a channel until it is closed.

## Common select bugs

| Bug | Fix |
|---|---|
| `select` blocks forever after producer goroutines exit | Producers must `close` the channel when done |
| `for-select` busy loop because every case has `default` | Drop the `default`; let the select block |
| Random case selection picks the same case repeatedly | Expected — `select` is uniformly random over ready cases |
| `case <-time.After(d)` in a loop leaks timers | Hoist a `time.NewTimer` and `Reset` it each iteration |
