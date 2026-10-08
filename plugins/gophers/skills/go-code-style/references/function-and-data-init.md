# Declarations, Composite Literals, and Value vs Pointer

## Variable Declarations

`var` signals "starts at zero"; `:=` signals "initialised with this value". Use each for the intent it expresses.

```go
var count int           // zero value
var buf bytes.Buffer    // zero value is ready to use
name := "default"       // non-zero literal
ctx := context.Background()
```

### Multiple Declarations

Group related declarations:

```go
var (
    defaultTimeout = 30 * time.Second
    maxRetries     = 3
)
```

Do not declare unrelated variables in a single block — the grouping implies a relationship.

## Slice and Map Initialization

A nil map panics on write. A nil slice serialises to JSON `null` rather than `[]`, surprising API consumers. Initialise explicitly.

```go
users := []User{}                       // explicit empty
m := map[string]int{}                   // explicit empty
users = make([]User, 0, len(ids))       // preallocate for known size
m = make(map[string]int, len(items))    // preallocate map buckets
```

When to preallocate:

- You know the exact final size → `make([]T, 0, len(input))`.
- You know an upper bound → `make([]T, 0, bound)`.
- The size is unknown and small → no preallocation; append's amortised cost is fine.

Avoid `make([]T, 0, 10000)` when the common case is 10 — wasted memory.

## Composite Literals

Always use field names for non-trivial structs. Positional literals break the moment a field is added or reordered, and the compiler won't complain.

```go
// Good
req := &http.Request{
    Method: http.MethodGet,
    URL:    u,
    Header: http.Header{"X-Trace": []string{traceID}},
}

// Bad — positional, brittle
req := &http.Request{http.MethodGet, u, http.Header{...}, ...}
```

For tiny structs (`Point{1, 2}`) and tests where the type is local to the test file, positional is acceptable but still risky.

## Value vs Pointer Arguments

The default in Go is to pass by value. Use a pointer for one of three reasons:

1. **You need to mutate.** `func (b *Buffer) Write(p []byte)` mutates `*b`.
2. **The type is large.** Copying a 200-byte struct on every call adds up.
3. **`nil` is a meaningful zero.** Optional pointer arguments where the caller signals "skip" with `nil`.

```go
// Pass by value — small fixed-size header
func process(s string)

// Pass by pointer — mutate
func (s *Server) Start()

// Pass by pointer — large struct (~200 bytes)
func render(opts *RenderOptions)
```

### Things You Must Not Copy

These types panic, race, or silently break if copied:

- `sync.Mutex`, `sync.RWMutex`, `sync.WaitGroup`, `sync.Cond`, `sync.Once`.
- `bytes.Buffer` after first use (internal slice aliasing).
- Anything that embeds one of the above.

The `go vet copylocks` check flags most of these at build time.

```go
// Bad — copying a mutex
var mu sync.Mutex
mu2 := mu // dropped lock state, race

// Good
type SafeCounter struct {
    mu sync.Mutex
    n  int
}
func (c *SafeCounter) Inc() { c.mu.Lock(); c.n++; c.mu.Unlock() }
// always *SafeCounter, never SafeCounter passed by value
```

## Receiver Type Consistency

Pick value or pointer receivers **per type**, not per method.

```go
// Good — all methods use *Server
func (s *Server) Start() error
func (s *Server) Close() error

// Bad — mix breaks the method set rules and confuses readers
func (s Server) Name() string
func (s *Server) Start() error
```

Default to pointer receivers unless the type is genuinely small (string-sized) and immutable.

## Function Parameter Count

Aim for ≤ 4 parameters. Beyond that, group into a struct or use functional options:

```go
// Bad
func New(addr string, log *slog.Logger, readTO, writeTO, idleTO time.Duration, tls *tls.Config) *Server

// Good — functional options
func New(addr string, opts ...Option) *Server
```

Or:

```go
// Good — options struct, for static configuration
type Config struct {
    Addr         string
    Logger       *slog.Logger
    ReadTimeout  time.Duration
    WriteTimeout time.Duration
}
func New(cfg Config) *Server
```

## Anti-Patterns

- Positional composite literals on multi-field structs.
- `var m map[string]int` followed by `m[k] = v` (nil map panic).
- `make([]T, 0, hugeNumber)` "just in case".
- Pointer parameters on small immutable types ("might mutate later" — exactly the wrong time to add indirection).
- Mixed value/pointer receivers on the same type.
- Functions taking 7 positional parameters where the order is meaningful but invisible at the call site.
