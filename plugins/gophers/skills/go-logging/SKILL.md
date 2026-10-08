---
name: go-logging
description: "Use when choosing a Go logger, configuring slog, writing structured log statements, picking log levels, or attaching request-scoped fields. Apply proactively whenever code calls log/fmt to emit operational information, migrates off log/logrus/zap/zerolog, or sets up production logging. Covers structured logging only — metrics, traces, profiling, and RUM belong to a separate observability skill."
license: MIT
compatibility: "Designed for Claude Code or similar AI coding agents. Requires Go 1.21+ for log/slog. Go 1.26 slog.NewMultiHandler is noted where relevant."
allowed-tools: Read Edit Write Glob Grep Bash(go:*) Bash(golangci-lint:*)
---

# Go Logging

Logs are written for **operators** — the human who will be paged at 3 a.m. and needs to know what happened. Every log line either helps diagnose a production issue or it is noise. `log/slog` from the standard library is the default; reach for anything else only after measuring.

> This skill covers **logging only**. Metrics, distributed tracing, profiling, and RUM are a separate concern — they belong to a future `go-observability` skill. Do not confuse them with logging here.

## Core Rules

1. **Use `log/slog`** for new code. Structured, leveled, in the standard library since Go 1.21.
2. **Static message, structured fields.** The message describes what happened; data goes in key-value attributes.
3. **Log or return, never both.** Logging a wrapped error makes the same failure appear at every layer.
4. **Log at the boundary.** HTTP handlers, job runners, and `main` log. Library code wraps and returns.
5. **Use snake_case keys** consistently across the codebase (`user_id`, `request_id`, `elapsed_ms`).
6. **`slog.Error` always carries an `"err"` attribute.** Without it, you logged a sentence, not an error.
7. **Never log secrets, PII, or unbounded data.** Tokens, full credit cards, request bodies — none of it.

## Choosing a Logger

| Situation | Use |
|---|---|
| New production service | `log/slog` |
| Trivial CLI / one-off script | `log` (the standard package) |
| Measured hot-path bottleneck where slog dominates the flame graph | `zap` or `zerolog`, but keep the structured style |
| Existing zap/logrus/zerolog code | Migrate to `slog` with a bridge handler; see [references/slog-handler-ecosystem.md](references/slog-handler-ecosystem.md) |

`slog`'s API is stable, the ecosystem has consolidated around it, and JSON output works with every log shipper. Do not introduce a third-party logger without a benchmark showing the win.

## Structured Logging

Build log messages from a **static message** plus typed fields:

```go
// Good — static message, structured fields
slog.Info("order placed", "order_id", orderID, "total_cents", totalCents)

// Bad — dynamic data baked into the message string
slog.Info(fmt.Sprintf("order %d placed for $%.2f", orderID, total))
```

The aggregator (Loki, Elastic, CloudWatch) can index `order_id`. It cannot index a sprintf'd sentence.

For hot paths, typed constructors avoid allocations:

```go
slog.LogAttrs(ctx, slog.LevelInfo, "request handled",
    slog.String("method", r.Method),
    slog.Int("status", code),
    slog.Duration("elapsed", elapsed),
)
```

## Log Levels

| Level | When | Default |
|---|---|---|
| `Debug` | Developer-only diagnostics; tracing internal state | Disabled in prod |
| `Info` | Notable lifecycle events: startup, shutdown, config loaded | Enabled |
| `Warn` | Unexpected but recoverable: retry succeeded, deprecated flag used | Enabled |
| `Error` | Operation failed; someone should look | Enabled |

Rules of thumb:

- If nobody should act on it, it is not `Error` — use `Warn` or `Info`.
- If it is only useful with a debugger attached, it is `Debug`.
- `slog.Error` must include an `"err"` attribute.

```go
slog.Error("payment failed", "err", err, "order_id", id)
slog.Warn("retry succeeded", "attempt", n, "endpoint", url)
slog.Info("server started", "addr", addr)
slog.Debug("cache lookup", "key", key, "hit", hit)
```

> Read [references/levels-and-context.md](references/levels-and-context.md) when choosing between `Warn` and `Error`, defining custom verbosity levels, or pre-checking `Enabled()` on hot paths.

## Request-Scoped Logging

Derive a logger per request that carries the fields every downstream call should include:

```go
func middleware(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        log := slog.With("request_id", requestID(r))
        ctx := context.WithValue(r.Context(), loggerKey{}, log)
        next.ServeHTTP(w, r.WithContext(ctx))
    })
}

func FromContext(ctx context.Context) *slog.Logger {
    if l, ok := ctx.Value(loggerKey{}).(*slog.Logger); ok { return l }
    return slog.Default()
}
```

Use the `Context`-aware variants (`slog.InfoContext`, `slog.ErrorContext`) so handlers that read trace IDs from the context can stamp them into the record:

```go
slog.InfoContext(ctx, "order placed", "order_id", id)
```

> Read [references/request-scope-and-middleware.md](references/request-scope-and-middleware.md) when wiring request IDs, building logging middleware, or choosing between context-stored loggers and explicit parameters.

## Log or Return — Not Both

Logging an error and then returning it produces the same failure at every layer, and three log records for one bug:

```go
// Bad — every caller up the stack logs it again
if err != nil {
    slog.Error("query failed", "err", err)
    return fmt.Errorf("query: %w", err)
}

// Good — wrap and return; the boundary logs once
if err != nil {
    return fmt.Errorf("loading user %d: %w", id, err)
}
```

The **only** layer that logs is the one that finishes the work: the HTTP handler, the job runner, `main`. That layer may log a detailed record server-side while returning a sanitised message to the client:

```go
if err := checkout(ctx); err != nil {
    slog.ErrorContext(ctx, "checkout failed", "err", err, "user_id", uid)
    http.Error(w, "internal error", http.StatusInternalServerError)
    return
}
```

See the `go-error-handling` skill for the full handle-once pattern.

## What Not to Log

- Passwords, API keys, tokens, session IDs.
- Full credit card numbers, SSNs, government IDs.
- Request or response bodies that may contain user data.
- Whole slices or maps of unbounded size (log lengths instead).
- Anything you would not want appearing in a customer support screenshot.

Use a redacting `slog.Handler` (or wrap your own) so sensitive keys are blanked at the handler level, not at every call site. See [references/slog-handler-ecosystem.md](references/slog-handler-ecosystem.md).

## Anti-Patterns

| Anti-pattern | Why it hurts | Do this instead |
|---|---|---|
| `log.Printf("msg %v", v)` | Unstructured; impossible to index | `slog.Info("msg", "key", v)` |
| `fmt.Sprintf` inside the message | Data is now part of the string | Static message + key/value attrs |
| Logging and returning the same error | Duplicate log records, noisy alerts | Wrap and return; log at the boundary |
| `slog.Info("err: %v", err)` | Drops level semantics and structure | `slog.Error("op failed", "err", err)` |
| New logger per call | Loses request-scoped fields | Derive once in middleware, pass via context |
| Mixed key styles (`userId`, `user_id`, `UserID`) | Aggregators index them as different fields | Pick `snake_case` and stick to it |
| Logging the whole request body | Leaks PII; explodes log volume | Log lengths and content type only |
| Introducing zap/zerolog without a benchmark | Extra dependency for no measured win | Stay on `slog`; benchmark before switching |

## Verification Checklist

Before finishing a logging change:

- [ ] All new log calls use `log/slog`, not `log.Printf`
- [ ] Each call has a static message and key-value attributes
- [ ] `slog.Error` calls carry an `"err"` attribute
- [ ] No call both logs and returns the same error
- [ ] Keys use `snake_case` and match existing keys in the codebase
- [ ] Handlers use `*Context` variants so trace correlation works
- [ ] No secrets, PII, or unbounded values appear in attribute values
- [ ] Request-scoped fields are added in middleware, not at each call site

## References

- [references/levels-and-context.md](references/levels-and-context.md) — picking levels, `Enabled()` gating, custom verbosity
- [references/request-scope-and-middleware.md](references/request-scope-and-middleware.md) — request IDs, context-stored loggers, HTTP middleware
- [references/slog-handler-ecosystem.md](references/slog-handler-ecosystem.md) — JSON/text handlers, multi-handler, bridges from zap/logrus/zerolog, redaction
