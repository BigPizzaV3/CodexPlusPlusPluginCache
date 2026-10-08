# GraphQL Anti-Patterns

## 1. Package-Level DataLoader

```go
// Bad — cache shared across requests, potentially tenants.
var globalPostsLoader = newPostsByUserLoader(context.Background(), db)
```

Even within a single tenant, this leaks stale data: the loader caches "user:42's posts" forever until restart. Worse, the cached `[]*Post` slice is the same memory; resolver mutation in one request affects all subsequent requests.

Always create loaders inside a request-scoped middleware.

## 2. SQL in Resolver

```go
// Bad — resolver becomes a data layer.
func (r *queryResolver) User(ctx context.Context, id string) (*User, error) {
    row := r.db.QueryRowContext(ctx, "SELECT * FROM users WHERE id = $1", id)
    var u User
    _ = row.Scan(&u.ID, &u.Email)
    return &u, nil
}
```

There is now no place to add batching, retries, caching, or authorization without touching every resolver. Delegate to a service.

## 3. Non-Null Field That Can Fail

```graphql
type Order {
  total: Money!     # what if pricing service is down?
}
```

A resolver error on `total!` nulls the entire `Order`, then cascades up if `orders: [Order!]!`. One bad price kills the whole list.

Either:

- Mark it nullable (`total: Money`) so only the field nulls.
- Guarantee in the resolver that an error never bubbles (fallback value, last-known cache).

## 4. Editing Generated Files

`models_gen.go` is rewritten on every `gqlgen generate`. Hand-edits silently disappear. Either:

- Use `autobind` so your domain struct is the model.
- Configure `models.<T>.model` to point at a custom Go type.
- Add helper methods in a separate file.

## 5. Introspection in Production

`__schema { types { name } }` returns your entire API surface. Combined with field-level error messages, it's a road map for an attacker.

```go
if os.Getenv("ENV") != "production" {
    srv.Use(extension.Introspection{})
}
```

## 6. Subscription Goroutine Leak

```go
// Bad — runs forever after client disconnect.
go func() {
    for msg := range pubsub.Subscribe(room) {
        ch <- msg
    }
}()
```

Every disconnected client leaks one goroutine. After enough flapping connections the process OOMs.

```go
// Good — exits when client disconnects.
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

## 7. No Complexity Cap

```graphql
{
  users {
    posts {
      author {
        posts {
          author {
            posts { ... }   # exponential
          }
        }
      }
    }
  }
}
```

Without `extension.FixedComplexityLimit(200)`, one curl request can exhaust your CPU and memory. Set the limit; reject the query at parse time.

## 8. Raw Error to Client

```go
// Bad — DB internals visible to clients.
return nil, err
```

The client sees `pq: duplicate key value violates unique constraint "users_email_key"`. That tells an attacker the table name, the column name, and the index name.

Install an `ErrorPresenter` that returns sanitized messages and logs the rich error server-side.

## 9. `int` for `Int!` in graph-gophers

```go
// Bad — parses but panics at startup with type-mismatch.
func (r *userResolver) Age() int { return r.u.Age }
```

graph-gophers expects `int32` for the GraphQL `Int` scalar. Schema parsing fails with `Method 'Age' has wrong return type`.

## 10. Putting Mutation Errors in the Top-Level Errors Array

```graphql
mutation { createUser(input: { email: "" }) { id email } }
```

If the resolver returns `gqlerror.Error{Message: "email required"}`, clients receive `errors: [...]` and `data: null`. The client must inspect both. The Apollo convention is a payload envelope:

```graphql
type CreateUserPayload {
  user: User
  errors: [FieldError!]!
}
```

Now clients always read from `data.createUser.errors`, and the top-level `errors` is reserved for transport-level failures.
