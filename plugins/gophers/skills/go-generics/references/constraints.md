# Type Constraints

A constraint is just an interface — but constraints can use `~T` (underlying type) and `|` (union) operators that ordinary interfaces cannot.

## The Standard Catalogue

| Constraint | Source | When |
|---|---|---|
| `any` | builtin | No constraint at all |
| `comparable` | builtin | `==` and `!=` work — map keys, set elements |
| `cmp.Ordered` | `cmp` (Go 1.21+) | `<`, `<=`, `>`, `>=` work — ordered numeric & string types |
| `constraints.Integer` | `golang.org/x/exp/constraints` | Any integer type |
| `constraints.Float` | same | Any float type |
| `constraints.Signed` / `Unsigned` | same | Signed / unsigned ints |
| `constraints.Complex` | same | `complex64`, `complex128` |

Reach for the standard constraints first. A custom union is technical debt waiting to be deduplicated.

## The `~` Operator

`~T` means "any type whose underlying type is `T`":

```go
type Celsius float64

type Floats interface {
    ~float32 | ~float64
}

func Average[T Floats](xs []T) T { ... }

Average([]Celsius{1, 2, 3}) // works because ~float64
```

Without the `~`, `Celsius` would not satisfy `float64`.

## Unions

```go
type Numeric interface {
    ~int | ~int8 | ~int16 | ~int32 | ~int64 |
    ~uint | ~uint8 | ~uint16 | ~uint32 | ~uint64 |
    ~float32 | ~float64
}
```

A union constraint forbids defining methods on the union — it is constraint-only.

## Method Sets in Constraints

```go
type Stringer interface {
    String() string
}

func Format[T Stringer](xs []T) []string {
    out := make([]string, len(xs))
    for i, x := range xs {
        out[i] = x.String()
    }
    return out
}
```

A constraint may mix unions and method sets:

```go
type SignedStringer interface {
    ~int | ~int64
    String() string
}
```

(Rarely useful in practice.)

## Type Inference

Go can usually infer type parameters from the arguments:

```go
func First[T any](xs []T) T { return xs[0] }
First([]int{1, 2, 3}) // T inferred as int
```

Inference fails when:

- The type parameter appears only in the return type: `func New[T any]() T`. Callers must specify: `New[Widget]()`.
- Two arguments have different element types where the same `T` is expected.

When inference fails, the compiler tells you exactly what is ambiguous.

## Anti-Patterns

- **Re-defining `cmp.Ordered`** — just import it.
- **`interface{ ~int | int }`** — `int` is redundant when `~int` is present.
- **`comparable` for things you never compare** — drops to `any`.
- **Method-set constraint when the method does nothing in the function** — the type parameter is decorative.
