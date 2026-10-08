---
name: go-concurrency
description: "Use when writing or reviewing concurrent Go code — goroutines, channels, select, mutexes, atomics, errgroup, singleflight, worker pools, or fan-out/fan-in pipelines. Apply proactively whenever a goroutine is spawned, a shared field is mutated, or a channel is created, even if the user has not asked about concurrency. Does not cover context.Context patterns (see go-context)."
license: MIT
compatibility: "Designed for Claude Code or similar AI coding agents. Targets Go 1.21+ for typed atomics and slog. Notes Go 1.25 wg.Go, Go 1.26 testing/synctest, and Go 1.26 experimental goroutineleak profile where relevant."
allowed-tools: Read Edit Write Glob Grep Bash(go:*) Bash(golangci-lint:*)
---

# Go Concurrency

Goroutines are cheap, but every one you spawn is a resource you must own. The goal is **structured concurrency**: each goroutine has a clear owner, a predictable exit, and a way for the caller to wait and collect errors.

## Core Rules

1. **Never start a goroutine without knowing how it will stop.** A blocked goroutine is not garbage-collected — it leaks.
2. **The caller must be able to wait.** Use `sync.WaitGroup`, `errgroup.Group`, or an explicit done channel.
3. **No goroutines in `init()`.** Expose `Start`/`Stop`/`Shutdown` so callers control the lifecycle.
4. **Share by communicating.** Default to channels; reach for `sync.Mutex` only when the problem is genuinely "protect a shared field".
5. **Only the sender closes a channel.** Closing from the receiver side panics on the next send.
6. **Specify channel direction** (`chan<-`, `<-chan`) at function boundaries — the compiler catches misuse.
7. **Always include `ctx.Done()` in `select`.** Without it, the goroutine cannot be cancelled.
8. **Test for leaks** with [`go.uber.org/goleak`](https://pkg.go.dev/go.uber.org/goleak).

## Primitive Decision

| Need | Use | Why |
|---|---|---|
| Pass a value from producer to consumer | Channel | Transfers ownership explicitly |
| Wait for N fire-and-forget goroutines | `sync.WaitGroup` (Go 1.25: `wg.Go`) | No error needed |
| Wait + collect first error + cancel siblings | `errgroup.WithContext` | Structured failure |
| Bound concurrency (worker pool) | `errgroup.SetLimit(n)` | Replaces hand-rolled pools |
| Protect a shared field | `sync.Mutex` / `sync.RWMutex` | Short critical section |
| Counter / flag | typed `sync/atomic` (`atomic.Int64`, `atomic.Bool`) | Lock-free, type-safe |
| Read-heavy concurrent map | `sync.Map` | Concurrent map read/write otherwise crashes |
| One-shot init | `sync.Once` (or `OnceFunc`/`OnceValue` in 1.21+) | Idempotent setup |
| Deduplicate concurrent calls | `x/sync/singleflight` | Cache stampede prevention |

> Read [references/sync-primitives.md](references/sync-primitives.md) when picking between mutex, atomic, `sync.Map`, `sync.Pool`, or `singleflight`, or when designing the field layout of a struct that protects shared state.

## Goroutine Lifetimes

```go
// Good: bounded WaitGroup, deterministic exit
var wg sync.WaitGroup
for item := range queue {
    wg.Add(1)
    go func(it Item) { defer wg.Done(); process(ctx, it) }(item)
}
wg.Wait()

// Bad: no stop signal, no wait — classic leak
go func() { for { flush(); time.Sleep(delay) } }()
```

Go 1.25+ exposes `wg.Go(fn)` which folds `Add`/`Done` into one call. Always call `wg.Add` **before** `go` — otherwise `wg.Wait` may return before the goroutine even starts.

## errgroup: Errors and Cancellation

`errgroup.WithContext` is the right default when sibling goroutines should cancel each other on the first failure:

```go
g, ctx := errgroup.WithContext(ctx)
g.SetLimit(8)
for _, url := range urls {
    g.Go(func() error { return fetch(ctx, url) })
}
if err := g.Wait(); err != nil {
    return fmt.Errorf("fetching urls: %w", err)
}
```

`g.Wait` returns the first non-nil error; `ctx` is cancelled as soon as any worker fails. See [references/errgroup-and-pools.md](references/errgroup-and-pools.md).

## Channels

```go
func produce(out chan<- int)                  { /* send-only */ }
func consume(in <-chan int)                   { /* receive-only */ }
func transform(in <-chan int, out chan<- int) { /* ownership crosses */ }
```

**Buffer size is `0` or `1`.** Anything larger must be justified (what bounds it under load, what happens when writers block).

In every long-running `select`, include `<-ctx.Done()`. Avoid `time.After` in hot loops — it allocates a timer per iteration; hoist a `time.NewTimer` and `Reset` it instead.

> Read [references/channels-and-select.md](references/channels-and-select.md) when implementing pipelines, fan-in/fan-out, broadcast via `close`, or non-blocking sends with `default`.

## Mutexes and Atomics

The zero value of `sync.Mutex`/`RWMutex` is valid — almost never use a pointer. Do not embed mutexes; keep them as an unexported `mu` field so `Lock`/`Unlock` aren't public API. Keep critical sections short; never hold a lock across I/O. Prefer typed atomics (`atomic.Bool`, `atomic.Int64`) over raw `sync/atomic` on `int32`/`int64` fields.

## Testing: goleak and synctest

Wire `go.uber.org/goleak` into every package that spawns goroutines (`goleak.VerifyTestMain(m)` or `defer goleak.VerifyNone(t)`). For timer-dependent tests, use `testing/synctest` (Go 1.25+) so synthetic time advances deterministically. Go 1.26 adds an experimental `goroutineleak` pprof profile for production diagnosis — it is not a substitute for `goleak` in tests. See [references/leaks-and-synctest.md](references/leaks-and-synctest.md).

## Anti-Patterns

| Anti-pattern | Why it hurts | Do this instead |
|---|---|---|
| Fire-and-forget `go func()` with no signal | Leaks on shutdown; can outlive its inputs | Pass `ctx`, use `errgroup`, or own a done channel |
| Closing a channel from the receiver | Panics on the next send | Only the sender closes |
| `time.After` in a hot loop | Allocates a timer per iteration | `time.NewTimer` + `Reset` |
| `select` without `ctx.Done()` | Cannot be cancelled | Always include the cancel case |
| `wg.Add(1)` inside the goroutine | `Wait` may return before `Add` runs | `Add` before `go`, or use `wg.Go` (Go 1.25+) |
| Buffered channel sized "to be safe" | Hides backpressure, masks bugs | Size 0 or 1; justify anything larger |
| Concurrent read+write on `map` | Hard runtime crash, not a race warning | `sync.Map` or `sync.RWMutex` + map |
| Mutex held across I/O / RPC | Serializes the whole service | Copy what you need under the lock; release before the call |
| Sending a pointer through a channel | Re-introduces shared memory | Send a copy or an immutable value |
| Forgetting `-race` in CI | Races ship to prod | `go test -race ./...` always |

## Verification Checklist

Before finishing a concurrency change:

- [ ] Every `go` has a documented exit (ctx, done channel, or bounded loop)
- [ ] Every long-running `select` has a `<-ctx.Done()` case
- [ ] `wg.Add` is called before `go`, or `wg.Go` is used (Go 1.25+)
- [ ] Channels are sized 0 or 1, or the size has a comment justifying it
- [ ] Only the sender closes channels; receivers use `for v := range ch` or `v, ok := <-ch`
- [ ] No mutex is held across network/disk I/O
- [ ] `go test -race ./...` is clean
- [ ] Packages that spawn goroutines wire `goleak.VerifyTestMain` or per-test `VerifyNone`

## References

- [references/sync-primitives.md](references/sync-primitives.md) — mutex vs atomic vs `sync.Map`/`Pool`/`Once`/`singleflight`
- [references/channels-and-select.md](references/channels-and-select.md) — channel ownership, direction, pipelines, non-blocking sends
- [references/errgroup-and-pools.md](references/errgroup-and-pools.md) — `errgroup`, `SetLimit`, worker pools, fan-out/fan-in
- [references/leaks-and-synctest.md](references/leaks-and-synctest.md) — `goleak`, `testing/synctest`, Go 1.26 experimental leak profile
