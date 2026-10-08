---
name: go-documentation
description: "Use when writing or reviewing Go documentation — godoc comments on packages, types, functions, methods, sentinel errors; runnable Example tests; README/CONTRIBUTING/CHANGELOG. Covers the project-type detection (library vs application) that decides which docs are needed, comment grammar (start with name, full sentences), what to document vs what to skip, and Example test conventions. Apply proactively when introducing exported names, even if documentation was not requested."
license: MIT
compatibility: "Designed for Claude Code or similar AI coding agents. Works on any Go version; new-style godoc headings/links need Go 1.19+."
allowed-tools: Read Edit Write Glob Grep Bash(go:*)
---

# Go Documentation

Documentation in Go is part of the API. Doc comments compile into `go doc`, `pkg.go.dev`, and IDE tooltips, so the rules exist to make those views readable. Code says *what*; comments say *why*, *when*, and *what can go wrong*.

## Core Rules

1. **Every exported name has a doc comment.** Packages, types, functions, methods, constants, variables.
2. **Doc comments start with the name** (`// Encode writes ...`). Full sentences, capitalised, end with a period.
3. **Document non-obvious behaviour.** Restating the signature is noise.
4. **Mark deprecations explicitly** with a `Deprecated:` paragraph.
5. **Examples are tests** — runnable `Example*` functions in `_test.go` files with `// Output:` blocks are verified by `go test`.
6. **Every package has exactly one package comment** above the `package` clause in one file (`doc.go` if long).

## What Project Are You Documenting?

Detect this first — it changes the doc surface area.

| Signal | Project type | Docs to focus on |
|---|---|---|
| No `main` package, intended to be imported | **Library** | godoc, `Example*` tests, README usage examples, pkg.go.dev rendering |
| Has `main` package, `cmd/` directory, ships a binary or Docker image | **Application/CLI** | Install instructions, `--help` text, config docs |
| Both (libraries that ship CLI tools) | Both | All of the above |

Universal: doc comments on exported names, package comment, README, LICENSE, CONTRIBUTING (recommended), CHANGELOG (recommended).

> Read [references/godoc-grammar.md](references/godoc-grammar.md) for the comment grammar, headings/lists, deprecation markers, and full examples.

## Comment Grammar

```go
// Encode writes the JSON encoding of req to w.
// It returns an error if req contains a non-serialisable field.
func Encode(w io.Writer, req *Request) error
```

Rules:

- Start with the name of the thing.
- Use a verb phrase for functions/methods, a noun phrase for types/values.
- Articles (`A`, `An`, `The`) may precede the name.
- Full sentences, punctuation included.
- Wrap at ~80 columns for diff comfort; no hard limit.

Unexported names with non-obvious behaviour should also be commented — those comments are for maintainers, not godoc.

## What to Document

| Topic | Document when | Skip when |
|---|---|---|
| Parameters | edge cases, units, ranges | type/name already say it |
| Context | behaviour differs from standard cancellation | standard `ctx.Err()` propagation |
| Concurrency | ambiguous (e.g., a read that mutates internal state) | read-only is safe by default; mutation is unsafe by default |
| Cleanup | always — `defer Close()`, `Stop()` requirements | — |
| Errors | sentinel values (`ErrNotFound`), error types (use `*PathError` pointer) | — |
| Named returns | multiple values of the same type | type alone is clear |
| Side effects | always — file writes, network calls, init-time work | — |

Restating signatures is the most common waste:

```go
// Bad — restates what you can see
// SetName sets the name.
func (u *User) SetName(name string) { ... }

// Good — explains the why and the constraints
// SetName sets the user's display name. Returns ErrInvalidName
// if name is empty or longer than MaxNameLen.
func (u *User) SetName(name string) error { ... }
```

## Package Comments

Every package has exactly one. Place it above the `package` clause in one file. For long descriptions, use a dedicated `doc.go`.

```go
// Package store provides a transactional key-value store backed by
// SQLite. It is safe for concurrent use; see (*Store).BeginTx for
// transaction semantics.
package store
```

For `main` packages, use the binary name:

```go
// The migrate command applies SQL migrations from disk to a database.
package main
```

## Runnable Examples

```go
func ExampleEncode() {
    var buf bytes.Buffer
    _ = Encode(&buf, &Request{ID: "abc"})
    fmt.Println(buf.String())
    // Output: {"id":"abc"}
}
```

Naming:

- `func Example()` — package-level example.
- `func ExampleFoo()` — example for `Foo`.
- `func ExampleFoo_bar()` — alternate example for `Foo` titled "bar".
- `func ExampleT_Method()` — example for `T.Method`.

`go test` runs these and verifies the `// Output:` line matches. They appear in godoc attached to the named symbol — the best documentation is the kind the compiler keeps honest.

> Read [references/examples-and-readme.md](references/examples-and-readme.md) for `Example*` patterns, the canonical README outline, and CONTRIBUTING/CHANGELOG templates.

## Error and Type Docs

Sentinel errors: document on the variable, not on each return.

```go
// ErrNotFound is returned when no record matches the query.
var ErrNotFound = errors.New("store: not found")
```

Error types: document with the **pointer form** so `errors.Is`/`errors.As` examples match.

```go
// PathError records the operation and path that caused an error.
// Use errors.As(err, new(*PathError)) to inspect the fields.
type PathError struct { Op, Path string; Err error }
```

## Anti-Patterns

| Anti-pattern | Why it hurts | Do this instead |
|---|---|---|
| `// SetName sets the name.` | restates signature, no value | explain constraints, side effects, errors |
| `// TODO: improve this` with no owner/date | forever-todo | link to issue or remove |
| `// Note: this is fast.` | unsupported claim | benchmark in test, link to it |
| `// Deprecated.` (no body) | tooling reads the body | `// Deprecated: use NewFoo instead.` |
| Trailing period missing | inconsistent godoc layout | end every sentence with `.` |
| Multi-paragraph doc with no blank line | godoc collapses it | separate paragraphs with `//` blank lines |
| Documenting unexported names with godoc-style sentences | wastes effort; not rendered | one-line maintainer note is enough |
| Doc comment above the wrong symbol (blank line between) | godoc treats it as orphan | no blank line between comment and symbol |

## Verification Checklist

- [ ] `go doc ./...` renders cleanly for every package (no missing doc warnings from linters).
- [ ] Every exported identifier has a comment starting with its name.
- [ ] Every package has exactly one package comment.
- [ ] All deprecations include the `Deprecated:` paragraph.
- [ ] At least one `Example*` test per non-trivial exported function in a library package.
- [ ] README contains: title, summary, install, minimal working example, license.
- [ ] `golangci-lint run --enable=godot,revive` passes (revive's `exported` rule).

## Enforce With Linters

Mechanical checks belong to CI:

- `revive` `exported` — missing doc comments on exported names.
- `godot` — missing trailing periods in doc comments.
- `misspell` — typos in comments.
- `go vet` — basic format-string and other issues that also surface in docs.

## References

- [references/godoc-grammar.md](references/godoc-grammar.md) — sentence rules, headings, deprecation, formatting
- [references/examples-and-readme.md](references/examples-and-readme.md) — `Example*` tests, README outline, CONTRIBUTING/CHANGELOG
- [references/library-vs-application.md](references/library-vs-application.md) — what each project type needs, llms.txt, CLI `--help`
