---
name: go-declarations
description: "Use when declaring or initializing Go variables, constants, structs, or maps. Covers var vs :=, grouped declaration blocks, iota enums starting at 1, struct/map/slice composite literals, raw string literals, `any` over `interface{}`, and avoiding shadowed builtins. Apply proactively to any new struct, const block, or top-level var, even if the user did not ask about declaration style. Does not cover identifier naming (see go-naming)."
license: MIT
compatibility: "Designed for Claude Code or similar AI coding agents. `any` requires Go 1.18+."
allowed-tools: Read Edit Write Glob Grep Bash(go:*) Bash(golangci-lint:*)
---

# Go Declarations and Initialization

Pick the simplest declaration form that expresses your intent: scope variables tightly, group related declarations, and let the zero value do its job.

## Core Rules

1. **`:=` for locals with values; `var` for intentional zero values or top-level declarations.**
2. **Group related declarations in parenthesized blocks.** Separate unrelated ones into distinct blocks.
3. **Start enums at `iota + 1`** so the zero value is "invalid/unset" — unless zero is genuinely meaningful.
4. **Initialize structs with field names.** Omit zero-value fields; let defaults speak.
5. **Use `any`, not `interface{}`,** in all new code.
6. **Never shadow builtins** (`len`, `cap`, `error`, `new`, `make`, `copy`, `any`, `nil`, ...).

## Decision: var vs :=

| Context | Use | Example |
|---|---|---|
| Package-level | `var` (always) | `var startTime = time.Now()` |
| Local with computed value | `:=` | `s := "foo"` |
| Local zero-value, intentional | `var` | `var filtered []int` |
| Declared type differs from RHS | `var T = expr` | `var e error = f()` |

> Read [references/scope-and-shadowing.md](references/scope-and-shadowing.md) when fighting subtle bugs caused by `:=` redeclaring an outer variable.

## Group Related Declarations

```go
// Bad
const a = 1
const b = 2

// Good
const (
    a = 1
    b = 2
)
```

Inside functions, group adjacent vars even if loosely related:

```go
var (
    caller  = c.name
    format  = "json"
    timeout = 5 * time.Second
)
```

## Constants and iota

Zero is the default; reserve it for "uninitialized" by starting enums at `iota + 1`:

```go
type Operation int

const (
    Add      Operation = iota + 1 // 1
    Subtract                      // 2
    Multiply                      // 3
)
```

Use plain `iota` only when the zero value is the sensible default (e.g., `LogToStdout = iota`).

> Read [references/iota-and-literals.md](references/iota-and-literals.md) for bitmask enums, `String()` methods, raw strings, and composite-literal formatting.

## Initializing Structs

- **Always use field names.** Positional struct literals break on field reordering and are caught by `go vet`.
- **Omit zero-value fields** — clarity beats explicit zeros.
- **`var u User`** for a zero-value struct (not `u := User{}`).
- **`&T{...}` over `new(T)`** when you want a pointer.

```go
u := User{Name: "Ada", Email: "ada@example.com"}
sptr := &Config{Timeout: 5 * time.Second}
var empty Buffer // zero value, ready to use
```

Test tables with ≤3 fields may use positional literals when the meaning is obvious.

## Initializing Maps

| Scenario | Use | Example |
|---|---|---|
| Empty, will be populated | `make(map[K]V)` | `m := make(map[string]int)` |
| Nil, lazily allocated | `var` | `var m map[string]int` |
| Known entries up front | Literal | `m := map[string]int{"a": 1}` |

`make` signals "initialized but empty" — different from a nil map (which panics on write). Provide a size hint when the count is known: `make(map[K]V, n)`.

## Raw String Literals

Use backticks to avoid escape gymnastics:

```go
// Bad
re := "^\\s*name:\\s*\"(.*)\""

// Good
re := `^\s*name:\s*"(.*)"`
```

Ideal for regex, SQL, JSON, and multi-line text.

## `any`, not `interface{}`

```go
// Old
func Print(v interface{}) { ... }

// New
func Print(v any) { ... }
```

`any` is an alias for `interface{}` since Go 1.18 — same type, less noise.

## Don't Shadow Builtins

The predeclared identifiers (`error`, `string`, `len`, `cap`, `append`, `copy`, `new`, `make`, `close`, `delete`, `panic`, `recover`, `any`, `true`, `false`, `nil`, `iota`) are not reserved words — Go lets you shadow them. Don't.

```go
// Bad — shadows the builtin error type
var error string

// Good
var errorMessage string
```

`go vet` catches the most common cases.

> Read [references/structs-and-tags.md](references/structs-and-tags.md) when designing struct fields that cross a serialization boundary (JSON, YAML, protobuf), embedding types, or formatting many-field literals.

## Anti-Patterns

| Anti-pattern | Why it hurts | Do this instead |
|---|---|---|
| `u := User{}` for a zero value | Misleads readers into expecting non-defaults | `var u User` |
| `new(T)` then assign fields | Two-step where one works | `&T{Field: v}` |
| Positional struct literals (>3 fields) | Silent breakage on field reordering | Use field names |
| `iota` starting at 0 for an enum | Zero value collides with a real case | `iota + 1` |
| `var m map[string]int` then `m[k] = v` | Panic on nil map write | `m := make(map[string]int)` |
| Hand-escaped JSON or regex strings | Hard to read, easy to mistype | Raw string literal |
| `interface{}` in new code | Verbose, outdated | `any` |

## Verification Checklist

- [ ] Top-level declarations use `var`/`const`; locals use `:=` unless zero-value is intended
- [ ] Related `const`/`var`/`type` are in grouped blocks
- [ ] Enums start at `iota + 1` (or the zero value is explicitly meaningful)
- [ ] Struct literals use field names; zero-value fields are omitted
- [ ] Maps that will be written to are constructed with `make`
- [ ] No builtins shadowed (`error`, `len`, `cap`, ...)
- [ ] `any` used instead of `interface{}`

## References

- [references/scope-and-shadowing.md](references/scope-and-shadowing.md) — variable scope, `:=` redeclaration rules, shadowing traps
- [references/iota-and-literals.md](references/iota-and-literals.md) — iota patterns, bitmasks, raw strings, composite literals
- [references/structs-and-tags.md](references/structs-and-tags.md) — struct initialization, field tags, embedding
