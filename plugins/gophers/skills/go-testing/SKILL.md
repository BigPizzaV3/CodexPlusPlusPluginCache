---
name: go-testing
description: "Use when writing or fixing Go tests — table-driven cases, parallel safety, helpers, fakes, fuzzing, deterministic time (testing/synctest), goroutine leak detection (goleak), HTTP handlers. Apply proactively when a function gets a new test or a test is flaky. Benchmark methodology: see go-benchmark."
license: MIT
compatibility: "Designed for Claude Code or similar AI coding agents. Targets Go 1.21+. Uses Go 1.25+ testing/synctest and Go 1.24+ b.Loop() where relevant."
allowed-tools: Read Edit Write Glob Grep Bash(go:*) Bash(golangci-lint:*)
---

# Go Testing

Tests are executable specifications. Their job is to **fail usefully** when behaviour regresses — and to keep failing in the same way until the bug is fixed. Tests that are passing-or-flaky teach the team to ignore them, which is worse than no test at all.

## Core Rules

1. **Failures must be diagnosable from the log alone.** Every `t.Errorf` includes the function under test, the inputs, what we got, and what we wanted, in that order.
2. **No assertion libraries by default.** Use the standard `t.Errorf` / `t.Fatalf` plus `go-cmp` for structural comparison. `testify` is acceptable when adopted consistently — pick one and stick with it.
3. **Test observable behaviour, not implementation details.** If a refactor that preserves behaviour breaks the test, the test was wrong.
4. **Each test runs independently.** No execution-order dependencies, no shared global state without `t.Cleanup`.
5. **`t.Parallel()` whenever the test is safe to run in parallel.** Most are.
6. **`t.Helper()` is the first line of any helper function** that calls `t.Errorf`/`t.Fatalf`. Reserve `t.Fatal` for "next line is meaningless without this value"; everything else uses `t.Error`. Never call `t.Fatal`/`t.FailNow` from a non-test goroutine — send the failure back via channel.

## "Useful Failures" Format

The failure message is the test's user interface. The canonical shape:

```
FunctionUnderTest(input) = got, want want
```

```go
// Good
t.Errorf("Add(2, 3) = %d, want %d", got, 5)

// Bad — no function, no inputs, reversed
t.Errorf("expected %d but got %d", 5, got)
```

Always print **got before want**. With `cmp.Diff(want, got)`, the diff shows `(-want +got)` — echo that direction in your message.

## "No Asserts" Philosophy

Standard-library testing with `if` + `t.Errorf` reads as plain Go and produces messages you control. Assertion libraries shorten call sites but trade away message quality and reorder the `got`/`want` convention.

- **Default** — `if got != want { t.Errorf("...") }` plus `cmp.Diff` for structs, slices, maps, protos.
- **Permitted** — `testify` if the team agrees and `testifylint` is enabled. `require` only when continuing is meaningless.
- **Avoid** — mixing styles within the same package.

For protocol buffers, add `protocmp.Transform()` as a `cmp` option. Don't diff serialised JSON strings — decode and `cmp.Diff` instead.

## t.Error vs t.Fatal

Use `t.Error` by default; reserve `t.Fatal` for "the next line is meaningless without this value" (failed setup, failed decode before use). **Never** call `t.Fatal`/`t.FailNow` from a goroutine other than the test goroutine — it does not stop the test. Send the failure back via channel.

> Read [references/assertions-and-helpers.md](references/assertions-and-helpers.md) when designing helpers, custom comparers, or migrating between stdlib testing and `testify`.

## Table-Driven Tests

```go
func TestCalculatePrice(t *testing.T) {
    tests := []struct {
        name      string
        quantity  int
        unitPrice float64
        want      float64
    }{
        {"single item",   1,   10.0, 10.0},
        {"bulk discount", 100, 10.0, 900.0},
        {"zero quantity", 0,   10.0, 0.0},
    }
    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            t.Parallel()
            got := CalculatePrice(tt.quantity, tt.unitPrice)
            if got != tt.want {
                t.Errorf("CalculatePrice(%d, %.2f) = %.2f, want %.2f",
                    tt.quantity, tt.unitPrice, got, tt.want)
            }
        })
    }
}
```

Every case has a `name` used in `t.Run`; failure messages include inputs, not the row index. When cases need different mocks or assertion shapes, stop using a table and write separate functions.

## Helpers, Cleanup, Parallel

```go
func setupTestDB(t *testing.T) *sql.DB {
    t.Helper()
    db, err := sql.Open("sqlite3", ":memory:")
    if err != nil { t.Fatalf("open db: %v", err) }
    t.Cleanup(func() { _ = db.Close() })
    return db
}
```

`t.Helper()` is the first line of any helper that may fail; `t.Cleanup` runs after the test (and subtests) in LIFO order. Call `t.Parallel()` inside the subtest function. The `paralleltest` linter catches missing calls and the pre-1.22 loop-variable trap.

## HTTP Handlers

Use `httptest` with table-driven cases. See [references/http-and-fakes.md](references/http-and-fakes.md) for request/response body, header, and status assertions.

## Goroutine Leaks: goleak

Wire `go.uber.org/goleak` into every package that spawns goroutines:

```go
import "go.uber.org/goleak"

func TestMain(m *testing.M) { goleak.VerifyTestMain(m) }
```

Per-test: `defer goleak.VerifyNone(t)`. Exclusions go to `goleak.IgnoreTopFunction(...)` — avoid `IgnoreAnyFunction`.

## Deterministic Time: testing/synctest

For timer/context/deadline tests, `testing/synctest` (Go 1.25+) gives reproducible ordering. Synthetic time advances only when every goroutine in the bubble is blocked:

```go
synctest.Test(t, func(t *testing.T) {
    ctx, cancel := context.WithTimeout(t.Context(), 5*time.Second)
    defer cancel()
    time.Sleep(5 * time.Second)
    synctest.Wait()
    if !errors.Is(ctx.Err(), context.DeadlineExceeded) {
        t.Fatalf("got %v, want DeadlineExceeded", ctx.Err())
    }
})
```

Use `synctest.Test` on Go 1.25+ and 1.26+. The Go 1.24 `GOEXPERIMENT=synctest` `synctest.Run` API is only for modules still on 1.24.

## Fuzzing and Benchmarks

Native fuzzing finds inputs you would never write by hand. Seed with `f.Add`, then `f.Fuzz`; check fuzzer-discovered corpora (`testdata/fuzz/...`) into git as regression tests.

Benchmarks use `for b.Loop()` on Go 1.24+ (the legacy `b.N` loop only when targeting older versions). Sub-benchmarks across sizes use `b.Run(fmt.Sprintf("n=%d", n), ...)`. For methodology, `benchstat`, and CI regression detection, see a dedicated `go-benchmark` skill — not this one.

> Read [references/fuzz-synctest-bench.md](references/fuzz-synctest-bench.md) when wiring fuzz corpora into CI, designing `synctest`-based timer tests, or writing comparable benchmark suites with `b.Loop`.

## Integration Tests

Separate by build tag so `go test ./...` stays fast:

```go
//go:build integration

package mypackage_test
```

Run with `go test -tags=integration ./...`. Integration tests own their fixtures (containers, schemas, fixtures) via `t.Cleanup`.

> Read [references/http-and-fakes.md](references/http-and-fakes.md) when writing HTTP handler tests, mocking via consumer-owned interfaces, or stubbing time.

## Anti-Patterns

| Anti-pattern | Do this instead |
|---|---|
| `t.Errorf("got %d", got)` without the function or wanted value | `FunctionUnderTest(input) = got, want want` |
| Comparing error strings (`err.Error() == "..."`) | `errors.Is` / `errors.As` |
| Calling `t.Fatal` from a spawned goroutine | Send via channel; main goroutine calls `t.Fatal` |
| Tables of cases with conditional setup per row | Split into separate test functions |
| Subtests without `t.Run(tt.name, ...)` | Always name and `t.Run` |
| Mocking concrete types from another package | Define a small interface in the consumer; pass a fake |
| `time.Sleep` to wait for "the goroutine to do its thing" | `synctest.Test` or explicit synchronisation |
| Snapshot tests that compare serialised JSON | Decode then `cmp.Diff` |
| Mutating `os.Args`/env/`flag.CommandLine` without `t.Cleanup` | Save and restore in `t.Cleanup` |

## Verification Checklist

- [ ] Every failure message includes function, inputs, got, and want, in that order
- [ ] `cmp.Diff` calls use `(-want +got)` order and echo it in the message
- [ ] Table-driven cases have `name` fields and use `t.Run`
- [ ] Helpers call `t.Helper()` and use `t.Cleanup` for teardown
- [ ] Parallel-safe tests call `t.Parallel()`; `paralleltest` is clean
- [ ] Packages that spawn goroutines wire `goleak.VerifyTestMain` or per-test `VerifyNone`
- [ ] Timer/deadline tests use `testing/synctest`, not `time.Sleep`
- [ ] Integration tests are gated by a build tag and own their fixtures
- [ ] `go test -race ./...` is clean; fuzz corpora are checked into `testdata/fuzz/...`

## References

- [references/assertions-and-helpers.md](references/assertions-and-helpers.md) — useful failures, `cmp.Diff`, helpers, `testify` interop
- [references/http-and-fakes.md](references/http-and-fakes.md) — `httptest`, consumer-owned fakes, time stubs
- [references/fuzz-synctest-bench.md](references/fuzz-synctest-bench.md) — fuzzing, `testing/synctest`, `b.Loop` benchmarks
- [references/goleak-and-flakes.md](references/goleak-and-flakes.md) — leak detection, flake diagnosis, race triage
