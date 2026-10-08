# Annotation Grammar

All annotations are `// @key value` Go comments attached to a function (operation) or a `main` declaration (general info). swag parses them at codegen time.

## Operation Annotation Cheat Sheet

| Annotation | Required | Purpose |
|---|---|---|
| `@Summary` | Yes | One-line summary, shown in operation list |
| `@Description` | No | Longer description; multi-line allowed |
| `@Tags` | Recommended | Comma-separated grouping; quote multi-word tags |
| `@Accept` | If body input | `json`, `xml`, `mpfd`, `x-www-form-urlencoded`, `*/*` |
| `@Produce` | Recommended | Same set as `@Accept` |
| `@Param` | Per parameter | See below |
| `@Success` | At least one | Successful response |
| `@Failure` | Per error | Error responses |
| `@Header` | No | Response headers |
| `@Router` | Yes | `path [method]` |
| `@Security` | If protected | References a named scheme |
| `@Deprecated` | No | Marks operation deprecated |

## `@Param` Grammar

```
@Param <name> <in> <type> <required> "<description>" [attributes]
```

| Field | Example |
|---|---|
| name | `id`, `body`, `X-Tenant-ID` |
| in | `path`, `query`, `body`, `header`, `formData` |
| type | `string`, `integer`, `boolean`, `array`, or model `pkg.Type` |
| required | `true` / `false` |
| description | quoted string |
| attributes | `default(v)`, `minimum(n)`, `maximum(n)`, `minLength(n)`, `maxLength(n)`, `Enums(a,b,c)`, `example(v)`, `collectionFormat(multi)` |

Examples:

```go
// @Param id    path   string  true  "Order ID" minlength(36) maxlength(36)
// @Param page  query  int     false "Page number" minimum(1) default(1)
// @Param sort  query  string  false "Sort key" Enums(created_at,price,-created_at)
// @Param body  body   api.CreateOrderRequest  true  "Order payload"
// @Param file  formData file  true  "Upload"
// @Param Authorization header string true "Bearer token"
```

For repeated query params (`?tag=a&tag=b`):

```go
// @Param tags query []string false "Filter tags" collectionFormat(multi)
```

## `@Success` / `@Failure` Grammar

```
@<status> <code> {<kind>} <type> "<description>"
```

- `{object}` — single struct
- `{array}` — slice of structs (`{array} api.Order`)
- `string`, `integer`, `boolean` — primitive
- Omit `{kind}` for "no body" responses; provide just the description.

```go
// @Success 200 {object} api.OrderResponse
// @Success 200 {array}  api.OrderResponse  "list result"
// @Success 204                              "no content"
// @Failure 400 {object} api.ErrorResponse
// @Failure 404 {object} api.ErrorResponse
```

### Generics (swag v2)

```go
// @Success 200 {object} api.Response[api.Order]
// @Success 200 {object} api.Page[api.Order]
```

### Composition

When the wrapper struct varies (e.g., `data` field changes type):

```go
// @Success 200 {object} api.Response{data=api.Order}
// @Success 200 {object} api.Response{data=[]api.Order,meta=api.PageInfo}
```

## `@Router`

```
@Router <path> [<method>]
```

Methods: `get`, `post`, `put`, `patch`, `delete`, `options`, `head`.

```go
// @Router /orders          [get]
// @Router /orders/{id}     [delete]
```

Path templating uses `{name}`. The `name` must match a `@Param ... path` entry.

## `@Security`

References a scheme declared at the API level.

```go
// @Security Bearer
// @Security OAuth2[read, write]
// @Security ApiKeyAuth && OAuth2[read]   // AND — both required
```

To mark an operation explicitly public despite a global default, omit `@Security` (and don't enable a default scheme globally).

## General Info Annotations (main.go)

| Annotation | Example |
|---|---|
| `@title` | `Orders API` |
| `@version` | `1.0` |
| `@description` | one-line; chain multiple `@description.markdown` for paragraphs |
| `@termsOfService` | URL |
| `@contact.name` / `.email` / `.url` | strings |
| `@license.name` / `.url` | strings |
| `@host` | `api.acme.example` |
| `@BasePath` | `/api/v1` |
| `@schemes` | `https http` |
| `@accept` / `@produce` | global defaults |
| `@externalDocs.description` / `.url` | strings |

Security schemes:

```go
// @securityDefinitions.apikey Bearer
// @in header
// @name Authorization

// @securityDefinitions.basic BasicAuth

// @securityDefinitions.oauth2.authorizationCode OAuth2
// @authorizationUrl https://login.example/authorize
// @tokenUrl         https://login.example/token
// @scope.read       Read access
// @scope.write      Write access
```

## Tips

- The `// FuncName godoc` line is not optional with `swag fmt` — it anchors the comment block.
- Multi-line `@Description` continues until the next `@`-prefixed line.
- Use `@x-extension key value` for arbitrary OpenAPI `x-*` fields.
- Annotation order matters for human reading; swag itself is order-tolerant.
