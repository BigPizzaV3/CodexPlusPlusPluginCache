# Layer 4 — Delivery

The Delivery layer adapts an external protocol (HTTP, gRPC, CLI, message queue) to the usecase. Handlers are thin: bind input, call usecase, format output. All framework-specific types (`*gin.Context`, `echo.Context`, `*fiber.Ctx`, `http.ResponseWriter`) live here and only here.

## Anatomy (HTTP / Gin)

```go
// internal/delivery/http/order_handler.go
package http

import (
    "errors"
    "net/http"
    "time"

    "github.com/gin-gonic/gin"
    "github.com/acme/myapp/internal/domain"
)

type OrderHandler struct{ svc domain.OrderService }

func NewOrderHandler(svc domain.OrderService) *OrderHandler {
    return &OrderHandler{svc: svc}
}

// HTTP request DTO — lives in the delivery package.
type placeOrderRequest struct {
    CustomerID string             `json:"customer_id" binding:"required,uuid"`
    Items      []orderItemRequest `json:"items"       binding:"required,min=1,dive"`
    Coupon     string             `json:"coupon"`
}

type orderItemRequest struct {
    SKU      string `json:"sku"      binding:"required"`
    Quantity int    `json:"quantity" binding:"required,gt=0"`
}

// HTTP response DTO.
type orderResponse struct {
    ID         string    `json:"id"`
    CustomerID string    `json:"customer_id"`
    Status     string    `json:"status"`
    Total      money     `json:"total"`
    PlacedAt   time.Time `json:"placed_at"`
}

type money struct {
    Amount   int64  `json:"amount"`
    Currency string `json:"currency"`
}

func toOrderResponse(o *domain.Order) orderResponse {
    return orderResponse{
        ID:         o.ID,
        CustomerID: o.CustomerID,
        Status:     string(o.Status),
        Total:      money{Amount: o.Total.Amount, Currency: o.Total.Currency},
        PlacedAt:   o.PlacedAt,
    }
}
```

DTOs and the mapping function are private to the delivery package. Domain entities never escape with JSON tags — that would mean the domain layer dictates the wire format.

## A Handler

```go
func (h *OrderHandler) Place(c *gin.Context) {
    var req placeOrderRequest
    if err := c.ShouldBindJSON(&req); err != nil {
        c.JSON(http.StatusUnprocessableEntity, gin.H{"error": "validation failed"})
        return
    }

    in := domain.PlaceOrderInput{
        CustomerID: req.CustomerID,
        Items:      toDomainItems(req.Items),
        Coupon:     req.Coupon,
    }

    order, err := h.svc.Place(c.Request.Context(), in)
    if err != nil {
        respondError(c, err)
        return
    }

    c.JSON(http.StatusCreated, toOrderResponse(order))
}
```

Five lines of business logic — bind, map, call, error, respond. Anything thicker is leaking upward.

## Routing

```go
// internal/delivery/http/router.go
func Register(r *gin.RouterGroup, order *OrderHandler, user *UserHandler) {
    o := r.Group("/orders")
    {
        o.POST("",       order.Place)
        o.GET("/:id",    order.Get)
        o.POST("/:id/cancel", order.Cancel)
    }

    u := r.Group("/users")
    {
        u.POST("",     user.Create)
        u.GET("/:id",  user.Get)
    }
}
```

Routes go next to handlers. The router is shared across handlers; each handler exposes its own `Register*` function and the main composer assembles them.

## Error → Status Mapping

```go
// internal/delivery/http/errors.go
func respondError(c *gin.Context, err error) {
    switch {
    case errors.Is(err, domain.ErrNotFound):
        c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
    case errors.Is(err, domain.ErrAlreadyExists), errors.Is(err, domain.ErrConflict):
        c.JSON(http.StatusConflict, gin.H{"error": err.Error()})
    case errors.Is(err, domain.ErrValidation):
        c.JSON(http.StatusUnprocessableEntity, gin.H{"error": err.Error()})
    case errors.Is(err, domain.ErrForbidden):
        c.JSON(http.StatusForbidden, gin.H{"error": "forbidden"})
    default:
        slog.ErrorContext(c.Request.Context(), "unhandled", "err", err)
        c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error"})
    }
}
```

The mapping lives in delivery because *the same domain error means a 404 over HTTP and a `NotFound` over gRPC.* Move it to domain and the next transport breaks.

## Swapping the Framework

To move from Gin to Echo, only `internal/delivery/http` changes. Compare:

```go
// Echo
func (h *OrderHandler) Place(c echo.Context) error {
    var req placeOrderRequest
    if err := c.Bind(&req); err != nil {
        return c.JSON(http.StatusUnprocessableEntity, echo.Map{"error": "validation failed"})
    }
    order, err := h.svc.Place(c.Request().Context(), domain.PlaceOrderInput{...})
    if err != nil {
        return respondError(c, err)
    }
    return c.JSON(http.StatusCreated, toOrderResponse(order))
}
```

Or net/http:

```go
func (h *OrderHandler) Place(w http.ResponseWriter, r *http.Request) {
    var req placeOrderRequest
    if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
        writeError(w, http.StatusUnprocessableEntity, "validation failed")
        return
    }
    order, err := h.svc.Place(r.Context(), domain.PlaceOrderInput{...})
    if err != nil {
        respondError(w, err)
        return
    }
    writeJSON(w, http.StatusCreated, toOrderResponse(order))
}
```

The usecase and domain see zero diffs.

## Middleware

Authentication, request ID, recovery, tracing — all live in delivery. Put identity in `context.Context`:

```go
func AuthMiddleware(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        user, err := validateToken(r.Header.Get("Authorization"))
        if err != nil { http.Error(w, "unauthorized", 401); return }
        ctx := domain.WithCurrentUser(r.Context(), user)
        next.ServeHTTP(w, r.WithContext(ctx))
    })
}
```

The usecase calls `domain.CurrentUser(ctx)` — the function is defined in domain (so usecase doesn't import delivery), the value is set in delivery.

## What Does NOT Belong Here

- Business logic ("if customer is VIP, apply discount" — that's usecase).
- SQL — never. If you find yourself reaching for the DB from a handler, the usecase is missing a method.
- Hard-coded magic strings — domain should expose constants (`OrderStatusPending`).

## Multiple Transports

A handler for HTTP and a handler for gRPC both live in `internal/delivery/`, both call the same `domain.OrderService`:

```
internal/delivery/
    http/
        order_handler.go
    grpc/
        order_server.go
    cli/
        order_command.go
```

Adding a new transport is contained to its own subdirectory. The rest of the system is untouched.

## Tips

- Keep DTOs and handlers in the same file unless the package grows beyond ~300 lines, then split.
- Validation tags (`binding:"..."`) live on DTOs; don't duplicate them in the domain.
- Map domain → DTO with explicit functions (`toOrderResponse`) instead of struct embedding. Embedding leaks domain field names into the JSON.
- The handler signature is dictated by the framework; don't fight it. If you need framework-agnostic handlers, write tiny adapter functions in delivery.
