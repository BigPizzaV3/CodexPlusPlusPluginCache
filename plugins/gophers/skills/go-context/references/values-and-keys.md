# Context Values, Keys, and Tracing

Context values are a side-channel for request-scoped metadata that *must* cross many layers without being a real function parameter. Use them sparingly; abuse leads to "what's even in this ctx?" code.

## The Unexported Key Pattern

Strings are unsafe as keys — two packages can pick the same one. The canonical pattern is an unexported named type per key, plus typed setter/getter helpers.

```go
package authctx

type userIDKey struct{}

// WithUserID returns a child context tagged with id.
func WithUserID(ctx context.Context, id string) context.Context {
    return context.WithValue(ctx, userIDKey{}, id)
}

// UserIDFrom returns the user ID and whether one was set.
func UserIDFrom(ctx context.Context) (string, bool) {
    id, ok := ctx.Value(userIDKey{}).(string)
    return id, ok
}
```

Callers never see the key type. There is no way for another package to collide with `authctx.userIDKey{}`.

## When Context Values Are Appropriate

Good fits:

- Request IDs / correlation IDs flowing through every layer.
- Authenticated principal (user ID, tenant ID) for authorization decisions far from the handler.
- Trace span context (OpenTelemetry, Datadog) for child span creation.
- Per-request deadlines that influence downstream timeouts.

Bad fits:

- Optional function parameters — pass them explicitly.
- Configuration that does not vary per request — package-level variable or constructor argument.
- Database handles, loggers — inject via constructor or method receiver.
- Anything the caller would type-check at compile time if it were explicit.

## Trace Context Propagation

OpenTelemetry already uses `context.Context` to carry the active span. Always derive child contexts from the caller's — never start a new trace root inside a request.

```go
func (s *Service) Charge(ctx context.Context, amount int64) error {
    ctx, span := tracer.Start(ctx, "Service.Charge")
    defer span.End()
    // downstream calls inherit the span automatically
    return s.gateway.Submit(ctx, amount)
}
```

Across service boundaries, the OTel HTTP/gRPC propagators serialise span context into headers; on the receiving side they reconstruct the parent and re-attach to the new request's `ctx`.

## Marshaling Across Boundaries

`context.Context` is **not** serialisable on its own. When crossing process boundaries:

1. On the sending side, extract values you want to forward (request ID, trace headers) into transport metadata (HTTP headers, gRPC metadata, message attributes).
2. On the receiving side, parse them out and call your `With*` helpers to attach to the new `ctx`.

Never try to "send the context"; only its semantic contents.

## Anti-Patterns

- Using `string` keys (`ctx.Value("user")`) — collisions are silent.
- Putting a `*Logger` or `*DB` in context — these are dependencies, not request data.
- A `MustUserID(ctx)` that panics on missing values inside handlers — return an error or a fallback.
- Reading the same value out of `ctx` repeatedly in a hot loop — read once, pass the local.
