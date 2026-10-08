# goleak, Flakes, and Race Triage

A test that fails sometimes is worse than a test that never runs. This reference covers the three diagnostic loops worth knowing: leak detection, flake triage, and race triage.

## Goroutine leaks with goleak

`go.uber.org/goleak` checks that no extra goroutines remain after a test. The cheapest setup wires it into every package that spawns goroutines.

```go
import "go.uber.org/goleak"

func TestMain(m *testing.M) { goleak.VerifyTestMain(m) }
```

`VerifyTestMain` runs the tests, then enumerates goroutines. Anything outside the allow-list fails the run with a stack dump.

### Per-test guard

When `TestMain` is not appropriate (mixed concerns, vendor code that leaks):

```go
func TestWorker(t *testing.T) {
    defer goleak.VerifyNone(t)
    w := newWorker()
    w.Start()
    w.Stop()
}
```

### Allow-listing

Some library goroutines are not leaks (telemetry exporters, drivers, signal handlers). Allow them explicitly:

```go
goleak.VerifyTestMain(m,
    goleak.IgnoreTopFunction("go.opencensus.io/stats/view.(*worker).start"),
    goleak.IgnoreCurrent(),
)
```

Avoid `IgnoreAnyFunction` — it suppresses too much. Prefer `IgnoreTopFunction` with the exact function name; the stack dump in the failure tells you what to allow-list.

## Flake triage

A flaky test is one that fails on a re-run with the same inputs. The triage loop:

1. **Reproduce.** Run the test in a loop until it fails:

   ```bash
   go test -run TestFlaky -count=200 ./pkg/...
   ```

   If 200 runs are clean, push to 1000. If you cannot reproduce, look for environmental dependencies (CPU count, file system order, time zone).

2. **Strip parallelism.** Re-run with `-parallel=1` and without `t.Parallel()`. If the flake disappears, the bug is in the test's concurrency (shared state, missing synchronisation).

3. **Look at timing.** If the test uses `time.Sleep`, `time.After`, `time.Ticker`, or `context.WithTimeout`, port it to `testing/synctest`. Most timing flakes vanish under synthetic time.

4. **Look at ordering.** Map iteration is randomised. If the test asserts on a slice produced by `for k := range m`, sort first or use `cmpopts.SortSlices`.

5. **Look at the network and disk.** Anything calling out is non-deterministic. Replace with a fake (see `http-and-fakes.md`).

6. **Skip after diagnosis, never before.** If a flake cannot be fixed today, `t.Skip` it with a TODO and a ticket number — do not delete it.

## Race triage with `-race`

The race detector instruments memory accesses and reports a stack pair whenever two goroutines touch the same memory without synchronisation. Run every CI lane with `go test -race ./...`.

When the detector fires:

```
WARNING: DATA RACE
Read at 0x00c0001... by goroutine 7:
  pkg/cache.(*Cache).Get
      cache.go:42

Previous write at 0x00c0001... by goroutine 5:
  pkg/cache.(*Cache).populate
      cache.go:67
```

The two stacks tell you the conflicting accesses. The fix is almost always one of:

- The field is logically owned by a goroutine; make ownership explicit (pass via channel, not pointer).
- The field needs a mutex; add `sync.Mutex` and protect both reads and writes.
- The field is a simple counter/flag; switch to `atomic.Int64` / `atomic.Bool`.

The race detector is **probabilistic** — passing under `-race` does not prove the absence of races. Run it long enough that the race window is hit. Stress with `-count=100` when investigating.

## Tests that hang

A hanging test usually means a goroutine is blocked on a channel that never closes, a mutex that is never released, or a `select` with no cancellation case.

`go test -timeout=30s` gives the runtime time to print a stack dump of every goroutine in the process. Read the dump bottom-up: the test goroutine is usually waiting on a `Wait()` or a `<-ch` that nothing will satisfy.

The dump also points at the goroutines that should have completed the work — they are the ones to fix.

## Debugging in CI only

When a test passes locally but fails in CI:

- **CPU count differs.** CI runners often have fewer cores. Try `GOMAXPROCS=1 go test -count=200`.
- **Time zone differs.** CI is usually UTC. Set `TZ=UTC` locally to match.
- **File system order differs.** CI often uses faster file systems with different ordering. Avoid asserting on directory listing order.
- **Network DNS differs.** Mock anything that resolves.

## Anti-patterns

| Anti-pattern | Fix |
|---|---|
| Ignoring a flake because it "fails only sometimes" | The bug exists. Diagnose now; it gets worse. |
| `t.Skip` without a ticket or TODO | Track the skip; otherwise it becomes permanent. |
| Allow-listing `goleak` failures by `IgnoreAnyFunction` | Use `IgnoreTopFunction` with the exact name. |
| Running CI without `-race` "to save time" | Races ship to prod and are 10x harder to debug there. |
| Patching the race by making the field `volatile` (it doesn't exist in Go) | Add a mutex or use `sync/atomic`. |
| Re-running the test in CI until it passes | Re-run masks bugs; fix the flake. |
