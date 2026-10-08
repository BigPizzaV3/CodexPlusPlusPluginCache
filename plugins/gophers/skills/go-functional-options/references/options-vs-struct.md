# Functional Options vs Config Struct

Both patterns express "this constructor takes some optional settings." Picking between them is a judgement about API longevity, caller ergonomics, and testability.

## Snapshot

| Aspect | Functional Options | Config Struct |
|---|---|---|
| Defaults | Inside constructor | Zero values + maybe `Default()` |
| Extensibility | Add a new `With*` (non-breaking) | Add a field (often non-breaking) |
| Caller experience | Pass only what differs | Build a whole value |
| Discovery | godoc shows each `With*` | One type, one comment |
| Testability | Options comparable as values | Struct comparable |
| Boilerplate | Higher | Lower |

## Prefer a Config Struct When

- The setting list is small (≤3) and unlikely to grow.
- Callers typically pass all fields together (e.g., loaded from YAML).
- The API is internal — boilerplate has lower payoff.
- The settings have inter-field validation easier to express in one place.

```go
type ServerConfig struct {
    Addr            string
    ReadTimeout     time.Duration
    WriteTimeout    time.Duration
    MaxHeaderBytes  int
}

func NewServer(cfg ServerConfig) *Server { ... }
```

## Prefer Functional Options When

- The list will grow over time.
- Most callers want the defaults and only override a few settings.
- Defaults are non-trivial (computed at construction time).
- You expect external packages to extend behavior.

## The Hybrid

For complex constructors, combine the two: a required `Config` for the "everyone sets these" fields plus `Option`s for the "rarely overridden" ones:

```go
func NewServer(cfg ServerConfig, opts ...Option) (*Server, error) { ... }
```

This avoids the long `With*` list for fundamental settings while keeping room for growth.

## Migration Path

You can move from a config struct to options without breaking callers by:

1. Keeping the `Config` parameter.
2. Adding a `...Option` parameter that overrides config values.
3. Eventually deprecating fields in `Config` in favor of options.

Going the other way (options → struct) is harder, so be deliberate when you pick.

## Smell Tests

- A `Config` with 12 optional fields, most defaulted, is asking to become functional options.
- A package with 30 `With*` constructors and only a handful ever used is asking to become a config struct.
- A constructor that takes both a `Config` *and* a `*Logger` *and* a `Clock` should consolidate into one or the other.
