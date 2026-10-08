# Benchmarking, benchstat, and pprof

The only honest way to know if an optimisation worked is to measure it. Go's built-in benchmark framework plus `pprof` plus `benchstat` cover ~95% of performance work.

## Writing Benchmarks

A benchmark is a function in `_test.go` that runs the code under test `b.N` times. The framework picks `b.N` automatically to get a stable measurement.

```go
func BenchmarkEncode(b *testing.B) {
    req := &Request{ID: "abc", Body: bigBody}
    b.ResetTimer() // exclude setup
    for i := 0; i < b.N; i++ {
        _ = Encode(io.Discard, req)
    }
}
```

Rules:

- **One thing per benchmark.** Mixing concerns contaminates results.
- **`b.ResetTimer()` after setup.** Otherwise setup time skews short benchmarks.
- **Use `io.Discard` as a sink.** Writing to a real file makes you measure the kernel.
- **`b.ReportAllocs()`** (or `-benchmem` on the CLI) for allocation numbers.

### `b.Loop()` (Go 1.24+)

The new idiom replaces `for i := 0; i < b.N; i++` and handles timer reset, parallelism setup, and keep-alive correctly:

```go
func BenchmarkEncode(b *testing.B) {
    req := &Request{ID: "abc"}
    for b.Loop() {
        _ = Encode(io.Discard, req)
    }
}
```

Prefer it on Go 1.24+.

## Running Benchmarks

```bash
go test -bench=BenchmarkEncode -benchmem -count=6 ./pkg/...
```

`-count=6` runs the same benchmark six times so `benchstat` has data to compute confidence intervals. Anything less than 5 runs and you cannot tell signal from noise.

Save the output:

```bash
go test -bench=. -benchmem -count=6 ./... | tee /tmp/report-1.txt
```

## `benchstat`

Compare two runs:

```bash
go install golang.org/x/perf/cmd/benchstat@latest

benchstat /tmp/report-1.txt /tmp/report-2.txt
```

Output:

```
                  │ /tmp/report-1.txt │   /tmp/report-2.txt    │
                  │      sec/op       │ sec/op     vs base     │
Encode-8           14.32µ ± 1%          6.18µ ± 0% -56.84% (p=0.002 n=6)
```

`p` is the p-value: anything ≥ 0.05 is statistically insignificant — the change did **not** make a measurable difference.

## `pprof` Workflow

CPU profile from a benchmark:

```bash
go test -bench=BenchmarkEncode -cpuprofile=cpu.out ./pkg/...
go tool pprof cpu.out
(pprof) top
(pprof) list FunctionName
(pprof) web                     # SVG callgraph in browser
```

Memory profile:

```bash
go test -bench=BenchmarkEncode -memprofile=mem.out ./pkg/...
go tool pprof -alloc_objects mem.out
```

The two memory views:

- `-alloc_objects` — total allocations (cumulative). Best for "where are GC pauses coming from?".
- `-alloc_space` — bytes allocated. Best for "what allocates the most memory?".
- `-inuse_objects` / `-inuse_space` — live heap at sample time. Best for leak hunts.

## Live Profiling

For a running server, expose `net/http/pprof`:

```go
import _ "net/http/pprof"
go func() { log.Println(http.ListenAndServe("localhost:6060", nil)) }()
```

Then:

```bash
go tool pprof http://localhost:6060/debug/pprof/profile?seconds=30   # CPU
go tool pprof http://localhost:6060/debug/pprof/heap                 # memory
go tool pprof http://localhost:6060/debug/pprof/goroutine            # goroutines
```

**Never expose pprof on a public interface.** Bind to localhost or behind authenticated middleware.

## `fgprof`: On-CPU + Off-CPU

Standard `pprof` only captures on-CPU time — sleeping/blocked goroutines are invisible. `fgprof` captures both, which is what you need when the suspicion is I/O-bound:

```bash
go install github.com/felixge/fgprof@latest
# expose handler at /debug/fgprof, then:
go tool pprof http://localhost:6060/debug/fgprof?seconds=30
```

If off-CPU dominates, the bottleneck is *waiting* on something (DB, network, disk) — not your CPU.

## Escape Analysis

`go build -gcflags='-m'` shows what escapes to the heap.

```bash
go build -gcflags='-m -l' ./pkg/... 2>&1 | grep escapes
```

Common reasons something escapes:

- Returned by pointer.
- Stored in a slice/map of pointers.
- Captured by a closure that itself escapes.
- Passed to a function that takes `any` (`interface{}`).

Eliminating one escape per loop iteration is often the difference between 0 allocs/op and N allocs/op.

## Anti-Patterns

- Single-run benchmarks ("3% faster"). Need ≥6 runs and `benchstat`.
- Benchmarks that include setup time (`time.Now()` before the loop).
- Profiling on a machine doing other work (laptop with Slack, Spotify, browser).
- Reading `cpu.out` numbers in absolute milliseconds. They're sample counts; use them comparatively.
- Optimising the wrong function because it's "at the top" of `top` without using `list` to see the real culprit (inlined helpers often dominate).
