# Layer 3 — Repository

The Repository layer is the concrete data adapter. It implements interfaces defined in the domain, using whatever driver is appropriate (`database/sql`, `sqlx`, `pgx`, an HTTP API, an in-memory map for tests). The repository translates between driver errors and domain errors so the usecase stays driver-ignorant.

## Anatomy

```go
// internal/repository/order_postgres.go
package repository

import (
    "context"
    "database/sql"
    "errors"
    "fmt"

    "github.com/acme/myapp/internal/domain"
)

type postgresOrderRepo struct {
    db *sql.DB
}

// Constructor returns the domain interface.
func NewOrderRepository(db *sql.DB) domain.OrderRepository {
    return &postgresOrderRepo{db: db}
}
```

The struct is unexported. The constructor returns `domain.OrderRepository`. The package imports the domain (for the interface and entity types) and the driver — nothing else.

## Reads

```go
func (r *postgresOrderRepo) Get(ctx context.Context, id string) (*domain.Order, error) {
    var o domain.Order
    err := r.db.QueryRowContext(ctx, `
        SELECT id, customer_id, status, total_amount, total_currency, placed_at
        FROM orders WHERE id = $1
    `, id).Scan(&o.ID, &o.CustomerID, &o.Status, &o.Total.Amount, &o.Total.Currency, &o.PlacedAt)

    switch {
    case errors.Is(err, sql.ErrNoRows):
        return nil, fmt.Errorf("order %s: %w", id, domain.ErrNotFound)
    case err != nil:
        return nil, fmt.Errorf("query order %s: %w", id, err)
    }
    return &o, nil
}
```

Key move: `sql.ErrNoRows` becomes `domain.ErrNotFound`. The usecase calls `errors.Is(err, domain.ErrNotFound)` without knowing what database was queried.

## Writes

```go
func (r *postgresOrderRepo) Insert(ctx context.Context, o *domain.Order) error {
    _, err := r.db.ExecContext(ctx, `
        INSERT INTO orders (id, customer_id, status, total_amount, total_currency, placed_at)
        VALUES ($1, $2, $3, $4, $5, $6)
    `, o.ID, o.CustomerID, o.Status, o.Total.Amount, o.Total.Currency, o.PlacedAt)

    if err != nil {
        var pgErr *pgconn.PgError
        if errors.As(err, &pgErr) && pgErr.Code == "23505" { // unique_violation
            return fmt.Errorf("insert order: %w", domain.ErrAlreadyExists)
        }
        return fmt.Errorf("insert order: %w", err)
    }
    return nil
}
```

Driver-specific error codes are mapped to domain errors at the repository boundary. The usecase never imports `pgconn`.

## Lists, Pagination

```go
func (r *postgresOrderRepo) ListByCustomer(ctx context.Context, customerID string, limit int, after string) ([]*domain.Order, error) {
    rows, err := r.db.QueryContext(ctx, `
        SELECT id, customer_id, status, total_amount, total_currency, placed_at
        FROM orders
        WHERE customer_id = $1 AND ($2 = '' OR id > $2)
        ORDER BY id
        LIMIT $3
    `, customerID, after, limit)
    if err != nil {
        return nil, fmt.Errorf("list orders: %w", err)
    }
    defer rows.Close()

    var out []*domain.Order
    for rows.Next() {
        var o domain.Order
        if err := rows.Scan(&o.ID, &o.CustomerID, &o.Status, &o.Total.Amount, &o.Total.Currency, &o.PlacedAt); err != nil {
            return nil, fmt.Errorf("scan order: %w", err)
        }
        out = append(out, &o)
    }
    if err := rows.Err(); err != nil {
        return nil, fmt.Errorf("iterate orders: %w", err)
    }
    return out, nil
}
```

All three error checks (`Query`, `Scan`, `rows.Err()`) are required. Missing the third silently truncates results. See the go-database skill for more.

## Transactions: the UnitOfWork Pattern

The usecase calls `uow.Do(ctx, fn)`; the implementation stashes a `*sql.Tx` in `ctx`; repository methods unwrap it.

```go
// internal/repository/uow.go
package repository

type txKey struct{}

type uow struct{ db *sql.DB }

func NewUnitOfWork(db *sql.DB) domain.UnitOfWork { return &uow{db: db} }

func (u *uow) Do(ctx context.Context, fn func(ctx context.Context) error) error {
    tx, err := u.db.BeginTx(ctx, nil)
    if err != nil { return err }
    defer func() {
        if p := recover(); p != nil { _ = tx.Rollback(); panic(p) }
    }()
    if err := fn(context.WithValue(ctx, txKey{}, tx)); err != nil {
        _ = tx.Rollback()
        return err
    }
    return tx.Commit()
}

// helper used by every repository method
func dbtx(ctx context.Context, db *sql.DB) interface {
    QueryRowContext(context.Context, string, ...any) *sql.Row
    QueryContext(context.Context, string, ...any) (*sql.Rows, error)
    ExecContext(context.Context, string, ...any) (sql.Result, error)
} {
    if tx, ok := ctx.Value(txKey{}).(*sql.Tx); ok {
        return tx
    }
    return db
}
```

Each repository method calls `dbtx(ctx, r.db).QueryRowContext(...)` — same query path, transactional when wrapped, autocommit when not.

## In-Memory Repository (for tests)

```go
// internal/repository/order_memory.go
type memOrderRepo struct {
    mu     sync.Mutex
    orders map[string]*domain.Order
}

func NewInMemoryOrderRepository() domain.OrderRepository {
    return &memOrderRepo{orders: map[string]*domain.Order{}}
}
```

Implement the same interface and the usecase tests can run without a database container. Production runs the postgres implementation; tests run the memory one. Both share the interface.

## What Does NOT Belong Here

- Business rules ("an order with status canceled cannot be updated" — that's usecase).
- HTTP types — the repository doesn't know how the request arrived.
- Logging at every method — log once at the boundary; if needed for diagnostics, structured logging with span correlation (go-observability skill).

## Multiple Backends per Domain Interface

`domain.UserRepository` may have:

- `postgresUserRepo` (production)
- `memUserRepo` (unit tests)
- `cachedUserRepo` (decorator wrapping postgres with an in-memory cache)
- `httpUserRepo` (when the user data lives in another service)

All are constructible via `NewUserRepository(...)` returning the interface. The choice is made in `main.go`.

## Tips

- One file per entity (`order_postgres.go`, `customer_postgres.go`) — never a giant `repository.go`.
- Keep SQL inline with the method that uses it. Looking up a query 200 lines away in a `queries.sql` is fine with sqlc; outside of sqlc, inline reads better.
- Always `defer rows.Close()` immediately after `QueryContext`.
- Wrap driver errors at the boundary; never leak them upward as-is.
