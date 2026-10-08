---
name: go-control-flow
description: "Use when writing conditionals, loops, switches, type switches, or blank-identifier patterns in Go. Covers if-with-initialization, guard clauses, early returns, the unified for loop, range over slices/maps/strings/channels, parallel assignment, labeled break, and `_` for discards and side-effect imports. Apply proactively to any new if/for/switch, even when the user does not mention scoping or shadowing. Does not cover error-flow specifics (see go-error-handling)."
license: MIT
compatibility: "Designed for Claude Code or similar AI coding agents. Plain Go (any supported version)."
allowed-tools: Read Edit Write Glob Grep Bash(go:*) Bash(golangci-lint:*)
---

# Go Control Flow

Go gives you `if`, `for`, and `switch` — and one looping construct that covers them all. The idioms are small but strict: scope variables tightly, return early, keep the happy path unindented.

## Core Rules

1. **Scope variables with if-init when they live only for the check.** `if x, err := f(); err != nil { ... }`.
2. **Guard clauses over nested `else`.** When the `if` body returns/breaks/continues, drop the `else`.
3. **`:=` redeclares only in the same scope.** In an inner scope it shadows — a frequent bug source.
4. **One `for`, three forms.** Condition-only (while), three-clause (C-style), and infinite (`for {}`).
5. **`range` over string yields runes**, over map yields **non-deterministic order**, over channel **drains until closed**.
6. **`break` inside `switch` only breaks the switch.** Use a labeled `break` to exit the enclosing `for`.
7. **The blank identifier `_` discards, but never errors.** Silent error dropping is a bug.

## Decision: var vs := vs = at a glance

| Situation | Use |
|---|---|
| New variable, scoped to the check | `if v, err := f(); err != nil` |
| Reusing an outer variable | plain `=` (avoid `:=` to prevent shadowing) |
| At least one new + reuse of outer | `:=` is fine (same scope only) |
| Wanted zero value | `var x T` |

## If with Initialization

```go
if err := file.Chmod(0664); err != nil {
    return err
}
```

If `err` is needed past the `if`, declare it separately:

```go
x, err := f()
if err != nil {
    return err
}
// use x freely
```

## Guard Clauses

```go
f, err := os.Open(name)
if err != nil {
    return err
}
d, err := f.Stat()
if err != nil {
    f.Close()
    return err
}
codeUsing(f, d)
```

Never bury the success path inside `else`.

## The Shadowing Trap

```go
// Bug: inner ctx never escapes the if block
if *shortenDeadlines {
    ctx, cancel := context.WithTimeout(ctx, 3*time.Second)
    defer cancel()
}

// Fix: assign with =, declaring cancel separately
var cancel func()
ctx, cancel = context.WithTimeout(ctx, 3*time.Second)
defer cancel()
```

> Read [references/blank-identifier.md](references/blank-identifier.md) for `_` use cases (interface checks, side-effect imports, multi-return discards).

## For Loops

```go
// Condition-only (Go's "while")
for x > 0 { x = process(x) }

// Infinite
for {
    if done() { break }
}

// Three-clause
for i := 0; i < n; i++ { ... }
```

### Range

```go
for i, v := range slice { ... }   // index + value
for k, v := range myMap  { ... }  // non-deterministic order
for i, r := range "héllo" { ... } // i is byte offset; r is rune
for v := range ch { ... }         // drains until closed
```

### Parallel Assignment

Go has no comma operator. Use parallel assignment instead:

```go
for i, j := 0, len(a)-1; i < j; i, j = i+1, j-1 {
    a[i], a[j] = a[j], a[i]
}
```

`++` and `--` are statements, not expressions — they cannot appear inside a parallel assignment.

## Switch and Labeled Break

```go
Loop:
    for _, v := range items {
        switch v.Type {
        case "done":
            break Loop // breaks the for, not just the switch
        }
    }
```

> Read [references/switch-patterns.md](references/switch-patterns.md) for expression-less switches, comma cases, fallthrough, and type switches.

## Anti-Patterns

| Anti-pattern | Why it hurts | Do this instead |
|---|---|---|
| `} else { return ... }` after a returning `if` | Pointless nesting | Drop `else`; let the happy path stay flat |
| `if _, err := f(); err == nil { ... }` then use the value | Value is out of scope | Move the `:=` outside the `if` |
| `:=` in inner scope reassigning outer var | Silently shadows | Use `=` (declare the new locals separately) |
| Iterating a map and relying on order | Order is randomized | Sort keys explicitly |
| `break` inside `switch` expecting to exit `for` | Only exits switch | Use labeled `break Label` |
| `_ = doSomething()` to silence an error | Real failures vanish | Handle it or document why |

## Verification Checklist

- [ ] No `else` branch after an `if` that returns/breaks/continues
- [ ] `:=` in inner scopes does not shadow important outer variables
- [ ] Loops use the simplest of the three forms that fits
- [ ] `range` over strings treats the index as a byte offset, not a rune index
- [ ] Map iteration does not assume an order
- [ ] Errors are never silently discarded with `_`
- [ ] Labeled `break` is used when a switch needs to exit a surrounding loop

## References

- [references/switch-patterns.md](references/switch-patterns.md) — expression-less, comma cases, fallthrough, type switches
- [references/blank-identifier.md](references/blank-identifier.md) — `_` for multi-return, interface compliance, side-effect imports
