# Leak Detection and Deterministic Time

Two tools cover the long tail of concurrency bugs: `go.uber.org/goleak` for unit tests, and `testing/synctest` for time-dependent code. A third — Go 1.26's experimental `goroutineleak` pprof profile — helps in production.

## goleak in tests

The cheapest way to catch leaks is to wire `goleak` into every package that spawns goroutines.

### Whole-package guard

```go
package worker_test

import (
    "testing"
    "go.uber.org/goleak"
)

func TestMain(m *testing.M) { goleak.VerifyTestMain(m) }
```

`VerifyTestMain` runs the tests, then checks that no extra goroutines remain. If a test forgot to cancel a context or close a channel, the run fails with the offending stack.

### Per-test guard

```go
func TestWorker(t *testing.T) {
    defer goleak.VerifyNone(t)
    w := newWorker()
    w.Start()
    w.Stop()
}
```

Per-test is finer-grained but you must remember the `defer` in every test.

### Allow-listing noise

Some libraries (telemetry exporters, drivers) keep background goroutines that are not leaks. Allow them explicitly:

```go
goleak.VerifyTestMain(m,
    goleak.IgnoreTopFunction("go.opencensus.io/stats/view.(*worker).start"),
    goleak.IgnoreCurrent(),
)
```

Avoid `IgnoreAnyFunction` — it suppresses too much.

## testing/synctest

`testing/synctest` (stable Go 1.25, extended in 1.26) gives deterministic time. Synthetic time only advances when **every** goroutine in the bubble is blocked, so timing-dependent tests stop being flaky.

```go
import "testing/synctest"

func TestTimeout(t *testing.T) {
    synctest.Test(t, func(t *testing.T) {
        ctx, cancel := context.WithTimeout(t.Context(), 5*time.Second)
        defer cancel()

        time.Sleep(5 * time.Second) // synthetic
        synctest.Wait()             // drain ready goroutines
        if !errors.Is(ctx.Err(), context.DeadlineExceeded) {
            t.Fatalf("got %v, want DeadlineExceeded", ctx.Err())
        }
    })
}
```

Inside the bubble:

- `time.Sleep`, `time.After`, `time.Ticker` use the synthetic clock.
- `synctest.Wait` blocks until every goroutine in the bubble is blocked.
- All goroutines started inside the bubble must finish before the test returns.

Use `synctest.Test` (Go 1.25+); only use the Go 1.24 experimental `synctest.Run` if the module is pinned to 1.24 and opts in with `GOEXPERIMENT=synctest`.

### Good fits

- Timeout and deadline behaviour
- Retry/backoff loops
- Token-bucket rate limiters
- `select` with timers

### Not a fit

- Tests that depend on real wall-clock latency (network, fsync)
- Tests that need to observe scheduling jitter

## Go 1.26 experimental goroutineleak profile

For production-side investigation, Go 1.26 adds a `goroutineleak` pprof profile behind `GOEXPERIMENT=goroutineleakprofile`:

```bash
go build -tags=... ./...  # build with the experiment
GOEXPERIMENT=goroutineleakprofile ./service

# in another shell
curl http://localhost:6060/debug/pprof/goroutineleak?debug=2
go tool pprof http://localhost:6060/debug/pprof/goroutineleak
```

This is **not** a substitute for `goleak` in tests — it is for diagnosing live services where goroutine count grows over time. Keep all the existing tools too:

- `go test -race ./...` — race detector
- `runtime.NumGoroutine()` — quick runtime count
- `/debug/pprof/goroutine?debug=2` — full stack dump

## Debugging checklist

When a leak is suspected:

1. Run `go test -race ./...`.
2. Add `defer goleak.VerifyNone(t)` to the suspected test; the failure shows the leaked stack.
3. If reproduction needs timing, port the test to `synctest.Test`.
4. In production, scrape `/debug/pprof/goroutine?debug=2` before and after the workload — diff the counts.
