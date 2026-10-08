# Functions, Methods, Variants, and Options

## Constructors

Pick one rule per package:

- **One primary type** → `New()`. Callers: `client.New(addr)`.
- **Multiple constructible types** → `NewThing()`. Callers: `http.NewRequest`, `http.NewServeMux`.

```go
// package apiclient — one primary type
func New(addr string) *Client { ... }

// package http — multiple types
func NewRequest(method, url string, body io.Reader) (*Request, error)
func NewServeMux() *ServeMux
```

Stuttering check: `apiclient.NewClient()` repeats the type name; `apiclient.New()` does not.

Constructors that take many parameters should switch to functional options (see below) or to an options struct.

## Getters and Setters

Go omits `Get`. The field accessor is named after the field itself.

```go
// Good
func (u *User) Name() string       { return u.name }
func (u *User) SetName(s string)   { u.name = s }

// Bad
func (u *User) GetName() string    // C# / Java style
```

Reason: `user.Name()` already reads as "the user's name". Adding `Get` repeats the article.

Boolean predicates keep their `Is`/`Has`/`Can` prefix — those are not getters, they are questions.

```go
func (u *User) IsAdmin() bool   // not Admin()
func (u *User) HasRole(r string) bool
```

## Format Function Suffix

Functions that take a `fmt`-style format string end in `f`. The suffix is a contract: "format args follow".

```go
fmt.Errorf("parsing %s: %w", path, err)
log.Printf("connecting to %s", addr)
errors.Wrapf(err, "user %d", id) // hypothetical
```

A function named `Wrap(err, "user")` without `f` should not take format arguments.

## Variant Suffixes and Prefixes

Go encodes common variants in the name. These read instantly to anyone who has read enough stdlib.

| Variant | Convention | Example |
|---|---|---|
| Takes a context | `WithContext` suffix | `db.QueryContext`, `http.NewRequestWithContext` |
| Mutates in place | `In` suffix | `slices.SortFunc` (returns sorted copy historically called `Sort`); `Reverse` returning a new slice vs `ReverseIn` mutating |
| Panics on error | `Must` prefix | `template.Must`, `regexp.MustCompile` |
| Returns reader | `NewReader` | `bytes.NewReader`, `strings.NewReader` |

`Must*` is appropriate only when the caller is initialising a package-level variable that *cannot* fail (compiled regex, parsed template). Never use `Must*` for runtime input.

## Functional Options

When a constructor needs many optional knobs, expose `Option` and `WithXxx` helpers.

```go
type Option func(*Server)

func WithLogger(l *slog.Logger) Option {
    return func(s *Server) { s.log = l }
}

func WithReadTimeout(d time.Duration) Option {
    return func(s *Server) { s.readTimeout = d }
}

func New(addr string, opts ...Option) *Server {
    s := &Server{addr: addr, log: slog.Default(), readTimeout: 30 * time.Second}
    for _, opt := range opts {
        opt(s)
    }
    return s
}
```

Naming rules:

- The option type is `Option` (not `ServerOption` — `server.Option` already qualifies it).
- Each helper is `WithXxx` matching the conceptual setting (`WithLogger`, `WithReadTimeout`).
- Avoid mixing `WithX`, `SetX`, `UseX`, `EnableX` — pick `With*` and stick to it.

## Named Return Values

Named returns are **documentation, not control flow**. They show up in godoc and clarify what `(int, int)` means.

```go
func Split(sum int) (x, y int) {
    x = sum * 4 / 9
    y = sum - x
    return // OK in a 3-line function
}
```

Rules:

- Use names when the return tuple is otherwise ambiguous (`(int, int, error)` → `(n, total int, err error)`).
- Avoid naked returns in functions over ~15 lines — readers should not have to scroll back to find what is being returned.
- Do not introduce named returns *just* so you can write `return` instead of `return x, y` — clarity is more important than two saved tokens.

## Test Function Names

```go
func TestParseToken(t *testing.T)             // unit
func TestParseToken_InvalidInput(t *testing.T) // subtest variant (underscore allowed)
func BenchmarkParseToken(b *testing.B)
func ExampleParseToken()
```

Subtest case names inside `t.Run(...)` are fully lowercase phrases:

```go
t.Run("valid id", ...)
t.Run("empty input", ...)
t.Run("nil body", ...)
```

## Anti-Patterns

- `GetURL()` instead of `URL()`.
- `URLer`, `Parserer` — `-er` on multi-syllable nouns reads badly; pick a behaviour name.
- `WrapError(err, format, args...)` without `f` suffix — should be `Wrapf`.
- Functional options that take pointers to the option type — keep them simple closures.
- Mixing `Sort`, `SortIn`, `SortFunc`, `SortByKey` in one package without a clear naming axis.
- `MustOpenFile(path)` for runtime user input — panics belong to package init, not request paths.
