---
name: go-generics
description: "Use when deciding whether to introduce Go generics, writing generic functions or types, composing type constraints, or choosing between type aliases and type definitions. Apply proactively when a user is writing a utility function that could conceivably work with multiple types, even if they didn't mention generics. Does not cover interface-only designs (see go-interfaces)."
license: MIT
compatibility: "Designed for Claude Code or similar AI coding agents. Generics require Go 1.18+; `cmp.Ordered` requires Go 1.21+."
allowed-tools: Read Edit Write Glob Grep Bash(go:*) Bash(golangci-lint:*)
---

# Go Generics

Generics are a powerful but easy-to-misuse feature. The Go answer is pragmatic: write concrete code first, then generalize only when you have a real second caller.

## Core Rules

1. **Write concrete first.** Reach for generics only when a second type actually needs the same logic.
2. **If an interface already models the behavior, use the interface.** Don't pile type parameters on top.
3. **Prefer standard constraints** (`comparable`, `cmp.Ordered`, `any`) over hand-rolled unions.
4. **Don't over-constrain.** `comparable` is usually enough; the narrower the constraint, the fewer callers benefit.
5. **Name type parameters with a single uppercase letter** (`T`, `K`, `V`, `E`) unless a longer name genuinely helps.
6. **Don't use generics for interface satisfaction.** `func F[T io.Reader](r T)` is just `func F(r io.Reader)`.
7. **Don't wrap stdlib containers** "for generic convenience" unless you eliminate real duplication.

## Decision Flow

```
Multiple types need the same logic?
├─ No  → concrete type
├─ Yes → do they share a useful interface?
│        ├─ Yes → use the interface
│        └─ No  → use generics
```

## When NOT to Use Generics

```go
// Premature: only ever called with int
func Sum[T constraints.Integer | constraints.Float](xs []T) T {
    var t T
    for _, x := range xs { t += x }
    return t
}

// Better
func SumInts(xs []int) int {
    var t int
    for _, x := range xs { t += x }
    return t
}
```

> "Write code, don't design types." — Griesemer & Taylor

## When Generics Pay Off

- A library function the standard library would have written generically: `slices.Index`, `maps.Keys`, `slices.SortFunc`.
- Concurrent-safe data structures (typed sets, ordered maps) where boxing into `any` would be both ugly and slow.
- Map/Reduce-style helpers that genuinely apply to many element types.

## Type Parameter Naming

| Name | Typical use |
|---|---|
| `T` | General element / first type |
| `K` | Map key |
| `V` | Map value |
| `E` | Element of a collection |
| `R` | Result of a transform |

Multi-letter names are reserved for constraints where the meaning is non-obvious:

```go
func Marshal[Opts encoding.MarshalOptions](v any, opts Opts) ([]byte, error)
```

## Constraint Composition

```go
type Numeric interface {
    ~int | ~int8 | ~int16 | ~int32 | ~int64 |
    ~float32 | ~float64
}

func Sum[T Numeric](xs []T) T {
    var t T
    for _, x := range xs { t += x }
    return t
}
```

- `~int` means "anything whose underlying type is `int`" — covers `type Celsius int`.
- `|` unions widen the set.
- Prefer `cmp.Ordered` (Go 1.21+) over rolling your own.

> Read [references/constraints.md](references/constraints.md) for the constraint catalogue, when `~` matters, and how type inference interacts with constraints.

## Common Pitfalls

### Don't Wrap Stdlib Types Generically

```go
// Adds complexity, eliminates no duplication
type Set[T comparable] struct {
    m map[T]struct{}
}

// Use the builtin
seen := map[string]struct{}{}
seen["a"] = struct{}{}
```

A generic wrapper around `map[T]struct{}` is only worth it if you keep it for many call sites *and* provide methods that pay for the indirection (e.g., `Union`, `Intersect`).

### Don't Use Generics for Interface Satisfaction

```go
// Pointless type parameter
func Process[T io.Reader](r T) error { ... }

// Just use the interface
func Process(r io.Reader) error { ... }
```

### Don't Over-Constrain

```go
// Restrictive without reason
func Contains[T interface{ ~int | ~string }](xs []T, t T) bool { ... }

// comparable is enough
func Contains[T comparable](xs []T, t T) bool { ... }
```

> Read [references/generics-vs-interfaces.md](references/generics-vs-interfaces.md) when interfaces and generics both seem to fit, and you have to choose.

## Type Aliases vs Definitions

```go
type Old = pkg.New  // alias: same type, alternate name
type Old pkg.New    // definition: new type, fresh method set
```

Type aliases (`=`) are for **package migrations** and gradual API moves. For new types, use a definition.

## Anti-Patterns

| Anti-pattern | Why it hurts | Do this instead |
|---|---|---|
| Generic for a single instantiation | Indirection without payoff | Concrete code |
| Generic where an interface fits | Type parameter is just `io.Reader` in disguise | Accept the interface |
| `interface{ ~int }` when `comparable` suffices | Restricts callers, no benefit | Loosen the constraint |
| Custom `Numeric` constraint | `cmp.Ordered` exists | Standard constraint |
| `Set[T]` wrapper around `map[T]struct{}` | Two-line struct, no methods | Use the map directly |
| Generic function with two type params, neither used | The compiler can infer nothing | Drop one or both |

## Verification Checklist

- [ ] At least two real, current call sites benefit from the type parameter
- [ ] An interface would not be a simpler model
- [ ] Constraint is the loosest one that compiles (`any`, `comparable`, `cmp.Ordered` preferred)
- [ ] Type parameter names are conventional letters unless clarity demands more
- [ ] No `T` exists only to satisfy an interface — accept the interface instead
- [ ] No generic wrapper added without methods that justify it
- [ ] Doc comment explains what the type parameter must support

## References

- [references/constraints.md](references/constraints.md) — constraint catalogue, `~` and `|`, `cmp.Ordered`, type inference
- [references/generics-vs-interfaces.md](references/generics-vs-interfaces.md) — picking between a generic and an interface
