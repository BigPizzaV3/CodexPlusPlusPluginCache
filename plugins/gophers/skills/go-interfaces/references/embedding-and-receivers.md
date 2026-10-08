# Embedding and Receiver Types

Two decisions shape the public surface of a Go type: what you embed, and whether your methods take a pointer or value receiver. Both are easy to get wrong and painful to change later.

## Struct embedding

Embedding promotes the inner type's exported fields and methods to the outer type. It's composition, not inheritance — the receiver of a promoted method is still the inner type.

```go
type Logger struct{ *slog.Logger }

type Server struct {
    Logger      // promotes Info/Warn/Error
    addr string
}

s := Server{Logger: Logger{slog.Default()}, addr: ":8080"}
s.Info("listening", "addr", s.addr) // calls slog.Logger.Info via Logger
```

### Embed or named field?

| Use embedding | Use a named field |
|---|---|
| Outer type *is* an enhanced inner type | Outer type *uses* the inner type internally |
| You want the full inner API promoted | You want to expose only a subset |
| Standard library precedent (`bufio.Reader` embeds `io.Reader`) | The inner type is an implementation detail |

A common mistake is to embed for convenience and accidentally publish the inner type's whole API. If you only need three methods, write three explicit forwarders instead.

### Overriding and conflicts

The outer type can shadow a promoted method by defining its own:

```go
func (s *Server) Info(msg string, args ...any) {
    s.Logger.Info(msg, append(args, "server", s.addr)...)
}
```

If two embedded types provide the same method, neither is promoted — you must call the inner one explicitly (`s.Logger.Info(...)`). Embedding two types with the same method name in an exported struct is almost always a mistake.

### Interface embedding

Interfaces compose by embedding too:

```go
type ReadWriteCloser interface {
    io.Reader
    io.Writer
    io.Closer
}
```

This is the canonical way to build larger interfaces from smaller ones. Methods named the same way in two embedded interfaces must have identical signatures.

## Receiver type

| Use pointer receiver `(t *T)` | Use value receiver `(t T)` |
|---|---|
| Method mutates the receiver | Type is small and immutable |
| Receiver embeds a `sync.Mutex` or other no-copy type | Type is a basic alias (`type ID string`) |
| Receiver is large enough that copying matters | Type is itself a reference (map, channel, function) |
| Any other method on the type uses a pointer receiver | All methods are read-only accessors on a small struct |

The hard rule: **be consistent.** If `(t *T) Save()` exists, do not also write `(t T) Name()`. Mixed receivers create a method set where `T` and `*T` answer different questions about interface satisfaction, which is the kind of bug that takes hours to debug.

### Pointer-vs-value affects interface satisfaction

```go
type Stringer interface{ String() string }

type Money struct{ cents int64 }
func (m *Money) String() string { /* ... */ }

var s Stringer
s = Money{cents: 100}   // does NOT compile — Money has no String method
s = &Money{cents: 100}  // works — *Money has String
```

This is why interface checks (`var _ Stringer = (*Money)(nil)`) put `(*Money)(nil)` on the right-hand side: the pointer is what satisfies the interface.

### When to default to pointer receivers

If you're unsure, choose pointer receivers. The cost (one pointer indirection) is almost always negligible, and you avoid surprising callers who pass `&t` to satisfy an interface.

Exceptions:

- `time.Time`, `image.Point`, `netip.Addr` — small, immutable, copy-friendly.
- Types whose zero value is meaningful and whose methods don't mutate state.

## noCopy and accidental copies

Some structs must never be copied after first use — those containing `sync.Mutex`, `sync.WaitGroup`, channels owned by the struct, or internal back-pointers. Embed a `noCopy` sentinel so `go vet` catches the mistake:

```go
type noCopy struct{}
func (*noCopy) Lock()   {}
func (*noCopy) Unlock() {}

type Pool struct {
    _  noCopy
    mu sync.Mutex
    /* ... */
}
```

`go vet` reports any `Pool` passed or assigned by value. This is the same technique `sync.WaitGroup` and `strings.Builder` use.

## Anti-patterns

| Anti-pattern | Fix |
|---|---|
| Embedding a concrete type to "save typing" | Use a named field and forward methods explicitly |
| Embedding two types with overlapping methods | Pick one or call them explicitly via their field names |
| One value receiver, one pointer receiver on the same type | Choose one style and apply it everywhere |
| Pointer receiver on a type whose zero value should be usable | Use a value receiver, or document the required constructor |
| Returning a copy of a struct that contains a mutex | Always return a pointer, or make the struct copy-safe |
