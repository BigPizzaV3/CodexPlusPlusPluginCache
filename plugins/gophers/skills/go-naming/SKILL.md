---
name: go-naming
description: "Use when naming any Go identifier — packages, types, functions, methods, receivers, variables, constants, errors, options. Covers MixedCaps, scope-based length, initialism casing, the no-`Get` rule, `-er` interfaces, sentinel `ErrX` vs typed `XError`, and the most commonly missed conventions (constructors, boolean fields, enum zero values, lowercase error strings). Apply proactively whenever new identifiers are introduced, even if the user has not asked about naming."
license: MIT
compatibility: "Designed for Claude Code or similar AI coding agents. Go 1.0+ for the core rules; iota/enum guidance is version-neutral."
allowed-tools: Read Edit Write Glob Grep Bash(go:*) Bash(golangci-lint:*)
---

# Go Naming Conventions

Go uses naming to encode visibility (`UpperCamelCase` = exported, `lowerCamelCase` = unexported), so naming is load-bearing — not cosmetic. Names should be **short, contextual, and non-repetitive**. The package name is always present at the call site; pretending otherwise is the single biggest source of bad Go names.

## Core Rules

1. **MixedCaps only.** No underscores, no `SCREAMING_SNAKE_CASE`, no `kHungarian`. Exceptions: test subtests (`TestFoo_BadInput`), generated code, cgo.
2. **Capitalization is visibility.** `Exported`, `unexported`. Do not invent other conventions.
3. **No stuttering.** The package name is at the call site; `http.HTTPClient` is wrong, `http.Client` is right.
4. **Scope drives length.** `i` is fine in a 3-line loop; package-level vars need descriptive names.
5. **Initialisms keep one case.** `userID`, `HTTPServer`, `ParseURL` — never `userId`, `HttpServer`, `ParseUrl`.
6. **Receivers are 1-2 letter abbreviations**, consistent across all methods of the type. Never `this`/`self`.

## Naming Decision Flow

```
What are you naming?
├─ Package        → lowercase single word, singular, specific (not util/common/helper)
├─ File           → lowercase, underscores OK (user_handler.go)
├─ Interface      → method + "-er" when single-method (Reader, Closer, Stringer)
├─ Struct/Type    → MixedCaps noun (Request, FileHeader)
├─ Constructor    → New() if package has one primary type; NewThing() if multiple
├─ Constant       → MixedCaps; never ALL_CAPS; role-based not value-based
├─ Enum (iota)    → type-prefix + Unknown/Invalid at position 0
├─ Sentinel error → ErrXxx (var ErrNotFound = errors.New("..."))
├─ Error type     → XxxError (type PathError struct{})
├─ Boolean field  → is/has/can prefix (isReady, hasPerm)
├─ Getter         → field name only (Owner()), never GetOwner()
├─ Setter         → SetXxx (SetOwner)
├─ Option         → WithXxx (WithLogger, WithPort)
├─ Variant        → WithContext suffix, In suffix (in-place), Must prefix (panics)
└─ Variable       → length proportional to scope distance
```

## Quick Reference Table

| Element | Convention | Example |
|---|---|---|
| Package | lowercase, singular | `http`, `tabwriter` |
| Exported | `UpperCamelCase` | `ReadAll`, `HTTPClient` |
| Unexported | `lowerCamelCase` | `parseToken`, `userCount` |
| Receiver | 1-2 letters | `func (s *Server)` |
| Constant | MixedCaps | `MaxRetries`, `defaultTimeout` |
| Initialism | uniform case | `URL`, `HTTPServer`, `xmlParser` |
| Sentinel error | `Err` prefix | `ErrNotFound` |
| Error type | `Error` suffix | `*PathError` |
| Boolean field | `is`/`has`/`can` | `isConnected` |
| Option func | `With` + field | `WithPort(8080)` |
| Format func | `f` suffix | `Errorf`, `Wrapf` |

## Frequently Missed Conventions

These are correct but non-obvious — they account for most naming mistakes in code review.

### Constructor: `New` vs `NewThing`

If the package exports **one primary type**, the constructor is `New()`. Callers write `apiclient.New()`, not `apiclient.NewClient()`. Only use `NewThing` when the package builds several things (`http.NewRequest`, `http.NewServeMux`).

### Boolean Fields Get a Prefix

Unexported boolean fields use `is`/`has`/`can`. A bare adjective is ambiguous — is `connected` a method or a field, a state or a verb past tense?

```go
type Conn struct { isOpen bool }
func (c *Conn) IsOpen() bool { return c.isOpen }
```

### Error Strings Are Fully Lowercase

Including acronyms. Errors get concatenated: `fmt.Errorf("parsing token: %w", err)` becomes `"parsing token: invalid message id"`. Mid-sentence capitals look wrong. Use `"invalid message id"` not `"invalid message ID"`.

Sentinel errors should include the package name: `errors.New("apiclient: not found")`.

### Enum Zero Value Is a Sentinel

`var s Status` is silently `0`. If `0` is `StatusReady`, uninitialised values look intentional. Put `StatusUnknown` (or `Invalid`) at iota 0.

```go
type Status int
const (
    StatusUnknown Status = iota // zero-value catch
    StatusReady
    StatusRunning
)
```

### Subtest Names Are Lowercase Phrases

```go
t.Run("valid id", ...) // not "Valid ID"
t.Run("empty input", ...)
```

> Read [references/types-errors-constants.md](references/types-errors-constants.md) when naming new struct/interface/enum/error families.

## MixedCaps Is Load-Bearing

```go
MaxPacketSize    // good
userCount        // good
parseHTTPResponse // good

MAX_PACKET_SIZE  // wrong — Go reserves casing for visibility
max_packet_size  // wrong — snake_case
kMaxBufferSize   // wrong — Hungarian
```

## Avoid Stuttering

The package name is always present at the call site.

```go
// In package http
type Client struct{} // not HTTPClient — caller writes http.Client

// In package user
func New() *User // not NewUser — caller writes user.New()

// In package dbpool
type Pool struct{}    // not DBPool
type Option func()    // not PoolOption
```

> Read [references/identifiers-and-scope.md](references/identifiers-and-scope.md) for receivers, variable scope rules, and import aliasing.

## Avoid Built-In Names

Never shadow `error`, `string`, `len`, `cap`, `append`, `copy`, `new`, `make`, `nil`, `iota`. The compiler allows it; readers and tools do not.

## Anti-Patterns

| Mistake | Fix |
|---|---|
| `MAX_RETRIES = 3` constant | `MaxRetries = 3` — MixedCaps |
| `GetName() string` getter | `Name() string` — Go omits `Get` |
| `HttpClient`, `UserId`, `ParseUrl` | `HTTPClient`, `UserID`, `ParseURL` — uniform initialism case |
| `this`/`self` receiver | One-letter abbreviation (`s` for `Server`) |
| `util`, `common`, `helpers` package | Specific name that describes content (`stringutil`, `httpauth`) |
| `user.NewUser()` constructor | `user.New()` — drop the type name |
| `connected bool` field | `isConnected bool` — prefix reads as a question |
| `"invalid message ID"` error | `"invalid message id"` — fully lowercase |
| `StatusReady` at iota 0 | Add `StatusUnknown` at 0 |
| `userSlice []User` | `users []User` — types do not belong in names |

## Verification Checklist

- [ ] No identifier contains `_` outside of test subtests, generated code, or cgo.
- [ ] No `Get` prefix on getters; setters use `Set`.
- [ ] Initialisms are uniform case (grep `Url\|Http\|Json\|Xml\|Id\b` in source).
- [ ] Receivers across one type all use the same short name.
- [ ] All sentinel errors are `ErrXxx`; all error types are `*XxxError`.
- [ ] All iota-based enums place a `Unknown`/`Invalid` value at position 0.
- [ ] No package named `util`, `common`, `helpers`, `misc`.

## Enforce With Linters

Most rules are mechanical and a linter will catch them in CI:

- `revive` — `var-naming`, `exported`, `receiver-naming`, `error-naming`.
- `predeclared` — flags identifiers that shadow built-ins.
- `errname` — enforces `ErrXxx` / `*XxxError`.
- `misspell` — keeps comments and identifiers consistent.

Add them to `.golangci.yml` and run `golangci-lint run` in CI.

## References

- [references/identifiers-and-scope.md](references/identifiers-and-scope.md) — receivers, scope-based length, acronyms, import aliasing
- [references/types-errors-constants.md](references/types-errors-constants.md) — interfaces, structs, enums, sentinel vs typed errors
- [references/functions-and-options.md](references/functions-and-options.md) — constructors, getters, variants, functional options
