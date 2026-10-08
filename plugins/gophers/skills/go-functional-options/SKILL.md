---
name: go-functional-options
description: "Use when designing a Go constructor or factory with 3+ optional parameters, or an API expected to grow new options over time. Covers the canonical Option interface pattern with unexported apply method, With* constructors, default values, and the interface-vs-closure tradeoff. Apply proactively when reviewing a New* function that takes many settings, even if the user didn't ask about functional options. Does not cover general function design (see go-functions)."
license: MIT
compatibility: "Designed for Claude Code or similar AI coding agents. Plain Go (any supported version)."
allowed-tools: Read Edit Write Glob Grep Bash(go:*) Bash(golangci-lint:*)
---

# Functional Options

The functional options pattern lets a constructor stay backward compatible while accepting an open-ended set of optional settings. Callers pass only what differs from the defaults; new options never break old call sites.

## Core Rules

1. **Reach for functional options at 3+ optional parameters** or whenever the API will grow.
2. **The `options` struct is unexported.** Only the package owns its shape.
3. **The `Option` interface has an unexported `apply` method.** No external package can forge an option.
4. **Defaults go inside the constructor**, before options are applied.
5. **Required parameters stay positional;** only the optional ones go through `...Option`.
6. **Prefer the interface form over closures** — it composes better with testing, debugging, and `fmt.Stringer`.

## When to Use What

| Situation | Pattern |
|---|---|
| 0–2 optional params, stable API | Plain positional or named args |
| Config that callers usually pass whole | Config struct |
| 3+ optional params, growing API | **Functional options** |
| Mix of "must set together" + "rare overrides" | Config struct + small `Option` set |

> Read [references/options-vs-struct.md](references/options-vs-struct.md) when choosing between options and a plain config struct, or designing a hybrid.

## The Canonical Pattern

```go
package db

import "go.uber.org/zap"

// options is the package's private bag of settings.
type options struct {
    cache  bool
    logger *zap.Logger
}

// Option configures Open.
type Option interface {
    apply(*options)
}

// --- cacheOption -----------------------------------------------------------

type cacheOption bool

func (c cacheOption) apply(o *options) { o.cache = bool(c) }

// WithCache enables or disables the in-memory cache.
func WithCache(enabled bool) Option { return cacheOption(enabled) }

// --- loggerOption ----------------------------------------------------------

type loggerOption struct{ log *zap.Logger }

func (l loggerOption) apply(o *options) { o.logger = l.log }

// WithLogger sets the logger used by the connection.
func WithLogger(log *zap.Logger) Option { return loggerOption{log: log} }

// --- constructor -----------------------------------------------------------

// Open dials addr using the given options.
func Open(addr string, opts ...Option) (*Connection, error) {
    o := options{
        cache:  true,
        logger: zap.NewNop(),
    }
    for _, opt := range opts {
        opt.apply(&o)
    }
    // ... build the connection from o
    return &Connection{}, nil
}
```

### Caller Experience

```go
db.Open(addr)
db.Open(addr, db.WithLogger(log))
db.Open(addr, db.WithCache(false), db.WithLogger(log))
```

Compare to the alternative where all defaults must be repeated:

```go
db.Open(addr, db.DefaultCache, zap.NewNop()) // tedious
```

## Why an Interface, Not a Closure?

```go
// The closure variant — discouraged
type Option func(*options)
```

The interface form wins on:

1. **Testability** — option values can be compared in tests.
2. **Debuggability** — option types can implement `fmt.Stringer`.
3. **Documentation** — `godoc` lists each option type explicitly.
4. **Extensibility** — options can implement additional interfaces (e.g., `Validate()`).

Closures are shorter to write; they pay for that shortness in introspection.

## Defaults

Set defaults *before* applying options. A constructor that ignores its defaults is a bug magnet:

```go
o := options{
    cache:  true,
    logger: zap.NewNop(),
}
for _, opt := range opts {
    opt.apply(&o)
}
```

If a default needs computation (a temp dir, a process-wide ID), build it once during the constructor — not at package init.

## Quick Reference

```go
// 1. Unexported settings bag
type options struct { ... }

// 2. Exported interface, unexported method
type Option interface { apply(*options) }

// 3. One option type per setting
type widgetOption Widget
func (w widgetOption) apply(o *options) { o.widget = Widget(w) }
func WithWidget(w Widget) Option         { return widgetOption(w) }

// 4. Constructor: defaults, then apply
func New(required string, opts ...Option) (*Thing, error) {
    o := options{ /* defaults */ }
    for _, opt := range opts { opt.apply(&o) }
    return build(required, o)
}
```

## Anti-Patterns

| Anti-pattern | Why it hurts | Do this instead |
|---|---|---|
| Exporting the `options` struct | External code mutates internals | Keep it unexported |
| `Option` with an **exported** `Apply` | Anyone can build an option | Unexported `apply` method |
| Applying options before defaults | Defaults overwrite caller intent | Defaults first, then `apply` |
| `func Option(*options)` closures | Opaque in tests/logs | Interface form |
| 7+ positional required params | Caller error-prone | Promote them into a config or options |
| Mixing required and optional through `...Option` | Required is no longer required | Keep required positional |

## Verification Checklist

- [ ] `options` is unexported
- [ ] `Option` interface has an unexported `apply(*options)` method
- [ ] Each setting has a `With*` constructor returning `Option`
- [ ] Constructor sets defaults first, then applies options
- [ ] Required parameters are not hidden behind `...Option`
- [ ] No exported `Apply` or `Option func(*options)` slipped in
- [ ] Doc comments explain each `With*` and its default

## References

- [references/options-vs-struct.md](references/options-vs-struct.md) — when to prefer a config struct, and how to combine the two
