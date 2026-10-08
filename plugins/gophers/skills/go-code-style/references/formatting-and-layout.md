# Formatting and Layout

`gofmt` is the baseline; `goimports` and `gofumpt` add import grouping and stricter formatting. CI should run all three. Beyond layout, this file covers the decisions a formatter cannot make.

## Line Length

There is **no hard line length limit**, but lines beyond ~120 columns are uncomfortable on most diff viewers. Break at **semantic boundaries** — between arguments, between conditions — not at arbitrary columns.

```go
// Good — break at logical groups
mux.HandleFunc("/api/users", func(w http.ResponseWriter, r *http.Request) {
    handleUsers(
        w, r,
        serviceName,
        cfg,
        logger,
        authMiddleware,
    )
})
```

When a signature is genuinely too long, the right fix is usually **fewer parameters** (options struct, fewer responsibilities) — not better wrapping.

## Multi-Line Signatures

When a signature wraps, put each parameter on its own line and the closing paren plus return types on a new line:

```go
func New(
    ctx context.Context,
    addr string,
    opts ...Option,
) (*Server, error) {
    ...
}
```

Do not pack three parameters per line with awkward alignment.

## Semicolons and Brace Placement

Go's lexer auto-inserts semicolons. The opening brace **must be on the same line** as the control structure or function signature.

```go
// Good
if i < f() {
    g()
}

// Bad — semicolon inserted after f(), the brace is then a syntax error
if i < f()
{
    g()
}
```

Explicit semicolons appear only inside `for` clauses (`for i := 0; i < n; i++`) and to separate multiple statements on one line (which you should rarely do).

## Imports

Group imports into stdlib / third-party / local with blank lines between groups (`goimports -local your.module.path` does this).

```go
import (
    "context"
    "fmt"

    "github.com/google/uuid"

    "example.com/internal/store"
)
```

Avoid:

- Aliasing without a real collision.
- `import . "fmt"` (dot import) outside of test files.
- Side-effect imports (`_ "github.com/lib/pq"`) buried in library code — keep them in `main`.

## File Organisation

Conventional order inside a `.go` file:

1. Package doc comment.
2. `package` clause.
3. `import` block.
4. Constants (`const ( ... )`).
5. Types (struct/interface definitions).
6. Constructors (`func New...`).
7. Methods on those types.
8. Package-level helpers.

For a package with several files, give each file one primary type when that type has many methods (`server.go`, `request.go`, `response.go`).

## Receiver Style

- One- or two-letter abbreviation of the type.
- Consistent across all methods.
- Pointer or value receiver chosen per type, not per method — mixing usually means the type is muddled.

```go
type Buffer struct { ... }
func (b *Buffer) Write(p []byte) (int, error) { ... }
func (b *Buffer) Bytes() []byte               { ... }
```

## Blank Lines

Use blank lines to separate logical paragraphs of a function. A long function with no blank lines is harder to scan than one broken into 5-10 line groups.

```go
func handle(ctx context.Context, req Request) (Response, error) {
    if err := validate(req); err != nil {
        return Response{}, err
    }

    user, err := lookupUser(ctx, req.UserID)
    if err != nil {
        return Response{}, fmt.Errorf("lookup: %w", err)
    }

    return Response{User: user}, nil
}
```

## Anti-Patterns

- Manual column alignment that fights `gofmt` (`gofmt` wins).
- Multiple statements on one line with `;`.
- Imports not grouped (`goimports` removes the silence).
- Functions over ~80 lines without intermediate blank lines.
- One file containing 4 unrelated primary types.
