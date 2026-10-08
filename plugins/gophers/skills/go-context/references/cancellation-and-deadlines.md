# Cancellation, Timeouts, and Background Work

A `Context` cancels in one of three ways: the parent cancels, the deadline expires, or someone calls the returned `cancel` function. Children inherit cancellation automatically — that is the whole point.

## `WithCancel`

For manual cancellation, typically when a caller controls a long-running goroutine.

```go
ctx, cancel := context.WithCancel(parent)
defer cancel()

go worker(ctx)
// later, somewhere else:
cancel() // worker observes <-ctx.Done()
```

If you forget `defer cancel()`, the child context is retained until the parent dies — usually a leak.

## `WithTimeout` and `WithDeadline`

`WithTimeout(parent, d)` is sugar for `WithDeadline(parent, time.Now().Add(d))`.

```go
ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
defer cancel()

if err := client.Do(ctx, req); err != nil {
    // err may be context.DeadlineExceeded or a wrapped form
    return fmt.Errorf("calling client: %w", err)
}
```

The downstream call is responsible for observing the deadline — usually by passing `ctx` into another `*Context` API.

## Listening for Cancellation in a Loop

If you have a worker that does its own thing without calling another `ctx`-aware API, you must poll:

```go
for {
    select {
    case <-ctx.Done():
        return ctx.Err()
    case job := <-jobs:
        if err := handle(ctx, job); err != nil {
            return err
        }
    }
}
```

Returning `ctx.Err()` (`Canceled` or `DeadlineExceeded`) tells the caller why you stopped.

## `context.AfterFunc` (Go 1.21+)

Register a callback that runs when the context is done, without spinning up a goroutine just to wait:

```go
stop := context.AfterFunc(ctx, func() {
    conn.Close() // free the resource when the request ends
})
defer stop()
```

`stop()` removes the callback if it has not yet run.

## `context.WithoutCancel` (Go 1.21+)

For background work that must outlive the parent request — audit logs, async write-behind, fire-and-forget metrics.

```go
func (h *Handler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
    if err := h.do(r.Context()); err != nil {
        http.Error(w, err.Error(), 500)
        return
    }
    // Audit log must survive even after the response is written
    bg := context.WithoutCancel(r.Context())
    go h.audit(bg)
}
```

`WithoutCancel` preserves the parent's *values* (request ID, trace) but drops its cancellation chain. Without it, the audit goroutine would be cancelled the instant the HTTP server finished writing the response.

## Cancellation in `errgroup`

```go
g, ctx := errgroup.WithContext(ctx)
for _, url := range urls {
    g.Go(func() error { return fetch(ctx, url) })
}
return g.Wait()
```

The first error cancels `ctx`; remaining goroutines observe `<-ctx.Done()` and exit. The caller gets the first error from `g.Wait()`.

## Anti-Patterns

- `time.Sleep(d)` instead of `context.WithTimeout` — does not respect parent cancellation.
- Spawning a goroutine that does not take `ctx` — it cannot be cancelled.
- Calling `cancel()` and then continuing to use `ctx` for normal work — the context is dead.
- Catching `ctx.Err()` and returning `nil` — hides cancellation from the caller.
