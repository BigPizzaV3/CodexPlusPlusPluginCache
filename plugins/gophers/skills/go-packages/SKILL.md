---
name: go-packages
description: "Use when creating Go packages, organizing imports, managing dependencies, or structuring a Go project. Covers meaningful package names, package size, import grouping (stdlib first, then external), blank/dot imports, the run() pattern in main, init() restrictions, and CLI flag conventions. Apply proactively when starting a new module or splitting a growing codebase, even if the user did not explicitly ask about package layout. Does not cover identifier naming inside packages (see go-naming)."
license: MIT
compatibility: "Designed for Claude Code or similar AI coding agents. Plain Go (any supported version)."
allowed-tools: Read Edit Write Glob Grep Bash(go:*) Bash(golangci-lint:*)
---

# Go Packages and Imports

A package is a unit of meaning, not a folder of files. Name it for what it provides, keep imports tidy, and put startup logic where it belongs.

## Core Rules

1. **Package names describe what the package provides.** `util`, `helper`, `common`, `misc` are not names.
2. **Imports are grouped: stdlib first, then external.** `goimports` will keep this honest.
3. **Avoid `init()`** — and when unavoidable, keep it deterministic and I/O-free.
4. **`os.Exit` / `log.Fatal` only inside `main`.** Library code returns errors.
5. **Use the `run()` pattern** so `main` has a single exit point and deferred cleanup runs.
6. **CLI flags belong in `package main`.** Libraries take configuration as parameters.
7. **Blank imports** belong in `main` or tests. **Dot imports** are essentially never appropriate.

## Decision: How to Split a Package

| Question | If "yes" |
|---|---|
| Can you state the package's purpose in one sentence? | Probably right-sized |
| Do its files never share unexported symbols? | Likely two packages glued by directory |
| Do distinct caller groups touch distinct files? | Split along caller boundaries |
| Is the godoc index so long callers cannot find things? | Split for discoverability |
| Does splitting create import cycles? | Don't split |

> Read [references/package-layout.md](references/package-layout.md) when deciding how to split a growing package, organizing `cmd/`, `internal/`, or designing a library API surface.

## Naming Packages

```go
// Good — meaningful
db := spannertest.NewDatabaseFromFile(...)
_, err := f.Seek(0, io.SeekStart)

// Bad — vague
db := test.NewDatabaseFromFile(...)
_, err := f.Seek(0, common.SeekStart)
```

Generic words may appear as part of a name (`stringutil`, `iotest`) but not as the whole name. Match the package to a concept the caller already knows.

## Imports

```go
import (
    "fmt"
    "os"

    "github.com/foo/bar"
    "rsc.io/goversion/version"
)
```

| Rule | Guidance |
|---|---|
| Group order | stdlib, then external; extended order may also separate protos and side-effect imports |
| Renaming | Avoid unless there is a collision; rename the more-local import |
| Blank import (`import _`) | Only `main` and tests |
| Dot import (`import .`) | Effectively never; rare in test files for circular deps |

> Read [references/imports-and-main.md](references/imports-and-main.md) for extended import grouping, proto `pb` suffixes, the `run()` pattern, and CLI flag conventions.

## Avoid `init()`

When you must use `init()`, make it:

1. Deterministic — same result every run.
2. Independent of the order of other `init()`s.
3. Free of environment state (env vars, working dir, args).
4. Free of I/O (filesystem, network, syscalls).

Acceptable uses:

- Precomputing a constant that cannot fit in a single expression.
- Registering pluggable hooks (`database/sql` drivers).

If your `init` reads a file or calls a network API, refactor it into an explicit `Setup()` the caller invokes.

## Exit Only in `main`

```go
func main() {
    if err := run(); err != nil {
        log.Fatal(err)
    }
}

func run() error {
    // all the real work
    return nil
}
```

Why:

- `log.Fatal` and `os.Exit` skip `defer`. Anywhere except `main`, that means leaked files, half-flushed buffers, undeleted temp dirs.
- The `run()` pattern gives you one place to log a clean error and one place to set the exit code.

## CLI Flags

- Define flags in `package main`.
- Flag names use `snake_case`: `--output_dir`, not `--outputDir`.
- Libraries accept configuration through function parameters, never reach for `flag.Lookup`.

```go
func main() {
    outputDir := flag.String("output_dir", ".", "directory for output files")
    flag.Parse()
    if err := mylib.Generate(*outputDir); err != nil {
        log.Fatal(err)
    }
}
```

> Read [references/init-and-globals.md](references/init-and-globals.md) for the boundaries between safe init-time computation, mutable globals, and dependency injection.

## Anti-Patterns

| Anti-pattern | Why it hurts | Do this instead |
|---|---|---|
| `package util` | Meaningless name; import conflicts | Name after the concept |
| One huge package with 50 files | Hard to navigate, slow builds | Split by responsibility |
| `init()` reads config from disk | Side effect at import time | Explicit `Setup()` in `main` |
| `log.Fatal` in library code | Skips defers, untestable | Return an error |
| `os.Exit` in a request handler | Same — plus crashes the server | Return an error to the framework |
| `import _ "pkg"` in a library | Side effects on every importer | Register explicitly |
| `import . "pkg"` to "save typing" | Tools lose track of where names come from | Use the package qualifier |
| Library reads a flag at import time | Untestable, non-reusable | Accept config as parameter |

## Verification Checklist

- [ ] Package name is concrete and unambiguous
- [ ] Imports are grouped (stdlib first), `goimports` clean
- [ ] No `init()` performs I/O or depends on env state
- [ ] `main` is a single `if err := run(); err != nil { log.Fatal(err) }`
- [ ] No `os.Exit` / `log.Fatal*` outside `main`
- [ ] Flags are defined only in `package main`
- [ ] No `import .` and no blank import outside `main`/tests
- [ ] Package's purpose fits in one sentence

## References

- [references/package-layout.md](references/package-layout.md) — splitting packages, `cmd/`, `internal/`, public API surface
- [references/imports-and-main.md](references/imports-and-main.md) — extended import grouping, the `run()` pattern, flag conventions
- [references/init-and-globals.md](references/init-and-globals.md) — when `init` is acceptable, mutable globals, DI
