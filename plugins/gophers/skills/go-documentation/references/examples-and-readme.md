# Example Tests, README, CONTRIBUTING, CHANGELOG

## Runnable Examples (`Example*`)

`Example*` functions live in `_test.go` files. They run under `go test`, appear on `pkg.go.dev` next to the documented symbol, and are verified by their `// Output:` block.

```go
func ExampleEncode() {
    var buf bytes.Buffer
    if err := Encode(&buf, &Request{ID: "abc"}); err != nil {
        log.Fatal(err)
    }
    fmt.Println(buf.String())
    // Output: {"id":"abc"}
}
```

### Naming

| Function | Appears under |
|---|---|
| `Example` | package-level example |
| `ExampleFoo` | example for `Foo` |
| `ExampleFoo_bar` | second example for `Foo`, titled "bar" |
| `ExampleT_Method` | example for `T.Method` |
| `ExampleT_Method_named` | named second example |

### Output Block

```go
// Output: expected output exactly
```

For unordered output (maps, concurrent prints):

```go
// Unordered output:
// one
// two
// three
```

Lines must match exactly — trailing whitespace and case included. If you don't include a `// Output:` block, the example compiles and runs as a sanity check but its output is not verified.

### Common Patterns

- **Constructor + method use**: show how a caller would build the type and use it.
- **Error handling**: include the `if err != nil` so readers see the actual idiom.
- **Concise**: a good example is 5-15 lines. Longer examples belong in `_test.go` proper.

## README Outline

Order these sections; readers skim top-to-bottom and lose patience.

1. **Title** — `# project-name`.
2. **Badges** — Go version, license, CI status, coverage, Go Report Card, `pkg.go.dev`.
3. **One-sentence summary** — what the project does, for whom.
4. **Demo or screenshot** — a code snippet for libraries, GIF/screenshot for CLIs.
5. **Install** — single command (`go get`, `go install`, `brew install`, Docker).
6. **Minimal example** — copy-paste runnable usage.
7. **Features / Spec** — detailed list, optional.
8. **Contributing** — link to CONTRIBUTING.md.
9. **License** — name + link.

Example minimal usage block:

```go
package main

import (
    "fmt"

    "example.com/widget"
)

func main() {
    w := widget.New("hello")
    fmt.Println(w.Greet())
}
```

For application/CLI projects, replace the code block with the relevant `--help` output and a configuration table.

## CONTRIBUTING.md

Goal: a new contributor can build and test in under 10 minutes. If it takes longer, fix the bottleneck (Makefile, devcontainer, docker-compose) — don't document around it.

Minimal sections:

1. **Prerequisites** — Go version, system deps.
2. **Clone and build** — `git clone`, `make build` (or `go build ./...`).
3. **Run tests** — `make test`, plus how to run a single test.
4. **PR process** — branch naming, commit style, review expectations.
5. **Code style** — link to `.golangci.yml` or `gofmt`/`gofumpt` requirement.

## CHANGELOG

Use either:

- **Keep a Changelog** format (`CHANGELOG.md` with `Added`/`Changed`/`Deprecated`/`Removed`/`Fixed`/`Security` sections per release), or
- **GitHub Releases** with the same structure in release notes.

Each entry answers: *what changed for the user of this library*. Internal refactors with no user-visible impact belong in commit history.

```markdown
## [1.4.0] - 2026-05-01

### Added
- `Store.BatchInsert` for inserting many records in one transaction.

### Changed
- `Store.Get` now wraps `sql.ErrNoRows` instead of returning it directly.

### Fixed
- Race in `Cache.Invalidate` reported in #142.

### Deprecated
- `Store.LegacyGet`; use `Store.Get` instead. Removed in 2.0.
```

Do not inflate a bug fix into "reliability improvements". Be specific so users can decide whether to upgrade.

## llms.txt

A small file at the repo root that gives LLMs a structured overview: what the project is, what each top-level directory does, where the most useful docs live. Helps AI tooling (and humans) navigate quickly.

```markdown
# example/widget

A small Go library for handling widgets.

## Docs
- [Getting started](./docs/getting-started.md)
- [API reference](https://pkg.go.dev/example.com/widget)

## Layout
- `widget/` — public API
- `internal/` — private implementation
- `cmd/widgetctl/` — command-line tool
```

## Anti-Patterns

- `Example*` test with no `// Output:` block when the example does have deterministic output — misses verification.
- README that starts with "Why we built this" before showing what it does.
- A "Contributing" section linking to a 5000-line wiki page instead of a 30-line CONTRIBUTING.md.
- CHANGELOG entries like "Improvements and bug fixes." — useless for the reader.
- Including the `LICENSE` text inline in README instead of a `LICENSE` file at the root.
