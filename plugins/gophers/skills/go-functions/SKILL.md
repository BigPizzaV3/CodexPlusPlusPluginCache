---
name: go-functions
description: "Use when organising functions in a Go file, formatting signatures, designing return values, or naming Printf-style helpers. Covers in-file ordering (type → ctor → exported → unexported → utils), multi-line signature shape, naked-parameter clarity, pointer-vs-value receivers, and the `f`-suffix rule. Apply proactively to any new function. Functional options: see go-functional-options."
license: MIT
compatibility: "Designed for Claude Code or similar AI coding agents. Plain Go (any supported version)."
allowed-tools: Read Edit Write Glob Grep Bash(go:*) Bash(golangci-lint:*)
---

# Go Function Design

A function's surface is read more often than its body. Optimize for the reader: predictable ordering in the file, signatures that scan, no hidden bool flags.

## Core Rules

1. **Order by use, not alphabet.** Types → constructors → exported methods → unexported → utilities.
2. **Keep signatures on one line when reasonable.** When wrapping, every parameter on its own line with a trailing comma.
3. **Never pass `*Interface`.** Pass the interface value; the underlying data can already be a pointer.
4. **Replace naked `bool`/`int` parameters with named types** or add `/* name */` comments at call sites.
5. **Printf-style functions end in `f`** so `go vet` can check the format.
6. **Prefer `%q` over `%s` plus manual quoting** when formatting strings for errors and logs.

## File Ordering

```go
type Server struct{ ... }

func NewServer(...) *Server { ... }     // constructor next to type

func (s *Server) Start(ctx context.Context) error { ... } // exported
func (s *Server) Stop() error           { ... }

func (s *Server) acceptLoop() { ... }   // unexported

func parseAddr(s string) (string, error) { ... } // file-local helper
```

Rules:

1. Types and their constructors sit together at the top.
2. Exported methods come before unexported ones.
3. File-local helpers go at the bottom.
4. Within a section, follow rough call order.

## Signature Formatting

```go
// Fits on one line — keep it on one line
func Sum(xs []int) int

// Too long — break with every param on its own line
func (r *Repo) SaveTransaction(
    ctx context.Context,
    userID string,
    tx Transaction,
    opts ...SaveOption,
) (string, error) {
    ...
}
```

The trailing comma is required and `gofmt`-stable.

### Avoid Naked Bool/Int Parameters

```go
// Bad — what does `true` mean?
NewServer(":8080", true, 30, false)

// Better — call-site comments
NewServer(":8080", true /* tls */, 30 /* maxConn */, false /* readonly */)

// Best — named types or options
NewServer(":8080", WithTLS(), WithMaxConn(30))
```

When a single bool is genuinely binary and obvious from the function name (`SetVerbose(true)`), it's fine.

> Read [references/signatures.md](references/signatures.md) for return-value styles, naked returns, function-as-parameter formatting, and the variadic-options call-site shape.

## Pointers to Interfaces

```go
// Bad
func process(r *io.Reader) { ... }

// Good
func process(r io.Reader) { ... }
```

An interface value already carries a pointer-sized data word. `*io.Reader` is a pointer to an interface — almost always a mistake.

## Printf and Stringer

Functions that accept a format string should end in `f`:

```go
func Logf(format string, args ...any)
```

`go vet` then checks that `%s`, `%d`, etc. match the argument types.

When formatting strings into errors or logs, prefer `%q`:

```go
return fmt.Errorf("unknown key %q", key) // unknown key "foo\nbar"
```

`%q` quotes and escapes; `%s` plus manual quoting (`"key \"" + key + "\""`) is fragile.

> Read [references/printf-and-stringer.md](references/printf-and-stringer.md) for `%v` vs `%s` vs `%q`, implementing `fmt.Stringer` safely, avoiding `String()` infinite recursion, and `fmt.Formatter`.

## Variadic Options at the Call Site

```go
db.Open(addr,
    db.WithCache(false),
    db.WithLogger(log),
    db.WithRetries(3),
)
```

Each option on its own line, trailing comma. Use this layout whenever the call doesn't fit on a single line.

## Constructors

A constructor immediately follows its type. Use the short form when no error is possible:

```go
type Counter struct{ n int }

func NewCounter() *Counter { return &Counter{} }
```

Return an error when construction can fail:

```go
func NewClient(addr string) (*Client, error) { ... }
```

Don't expose a half-built type through a constructor that "always succeeds" but requires `Init()` afterward.

## Anti-Patterns

| Anti-pattern | Why it hurts | Do this instead |
|---|---|---|
| Methods scattered randomly in the file | Hard to navigate | Group by type, exported-first |
| Five-argument wrapped signature with no trailing comma | `gofmt` keeps reformatting | Trailing comma |
| `func process(r *io.Reader)` | Pointer to interface | Pass `io.Reader` |
| `Log(msg string, format bool, ...)` | Combines two concerns; `vet` blind | Separate `Log` and `Logf` |
| `Open(":8080", true, false, 30)` | Unreadable booleans | Named options or `/* */` comments |
| `fmt.Errorf("got %s", key)` for arbitrary key | Special chars unclear in output | `%q` |
| Returning `*MyError` (concrete pointer) | Typed-nil interface trap | Return `error` |

## Verification Checklist

- [ ] Types appear above their constructors; exported methods above unexported
- [ ] Long signatures wrap with one parameter per line and a trailing comma
- [ ] No pointer-to-interface parameters
- [ ] Bool/int parameters are either obvious from the function name or named with `/* */` comments
- [ ] Functions taking a format string end in `f`
- [ ] Errors and logs use `%q` when formatting arbitrary strings
- [ ] Constructors return `(*T, error)` when construction can fail — no half-built objects

## References

- [references/signatures.md](references/signatures.md) — multi-line wrapping, named results, function-typed parameters
- [references/printf-and-stringer.md](references/printf-and-stringer.md) — format verbs, `fmt.Stringer`, recursion traps, `fmt.Formatter`
