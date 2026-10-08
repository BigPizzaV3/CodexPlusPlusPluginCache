# Identifiers, Scope, Acronyms, and Aliases

The point of Go's naming rules is to keep the reader's eyes on the meaning, not on the letters. Length, casing, and consistency exist to serve that.

## Scope-Based Length

Length should be proportional to how far the reader has to look to understand a name.

| Scope | Length | Examples |
|---|---|---|
| 1-7 line block | Single letter | `i`, `r`, `w`, `b`, `n`, `v` |
| Single function | Short word | `count`, `buf`, `items`, `users` |
| Package-level | Descriptive | `defaultTimeout`, `parseHTTPHeader` |
| Exported API | Full noun/verb phrase | `MaxIdleConnsPerHost`, `NewRequestWithContext` |

Common conventional single letters:

- `i`, `j`, `k` — loop indices
- `r`, `w` — `io.Reader`, `io.Writer`
- `b` — byte slice / buffer
- `n` — count
- `v` — value (range value)
- `s` — string / `Server` receiver
- `c`, `ch` — channel
- `m` — map

## Receivers

Receivers are method-local: every call site shows the type already. A one- or two-letter abbreviation of the type is enough.

```go
func (s *Server) Start()    // not (server *Server)
func (b *Buffer) Write(...) // not (this *Buffer)
func (q *Queue) Push(v T)   // consistent across all methods of Queue
```

Rules:

- **Consistent across all methods of the type.** Switching between `s`, `srv`, `server` is noise.
- **Never `this` or `self`.** Those come from other languages.
- **Same letter across families** is fine: most stdlib `*Request`/`*Response` receivers use `r`/`w` depending on context.

If your receiver name has to be descriptive ("server", "buffer") to make sense, the method is probably too long.

## Initialisms and Acronyms

Initialisms keep one case across the whole word. The rule is: pick all-upper for exported, all-lower for unexported, but never mix within one initialism.

```go
// Good
URL           // exported, all caps
userID        // unexported boundary: user(lower) + ID(upper)
HTTPServer    // exported
xmlParser     // unexported start, all-lower
ParseURL      // exported verb
```

```go
// Wrong — mixed case within one initialism
Url           // U + rl
HttpServer    // H + ttp
ParseUrl      // U + rl
xmlAPI        // ambiguous: xml + API? xmlA + PI?
```

Multiple initialisms in one name: still uniform per initialism (`HTTPSAPI`, `xmlAPI`).

## Variable Naming Pitfalls

- **No type in the name.** `users` not `userSlice`, `name` not `nameStr`. The type is right there.
- **No Hungarian.** `iCount` is wrong; `count` is fine.
- **Don't shadow loop variables.** Each `for i := range ...` introduces a fresh `i`; reusing the name across scopes makes diffs confusing.
- **Prefix unexported package globals** with `_` only when you specifically need to prevent shadowing in nested scopes — most projects do not need this.

## Import Aliases

Only alias on collision or when the package name is unhelpfully generic. Otherwise the alias is cognitive load: readers cannot grep for the alias.

```go
import (
    "math/rand"
    mrand "math/rand/v2"          // good: disambiguates
    pb "example.com/api/v1/userpb" // good: short alias for generated code
)
```

Avoid:

```go
import h "net/http" // bad: hides the well-known package name
import . "fmt"      // bad: dot import, pollutes namespace
```

`_ "image/png"` (blank import) is fine when you need the side effect (`init` registration) — but keep blank imports in `main` or test packages where the side effect is visible.

## File Names

- Lowercase, underscores OK: `user_handler.go`, `order_test.go`.
- Test files end in `_test.go`.
- Build-tag files: `foo_linux.go`, `foo_amd64.go` — the suffix matches the build tag.
- One primary type per file when the type has many methods.

## Anti-Patterns

- Long names in short loops: `for userIndex := range users` — use `i`.
- Inconsistent receiver names: `(s *Server)` in one method, `(srv *Server)` in another.
- `userId`, `httpUrl`, `xmlApi` — initialism case mixing.
- Aliasing without collision: `import h "net/http"`.
- `_ "github.com/lib/pq"` deep inside a library package — side effects hidden from callers.
