# Switch Patterns

Go's `switch` is more flexible than C's: there is no implicit fallthrough, cases can be comma-separated lists, and the expression is optional.

## Expression-less Switch

A switch without an expression is `switch true` — clearer than a chain of `if`/`else if`:

```go
switch {
case n < 0:
    return "negative"
case n == 0:
    return "zero"
case n < 10:
    return "small"
default:
    return "large"
}
```

## Comma Cases

List multiple matching values in a single case:

```go
switch r {
case 'a', 'e', 'i', 'o', 'u':
    return true
}
```

## No Implicit Fallthrough

Each case ends after its block. If you actually want to fall through (rare), use `fallthrough` explicitly:

```go
switch x {
case 1:
    do1()
    fallthrough
case 2:
    do2()
}
```

Prefer comma cases or a helper function. Most uses of `fallthrough` are bugs.

## Type Switch

```go
switch v := i.(type) {
case nil:
    return "nil"
case int:
    return fmt.Sprintf("int %d", v)
case fmt.Stringer:
    return v.String()
default:
    return fmt.Sprintf("unknown %T", v)
}
```

- `v` is bound per-case to the concrete type.
- A `default` case binds `v` to the original interface type.
- Order matters when interfaces overlap — put the most specific case first.

## Labeled Break vs Continue

`break` and `continue` inside a `switch` inside a `for` need labels to escape the outer loop:

```go
Outer:
    for _, row := range rows {
        switch row.Kind {
        case Stop:
            break Outer
        case Skip:
            continue Outer
        }
    }
```

## When to Use What

| Pattern | When |
|---|---|
| `switch x { case ... }` | Single value, multiple discrete options |
| `switch { case cond: }` | Conditional ladder; cleaner than else-if chains |
| `switch v := x.(type)` | Branching on the dynamic type of an interface |
| Comma cases | Several values share one behavior |
| `fallthrough` | Almost never — prefer comma cases or helpers |
