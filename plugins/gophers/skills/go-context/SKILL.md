---
name: go-context
description: "Use when designing, propagating, or debugging context.Context flow in Go — first-parameter placement, deadlines and cancellation, request-scoped values, WithoutCancel for fire-and-forget work, and key-collision-safe value patterns. Apply proactively whenever a function takes ctx, spawns work, or accepts request-scoped data, even if the user has not asked about context."
license: MIT
compatibility: "Designed for Claude Code or similar AI coding agents. Requires Go 1.7+ (context in std lib). context.WithoutCancel needs Go 1.21+."
allowed-tools: Read Edit Write Glob Grep Bash(go:*) Bash(golangci-lint:*)
---

# Go Context Usage

`context.Context` carries the cancellation, deadline, and request-scoped values for a single unit of work. Pass it explicitly through the entire call chain — never store it, never replace it with `Background()` mid-flight, never use it as a side-channel for ordinary parameters.

## Core Rules

1. **`ctx` is the first parameter**, named `ctx context.Context`. No exceptions outside interface stubs imposed by external APIs.
2. **Propagate the caller's `ctx`** all the way down. Do not start a new tree with `context.Background()` inside a request path.
3. **Do not store `Context` in a struct**. Pass it to each method that needs it.
4. **Always `defer cancel()`** after `WithCancel`/`WithTimeout`/`WithDeadline`, unless ownership is explicitly transferred.
5. **Context values are for request-scoped metadata only** (request ID, auth principal, trace). Never for optional function parameters or config.
6. **Value keys must be unexported named types** to prevent cross-package collisions.

## Where Does Data Belong?

Pick the most explicit option that fits — context values are the last resort.

| Option | Use for | Why |
|---|---|---|
| Function parameter | Anything the function *needs* to do its job | Type-checked, visible at call site |
| Method receiver | State that belongs to the type | Already in scope |
| Package-level config | Process-wide, immutable | One owner, no hidden flow |
| `context.Value` | Request-scoped metadata that crosses layers without being a function arg | Untyped — use sparingly |

> Read [references/values-and-keys.md](references/values-and-keys.md) for the unexported-key pattern, typed accessors, and OpenTelemetry/trace propagation.

## Constructors

| Situation | Use |
|---|---|
| `main`, `init`, top-level test | `context.Background()` |
| Placeholder while plumbing is incomplete | `context.TODO()` |
| Inside an HTTP handler | `r.Context()` |
| Need manual cancellation | `context.WithCancel(parent)` |
| Need a deadline / timeout | `context.WithTimeout(parent, d)` / `WithDeadline` |
| Background work that must outlive the request (Go 1.21+) | `context.WithoutCancel(parent)` |

## Propagation: The One Rule

```go
// Bad — breaks the chain, downstream cannot be cancelled
func (s *OrderService) Create(ctx context.Context, o Order) error {
    return s.db.ExecContext(context.Background(), insertSQL, o.ID)
}

// Good — same ctx flows HTTP handler -> service -> DB -> external API
func (s *OrderService) Create(ctx context.Context, o Order) error {
    return s.db.ExecContext(ctx, insertSQL, o.ID)
}
```

## Deriving and Cancelling

```go
ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
defer cancel() // release resources even on the happy path

select {
case <-ctx.Done():
    return ctx.Err()
case res := <-doAsync(ctx):
    return res
}
```

> Read [references/cancellation-and-deadlines.md](references/cancellation-and-deadlines.md) for `WithoutCancel`, `AfterFunc`, and long-running goroutine cancellation patterns.

## Don't Wrap `Context` in Custom Types

```go
// Bad — pollutes the standard signature
type MyCtx interface {
    context.Context
    UserID() string
}

// Good — keep the signature standard, extract via helper
func UserIDFrom(ctx context.Context) (string, bool) { /* ... */ }
```

## Enforce With Linters

Most context mistakes are mechanical and a linter will catch them in CI before review:

- `govet -vet=context` — flags non-first `context.Context` parameters and lost cancels.
- `staticcheck SA1012` — calls passing `nil` context.
- `contextcheck` (`golangci-lint`) — verifies downstream calls propagate `ctx`.
- `noctx` — flags HTTP/SQL APIs called without their `*Context` variant.

Run `golangci-lint run --enable=contextcheck,noctx,staticcheck` in CI for any project that exposes `context.Context`.

## Anti-Patterns

| Anti-pattern | Why it hurts | Do this instead |
|---|---|---|
| `ctx context.Context` stored on a struct field | Lifetime becomes invisible; outlives the request | Pass `ctx` to each method |
| `context.Background()` mid-call | Cancellation chain breaks; goroutines leak | Use the caller's `ctx` |
| `ctx.Value("user-id")` with a string key | Cross-package collisions, no type safety | Unexported key type + typed getter |
| Passing `nil` as a context | Panics on `Done()` / `Value()` | Use `context.TODO()` while plumbing |
| `WithTimeout` without `defer cancel()` | Leaks the timer until parent finishes | `defer cancel()` on the next line |
| Custom `MyContext` interface | Breaks every standard signature | Keep `context.Context`, extract with helpers |

## Verification Checklist

- [ ] Every function that does I/O, blocks, or calls another `ctx`-aware API takes `ctx context.Context` as its **first** parameter.
- [ ] No `context.Context` field on any struct (search: `ctx\s+context\.Context` inside `type ... struct`).
- [ ] Every `WithCancel`/`WithTimeout`/`WithDeadline` is followed by `defer cancel()` on the next line.
- [ ] No `context.Background()` or `context.TODO()` calls inside request handlers.
- [ ] All context value keys are unexported named types, accessed via typed getters.
- [ ] `golangci-lint run --enable=contextcheck,noctx` passes.

## References

- [references/values-and-keys.md](references/values-and-keys.md) — unexported key types, typed accessors, trace propagation
- [references/cancellation-and-deadlines.md](references/cancellation-and-deadlines.md) — timeouts, `WithoutCancel`, `AfterFunc`, goroutine cancellation
- [references/http-and-db.md](references/http-and-db.md) — handlers, `NewRequestWithContext`, `QueryContext`/`ExecContext`
