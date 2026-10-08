# Types, Interfaces, Constants, Enums, and Errors

## Interface Names

Single-method interfaces are named after the method plus `-er`. The pattern is canonical: `Reader`, `Writer`, `Closer`, `Stringer`, `Formatter`, `Marshaler`.

```go
type Reader interface { Read(p []byte) (n int, err error) }
type Closer interface { Close() error }
```

When implementing well-known methods, **match the canonical signature exactly** — `String() string`, `Error() string`, `MarshalJSON() ([]byte, error)`. Returning a different signature breaks interface satisfaction silently.

Multi-method interfaces describe behaviour (`http.Handler`, `sort.Interface`). Keep them small — Rob Pike: "the bigger the interface, the weaker the abstraction".

## Struct Names

MixedCaps nouns. The name should make sense at the call site with the package name prefix.

```go
// package http
type Request struct{}  // http.Request
type Response struct{} // http.Response
type Server struct{}   // http.Server
```

If your type name reads naturally only with the package name removed, you may be stuttering: `dbpool.Pool` is fine; `dbpool.DBPool` is not.

## Constants

MixedCaps, named by **role**, not value.

```go
const MaxRetries = 3              // role
const Port8080 = 8080             // value — bad
const defaultReadTimeout = 5 * time.Second
```

Group related constants with `const (...)` and explanatory comments.

## Enums with `iota`

Always put a sentinel `Unknown`/`Invalid`/`Unspecified` value at position 0. The zero value of any type is what you get from `var x T` — if `0` is a real state, uninitialised values look intentional.

```go
type Status int

const (
    StatusUnknown Status = iota // 0 — catches uninitialised
    StatusPending
    StatusReady
    StatusFailed
)
```

Prefix all values with the type name (`StatusReady`, not `Ready`) so the enum is greppable and call sites are unambiguous.

Optionally implement `String() string` so `fmt.Println(s)` prints `"Ready"` instead of `2`:

```go
//go:generate stringer -type=Status
```

## Errors: Sentinel vs Typed

There are two distinct families, and the naming is the public signal of which you've chosen.

### Sentinel errors → `ErrXxx`

A package-level variable callers can compare with `errors.Is`. Use when the only thing the caller needs is the identity.

```go
package store

var (
    ErrNotFound = errors.New("store: not found")
    ErrConflict = errors.New("store: conflict")
)
```

Always prefix the error string with the package name; it survives wrapping.

### Typed errors → `XxxError`

A struct callers can unwrap via `errors.As` to read structured fields.

```go
type ValidationError struct {
    Field string
    Rule  string
}

func (e *ValidationError) Error() string {
    return fmt.Sprintf("validation: %s violates %s", e.Field, e.Rule)
}
```

Receivers are on `*XxxError` (pointer) so that the zero value of the interface is `nil` and the typed-nil trap is avoided.

### Error Strings

- Fully lowercase, **including acronyms** (`"invalid message id"`).
- No trailing punctuation (`"..."`, not `"...."`).
- Include the package name on sentinels (`"store: not found"`).
- Read as a fragment that composes: `"reading config: file not found"`.

## Boolean Naming

Booleans read as predicates. Prefix with `is`/`has`/`can` so the field or method reads as a question.

```go
type User struct {
    isVerified bool
    hasAdmin   bool
}

func (u *User) IsVerified() bool { return u.isVerified }
func (u *User) CanLogin() bool   { return u.isVerified && !u.locked }
```

Bare adjectives are ambiguous: is `verified` a method name or a past tense? The prefix removes the question.

## Anti-Patterns

- `Ready` at iota 0 (zero value is a real state).
- Bare `Reader` for a multi-method interface — name by behaviour.
- `Error` suffix on sentinels (`NotFoundError = errors.New(...)`) — sentinels are `ErrXxx`.
- `ErrXxx` for typed errors (loses the struct).
- Concrete error pointer return (`func() *MyError`) — typed-nil trap.
- Error strings starting with capital letters or trailing in periods.
- Enum values without a type prefix (`Ready` instead of `StatusReady`) — globally ambiguous.
