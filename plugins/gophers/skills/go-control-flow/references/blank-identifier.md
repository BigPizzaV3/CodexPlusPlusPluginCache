# The Blank Identifier

`_` is a write-only placeholder. Use it deliberately — silent discards of errors are bugs in disguise.

## Multi-Return Discards

```go
// Don't care about the index
for _, v := range slice {
    process(v)
}

// Don't care about the count, only the error
if _, err := io.Copy(dst, src); err != nil {
    return err
}
```

Never discard an error this way unless you have written down (in a comment) why it cannot matter.

## Side-Effect Imports

```go
import _ "net/http/pprof" // registers handlers on init
import _ "github.com/lib/pq" // registers the SQL driver
```

These imports run `init()` for the side effect of registration. Acceptable in `main` packages and tests; rarely elsewhere.

## Compile-Time Interface Compliance

```go
var _ http.Handler = (*Handler)(nil)
```

Asserts that `*Handler` implements `http.Handler`. The declaration produces no runtime code; if the assertion fails, the build fails — a fast, free contract check.

Place these near the type definition or near where the method set is finalized.

## Type Assertion Discards

```go
if v, ok := i.(*MyType); ok {
    use(v)
}
// Discarding ok forces a panic on mismatch — usually wrong
v := i.(*MyType) // panics if i is not *MyType
```

Prefer the comma-ok form unless an invalid type is a programmer error you actually want to crash on.

## When Not to Use `_`

- To silence `errcheck` complaints. Fix the error handling instead.
- To "use" a variable so the compiler stops complaining about it being unused. Delete the dead variable instead.
- For map writes that ignore the prior value — just assign; there is no two-value map write.
