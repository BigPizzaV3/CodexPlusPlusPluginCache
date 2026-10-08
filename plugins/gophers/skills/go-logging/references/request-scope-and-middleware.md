# Request-Scoped Logging and Middleware

A request log line without a request ID is half-useful. This reference covers how to attach request-scoped fields once and have every downstream log call inherit them.

## Storing a logger in context

Define an unexported key type and helpers in your logging package:

```go
package applog

import (
    "context"
    "log/slog"
)

type ctxKey struct{}

func With(ctx context.Context, l *slog.Logger) context.Context {
    return context.WithValue(ctx, ctxKey{}, l)
}

func From(ctx context.Context) *slog.Logger {
    if l, ok := ctx.Value(ctxKey{}).(*slog.Logger); ok {
        return l
    }
    return slog.Default()
}
```

Downstream callers use `applog.From(ctx).Info(...)` — they never construct a logger themselves.

## HTTP middleware

```go
func RequestLogger(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        id := r.Header.Get("X-Request-Id")
        if id == "" {
            id = newRequestID()
        }
        log := slog.With(
            "request_id", id,
            "method", r.Method,
            "path", r.URL.Path,
        )
        ctx := applog.With(r.Context(), log)
        next.ServeHTTP(w, r.WithContext(ctx))
    })
}
```

Now every `applog.From(ctx).Info("step done")` inside the request carries `request_id`, `method`, and `path` without the call site touching them.

## Adding fields mid-request

Use `slog.With` to derive a richer logger and store it back in the context:

```go
func withUser(ctx context.Context, u *User) context.Context {
    log := applog.From(ctx).With("user_id", u.ID, "user_tier", u.Tier)
    return applog.With(ctx, log)
}
```

Downstream calls now include `user_id` and `user_tier` too. The original logger is unchanged — `slog.With` returns a new instance.

## When to pass logger explicitly

Storing the logger in context is convenient, but explicit parameters are often clearer:

```go
func process(ctx context.Context, log *slog.Logger, j Job) error { ... }
```

Rules of thumb:

- **HTTP / RPC handler entry point:** store in context, read back at lower layers. The middleware sets up; everyone else reads.
- **Library code:** take a `*slog.Logger` parameter or read from context. Document which.
- **One-off helpers:** `slog.Default()` is fine.

Avoid global mutable loggers (`applog.SetDefault(...)`) after process startup. Concurrent reconfiguration is a footgun.

## Correlation IDs

Inject the request ID into the response headers so the caller can attach it to their bug report:

```go
w.Header().Set("X-Request-Id", id)
```

If the service participates in distributed tracing, the trace ID supersedes the request ID — but until you have tracing, a stable request ID is the next best thing.

## Logging outgoing calls

When the handler calls another service, pass the request ID forward:

```go
req, _ := http.NewRequestWithContext(ctx, "POST", url, body)
req.Header.Set("X-Request-Id", applog.From(ctx).Handler().(yourHandler).RequestID())
```

A simpler approach is to keep the request ID in the context with its own key and read it in the outbound middleware. This avoids reaching through the logger.

## Background jobs

Job runners do the equivalent of middleware:

```go
func runJob(ctx context.Context, j Job) error {
    log := slog.With("job_id", j.ID, "job_type", j.Type)
    ctx = applog.With(ctx, log)
    defer func(start time.Time) {
        log.InfoContext(ctx, "job done", "elapsed", time.Since(start))
    }(time.Now())
    return j.Run(ctx)
}
```

Same shape as HTTP middleware: derive once, store, defer the completion log.

## Anti-patterns

| Anti-pattern | Fix |
|---|---|
| New logger per log call inside a request | Derive once in middleware; pass via context |
| Mutating `slog.Default()` mid-request | Use `slog.With` to derive a request-scoped logger |
| Forgetting `*Context` variants downstream | Always use `InfoContext`/`ErrorContext` when a `ctx` is in scope |
| Stuffing arbitrary objects into the logger via `With(obj)` | Pass typed attrs; objects may not implement `LogValuer` |
| Reading the request ID from a global | Read from context; that is its scope |
