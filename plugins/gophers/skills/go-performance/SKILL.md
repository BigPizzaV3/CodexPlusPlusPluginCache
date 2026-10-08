---
name: go-performance
description: "Use when profiling, benchmarking, or optimizing Go code — includes the measure-first methodology, the pprof-driven decision tree (which symptom maps to which fix), allocation reduction, capacity hints, hot-path patterns (strconv vs fmt, repeated string→byte conversions, strings.Builder), and runtime tuning. Apply proactively whenever a user mentions slowness, allocations, GC pressure, or asks for benchmarks, even if no specific pattern is named."
license: MIT
compatibility: "Designed for Claude Code or similar AI coding agents. Methodology is Go-version-neutral; `b.Loop()` and PGO require Go 1.21+/1.24+."
allowed-tools: Read Edit Write Glob Grep Bash(go:*) Bash(golangci-lint:*)
---

# Go Performance

Performance work in Go follows one rule: **measure first**. Intuition about bottlenecks is wrong roughly 80% of the time. Profile, hypothesise, change *one thing*, re-measure. The patterns in this skill apply only on hot paths — premature optimisation makes code worse without making it faster.

## Core Rules

1. **Profile before optimising.** `go test -bench`, `pprof`, `fgprof` — never guess.
2. **One change at a time.** Multi-change "optimisation" passes are unreviewable.
3. **Compare with `benchstat`.** Single runs lie; you need ≥6 runs to see signal.
4. **Allocation reduction usually beats CPU micro-optimisation** — the GC is fast but not free.
5. **Rule out external bottlenecks first.** If 90% of latency is the DB, faster Go code is irrelevant.
6. **Document optimisations in comments.** Future readers will revert "ugly" code without context.

## Iterative Methodology

The cycle is: **define goal → write benchmark → measure baseline → diagnose → improve one thing → re-measure → commit with the diff.**

```bash
# baseline
go test -bench=BenchmarkHotPath -benchmem -count=6 ./pkg/... | tee /tmp/report-1.txt

# (apply ONE change)

# compare
go test -bench=BenchmarkHotPath -benchmem -count=6 ./pkg/... | tee /tmp/report-2.txt
benchstat /tmp/report-1.txt /tmp/report-2.txt
```

If `benchstat` shows no statistically significant change, the optimisation didn't work — revert it. Keep the `/tmp/report-*.txt` files as an audit trail; paste the `benchstat` output in the commit body.

> Read [references/benchmarking-and-pprof.md](references/benchmarking-and-pprof.md) for benchmark writing, pprof workflow, and `b.Loop()` (Go 1.24+).

## Rule Out External Bottlenecks First

Before optimising any Go code, check that the bottleneck is actually in your process:

- **`fgprof`** — captures on-CPU and off-CPU (I/O wait) time. If off-CPU dominates, the issue is elsewhere.
- **Goroutine profile** — many goroutines blocked in `net.(*conn).Read` or `database/sql` means external I/O is the limit.
- **Distributed tracing** — span breakdown shows which upstream is slow.

If the bottleneck is external (DB, downstream API, disk), fix that — query tuning, indexes, connection pools, caching. No Go-level change will help.

## Decision Tree: Where Is Time Spent?

| Symptom (from pprof) | Action |
|---|---|
| High `alloc_objects` / `alloc_space` | reduce allocations (preallocate, pool, struct fields) |
| One function dominates CPU profile | inline-friendly rewrite, avoid reflection, simpler algorithm |
| High GC% / OOM kills | tune `GOMEMLIMIT`, `GOGC`; reduce live heap |
| Goroutines blocked on I/O | concurrency, batching, connection pool tuning |
| Same computation many times | memoise / `singleflight` / cache |
| Wrong algorithm (O(n²) where O(n) exists) | fix algorithm before anything else |
| Mutex profile hot | reduce critical section, sharded locks, `sync.Pool` |

> Read [references/allocation-and-memory.md](references/allocation-and-memory.md) for allocation patterns, `sync.Pool`, struct alignment, and escape analysis.

## Concrete High-ROI Patterns

These are the small changes that consistently show up in profiles. Apply them when the symptom matches — not preemptively.

### 1. `strconv` over `fmt` for primitives

```go
// Bad — fmt parses a format string
s := fmt.Sprint(n)

// Good — direct conversion, ~2x faster, half the allocations
s := strconv.Itoa(n)
```

| | ns/op | allocs |
|---|---|---|
| `fmt.Sprint(n)` | ~143 | 2 |
| `strconv.Itoa(n)` | ~64 | 1 |

### 2. Move constant `[]byte` conversions out of loops

```go
// Bad — allocates on every iteration
for i := 0; i < n; i++ {
    w.Write([]byte("hello"))
}

// Good — convert once
hello := []byte("hello")
for i := 0; i < n; i++ {
    w.Write(hello)
}
```

About 7x faster in a tight loop.

### 3. Preallocate slice and map capacity

```go
// Bad — repeated growth, O(n) copies per growth
out := []Result{}
for _, x := range input {
    out = append(out, transform(x))
}

// Good — zero reallocations
out := make([]Result, 0, len(input))
for _, x := range input {
    out = append(out, transform(x))
}
```

Slice capacity is **exact**: `make([]T, 0, n)` allocates exactly `n` slots. Map capacity is a **hint** about bucket count, but still avoids the worst rehashes.

| | Time |
|---|---|
| no capacity | ~2.48s |
| with capacity | ~0.21s |

About 12x faster on the synthetic benchmark.

### 4. `strings.Builder` for loop-built strings

`s += w` in a loop is O(n²). Use `strings.Builder`, with `Grow(n)` when the final size is estimable.

### 5. Pass small fixed-size values

`*string`, `*int`, `*time.Time` add indirection without saving anything — strings and time.Time are already small headers. Use pointers only for mutation, types ~128B+, types embedding sync primitives, or where `nil` is meaningful.

> Read [references/concrete-patterns.md](references/concrete-patterns.md) for the full pattern catalogue with benchmark numbers.

## Anti-Patterns

| Anti-pattern | Why it hurts | Do this instead |
|---|---|---|
| Optimising without `pprof` | wrong target, wasted effort | profile first |
| Default `http.Client` for high-throughput callers | `MaxIdleConnsPerHost: 2` bottleneck | configure `Transport` |
| Logging inside hot loops | prevents inlining, allocates even when disabled | `slog.LogAttrs`, gate by level |
| `panic`/`recover` as control flow | stack trace allocation | error returns |
| `reflect.DeepEqual` in production | 50-200x slower than typed comparison | `slices.Equal`, `maps.Equal`, `bytes.Equal` |
| `unsafe` without a benchmark | rarely justified | benchmark + comment with numbers |
| No `GOMEMLIMIT` in containers | OOM kills under load | set to ~80% of container limit |

## Verification Checklist

- [ ] A benchmark exists for the function being optimised.
- [ ] Baseline `/tmp/report-1.txt` was captured before any change.
- [ ] Each change is a single commit with `benchstat` output in the body.
- [ ] `benchstat` shows the change is statistically significant (`p < 0.05`).
- [ ] Profile (`pprof`) confirms the targeted hotspot actually moved.
- [ ] Optimisations on production paths have an explanatory comment.
- [ ] `GOMEMLIMIT` is configured for any containerised long-running process.

## Enforce With Linters

Mechanical anti-patterns belong to CI:

- `gocritic` — flags `fmt.Sprint(x)` for primitives, repeated allocations.
- `prealloc` — slices that could be preallocated.
- `gocyclo` / `funlen` — proxies for code that is hard to optimise.
- `fieldalignment` (go vet) — struct layout for memory reduction.

## References

- [references/benchmarking-and-pprof.md](references/benchmarking-and-pprof.md) — writing benchmarks, `benchstat`, pprof workflow, `b.Loop()`
- [references/allocation-and-memory.md](references/allocation-and-memory.md) — escape analysis, `sync.Pool`, struct alignment, backing-array leaks
- [references/concrete-patterns.md](references/concrete-patterns.md) — full pattern catalogue with numbers
