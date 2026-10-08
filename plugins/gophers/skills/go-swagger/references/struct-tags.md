# Struct Tags for Swagger

Annotations describe the HTTP shape; struct tags describe the model shape. swag reads JSON tags for field names and a small set of dedicated tags for type/validation/examples.

## The Tag Inventory

| Tag | Purpose | Example |
|---|---|---|
| `json` | Field name in the schema | `json:"customer_id"` |
| `example` | Example value in Swagger UI | `example:"jane@acme.example"` |
| `enums` | Allowed string values | `enums:"pending,paid,shipped"` |
| `default` | Default value | `default:"pending"` |
| `minimum` / `maximum` | Numeric bounds | `minimum:"0" maximum:"100"` |
| `minLength` / `maxLength` | String length bounds | `minLength:"3" maxLength:"50"` |
| `format` | OpenAPI format hint | `format:"date-time"` |
| `swaggertype` | Override detected type | `swaggertype:"string"` |
| `swaggerignore` | Exclude field from schema | `swaggerignore:"true"` |
| `extensions` | OpenAPI `x-*` extensions | `extensions:"x-nullable,x-order=2"` |
| `validate` | (read by go-playground/validator) — orthogonal to swag, but a common convention to keep alongside | `validate:"required,email"` |

## Required Fields

There is **no `required` struct tag**. swag uses `validate:"required"` (go-playground/validator) or `binding:"required"` (Gin) heuristically. If you want explicit required fields, declare them in the `@Param` annotation for body parameters or document them in `@Description`.

To make a field always required by the spec, use the validator tag and the framework binding will enforce it at runtime:

```go
type CreateOrderRequest struct {
    CustomerID string `json:"customer_id" validate:"required,uuid"`
    Total      int64  `json:"total"       validate:"required,gt=0"`
}
```

## Overriding Types

OpenAPI does not know `time.Time` or `uuid.UUID`. Tell swag what they look like:

```go
type Order struct {
    ID        uuid.UUID `json:"id"         swaggertype:"string" format:"uuid"`
    PlacedAt  time.Time `json:"placed_at"  swaggertype:"string" format:"date-time"`
    Price     decimal.Decimal `json:"price" swaggertype:"string" example:"19.99"`
    Tags      []string  `json:"tags"       swaggertype:"array,string"`
    Raw       json.RawMessage `json:"raw" swaggertype:"object"`
}
```

Common overrides:

| Go type | `swaggertype` | `format` |
|---|---|---|
| `time.Time` | `string` | `date-time` |
| `time.Duration` | `integer` | `int64` (nanoseconds) — usually better to model as string in the API |
| `uuid.UUID` | `string` | `uuid` |
| `decimal.Decimal` | `string` | (none — use `example`) |
| `*big.Int` | `string` | (none) |
| `json.RawMessage` | `object` | (none) |
| Custom enum type | `string` + `enums:"..."` | (none) |

## Excluding Fields

```go
type User struct {
    ID           string `json:"id"`
    Email        string `json:"email"`
    PasswordHash string `json:"-" swaggerignore:"true"`
}
```

The `json:"-"` already removes the field from serialized JSON; `swaggerignore:"true"` removes it from the generated schema (which JSON serialization doesn't control).

## Examples

```go
type CreateUserRequest struct {
    Email string `json:"email" example:"jane@acme.example"`
    Name  string `json:"name"  example:"Jane Doe"`
    Role  string `json:"role"  enums:"admin,user,guest" example:"user"`
    Age   int    `json:"age"   minimum:"18" maximum:"120" example:"32"`
}
```

The UI shows the examples in the "Try it out" panel — useful documentation, and a sanity check that the schema is correct.

## Composition

Embed types and swag will inline fields:

```go
type Pagination struct {
    Page  int `json:"page"  example:"1"`
    Limit int `json:"limit" example:"50"`
}

type ListOrdersRequest struct {
    Pagination
    Status string `json:"status" enums:"pending,paid,shipped"`
}
```

The generated schema for `ListOrdersRequest` has `page`, `limit`, and `status` as siblings.

## Envelope / Wrapper Types

```go
type Response[T any] struct {
    Data    T              `json:"data"`
    Meta    map[string]any `json:"meta,omitempty"`
}

type ErrorResponse struct {
    Error   string         `json:"error"   example:"validation failed"`
    Details map[string]any `json:"details,omitempty"`
}
```

Reference in annotations as `api.Response[api.Order]` (swag v2 generics).

## Tips

- Keep all swagger struct tags on one line so `swag fmt` can re-align them.
- Don't duplicate `example` in both struct tag and `@Param ... example()`. Prefer the struct tag — it propagates to every consumer of the type.
- `format` is informational; tooling like client generators use it to pick types (`date-time` → `time.Time` in Go clients, `Date` in Java).
- `extensions` is the escape hatch for any OpenAPI keyword swag does not natively support.
