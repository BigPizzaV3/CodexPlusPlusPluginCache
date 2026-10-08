# Control Flow

The shape of control flow tells the reader what is normal and what is exceptional. The same logic written with deep nesting and with early returns reads very differently.

## Guard Clauses (Early Return)

Errors and edge cases are handled first; the happy path stays at minimum indentation.

```go
// Bad — happy path buried under nesting
func send(ctx context.Context, msg Msg) error {
    if msg.IsValid() {
        if conn, err := dial(ctx, msg.Addr); err == nil {
            if err := conn.Write(msg.Bytes()); err == nil {
                return conn.Close()
            } else {
                return err
            }
        } else {
            return err
        }
    } else {
        return errors.New("invalid message")
    }
}

// Good — fail fast, happy path at column 1
func send(ctx context.Context, msg Msg) error {
    if !msg.IsValid() {
        return errors.New("invalid message")
    }
    conn, err := dial(ctx, msg.Addr)
    if err != nil {
        return err
    }
    if err := conn.Write(msg.Bytes()); err != nil {
        return err
    }
    return conn.Close()
}
```

## Eliminate Unnecessary `else`

When the `if` body unconditionally exits (`return`, `break`, `continue`, `panic`), the `else` is dead weight.

```go
// Bad
if cached, ok := c.Get(k); ok {
    return cached
} else {
    return c.Load(k)
}

// Good
if cached, ok := c.Get(k); ok {
    return cached
}
return c.Load(k)
```

For assignment, use default-then-override:

```go
// Bad — three branches that all assign the same variable
var lvl slog.Level
if debug {
    lvl = slog.LevelDebug
} else if verbose {
    lvl = slog.LevelWarn
} else {
    lvl = slog.LevelInfo
}

// Good — pick the default, override conditionally
lvl := slog.LevelInfo
switch {
case debug:
    lvl = slog.LevelDebug
case verbose:
    lvl = slog.LevelWarn
}
```

## Switch Over If/Else Chains

When all branches compare the same expression, `switch` makes the intent explicit and the compiler can warn on missing cases (with `exhaustive` linter).

```go
// Bad
if status == StatusActive {
    activate()
} else if status == StatusInactive {
    deactivate()
} else if status == StatusPaused {
    pause()
}

// Good
switch status {
case StatusActive:
    activate()
case StatusInactive:
    deactivate()
case StatusPaused:
    pause()
default:
    return fmt.Errorf("unexpected status: %v", status)
}
```

### Tagless switch

When branches compare unrelated conditions, drop the tag:

```go
switch {
case user.IsAdmin:
    return allow()
case resource.IsPublic && user.IsVerified:
    return allow()
case time.Since(user.LastLogin) > 30*24*time.Hour:
    return requireReauth()
}
return deny()
```

This is a common idiom for "first matching condition wins", and reads cleaner than a chain of `if`s.

### Fallthrough

Go's `switch` does **not** fall through by default — `fallthrough` is an explicit keyword. Reserve it for genuinely cascading cases; if every case has `fallthrough`, you wanted a different structure.

## Complex Conditions: Hoist Into Booleans

When an `if` has 3+ operands or a sub-expression with non-obvious meaning, hoist into named locals. The names document the logic.

```go
// Bad — wall of operators, you read it twice
if user.Role == RoleAdmin || (resource.OwnerID == user.ID && !user.Locked) || (resource.IsPublic && user.IsVerified) {
    allow()
}

// Good — each line names a business rule
isAdmin := user.Role == RoleAdmin
isOwnerActive := resource.OwnerID == user.ID && !user.Locked
isPublicForVerified := resource.IsPublic && user.IsVerified
if isAdmin || isOwnerActive || isPublicForVerified {
    allow()
}
```

For short-circuit performance, keep cheap checks first.

## Init-Scoped `if`

If a variable is only needed for the check, scope it to the `if`:

```go
if err := validate(input); err != nil {
    return err
}
// err is not in scope here, which is what you want
```

## Labelled break and continue

When breaking out of an inner loop, a label removes ambiguity:

```go
outer:
for _, row := range rows {
    for _, cell := range row {
        if cell.Done() {
            break outer
        }
    }
}
```

Use sparingly — usually the right answer is to extract the inner loop into its own function.

## Anti-Patterns

- `if x { return a } else { return b }` — drop the `else`.
- `else if x == B` chain when all branches compare the same value — use `switch`.
- 5-operand single-line condition — hoist into named booleans.
- `goto` for normal control flow.
- `if err := f(); err != nil { handle(err); return err }` followed by another statement that uses `err` — `err` is out of scope.
