---
name: go-defensive
description: "Use when hardening Go code at API boundaries: copy slices/maps on entry and return, defer cleanup, verify interface compliance at compile time, model time with time.Time/time.Duration, design enum zero values, prefer crypto/rand, and inject clocks for testability. Apply proactively when reviewing for robustness. Error-handling strategy: see go-error-handling."
license: MIT
compatibility: "Designed for Claude Code or similar AI coding agents. `crypto/rand.Text` examples assume Go 1.24+."
allowed-tools: Read Edit Write Glob Grep Bash(go:*) Bash(golangci-lint:*)
---

# Go Defensive Programming

Hardening Go code is not paranoia — it is the discipline of making your boundaries honest. Copy what crosses them, clean up what you opened, model time and randomness honestly, and never let a panic escape a package.

## Core Rules

1. **Copy slices and maps at API boundaries.** They are reference types — leaking the backing array leaks mutation.
2. **`defer` the cleanup right after the acquire.** `f, err := os.Open(...); defer f.Close()`.
3. **Verify interface compliance at compile time:** `var _ I = (*T)(nil)`.
4. **Model time and durations with `time.Time` and `time.Duration`,** never raw ints.
5. **Inject `now func() time.Time`** instead of calling `time.Now()` directly in production code.
6. **Enums start at `iota + 1`** so the zero value is invalid.
7. **`crypto/rand` for secrets, never `math/rand`.**
8. **Panics never cross package boundaries.** Convert to errors at the edge.
9. **Avoid mutable package-level state.** Inject dependencies instead.

## Boundary Hardening Checklist

When you touch an exported function or method, walk this list in order:

| # | Check |
|---|---|
| 1 | Return errors, don't panic across boundaries |
| 2 | Copy slices/maps you'll retain |
| 3 | Copy slices/maps you'll return if internal state aliases them |
| 4 | `defer` Close / Unlock / cancel right after the acquire |
| 5 | Compile-time interface satisfaction check |
| 6 | `time.Time` / `time.Duration` types, injected clock |
| 7 | Enum zero = invalid (`iota + 1`) |
| 8 | `crypto/rand` for any secret material |

## Copy at API Boundaries

```go
// Receiving: copy a slice we'll retain
func (d *Driver) SetTrips(trips []Trip) {
    d.trips = make([]Trip, len(trips))
    copy(d.trips, trips)
}

// Returning: copy a map so callers can't mutate our state
func (s *Stats) Snapshot() map[string]int {
    out := make(map[string]int, len(s.counters))
    for k, v := range s.counters {
        out[k] = v
    }
    return out
}
```

> Read [references/boundary-copying.md](references/boundary-copying.md) when deciding which boundaries actually need copies (and when copying is wasted work).

## Defer Cleanup

`defer` evaluates arguments at the `defer` statement and runs the call when the surrounding function returns (LIFO order):

```go
f, err := os.Open(name)
if err != nil {
    return err
}
defer f.Close()
```

Place `defer` immediately after the acquire — the proximity makes pair-correctness reviewable at a glance.

For locks:

```go
mu.Lock()
defer mu.Unlock()
```

Beware of `defer` inside loops — accumulated defers run only when the function returns, not when the iteration ends.

## Verify Interface Compliance

```go
var _ http.Handler = (*Handler)(nil)
```

If `(*Handler)` ever stops satisfying `http.Handler`, the build fails. The line costs nothing at runtime and gives you a free contract.

## Time Modeling

```go
// Bad — what unit is timeout?
type Config struct {
    Timeout int
}

// Good
type Config struct {
    Timeout time.Duration
}
```

For wall-clock work, inject the clock so tests can pin time:

```go
type Signer struct {
    now func() time.Time
}

func NewSigner() *Signer {
    return &Signer{now: time.Now}
}

// In tests:
s := &Signer{now: func() time.Time { return fixedTime }}
```

> Read [references/time-and-enums.md](references/time-and-enums.md) for monotonic time, time zones, struct tags, and embedding tradeoffs.

## Crypto Random

```go
import "crypto/rand"

// Go 1.24+
func APIKey() string { return rand.Text() }
```

`math/rand` and `math/rand/v2` are predictable from a seed — never use them for keys, tokens, nonces, or any secret material.

## Must Functions

`Must*` helpers panic on error. They are appropriate **only** at program initialization, where failure means the program cannot start:

```go
var (
    validID = regexp.MustCompile(`^[a-z][a-z0-9-]{0,62}$`)
    tmpl    = template.Must(template.ParseFiles("index.html"))
)
```

Don't write `MustFoo` for runtime call sites — it shifts an error condition into a crash.

> Read [references/must-and-panic.md](references/must-and-panic.md) for writing custom `Must*`, recovering at goroutine boundaries, and distinguishing `panic` from `log.Fatal`.

## Avoid Mutable Globals

```go
// Bad — testing requires save/restore dance
var DB *sql.DB

// Good — pass the dependency
type Service struct {
    db *sql.DB
}
```

Constants and once-initialized lookup tables are fine. Mutable package-level vars are a code smell.

## Anti-Patterns

| Anti-pattern | Why it hurts | Do this instead |
|---|---|---|
| Storing the caller's slice without copying | Mutation aliasing | `make` + `copy` |
| Returning the internal map directly | External mutation of state | Return a snapshot |
| `time.Now()` in business logic | Hostile to tests | Inject `now func() time.Time` |
| `var Timeout = 5` read as seconds elsewhere | Ambiguous unit | `time.Duration` |
| `math/rand` for keys | Predictable from seed | `crypto/rand` |
| `panic` to signal a domain error | Crashes the caller | Return an error |
| `defer` inside a tight loop | Defers stack until function return | Wrap loop body in a function |

## Verification Checklist

- [ ] Slices/maps stored from callers, or returned aliasing internal state, are copied
- [ ] Every `Open`/`Lock` has a `defer Close`/`Unlock` next to it
- [ ] Compile-time interface checks cover exported implementations
- [ ] Durations are `time.Duration`, timestamps are `time.Time`; clock is injected
- [ ] Enum zero values are invalid (or explicitly meaningful)
- [ ] No secret material derived from `math/rand`
- [ ] No mutable package-level vars; no `panic` across library boundaries

## References

- [references/boundary-copying.md](references/boundary-copying.md) — when defensive copies pay off vs. wasted allocation
- [references/time-and-enums.md](references/time-and-enums.md) — modeling time, durations, enums, struct tags
- [references/must-and-panic.md](references/must-and-panic.md) — `Must*` helpers, recover at boundaries, panic vs `log.Fatal`
