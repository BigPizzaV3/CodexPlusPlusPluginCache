---
name: go-swagger
description: "Use when adding or maintaining OpenAPI/Swagger documentation for a Go HTTP API. Covers swaggo/swag annotation comments (@Summary, @Param, @Success, @Router, @Security), the swag CLI workflow, framework integration for Gin/Echo/Fiber/Chi/net-http, security definitions (Bearer/JWT, OAuth2, API key), and struct tags (example, enums, swaggertype, swaggerignore). Apply when a project imports github.com/swaggo/swag or any of the swaggo UI adapters, or when you need to expose /swagger/index.html."
license: MIT
compatibility: "Designed for Claude Code or similar AI coding agents. Requires Go 1.21+, swaggo/swag v1.16+ (CLI: `swag`)."
allowed-tools: Read Edit Write Glob Grep Bash(go:*) Bash(golangci-lint:*)
---

# Go Swagger / OpenAPI with swaggo

`github.com/swaggo/swag` is the de-facto annotation-driven OpenAPI generator for Go. You annotate handlers with `// @...` comments, run the `swag` CLI, and get `docs/swagger.json`, `docs/swagger.yaml`, and `docs/docs.go` for the UI.

## Core Rules

1. **Docs are a contract.** A field documented as required is the API's promise; a mismatch with the implementation is a bug.
2. **Annotations live next to handlers.** Not in a separate `docs/` folder — comments rot when separated from code.
3. **Regenerate on every change.** `swag init` is part of the build (`go generate` or a Makefile target). Stale `docs/` is worse than no docs.
4. **The `docs` package must be imported.** A blank import (`_ "yourmod/docs"`) registers the spec at process start.
5. **Use named structs for request/response bodies.** swag cannot derive a schema from `map[string]any` or a primitive type.
6. **Security definitions match implementation.** If the API enforces JWT, declare `@securityDefinitions.apikey Bearer` and annotate every protected endpoint with `@Security Bearer`.

## Install and Bootstrap

```bash
go install github.com/swaggo/swag/cmd/swag@latest
swag init                              # general info from main.go
swag init -g cmd/api/main.go           # custom main path
swag fmt                               # format annotation comments like gofmt
```

Wire the UI for your framework — choose one:

```go
// Gin
import (
    swaggerFiles "github.com/swaggo/files"
    ginSwagger  "github.com/swaggo/gin-swagger"
)
r.GET("/swagger/*any", ginSwagger.WrapHandler(swaggerFiles.Handler))

// Echo
r.GET("/swagger/*", echoSwagger.WrapHandler)

// Fiber
app.Get("/swagger/*", fiberSwagger.WrapHandler(swaggerFiles.Handler))

// Chi / net/http
mux.Handle("/swagger/", httpSwagger.Handler(swaggerFiles.Handler))
```

Import the generated spec:

```go
import _ "github.com/acme/myapi/docs"          // blank: just register
import docs "github.com/acme/myapi/docs"       // named: override host at runtime
```

> Read [references/swag-cli.md](references/swag-cli.md) for the CLI flag inventory and Makefile patterns.

## General API Info

Place in the file passed via `-g` (usually `main.go`):

```go
// @title           Orders API
// @version         1.0
// @description     Orders, customers, shipments.
// @contact.name    API Support
// @contact.email   api@acme.example
// @license.name    Apache-2.0
// @host            api.acme.example
// @BasePath        /api/v1
// @schemes         https http

// @securityDefinitions.apikey Bearer
// @in   header
// @name Authorization
// @description Use "Bearer <token>"
```

For multi-environment deployments, set host/basepath at runtime instead of hard-coding:

```go
import docs "github.com/acme/myapi/docs"

func main() {
    docs.SwaggerInfo.Host     = os.Getenv("API_HOST")
    docs.SwaggerInfo.BasePath = "/api/v1"
    // ...
}
```

## Operation Annotations

```go
// GetOrder godoc
// @Summary      Get an order by ID
// @Tags         orders
// @Produce      json
// @Param        id   path  string  true  "Order ID (UUID)"
// @Success      200  {object}  api.OrderResponse
// @Failure      404  {object}  api.ErrorResponse
// @Router       /orders/{id} [get]
// @Security     Bearer
func GetOrder(c *gin.Context) { /* ... */ }
```

**`@Param`:** `@Param <name> <in> <type> <required> "<desc>" [attributes]` — `<in>` is one of `path`, `query`, `body`, `header`, `formData`. Useful attributes: `default(v)`, `minimum(n)`, `maximum(n)`, `Enums(a,b,c)`, `example(v)`, `collectionFormat(multi)`.

**`@Success` / `@Failure`:** `@<kw> <code> {<kind>} <type> "<desc>"` — `{object}` (struct), `{array}` (slice), or a primitive (`string`, `integer`). Generics (swag v2): `api.Response[model.Order]`. Composition: `api.Response{data=model.Order}`.

> Read [references/annotations.md](references/annotations.md) for the full annotation grammar, edge cases, and security definitions.

## Security

Declare schemes once globally (`@securityDefinitions.apikey Bearer`, `@securityDefinitions.oauth2.authorizationCode`, `@securityDefinitions.basic`) and apply per endpoint:

```go
// @Security Bearer
// @Security OAuth2[read, write]
// @Security BasicAuth && Bearer   // both required (AND)
```

Endpoints without `@Security` are documented as public — match the implementation.

## Struct Tags

Enrich models without changing their Go type. Common tags: `example`, `enums:"a,b,c"`, `minimum`/`maximum`, `minLength`/`maxLength`, `format`, `swaggertype` (override detected type, e.g. `time.Time` → string), `swaggerignore:"true"`, and `extensions:"x-nullable,x-deprecated=true"`.

```go
type CreateOrderRequest struct {
    Status   string    `json:"status" enums:"pending,paid,shipped"`
    Total    int64     `json:"total" minimum:"0" example:"19999"`
    PlacedAt time.Time `json:"placed_at" swaggertype:"string" format:"date-time"`
    Internal string    `json:"-" swaggerignore:"true"`
}
```

> Read [references/struct-tags.md](references/struct-tags.md) for type overrides (`time.Time`, `uuid.UUID`, `decimal.Decimal`, custom scalars) and NULL handling.

## Make Target

```makefile
.PHONY: docs
docs:
	swag fmt
	swag init -g cmd/api/main.go --parseDependency --parseInternal

check-docs: docs
	@git diff --quiet docs || (echo "docs/ is stale; run make docs"; exit 1)
```

Run `make check-docs` in CI to catch annotation drift before merge.

## Anti-Patterns

| Anti-pattern | Why it hurts | Do this instead |
|---|---|---|
| Forgetting `_ "yourmod/docs"` | UI loads empty, no errors | Add the blank import in main |
| `@Param body string` | swag cannot derive a schema from a primitive | Use a named struct |
| Stale `docs/` after handler change | Docs lie to clients | Regenerate in CI; fail on drift |
| General info in wrong file | Spec has no title/host | Use `-g <file>` or move to main |
| `{object} map[string]any` | swag silently empty | Define a wrapper struct |
| No `@Security` on protected route | UI shows no lock icon | Add `@Security` everywhere auth is required |
| Multi-word `@Tags` unquoted | Tags split on whitespace | Quote: `@Tags "order management"` |
| Exposing `/swagger/*` in production unconditionally | Public API surface map | Gate behind env flag or auth |

## Verification Checklist

- [ ] `swag init` runs clean (no warnings)
- [ ] `docs/` is committed and up-to-date with handlers
- [ ] Every handler has `@Summary`, `@Router`, and at least one `@Success`
- [ ] Every protected handler has `@Security`
- [ ] Request bodies are named structs (no `map`, no primitives)
- [ ] Generic / nested response wrappers are spelled correctly (`Response[T]` or `Response{data=T}`)
- [ ] `/swagger/*` is gated in production (env flag or auth middleware)
- [ ] CI fails when `docs/` drifts from annotations

## References

- [references/swag-cli.md](references/swag-cli.md) — CLI flags, parsing options, Makefile patterns
- [references/annotations.md](references/annotations.md) — full annotation grammar with examples
- [references/struct-tags.md](references/struct-tags.md) — type overrides, time/UUID/decimal handling
- [references/anti-patterns.md](references/anti-patterns.md) — detailed walkthrough of each failure mode
