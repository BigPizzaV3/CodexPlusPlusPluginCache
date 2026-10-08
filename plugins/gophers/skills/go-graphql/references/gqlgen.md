# gqlgen

`github.com/99designs/gqlgen` is a codegen-based GraphQL server. Its strengths: compile-time type safety, zero runtime reflection, first-class Federation support. Its trade-off: every schema change requires running `go generate`.

## Initial Setup

```bash
go install github.com/99designs/gqlgen@latest
gqlgen init
```

This produces:

```
gqlgen.yml          # configuration
graph/
  schema.graphqls   # SDL
  schema.resolvers.go
  generated/        # generated code (don't edit)
  model/            # generated models (don't edit)
server.go
```

## gqlgen.yml Essentials

```yaml
schema:
  - graph/schema.graphqls

exec:
  filename: graph/generated/generated.go
  package: generated

model:
  filename: graph/model/models_gen.go
  package: model

resolver:
  layout: follow-schema       # one resolver file per schema file
  dir: graph
  package: graph

autobind:
  - "github.com/acme/myapp/internal/domain"   # bind GraphQL types to domain structs

models:
  ID:
    model:
      - github.com/99designs/gqlgen/graphql.ID
  User:
    fields:
      posts:
        resolver: true        # force a dedicated resolver for DataLoader use
```

`autobind` is the antidote to hand-editing `models_gen.go`: if a GraphQL type matches a domain struct field-for-field, gqlgen uses the domain struct directly. No conversion code.

## Generation Workflow

```bash
go run github.com/99designs/gqlgen generate
# or, with tools.go pinning:
go tool gqlgen generate
```

After every schema change, regenerate. The resolver interface will produce a compile error until you implement the new method — that's the safety net.

## DataLoaders with gqlgen

Mark batched fields with `resolver: true` in `gqlgen.yml`. This forces gqlgen to emit a resolver method (instead of struct field access), giving you a place to call the DataLoader.

```go
// graph/schema.resolvers.go
func (r *userResolver) Posts(ctx context.Context, u *model.User) ([]*model.Post, error) {
    return loaders.For(ctx).PostsByUser.Load(u.ID)
}
```

The loader itself:

```go
type Loaders struct {
    PostsByUser *dataloader.Loader[string, []*model.Post]
}

func newPostsByUserLoader(ctx context.Context, db *sql.DB) *dataloader.Loader[string, []*model.Post] {
    return dataloader.NewBatchedLoader(func(ctx context.Context, userIDs []string) []*dataloader.Result[[]*model.Post] {
        // one SQL query for all userIDs
        rows, _ := db.QueryContext(ctx, "SELECT user_id, ... FROM posts WHERE user_id = ANY($1)", userIDs)
        // ... map back to per-user buckets
    })
}
```

Wire it in middleware (see SKILL.md).

## Federation

```yaml
federation:
  filename: graph/generated/federation.go
  package: generated
  version: 2
```

Mark federated entities in the schema:

```graphql
type User @key(fields: "id") {
  id: ID!
  email: String!
}
```

Implement `Entity.FindUserByID(ctx, id)` — the gateway calls it when stitching entities from multiple subgraphs.

## ErrorPresenter

```go
srv := handler.NewDefaultServer(generated.NewExecutableSchema(generated.Config{Resolvers: r}))
srv.SetErrorPresenter(func(ctx context.Context, err error) *gqlerror.Error {
    var ge *gqlerror.Error
    if errors.As(err, &ge) {
        return ge
    }
    slog.ErrorContext(ctx, "graphql internal error", "err", err)
    return gqlerror.Errorf("internal error")
})
srv.SetRecoverFunc(func(ctx context.Context, err interface{}) error {
    slog.ErrorContext(ctx, "graphql panic", "err", err)
    return errors.New("internal error")
})
```

## Production Wiring

```go
srv := handler.New(es)
srv.AddTransport(transport.Options{})
srv.AddTransport(transport.GET{})
srv.AddTransport(transport.POST{})
srv.AddTransport(transport.MultipartForm{})
srv.SetQueryCache(lru.New[*ast.QueryDocument](1000))
srv.Use(extension.Introspection{})        // only in dev
srv.Use(extension.FixedComplexityLimit(200))
srv.Use(extension.AutomaticPersistedQuery{Cache: lru.New[string](100)})
```

Wrap with the auth and DataLoader middlewares from SKILL.md.

## Tips

- Run `gqlgen` from `tools.go` so the version is pinned in `go.mod`.
- `models.<T>.fields.<f>.resolver: true` is the lever you reach for whenever a field needs custom resolution (DataLoader, computed value, authz check).
- For optional input fields, the generated type uses pointers (`*string`); pointer nil means "client did not send the field". Distinguish from "client sent null" only if your client uses input types with explicit nullable wrappers.
- If `models_gen.go` keeps regenerating differently between developers, lock `gqlgen` version and re-run from a clean clone to find the drift.
