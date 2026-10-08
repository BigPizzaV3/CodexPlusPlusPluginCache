# Layer 2 — Usecase

The Usecase layer is the application's business logic. It orchestrates entities and repositories to fulfill a single user-visible operation: "place an order", "cancel a subscription", "approve a request". It depends only on the domain — never on a framework, a driver, or a transport.

## Anatomy

```go
// internal/usecase/order_usecase.go
package usecase

import (
    "context"
    "fmt"
    "time"

    "github.com/google/uuid"
    "github.com/acme/myapp/internal/domain"
)

type orderUsecase struct {
    orders   domain.OrderRepository
    customers domain.CustomerRepository
    pricing  domain.PricingService
}

// Returns the interface — the concrete struct stays unexported.
func NewOrderUsecase(
    orders domain.OrderRepository,
    customers domain.CustomerRepository,
    pricing domain.PricingService,
) domain.OrderService {
    return &orderUsecase{orders: orders, customers: customers, pricing: pricing}
}
```

Four invariants:

1. The constructor takes domain interfaces.
2. The struct is unexported.
3. The constructor returns the domain interface.
4. No `*gin.Context`, no `*sql.DB`.

## A Typical Method

```go
func (u *orderUsecase) Place(ctx context.Context, in domain.PlaceOrderInput) (*domain.Order, error) {
    customer, err := u.customers.Get(ctx, in.CustomerID)
    if err != nil {
        return nil, fmt.Errorf("placing order: %w", err)
    }
    if !customer.Active {
        return nil, fmt.Errorf("placing order: %w", domain.ErrForbidden)
    }

    total, err := u.pricing.Total(ctx, in.Items, in.Coupon)
    if err != nil {
        return nil, fmt.Errorf("placing order: %w", err)
    }

    order := &domain.Order{
        ID:         uuid.NewString(),
        CustomerID: in.CustomerID,
        Status:     domain.OrderStatusPending,
        Total:      total,
        PlacedAt:   time.Now().UTC(),
    }
    if err := u.orders.Insert(ctx, order); err != nil {
        return nil, fmt.Errorf("placing order: %w", err)
    }
    return order, nil
}
```

The method reads like a paragraph of business prose. No HTTP status codes, no SQL — just the steps of placing an order.

## What Belongs Here

- Business rules ("a canceled order cannot be paid").
- Coordinating multiple repositories ("create user, then send welcome email").
- Authorization checks expressed in domain terms ("the customer must be active").
- Validation that spans multiple inputs (single-field validation can live in the delivery layer or as `domain.ValidationError`).

## What Does NOT Belong Here

- HTTP status code selection — that's delivery.
- SQL — that's repository.
- Logging — log at the request boundary, not inside the usecase (see go-error-handling and go-logging).
- Marshaling / unmarshaling JSON — that's delivery.

## Multiple Repositories, One Transaction

When two repository calls must succeed or fail together, the usecase needs transaction control without knowing about transactions.

Pattern: pass a `UnitOfWork` abstraction.

```go
// domain
type UnitOfWork interface {
    Do(ctx context.Context, fn func(ctx context.Context) error) error
}

// usecase
func (u *orderUsecase) Place(ctx context.Context, in domain.PlaceOrderInput) (*domain.Order, error) {
    var placed *domain.Order
    err := u.uow.Do(ctx, func(ctx context.Context) error {
        // Both repos use the SAME transaction, transparently.
        if err := u.orders.Insert(ctx, ...); err != nil { return err }
        if err := u.inventory.Reserve(ctx, ...); err != nil { return err }
        placed = ...
        return nil
    })
    return placed, err
}
```

The implementation in `internal/repository` stashes the `*sql.Tx` in `ctx` and the repositories read it; the usecase remains driver-ignorant.

## Testing

Usecase tests run without HTTP and without DB. Mock the repository interfaces.

```go
type fakeOrderRepo struct {
    orders map[string]*domain.Order
    insertErr error
}

func (f *fakeOrderRepo) Insert(ctx context.Context, o *domain.Order) error {
    if f.insertErr != nil { return f.insertErr }
    f.orders[o.ID] = o
    return nil
}
// ... implement the rest

func TestPlace_RejectsInactiveCustomer(t *testing.T) {
    repo := &fakeOrderRepo{orders: map[string]*domain.Order{}}
    customers := &fakeCustomerRepo{c: &domain.Customer{Active: false}}
    pricing := &fakePricing{total: domain.Money{Amount: 1000, Currency: "USD"}}

    uc := NewOrderUsecase(repo, customers, pricing)
    _, err := uc.Place(context.Background(), domain.PlaceOrderInput{CustomerID: "c1"})

    if !errors.Is(err, domain.ErrForbidden) {
        t.Fatalf("expected ErrForbidden, got %v", err)
    }
    if len(repo.orders) != 0 {
        t.Fatalf("repo should be untouched")
    }
}
```

Tests run in microseconds. You can run thousands of them on every save.

## Avoiding the "Anemic Usecase" Trap

```go
// Bad — pass-through with no value.
func (u *userUsecase) Get(ctx context.Context, id string) (*domain.User, error) {
    return u.repo.Get(ctx, id)
}
```

If the usecase adds no logic, the delivery layer could call the repository directly. Two answers:

1. **Keep it as a seam.** Even a one-line wrapper future-proofs against the day you add caching or authorization. Cheap insurance.
2. **Drop the usecase for pure CRUD endpoints.** Some teams skip the layer for read-only "/users/:id" handlers. Be consistent — either all endpoints go through a usecase or none do.

The wrong outcome is "half do, half don't, and we discover the inconsistency during an incident".

## Composing Usecases

A usecase can depend on another usecase if the business rule genuinely composes them. Express the dependency through interfaces:

```go
type OrderUsecase struct {
    orders domain.OrderRepository
    notify domain.NotificationService // interface, not concrete
}
```

`NotificationService` might be implemented by `*notificationUsecase` or by a side-effect adapter. Both work as long as the interface holds.
