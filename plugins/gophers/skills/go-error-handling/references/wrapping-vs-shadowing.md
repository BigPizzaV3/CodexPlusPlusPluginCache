# Wrapping (`%w`) vs Shadowing (`%v`)

`fmt.Errorf` supports both. The difference is whether the underlying error remains inspectable.

## `%w` — Expose

The wrapped error is reachable via `errors.Is` and `errors.As`.

```go
if err := db.Get(id); err != nil {
    return fmt.Errorf("loading user %d: %w", id, err)
}

// Caller can still do:
errors.Is(err, sql.ErrNoRows) // true
```

**Use `%w` by default.** Adding context (what you were doing, with which inputs) while preserving identity is almost always what you want.

## `%v` — Hide

The error becomes a plain string. `errors.Is`/`As` cannot reach into it.

```go
return fmt.Errorf("loading user %d: %v", id, err)
// errors.Is(err, sql.ErrNoRows) is false
```

**Only use `%v` when you intentionally want to hide an implementation detail** — typically because the underlying error type is unstable, internal, or would leak abstraction.

```go
// The user of mypkg should not depend on sqlx error types
return fmt.Errorf("save: %v", sqlxErr)
```

When you do this, add a comment explaining why. A reviewer should never have to guess.

## When to Wrap

Wrap when **all three** are true:

1. You are adding meaningful context (a noun + an input)
2. You are on a layer boundary (DB → repo, repo → service, service → handler)
3. The caller might reasonably need to inspect the cause

Otherwise, just `return err`. Wrapping at every line creates `"a: b: c: d: real error"` chains that are noise, not signal.

## Double-Wrapping Anti-Pattern

```go
// Bad
if err := svc.Do(); err != nil {
    return fmt.Errorf("svc.Do failed: %w", err) // adds no new info
}
```

If the wrap text duplicates the function name, drop it: `return err`.

```go
// Good
if err := svc.Do(ctx, userID); err != nil {
    return fmt.Errorf("svc.Do user=%d: %w", userID, err) // adds an input the caller does not have
}
```

## Multiple Wraps with `errors.Join`

Wrapping is a chain (one cause). When several independent operations failed, use `errors.Join` instead:

```go
var errs []error
for _, item := range items {
    if err := process(item); err != nil {
        errs = append(errs, fmt.Errorf("item %s: %w", item.ID, err))
    }
}
return errors.Join(errs...) // nil if errs is empty
```

`errors.Is` and `errors.As` walk every branch.

## Custom Unwrap

For custom error types, implement `Unwrap` so `errors.Is`/`As` can reach the cause:

```go
type RetryableError struct{ Cause error }

func (e *RetryableError) Error() string { return "retryable: " + e.Cause.Error() }
func (e *RetryableError) Unwrap() error { return e.Cause }
```

For multi-cause errors, implement `Unwrap() []error` (Go 1.20+):

```go
type MultiError struct{ Errs []error }

func (m *MultiError) Error() string   { /* concatenate */ }
func (m *MultiError) Unwrap() []error { return m.Errs }
```

`errors.Is`/`As` will descend into every returned error. This is what `errors.Join` does internally.
