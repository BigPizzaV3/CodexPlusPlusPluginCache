# graph-gophers/graphql-go

`github.com/graph-gophers/graphql-go` is a reflection-based GraphQL server. No codegen, no `gqlgen.yml`. The schema is parsed at startup and resolvers are bound by method name.

## When to Pick It

- Schema is small or medium (< 50 types).
- The build pipeline should stay free of generators.
- Federation is not required.
- The team prefers a dynamic schema (loaded from a database, varying per tenant).

If any of those is not true, gqlgen is the safer choice.

## Resolver Model

Resolvers are plain Go structs whose methods are matched to schema fields by name:

```graphql
type Query {
  user(id: ID!): User
}
type User {
  id: ID!
  email: String!
}
```

```go
type query struct{ users UserService }

func (r *query) User(ctx context.Context, args struct{ ID graphql.ID }) (*userResolver, error) {
    u, err := r.users.Get(ctx, string(args.ID))
    if err != nil { return nil, err }
    return &userResolver{u: u}, nil
}

type userResolver struct{ u *domain.User }

func (r *userResolver) ID() graphql.ID  { return graphql.ID(r.u.ID) }
func (r *userResolver) Email() string   { return r.u.Email }
```

## Type Mapping

| Schema | Go |
|---|---|
| `Int` | `int32` (not `int`) |
| `Float` | `float64` |
| `Boolean` | `bool` |
| `String` | `string` |
| `ID` | `graphql.ID` (alias for `string`) |
| `[T!]!` | `[]T` |
| `[T]!` | `[]*T` (nil entries allowed) |
| Nullable field | pointer (`*string`) |
| Input | struct |

Forgetting that `Int` maps to `int32` (not `int`) is the most common bug. The error is at parse time: `"Method 'Age' has wrong return type."`.

## Schema Bootstrap

```go
schemaString, _ := os.ReadFile("schema.graphql")
schema := graphql.MustParseSchema(string(schemaString), &query{},
    graphql.MaxDepth(10),
    graphql.MaxParallelism(10),
    graphql.UseFieldResolvers(),
)

mux := http.NewServeMux()
mux.Handle("/query", &relay.Handler{Schema: schema})
```

`MaxDepth` and `MaxParallelism` are the equivalents of gqlgen's complexity limit.

## Errors with Extensions

Implement the `ResolverError` interface to attach extensions:

```go
type notFoundError struct{ id string }

func (e *notFoundError) Error() string                { return fmt.Sprintf("user %s not found", e.id) }
func (e *notFoundError) Extensions() map[string]any   { return map[string]any{"code": "NOT_FOUND"} }
```

graph-gophers will surface `extensions.code = "NOT_FOUND"` in the GraphQL response.

## DataLoaders

The library does not ship a DataLoader. Use `github.com/graph-gophers/dataloader/v7` (same authors). Pattern is identical to the gqlgen one — per-request, stashed in `context`.

```go
func (r *userResolver) Posts(ctx context.Context) ([]*postResolver, error) {
    posts, err := loaders.For(ctx).PostsByUser.Load(ctx, dataloader.StringKey(r.u.ID))()
    if err != nil { return nil, err }
    return wrapPosts(posts), nil
}
```

## Tracing

Pass `graphql.Tracer(myTracer)` to `MustParseSchema`. The library calls `TraceQuery` and `TraceField` hooks where you can emit OpenTelemetry spans. See the OpenTelemetry community tracer at `github.com/graph-gophers/graphql-go-tools`.

## Limitations vs gqlgen

- No Apollo Federation support.
- No automatic struct binding — every field of every type is a method, which is verbose.
- Reflection overhead is small but real; for very hot paths gqlgen wins.

## Tips

- Keep one resolver struct per GraphQL type. A single mega-resolver becomes unwieldy.
- For nullable scalar fields, return `*string` (or `*int32`), not `string` with sentinel "".
- For input types, embed them as struct types in resolver arg structs — `args struct{ Input CreateUserInput }`.
- Cache the parsed schema in memory; never re-parse per request.
