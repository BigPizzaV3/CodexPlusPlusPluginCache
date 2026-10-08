# Fuzzing, testing/synctest, and Benchmarks

Three test shapes that earn their own reference: fuzzing finds inputs you would never write; `synctest` makes timing tests deterministic; benchmarks measure real cost.

## Fuzzing

Native fuzzing (Go 1.18+) explores the input space starting from seeds. A `Fuzz` function is structured like a property test:

```go
func FuzzRoundTrip(f *testing.F) {
    f.Add("hello", uint8(0))
    f.Add("", uint8(1))
    f.Add("\x00\xff", uint8(255))

    f.Fuzz(func(t *testing.T, s string, mode uint8) {
        b, err := Encode(s, mode)
        if err != nil { return } // not all inputs are valid; skip
        got, err := Decode(b)
        if err != nil { t.Fatalf("decode(%v) failed: %v", b, err) }
        if got != s {
            t.Errorf("round-trip mismatch: in=%q mode=%d out=%q", s, mode, got)
        }
    })
}
```

Run locally with `go test -fuzz=FuzzRoundTrip -fuzztime=30s`. The fuzzer surfaces minimised crash inputs into `testdata/fuzz/FuzzRoundTrip/...`. **Check those files into git** — they become deterministic regression tests run by `go test ./...`.

### Choosing a property to fuzz

Fuzz round-trips, idempotents, and invariants — properties that hold for *every* valid input:

- `Decode(Encode(x)) == x`
- `Parse(Format(t)).Equal(t)`
- `Sort(Sort(xs))` equals `Sort(xs)`
- `Normalize(s) == Normalize(Normalize(s))`

Avoid fuzzing functions whose correctness depends on global state or external services. Those tests will flake.

### CI integration

Use `go test ./...` to replay the corpus on every PR. Schedule a longer fuzz run (15–60 minutes per fuzzer) on a nightly cron — fuzzers find bugs over hours, not seconds. Newly discovered crashes are committed by the maintainer with the fix.

## testing/synctest

`testing/synctest` (stable Go 1.25+) replaces real time with a synthetic clock controlled by the test. Inside the bubble, time advances only when every goroutine is blocked — which makes timer-dependent tests reproducible.

```go
import "testing/synctest"

func TestDebouncer(t *testing.T) {
    synctest.Test(t, func(t *testing.T) {
        d := NewDebouncer(100 * time.Millisecond)

        d.Trigger() // first event
        time.Sleep(50 * time.Millisecond)
        synctest.Wait()
        if d.Fired() { t.Fatal("fired before debounce window") }

        time.Sleep(50 * time.Millisecond)
        synctest.Wait()
        if !d.Fired() { t.Fatal("did not fire after debounce window") }
    })
}
```

### What synctest changes

- `time.Sleep`, `time.After`, `time.Ticker`, `time.NewTimer.Reset` use the synthetic clock.
- `context.WithTimeout` / `context.WithDeadline` use the synthetic clock.
- `synctest.Wait` blocks until every goroutine in the bubble is blocked.
- All goroutines started inside the bubble must finish before the test returns.

### When to use it

- Timeout and deadline behaviour
- Backoff and retry logic
- Token-bucket and leaky-bucket rate limiters
- `select` blocks with timers

### When not to use it

- Tests that depend on real wall-clock latency (network, fsync)
- Code that calls `runtime.Gosched()` or otherwise depends on the scheduler
- Tests that already pass deterministically without synthetic time

### Version compatibility

Use `synctest.Test` on Go 1.25+ and 1.26+. The Go 1.24 `GOEXPERIMENT=synctest` `synctest.Run` API only applies to modules pinned to 1.24. Do not use it in 1.25+ code.

## Benchmarks

### b.Loop (Go 1.24+)

The new loop form prevents the compiler from optimising away the work under test and removes a class of micro-benchmarking bugs:

```go
func BenchmarkParse(b *testing.B) {
    b.ReportAllocs()
    for b.Loop() {
        _, _ = Parse(input)
    }
}
```

Compare against legacy `for i := 0; i < b.N; i++ { ... }` — keep the legacy form only when the module targets Go <1.24 or when preserving existing benchmark history.

### Sub-benchmarks across parameters

```go
func BenchmarkConcat(b *testing.B) {
    sizes := []int{10, 100, 1000}
    for _, n := range sizes {
        b.Run(fmt.Sprintf("n=%d", n), func(b *testing.B) {
            b.ReportAllocs()
            input := strings.Repeat("x", n)
            for b.Loop() {
                _ = strings.Repeat(input, 10)
            }
        })
    }
}
```

Each sub-benchmark is independently runnable and shows up separately in `benchstat` output.

### Stable comparisons

Use `benchstat` to compare two runs:

```bash
go test -run=^$ -bench=. -count=10 -benchmem ./... > old.txt
# ... make change ...
go test -run=^$ -bench=. -count=10 -benchmem ./... > new.txt
benchstat old.txt new.txt
```

`-count=10` reduces noise. Anything less than 10 runs is hard to interpret. For deeper methodology — profiling from benchmarks, CI regression gates, allocation accounting — see a dedicated `go-benchmark` skill, not this one.

### Go 1.26+: t.ArtifactDir / b.ArtifactDir

When a benchmark or fuzz target needs to persist files for inspection (rendered output, captured payloads), use `ArtifactDir()` instead of writing to `t.TempDir` (which gets deleted) or to the working directory:

```go
func TestRenderGolden(t *testing.T) {
    dir := t.ArtifactDir()
    out := filepath.Join(dir, "rendered.json")
    if err := os.WriteFile(out, rendered, 0o644); err != nil {
        t.Fatal(err)
    }
    t.Logf("artifact: %s", out)
}
```

Available on `*testing.T`, `*testing.B`, and `*testing.F`.

## Anti-patterns

| Anti-pattern | Fix |
|---|---|
| Fuzz function with no seed corpus | Add `f.Add(...)` calls so the fuzzer starts with realistic inputs |
| Deleting `testdata/fuzz/...` after a crash is fixed | Keep them; they are regression tests |
| `time.Sleep(100*time.Millisecond)` to "let the worker run" | Use `synctest.Test` or a sync primitive |
| `b.N` loops on Go 1.24+ | Switch to `for b.Loop()` |
| Benchmarks with `-count=1` | Always use `-count=10` and `benchstat` for comparisons |
| Benchmarks that allocate the input inside the loop | Move setup out of the loop; use `b.ResetTimer` if you must |
