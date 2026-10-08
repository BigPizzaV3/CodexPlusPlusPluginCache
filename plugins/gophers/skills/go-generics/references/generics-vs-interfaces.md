# Generics vs Interfaces

Both let one function work on many types. The right answer depends on whether you need the *concrete* type, or just the *behavior*.

## Use an Interface When

- You only need to call methods on the value.
- Callers may extend behavior with new types you never anticipated.
- The set of allowed types is open-ended.

```go
type Reader interface {
    Read(p []byte) (int, error)
}

func Copy(dst io.Writer, src io.Reader) (int64, error) { ... }
```

## Use Generics When

- You need to return or work with the same concrete type the caller passed.
- You need value-type performance (no boxing into an interface).
- The function's behavior depends on the concrete type's operators (`==`, `<`, `+`).

```go
func Max[T cmp.Ordered](xs []T) T {
    m := xs[0]
    for _, x := range xs[1:] {
        if x > m {
            m = x
        }
    }
    return m
}
```

`<` does not exist on any interface — it's a constraint operation.

## The Shape of the Output

The clearest signal: look at the return type.

- Returning `T` (same as input) → generics.
- Returning some concrete type independent of input → interface accepting the input is fine.

```go
// Generic — preserves caller's type
func Filter[T any](xs []T, ok func(T) bool) []T

// Interface — returns a fixed type
func Sum(xs []float64) float64
```

## Mixing

You can take a generic input and a method set together:

```go
type Lengthwise interface {
    Len() int
}

func Largest[T Lengthwise](xs []T) T {
    m := xs[0]
    for _, x := range xs[1:] {
        if x.Len() > m.Len() {
            m = x
        }
    }
    return m
}
```

But ask first: would `func Largest(xs []Lengthwise) Lengthwise` be enough? Often yes.

## Performance Notes

- Generic instantiations are monomorphized per *gcshape* (a partition of types sharing layout). Each shape costs binary size; common-shape calls share code.
- Interface calls go through a dispatch table — fine for most code, costly in tight inner loops.
- Don't pick generics on a vague performance hunch. Benchmark.

## Practical Rules of Thumb

- API surface: interface.
- Container of `T`: generic.
- Algorithm that compares or arithmetic-operates: generic.
- Anything that calls one or two methods and returns a fixed type: interface.
