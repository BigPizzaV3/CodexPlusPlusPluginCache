# errgroup, Worker Pools, and Bounded Concurrency

`golang.org/x/sync/errgroup` is the default tool for "run N things, wait for them, fail fast". It replaces almost every hand-rolled worker pool.

## errgroup basics

```go
g, ctx := errgroup.WithContext(ctx)
for _, u := range urls {
    g.Go(func() error {
        return fetch(ctx, u)
    })
}
if err := g.Wait(); err != nil {
    return fmt.Errorf("fetch: %w", err)
}
```

`Wait` returns the **first** non-nil error. As soon as any worker fails, `ctx` is cancelled, so the others can short-circuit.

## Bounded concurrency

`SetLimit(n)` turns the group into a worker pool. `g.Go` blocks once `n` goroutines are running:

```go
g, ctx := errgroup.WithContext(ctx)
g.SetLimit(runtime.GOMAXPROCS(0)) // CPU-bound work

for _, item := range items {
    g.Go(func() error { return compute(ctx, item) })
}
return g.Wait()
```

`SetLimit` must be called before the first `g.Go`.

## TryGo for opportunistic work

`g.TryGo(fn)` returns `false` if the limit is reached, letting the caller fall back to inline execution or drop the work. Useful for fire-and-forget enrichment.

## errgroup vs sync.WaitGroup

| Need | Use |
|---|---|
| Fire-and-forget goroutines, no errors | `sync.WaitGroup` (or `wg.Go` in Go 1.25+) |
| First-error semantics, mutual cancellation | `errgroup.WithContext` |
| Bounded concurrency | `errgroup.SetLimit` |
| Collect *all* errors | Use `errgroup` with `errors.Join` or a slice + mutex |

## Collecting all errors

`errgroup` returns the first error. To gather every failure, capture them in the worker and join at the end:

```go
var (
    mu   sync.Mutex
    errs []error
)
g, ctx := errgroup.WithContext(ctx)
g.SetLimit(8)
for _, item := range items {
    g.Go(func() error {
        if err := work(ctx, item); err != nil {
            mu.Lock(); errs = append(errs, err); mu.Unlock()
        }
        return nil // do not cancel siblings
    })
}
_ = g.Wait()
return errors.Join(errs...)
```

Note: returning `nil` here disables errgroup's cancellation. That is intentional — we want every item attempted.

## Hand-rolled worker pool (when errgroup isn't enough)

A bounded semaphore using a buffered channel works when you need custom result aggregation:

```go
sem := make(chan struct{}, workers)
results := make(chan Result, len(items))
var wg sync.WaitGroup

for _, item := range items {
    wg.Add(1)
    sem <- struct{}{}
    go func(it Item) {
        defer wg.Done()
        defer func() { <-sem }()
        results <- process(ctx, it)
    }(item)
}
go func() { wg.Wait(); close(results) }()

for r := range results { /* aggregate */ }
```

This is more code than `errgroup.SetLimit`; prefer the latter unless the result fan-in needs custom handling.

## Pipelines with errgroup

Each stage runs as a `g.Go` and communicates over channels. The first error cancels `ctx`, which every stage selects on, so all stages drain and exit cleanly:

```go
g, ctx := errgroup.WithContext(ctx)
stage1 := make(chan A)
stage2 := make(chan B)

g.Go(func() error { defer close(stage1); return read(ctx, stage1) })
g.Go(func() error { defer close(stage2); return transform(ctx, stage1, stage2) })
g.Go(func() error { return write(ctx, stage2) })

return g.Wait()
```

## Anti-patterns

| Anti-pattern | Fix |
|---|---|
| Manual `for { sem <- struct{}{} ... }` when limit + error are all you need | `errgroup.SetLimit` |
| Calling `g.SetLimit` after `g.Go` | Call it before the first goroutine starts |
| Returning a non-nil error you do not want to propagate | Log and return `nil` to keep siblings running |
| Using `errgroup` without `WithContext` for cancellation | You lose the fail-fast property |
