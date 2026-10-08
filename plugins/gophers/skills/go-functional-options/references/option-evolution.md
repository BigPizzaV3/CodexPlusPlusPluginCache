# Evolving an Option API

Once `Option` ships, you live with it forever. Plan for change.

## Adding a New Option

Adding a new setting is the easy case: add a field to `options`, write the option type and `With*` constructor. Existing callers are unaffected.

```go
type options struct {
    cache   bool
    logger  *zap.Logger
    metrics MetricsSink // new
}

type metricsOption struct{ m MetricsSink }
func (mo metricsOption) apply(o *options) { o.metrics = mo.m }
func WithMetrics(m MetricsSink) Option   { return metricsOption{m: m} }
```

## Deprecating an Option

Mark the constructor `Deprecated:` in its doc comment and forward its behavior to the replacement:

```go
// Deprecated: use WithLogger; WithLog will be removed in v2.
func WithLog(l Logger) Option { return WithLogger(adaptLogger(l)) }
```

Keep the old `With*` constructor; do not change its signature.

## Option Validation

Option application is a great place to validate, but errors must travel back to the caller. Two common shapes:

### Validate in the constructor

```go
func Open(addr string, opts ...Option) (*Connection, error) {
    o := options{ /* defaults */ }
    for _, opt := range opts {
        opt.apply(&o)
    }
    if o.timeout < 0 {
        return nil, fmt.Errorf("negative timeout %v", o.timeout)
    }
    ...
}
```

### Apply that returns an error

```go
type Option interface {
    apply(*options) error
}
```

Use the error variant when individual options can be invalid in isolation (e.g., parsing a URL). The plain signature is enough in most cases.

## Conditional Options

```go
opts := []db.Option{db.WithLogger(log)}
if cfg.Cache {
    opts = append(opts, db.WithCache(true))
}
conn, err := db.Open(addr, opts...)
```

Callers build the slice; you do not need to design "conditional options" inside the package.

## Variant: Builder

Some APIs surface a builder for chains of options:

```go
b := db.NewBuilder(addr).WithLogger(log).WithCache(true)
conn, err := b.Open()
```

Builders trade a tiny ergonomic win for double the surface area. Prefer plain functional options unless you have a compelling reason.

## Forward Compatibility

A package that exports `type Option interface { apply(*options) }` may safely:

- Add methods to `Option` only if they are unexported (won't break implementers — there are none, by design).
- Add fields to `options`.
- Add new `With*` constructors.

It may **not**:

- Change the signature of an existing `With*`.
- Change defaults silently (announce major-version bumps).
- Export the `apply` method.
