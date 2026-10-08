# init() and Globals

## What `init()` Is For

`init()` runs once, after all package-level variables are initialized, before `main`. It is fine for:

- Computing a constant that cannot be expressed in a single declaration (e.g., a complex lookup table).
- Registering hooks with another package (`database/sql.Register`).
- Compile-time-style assertions you can't make at the type level.

## What `init()` Is Not For

- **Reading config files or env vars.** Tests can't override. Build artifacts depend on the environment they were built in.
- **Opening network connections.** Hangs at import. Order of init across packages is unspecified.
- **Anything that can fail.** Failures in `init` either panic (crashing the program) or are silently swallowed (worse).

Rule of thumb: if your `init` does I/O or reads the environment, write an exported `Setup(ctx, cfg)` function instead and call it from `main`.

## Multiple `init()`s

A file may have multiple `init()` functions; a package may have many. Their order within a file is source order; their order across files is **build-tool dependent**. Do not write code that depends on this order.

## Mutable Globals

Mutable package-level variables are the classic global-state smell:

```go
// Bad
var DB *sql.DB

func init() {
    DB = mustOpen()
}

// Good
type Service struct {
    db *sql.DB
}

func NewService(db *sql.DB) *Service { return &Service{db: db} }
```

Testing the first form requires save/restore dances and `t.Cleanup` plumbing. The second form is trivially testable.

### Acceptable Globals

- **Constants and once-initialized lookup tables.** They never change.
- **Singletons enforced by `sync.Once`** when there is genuinely one resource (a process-wide profiler).
- **`Default*` helpers** for convenience APIs:

```go
var defaultClient = &Client{Timeout: 10 * time.Second}

func Get(url string) (*Response, error) { return defaultClient.Get(url) }
```

The convention is that callers wanting customization use the type directly; the package-level helpers wrap the default instance.

## Dependency Injection

The simplest DI in Go is constructor parameters:

```go
func NewServer(db *sql.DB, clock func() time.Time, log *slog.Logger) *Server
```

No frameworks needed. The benefits compound: testable, no hidden globals, dependencies visible in signatures.

## Package State Pattern: `New` + `Default`

```go
type Client struct { /* ... */ }

func New(opts ...Option) *Client { ... }

// Default is a package-level Client used by the helper functions below.
var Default = New()

// Convenience: redirect package-level calls to Default.
func Get(url string) (*Response, error) { return Default.Get(url) }
```

This shape gives ergonomic helpers without baking a global into every call site of your library.

## Auditing for Hidden Globals

- Anything assigned to in `init()` is suspicious.
- Anything assigned to from `TestMain` (and restored at the end) is a refactor candidate.
- Anything a test would need to reset between cases is begging to become a constructor parameter.
