---
name: go-graphql
description: "Use when building or reviewing a GraphQL API in Go. Covers library choice (gqlgen vs graph-gophers), schema design (nullability, pagination, mutation envelopes), thin resolver pattern, per-request DataLoaders for N+1, authentication via context plus schema directives, error presenters, subscription lifecycle (context cancellation), and production hardening (complexity limits, introspection gating). Apply when working with github.com/99designs/gqlgen or github.com/graph-gophers/graphql-go."
license: MIT
compatibility: "Designed for Claude Code or similar AI coding agents. Requires Go 1.21+. gqlgen v0.17+ or graph-gophers/graphql-go v1.5+."
allowed-tools: Read Edit Write Glob Grep Bash(go:*) Bash(golangci-lint:*)
---

# Go GraphQL

Both production-grade Go GraphQL libraries are schema-first: write SDL (`.graphql`), bind Go resolvers. Pick the library, write the schema deliberately, and treat DataLoaders + complexity limits as non-optional.

## Core Rules

1. **Schema is the contract.** Design nullability and pagination once; clients depend on it forever. A change from nullable to non-null is a breaking change.
2. **Resolvers are thin.** Translate GraphQL input → domain call → GraphQL output. No SQL, no business logic.
3. **DataLoaders are per-request.** Construct in HTTP middleware, stash in `context`. A package-level DataLoader is a cross-tenant data leak.
4. **Authenticate in middleware, authorize in the schema.** HTTP middleware extracts identity; schema directives (or resolver checks) enforce per-field rules.
5. **Subscriptions respect context.** Every subscription goroutine selects on `ctx.Done()` and `defer close(ch)`. Otherwise a disconnected client leaks a goroutine forever.
6. **Production limits are non-optional.** Set complexity caps; gate introspection by environment; never expose raw internal errors.

## Library Decision

| Library | Approach | Type safety | Build step | Pick when |
|---|---|---|---|---|
| `github.com/99designs/gqlgen` | Codegen | Compile-time | `go generate` | Large schemas, Federation, strict types |
| `github.com/graph-gophers/graphql-go` | Reflection | Parse-time | None | Small/medium schemas, simple pipeline |
| `github.com/graphql-go/graphql` | Code-first | Runtime | None | **Avoid** — verbose, no SDL |

> Read [references/gqlgen.md](references/gqlgen.md) for the codegen workflow, `gqlgen.yml`, DataLoaders, and Federation.
> Read [references/graph-gophers.md](references/graph-gophers.md) for the reflection model, type mapping, and tracing.

## Schema Design

```graphql
type User {
  id: ID!                # opaque scalar; never expose Int
  email: String!         # server can always return this → non-null
  bio: String            # may be unset → nullable
  posts(first: Int = 10, after: String): PostConnection!
}

type CreateUserPayload {  # mutation envelope: business errors as data
  user: User
  errors: [UserError!]!
}

type PostConnection {     # Relay cursor pagination
  edges: [PostEdge!]!
  pageInfo: PageInfo!
}
```

**Nullability rule.** A field is `!` only when the server can *always* return a value. A resolver error on a non-null field nulls the parent object — cascade failures. Nullable fields null only themselves.

**Pagination.** Cursor connections beat offset pagination on large or write-heavy datasets — cursors are stable under concurrent inserts.

**Mutation envelopes.** Wrap mutation results so business-level errors (validation, conflict) become first-class data instead of polluting the top-level `errors` array.

## Thin Resolvers

```go
// Good — resolver translates and delegates.
func (r *mutationResolver) CreateUser(ctx context.Context, in CreateUserInput) (*CreateUserPayload, error) {
    user, err := r.users.Create(ctx, in.Email, in.Name)
    if err != nil {
        return nil, presentError(err)
    }
    return &CreateUserPayload{User: toGQLUser(user)}, nil
}

// Bad — SQL inside the resolver.
func (r *queryResolver) User(ctx context.Context, id string) (*User, error) {
    row := r.db.QueryRowContext(ctx, "SELECT * FROM users WHERE id = $1", id)
    // ...
}
```

Use per-type resolver structs (`userResolver`, `postResolver`) instead of one monolithic resolver. It scales with the schema.

## N+1 Prevention with DataLoaders

A naive `User.posts` resolver fires one SQL query per user — O(n) round-trips. DataLoaders coalesce per-field loads within a single tick into one batched query.

```go
// Good — per-request DataLoader in middleware.
func DataLoaderMiddleware(db *sql.DB, next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        loaders := &Loaders{
            PostsByUser: newPostsByUserLoader(r.Context(), db),
        }
        ctx := context.WithValue(r.Context(), loadersKey{}, loaders)
        next.ServeHTTP(w, r.WithContext(ctx))
    })
}

// Bad — package-level DataLoader caches across requests.
var globalLoader = newPostsByUserLoader(context.Background(), db)
```

Package-level DataLoaders silently serve user A's data to user B's request as long as the cached key matches. This is the most dangerous bug in Go GraphQL services.

## Authn vs Authz

Authenticate in HTTP middleware (extract identity, stash in `ctx`); authorize per-field via schema directives (`@hasRole(role: ADMIN)`) in gqlgen, or resolver-level checks in graph-gophers. Authorization policy belongs in the schema, not scattered across resolvers. See [references/gqlgen.md](references/gqlgen.md).

## Error Handling

Never surface raw `error` values — they leak SQL fragments and internals. Install an `ErrorPresenter` (gqlgen) or implement `ResolverError` (graph-gophers) that returns sanitized messages. Attach a stable `code` in extensions (`NOT_FOUND`, `FORBIDDEN`) for client handling. Use `graphql.AddError(ctx, err)` for non-fatal field errors with partial data.

## Subscriptions

Every subscription goroutine must `defer close(ch)` and select on `ctx.Done()` in both the receive and send branches:

```go
go func() {
    defer close(ch)
    for {
        select {
        case <-ctx.Done(): return
        case msg := <-sub:
            select { case ch <- msg: case <-ctx.Done(): return }
        }
    }
}()
```

Without this, every disconnected client leaks a goroutine.

## Production Hardening

- `extension.FixedComplexityLimit(200)` (gqlgen) or `graphql.MaxDepth(10)` + `MaxParallelism(10)` (graph-gophers)
- Gate introspection behind an env check
- Consider persisted queries (gqlgen APQ) so production only accepts pre-approved hashed queries

## Anti-Patterns

| Anti-pattern | Why it hurts | Do this instead |
|---|---|---|
| Package-level DataLoader | Cross-tenant data leakage, stale cache | Construct per-request in middleware |
| SQL in resolver | Resolver becomes data layer; no batching | Delegate to service; load via DataLoader |
| Non-null field that can fail | Cascade-nulls the parent | Make it nullable; or guarantee in resolver |
| Editing `models_gen.go` | Wiped on next codegen | Use `autobind` / `models.<T>.model` in gqlgen.yml |
| Introspection in production | Exposes full schema surface | Gate by env |
| Subscription goroutine leak | Each disconnect leaks a goroutine | `defer close(ch)` + `select ctx.Done()` |
| No complexity cap | Single deep query = CPU/memory DoS | `FixedComplexityLimit(N)` or persisted queries |
| Raw internal error to client | Leaks DB messages, stack traces | `ErrorPresenter` returning sanitized message |
| `int` field for `Int!` in graph-gophers | Library expects `int32` | Use `int32` (or `float64` for `Float`) |

## Verification Checklist

- [ ] Every non-null field is one the server can always return
- [ ] List fields use cursor pagination, not offset
- [ ] Mutations return envelope types with `errors: [UserError!]!`
- [ ] DataLoaders are constructed in HTTP middleware, never package-level
- [ ] Authentication is in HTTP middleware; authorization is in directives or resolver checks
- [ ] `ErrorPresenter` (gqlgen) or `ResolverError` (graph-gophers) sanitizes internals
- [ ] Every subscription `defer close(ch)` and selects on `ctx.Done()`
- [ ] Complexity limit set; introspection gated by env
- [ ] No resolver reads SQL directly

## References

- [references/gqlgen.md](references/gqlgen.md) — codegen workflow, `gqlgen.yml`, DataLoaders, Federation
- [references/graph-gophers.md](references/graph-gophers.md) — reflection model, type mapping, tracing
- [references/dataloaders.md](references/dataloaders.md) — batched loading patterns, cache lifecycle, gotchas
- [references/anti-patterns.md](references/anti-patterns.md) — detailed walkthrough of each anti-pattern
