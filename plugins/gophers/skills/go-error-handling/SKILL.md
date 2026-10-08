---
name: go-error-handling
description: "Use when writing, wrapping, inspecting, or logging Go errors. Covers strategy choice (sentinel vs typed vs opaque), wrapping with %w/%v, errors.Is/As/Join, the log-or-return rule, error strings, and panic/recover boundaries. Apply proactively whenever a function returns or accepts an error, even if the user has not asked about error handling."
license: MIT
compatibility: "Designed for Claude Code or similar AI coding agents. Requires Go 1.20+ for errors.Join. Wrapping (%w, errors.Is/As) requires Go 1.13+."
allowed-tools: Read Edit Write Glob Grep Bash(go:*) Bash(golangci-lint:*)
---

# Go Error Handling

Errors in Go are values. Treat them as part of the API: choose a strategy per failure mode, propagate with wrapping, inspect with `errors.Is`/`As`, and handle each error **exactly once**.

## Core Rules

1. **Errors are values, not exceptions.** Return them; do not panic across API boundaries.
2. **Handle each error exactly once.** *Either* log it *or* return it — never both.
3. **The caller decides what is exceptional.** Library code returns; binaries (or top-level handlers) decide whether to log, retry, or exit.
4. **Wrap only when you add real context.** A wrap that just repeats the function name is noise. Use `%w` to preserve identity; `%v` to deliberately hide an unstable type.

## Strategy Decision

Pick the simplest strategy that meets the caller's needs:

| Strategy | When to use | Example |
|---|---|---|
| **Opaque error** (default) | Caller only needs to know *something* failed | `errors.New("invalid input")` |
| **Sentinel error** | Caller needs to test for a specific named condition | `io.EOF`, `sql.ErrNoRows` |
| **Typed error** | Caller needs structured fields (path, code, retry-after) | `*os.PathError`, `*url.Error` |
| **Joined errors** | A single operation produced several independent failures | `errors.Join(errA, errB)` |

> Read [references/strategy-decision.md](references/strategy-decision.md) when the caller's needs are unclear or when migrating between strategies without breaking callers.

## Writing Errors

### Strings

- **Lowercase, no trailing punctuation.** Errors are composed: `fmt.Errorf("write %s: %w", path, err)` reads as one sentence.
- **Be specific.** `"open config: permission denied"` beats `"failed to open file"`.
- **Do not include the function name.** Stack context is added by wrapping at each layer.

### Creating

```go
// Opaque — the caller only checks != nil
return errors.New("invalid character in token")

// Sentinel — exported, package-level, named ErrXxx
var ErrNotFound = errors.New("user: not found")

// Typed — when callers need structured fields
type ValidationError struct {
    Field string
    Rule  string
}
func (e *ValidationError) Error() string {
    return fmt.Sprintf("validation: %s violates %s", e.Field, e.Rule)
}
```

## Wrapping and Inspection

### Wrap with `%w` to add context while preserving identity

```go
if err := db.Get(id); err != nil {
    return fmt.Errorf("loading user %d: %w", id, err)
}
```

### Inspect with `errors.Is` (identity) and `errors.As` (type)

```go
if errors.Is(err, sql.ErrNoRows) { /* handled */ }

var ve *ValidationError
if errors.As(err, &ve) {
    return reply.BadRequest(ve.Field)
}
```

**Never** compare error strings (`err.Error() == "..."`) — strings are not stable API.

### Join independent failures

```go
errs := errors.Join(
    validate(name),
    validate(email),
    validate(password),
)
if errs != nil {
    return errs // errors.Is/As walks both branches
}
```

> Read [references/wrapping-vs-shadowing.md](references/wrapping-vs-shadowing.md) when deciding between `%w` (expose) and `%v` (hide), or when wrapping would leak an implementation detail.

## Error Flow

### Log or return — not both

```go
// Bad: caller will log it again, producing duplicate lines
if err := svc.Do(ctx); err != nil {
    slog.ErrorContext(ctx, "svc.Do failed", "err", err)
    return err
}

// Good: log only at the boundary that decides the request is done
if err := svc.Do(ctx); err != nil {
    return fmt.Errorf("doing svc work: %w", err)
}
```

The HTTP handler / job runner / `main` is the only layer that logs.

### Reduce nesting with guard clauses

```go
// Bad
if err == nil {
    if x, ok := f(); ok {
        return x, nil
    }
}
return zero, err

// Good
if err != nil {
    return zero, err
}
x, ok := f()
if !ok {
    return zero, errSomething
}
return x, nil
```

## Panic and Recover

`panic` is for **programmer errors** (impossible states) and **package initialization**. It is never the right way to return a normal failure.

```go
// Acceptable: invariants the type guarantees
func (q *Queue) MustEnqueue(v T) { if err := q.Enqueue(v); err != nil { panic(err) } }

// Acceptable: recover at the goroutine boundary so one bad request cannot kill the server
defer func() {
    if r := recover(); r != nil {
        log.Error("panic recovered", "value", r, "stack", debug.Stack())
        http.Error(w, "internal error", 500)
    }
}()
```

Do **not** use `recover` to convert panics into errors as normal control flow.

For custom error types, implement `Unwrap() error` (or `Unwrap() []error` in Go 1.20+) so `errors.Is`/`As` can reach the cause. See [references/wrapping-vs-shadowing.md](references/wrapping-vs-shadowing.md#custom-unwrap).

## Anti-Patterns

| Anti-pattern | Why it hurts | Do this instead |
|---|---|---|
| `return errors.New(err.Error())` | Drops identity; `errors.Is` breaks | `return fmt.Errorf("ctx: %w", err)` |
| `if err.Error() == "EOF"` | String matching against unstable text | `errors.Is(err, io.EOF)` |
| `_ = doThing()` | Silently swallows failures | Handle, log at boundary, or document why |
| Returning `*MyError` (concrete pointer) | Typed-nil trap; non-nil interface | Return `error` (see [references/typed-nil-trap.md](references/typed-nil-trap.md)) |
| Logging then returning the same error | Duplicate log lines, no single source of truth | Log only at the top boundary |
| Wrapping at every layer with no new info | `"a: b: c: d: real error"` chains | Drop the wrap and `return err` |

## Verification Checklist

Before finishing an error-handling change:

- [ ] No `err.Error()` string comparisons
- [ ] All wrapping uses `%w` (or `%v` is intentional and commented)
- [ ] Functions return the `error` interface, not concrete types
- [ ] Each error is logged at most once (at the request/job boundary)
- [ ] Sentinels are package-level `var ErrXxx = errors.New(...)`
- [ ] Typed errors expose only the fields callers actually need

## References

- [references/strategy-decision.md](references/strategy-decision.md) — picking opaque vs sentinel vs typed
- [references/wrapping-vs-shadowing.md](references/wrapping-vs-shadowing.md) — `%w` vs `%v` decisions
- [references/typed-nil-trap.md](references/typed-nil-trap.md) — why returning `*MyErr` breaks `== nil`
