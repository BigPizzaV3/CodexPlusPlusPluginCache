# Must Helpers, Panic, and Recover

## When `Must*` Is Appropriate

`MustFoo(...)` panics if `Foo(...)` would return an error. Acceptable only when:

1. Called at **program start / package init**, not at runtime per-request.
2. Failure means the program **cannot start** — there is no graceful continuation.
3. The error condition is **deterministic** (a typo in a hard-coded regex, a missing baked-in template).

```go
var (
    idPattern = regexp.MustCompile(`^[a-z][a-z0-9-]{0,62}$`)
    homeTmpl  = template.Must(template.ParseFiles("home.html"))
)
```

## Writing Your Own

```go
func Must[T any](v T, err error) T {
    if err != nil {
        panic(err)
    }
    return v
}
```

Useful for chaining setup that would otherwise be a ladder of `if err != nil`. Keep it out of business logic.

## panic vs log.Fatal

| Tool | When |
|---|---|
| `panic` | An invariant was broken — a programmer error |
| `log.Fatal` | A startup precondition failed (e.g., missing config) |
| `return err` | Anything the caller might recover from |

`log.Fatal` skips `defer`s. If you have cleanup that must run, prefer returning to `main` and letting `main` print the error and exit.

## Recover at Boundaries

Recovering across a goroutine boundary keeps a misbehaving request from killing the whole server:

```go
func safeHandle(w http.ResponseWriter, r *http.Request) {
    defer func() {
        if v := recover(); v != nil {
            log.Printf("panic: %v\n%s", v, debug.Stack())
            http.Error(w, "internal error", http.StatusInternalServerError)
        }
    }()
    handle(w, r)
}
```

Two rules:

- **Always log the stack** (`runtime/debug.Stack()`). A bare `recover()` swallows the cause.
- **Recover only at the goroutine boundary.** Mid-function `recover` for control flow is an anti-pattern.

## Panics That Should Not Be Recovered

- `runtime.Error` from a nil map write or out-of-bounds read — those are real bugs and you want the test to fail loudly.
- Panics from `sync.Mutex.Unlock` of an unlocked mutex — same.

It is perfectly fine to recover, log, and re-panic if you only wanted to attach a stack trace.

## Library Authors

A library should **never** panic across its API. If your code can panic, document it clearly and provide a non-panicking alternative:

```go
// Compile compiles the pattern. Compile returns an error on invalid syntax.
func Compile(s string) (*Pattern, error) { ... }

// MustCompile is like Compile but panics on error. Use only at init.
func MustCompile(s string) *Pattern { ... }
```
