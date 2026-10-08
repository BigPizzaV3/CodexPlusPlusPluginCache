# Package Layout

There is no canonical Go project layout — but there are patterns that work.

## Single-Command Project

```
myapp/
├── go.mod
├── main.go        // package main, just calls run()
├── server.go      // package main, the run() and wiring
├── README.md
```

For small tools, everything stays in `package main`. Don't manufacture sub-packages for a 300-line program.

## Multi-Command Module

```
example.com/myapp/
├── go.mod
├── cmd/
│   ├── server/   // package main
│   └── cli/      // package main
├── internal/
│   ├── store/    // packages used only by this module
│   └── api/
└── pkg/          // (optional) packages other modules may import
```

- `cmd/<name>/main.go` keeps the executable thin.
- `internal/` packages cannot be imported from outside this module — perfect for implementation details.
- `pkg/` is convention, not enforcement. Many projects put libraries at the module root instead.

## Library Module

```
example.com/lib/
├── go.mod
├── lib.go        // package lib — the front door
├── lib_test.go
├── internal/
│   └── parser/   // implementation hidden behind lib.go
```

Keep the public API small. Internal packages can be reorganized freely; external callers only see what you exported at the root.

## When to Split a Package

Split when:

- Two files have no shared unexported symbols.
- Different caller groups use different parts.
- The godoc index is too long to scan.

Don't split when:

- The only motivation is "this file is long."
- Splitting would create an import cycle (Go forbids them).
- The split produces single-type packages that exist only to host one struct.

## When to Combine Packages

If a small package is only ever imported alongside another, consider folding it in. The directory boundary buys nothing.

## Cyclic Imports

Go has no cycle resolution. If `a` imports `b` and `b` imports `a`, you must restructure:

- Move the shared type to a third package `c` that both import.
- Invert the dependency — pass `b` a callback that calls into `a`, instead of `b` importing `a`.
- Merge the packages if they truly belong together.

## `internal/`

The `internal/` directory has special meaning: packages under it may only be imported by code rooted at its parent.

```
example.com/m/internal/x   // importable from example.com/m/* only
```

Use it liberally. Anything you might want to refactor without a breaking change belongs in `internal/`.

## `vendor/`

Modern Go projects with `go.mod` rarely need vendoring. `go mod vendor` exists for environments without network access (air-gapped builds, certain CI pipelines).
