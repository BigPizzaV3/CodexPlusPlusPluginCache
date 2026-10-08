# Choosing an Error Strategy

A decision flow for picking the simplest strategy that meets the caller's needs.

## Decision Flow

```
Does the caller need to test for a specific failure?
├── No  → Opaque error: errors.New("...") or fmt.Errorf("...: %w", err)
└── Yes → Does the caller need structured fields?
          ├── No  → Sentinel error: var ErrX = errors.New("...")
          └── Yes → Typed error: type XError struct { ... }
```

If a single operation produced multiple independent failures, wrap them with `errors.Join`.

## Opaque Errors (Default)

Use when the caller's only meaningful action is "report and stop".

```go
return errors.New("invalid token")
return fmt.Errorf("reading %s: %w", path, err)
```

The caller does `if err != nil` and that is it. No identity, no fields, no API surface to maintain.

**Most errors should be opaque.** Reach for sentinel or typed only when a caller demonstrably needs to branch.

## Sentinel Errors

Use when callers must test for a specific named condition.

```go
package user

var (
    ErrNotFound = errors.New("user: not found")
    ErrInactive = errors.New("user: inactive")
)
```

Callers use `errors.Is`:

```go
if errors.Is(err, user.ErrNotFound) {
    return 404
}
```

**Rules:**
- Exported, package-level, named `ErrXxx`
- Prefixed with the package name in the string
- Document them in the package doc so callers know they exist
- Once exported, they are API — you cannot delete them without a major version bump

## Typed Errors

Use when callers need structured fields (a path, an HTTP status, a retry-after duration).

```go
type ValidationError struct {
    Field string
    Rule  string
}

func (e *ValidationError) Error() string {
    return fmt.Sprintf("validation: %s violates %s", e.Field, e.Rule)
}
```

Callers use `errors.As`:

```go
var ve *ValidationError
if errors.As(err, &ve) {
    http.Error(w, ve.Field, 400)
    return
}
```

**Rules:**
- Implement `Error() string` on a pointer receiver
- Expose only fields callers actually need — every exported field is API
- Return the `error` interface, never `*ValidationError`, to avoid the typed-nil trap

## Migrating Between Strategies

- **Opaque → Sentinel**: safe. Adding a new `ErrXxx` does not break existing `err != nil` callers.
- **Opaque → Typed**: safe for the same reason.
- **Sentinel → Typed**: breaking. Old `errors.Is(err, ErrX)` callers will silently stop matching.
- **Typed → Opaque**: breaking. Old `errors.As` callers will silently stop matching.

When a breaking change is needed, keep the old sentinel/typed error as an alias for one release cycle and document the migration.
