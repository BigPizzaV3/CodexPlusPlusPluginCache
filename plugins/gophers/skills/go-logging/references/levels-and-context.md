# Levels, Enabled gating, and Context

Log levels exist to tell operators what they should care about. Pick them by audience, not by how dramatic the event feels.

## Picking a level

Decision flow:

1. Would an operator act on this? If no, it is at most `Info`.
2. Is the system in a degraded state? `Warn`.
3. Has work failed and someone should look? `Error`.
4. Is this only useful with a debugger attached? `Debug`.

```go
slog.Debug("cache lookup", "key", k, "hit", hit)         // dev only
slog.Info("server started", "addr", addr)                 // lifecycle
slog.Warn("circuit breaker tripped", "endpoint", url)     // degraded
slog.Error("payment failed", "err", err, "order_id", id)  // act now
```

`Warn` is the most abused level. A typical mistake is using `Warn` for "something happened that I noticed" — but if nothing is wrong, that is `Info`. Reserve `Warn` for "the system is still working but worse than usual".

## Production defaults

| Environment | Default level |
|---|---|
| Local dev | `Debug` |
| CI | `Info` |
| Staging | `Info` (sometimes `Debug` for a service under investigation) |
| Production | `Info` |

`Error` should be rare enough that every record matters. If `Error` floods, alerts are useless.

## Enabled gating on hot paths

`slog` evaluates attribute values eagerly. Computing an expensive attribute for a record that will be discarded is waste. Gate with `Enabled`:

```go
if slog.Default().Enabled(ctx, slog.LevelDebug) {
    slog.DebugContext(ctx, "snapshot", "state", expensiveSnapshot())
}
```

For one-or-two-attribute records, the overhead is negligible — do not bother. Reserve `Enabled` for hot loops and records with heavy attributes (proto dumps, JSON marshalling).

## Custom verbosity

`slog` supports arbitrary integer levels via `slog.Level`. A common pattern is `Trace` (below `Debug`) for very chatty diagnostics:

```go
const LevelTrace = slog.Level(-8)

slog.SetDefault(slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
    Level: LevelTrace,
})))

slog.Log(ctx, LevelTrace, "fine-grained event", "step", n)
```

Avoid more than 4–5 levels in total — operators cannot keep more in their heads. If you need that much granularity, use a separate logger or a dedicated channel (e.g., a `debug` build tag).

## Context-aware calls

Always prefer the `*Context` variants when a `ctx` is available:

```go
slog.InfoContext(ctx, "order placed", "order_id", id)
slog.ErrorContext(ctx, "query failed", "err", err)
```

The handler can read values out of `ctx` (e.g., trace IDs, request IDs) and stamp them into the record automatically. Without `*Context`, the handler sees `context.Background()` and the correlation breaks.

## When to use `slog.LogAttrs`

For hot paths, `slog.LogAttrs` avoids the variadic-to-`[]any` conversion and uses typed constructors:

```go
slog.LogAttrs(ctx, slog.LevelInfo, "request handled",
    slog.String("method", r.Method),
    slog.Int("status", code),
    slog.Duration("elapsed", elapsed),
)
```

The performance difference is small but real, and the typed constructors make it harder to pair a key with the wrong type by accident.

## Sampling

For high-volume `Info` records (one per HTTP request on a busy service), consider a sampling handler that drops 9 out of 10 records once the rate exceeds a threshold. This is a handler concern, not something you do at the call site. See [slog-handler-ecosystem.md](slog-handler-ecosystem.md).

## Anti-patterns

| Anti-pattern | Fix |
|---|---|
| Using `Warn` for "I noticed this" | Use `Info`; reserve `Warn` for degradation |
| Using `Error` for expected validation failures | Validation is an `Info`; return a 4xx to the client |
| Computing expensive attributes without `Enabled` gating | Gate or simplify the attribute |
| Calling `slog.Info` without the `*Context` variant on a request path | Use `InfoContext`; trace IDs depend on it |
| Inventing 10 custom levels | Stick to the four standard ones plus at most one `Trace` |
