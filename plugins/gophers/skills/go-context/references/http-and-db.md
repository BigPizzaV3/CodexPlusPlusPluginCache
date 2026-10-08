# Context in HTTP Handlers, Clients, and Databases

The Go standard library is consistent: any I/O that can block has a `*Context` variant. Always use those — never the legacy non-context API in code that runs inside a request.

## HTTP Handlers

`*http.Request` carries the request's context. It is cancelled when the client disconnects or the server timeout fires.

```go
func handleOrder(w http.ResponseWriter, r *http.Request) {
    ctx := r.Context()
    order, err := svc.Get(ctx, mux.Vars(r)["id"])
    if err != nil {
        // ctx may be cancelled; reply only if not done
        http.Error(w, err.Error(), 500)
        return
    }
    _ = json.NewEncoder(w).Encode(order)
}
```

Middleware can attach values (request ID, principal) by replacing the request:

```go
func WithRequestID(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        ctx := WithReqID(r.Context(), uuid.NewString())
        next.ServeHTTP(w, r.WithContext(ctx))
    })
}
```

## HTTP Clients

Always use `http.NewRequestWithContext`. The legacy `http.NewRequest` produces a request with no context, and the resulting call cannot be cancelled cleanly.

```go
ctx, cancel := context.WithTimeout(ctx, 3*time.Second)
defer cancel()

req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
if err != nil {
    return nil, err
}
resp, err := http.DefaultClient.Do(req)
```

On cancellation, the HTTP transport closes the connection and `Do` returns an error that wraps `context.Canceled` or `context.DeadlineExceeded`.

### Retries

Retries should observe `ctx` between attempts:

```go
for attempt := 0; attempt < maxAttempts; attempt++ {
    if err := ctx.Err(); err != nil {
        return err // parent gave up, do not retry
    }
    if resp, err := doOnce(ctx); err == nil {
        return resp
    }
    select {
    case <-ctx.Done():
        return ctx.Err()
    case <-time.After(backoff(attempt)):
    }
}
```

## Database Operations

`database/sql` exposes `QueryContext`, `ExecContext`, `BeginTx`, `PingContext`. Use them everywhere. The driver will cancel the in-flight query when `ctx` is done.

```go
rows, err := db.QueryContext(ctx, "SELECT id, name FROM users WHERE tenant = $1", t)
if err != nil {
    return nil, fmt.Errorf("loading users: %w", err)
}
defer rows.Close()
```

For transactions:

```go
tx, err := db.BeginTx(ctx, nil)
if err != nil {
    return err
}
defer tx.Rollback() // safe even after Commit

if _, err := tx.ExecContext(ctx, insertSQL, ...); err != nil {
    return err
}
return tx.Commit()
```

A cancelled `ctx` rolls back the transaction at the driver level.

## gRPC

gRPC client and server stubs already take `ctx` as the first argument. The metadata package extracts values for tracing and auth:

```go
md, _ := metadata.FromIncomingContext(ctx)
authz := md.Get("authorization")
```

Outbound calls inherit the inbound `ctx` automatically.

## Anti-Patterns

- `http.Get(url)` inside a handler — no context, cannot be cancelled.
- `db.Query` instead of `db.QueryContext` — same.
- `r.Context()` ignored, building a new `context.Background()` for downstream calls — defeats request cancellation.
- Caching `r.Context()` past the request lifetime — it is dead the moment the handler returns.
