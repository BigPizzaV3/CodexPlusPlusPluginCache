---
name: go-interfaces
description: "Use when defining or implementing Go interfaces, composing types through embedding, designing dependency-injection seams, or deciding between pointer and value receivers. Apply proactively whenever a new abstraction is introduced or a constructor returns an abstract type, even if the user has not asked about interfaces. Does not cover generics (see go-generics)."
license: MIT
compatibility: "Designed for Claude Code or similar AI coding agents. Targets Go 1.21+. Generics guidance is delegated to go-generics."
allowed-tools: Read Edit Write Glob Grep Bash(go:*) Bash(golangci-lint:*)
---

# Go Interfaces and Composition

Interfaces in Go are *consumer contracts*, not implementation hierarchies. They should be **small**, **discovered late**, and **owned by the package that uses them** — not the package that satisfies them.

## Core Rules

1. **Accept interfaces, return concrete types.** Consumers state what they need; producers expose what they have.
2. **Interfaces belong in the consumer package.** Defining an interface next to its sole implementation is almost always wrong.
3. **Don't design with interfaces — discover them.** Wait for a second implementation or a test mock to demand one.
4. **The bigger the interface, the weaker the abstraction.** Aim for 1–3 methods; compose larger contracts from smaller ones.
5. **Receiver consistency:** if any method needs a pointer receiver, give *every* method a pointer receiver.
6. **Verify satisfaction at compile time** with `var _ I = (*T)(nil)` when the relationship must not break silently.
7. **Use the comma-ok idiom for every type assertion.** A bare assertion panics on mismatch.

## Decision: Should I Introduce an Interface?

| Situation | Verdict |
|---|---|
| Single implementation, no tests need to swap it | No interface. Use the concrete type. |
| Second implementation appears (or is imminent) | Extract an interface in the consumer package. |
| Test needs to fake an external dependency | Define a small interface in the consumer; pass a fake. |
| You want to expose optional behaviour (`Flusher`, `ReaderFrom`) | Define a tiny interface; check with `_, ok := v.(Iface)`. |
| You want a stable plugin/SPI boundary | Yes, but keep it minimal and version it explicitly. |

> Read [references/consumer-owned-interfaces.md](references/consumer-owned-interfaces.md) when migrating a producer-defined interface back to the consumer, or when designing a new package boundary.

## Accept Interfaces, Return Concrete Types

```go
// Good — consumer defines what it needs
package notify
type Sender interface { Send(to, body string) error }
type Service struct{ s Sender }
func NewService(s Sender) *Service { return &Service{s: s} }

// Good — producer returns a concrete type
package email
type Client struct{ /* ... */ }
func New(cfg Config) *Client { /* ... */ }
func (c *Client) Send(to, body string) error { /* ... */ }
```

```go
// Bad — producer defines and returns its own interface,
// forcing every consumer to depend on email.Sender.
func New(cfg Config) Sender { return &client{...} }
```

The exception is "expose an interface, hide the implementation": when a type has no exported methods beyond what the interface promises, returning the interface (`func NewHash() hash.Hash32`) is fine.

## Keep Interfaces Small

Standard library interfaces are the model: `io.Reader`, `io.Writer`, `io.Closer`, `fmt.Stringer`, `error` — one or two methods each. Compose larger contracts:

```go
type ReadWriteCloser interface { io.Reader; io.Writer; io.Closer }
```

If you find yourself writing a five-method interface, split it until each piece has a single reason to exist.

## Compile-Time Satisfaction Check

```go
var _ io.ReadWriter = (*MyBuffer)(nil)
```

Use when the type must satisfy an interface for correctness (custom JSON marshalling, `http.Handler`) and no other static use already enforces it. Don't add one for every interface.

## Type Assertions and Type Switches

Always use the comma-ok form. Type switches re-declare the variable; cases with multiple types fall back to the interface type. Use optional-behaviour assertions to *enhance* a path without requiring the capability:

```go
s, ok := v.(string)                              // comma-ok
switch x := v.(type) { case string: /* ... */ }  // type switch
if f, ok := w.(http.Flusher); ok { f.Flush() }   // optional behaviour
```

## Embedding: Composition, Not Inheritance

Struct embedding promotes the inner type's methods and fields to the outer type. Use it deliberately — every promoted method becomes part of your public API.

```go
type Server struct {
    *slog.Logger          // exposes Info/Warn/Error on Server
    addr string
}
```

| Use embedding when | Use a named field when |
|---|---|
| You want the outer type to *be* an enhanced version of the inner | You only need the inner type internally |
| The full inner API should be promoted | You want to delegate explicitly to a subset |

Avoid embedding in exported types unless the promotion is the whole point. The inner type's method set is locked in once published.

> Read [references/embedding-and-receivers.md](references/embedding-and-receivers.md) when designing struct embedding, overriding promoted methods, resolving name conflicts, or choosing between pointer and value receivers.

## Dependency Injection via Interfaces

Constructors take interfaces; tests pass fakes. No DI container required.

```go
type UserStore interface {
    FindByID(ctx context.Context, id string) (*User, error)
}

type UserService struct{ store UserStore }
func NewUserService(s UserStore) *UserService { return &UserService{store: s} }
```

The `UserStore` interface lives in the package that defines `UserService`. The concrete `*pgUserStore` lives in a database package and doesn't know `UserService` exists.

## Preventing Accidental Copies

Structs that must not be copied (those holding a mutex, internal pointers, or a `sync.WaitGroup`) should embed a `noCopy` sentinel so `go vet` catches the mistake:

```go
type noCopy struct{}
func (*noCopy) Lock()   {}
func (*noCopy) Unlock() {}

type ConnPool struct {
    _   noCopy
    mu  sync.Mutex
    /* ... */
}
```

Pass these by pointer (`func process(p *ConnPool)`), never by value.

**Don't reach for `noCopy` reflexively.** Plain value types (config structs, request DTOs, immutable snapshots) *should* be copyable — adding `noCopy` to them locks consumers into pointer-only APIs for no gain. The rule of thumb: if the struct owns a `sync.Mutex`, `sync.WaitGroup`, `sync.Pool`, internal `chan`, or a pointer that *must* stay unique (file handle, OS resource), embed `noCopy`. Otherwise leave it copyable.

## Anti-Patterns

| Anti-pattern | Why it hurts | Do this instead |
|---|---|---|
| Producer-defined interface returned from constructor | Couples every consumer to the producer's package | Return the concrete type; let consumers define interfaces |
| Five-plus method interface | Hard to implement, hard to mock | Split into small interfaces; compose |
| Premature interface with one implementation | Indirection without value | Start concrete; extract when a second consumer appears |
| `v := x.(T)` without `ok` | Panics on mismatch | `v, ok := x.(T)` |
| Embedding a concrete type into an exported struct | Inner API leaks into your public surface | Use a named, unexported field |
| Mixing pointer and value receivers on one type | `(*T)` and `T` have different method sets — confusing satisfaction errors | Pick one receiver style for the whole type |
| `ToString()` / `ReadData()` instead of canonical names | Breaks `fmt.Stringer` / `io.Reader` discovery | Honour `String()` / `Read(p []byte) (int, error)` |
| Returning `*MyErr` instead of `error` | Typed-nil trap; `err != nil` is true even when "no error" | Return the interface type |

## Verification Checklist

Before finishing an interface change:

- [ ] Interfaces are defined in the package that consumes them
- [ ] Constructors return concrete types (or hide a single unexported implementation behind a small interface)
- [ ] No interface has more than ~3 methods unless it composes named smaller ones
- [ ] Every type assertion uses the comma-ok form
- [ ] Pointer vs value receivers are consistent across all methods on a type
- [ ] Compile-time `var _ I = (*T)(nil)` exists where silent regressions would hurt
- [ ] Exported structs don't accidentally promote inner-type APIs through embedding

## References

- [references/consumer-owned-interfaces.md](references/consumer-owned-interfaces.md) — where interfaces live and how to migrate
- [references/embedding-and-receivers.md](references/embedding-and-receivers.md) — embedding, overrides, pointer vs value receivers
- [references/std-interfaces-cheatsheet.md](references/std-interfaces-cheatsheet.md) — canonical signatures from the standard library
