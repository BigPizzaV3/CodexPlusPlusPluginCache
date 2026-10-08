# Integrative Example: A Small HTTP Server

The checklists work best together. This walk-through applies them to a tiny server so you can see what a clean shape looks like before reviewing your own.

## The Code

```go
// Package server runs the HTTP API for foo.
package server

import (
    "context"
    "encoding/json"
    "errors"
    "fmt"
    "log/slog"
    "net/http"
    "time"
)

// Config holds the server's startup options.
type Config struct {
    Addr            string
    ReadTimeout     time.Duration
    WriteTimeout    time.Duration
    ShutdownTimeout time.Duration
}

// Store is the persistence interface server depends on.
// It is defined here, on the consumer side, not in the storage package.
type Store interface {
    Get(ctx context.Context, id string) (User, error)
}

// User is the value returned by GET /users/:id.
type User struct {
    ID   string `json:"id"`
    Name string `json:"name"`
}

// ErrNotFound is returned by Store implementations when the user is missing.
var ErrNotFound = errors.New("user not found")

// Server serves the API.
type Server struct {
    cfg   Config
    store Store
    log   *slog.Logger
    now   func() time.Time
}

// New constructs a Server.
func New(cfg Config, store Store, log *slog.Logger) *Server {
    return &Server{
        cfg:   cfg,
        store: store,
        log:   log,
        now:   time.Now,
    }
}

// Run starts the server and blocks until ctx is cancelled.
func (s *Server) Run(ctx context.Context) error {
    mux := http.NewServeMux()
    mux.HandleFunc("GET /users/{id}", s.getUser)

    srv := &http.Server{
        Addr:         s.cfg.Addr,
        Handler:      mux,
        ReadTimeout:  s.cfg.ReadTimeout,
        WriteTimeout: s.cfg.WriteTimeout,
    }

    errCh := make(chan error, 1)
    go func() { errCh <- srv.ListenAndServe() }()

    select {
    case <-ctx.Done():
        shutCtx, cancel := context.WithTimeout(context.Background(), s.cfg.ShutdownTimeout)
        defer cancel()
        return srv.Shutdown(shutCtx)
    case err := <-errCh:
        if errors.Is(err, http.ErrServerClosed) {
            return nil
        }
        return fmt.Errorf("listen and serve: %w", err)
    }
}

func (s *Server) getUser(w http.ResponseWriter, r *http.Request) {
    id := r.PathValue("id")

    u, err := s.store.Get(r.Context(), id)
    if errors.Is(err, ErrNotFound) {
        http.Error(w, "not found", http.StatusNotFound)
        return
    }
    if err != nil {
        s.log.ErrorContext(r.Context(), "store get failed", "id", id, "err", err)
        http.Error(w, "internal error", http.StatusInternalServerError)
        return
    }

    w.Header().Set("Content-Type", "application/json")
    if err := json.NewEncoder(w).Encode(u); err != nil {
        s.log.ErrorContext(r.Context(), "encode failed", "err", err)
    }
}
```

## What the Checklists Caught (in a Good Way)

- **Package doc** sits next to the `package` clause.
- **Imports** are grouped (stdlib only here; would be `<blank line>` before external).
- **Interface (`Store`)** defined on the consumer side.
- **`error` sentinel** (`ErrNotFound`) is package-level, exported, with the `Err` prefix.
- **Constructor** (`New`) immediately follows the type definition.
- **`time.Now`** is injected via `s.now`, ready for tests to pin time.
- **Errors wrapped** with `%w` when leaving the function; `errors.Is(http.ErrServerClosed)` works.
- **Structured logging** with `slog`, key-value attributes, no secrets.
- **Context** is the first parameter on `Store.Get` and `Run`; not stored anywhere.
- **Shutdown** uses a separate context bounded by `ShutdownTimeout`; the original `ctx` may already be cancelled.

## What a Reviewer Might Still Ask

- **Should the encode error be returned to the caller via a panic recovery?** Probably not — by the time encoding fails, the response status is already 200.
- **Is `Store` the right name?** Fine; if there were a real "store" package with the implementation, you might rename the interface to be more specific to the consumer (`UserGetter`?).
- **Where are the tests?** Not shown here. A real review would scan `server_test.go` for table-driven cases against a fake `Store`.

## Anti-Patterns This Code Avoids

- No `init()`.
- No mutable package-level state.
- No `log.Fatal` outside `main`.
- No `panic`.
- No `interface{}` (would be `any`).
- No naked bool parameters.
