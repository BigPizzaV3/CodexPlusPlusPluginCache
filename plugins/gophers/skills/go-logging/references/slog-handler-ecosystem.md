# slog Handler Ecosystem

`slog` separates the *call site* (`slog.Info(...)`) from the *handler* (what bytes appear where). Most production concerns — output format, filtering, redaction, fan-out, bridging — belong to a handler, not the call site.

## Built-in handlers

| Handler | Use |
|---|---|
| `slog.NewTextHandler(w, opts)` | Human-readable key=value; good for local dev |
| `slog.NewJSONHandler(w, opts)` | Production default; one JSON object per line |
| `slog.DiscardHandler` (Go 1.24+) | Tests where you want zero output |

```go
h := slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
    Level:     slog.LevelInfo,
    AddSource: false,    // file:line — useful in dev, expensive in prod
})
slog.SetDefault(slog.New(h))
```

Set `AddSource: true` only if your log shipper does not already capture file/line.

## Multi-handler (Go 1.26+)

`slog.NewMultiHandler` fans the same record out to multiple handlers without third-party code:

```go
logger := slog.New(slog.NewMultiHandler(
    slog.NewJSONHandler(os.Stdout, nil),
    auditHandler, // a custom handler writing to your audit sink
))
slog.SetDefault(logger)
```

Use this for "send everything to stdout *and* a side channel". Before Go 1.26, a third-party multi-handler (e.g., [`samber/slog-multi`](https://github.com/samber/slog-multi)) covers the gap.

## Bridges from legacy loggers

If the codebase still uses `zap`, `logrus`, or `zerolog`, route `slog` through the existing logger as a transition step. Once everything calls `slog`, swap in `slog.NewJSONHandler` and drop the bridge.

| Bridge | Sends slog records to |
|---|---|
| [`samber/slog-zap`](https://github.com/samber/slog-zap) | `zap.Logger` |
| [`samber/slog-logrus`](https://github.com/samber/slog-logrus) | `logrus.Logger` |
| [`samber/slog-zerolog`](https://github.com/samber/slog-zerolog) | `zerolog.Logger` |

Migration plan:

1. Pick the bridge for the existing logger. Set `slog.SetDefault` to write through it.
2. Replace `zap.L().Info(...)` / `logrus.Info(...)` calls with `slog.Info(...)`. Do this in chunks — every call you migrate keeps working through the bridge.
3. When the bridge is the only remaining user of the old logger, swap the handler to `slog.NewJSONHandler` and remove the bridge plus the legacy dependency.

## Useful third-party handlers

These belong to the ecosystem, not the standard library — opt in deliberately.

| Handler | What it does |
|---|---|
| [`samber/slog-formatter`](https://github.com/samber/slog-formatter) | Transform attribute values (truncate, mask, format times) |
| [`samber/slog-sampling`](https://github.com/samber/slog-sampling) | Drop a fraction of records above a rate threshold |
| [`samber/slog-loki`](https://github.com/samber/slog-loki), `slog-elastic`, `slog-datadog`, etc. | Direct sinks for log aggregators |
| [`otelslog`](https://pkg.go.dev/go.opentelemetry.io/contrib/bridges/otelslog) | Inject `trace_id` / `span_id` from the OTel context into every record |

`otelslog` is the only handler-side concern that touches the broader observability story; logs-with-trace-IDs are still logs.

## Redaction at the handler

Sensitive data should be redacted in **one place**, not at every call site. Wrap a handler with a `ReplaceAttr` function:

```go
opts := &slog.HandlerOptions{
    Level: slog.LevelInfo,
    ReplaceAttr: func(groups []string, a slog.Attr) slog.Attr {
        switch a.Key {
        case "password", "token", "authorization", "api_key":
            return slog.String(a.Key, "***")
        }
        return a
    },
}
slog.SetDefault(slog.New(slog.NewJSONHandler(os.Stdout, opts)))
```

This guarantees that even if a future call site accidentally logs `"password", pw`, the bytes never hit disk.

## Writing a custom handler

Implement the four-method `slog.Handler` interface:

```go
type Handler interface {
    Enabled(context.Context, slog.Level) bool
    Handle(context.Context, slog.Record) error
    WithAttrs(attrs []slog.Attr) Handler
    WithGroup(name string) Handler
}
```

Most custom handlers compose: they wrap an inner handler and modify records on the way through. Common shapes:

- **Sampler** — `Enabled` returns false for a fraction of records.
- **Enricher** — `Handle` reads from `ctx` (trace IDs, request IDs) and adds attributes before delegating.
- **Router** — `Handle` picks between sinks based on attrs (e.g., `audit=true` goes to S3, everything else to stdout).

Keep custom handlers small and testable. The standard JSON/text handlers should remain the workhorse.

## Anti-patterns

| Anti-pattern | Fix |
|---|---|
| Redacting at every call site | Push it into a `ReplaceAttr` once |
| One global handler stack with five middlewares hard-coded in init | Build the handler in `main`; pass it to `slog.New` |
| Custom handlers that write directly to network synchronously | Buffer or fan out to a goroutine; do not block log calls |
| Importing five `slog-*` packages "just in case" | Each one is a dependency; add when needed |
| Reaching into the handler from call sites to "configure it for this request" | Use `slog.With` to derive a request-scoped logger; let the handler stay generic |

## A note on scope

This skill is about logging. Metrics, distributed tracing, profiling, and product analytics are different signals with different tools (`prometheus/client_golang`, OpenTelemetry, `pprof`, etc.). They are useful — they are not logs, and they belong in a dedicated observability skill, not here.
