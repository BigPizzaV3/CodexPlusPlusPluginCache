---
name: go-code-style
description: "Use when writing or reviewing Go code for clarity, formatting, control flow, variable declarations, switch usage, and function design. Covers the priority order (clarity > simplicity > concision > maintainability > consistency), gofmt rules, early-return / no-else patterns, switch over if-else chains, slice/map initialization, and value-vs-pointer choices. Apply proactively to every Go change, even when the user has not asked about style."
license: MIT
compatibility: "Designed for Claude Code or similar AI coding agents. Works on any Go version supported by gofmt; range-over-int requires Go 1.22+."
allowed-tools: Read Edit Write Glob Grep Bash(go:*) Bash(golangci-lint:*)
---

# Go Code Style

`gofmt` handles the mechanical layout. This skill covers the decisions a formatter cannot make: where to break complexity, when to invert an `if`, when a `switch` beats an `else if` chain, and how to pick value vs pointer arguments. The rule of thumb is the Go Proverb: **clear is better than clever**.

## Core Rules

1. **Run `gofmt`/`goimports`.** No exceptions, no debates.
2. **Handle errors and edge cases first**, return early, keep the happy path at minimum indentation.
3. **Eliminate unnecessary `else`** when the `if` body ends in `return`/`break`/`continue`.
4. **Prefer `switch` over `if`/`else if` chains** that compare the same value.
5. **Initialize slices and maps explicitly**, never let a nil map reach a write.
6. **Pass small values; pass pointers when mutating or when the type is large (~128B+).**

## Style Priority Order

Apply in this order when two principles collide.

| Priority | Question | Beats |
|---|---|---|
| 1. Clarity | Can a reader understand intent without extra context? | everything else |
| 2. Simplicity | Is this the simplest expression of the idea? | concision, consistency |
| 3. Concision | Does every line earn its place? | consistency |
| 4. Maintainability | Will this be safe to modify? | consistency |
| 5. Consistency | Does it match nearby code? | — |

A "consistent" piece of bad code is still bad code. Clarity wins.

> Read [references/formatting-and-layout.md](references/formatting-and-layout.md) for line-breaking, multi-line signatures, file/declaration order.

## Control Flow

### Early return: keep the happy path flat

```go
func process(data []byte) (*Result, error) {
    if len(data) == 0 {
        return nil, errors.New("empty data")
    }
    parsed, err := parse(data)
    if err != nil {
        return nil, fmt.Errorf("parsing: %w", err)
    }
    return transform(parsed), nil
}
```

### No unnecessary `else`

When the `if` body unconditionally exits (`return`/`break`/`continue`), drop the `else`. For assignments, prefer default-then-override:

```go
// Good
lvl := slog.LevelInfo
if debug {
    lvl = slog.LevelDebug
}
```

### Switch over if/else chains

When all branches compare the same value, `switch` makes intent explicit and `exhaustive` can verify completeness:

```go
switch status {
case StatusActive:
    activate()
case StatusInactive:
    deactivate()
case StatusPaused:
    pause()
default:
    panic(fmt.Sprintf("unexpected status: %d", status))
}
```

A tagless `switch` replaces a chain of unrelated `if/else if` conditions — first matching case wins.

### Extract complex conditions

When an `if` has 3+ operands, hoist into named booleans so the names document the business rule:

```go
isAdmin := user.Role == RoleAdmin
isOwner := resource.OwnerID == user.ID
if isAdmin || isOwner || permissions.Has(PermOverride) {
    allow()
}
```

> Read [references/control-flow.md](references/control-flow.md) for tagless switch, guard clauses, and labelled break/continue.

## Variable Declarations

Use `:=` for non-zero initializers, `var` when the zero value is the start.

```go
var count int          // start at 0
name := "default"      // non-zero
var buf bytes.Buffer   // zero value is ready to use
```

### Initialize slices and maps explicitly

A nil map panics on write; a nil slice JSON-encodes to `null` (a UX surprise for API consumers).

```go
users := []User{}                       // explicit empty
m := map[string]int{}                   // explicit empty
users = make([]User, 0, len(ids))       // preallocate when size is known
m = make(map[string]int, len(items))    // preallocate map buckets
```

Do not speculatively preallocate large capacities — `make([]T, 0, 1000)` wastes memory when the common case is 10.

### Composite literals: name the fields

```go
srv := &http.Server{
    Addr:         ":8080",
    ReadTimeout:  5 * time.Second,
    WriteTimeout: 10 * time.Second,
}
```

Positional fields break the moment the type adds or reorders a field.

## Function Design and Argument Passing

- **Short and focused**, ≤ 4 parameters. Beyond that, use an options struct or functional options.
- **Parameter order:** `ctx context.Context` first, then inputs, then output destinations.
- **`range` over index loops** (`range n` since Go 1.22).
- **Pass small values, pointers for mutation / large structs (~128B+) / meaningful `nil`.** `*string`, `*int` parameters add indirection with no real saving. `sync.Mutex` and types embedding one are never copied — `go vet copylocks` catches it.

## Anti-Patterns

| Anti-pattern | Why it hurts | Do this instead |
|---|---|---|
| Deeply nested `if` chains | Happy path scrolls off-screen | Invert, return early |
| `if ok { return a } else { return b }` | `else` is dead weight | Drop the `else` |
| `if x == A else if x == B else if x == C` | Reader has to verify all comparisons share `x` | `switch x { ... }` |
| Positional struct literal | Breaks silently on field reorder | Named fields |
| Nil map write | Runtime panic | `make(...)` or `map literal` |
| `*string`, `*int` parameter to "save copy" | Adds indirection, no real saving | Pass value |
| Long parameter lists | Hard to call, hard to extend | Options struct or `WithXxx` opts |

## Verification Checklist

- [ ] `gofmt -l .` produces no output and `goimports -l .` is clean.
- [ ] No function body indented past three tab stops without justification.
- [ ] No `if ... return; else ...` in modified code.
- [ ] All maps and slices declared without literal use `make` with a sensible capacity.
- [ ] Composite literals use named fields for non-trivial struct types.
- [ ] `ctx context.Context` is the first parameter on every function that takes one.
- [ ] `golangci-lint run` passes with `gocritic`, `revive`, and `gocyclo` enabled.

## Enforce With Linters

These rules are largely mechanical and a linter will catch them in CI:

- `gofmt`, `gofumpt`, `goimports` — formatting.
- `gocritic`, `revive` — style heuristics, including `if-return`, `early-return`.
- `gocyclo`, `funlen` — function complexity / length.
- `wsl_v5` — whitespace lines for separation between blocks.

Add to `.golangci.yml` and run `golangci-lint run` in CI.

## References

- [references/formatting-and-layout.md](references/formatting-and-layout.md) — gofmt, line breaks, multi-line signatures, file order
- [references/control-flow.md](references/control-flow.md) — early returns, switch patterns, labelled loops
- [references/function-and-data-init.md](references/function-and-data-init.md) — declarations, composite literals, value-vs-pointer
