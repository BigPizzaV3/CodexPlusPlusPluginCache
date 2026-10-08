# The Typed-Nil Trap

Returning a concrete error pointer instead of the `error` interface creates a non-nil interface that callers cannot detect with `err != nil`.

## The Bug

```go
type MyError struct{ msg string }
func (e *MyError) Error() string { return e.msg }

func doThing() *MyError {
    var e *MyError // nil
    return e       // returns a typed-nil
}

func main() {
    if err := doThing(); err != nil {
        fmt.Println("got error:", err) // prints — but there was no error!
    }
}
```

`doThing()` returns `(*MyError)(nil)`. When assigned to an `error` interface variable, the interface carries `(type=*MyError, value=nil)`. The interface itself is **not** nil, because its type word is set.

## The Fix

**Always declare the return type as `error`, not the concrete type.**

```go
// Bad
func doThing() *MyError { ... }

// Good
func doThing() error { ... }
```

With `error` as the return type, returning the zero value gives a truly nil interface:

```go
func doThing() error {
    return nil // (type=nil, value=nil) — interface is nil
}
```

## When You Genuinely Have a `*MyError`

If you must build a concrete pointer and conditionally return it:

```go
// Bad
func validate(s string) error {
    var e *ValidationError
    if s == "" {
        e = &ValidationError{Field: "name"}
    }
    return e // typed-nil when s != ""
}

// Good
func validate(s string) error {
    if s == "" {
        return &ValidationError{Field: "name"}
    }
    return nil // untyped nil
}
```

## Detection

`go vet` catches some cases. The `nilness` analyzer from `golang.org/x/tools` catches more. In review, treat any function returning a concrete error type as suspicious.

## Why It Exists

Go's interface representation is `(type, value)`. `nil == nil` requires *both* slots to be zero. A concrete typed pointer fills the type slot, so the interface is never nil even when the value is.

This is consistent with how Go treats all interfaces — `error` is not special. The fix is to never let a concrete error type escape the function signature.
