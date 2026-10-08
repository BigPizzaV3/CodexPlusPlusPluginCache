# Swagger Anti-Patterns

## 1. Missing `docs` Import

```go
// main.go
import (
    _ "yourmod/docs"   // ← without this, the UI loads but the spec is empty
)
```

The generated `docs/docs.go` has an `init()` that registers the spec with swag's global state. Forget the blank import and the UI displays "Failed to load API definition" with no obvious cause.

## 2. Stale `docs/`

Annotations change in handlers; nobody runs `swag init`; the committed `docs/` describes last sprint's API. Clients break in subtle ways.

Solutions, in order of robustness:

- `go generate` on pre-commit hook.
- `make check-docs` in CI that diffs after regenerating.
- Don't commit `docs/` at all; regenerate at build time.

The CI diff is the most reliable — pre-commit hooks get skipped.

## 3. Primitive or Map as Body Type

```go
// @Param body body string true "Raw text"             // ← swag can't infer schema
// @Param body body map[string]any true "Arbitrary"    // ← same
```

OpenAPI requires a schema. Define a struct, even if it's a thin wrapper:

```go
type RawTextRequest struct {
    Content string `json:"content"`
}
// @Param body body api.RawTextRequest true "Text"
```

For genuinely free-form JSON, use `json.RawMessage` with `swaggertype:"object"`.

## 4. General Info in the Wrong File

```go
// internal/server/init.go  ← wrong place
// @title Orders API
```

`swag init` reads general info only from the file passed via `-g` (default `main.go`). Annotations elsewhere are silently ignored, and the spec ends up with no title or host.

```bash
swag init -g internal/server/init.go   # if you really must
```

## 5. No `@Security` on Protected Endpoints

The handler runs auth middleware; the annotation is missing. Swagger UI shows no padlock, the "Try it out" panel does not send the token, and consumers' generated clients omit auth altogether.

Apply `@Security` everywhere middleware applies. If everything is protected, declare a default scheme in main.

## 6. Exposing `/swagger/*` in Production

The UI is convenient — and a complete map of every endpoint, query parameter, and body schema. Behind a public load balancer, that's free reconnaissance for attackers.

Gate it:

```go
if cfg.Env != "production" {
    mux.Handle("/swagger/", httpSwagger.Handler(swaggerFiles.Handler))
}
```

Or behind admin auth:

```go
mux.Handle("/swagger/", adminAuth(httpSwagger.Handler(swaggerFiles.Handler)))
```

## 7. Multi-Word `@Tags` Without Quotes

```go
// @Tags order management      ← becomes tags: ["order", "management"]
```

```go
// @Tags "order management"
```

The UI then groups by the right name, and generated clients name the API class correctly.

## 8. Schema Drifts Between `validate` and `@Param`

```go
type CreateOrderRequest struct {
    Total int64 `json:"total" validate:"required,gt=0"`
}
// @Param body body api.CreateOrderRequest true "Order"
// Implementation: c.ShouldBindJSON → validate.Struct → 400 if Total <= 0
```

If the docs claim `minimum: 0` but the validator requires `> 0`, clients get cryptic 400s. Keep them in lockstep — use struct tags as the source of truth and document them in `@Description`:

```go
type CreateOrderRequest struct {
    // Total in cents. Must be strictly positive.
    Total int64 `json:"total" minimum:"1" example:"19999" validate:"required,gt=0"`
}
```

## 9. Generic Wrapper Spelled Wrong

```go
// @Success 200 {object} api.Response{Order}             ← won't parse
// @Success 200 {object} api.Response<api.Order>         ← old syntax, depends on version
// @Success 200 {object} api.Response[api.Order]         ← swag v2 generics
// @Success 200 {object} api.Response{data=api.Order}    ← composition syntax
```

Pick one project-wide. Mixing generates inconsistent schemas. `Response[T]` works only on swag v2+; for older versions, use the composition `{data=T}` form.

## 10. Hand-Editing `docs/docs.go`

Tempting when one field looks wrong, fatal when the next `swag init` wipes the change. Fix it at the annotation source. If swag genuinely cannot express what you need, file an issue and use `extensions:"x-..."` as a workaround.
