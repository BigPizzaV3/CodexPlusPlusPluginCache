# Layer 1 — Domain

The Domain layer is the innermost: pure Go types describing *what the system does*, never *how*. It owns the entities, the value objects, the repository interfaces, and the sentinel errors. It imports nothing outside the standard library.

## What lives here

- **Entities** — structs that represent identifiable business objects (`User`, `Order`).
- **Value objects** — immutable types with no identity (`Money`, `Email`).
- **Repository interfaces** — the contract a data layer must satisfy.
- **Service interfaces** — the contract a usecase must satisfy.
- **Input DTOs** — value-only inputs to usecase methods (`CreateUserInput`).
- **Domain errors** — sentinel errors and typed errors carrying business meaning.

## Entities

```go
// internal/domain/order.go
package domain

import "time"

type OrderStatus string

const (
    OrderStatusPending  OrderStatus = "pending"
    OrderStatusPaid     OrderStatus = "paid"
    OrderStatusShipped  OrderStatus = "shipped"
    OrderStatusCanceled OrderStatus = "canceled"
)

type Order struct {
    ID         string
    CustomerID string
    Status     OrderStatus
    Total      Money
    PlacedAt   time.Time
}
```

Notes:

- Public fields. Domain entities are data; behavior belongs in usecase methods, not on the entity.
- Custom string types like `OrderStatus` prevent accidental "pending" vs "Pending" mismatches.
- No `json:"..."` tags — JSON serialization is a delivery concern. (If you need shared tags for storage, it's a sign DB models should be separate.)

## Value Objects

```go
type Money struct {
    Amount   int64  // smallest unit (cents)
    Currency string // ISO 4217
}

func NewMoney(amount int64, currency string) (Money, error) {
    if currency == "" {
        return Money{}, fmt.Errorf("currency required: %w", ErrValidation)
    }
    return Money{Amount: amount, Currency: currency}, nil
}
```

Value objects are immutable after construction. Validate at the constructor; once a `Money` exists, it is valid.

## Repository Interfaces

The repository interface lives in the **domain** package, not the repository package. This is the trick that keeps the dependency rule inward.

```go
package domain

type OrderRepository interface {
    Get(ctx context.Context, id string) (*Order, error)
    Insert(ctx context.Context, o *Order) error
    UpdateStatus(ctx context.Context, id string, status OrderStatus) error
    ListByCustomer(ctx context.Context, customerID string, limit int, after string) ([]*Order, error)
}
```

The concrete `postgresOrderRepo` in `internal/repository` *implements* this interface. The usecase depends on the interface; the wiring in `main.go` passes the concrete implementation.

## Service Interfaces

```go
package domain

type OrderService interface {
    Get(ctx context.Context, id string) (*Order, error)
    Place(ctx context.Context, in PlaceOrderInput) (*Order, error)
    Cancel(ctx context.Context, id string) error
}
```

The delivery layer depends on this interface, not on the concrete `*orderUsecase`. Why? Because it lets you mock the usecase in handler tests without standing up a repository.

## Input DTOs

```go
type PlaceOrderInput struct {
    CustomerID string
    Items      []OrderItem
    Coupon     string
}
```

Inputs are domain types — not framework types. The delivery layer constructs them from HTTP request bodies.

## Domain Errors

```go
// internal/domain/errors.go
package domain

import "errors"

var (
    ErrNotFound      = errors.New("not found")
    ErrAlreadyExists = errors.New("already exists")
    ErrValidation    = errors.New("validation failed")
    ErrForbidden     = errors.New("forbidden")
    ErrConflict      = errors.New("conflict")
)
```

The delivery layer maps these to HTTP status codes / gRPC codes / CLI exit codes. The domain layer does not know how the outside world reports errors.

For richer error data (field violations, retry hints), define typed errors:

```go
type ValidationError struct {
    Field string
    Rule  string
}

func (e *ValidationError) Error() string { return e.Field + ": " + e.Rule }
func (e *ValidationError) Unwrap() error { return ErrValidation } // so errors.Is(err, ErrValidation) works
```

## What does NOT live here

- HTTP types (`http.Request`, `*gin.Context`)
- SQL types (`*sql.DB`, `sqlx.Tx`)
- Logging types (`*slog.Logger` — pass it in if needed, but rare)
- Configuration (`config.Config`)
- Third-party domain models (`stripe.Charge`)

If you find yourself importing one of these from `internal/domain`, the layer boundary has been crossed.

## Enforcement

A `golangci-lint` `depguard` rule:

```yaml
linters-settings:
  depguard:
    rules:
      domain:
        files: ["**/internal/domain/**"]
        deny:
          - pkg: "net/http"
            desc: "domain must not import http"
          - pkg: "database/sql"
            desc: "domain must not import database/sql"
          - pkg: "github.com/gin-gonic/gin"
            desc: "domain must not import gin"
```

CI fails when the rule is violated. It is the cheapest defense against drift.
